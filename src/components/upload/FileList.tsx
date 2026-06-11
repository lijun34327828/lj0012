import { useMemo } from 'react';
import {
  Image as ImageIcon,
  FileText,
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  X,
  Trash2,
  RotateCw,
} from 'lucide-react';
import type { UploadFile } from '@shared/types';
import { Tag } from '@/components/ui/Tag';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { formatFileSize } from '@/utils/file';

export type PendingFileStatus = 'pending' | 'uploading' | 'success' | 'failed' | 'invalid';

export interface PendingFileItem {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
  status: PendingFileStatus;
  progress?: number;
  error?: string;
  thumbnailUrl?: string;
}

export interface FileListProps {
  pendingFiles: PendingFileItem[];
  uploadedFiles?: UploadFile[];
  onRemovePending?: (id: string) => void;
  onRetryPending?: (id: string) => void;
  onRemoveUploaded?: (id: string) => void;
  onClearAllPending?: () => void;
  className?: string;
}

const ACCEPTED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/bmp',
  'image/tiff',
];

const statusConfig: Record<PendingFileStatus, { label: string; color: 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info' }> = {
  pending: { label: '等待中', color: 'default' },
  uploading: { label: '上传中', color: 'primary' },
  success: { label: '已完成', color: 'success' },
  failed: { label: '失败', color: 'danger' },
  invalid: { label: '不支持', color: 'warning' },
};

const getFileTypeLabel = (type: string): { label: string; variant: 'primary' | 'info' | 'default' } => {
  if (type.startsWith('image/')) {
    const ext = type.split('/')[1]?.toUpperCase() || 'IMAGE';
    return { label: ext, variant: 'primary' };
  }
  if (type === 'application/pdf') {
    return { label: 'PDF', variant: 'info' };
  }
  return { label: type.split('/')[1]?.toUpperCase() || 'FILE', variant: 'default' };
};

const isFileTypeSupported = (type: string): boolean => {
  if (ACCEPTED_IMAGE_TYPES.includes(type)) return true;
  if (type === 'application/pdf') return true;
  return false;
};

const FileIcon = ({ type, isImage, src }: { type: string; isImage: boolean; src?: string }) => {
  if (isImage && src) {
    return (
      <img
        src={src}
        alt=""
        className="w-full h-full object-cover rounded-lg"
        loading="lazy"
      />
    );
  }
  if (type === 'application/pdf') {
    return (
      <div className="w-full h-full flex items-center justify-center bg-info-50 rounded-lg">
        <FileText className="w-8 h-8 text-info-500" />
      </div>
    );
  }
  return (
    <div className="w-full h-full flex items-center justify-center bg-brand-50 rounded-lg">
      <ImageIcon className="w-8 h-8 text-brand-500" />
    </div>
  );
};

const StatusIcon = ({ status }: { status: PendingFileStatus }) => {
  switch (status) {
    case 'pending':
      return <Clock className="w-4 h-4 text-slate-400" />;
    case 'uploading':
      return <Loader2 className="w-4 h-4 text-brand-500 animate-spin-slow" />;
    case 'success':
      return <CheckCircle2 className="w-4 h-4 text-success-500" />;
    case 'failed':
      return <AlertCircle className="w-4 h-4 text-danger-500" />;
    case 'invalid':
      return <AlertCircle className="w-4 h-4 text-warning-500" />;
  }
};

export function FileList({
  pendingFiles,
  uploadedFiles = [],
  onRemovePending,
  onRetryPending,
  onRemoveUploaded,
  onClearAllPending,
  className,
}: FileListProps) {
  const filesWithStatus = useMemo<PendingFileItem[]>(() => {
    return pendingFiles.map((pf) => ({
      ...pf,
      status: pf.status === undefined ? (isFileTypeSupported(pf.type) ? 'pending' : 'invalid') : pf.status,
    }));
  }, [pendingFiles]);

  const hasPending = filesWithStatus.length > 0;
  const hasUploaded = uploadedFiles.length > 0;

  if (!hasPending && !hasUploaded) return null;

  const pendingCount = filesWithStatus.filter((f) => f.status === 'pending' || f.status === 'uploading').length;
  const canClearAll = onClearAllPending && filesWithStatus.length > 0;

  return (
    <div className={cn('space-y-4', className)}>
      {(hasPending || canClearAll) && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-700">待上传文件</h3>
            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-slate-100 text-slate-600">
              {filesWithStatus.length} 个
            </span>
            {pendingCount > 0 && (
              <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-brand-50 text-brand-600">
                {pendingCount} 待上传
              </span>
            )}
          </div>
          {canClearAll && (
            <Button
              variant="ghost"
              size="sm"
              icon={<Trash2 className="w-4 h-4" />}
              onClick={onClearAllPending}
            >
              清空全部
            </Button>
          )}
        </div>
      )}

      {hasPending && (
        <div className="space-y-2">
          {filesWithStatus.map((file) => {
            const isImage = file.type.startsWith('image/');
            const fileTypeInfo = getFileTypeLabel(file.type);
            const progress = file.progress ?? 0;
            const isInvalid = file.status === 'invalid';
            const isFailed = file.status === 'failed';
            const isUploading = file.status === 'uploading';

            return (
              <div
                key={file.id}
                className={cn(
                  'group flex items-center gap-4 p-3 rounded-xl border transition-all duration-200',
                  isInvalid
                    ? 'bg-red-50/50 border-red-200'
                    : isFailed
                    ? 'bg-red-50/50 border-red-100 hover:border-red-200'
                    : 'bg-white border-slate-200 hover:border-brand-200 hover:shadow-sm'
                )}
              >
                <div className="w-14 h-14 shrink-0 overflow-hidden rounded-lg bg-slate-50">
                  <FileIcon type={file.type} isImage={isImage} src={file.thumbnailUrl} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p
                          className={cn(
                            'text-sm font-medium truncate min-w-0',
                            isInvalid ? 'text-red-700' : 'text-slate-800'
                          )}
                          title={file.name}
                        >
                          {file.name}
                        </p>
                        <Tag variant={fileTypeInfo.variant} size="sm">
                          {fileTypeInfo.label}
                        </Tag>
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-slate-500">{formatFileSize(file.size)}</span>
                        <div className="flex items-center gap-1">
                          <StatusIcon status={file.status} />
                          <span
                            className={cn(
                              'text-xs',
                              isInvalid && 'text-red-600',
                              isFailed && 'text-danger-600',
                              file.status === 'success' && 'text-success-600',
                              file.status === 'uploading' && 'text-brand-600',
                              file.status === 'pending' && 'text-slate-500'
                            )}
                          >
                            {statusConfig[file.status].label}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {isFailed && onRetryPending && (
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<RotateCw className="w-4 h-4" />}
                          onClick={() => onRetryPending(file.id)}
                          className="text-danger-600 hover:text-danger-700 hover:bg-danger-50"
                        />
                      )}
                      {onRemovePending && (
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<X className="w-4 h-4" />}
                          onClick={() => onRemovePending(file.id)}
                          className="text-slate-400 hover:text-danger-600 hover:bg-danger-50"
                        />
                      )}
                    </div>
                  </div>

                  {(isUploading || isFailed) && (
                    <div className="mt-2">
                      {isUploading && (
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-brand-400 to-brand-600 rounded-full transition-all duration-300 animate-progress-striped"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      )}
                      {isFailed && file.error && (
                        <p className="text-xs text-danger-600 mt-1">{file.error}</p>
                      )}
                      {isInvalid && (
                        <p className="text-xs text-red-600 mt-1">文件类型不支持，请上传图片或 PDF 文件</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {hasUploaded && (
        <>
          <div className="flex items-center gap-2 pt-2">
            <h3 className="text-sm font-semibold text-slate-700">已上传文件</h3>
            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-success-50 text-success-600">
              {uploadedFiles.length} 个
            </span>
          </div>

          <div className="space-y-2">
            {uploadedFiles.map((file) => {
              const isImage = file.mimeType.startsWith('image/');
              const fileTypeInfo = getFileTypeLabel(file.mimeType);

              return (
                <div
                  key={file.id}
                  className="group flex items-center gap-4 p-3 rounded-xl border border-success-100 bg-success-50/30 hover:border-success-200 hover:shadow-sm transition-all duration-200"
                >
                  <div className="w-14 h-14 shrink-0 overflow-hidden rounded-lg bg-slate-50">
                    <FileIcon type={file.mimeType} isImage={isImage} src={isImage ? file.url : undefined} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p
                            className="text-sm font-medium truncate min-w-0 text-slate-800"
                            title={file.originalName}
                          >
                            {file.originalName}
                          </p>
                          <Tag variant={fileTypeInfo.variant} size="sm">
                            {fileTypeInfo.label}
                          </Tag>
                          <Tag variant="success" size="sm">
                            <CheckCircle2 className="w-3 h-3" />
                            已上传
                          </Tag>
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-xs text-slate-500">{formatFileSize(file.size)}</span>
                          {file.width && file.height && (
                            <span className="text-xs text-slate-500">
                              {file.width} × {file.height}
                            </span>
                          )}
                        </div>
                      </div>

                      {onRemoveUploaded && (
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<Trash2 className="w-4 h-4" />}
                          onClick={() => onRemoveUploaded(file.id)}
                          className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-danger-600 hover:bg-danger-50 transition-opacity"
                        />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

export default FileList;
