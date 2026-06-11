# Debug Session: ocr-task-routing-bugs

**Status**: [OPEN]
**Date**: 2026-06-11
**Symptoms**:
1. 工作台任务看板四栏（等待中/进行中/已完成/失败）一直空白
2. 上传图片提交识别后，进度条卡住不动，识别结果出不来
3. 任务中心任务列表为空，暂停/重试点了无反应

## Hypotheses
1. **H1 [CONFIRMED]**: 前端 api.ts 与后端路由路径完全不匹配，所有任务请求返回 404
2. **H2 [CONFIRMED]**: 后端 ocr.routes.ts 缺失关键路由（status/result/list/pause/resume/retry/cancel）
3. **H3 [CONFIRMED]**: getTaskResult 返回结构与 ResultViewer 期望不匹配，且 loadResult 中 task 为 null 时不会更新本地状态
4. **H4 [CONFIRMED]**: 后端缺少 cancelTask 路由实现
5. **H5 [CONFIRMED]**: 前端 pauseTask/resumeTask/cancelTask/deleteTask 返回类型定义错误，导致 `result.success` 判断永远为 false
6. **H6 [CONFIRMED]**: TaskCard 缺少 onResume 回调，暂停状态下点击"继续"仍然调用 onPause
7. **H7 [CONFIRMED]**: TaskQueue 批量"继续"按钮错误地调用了 handleBatchPause
8. **H8 [CONFIRMED]**: saveResult API 路径不匹配（前端 /results/:id/save vs 后端 /result/:id）

## Evidence Log
- 前端 api.ts 调用路径 vs 后端路由对比：
  - `listTasks` → GET `/api/ocr/tasks` vs 后端：POST `/api/tasks/list` ❌
  - `getTaskStatus` → GET `/api/ocr/tasks/:id/status` vs 后端：无 ❌
  - `getTaskResult` → GET `/api/ocr/tasks/:id/result` vs 后端：GET `/api/ocr/task/:id` ❌
  - `pauseTask` → POST `/api/ocr/tasks/:id/pause` vs 后端：POST `/api/tasks/:id/pause` ❌
  - `resumeTask` → POST `/api/ocr/tasks/:id/resume` vs 后端：POST `/api/tasks/:id/resume` ❌
  - `retryTask` → POST `/api/ocr/tasks/:id/retry` vs 后端：POST `/api/tasks/:id/retry` ❌
  - `cancelTask` → POST `/api/ocr/tasks/:id/cancel` vs 后端：无 ❌
  - `deleteTask` → DELETE `/api/tasks/:id` vs 后端：DELETE `/api/tasks/:id` ✅
  - `saveResult` → POST `/api/results/:id/save` vs 后端：PUT `/api/result/:id` ❌

## Fix Log

### 后端修复
1. **api/routes/ocr.routes.ts**: 添加了 8 个缺失的路由
   - GET `/tasks` - 任务列表
   - GET `/tasks/:taskId` - 获取单个任务
   - GET `/tasks/:taskId/status` - 获取任务进度
   - GET `/tasks/:taskId/result` - 获取任务结果
   - POST `/tasks/:taskId/pause` - 暂停任务
   - POST `/tasks/:taskId/resume` - 恢复任务
   - POST `/tasks/:taskId/retry` - 重试任务
   - POST `/tasks/:taskId/cancel` - 取消任务

2. **api/routes/result.routes.ts**: 修复 PUT `/:taskId` 处理 editedBlocks

### 前端修复
3. **src/utils/api.ts**:
   - 修正 saveResult 路径：`/results/${taskId}/save` → `/result/${taskId}`，方法改为 PUT
   - 修正 pauseTask/resumeTask/retryTask/cancelTask/deleteTask 返回类型
   - 修正 batch* 系列 API 返回类型

4. **src/pages/ResultViewer.tsx**:
   - 修复 loadResult：当 task 为 null 时也能正确更新本地状态
   - 修复 handleDelete/handleRetry 中对返回值的判断

5. **src/pages/TaskCenter.tsx**:
   - 修复 handlePause/handleResume 中 `result.success` → `result` 真值判断
   - 给 TaskCard 和 TaskQueue 添加 onResume 回调

6. **src/components/task/TaskCard.tsx**:
   - 添加 onResume prop
   - 修复暂停状态下"继续"按钮调用 onResume 而非 onPause

7. **src/components/task/TaskQueue.tsx**:
   - 添加 onTaskResume prop
   - 修复批量"继续"按钮 onClick：handleBatchPause → handleBatchResume
   - 给 TaskCard 传递 onResume

