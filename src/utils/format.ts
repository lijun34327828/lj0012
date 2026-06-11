export function formatProgress(percent: number): string {
  const p = Math.max(0, Math.min(100, Math.round(percent)));
  return `${p}%`;
}

export function calculateETA(progress: number, elapsedMs: number): string {
  if (progress <= 0 || progress >= 100 || elapsedMs <= 0) {
    return '计算中...';
  }

  const remainingRatio = (100 - progress) / progress;
  const remainingMs = elapsedMs * remainingRatio;

  const totalSeconds = Math.ceil(remainingMs / 1000);

  if (totalSeconds < 60) {
    return `约 ${totalSeconds} 秒`;
  }

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes < 60) {
    return seconds > 0 ? `约 ${minutes} 分 ${seconds} 秒` : `约 ${minutes} 分钟`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  return remainingMinutes > 0 ? `约 ${hours} 时 ${remainingMinutes} 分` : `约 ${hours} 小时`;
}

export function truncateText(str: string, maxLen: number): string {
  if (!str) return '';
  if (str.length <= maxLen) return str;
  if (maxLen <= 1) return str.slice(0, maxLen);
  return str.slice(0, maxLen - 1) + '…';
}

export function generateSummary(text: string, maxLen: number = 100): string {
  if (!text) return '';

  let cleaned = text
    .replace(/\s+/g, ' ')
    .replace(/[\r\n\t]+/g, ' ')
    .trim();

  const sentenceEnd = cleaned.search(/[。！？.!?]/);
  if (sentenceEnd > 0 && sentenceEnd < maxLen * 0.8) {
    cleaned = cleaned.slice(0, sentenceEnd + 1);
  }

  return truncateText(cleaned, maxLen);
}
