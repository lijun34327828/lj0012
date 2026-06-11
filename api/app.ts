import express from 'express';
import cors from 'cors';
import { config } from '@api/config.js';
import { rateLimiter } from './middleware/rateLimiter.js';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';
import { initStorageDirs } from './utils/storage.js';
import TaskQueueService from './services/TaskQueueService.js';
import uploadRoutes from './routes/upload.routes.js';
import imageRoutes from './routes/image.routes.js';
import ocrRoutes from './routes/ocr.routes.js';
import taskRoutes from './routes/task.routes.js';
import resultRoutes from './routes/result.routes.js';
import historyRoutes from './routes/history.routes.js';
import exportRoutes from './routes/export.routes.js';

const app = express();

initStorageDirs();
void TaskQueueService.init();

app.use(cors(config.cors));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/storage', express.static(config.storage.baseDir));
app.use(rateLimiter());

app.use('/api/upload', uploadRoutes);
app.use('/api/image', imageRoutes);
app.use('/api/ocr', ocrRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/result', resultRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/export', exportRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
