import React from 'react';
import { cn } from '../../lib/utils';

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

export function Textarea({ className, ...props }: TextareaProps) {
  return (
    <textarea
      className={cn(
        'flex min-h-[80px] w-full rounded-md border border-editor-border-tertiary bg-editor-bg-canvas px-3 py-2 text-sm placeholder:text-editor-text-muted focus:outline-none focus:ring-2 focus:ring-editor-border-accent focus:border-editor-border-accent disabled:cursor-not-allowed disabled:opacity-50 text-editor-text-primary',
        className
      )}
      {...props}
    />
  );
}


