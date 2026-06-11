export function formatFileSize(bytes: number): string {
  if (bytes === 0 || bytes == null) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const size = bytes / Math.pow(k, i);

  return `${size.toFixed(i === 0 ? 0 : size < 10 ? 2 : 1)} ${units[i]}`;
}

export function formatTimestamp(ts: number): string {
  if (!ts) return '';

  const date = new Date(ts);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

export function getFileExtension(filename: string): string {
  if (!filename) return '';
  const lastDot = filename.lastIndexOf('.');
  if (lastDot === -1 || lastDot === filename.length - 1) return '';
  return filename.slice(lastDot + 1).toLowerCase();
}

const IMAGE_EXTENSIONS = new Set([
  'jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'tiff', 'tif', 'svg', 'heic', 'heif', 'raw'
]);

const IMAGE_MIMETYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/bmp',
  'image/webp',
  'image/tiff',
  'image/svg+xml',
  'image/heic',
  'image/heif',
  'image/x-raw',
]);

export function isImageFile(input: string): boolean {
  if (!input) return false;

  if (input.includes('/')) {
    return IMAGE_MIMETYPES.has(input.toLowerCase());
  }

  const ext = getFileExtension(input);
  return IMAGE_EXTENSIONS.has(ext);
}

export function generateFileHash(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const chunkSize = 2 * 1024 * 1024;
    const samples: string[] = [];
    let offset = 0;

    const readNextChunk = () => {
      const slice = file.slice(offset, Math.min(offset + chunkSize, file.size));
      const chunkReader = new FileReader();

      chunkReader.onload = (e) => {
        const result = e.target?.result as ArrayBuffer;
        if (result) {
          const view = new Uint8Array(result);
          let hash = 0;
          for (let i = 0; i < view.length; i += Math.max(1, Math.floor(view.length / 1024))) {
            hash = ((hash << 5) - hash + view[i]) | 0;
          }
          samples.push(hash.toString(36));
        }

        offset += chunkSize;
        if (offset < file.size && samples.length < 4) {
          readNextChunk();
        } else {
          samples.unshift(file.size.toString(36));
          samples.unshift(file.name);
          resolve(samples.join('-'));
        }
      };

      chunkReader.onerror = () => reject(new Error('读取文件失败'));
      chunkReader.readAsArrayBuffer(slice);
    };

    reader.onerror = () => reject(new Error('读取文件失败'));
    readNextChunk();
  });
}
