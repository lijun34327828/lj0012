import { useState, useMemo } from 'react';
import {
  FileText,
  FileImage,
  FileCode,
  FileJson,
  File,
  Download,
  Loader2,
  X,
  Check,
  Lock,
  Droplets,
  Maximize2,
  LayoutGrid,
  Type,
  AlignJustify,
  Image as ImageIcon,
} from 'lucide-react';
import type { ExportFormat, OCRTask } from '@shared/types';
import { useResultStore } from '@/stores/resultStore';
import { useTaskStore } from '@/stores/taskStore';
import { generateExport, downloadExport } from '@/utils/api';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Tag } from '@/components/ui/Tag';
import { toast } from '@/utils/toast';
import { cn } from '@/lib/utils';

interface FormatOption {
  key: ExportFormat;
  name: string;
  extension: string;
  icon: typeof FileText;
  description: string;
  color: string;
}

const FORMATS: FormatOption[] = [
  {
    key: 'docx',
    name: 'Word',
    extension: '.docx',
    icon: FileText,
    description: '可编辑的 Word 文档，保留完整排版结构',
    color: 'bg-blue-50 text-blue-600 border-blue-200',
  },
  {
    key: 'pdf',
    name: 'PDF',
    extension: '.pdf',
    icon: FileImage,
    description: '通用 PDF 格式，适合查看和打印分享',
    color: 'bg-red-50 text-red-600 border-red-200',
  },
  {
    key: 'markdown',
    name: 'Markdown',
    extension: '.md',
    icon: FileCode,
    description: '轻量级 Markdown 格式，适合开发者使用',
    color: 'bg-violet-50 text-violet-600 border-violet-200',
  },
  {
    key: 'txt',
    name: '纯文本',
    extension: '.txt',
    icon: File,
    description: '最简洁的纯文本格式，无任何样式',
    color: 'bg-slate-50 text-slate-600 border-slate-200',
  },
  {
    key: 'json',
    name: 'JSON',
    extension: '.json',
    icon: FileJson,
    description: '结构化 JSON 数据，包含完整识别信息',
    color: 'bg-amber-50 text-amber-600 border-amber-200',
  },
];

const PAPER_SIZES = [
  { key: 'A4', label: 'A4 (210 × 297 mm)' },
  { key: 'A3', label: 'A3 (297 × 420 mm)' },
  { key: 'Letter', label: 'Letter (8.5 × 11 英寸)' },
  { key: 'Legal', label: 'Legal (8.5 × 14 英寸)' },
];

const FONT_OPTIONS = [
  { key: 'songti', label: '宋体' },
  { key: 'heiti', label: '黑体' },
  { key: 'kaiti', label: '楷体' },
  { key: 'fangsong', label: '仿宋' },
  { key: 'microsoft-yahei', label: '微软雅黑' },
];

const MARGIN_OPTIONS = [
  { key: 'narrow', label: '窄 (1.27cm)' },
  { key: 'normal', label: '普通 (2.54cm)' },
  { key: 'wide', label: '宽 (5.08cm)' },
];

interface ExportModalProps {
  open: boolean;
  onClose: () => void;
  taskId?: string;
}

type ExportStatus = 'idle' | 'generating' | 'ready';

export function ExportModal({ open, onClose, taskId }: ExportModalProps) {
  const { currentTask, collectEdits } = useResultStore();
  const { tasks } = useTaskStore();
  const [format, setFormat] = useState<ExportFormat>('docx');
  const [status, setStatus] = useState<ExportStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [exportId, setExportId] = useState<string | null>(null);

  const [includeImages, setIncludeImages] = useState(true);
  const [preserveLayout, setPreserveLayout] = useState(true);
  const [filename, setFilename] = useState(() => {
    const d = new Date();
    const stamp = `${d.getFullYear()}${(d.getMonth() + 1).toString().padStart(2, '0')}${d.getDate().toString().padStart(2, '0')}`;
    return `ocr-result-${stamp}`;
  });

  const [pdfPassword, setPdfPassword] = useState('');
  const [pdfWatermark, setPdfWatermark] = useState('');
  const [pdfPaperSize, setPdfPaperSize] = useState('A4');

  const [wordMargin, setWordMargin] = useState('normal');
  const [wordFont, setWordFont] = useState('songti');
  const [wordHeader, setWordHeader] = useState('');
  const [wordFooter, setWordFooter] = useState('第 {page} 页');

  const activeTask = useMemo<OCRTask | null>(() => {
    if (taskId) {
      const byId = tasks.find((t) => t.id === taskId);
      if (byId) return byId;
    }
    if (currentTask) return currentTask;
    return tasks.find((t) => t.status === 'completed') || null;
  }, [taskId, currentTask, tasks]);

  const currentFormat = FORMATS.find((f) => f.key === format)!;
  const FormatIcon = currentFormat.icon;

  const handleGenerate = async () => {
    if (!activeTask) {
      toast.error('没有可导出的任务');
      return;
    }
    setStatus('generating');
    setProgress(0);

    try {
      const options: any = {
        includeImages,
        preserveLayout,
        filename: filename || undefined,
      };

      if (format === 'pdf') {
        options.watermark = pdfWatermark || undefined;
        options.password = pdfPassword || undefined;
        options.paperSize = pdfPaperSize;
      }

      if (format === 'docx') {
        options.margin = wordMargin;
        options.font = wordFont;
        options.header = wordHeader || undefined;
        options.footer = wordFooter || undefined;
      }

      const progressInterval = setInterval(() => {
        setProgress((p) => Math.min(p + Math.random() * 12, 90));
      }, 200);

      const result = await generateExport({
        taskId: activeTask.id,
        format,
        options,
      });

      clearInterval(progressInterval);
      setProgress(100);
      setExportId(result.exportId);
      setTimeout(() => setStatus('ready'), 400);
    } catch (e: any) {
      toast.error(e.message || '生成失败');
      setStatus('idle');
      setProgress(0);
    }
  };

  const handleDownload = async () => {
    if (!exportId) return;
    try {
      const blob = await downloadExport(exportId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filename}${currentFormat.extension}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('下载已开始');
    } catch (e: any) {
      toast.error(e.message || '下载失败');
    }
  };

  const handleClose = () => {
    if (status === 'generating') {
      toast.info('请等待生成完成');
      return;
    }
    setStatus('idle');
    setProgress(0);
    setExportId(null);
    onClose();
  };

  const FooterContent = (
    <>
      <Button variant="secondary" onClick={handleClose} disabled={status === 'generating'}>
        取消
      </Button>
      {status === 'ready' ? (
        <Button variant="success" icon={<Download size={16} />} onClick={handleDownload}>
          下载文件
        </Button>
      ) : (
        <Button
          variant="primary"
          icon={status === 'generating' ? <Loader2 className="animate-spin-slow" size={16} /> : undefined}
          onClick={handleGenerate}
          loading={status === 'generating'}
          disabled={!activeTask || status === 'generating'}
        >
          {status === 'generating' ? '生成中...' : '生成文件'}
        </Button>
      )}
    </>
  );

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={
        <div className="flex items-center gap-2">
          <Download size={20} className="text-brand-500" />
          <span>导出结果</span>
        </div>
      }
      footer={FooterContent}
      width={800}
      maskClosable={status !== 'generating'}
    >
      <div className="flex gap-6 h-[520px]">
        <div className="w-56 flex-shrink-0 space-y-2">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-1 mb-2">
            选择格式
          </div>
          {FORMATS.map((f) => {
            const Icon = f.icon;
            const active = f.key === format;
            return (
              <button
                key={f.key}
                onClick={() => {
                  if (status === 'generating') return;
                  setFormat(f.key);
                  setStatus('idle');
                  setProgress(0);
                  setExportId(null);
                }}
                disabled={status === 'generating'}
                className={cn(
                  'w-full text-left p-3 rounded-xl border transition-all duration-200 group',
                  active
                    ? 'border-brand-300 bg-brand-50/60 ring-2 ring-brand-200/50'
                    : 'border-slate-100 bg-white hover:border-slate-200 hover:bg-slate-50'
                )}
              >
                <div className="flex items-start gap-2.5">
                  <div
                    className={cn(
                      'p-1.5 rounded-lg border flex-shrink-0 transition-colors',
                      f.color
                    )}
                  >
                    <Icon size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span
                        className={cn(
                          'font-semibold text-sm',
                          active ? 'text-brand-700' : 'text-slate-700'
                        )}
                      >
                        {f.name}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {f.extension}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed line-clamp-2">
                      {f.description}
                    </p>
                  </div>
                  {active && (
                    <div className="flex-shrink-0 mt-0.5">
                      <Check size={14} className="text-brand-500" />
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex-1 border-l border-slate-100 pl-6 flex flex-col min-w-0">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <FormatIcon size={16} className={currentFormat.color.split(' ')[1]} />
                {currentFormat.name} 导出设置
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                任务: {activeTask?.name || '未选择任务'}
              </p>
            </div>
            <Tag size="sm" variant="primary">
              {currentFormat.extension}
            </Tag>
          </div>

          <div className="flex-1 overflow-y-auto pr-2 space-y-5">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                文件名称
              </label>
              <div className="flex items-center">
                <input
                  type="text"
                  value={filename}
                  onChange={(e) => setFilename(e.target.value)}
                  disabled={status === 'generating'}
                  className="flex-1 px-3 py-2 text-sm rounded-lg border border-slate-200 focus:border-brand-400 focus:ring-2 focus:ring-brand-100 outline-none transition-all disabled:bg-slate-50 disabled:text-slate-400"
                  placeholder="请输入文件名"
                />
                <span className="ml-2 text-sm text-slate-400 font-mono">
                  {currentFormat.extension}
                </span>
              </div>
            </div>

            <div className="space-y-2.5">
              <label className="block text-xs font-semibold text-slate-600">
                通用选项
              </label>
              <div className="space-y-2">
                <label className="flex items-center gap-2.5 p-2.5 rounded-lg bg-slate-50 border border-slate-100 cursor-pointer hover:bg-slate-100 transition-colors">
                  <input
                    type="checkbox"
                    checked={includeImages}
                    onChange={(e) => setIncludeImages(e.target.checked)}
                    disabled={status === 'generating'}
                    className="w-4 h-4 rounded text-brand-500 border-slate-300 focus:ring-brand-500"
                  />
                  <ImageIcon size={15} className="text-slate-500" />
                  <span className="text-sm text-slate-700">包含图片</span>
                  <span className="text-xs text-slate-400 ml-auto">在文档中嵌入原图</span>
                </label>
                <label className="flex items-center gap-2.5 p-2.5 rounded-lg bg-slate-50 border border-slate-100 cursor-pointer hover:bg-slate-100 transition-colors">
                  <input
                    type="checkbox"
                    checked={preserveLayout}
                    onChange={(e) => setPreserveLayout(e.target.checked)}
                    disabled={status === 'generating'}
                    className="w-4 h-4 rounded text-brand-500 border-slate-300 focus:ring-brand-500"
                  />
                  <LayoutGrid size={15} className="text-slate-500" />
                  <span className="text-sm text-slate-700">保留排版</span>
                  <span className="text-xs text-slate-400 ml-auto">保留识别的段落结构</span>
                </label>
              </div>
            </div>

            {format === 'pdf' && (
              <div className="space-y-2.5 border-t border-slate-100 pt-5">
                <label className="block text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                  <FileImage size={13} className="text-red-500" />
                  PDF 专用选项
                </label>
                <div className="space-y-2">
                  <div>
                    <label className="flex items-center gap-2 text-xs text-slate-600 mb-1.5">
                      <Lock size={12} className="text-slate-400" />
                      密码保护（可选）
                    </label>
                    <input
                      type="password"
                      value={pdfPassword}
                      onChange={(e) => setPdfPassword(e.target.value)}
                      disabled={status === 'generating'}
                      placeholder="留空则不设置密码"
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:border-brand-400 focus:ring-2 focus:ring-brand-100 outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="flex items-center gap-2 text-xs text-slate-600 mb-1.5">
                      <Droplets size={12} className="text-slate-400" />
                      水印文字（可选）
                    </label>
                    <input
                      type="text"
                      value={pdfWatermark}
                      onChange={(e) => setPdfWatermark(e.target.value)}
                      disabled={status === 'generating'}
                      placeholder="如：机密文件、草稿等"
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:border-brand-400 focus:ring-2 focus:ring-brand-100 outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="flex items-center gap-2 text-xs text-slate-600 mb-1.5">
                      <Maximize2 size={12} className="text-slate-400" />
                      纸张大小
                    </label>
                    <select
                      value={pdfPaperSize}
                      onChange={(e) => setPdfPaperSize(e.target.value)}
                      disabled={status === 'generating'}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:border-brand-400 focus:ring-2 focus:ring-brand-100 outline-none transition-all bg-white"
                    >
                      {PAPER_SIZES.map((p) => (
                        <option key={p.key} value={p.key}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {format === 'docx' && (
              <div className="space-y-2.5 border-t border-slate-100 pt-5">
                <label className="block text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                  <FileText size={13} className="text-blue-500" />
                  Word 专用选项
                </label>
                <div className="space-y-2">
                  <div>
                    <label className="flex items-center gap-2 text-xs text-slate-600 mb-1.5">
                      <Maximize2 size={12} className="text-slate-400" />
                      页边距
                    </label>
                    <select
                      value={wordMargin}
                      onChange={(e) => setWordMargin(e.target.value)}
                      disabled={status === 'generating'}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:border-brand-400 focus:ring-2 focus:ring-brand-100 outline-none transition-all bg-white"
                    >
                      {MARGIN_OPTIONS.map((p) => (
                        <option key={p.key} value={p.key}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="flex items-center gap-2 text-xs text-slate-600 mb-1.5">
                      <Type size={12} className="text-slate-400" />
                      正文字体
                    </label>
                    <select
                      value={wordFont}
                      onChange={(e) => setWordFont(e.target.value)}
                      disabled={status === 'generating'}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:border-brand-400 focus:ring-2 focus:ring-brand-100 outline-none transition-all bg-white"
                    >
                      {FONT_OPTIONS.map((p) => (
                        <option key={p.key} value={p.key}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="flex items-center gap-2 text-xs text-slate-600 mb-1.5">
                      <AlignJustify size={12} className="text-slate-400" />
                      页眉（可选）
                    </label>
                    <input
                      type="text"
                      value={wordHeader}
                      onChange={(e) => setWordHeader(e.target.value)}
                      disabled={status === 'generating'}
                      placeholder="如：手写识别结果"
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:border-brand-400 focus:ring-2 focus:ring-brand-100 outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="flex items-center gap-2 text-xs text-slate-600 mb-1.5">
                      <AlignJustify size={12} className="text-slate-400" />
                      页脚（可选）
                    </label>
                    <input
                      type="text"
                      value={wordFooter}
                      onChange={(e) => setWordFooter(e.target.value)}
                      disabled={status === 'generating'}
                      placeholder="支持 {page} 页码变量"
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:border-brand-400 focus:ring-2 focus:ring-brand-100 outline-none transition-all"
                    />
                  </div>
                </div>
              </div>
            )}

            {status !== 'idle' && (
              <div className="border-t border-slate-100 pt-5 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-600">
                    {status === 'generating' ? '正在生成文件...' : '文件生成成功！'}
                  </span>
                  <span className={cn('font-semibold tabular-nums', status === 'ready' ? 'text-emerald-600' : 'text-brand-600')}>
                    {Math.round(progress)}%
                  </span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-300',
                      status === 'ready'
                        ? 'bg-gradient-to-r from-emerald-400 to-emerald-500'
                        : 'bg-gradient-to-r from-brand-400 to-brand-500 animate-progress-striped'
                    )}
                    style={{ width: `${progress}%` }}
                  />
                </div>
                {status === 'ready' && (
                  <div className="flex items-center gap-2 text-xs text-emerald-600 bg-emerald-50 rounded-lg px-3 py-2 border border-emerald-200">
                    <Check size={14} />
                    文件准备就绪，点击下方按钮下载
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}

export default ExportModal;
