import { useMemo, useState, ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Image,
  ListTodo,
  Clock,
  Menu,
  PanelLeftClose,
  PanelLeft,
  Settings,
  User,
  LogOut,
  ChevronDown,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUserPrefStore } from '@/stores/userPrefStore';
import { useUploadStore } from '@/stores/uploadStore';
import { CATEGORY_LABELS } from '@shared/types';

interface MenuItem {
  key: string;
  label: string;
  path: string;
  icon: typeof LayoutDashboard;
}

const menuItems: MenuItem[] = [
  { key: 'dashboard', label: '工作台', path: '/', icon: LayoutDashboard },
  { key: 'editor', label: '图片编辑器', path: '/editor', icon: Image },
  { key: 'tasks', label: '任务中心', path: '/tasks', icon: ListTodo },
  { key: 'history', label: '历史记录', path: '/history', icon: Clock },
];

const pageTitles: Record<string, string> = {
  '/': '工作台',
  '/editor': '图片编辑器',
  '/tasks': '任务中心',
  '/history': '历史记录',
  '/result': '识别结果',
  '/settings': '系统设置',
};

function getPageTitle(pathname: string): string {
  if (pageTitles[pathname]) return pageTitles[pathname];
  for (const [prefix, title] of Object.entries(pageTitles)) {
    if (pathname.startsWith(prefix)) return title;
  }
  return '手写内容识别工具';
}

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const sidebarCollapsed = useUserPrefStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUserPrefStore((s) => s.toggleSidebar);
  const files = useUploadStore((s) => s.files);
  const selectedCategory = useUploadStore((s) => s.selectedCategory);

  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const pageTitle = useMemo(() => getPageTitle(location.pathname), [location.pathname]);

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <aside
        className={cn(
          'bg-white border-r border-slate-100 flex flex-col transition-all duration-300 ease-in-out z-20',
          sidebarCollapsed ? 'w-20' : 'w-64'
        )}
      >
        <div className={cn(
          'h-16 flex items-center border-b border-slate-100 px-4 shrink-0',
          sidebarCollapsed ? 'justify-center' : 'gap-3'
        )}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center text-white shadow-md shrink-0">
            <Sparkles size={20} />
          </div>
          {!sidebarCollapsed && (
            <div className="min-w-0">
              <h1 className="font-bold text-slate-800 text-lg leading-tight truncate">
                手写识别
              </h1>
              <p className="text-xs text-slate-400 truncate">Handwriting OCR</p>
            </div>
          )}
        </div>

        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {!sidebarCollapsed && (
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider px-3 mb-2 mt-2">
              导航菜单
            </p>
          )}
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.key}
                to={item.path}
                end={item.path === '/'}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 group',
                    sidebarCollapsed && 'justify-center px-0',
                    isActive
                      ? 'bg-brand-50 text-brand-600 shadow-sm'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'
                  )
                }
              >
                <Icon
                  size={20}
                  className={cn(
                    'shrink-0 transition-transform duration-200'
                  )}
                />
                {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
              </NavLink>
            );
          })}
        </nav>

        <div className={cn(
          'p-3 border-t border-slate-100 shrink-0',
          sidebarCollapsed && 'px-2'
        )}>
          {!sidebarCollapsed ? (
            <div className="rounded-xl bg-gradient-to-br from-brand-50 to-blue-50 p-3 border border-brand-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-slate-500">已上传文件</span>
                <span className="text-xs font-bold text-brand-600 bg-white px-2 py-0.5 rounded-full">
                  {files.length}
                </span>
              </div>
              <div className="text-xs text-slate-600">
                当前分类：
                <span className="font-medium text-slate-800">
                  {CATEGORY_LABELS[selectedCategory]}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center py-2 space-y-2">
              <span className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center text-brand-600 font-bold text-sm">
                {files.length}
              </span>
            </div>
          )}
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white/80 backdrop-blur-md border-b border-slate-100 flex items-center justify-between px-6 shrink-0 sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <button
              onClick={toggleSidebar}
              className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
              title={sidebarCollapsed ? '展开侧边栏' : '收起侧边栏'}
            >
              {sidebarCollapsed ? <PanelLeft size={20} /> : <PanelLeftClose size={20} />}
            </button>
            <Menu className="w-px h-6 bg-slate-200" />
            <div>
              <h2 className="text-lg font-semibold text-slate-800">{pageTitle}</h2>
              <p className="text-xs text-slate-400">
                {new Date().toLocaleDateString('zh-CN', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  weekday: 'long',
                })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen((v) => !v)}
                className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-xl hover:bg-slate-50 transition-colors"
              >
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white font-medium shadow-sm">
                  <User size={18} />
                </div>
                <ChevronDown
                  size={16}
                  className={cn(
                    'text-slate-400 transition-transform duration-200',
                    userMenuOpen && 'rotate-180'
                  )}
                />
              </button>

              {userMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setUserMenuOpen(false)}
                  />
                  <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl shadow-card border border-slate-100 py-2 z-20 animate-fade-in">
                    <button
                      onClick={() => {
                        navigate('/settings');
                        setUserMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors rounded-t-xl"
                    >
                      <User size={18} className="text-slate-400" />
                      个人中心
                    </button>
                    <button
                      onClick={() => {
                        navigate('/settings');
                        setUserMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      <Settings size={18} className="text-slate-400" />
                      系统设置
                    </button>
                    <div className="my-1 h-px bg-slate-100" />
                    <button
                      onClick={() => {
                        setUserMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 rounded-b-xl transition-colors"
                    >
                      <LogOut size={18} />
                      退出登录
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-6 min-w-0">
          <div className="max-w-7xl mx-auto animate-fade-in">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

export default Layout;
