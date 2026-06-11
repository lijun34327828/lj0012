import path from 'node:path';
import fs from 'node:fs/promises';
import {
  Document,
  Packer,
  Paragraph as DocxParagraph,
  TextRun,
  Table as DocxTable,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  HeadingLevel,
} from 'docx';
import PDFDocument from 'pdfkit';
import type {
  LayoutResult,
  ParagraphBlock,
  ExportFormat,
  OCRTask,
} from '@shared/types';
import { config } from '@api/config';
import {
  generateExportId,
  generateId,
  ensureDir,
  ensureFileDir,
  fileExists,
  writeJson,
  readJson,
  sanitizeFilename,
} from '../utils/index.js';
import TaskQueueService from './TaskQueueService.js';

interface ExportOptions {
  includeImages?: boolean;
  preserveLayout?: boolean;
  watermark?: string;
  password?: string;
  filename?: string;
  includeStatistics?: boolean;
}

interface ExportRecord {
  id: string;
  taskId: string;
  format: ExportFormat;
  filename: string;
  filePath: string;
  size: number;
  createdAt: number;
  options: ExportOptions;
}

interface ExportStore {
  records: Record<string, ExportRecord>;
}

const EXPORT_DATA_PATH = path.join(config.storage.dataDir, 'exports.json');

const getStore = async (): Promise<ExportStore> => {
  await ensureDir(config.storage.dataDir);
  if (await fileExists(EXPORT_DATA_PATH)) {
    try {
      return await readJson<ExportStore>(EXPORT_DATA_PATH);
    } catch {
      return { records: {} };
    }
  }
  return { records: {} };
};

const saveStore = async (store: ExportStore): Promise<void> => {
  await writeJson(EXPORT_DATA_PATH, store);
};

const blockText = (block: ParagraphBlock): string => {
  return block.texts.map((t) => t.content).join(' ');
};

export const ExportService = {
  generateMarkdown(
    result: LayoutResult,
    options: ExportOptions = {},
  ): string {
    const lines: string[] = [];

    for (const block of result.blocks) {
      switch (block.type) {
        case 'heading': {
          lines.push(`## ${blockText(block).trim()}`);
          lines.push('');
          break;
        }
        case 'paragraph': {
          lines.push(blockText(block).trim());
          lines.push('');
          break;
        }
        case 'list': {
          const content = blockText(block).trim();
          lines.push(`- ${content}`);
          lines.push('');
          break;
        }
        case 'table': {
          if (block.tableData && block.tableData.length > 0) {
            const headers = block.tableData[0];
            lines.push(`| ${headers.join(' | ')} |`);
            lines.push(`| ${headers.map(() => '---').join(' | ')} |`);
            for (let i = 1; i < block.tableData.length; i++) {
              const row = block.tableData[i];
              lines.push(`| ${row.join(' | ')} |`);
            }
            lines.push('');
          }
          break;
        }
      }
    }

    if (options.includeStatistics) {
      lines.push('---');
      lines.push('');
      lines.push('**统计信息**');
      lines.push('');
      lines.push(`- 总字数：${result.statistics.totalChars}`);
      lines.push(`- 手写体字数：${result.statistics.handwrittenChars}`);
      lines.push(`- 印刷体字数：${result.statistics.printedChars}`);
      lines.push(`- 平均置信度：${(result.statistics.avgConfidence * 100).toFixed(1)}%`);
      lines.push(`- 总页数：${result.pages}`);
      lines.push('');
    }

    return lines.join('\n');
  },

  generateTxt(result: LayoutResult): string {
    const texts: string[] = [];
    for (const block of result.blocks) {
      if (block.type === 'table' && block.tableData) {
        for (const row of block.tableData) {
          texts.push(row.join('\t'));
        }
      } else {
        texts.push(blockText(block).trim());
      }
    }
    return texts.join('\n');
  },

  generateJson(result: LayoutResult): string {
    return JSON.stringify(result, null, 2);
  },

  async generateDocx(
    result: LayoutResult,
    options: ExportOptions = {},
  ): Promise<Buffer> {
    const docChildren: any[] = [];

    for (const block of result.blocks) {
      switch (block.type) {
        case 'heading': {
          docChildren.push(
            new DocxParagraph({
              heading: HeadingLevel.HEADING_2,
              children: [new TextRun({ text: blockText(block).trim(), size: 28, bold: true })],
            }),
          );
          break;
        }
        case 'paragraph':
        case 'list': {
          const content = blockText(block).trim();
          const runs: TextRun[] = [];
          let pos = 0;
          for (const tb of block.texts) {
            const text = tb.content;
            const runProps: any = { text };
            if (tb.type === 'handwritten') {
              runProps.italics = true;
              runProps.color = '374151';
            }
            if (tb.confidence < 0.8) {
              runProps.color = 'DC2626';
            }
            runs.push(new TextRun(runProps));
            pos += text.length;
          }
          docChildren.push(
            new DocxParagraph({
              indent: block.type === 'list' ? { left: 480 } : undefined,
              bullet: block.type === 'list' ? { level: 0 } : undefined,
              children: runs.length > 0 ? runs : [new TextRun(content)],
            }),
          );
          break;
        }
        case 'table': {
          if (block.tableData && block.tableData.length > 0) {
            const rows = block.tableData.map((row, idx) => {
              const cells = row.map((cell) =>
                new TableCell({
                  children: [new DocxParagraph({ children: [new TextRun(cell)] })],
                  width: { size: 2000, type: WidthType.DXA },
                }),
              );
              return new TableRow({
                tableHeader: idx === 0,
                children: cells,
              });
            });
            docChildren.push(
              new DocxTable({
                width: { size: 100, type: WidthType.PERCENTAGE },
                rows,
              }),
            );
            docChildren.push(new DocxParagraph({ children: [] }));
          }
          break;
        }
      }
    }

    if (options.includeStatistics) {
      docChildren.push(
        new DocxParagraph({
          border: { top: { style: 'single', size: 6 } },
          children: [
            new TextRun({ text: '统计信息', bold: true, size: 24 }),
          ],
        }),
      );
      docChildren.push(
        new DocxParagraph({
          children: [
            new TextRun(
              `总字数：${result.statistics.totalChars}  ` +
                `手写体：${result.statistics.handwrittenChars}  ` +
                `印刷体：${result.statistics.printedChars}  ` +
                `平均置信度：${(result.statistics.avgConfidence * 100).toFixed(1)}%  ` +
                `总页数：${result.pages}`,
            ),
          ],
        }),
      );
    }

    if (options.watermark) {
      docChildren.push(
        new DocxParagraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: options.watermark, color: 'D1D5DB', size: 18 })],
        }),
      );
    }

    const doc = new Document({ sections: [{ children: docChildren }] });
    return Packer.toBuffer(doc);
  },

  async generatePdf(
    result: LayoutResult,
    options: ExportOptions = {},
  ): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      try {
        const doc = new PDFDocument({ size: 'A4', margin: 50 });
        const chunks: Buffer[] = [];

        doc.on('data', (chunk: Buffer) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        for (const block of result.blocks) {
          switch (block.type) {
            case 'heading': {
              doc.font('Helvetica-Bold').fontSize(16).text(blockText(block).trim(), {
                underline: true,
              });
              doc.moveDown(0.5);
              break;
            }
            case 'paragraph': {
              doc.font('Helvetica').fontSize(12).text(blockText(block).trim());
              doc.moveDown(0.3);
              break;
            }
            case 'list': {
              doc.font('Helvetica').fontSize(12).text(`• ${blockText(block).trim()}`);
              doc.moveDown(0.2);
              break;
            }
            case 'table': {
              if (block.tableData && block.tableData.length > 0) {
                const table = block.tableData;
                const cellWidth = 120;
                let y = doc.y;
                for (let r = 0; r < table.length; r++) {
                  const row = table[r];
                  let x = 50;
                  for (let c = 0; c < row.length; c++) {
                    doc.font(r === 0 ? 'Helvetica-Bold' : 'Helvetica')
                      .fontSize(10)
                      .text(row[c], x, y, { width: cellWidth, align: 'left' });
                    x += cellWidth;
                  }
                  y += 22;
                }
                doc.y = y + 10;
              }
              break;
            }
          }
        }

        if (options.includeStatistics) {
          doc.addPage();
          doc.font('Helvetica-Bold').fontSize(14).text('统计信息');
          doc.moveDown(0.5);
          doc.font('Helvetica').fontSize(12);
          doc.text(`总字数：${result.statistics.totalChars}`);
          doc.text(`手写体字数：${result.statistics.handwrittenChars}`);
          doc.text(`印刷体字数：${result.statistics.printedChars}`);
          doc.text(`平均置信度：${(result.statistics.avgConfidence * 100).toFixed(1)}%`);
          doc.text(`总页数：${result.pages}`);
        }

        if (options.watermark) {
          doc.addPage();
          doc
            .font('Helvetica')
            .fontSize(12)
            .fillColor('gray')
            .text(options.watermark, { align: 'center' });
        }

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  },

  async generate(
    taskId: string,
    format: ExportFormat,
    options: ExportOptions = {},
  ): Promise<{ exportId: string; filename: string; size: number }> {
    await ensureDir(config.storage.exportsDir);

    const task: OCRTask | null = await TaskQueueService.getTask(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }
    if (!task.result) {
      throw new Error(`Task result not available: ${taskId}`);
    }

    const exportId = generateExportId();
    const baseName = options.filename || sanitizeFilename(task.name || exportId);
    const extMap: Record<ExportFormat, string> = {
      markdown: 'md',
      txt: 'txt',
      json: 'json',
      docx: 'docx',
      pdf: 'pdf',
    };
    const ext = extMap[format];
    const filename = `${baseName}_${exportId.slice(5, 11)}.${ext}`;
    const filePath = path.join(config.storage.exportsDir, filename);

    let content: Buffer | string;

    switch (format) {
      case 'markdown':
        content = this.generateMarkdown(task.result, options);
        await fs.writeFile(filePath, content, 'utf-8');
        break;
      case 'txt':
        content = this.generateTxt(task.result);
        await fs.writeFile(filePath, content, 'utf-8');
        break;
      case 'json':
        content = this.generateJson(task.result);
        await fs.writeFile(filePath, content, 'utf-8');
        break;
      case 'docx':
        content = await this.generateDocx(task.result, options);
        await fs.writeFile(filePath, content);
        break;
      case 'pdf':
        content = await this.generatePdf(task.result, options);
        await fs.writeFile(filePath, content);
        break;
    }

    const stats = await fs.stat(filePath);
    const size = stats.size;

    const store = await getStore();
    store.records[exportId] = {
      id: exportId,
      taskId,
      format,
      filename,
      filePath,
      size,
      createdAt: Date.now(),
      options,
    };
    await saveStore(store);

    return { exportId, filename, size };
  },

  async getExportPath(exportId: string): Promise<{ filePath: string; filename: string; size: number } | null> {
    const store = await getStore();
    const record = store.records[exportId];
    if (!record) return null;
    if (!(await fileExists(record.filePath))) return null;
    return {
      filePath: record.filePath,
      filename: record.filename,
      size: record.size,
    };
  },

  async getExportRecord(exportId: string): Promise<ExportRecord | null> {
    const store = await getStore();
    return store.records[exportId] || null;
  },

  async listExports(taskId?: string): Promise<ExportRecord[]> {
    const store = await getStore();
    let records = Object.values(store.records);
    if (taskId) {
      records = records.filter((r) => r.taskId === taskId);
    }
    return records.sort((a, b) => b.createdAt - a.createdAt);
  },

  async deleteExport(exportId: string): Promise<boolean> {
    const store = await getStore();
    const record = store.records[exportId];
    if (!record) return false;
    try {
      await fs.unlink(record.filePath);
    } catch {
      // ignore
    }
    delete store.records[exportId];
    await saveStore(store);
    return true;
  },
};

export default ExportService;
