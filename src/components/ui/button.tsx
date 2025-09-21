import React from 'react';
import { cn } from '../../lib/utils';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
  size?: 'sm' | 'md' | 'lg';
}

export function Button({ 
  className, 
  variant = 'default', 
  size = 'md', 
  children, 
  ...props 
}: ButtonProps) {
  const baseClasses = 'inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none';
  
  const variants = {
    default: 'bg-editor-bg-glass-tertiary backdrop-blur-xl text-editor-text-primary hover:bg-editor-interactive-hover border border-editor-border-tertiary hover:border-editor-border-secondary',
    outline: 'border border-editor-border-tertiary bg-editor-bg-glass-secondary backdrop-blur-xl text-editor-text-primary hover:bg-editor-interactive-hover hover:border-editor-border-secondary',
    ghost: 'text-editor-text-primary hover:bg-editor-interactive-hover',
    secondary: 'bg-editor-bg-glass-secondary backdrop-blur-xl text-editor-text-secondary hover:bg-editor-interactive-hover border border-editor-border-tertiary',
  };
  
  const sizes = {
    sm: 'h-8 px-3 text-sm',
    md: 'h-10 px-4 py-2',
    lg: 'h-12 px-6 text-lg',
  };

  return (
    <button
      className={cn(baseClasses, variants[variant], sizes[size], className)}
      {...props}
    >
      {children}
    </button>
  );
}


