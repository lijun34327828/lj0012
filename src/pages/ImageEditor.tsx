import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  FileWarning,
  Info,
  Scissors,
  RotateCw,
  SlidersHorizontal,
  Move,
  FileImage,
  Eye,
  Clock,
  HardDrive,
  Zap,
  Loader2,
} from 'lucide-react';
import { EditorToolbar, EditorTool } from '@/components/editor/EditorToolbar';
import { Canvas, CanvasHandle, CropRect, EnhanceSettings } from '@/components/editor/Canvas';
import { CropTool } from '@/components/editor/CropTool';
import { RotateTool } from '@/components/editor/RotateTool';
import { EnhancePanel } from '@/components/editor/EnhancePanel';
import { Button } from '@/components/ui/Button';
import { Tag } from '@/components/ui/Tag';
import { useUploadStore } from '@/stores/uploadStore';
import { useTaskStore } from '@/stores/taskStore';
import { preprocessImage, submitOCR, getTaskStatus, getImageMeta } from '@/utils/api';
import { toast } from '@/utils/toast';
import { formatFileSize } from '@/utils/file';
import { cn } from '@/lib/utils';
import type { ImageOperation, UploadFile } from '@shared/types';

const LARGE_FILE_THRESHOLD = 20 * 1024 * 1024;

interface EditorState {
  rotation: number;
  flippedH: boolean;
  flippedV: boolean;
  cropRect: CropRect | null;
  enhance: EnhanceSettings;
}

const DEFAULT_STATE: EditorState = {
  rotation: 0,
  flippedH: false,
  flippedV: false,
  cropRect: null,
  enhance: {
    brightness: 0,
    contrast: 0,
    sharpness: 0,
    denoise: false,
    denoiseStrength: 50,
    binarize: false,
    binarizeThreshold: 128,
  },
};

export function ImageEditor() {
  const navigate = useNavigate();
  const { fileId } = useParams<{ fileId?: string }>();
  const { files, selectedCategory, addUploadedFile } = useUploadStore();
  const { addTask, startPolling } = useTaskStore();

  const canvasRef = useRef<CanvasHandle>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [currentFile, setCurrentFile] = useState<UploadFile | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [containerSize, setContainerSize] = useState({ width: 800, height: 600 });

  const [activeTool, setActiveTool] = useState<EditorTool>('move');
  const [editorState, setEditorState] = useState<EditorState>(DEFAULT_STATE);
  const [history, setHistory] = useState<EditorState[]>([DEFAULT_STATE]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const [processing, setProcessing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const targetFile = useMemo(() => {
    if (fileId) {
      return files.find((f) => f.id === fileId) || null;
    }
    return files[files.length - 1] || null;
  }, [fileId, files]);

  useEffect(() => {
    if (targetFile) {
      setCurrentFile(targetFile);
      setImageUrl(targetFile.url);
      if (targetFile.width && targetFile.height) {
        setImageSize({ width: targetFile.width, height: targetFile.height });
      } else {
        getImageMeta(targetFile.id)
          .then((meta) => setImageSize({ width: meta.width, height: meta.height }))
          .catch(() => {});
      }
    }
  }, [targetFile]);

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setContainerSize({ width: rect.width, height: rect.height });
      }
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    return () => observer.disconnect();
  }, []);

  const pushHistory = useCallback((next: EditorState) => {
    setHistory((prev) => {
      const trimmed = prev.slice(0, historyIndex + 1);
      if (trimmed[trimmed.length - 1] === next) return prev;
      return [...trimmed, next].slice(-100);
    });
    setHistoryIndex((i) => Math.min(i + 1, 99));
  }, [historyIndex]);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;
  const hasChanges = useMemo(() => {
    const s = editorState;
    if (s.rotation !== 0) return true;
    if (s.flippedH || s.flippedV) return true;
    if (s.cropRect) return true;
    const e = s.enhance;
    if (e.brightness !== 0 || e.contrast !== 0 || e.sharpness !== 0) return true;
    if (e.denoise || e.binarize) return true;
    return false;
  }, [editorState]);

  const handleUndo = useCallback(() => {
    if (historyIndex <= 0) return;
    const idx = historyIndex - 1;
    const state = history[idx];
    if (state) {
      setEditorState(state);
      setHistoryIndex(idx);
    }
  }, [history, historyIndex]);

  const handleRedo = useCallback(() => {
    if (historyIndex >= history.length - 1) return;
    const idx = historyIndex + 1;
    const state = history[idx];
    if (state) {
      setEditorState(state);
      setHistoryIndex(idx);
    }
  }, [history, historyIndex]);

  const handleResetAll = useCallback(() => {
    setEditorState(DEFAULT_STATE);
    pushHistory(DEFAULT_STATE);
  }, [pushHistory]);

  const handleImageLoad = useCallback((info: { width: number; height: number }) => {
    setImageSize(info);
  }, []);

  const handleCropChange = useCallback((rect: CropRect | null) => {
    const next = { ...editorState, cropRect: rect };
    setEditorState(next);
  }, [editorState]);

  const handleCropApply = useCallback((rect: CropRect) => {
    const next = { ...editorState, cropRect: rect };
    setEditorState(next);
    pushHistory(next);
    setActiveTool('move');
  }, [editorState, pushHistory]);

  const handleCropCancel = useCallback(() => {
    setActiveTool('move');
  }, []);

  const handleRotate = useCallback((deg: number) => {
    const next = { ...editorState, rotation: ((editorState.rotation + deg) % 360 + 360) % 360 };
    setEditorState(next);
    pushHistory(next);
  }, [editorState, pushHistory]);

  const handleFlipH = useCallback(() => {
    const next = { ...editorState, flippedH: !editorState.flippedH };
    setEditorState(next);
    pushHistory(next);
  }, [editorState, pushHistory]);

  const handleFlipV = useCallback(() => {
    const next = { ...editorState, flippedV: !editorState.flippedV };
    setEditorState(next);
    pushHistory(next);
  }, [editorState, pushHistory]);

  const handleEnhanceChange = useCallback((settings: Partial<EnhanceSettings>) => {
    const next = {
      ...editorState,
      enhance: { ...editorState.enhance, ...settings },
    };
    setEditorState(next);
  }, [editorState]);

  const handleEnhanceApply = useCallback((settings: EnhanceSettings) => {
    const next = { ...editorState, enhance: settings };
    setEditorState(next);
    pushHistory(next);
  }, [editorState, pushHistory]);

  const buildOperations = useCallback((): ImageOperation[] => {
    const ops: ImageOperation[] = [];
    const s = editorState;

    if (s.rotation !== 0) {
      ops.push({ type: 'rotate', params: { angle: s.rotation } });
    }
    if (s.flippedH) {
      ops.push({ type: 'flip', params: { direction: 'horizontal' } });
    }
    if (s.flippedV) {
      ops.push({ type: 'flip', params: { direction: 'vertical' } });
    }
    if (s.cropRect) {
      ops.push({ type: 'crop', params: s.cropRect });
    }
    if (s.enhance.brightness !== 0) {
      ops.push({ type: 'enhance', params: { kind: 'brightness', value: s.enhance.brightness } });
    }
    if (s.enhance.contrast !== 0) {
      ops.push({ type: 'enhance', params: { kind: 'contrast', value: s.enhance.contrast } });
    }
    if (s.enhance.sharpness !== 0) {
      ops.push({ type: 'enhance', params: { kind: 'sharpness', value: s.enhance.sharpness } });
    }
    if (s.enhance.denoise) {
      ops.push({ type: 'denoise', params: { strength: s.enhance.denoiseStrength } });
    }
    if (s.enhance.binarize) {
      ops.push({ type: 'binarize', params: { threshold: s.enhance.binarizeThreshold } });
    }

    return ops;
  }, [editorState]);

  const handleSubmitPreprocess = useCallback(async () => {
    if (!currentFile) return;
    setProcessing(true);
    try {
      const operations = buildOperations();
      const result = await preprocessImage({
        fileId: currentFile.id,
        operations,
      });

      const newFile: UploadFile = {
        ...currentFile,
        id: result.fileId,
        url: result.url,
        uploadedAt: Date.now(),
      };
      addUploadedFile(newFile);
      setCurrentFile(newFile);
      setImageUrl(result.url);

      setEditorState(DEFAULT_STATE);
      setHistory([DEFAULT_STATE]);
      setHistoryIndex(0);

      toast.success('图片预处理完成');
    } catch (e: any) {
      toast.error(e.message || '预处理失败');
    } finally {
      setProcessing(false);
    }
  }, [currentFile, buildOperations, addUploadedFile]);

  const handleSubmitOCR = useCallback(async () => {
    if (!currentFile) {
      toast.warning('请先上传图片');
      return;
    }
    setIsSubmitting(true);
    try {
      const fileIdToUse = currentFile.id;
      const task = await submitOCR([fileIdToUse], selectedCategory);
      addTask(task);
      startPolling(task.id, getTaskStatus);
      toast.success('识别任务已提交');
      navigate(`/result/${task.id}`);
    } catch (e: any) {
      toast.error(e.message || '提交识别失败');
    } finally {
      setIsSubmitting(false);
    }
  }, [currentFile, selectedCategory, addTask, startPolling, navigate]);

  const isLargeFile = currentFile && currentFile.size > LARGE_FILE_THRESHOLD;

  if (!currentFile) {
    return (
      <div className="h-full flex flex-col items-center justify-center py-20 text-slate-400">
        <FileImage className="w-16 h-16 mb-4 opacity-50" />
        <p className="text-lg font-medium text-slate-600 mb-2">暂无待编辑的图片</p>
        <p className="text-sm mb-6">请先在工作台上传图片，或选择一张已上传的图片</p>
        <Button
          variant="primary"
          icon={<ArrowLeft className="w-4 h-4" />}
          onClick={() => navigate('/')}
        >
          返回工作台
        </Button>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col -mx-6 -my-6">
      <EditorToolbar
        fileName={currentFile.originalName}
        imageWidth={imageSize.width}
        imageHeight={imageSize.height}
        fileSize={currentFile.size}
        activeTool={activeTool}
        onToolChange={setActiveTool}
        onBack={() => navigate('/')}
        onResetAll={handleResetAll}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={canUndo}
        canRedo={canRedo}
        onSubmitPreprocess={handleSubmitPreprocess}
        onSubmitOCR={handleSubmitOCR}
        isProcessing={processing || isSubmitting}
        rotation={editorState.rotation}
        flippedH={editorState.flippedH}
        flippedV={editorState.flippedV}
        hasCrop={!!editorState.cropRect}
        enhanceSettings={editorState.enhance}
      />

      {isLargeFile && (
        <div className="flex items-center gap-3 px-6 py-3 bg-amber-50 border-b border-amber-200">
          <FileWarning className="w-5 h-5 text-amber-600 shrink-0" />
          <div className="flex-1 text-sm text-amber-700">
            文件较大（{formatFileSize(currentFile.size)}），
            <span className="font-medium">建议先裁剪减小尺寸</span>，以提升识别速度和效果
          </div>
          <Button
            variant="secondary"
            size="sm"
            icon={<Scissors className="w-4 h-4" />}
            onClick={() => setActiveTool('crop')}
          >
            立即裁剪
          </Button>
        </div>
      )}

      <div className="flex-1 flex min-h-0">
        <div className="w-80 shrink-0 border-r border-slate-200 bg-white overflow-y-auto">
          <div className="p-5 space-y-6">
            {activeTool === 'crop' && (
              <CropTool
                imageWidth={imageSize.width}
                imageHeight={imageSize.height}
                containerWidth={containerSize.width}
                containerHeight={containerSize.height}
                scale={canvasRef.current?.getCurrentTransform().scale || 1}
                offsetX={canvasRef.current?.getCurrentTransform().offsetX || 0}
                offsetY={canvasRef.current?.getCurrentTransform().offsetY || 0}
                initialRect={editorState.cropRect}
                onApply={handleCropApply}
                onCancel={handleCropCancel}
                onChange={handleCropChange}
              />
            )}

            {activeTool === 'rotate' && (
              <RotateTool
                rotation={editorState.rotation}
                flippedH={editorState.flippedH}
                flippedV={editorState.flippedV}
                onRotate={handleRotate}
                onFlipH={handleFlipH}
                onFlipV={handleFlipV}
              />
            )}

            {activeTool === 'enhance' && (
              <EnhancePanel
                settings={editorState.enhance}
                onChange={handleEnhanceChange}
                onApply={handleEnhanceApply}
              />
            )}

            {activeTool === 'move' && (
              <div className="space-y-6">
                <div className="space-y-3">
                  <h3 className="font-semibold text-slate-700 flex items-center gap-2">
                    <Move className="w-4 h-4 text-slate-400" />
                    使用提示
                  </h3>
                  <div className="space-y-2 text-sm text-slate-500 leading-relaxed">
                    <div className="flex items-start gap-2 p-3 bg-slate-50 rounded-lg">
                      <Scissors className="w-4 h-4 text-brand-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium text-slate-700">裁剪工具</p>
                        <p className="text-xs mt-0.5">去除多余区域，聚焦手写内容</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2 p-3 bg-slate-50 rounded-lg">
                      <RotateCw className="w-4 h-4 text-brand-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium text-slate-700">旋转翻转</p>
                        <p className="text-xs mt-0.5">调整图片方向和角度</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2 p-3 bg-slate-50 rounded-lg">
                      <SlidersHorizontal className="w-4 h-4 text-brand-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium text-slate-700">图像增强</p>
                        <p className="text-xs mt-0.5">亮度、对比度、锐化、二值化</p>
                      </div>
                    </div>
                  </div>
                </div>

                {hasChanges && (
                  <div className="p-4 bg-brand-50 border border-brand-200 rounded-xl space-y-3">
                    <h4 className="font-medium text-brand-700 flex items-center gap-2">
                      <Zap className="w-4 h-4" />
                      待应用的修改
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {editorState.rotation !== 0 && (
                        <Tag size="sm" variant="primary">旋转 {editorState.rotation}°</Tag>
                      )}
                      {editorState.flippedH && <Tag size="sm" variant="primary">水平翻转</Tag>}
                      {editorState.flippedV && <Tag size="sm" variant="primary">垂直翻转</Tag>}
                      {editorState.cropRect && <Tag size="sm" variant="warning">已裁剪</Tag>}
                      {editorState.enhance.brightness !== 0 && (
                        <Tag size="sm" variant="info">亮度 {editorState.enhance.brightness > 0 ? '+' : ''}{editorState.enhance.brightness}</Tag>
                      )}
                      {editorState.enhance.contrast !== 0 && (
                        <Tag size="sm" variant="info">对比度 {editorState.enhance.contrast > 0 ? '+' : ''}{editorState.enhance.contrast}</Tag>
                      )}
                      {editorState.enhance.sharpness !== 0 && (
                        <Tag size="sm" variant="info">锐化 {editorState.enhance.sharpness > 0 ? '+' : ''}{editorState.enhance.sharpness}</Tag>
                      )}
                      {editorState.enhance.denoise && <Tag size="sm" variant="success">降噪</Tag>}
                      {editorState.enhance.binarize && <Tag size="sm" variant="success">二值化</Tag>}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div ref={containerRef} className="flex-1 bg-slate-100 relative overflow-hidden">
          <Canvas
            ref={canvasRef}
            imageSrc={imageUrl}
            rotation={editorState.rotation}
            cropRect={activeTool === 'crop' ? editorState.cropRect : null}
            showCropOverlay={activeTool === 'crop'}
            enhanceSettings={editorState.enhance}
            onCropChange={activeTool === 'crop' ? handleCropChange : undefined}
            onImageLoad={handleImageLoad}
          />
        </div>

        <div className="w-72 shrink-0 border-l border-slate-200 bg-white overflow-y-auto">
          <div className="p-5 space-y-5">
            <div className="space-y-3">
              <h3 className="font-semibold text-slate-700 flex items-center gap-2">
                <Info className="w-4 h-4 text-slate-400" />
                原图信息
              </h3>
              <div className="space-y-2.5 text-sm">
                <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500 flex items-center gap-1.5">
                    <FileImage className="w-3.5 h-3.5" />
                    文件名
                  </span>
                  <span className="text-slate-700 font-medium truncate max-w-[160px]" title={currentFile.originalName}>
                    {currentFile.originalName}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500 flex items-center gap-1.5">
                    <Eye className="w-3.5 h-3.5" />
                    尺寸
                  </span>
                  <span className="text-slate-700 font-mono text-xs">
                    {imageSize.width} × {imageSize.height}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500 flex items-center gap-1.5">
                    <HardDrive className="w-3.5 h-3.5" />
                    大小
                  </span>
                  <span className="text-slate-700 font-mono text-xs">
                    {formatFileSize(currentFile.size)}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">MIME 类型</span>
                  <span className="text-slate-700 font-mono text-xs">
                    {currentFile.mimeType}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1.5">
                  <span className="text-slate-500 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    上传时间
                  </span>
                  <span className="text-slate-600 text-xs">
                    {new Date(currentFile.uploadedAt).toLocaleString('zh-CN', {
                      month: 'numeric',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl space-y-2">
              <h4 className="font-medium text-slate-700 text-sm">编辑历史</h4>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span>当前步骤：</span>
                <span className="font-mono text-brand-600 font-medium">
                  {historyIndex + 1} / {history.length}
                </span>
              </div>
              {hasChanges ? (
                <p className="text-xs text-slate-500">
                  有未保存的修改，点击「提交预处理」生成新图片
                </p>
              ) : (
                <p className="text-xs text-slate-500">图片未修改，或所有修改已应用</p>
              )}
            </div>

            <div className="space-y-2 pt-2">
              <Button
                variant="secondary"
                size="md"
                className="w-full"
                icon={processing ? <Loader2 className="w-4 h-4 animate-spin-slow" /> : <Zap className="w-4 h-4" />}
                onClick={handleSubmitPreprocess}
                disabled={!hasChanges || processing || isSubmitting}
              >
                {processing ? '处理中...' : '提交预处理'}
              </Button>
              <Button
                variant="primary"
                size="md"
                className="w-full"
                icon={isSubmitting ? <Loader2 className="w-4 h-4 animate-spin-slow" /> : <Eye className="w-4 h-4" />}
                onClick={handleSubmitOCR}
                disabled={!currentFile || isSubmitting || processing}
              >
                {isSubmitting ? '提交中...' : '提交识别'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ImageEditor;
