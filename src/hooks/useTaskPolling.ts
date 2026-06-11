import { useCallback, useEffect, useRef, useState } from 'react';
import type { TaskProgress, TaskStatus } from '@shared/types';
import { getTaskStatus } from '@/utils/api';

export interface UseTaskPollingResult {
  status: TaskStatus | null;
  progress: number;
  currentStage: string;
  stageDetail?: string;
  etaSeconds?: number;
  tasks: TaskProgress[];
  error?: string;
  isPolling: boolean;
  stop: () => void;
  start: () => void;
  forceRefresh: () => Promise<void>;
}

export type TaskPollingInput = string | string[] | undefined | null;

export type TaskPollingOnUpdate =
  | ((progress: TaskProgress) => void)
  | ((taskId: string, progress: TaskProgress) => void);

const TERMINAL_STATUSES = new Set<TaskStatus>(['completed', 'failed', 'paused']);

function normalizeTaskIds(input: TaskPollingInput): string[] {
  if (!input) return [];
  if (Array.isArray(input)) return input.filter(Boolean);
  return [input];
}

export function useTaskPolling(
  taskIds: TaskPollingInput,
  onUpdate?: TaskPollingOnUpdate,
  interval: number = 3000
): UseTaskPollingResult {
  const ids = normalizeTaskIds(taskIds);
  const isBatch = ids.length > 1;
  const primaryId = ids[0] || null;

  const [tasks, setTasks] = useState<TaskProgress[]>([]);
  const [status, setStatus] = useState<TaskStatus | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [currentStage, setCurrentStage] = useState<string>('');
  const [stageDetail, setStageDetail] = useState<string | undefined>();
  const [etaSeconds, setEtaSeconds] = useState<number | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [isPolling, setIsPolling] = useState<boolean>(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef<boolean>(true);
  const onUpdateRef = useRef(onUpdate);

  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  const doFetch = useCallback(async () => {
    if (ids.length === 0) return;

    try {
      const results: TaskProgress[] = [];
      const allTerminal: boolean[] = [];

      for (const id of ids) {
        try {
          const result = await getTaskStatus(id);
          results.push(result);
          allTerminal.push(TERMINAL_STATUSES.has(result.status));

          if (onUpdateRef.current) {
            const cb = onUpdateRef.current;
            if (cb.length >= 2) {
              (cb as (taskId: string, progress: TaskProgress) => void)(id, result);
            } else {
              (cb as (progress: TaskProgress) => void)(result);
            }
          }
        } catch {
          // skip individual task errors
        }
      }

      if (!mountedRef.current) return;

      setTasks(results);
      setError(undefined);

      if (!isBatch && results[0]) {
        const r = results[0];
        setStatus(r.status);
        setProgress(r.progress);
        setCurrentStage(r.currentStage);
        setStageDetail(r.stageDetail);
        setEtaSeconds(r.etaSeconds);
      } else if (isBatch && results.length > 0) {
        const avgProgress = Math.round(
          results.reduce((sum, r) => sum + r.progress, 0) / results.length
        );
        const running = results.find((r) => !TERMINAL_STATUSES.has(r.status));
        setStatus(running ? running.status : results[0].status);
        setProgress(avgProgress);
        setCurrentStage(running ? running.currentStage : results[0].currentStage);
        setStageDetail(running?.stageDetail);
        setEtaSeconds(Math.max(...results.map((r) => r.etaSeconds ?? 0)) || undefined);
      }

      if (allTerminal.length > 0 && allTerminal.every(Boolean)) {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        setIsPolling(false);
      }
    } catch (e: any) {
      if (!mountedRef.current) return;
      setError(e.message || '轮询任务状态失败');
    }
  }, [ids.join(','), isBatch]);

  const start = useCallback(() => {
    if (ids.length === 0 || timerRef.current) return;

    setIsPolling(true);
    doFetch();
    timerRef.current = setInterval(doFetch, interval);
  }, [ids.join(','), doFetch, interval]);

  const stop = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsPolling(false);
  }, []);

  const forceRefresh = useCallback(async () => {
    await doFetch();
  }, [doFetch]);

  useEffect(() => {
    stop();
    setTasks([]);
    setStatus(null);
    setProgress(0);
    setCurrentStage('');
    setStageDetail(undefined);
    setEtaSeconds(undefined);
    setError(undefined);

    if (ids.length > 0) {
      start();
    }

    return stop;
  }, [ids.join(',')]);

  return {
    status,
    progress,
    currentStage,
    stageDetail,
    etaSeconds,
    tasks,
    error,
    isPolling,
    stop,
    start,
    forceRefresh,
  };
}
