import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from '@/components/ui/Layout';
import { ToastContainer } from '@/components/ui/ToastContainer';
import { Workbench } from '@/pages/Workbench';
import { ImageEditor } from '@/pages/ImageEditor';
import { ResultViewer } from '@/pages/ResultViewer';
import { ResultEditor } from '@/pages/ResultEditor';
import { TaskCenter } from '@/pages/TaskCenter';
import { History } from '@/pages/History';

export function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-50 text-slate-900 font-sans antialiased">
        <Layout>
          <Routes>
            <Route path="/" element={<Workbench />} />
            <Route path="/editor/:fileId?" element={<ImageEditor />} />
            <Route path="/result/:taskId" element={<ResultViewer />} />
            <Route path="/edit/:taskId" element={<ResultEditor />} />
            <Route path="/tasks" element={<TaskCenter />} />
            <Route path="/history" element={<History />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
        <ToastContainer position="top-right" maxToasts={5} />
      </div>
    </BrowserRouter>
  );
}

export default App;
