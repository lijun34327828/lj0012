import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface TabItem {
  key: string;
  label: ReactNode;
  icon?: ReactNode;
  disabled?: boolean;
}

export interface TabsProps {
  tabs?: TabItem[];
  activeKey: string;
  onChange: (key: string) => void;
  variant?: 'line' | 'card';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  tabClassName?: string;
  children?: ReactNode;
}

export interface TabsListProps {
  variant?: 'line' | 'card';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  children?: ReactNode;
}

export interface TabsTriggerProps {
  value: string;
  activeKey: string;
  onChange: (key: string) => void;
  disabled?: boolean;
  icon?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'line' | 'card';
  className?: string;
  children?: ReactNode;
}

const sizeClasses = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-5 py-2.5 text-base',
  lg: 'px-6 py-3 text-lg',
};

export function TabsList({
  variant = 'line',
  className,
  children,
}: TabsListProps) {
  if (variant === 'card') {
    return (
      <div className={cn('inline-flex bg-slate-100 rounded-xl p-1', className)}>
        {children}
      </div>
    );
  }

  return (
    <div className={cn('flex border-b border-slate-200 gap-1', className)}>
      {children}
    </div>
  );
}

export function TabsTrigger({
  value,
  activeKey,
  onChange,
  disabled,
  icon,
  size = 'md',
  variant = 'line',
  className,
  children,
}: TabsTriggerProps) {
  const isActive = value === activeKey;

  if (variant === 'card') {
    return (
      <button
        disabled={disabled}
        onClick={() => !disabled && onChange(value)}
        className={cn(
          'flex items-center gap-2 rounded-lg font-medium transition-all duration-200',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          sizeClasses[size],
          isActive
            ? 'bg-white text-brand-600 shadow-sm'
            : 'text-slate-500 hover:text-slate-700',
          className
        )}
      >
        {icon && <span className="shrink-0">{icon}</span>}
        {children}
      </button>
    );
  }

  return (
    <button
      disabled={disabled}
      onClick={() => !disabled && onChange(value)}
      className={cn(
        'relative flex items-center gap-2 font-medium transition-all duration-200 -mb-px',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        sizeClasses[size],
        isActive
          ? 'text-brand-600'
          : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-t-lg',
        className
      )}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      {children}
      {isActive && (
        <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-brand-500 rounded-full" />
      )}
    </button>
  );
}

export function Tabs({
  tabs,
  activeKey,
  onChange,
  variant = 'line',
  size = 'md',
  className,
  tabClassName,
  children,
}: TabsProps) {
  if (children) {
    return <>{children}</>;
  }

  if (!tabs) return null;

  if (variant === 'card') {
    return (
      <div className={cn('inline-flex bg-slate-100 rounded-xl p-1', className)}>
        {tabs.map((tab) => {
          const isActive = tab.key === activeKey;
          return (
            <button
              key={tab.key}
              disabled={tab.disabled}
              onClick={() => !tab.disabled && onChange(tab.key)}
              className={cn(
                'flex items-center gap-2 rounded-lg font-medium transition-all duration-200',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                sizeClasses[size],
                isActive
                  ? 'bg-white text-brand-600 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700',
                tabClassName
              )}
            >
              {tab.icon && <span className="shrink-0">{tab.icon}</span>}
              {tab.label}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className={cn('flex border-b border-slate-200 gap-1', className)}>
      {tabs.map((tab) => {
        const isActive = tab.key === activeKey;
        return (
          <button
            key={tab.key}
            disabled={tab.disabled}
            onClick={() => !tab.disabled && onChange(tab.key)}
            className={cn(
              'relative flex items-center gap-2 font-medium transition-all duration-200 -mb-px',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              sizeClasses[size],
              isActive
                ? 'text-brand-600'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-t-lg',
              tabClassName
            )}
          >
            {tab.icon && <span className="shrink-0">{tab.icon}</span>}
            {tab.label}
            {isActive && (
              <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-brand-500 rounded-full" />
            )}
          </button>
        );
      })}
    </div>
  );
}

export default Tabs;
