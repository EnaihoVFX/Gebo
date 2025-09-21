import React from 'react';
import { cn } from '../../lib/utils';

interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline';
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  const variants = {
    default: 'bg-editor-bg-glass-tertiary backdrop-blur-xl text-editor-text-primary hover:bg-editor-interactive-hover border border-editor-border-tertiary',
    secondary: 'bg-editor-bg-glass-secondary backdrop-blur-xl text-editor-text-secondary hover:bg-editor-interactive-hover border border-editor-border-tertiary',
    destructive: 'bg-editor-status-error text-white hover:bg-red-700 border border-red-600',
    outline: 'border border-editor-border-tertiary text-editor-text-primary hover:bg-editor-interactive-hover',
  };

  return (
    <div
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
        variants[variant],
        className
      )}
      {...props}
    />
  );
}


