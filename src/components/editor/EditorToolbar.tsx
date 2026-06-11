import { useCallback, useMemo } from 'react';
import {
  ArrowLeft,
  Move,
  Crop,
  RotateCw,
  SlidersHorizontal,
  RotateCcw,
  Undo2,
  Redo2,
  Zap,
  Eye,
  FileImage,
  HardDrive,
  Clock3,
} from 'lucide-react';
import type { EnhanceSettings } from './Canvas';
import { Button } from '@/components/ui/Button';
import { Tag } from '@/components/ui/Tag';
import { cn } from '@/lib/utils';
import { formatFileSize } from '@/utils/file';

export type EditorTool = 'move' | 'crop' | 'rotate' | 'enhance';

export interface EditorToolbarProps {
  fileName?: string;
  imageWidth?: number;
  imageHeight?: number;
  fileSize?: number;
  activeTool: EditorTool;
  onToolChange: (tool: EditorTool) => void;
  onBack?: () => void;
  onResetAll?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onSubmitPreprocess?: () => void;
  onSubmitOCR?: () => void;
  isProcessing?: boolean;
  rotation?: number;
  flippedH?: boolean;
  flippedV?: boolean;
  hasCrop?: boolean;
  enhanceSettings?: EnhanceSettings;
  className?: string;
}

const TOOL_CONFIG: { key: EditorTool; icon: typeof Move; label: string }[] = [
  { key: 'move', icon: Move, label: '移动' },
  { key: 'crop', icon: Crop, label: '裁剪' },
  { key: 'rotate', icon: RotateCw, label: '旋转' },
  { key: 'enhance', icon: SlidersHorizontal, label: '增强' },
];

export function EditorToolbar({
  fileName,
  imageWidth,
  imageHeight,
  fileSize,
  activeTool,
  onToolChange,
  onBack,
  onResetAll,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
  onSubmitPreprocess,
  onSubmitOCR,
  isProcessing = false,
  rotation = 0,
  flippedH = false,
  flippedV = false,
  hasCrop = false,
  enhanceSettings,
  className,
}: EditorToolbarProps) {
  const hasChanges = useMemo(() => {
    if (rotation !== 0) return true;
    if (flippedH || flippedV) return true;
    if (hasCrop) return true;
    if (enhanceSettings) {
      if (
        enhanceSettings.brightness !== 0 ||
        enhanceSettings.contrast !== 0 ||
        enhanceSettings.sharpness !== 0 ||
        enhanceSettings.denoise ||
        enhanceSettings.binarize
      ) {
        return true;
      }
    }
    return false;
  }, [rotation, flippedH, flippedV, hasCrop, enhanceSettings]);

  const handleReset = useCallback(() => {
    onResetAll?.();
  }, [onResetAll]);

  return (
    <div
      className={cn(
        'flex flex-col gap-3 p-4 bg-white border-b border-slate-200',
        className
      )}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {onBack && (
            <Button
              variant="ghost"
              size="sm"
              icon={<ArrowLeft className="w-5 h-5" />}
              onClick={onBack}
              className="shrink-0"
            />
          )}

          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-100 to-brand-50 border border-brand-200 flex items-center justify-center shrink-0">
              <FileImage className="w-5 h-5 text-brand-500" />
            </div>

            <div className="min-w-0 flex-1">
              <h2
                className="text-base font-semibold text-slate-800 truncate"
                title={fileName}
              >
                {fileName || '未命名图片'}
              </h2>
              <div className="flex items-center gap-2 flex-wrap mt-0.5">
                {imageWidth && imageHeight && (
                  <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                    <Eye className="w-3.5 h-3.5" />
                    <span className="font-mono">{imageWidth} × {imageHeight}</span>
                  </span>
                )}
                {fileSize && (
                  <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                    <HardDrive className="w-3.5 h-3.5" />
                    <span>{formatFileSize(fileSize)}</span>
                  </span>
                )}
                {rotation !== 0 && (
                  <Tag variant="primary" size="sm">
                    <RotateCw className="w-3 h-3" />
                    {rotation > 0 ? '+' : ''}{rotation}°
                  </Tag>
                )}
                {(flippedH || flippedV) && (
                  <Tag variant="info" size="sm">
                    {flippedH && 'H翻转'}
                    {flippedH && flippedV && '+'}
                    {flippedV && 'V翻转'}
                  </Tag>
                )}
                {hasCrop && (
                  <Tag variant="warning" size="sm">
                    <Crop className="w-3 h-3" />
                    已裁剪
                  </Tag>
                )}
                {enhanceSettings && (
                  enhanceSettings.brightness !== 0 ||
                  enhanceSettings.contrast !== 0 ||
                  enhanceSettings.sharpness !== 0 ||
                  enhanceSettings.denoise ||
                  enhanceSettings.binarize
                ) && (
                  <Tag variant="success" size="sm">
                    <SlidersHorizontal className="w-3 h-3" />
                    已增强
                  </Tag>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            icon={<RotateCcw className="w-4 h-4" />}
            onClick={handleReset}
            disabled={!hasChanges || isProcessing}
            className="text-slate-500"
          >
            重置
          </Button>

          <div className="w-px h-6 bg-slate-200" />

          <Button
            variant="ghost"
            size="sm"
            icon={<Undo2 className="w-4 h-4" />}
            onClick={onUndo}
            disabled={!canUndo || isProcessing}
            title="撤销 (Ctrl+Z)"
          />
          <Button
            variant="ghost"
            size="sm"
            icon={<Redo2 className="w-4 h-4" />}
            onClick={onRedo}
            disabled={!canRedo || isProcessing}
            title="重做 (Ctrl+Y)"
          />
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 pt-1">
        <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-slate-100">
          {TOOL_CONFIG.map((tool) => {
            const Icon = tool.icon;
            const isActive = activeTool === tool.key;
            return (
              <button
                key={tool.key}
                type="button"
                onClick={() => onToolChange(tool.key)}
                className={cn(
                  'group relative inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'bg-white text-brand-600 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                )}
              >
                <Icon
                  className={cn(
                    'w-4 h-4 transition-colors',
                    isActive ? 'text-brand-500' : 'text-slate-400 group-hover:text-slate-600'
                  )}
                />
                <span>{tool.label}</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          {hasChanges && (
            <div className="hidden md:flex items-center gap-1.5 text-xs text-slate-500 pr-2">
              <Clock3 className="w-3.5 h-3.5" />
              <span>预处理将在提交后生效</span>
            </div>
          )}

          <Button
            variant="secondary"
            size="md"
            icon={<Zap className="w-4 h-4" />}
            onClick={onSubmitPreprocess}
            loading={isProcessing}
            disabled={!hasChanges || isProcessing}
          >
            提交预处理
          </Button>

          <Button
            variant="primary"
            size="md"
            icon={<Eye className="w-4 h-4" />}
            onClick={onSubmitOCR}
            loading={isProcessing}
            disabled={isProcessing}
          >
            提交识别
          </Button>
        </div>
      </div>
    </div>
  );
}

export default EditorToolbar;
