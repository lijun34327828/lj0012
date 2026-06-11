import app from './app.js';
import { config } from '@api/config.js';

process.on('uncaughtException', (err: Error) => {
  console.error('[未捕获异常]', err);
});

process.on('unhandledRejection', (reason: unknown) => {
  console.error('[未处理的Promise拒绝]', reason);
});

app.listen(config.port, () => {
  console.log(`手写OCR服务启动:${config.port}`);
});
