import { type ReactNode } from 'react';
import { Inbox } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  iconClassName?: string;
}

const sizeConfig = {
  sm: {
    wrapper: 'py-8 gap-3',
    icon: 'w-12 h-12 mb-1',
    title: 'text-base',
    desc: 'text-sm',
  },
  md: {
    wrapper: 'py-12 gap-4',
    icon: 'w-16 h-16 mb-2',
    title: 'text-lg',
    desc: 'text-sm',
  },
  lg: {
    wrapper: 'py-20 gap-6',
    icon: 'w-24 h-24 mb-4',
    title: 'text-2xl',
    desc: 'text-base',
  },
};

export function EmptyState({
  icon,
  title,
  description,
  action,
  size = 'md',
  className,
  iconClassName,
}: EmptyStateProps) {
  const config = sizeConfig[size];

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center px-6',
        config.wrapper,
        className
      )}
    >
      <div
        className={cn(
          'flex items-center justify-center rounded-2xl bg-slate-100 text-slate-400',
          config.icon,
          iconClassName
        )}
      >
        {icon || <Inbox className="w-1/2 h-1/2" strokeWidth={1.5} />}
      </div>
      <div className="space-y-2">
        <h3 className={cn('font-semibold text-slate-700', config.title)}>{title}</h3>
        {description && (
          <p className={cn('text-slate-500 max-w-md mx-auto leading-relaxed', config.desc)}>
            {description}
          </p>
        )}
      </div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export default EmptyState;
