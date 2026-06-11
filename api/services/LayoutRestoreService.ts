import type { TextBlock, ParagraphBlock, LayoutResult, TextType } from '@shared/types.js';
import { generateParagraphId } from '@api/utils/idGenerator.js';

const groupBlocksByLines = (blocks: TextBlock[]): TextBlock[][] => {
  const lineMap = new Map<number, TextBlock[]>();
  for (const block of blocks) {
    const key = block.lineIndex ?? 0;
    if (!lineMap.has(key)) {
      lineMap.set(key, []);
    }
    lineMap.get(key)!.push(block);
  }
  return Array.from(lineMap.values()).sort(
    (a, b) => (a[0].lineIndex ?? 0) - (b[0].lineIndex ?? 0)
  );
};

const detectParagraphType = (blocks: TextBlock[]): 'paragraph' | 'heading' | 'table' | 'list' => {
  if (blocks.length === 0) return 'paragraph';
  const content = blocks.map((b) => b.content).join(' ');
  if (content.includes('|') && content.match(/\s{2,}/)) {
    return 'table';
  }
  if (/^[一二三四五六七八九十\d]+[、.．]/.test(content.trim()) || /^[（(]\d+[）)]/.test(content.trim())) {
    return 'list';
  }
  const avgConfidence = blocks.reduce((s, b) => s + b.confidence, 0) / blocks.length;
  const isPrinted = blocks.filter((b) => b.type === 'printed').length / blocks.length > 0.7;
  if (isPrinted && avgConfidence > 0.95 && content.length < 30) {
    return 'heading';
  }
  return 'paragraph';
};

const computeStatistics = (blocks: TextBlock[]) => {
  let totalChars = 0;
  let handwrittenChars = 0;
  let printedChars = 0;
  let totalConfidence = 0;

  for (const block of blocks) {
    const len = block.content.length;
    totalChars += len;
    totalConfidence += block.confidence * len;
    if (block.type === 'handwritten') {
      handwrittenChars += len;
    } else {
      printedChars += len;
    }
  }

  const avgConfidence = totalChars > 0 ? totalConfidence / totalChars : 0;
  const pages = blocks.length > 0 ? Math.max(...blocks.map((b) => b.pageIndex ?? 0)) + 1 : 1;

  return {
    pages,
    totalChars,
    handwrittenChars,
    printedChars,
    avgConfidence,
  };
};

const extractTableData = (blocks: TextBlock[]): string[][] | undefined => {
  const content = blocks.map((b) => b.content).join(' ');
  if (!content.includes('|')) return undefined;
  try {
    const rows = content
      .split(/\n+|\|{2,}/)
      .map((row) => row.split('|').map((cell) => cell.trim()))
      .filter((row) => row.length > 1);
    if (rows.length >= 2) return rows;
  } catch {
    // ignore
  }
  return undefined;
};

export const LayoutRestoreService = {
  restore(textBlocks: TextBlock[]): LayoutResult {
    const lines = groupBlocksByLines(textBlocks);
    const paragraphBlocks: ParagraphBlock[] = [];
    let currentLineBuffer: TextBlock[] = [];

    const flushParagraph = (): void => {
      if (currentLineBuffer.length === 0) return;
      const type = detectParagraphType(currentLineBuffer);
      const allText = currentLineBuffer;
      const tableData = type === 'table' ? extractTableData(allText) : undefined;

      paragraphBlocks.push({
        id: generateParagraphId(),
        type,
        texts: allText,
        tableData,
      });
      currentLineBuffer = [];
    };

    for (const line of lines) {
      const firstBlock = line[0];
      if (!firstBlock) continue;

      const content = firstBlock.content.trim();
      const isStartNew =
        content.length === 0 ||
        /^[一二三四五六七八九十\d]+[、.．]/.test(content) ||
        /^[（(]\d+[）)]/.test(content) ||
        (firstBlock.type === 'printed' && firstBlock.confidence > 0.95 && content.length < 30);

      if (isStartNew && currentLineBuffer.length > 0) {
        flushParagraph();
      }

      if (content.length === 0) continue;
      currentLineBuffer.push(...line);
    }

    flushParagraph();

    const stats = computeStatistics(textBlocks);

    return {
      pages: stats.pages,
      blocks: paragraphBlocks,
      statistics: {
        totalChars: stats.totalChars,
        handwrittenChars: stats.handwrittenChars,
        printedChars: stats.printedChars,
        avgConfidence: stats.avgConfidence,
      },
    };
  },
};

export default LayoutRestoreService;
