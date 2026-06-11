import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  Undo2,
  Redo2,
  Bold,
  Italic,
  Underline as UnderlineIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Table,
  Merge,
  Plus,
  Trash2,
  PenLine,
  Printer,
  Sparkles,
  Save,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import type { TextType } from '@shared/types';
import { useResultStore } from '@/stores/resultStore';
import { saveResult } from '@/utils/api';
import { Button } from '@/components/ui/Button';
import { Tag } from '@/components/ui/Tag';
import { toast } from '@/utils/toast';
import { cn } from '@/lib/utils';

interface HistoryState {
  html: string;
  selection: { start: number; end: number } | null;
}

export function RichEditor() {
  const { currentTask, currentResult, getBlockContent, collectEdits, markSaved, isDirty, editBlock } = useResultStore();
  const editorRef = useRef<HTMLDivElement>(null);
  const [history, setHistory] = useState<HistoryState[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [fontSize, setFontSize] = useState(16);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedText, setLastSavedText] = useState('');
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInternalChangeRef = useRef(false);

  const editorContent = useMemo(() => {
    if (!currentResult) return '';
    const parts: string[] = [];
    currentResult.blocks.forEach((pb) => {
      let tag = 'p';
      let style = '';
      if (pb.type === 'heading') {
        tag = 'h1';
        style = 'font-size: 28px; font-weight: 700;';
      } else if (pb.type === 'table') {
        tag = 'div';
      } else if (pb.type === 'list') {
        tag = 'ul';
      }

      if (pb.alignment === 'center') style += 'text-align: center;';
      else if (pb.alignment === 'right') style += 'text-align: right;';
      if (pb.indent) style += `text-indent: ${pb.indent * 2}em;`;

      if (pb.type === 'table' && pb.tableData) {
        parts.push('<table style="border-collapse: collapse; margin: 8px 0; width: 100%;">');
        pb.tableData.forEach((row, ri) => {
          parts.push('<tr>');
          row.forEach((cell, ci) => {
            const tb = pb.texts.find((t) => t.lineIndex === ri && t.pageIndex === ci);
            const content = tb ? getBlockContent(tb.id) ?? tb.content : cell;
            const cls = getTextBlockClasses(tb);
            const attrs = tb ? ` data-block-id="${tb.id}" data-type="${tb.type}" data-confidence="${tb.confidence}"` : '';
            parts.push(
              `<td class="${cls}" style="border: 1px solid #e2e8f0; padding: 8px 12px; vertical-align: top; ${ri === 0 ? 'background: #f8fafc; font-weight: 600;' : ''}"${attrs}>${escapeHtml(content || '')}</td>`
            );
          });
          parts.push('</tr>');
        });
        parts.push('</table>');
      } else if (pb.type === 'list') {
        parts.push(`<${tag} style="padding-left: 20px;">`);
        pb.texts.forEach((tb) => {
          const content = getBlockContent(tb.id) ?? tb.content;
          const cls = getTextBlockClasses(tb);
          parts.push(
            `<li class="${cls}" data-block-id="${tb.id}" data-type="${tb.type}" data-confidence="${tb.confidence}">${escapeHtml(content)}</li>`
          );
        });
        parts.push(`</${tag}>`);
      } else {
        parts.push(`<${tag} style="${style} padding: 4px 0; line-height: 1.8;">`);
        pb.texts.forEach((tb) => {
          const content = getBlockContent(tb.id) ?? tb.content;
          const cls = getTextBlockClasses(tb);
          parts.push(
            `<span class="${cls}" data-block-id="${tb.id}" data-type="${tb.type}" data-confidence="${tb.confidence}">${escapeHtml(content)}</span>`
          );
        });
        parts.push(`</${tag}>`);
      }
    });
    return parts.join('');
  }, [currentResult, getBlockContent]);

  useEffect(() => {
    if (editorRef.current && !isInternalChangeRef.current) {
      editorRef.current.innerHTML = editorContent;
      if (history.length === 0) {
        setHistory([{ html: editorContent, selection: null }]);
        setHistoryIndex(0);
      }
    }
    isInternalChangeRef.current = false;
  }, [editorContent]);

  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, []);

  function escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function getTextBlockClasses(tb?: { type: TextType; confidence: number }): string {
    if (!tb) return '';
    const classes: string[] = ['cursor-pointer', 'transition-colors', 'rounded', 'px-0.5'];
    if (tb.type === 'handwritten') classes.push('wavy-underline');
    if (tb.confidence < 0.7) classes.push('confidence-low');
    return classes.join(' ');
  }

  const pushHistory = useCallback(() => {
    if (!editorRef.current) return;
    const html = editorRef.current.innerHTML;
    const sel = window.getSelection();
    let selection: { start: number; end: number } | null = null;
    if (sel && sel.rangeCount > 0 && editorRef.current.contains(sel.anchorNode)) {
      const range = sel.getRangeAt(0);
      const preStart = range.cloneRange();
      preStart.selectNodeContents(editorRef.current);
      preStart.setEnd(range.startContainer, range.startOffset);
      const start = preStart.toString().length;
      selection = { start, end: start + range.toString().length };
    }

    setHistory((prev) => {
      const trimmed = prev.slice(0, historyIndex + 1);
      if (trimmed[trimmed.length - 1]?.html === html) return prev;
      return [...trimmed, { html, selection }].slice(-50);
    });
    setHistoryIndex((i) => Math.min(i + 1, 49));
  }, [historyIndex]);

  const execCommand = useCallback(
    (cmd: string, value?: string) => {
      isInternalChangeRef.current = true;
      document.execCommand(cmd, false, value);
      editorRef.current?.focus();
      pushHistory();
      syncEditsFromDom();
    },
    [pushHistory]
  );

  const syncEditsFromDom = useCallback(() => {
    if (!editorRef.current || !currentResult) return;
    const nodes = editorRef.current.querySelectorAll('[data-block-id]');
    nodes.forEach((node) => {
      const id = node.getAttribute('data-block-id');
      if (!id) return;
      const content = node.textContent ?? '';
      const original = (() => {
        for (const b of currentResult.blocks) {
          for (const t of b.texts) {
            if (t.id === id) return t.content;
          }
        }
        return '';
      })();
      if (content !== original) {
        editBlock(id, content);
      }
    });
  }, [currentResult, editBlock]);

  const handleInput = useCallback(() => {
    pushHistory();
    syncEditsFromDom();

    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      handleSave(true);
    }, 5000);
  }, [pushHistory, syncEditsFromDom]);

  const handleUndo = useCallback(() => {
    if (historyIndex <= 0) return;
    isInternalChangeRef.current = true;
    const idx = historyIndex - 1;
    const state = history[idx];
    if (editorRef.current && state) {
      editorRef.current.innerHTML = state.html;
      setHistoryIndex(idx);
      syncEditsFromDom();
    }
  }, [history, historyIndex, syncEditsFromDom]);

  const handleRedo = useCallback(() => {
    if (historyIndex >= history.length - 1) return;
    isInternalChangeRef.current = true;
    const idx = historyIndex + 1;
    const state = history[idx];
    if (editorRef.current && state) {
      editorRef.current.innerHTML = state.html;
      setHistoryIndex(idx);
      syncEditsFromDom();
    }
  }, [history, historyIndex, syncEditsFromDom]);

  const handleSave = useCallback(
    async (auto = false) => {
      if (!currentTask || isSaving) return;
      setIsSaving(true);
      try {
        const edits = collectEdits();
        const res = await saveResult(currentTask.id, edits);
        markSaved();
        const time = new Date(res.updatedAt);
        const timeStr = `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}:${time.getSeconds().toString().padStart(2, '0')}`;
        setLastSavedText(timeStr);
        if (!auto) toast.success('保存成功');
      } catch (e: any) {
        if (!auto) toast.error(e.message || '保存失败');
      } finally {
        setIsSaving(false);
      }
    },
    [currentTask, collectEdits, markSaved, isSaving]
  );

  const getSelectionInfo = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !editorRef.current?.contains(sel.anchorNode)) {
      return { text: '', blocks: [] as { id: string; type: string; confidence: number }[] };
    }

    const range = sel.getRangeAt(0);
    const text = range.toString();
    const blocks: { id: string; type: string; confidence: number }[] = [];
    const walker = document.createTreeWalker(range.commonAncestorContainer, NodeFilter.SHOW_ELEMENT);
    let node: Node | null = walker.currentNode;
    const startContainer = range.startContainer;
    const endContainer = range.endContainer;
    const startOffset = range.startOffset;
    const endOffset = range.endOffset;

    function checkIntersect(el: HTMLElement): boolean {
      if (!el.hasAttribute('data-block-id')) return false;
      const elRange = document.createRange();
      elRange.selectNodeContents(el);
      return !(range.compareBoundaryPoints(Range.END_TO_START, elRange) > 0 ||
               range.compareBoundaryPoints(Range.START_TO_END, elRange) < 0);
    }

    const allBlocks = editorRef.current.querySelectorAll('[data-block-id]');
    allBlocks.forEach((el) => {
      if (checkIntersect(el as HTMLElement)) {
        blocks.push({
          id: el.getAttribute('data-block-id')!,
          type: el.getAttribute('data-type') || 'printed',
          confidence: parseFloat(el.getAttribute('data-confidence') || '1'),
        });
      }
    });

    return { text, blocks };
  }, []);

  const applySelectionType = useCallback(
    (type: TextType) => {
      const { blocks } = getSelectionInfo();
      blocks.forEach((b) => {
        const el = editorRef.current?.querySelector(`[data-block-id="${b.id}"]`);
        if (el) {
          el.setAttribute('data-type', type);
          el.classList.remove('wavy-underline');
          if (type === 'handwritten') el.classList.add('wavy-underline');
        }
      });
      pushHistory();
    },
    [getSelectionInfo, pushHistory]
  );

  const replaceLowConfidence = useCallback(() => {
    if (!currentResult) return;
    const { blocks } = getSelectionInfo();
    const lowBlocks = blocks.filter((b) => b.confidence < 0.7);
    if (lowBlocks.length === 0) {
      toast.info('选中内容中没有低置信度文字');
      return;
    }
    let replaced = 0;
    lowBlocks.forEach((b) => {
      const tb = (() => {
        for (const pb of currentResult.blocks) {
          for (const t of pb.texts) {
            if (t.id === b.id) return t;
          }
        }
        return null;
      })();
      if (tb?.candidates?.[0]) {
        editBlock(tb.id, tb.candidates[0]);
        const el = editorRef.current?.querySelector(`[data-block-id="${tb.id}"]`);
        if (el) el.textContent = tb.candidates[0];
        replaced++;
      }
    });
    pushHistory();
    if (replaced > 0) toast.success(`已替换 ${replaced} 处低置信度文字`);
    else toast.info('没有可替换的候选词');
  }, [currentResult, getSelectionInfo, editBlock, pushHistory]);

  const insertTable = useCallback(() => {
    const rows = 3;
    const cols = 3;
    let html = '<table style="border-collapse: collapse; margin: 8px 0; width: 100%;">';
    for (let r = 0; r < rows; r++) {
      html += '<tr>';
      for (let c = 0; c < cols; c++) {
        html += `<td style="border: 1px solid #e2e8f0; padding: 8px 12px; ${r === 0 ? 'background: #f8fafc; font-weight: 600;' : ''}">&nbsp;</td>`;
      }
      html += '</tr>';
    }
    html += '</table>';
    execCommand('insertHTML', html);
  }, [execCommand]);

  const mergeCells = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    const container = range.commonAncestorContainer;
    const table = (container.nodeType === 1 ? (container as HTMLElement) : container.parentElement)?.closest('table');
    if (!table) {
      toast.info('请先选中表格中的单元格');
      return;
    }
    toast.info('请使用鼠标拖拽选择多个相邻单元格后操作');
  }, []);

  const insertParagraph = useCallback(() => {
    execCommand('insertHTML', '<p style="padding: 4px 0; line-height: 1.8;"><br></p>');
  }, [execCommand]);

  const deleteSelection = useCallback(() => {
    execCommand('delete');
  }, [execCommand]);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  return (
    <div className="flex flex-col h-full bg-white rounded-xl border border-slate-100 overflow-hidden">
      <div className="border-b border-slate-100 bg-slate-50/80 px-3 py-2">
        <div className="flex flex-wrap items-center gap-1">
          <div className="flex items-center gap-0.5 bg-white rounded-lg p-0.5 border border-slate-200">
            <button
              onClick={handleUndo}
              disabled={!canUndo}
              className={cn(
                'p-1.5 rounded-md transition-all',
                canUndo ? 'text-slate-600 hover:bg-slate-100 hover:text-brand-600' : 'text-slate-300 cursor-not-allowed'
              )}
              title="撤销 (Ctrl+Z)"
            >
              <Undo2 size={16} />
            </button>
            <button
              onClick={handleRedo}
              disabled={!canRedo}
              className={cn(
                'p-1.5 rounded-md transition-all',
                canRedo ? 'text-slate-600 hover:bg-slate-100 hover:text-brand-600' : 'text-slate-300 cursor-not-allowed'
              )}
              title="重做 (Ctrl+Y)"
            >
              <Redo2 size={16} />
            </button>
          </div>

          <div className="w-px h-6 bg-slate-200 mx-1" />

          <div className="flex items-center gap-0.5 bg-white rounded-lg p-0.5 border border-slate-200">
            <button
              onClick={() => execCommand('bold')}
              className="p-1.5 rounded-md text-slate-600 hover:bg-slate-100 hover:text-brand-600 transition-all"
              title="加粗 (Ctrl+B)"
            >
              <Bold size={16} />
            </button>
            <button
              onClick={() => execCommand('italic')}
              className="p-1.5 rounded-md text-slate-600 hover:bg-slate-100 hover:text-brand-600 transition-all"
              title="斜体 (Ctrl+I)"
            >
              <Italic size={16} />
            </button>
            <button
              onClick={() => execCommand('underline')}
              className="p-1.5 rounded-md text-slate-600 hover:bg-slate-100 hover:text-brand-600 transition-all"
              title="下划线 (Ctrl+U)"
            >
              <UnderlineIcon size={16} />
            </button>
          </div>

          <div className="flex items-center gap-1 bg-white rounded-lg px-1.5 py-0.5 border border-slate-200">
            <label className="text-xs text-slate-500">字号</label>
            <select
              value={fontSize}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                setFontSize(val);
                execCommand('fontSize', '7');
                const fontEls = editorRef.current?.querySelectorAll('font[size="7"]');
                fontEls?.forEach((el) => {
                  (el as HTMLElement).removeAttribute('size');
                  (el as HTMLElement).style.fontSize = `${val}px`;
                });
              }}
              className="text-xs border-0 bg-transparent outline-none text-slate-700 cursor-pointer"
            >
              {[12, 14, 16, 18, 20, 24, 28, 32].map((s) => (
                <option key={s} value={s}>
                  {s}px
                </option>
              ))}
            </select>
          </div>

          <div className="w-px h-6 bg-slate-200 mx-1" />

          <div className="flex items-center gap-0.5 bg-white rounded-lg p-0.5 border border-slate-200">
            <button
              onClick={() => execCommand('justifyLeft')}
              className="p-1.5 rounded-md text-slate-600 hover:bg-slate-100 hover:text-brand-600 transition-all"
              title="左对齐"
            >
              <AlignLeft size={16} />
            </button>
            <button
              onClick={() => execCommand('justifyCenter')}
              className="p-1.5 rounded-md text-slate-600 hover:bg-slate-100 hover:text-brand-600 transition-all"
              title="居中对齐"
            >
              <AlignCenter size={16} />
            </button>
            <button
              onClick={() => execCommand('justifyRight')}
              className="p-1.5 rounded-md text-slate-600 hover:bg-slate-100 hover:text-brand-600 transition-all"
              title="右对齐"
            >
              <AlignRight size={16} />
            </button>
          </div>

          <div className="w-px h-6 bg-slate-200 mx-1" />

          <div className="flex items-center gap-0.5 bg-white rounded-lg p-0.5 border border-slate-200">
            <button
              onClick={insertTable}
              className="p-1.5 rounded-md text-slate-600 hover:bg-slate-100 hover:text-brand-600 transition-all"
              title="插入表格"
            >
              <Table size={16} />
            </button>
            <button
              onClick={mergeCells}
              className="p-1.5 rounded-md text-slate-600 hover:bg-slate-100 hover:text-brand-600 transition-all"
              title="合并单元格"
            >
              <Merge size={16} />
            </button>
            <button
              onClick={insertParagraph}
              className="p-1.5 rounded-md text-slate-600 hover:bg-slate-100 hover:text-brand-600 transition-all"
              title="插入段落"
            >
              <Plus size={16} />
            </button>
            <button
              onClick={deleteSelection}
              className="p-1.5 rounded-md text-slate-600 hover:bg-slate-100 hover:text-danger-600 transition-all"
              title="删除选中"
            >
              <Trash2 size={16} />
            </button>
          </div>

          <div className="flex-1" />

          <div className="flex items-center gap-0.5 bg-white rounded-lg p-0.5 border border-slate-200">
            <button
              onClick={() => applySelectionType('handwritten')}
              className="px-2 py-1 rounded-md text-xs text-slate-600 hover:bg-brand-50 hover:text-brand-600 transition-all flex items-center gap-1"
              title="标记为手写体"
            >
              <PenLine size={12} />
              <span className="hidden sm:inline">手写</span>
            </button>
            <button
              onClick={() => applySelectionType('printed')}
              className="px-2 py-1 rounded-md text-xs text-slate-600 hover:bg-slate-100 transition-all flex items-center gap-1"
              title="标记为印刷体"
            >
              <Printer size={12} />
              <span className="hidden sm:inline">印刷</span>
            </button>
            <button
              onClick={replaceLowConfidence}
              className="px-2 py-1 rounded-md text-xs text-slate-600 hover:bg-amber-50 hover:text-amber-700 transition-all flex items-center gap-1"
              title="批量替换低置信度"
            >
              <Sparkles size={12} />
              <span className="hidden sm:inline">批量替换</span>
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 md:p-10">
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={handleInput}
          onBlur={syncEditsFromDom}
          className="paper-texture rounded-xl min-h-full p-6 md:p-10 max-w-3xl mx-auto outline-none focus:ring-2 focus:ring-brand-200"
          style={{ lineHeight: '1.8' }}
        />
      </div>

      <div className="border-t border-slate-100 bg-slate-50/80 px-4 py-2.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-xs text-slate-500">
          {isDirty && (
            <Tag variant="warning" size="sm" icon={<AlertTriangle size={10} />}>
              有未保存的修改
            </Tag>
          )}
          {lastSavedText && (
            <span className="flex items-center gap-1">
              <Clock size={12} />
              上次保存: {lastSavedText}
            </span>
          )}
        </div>
        <Button
          size="sm"
          variant={isDirty ? 'primary' : 'secondary'}
          loading={isSaving}
          icon={<Save size={14} />}
          onClick={() => handleSave(false)}
        >
          保存
        </Button>
      </div>
    </div>
  );
}

export default RichEditor;
