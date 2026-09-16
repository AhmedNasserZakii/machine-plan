'use client';

import type { ReactNode } from 'react';
import { type FieldValues, type Path,useFormContext } from 'react-hook-form';

import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

type FieldShellProps = {
  name: string;
  label?: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
  hint?: string;
};

export function FieldShell({ name, label, required, className, children, hint }: FieldShellProps) {
  const {
    formState: { errors },
  } = useFormContext<FieldValues>();
  const error = errors[name as Path<FieldValues>];
  const message = error && typeof error === 'object' && 'message' in error ? String(error.message) : null;

  return (
    <div className={cn('space-y-xs', className)}>
      {label ? (
        <Label htmlFor={name}>
          {label}
          {required ? <span className="text-danger"> *</span> : null}
        </Label>
      ) : null}
      {children}
      {hint && !message ? <p className="t-caption text-text-secondary">{hint}</p> : null}
      {message ? (
        <p className="t-caption text-danger" role="alert">
          {message}
        </p>
      ) : null}
    </div>
  );
}
