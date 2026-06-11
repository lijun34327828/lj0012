import { useEffect, useMemo, useRef } from 'react';
import {
  Play,
  Pause,
  X,
  RotateCw,
  CheckCircle2,
  AlertCircle,
  Gauge,
  Clock,
  HardDriveUpload,
} from 'lucide-react';
import type { FileCategory, UploadFile } from '@shared/types';
import { useChunkUpload, ChunkUploadStatus } from '@/hooks/useChunkUpload';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { formatFileSize } from '@/utils/file';

export interface ChunkUploaderProps {
  file: File | null | undefined;
  fileId: string;
  category: FileCategory;
  autoStart?: boolean;
  onUploadComplete?: (fileId: string, file: UploadFile) => void;
  onUploadProgress?: (fileId: string, progress: number) => void;
  onUploadError?: (fileId: string, error: string) => void;
  onUploadCancel?: (fileId: string) => void;
  className?: string;
}

const statusLabel: Record<ChunkUploadStatus, string> = {
  idle: '准备就绪',
  preparing: '初始化中',
  uploading: '上传中',
  merging: '合并分片',
  completed: '上传完成',
  paused: '已暂停',
  cancelled: '已取消',
  error: '上传失败',
};

const statusColor: Record<ChunkUploadStatus, string> = {
  idle: 'text-slate-500',
  preparing: 'text-info-500',
  uploading: 'text-brand-500',
  merging: 'text-info-500',
  completed: 'text-success-500',
  paused: 'text-warning-500',
  cancelled: 'text-slate-400',
  error: 'text-danger-500',
};

const progressColor: Record<ChunkUploadStatus, string> = {
  idle: 'bg-slate-200',
  preparing: 'bg-info-500',
  uploading: 'bg-brand-500',
  merging: 'bg-info-500',
  completed: 'bg-success-500',
  paused: 'bg-warning-500',
  cancelled: 'bg-slate-300',
  error: 'bg-danger-500',
};

export function ChunkUploader({
  file,
  fileId,
  category,
  autoStart = true,
  onUploadComplete,
  onUploadProgress,
  onUploadError,
  onUploadCancel,
  className,
}: ChunkUploaderProps) {
  const startTimeRef = useRef<number>(Date.now());
  const lastProgressRef = useRef<{ progress: number; time: number }>({ progress: 0, time: Date.now() });
  const speedRef = useRef<number>(0);

  const chunkUpload = useChunkUpload(file, category, {
    autoStart,
    onProgress: (p) => {
      onUploadProgress?.(fileId, p.percent);
    },
    onComplete: (uploadedFile) => {
      onUploadComplete?.(fileId, uploadedFile);
    },
    onError: (err) => {
      onUploadError?.(fileId, err.message);
    },
  });

  const { progress, status, error, uploadedBytes, totalBytes, result, start, pause, resume, cancel, retry } = chunkUpload;

  useEffect(() => {
    if (status === 'uploading' && progress > lastProgressRef.current.progress) {
      const now = Date.now();
      const elapsed = (now - lastProgressRef.current.time) / 1000;
      const bytesDiff = (progress - lastProgressRef.current.progress) / 100 * totalBytes;

      if (elapsed > 0 && bytesDiff > 0) {
        speedRef.current = bytesDiff / elapsed;
      }

      lastProgressRef.current = { progress, time: now };
    }
  }, [progress, status, totalBytes]);

  useEffect(() => {
    if (status === 'uploading' || status === 'preparing') {
      startTimeRef.current = Date.now();
      lastProgressRef.current = { progress: 0, time: Date.now() };
      speedRef.current = 0;
    }
  }, [status]);

  const speedText = useMemo(() => {
    if (status !== 'uploading') return '--';
    const speed = speedRef.current;
    if (speed <= 0) return '--';
    return `${formatFileSize(speed)}/s`;
  }, [status]);

  const etaText = useMemo(() => {
    if (status !== 'uploading') return '--';
    const speed = speedRef.current;
    const remaining = totalBytes - uploadedBytes;
    if (speed <= 0 || remaining <= 0) return '--';

    const seconds = Math.ceil(remaining / speed);
    if (seconds < 60) return `约 ${seconds} 秒`;

    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (minutes < 60) {
      return secs > 0 ? `约 ${minutes} 分 ${secs} 秒` : `约 ${minutes} 分钟`;
    }

    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `约 ${hours} 时 ${mins} 分` : `约 ${hours} 小时`;
  }, [status, totalBytes, uploadedBytes]);

  const isActive = status === 'uploading' || status === 'preparing' || status === 'merging';
  const canStart = status === 'idle' || status === 'paused';
  const isFinished = status === 'completed' || status === 'cancelled' || status === 'error';

  const handleAction = () => {
    if (status === 'paused') {
      resume();
    } else if (canStart) {
      start();
    }
  };

  return (
    <div
      className={cn(
        'rounded-xl border p-4 bg-white transition-all duration-200',
        isActive ? 'border-brand-200 shadow-sm' : 'border-slate-200',
        className
      )}
    >
      <div className="flex items-center gap-4">
        <div
          className={cn(
            'w-12 h-12 rounded-xl flex items-center justify-center shrink-0',
            isActive ? 'bg-brand-50' : status === 'completed' ? 'bg-success-50' : status === 'error' ? 'bg-danger-50' : 'bg-slate-50'
          )}
        >
          {status === 'completed' ? (
            <CheckCircle2 className="w-6 h-6 text-success-500" />
          ) : status === 'error' ? (
            <AlertCircle className="w-6 h-6 text-danger-500" />
          ) : (
            <HardDriveUpload
              className={cn(
                'w-6 h-6',
                isActive ? 'text-brand-500 animate-bounce-gentle' : 'text-slate-400'
              )}
            />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm font-medium text-slate-800 truncate" title={file?.name}>
                {file?.name || '未选择文件'}
              </span>
              <span className={cn('text-xs font-medium shrink-0', statusColor[status])}>
                {statusLabel[status]}
              </span>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {!isFinished && (
                <>
                  {(status === 'uploading' || status === 'preparing') && (
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<Pause className="w-4 h-4" />}
                      onClick={pause}
                      title="暂停"
                    />
                  )}
                  {canStart && (
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<Play className="w-4 h-4" />}
                      onClick={handleAction}
                      className="text-brand-600 hover:text-brand-700 hover:bg-brand-50"
                      title={status === 'paused' ? '继续' : '开始'}
                    />
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<X className="w-4 h-4" />}
                    onClick={() => {
                      cancel();
                      onUploadCancel?.(fileId);
                    }}
                    className="text-slate-400 hover:text-danger-600 hover:bg-danger-50"
                    title="取消"
                  />
                </>
              )}
              {(status === 'error') && (
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<RotateCw className="w-4 h-4" />}
                  onClick={retry}
                  className="text-warning-600 hover:text-warning-700 hover:bg-warning-50"
                  title="重试"
                />
              )}
            </div>
          </div>

          <div className="mt-2">
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-300',
                  progressColor[status],
                  isActive && 'animate-progress-striped'
                )}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
            <div className="flex items-center gap-1">
              <span>进度:</span>
              <span className="font-mono font-medium text-slate-700">
                {formatFileSize(uploadedBytes)} / {formatFileSize(totalBytes)}
              </span>
              <span className="font-mono text-brand-600 font-medium">({progress}%)</span>
            </div>

            {isActive && (
              <>
                <div className="flex items-center gap-1">
                  <Gauge className="w-3.5 h-3.5 text-brand-500" />
                  <span>速度:</span>
                  <span className="font-mono font-medium text-slate-700">{speedText}</span>
                </div>

                <div className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-info-500" />
                  <span>剩余:</span>
                  <span className="font-mono font-medium text-slate-700">{etaText}</span>
                </div>
              </>
            )}

            {result && (
              <div className="flex items-center gap-1 text-success-600">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>ID: {result.id.slice(0, 12)}...</span>
              </div>
            )}
          </div>

          {error && (
            <div className="mt-2 text-xs text-danger-600 bg-danger-50 px-3 py-1.5 rounded-lg">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ChunkUploader;
