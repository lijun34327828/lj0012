import { useCallback, useEffect, useRef, useState } from 'react';
import { Upload, ClipboardPaste, ImagePlus, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface DropZoneProps {
  onFilesAdded: (files: File[]) => void;
  multiple?: boolean;
  accept?: string;
  maxSize?: number;
  disabled?: boolean;
  className?: string;
}

const ACCEPTED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/bmp',
  'image/tiff',
  'application/pdf',
];

const ACCEPTED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.tif', '.tiff', '.pdf'];

export function DropZone({
  onFilesAdded,
  multiple = true,
  accept,
  maxSize = 100 * 1024 * 1024,
  disabled = false,
  className,
}: DropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragCounter, setDragCounter] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const acceptedTypes = accept || ACCEPTED_TYPES.join(',');

  const filterFiles = useCallback(
    (files: FileList | File[]): File[] => {
      const fileArray = Array.from(files);
      return fileArray.filter((file) => {
        const typeMatch =
          ACCEPTED_TYPES.includes(file.type) ||
          ACCEPTED_EXTENSIONS.some((ext) => file.name.toLowerCase().endsWith(ext));
        const sizeMatch = file.size <= maxSize;
        return typeMatch && sizeMatch;
      });
    },
    [maxSize]
  );

  const handleFiles = useCallback(
    (files: FileList | File[]) => {
      const filtered = filterFiles(files);
      if (filtered.length > 0) {
        onFilesAdded(multiple ? filtered : filtered.slice(0, 1));
      }
    },
    [filterFiles, multiple, onFilesAdded]
  );

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter((prev) => prev + 1);
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter((prev) => {
      const next = prev - 1;
      if (next <= 0) {
        setIsDragging(false);
        return 0;
      }
      return next;
    });
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      setDragCounter(0);

      if (disabled) return;

      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [disabled, handleFiles]
  );

  const handleClick = useCallback(() => {
    if (disabled) return;
    inputRef.current?.click();
  }, [disabled]);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        handleFiles(e.target.files);
        e.target.value = '';
      }
    },
    [handleFiles]
  );

  const handlePaste = useCallback(
    (e: ClipboardEvent) => {
      if (disabled) return;
      if (!containerRef.current?.contains(document.activeElement)) return;

      const items = e.clipboardData?.items;
      if (!items) return;

      const files: File[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === 'file') {
          const file = item.getAsFile();
          if (file) files.push(file);
        }
      }

      if (files.length > 0) {
        e.preventDefault();
        handleFiles(files);
      }
    },
    [disabled, handleFiles]
  );

  useEffect(() => {
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [handlePaste]);

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onClick={handleClick}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className={cn(
        'relative flex flex-col items-center justify-center min-h-[280px] p-8 rounded-2xl transition-all duration-300 cursor-pointer outline-none',
        isDragging
          ? 'border-2 border-solid border-brand-500 bg-brand-50 shadow-lg scale-[1.01]'
          : 'border-2 border-dashed border-brand-300 bg-brand-50/50 hover:border-brand-500 hover:bg-brand-50',
        disabled && 'opacity-50 cursor-not-allowed pointer-events-none',
        'focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2',
        className
      )}
    >
      <input
        ref={inputRef}
        type="file"
        multiple={multiple}
        accept={acceptedTypes}
        onChange={handleInputChange}
        className="hidden"
        disabled={disabled}
      />

      <div
        className={cn(
          'relative mb-6 transition-all duration-300',
          isDragging ? 'scale-110' : 'scale-100'
        )}
      >
        <div
          className={cn(
            'w-20 h-20 rounded-2xl flex items-center justify-center transition-all duration-300',
            isDragging ? 'bg-brand-500' : 'bg-brand-100'
          )}
        >
          {isDragging ? (
            <ImagePlus className="w-10 h-10 text-white animate-bounce-gentle" />
          ) : (
            <Upload className="w-10 h-10 text-brand-500" />
          )}
        </div>

        <div className="absolute -top-1 -right-1 w-8 h-8 rounded-full bg-success-500 flex items-center justify-center shadow-md animate-fade-in">
          <ClipboardPaste className="w-4 h-4 text-white" />
        </div>
      </div>

      <div className="text-center space-y-2">
        <h3 className="text-lg font-semibold text-slate-800">
          {isDragging ? '释放以上传文件' : '拖拽文件到此处上传'}
        </h3>
        <p className="text-sm text-slate-500">
          或 <span className="text-brand-600 font-medium">点击选择文件</span>，也可按 Ctrl+V 粘贴
        </p>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/80 border border-slate-200 text-xs text-slate-600">
          <ImagePlus className="w-3.5 h-3.5 text-brand-500" />
          <span>图片: JPG PNG WebP GIF</span>
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/80 border border-slate-200 text-xs text-slate-600">
          <FileText className="w-3.5 h-3.5 text-info-500" />
          <span>文档: PDF</span>
        </div>
      </div>

      <p className="mt-4 text-xs text-slate-400">
        单个文件最大 {Math.round(maxSize / (1024 * 1024))}MB，支持批量上传
      </p>
    </div>
  );
}

export default DropZone;
