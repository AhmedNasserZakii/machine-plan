'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useId,
} from 'react';
import {
  type DefaultValues,
  type FieldValues,
  FormProvider,
  type Path,
  type SubmitHandler,
  useForm,
  type UseFormReturn,
} from 'react-hook-form';
import type { z } from 'zod';

import { ApiError } from '@/lib/api/client';
import { cn } from '@/lib/utils';

type AppFormContextValue = {
  formId: string;
  pending: boolean;
};

const AppFormContext = createContext<AppFormContextValue | null>(null);

export function useAppFormContext() {
  const ctx = useContext(AppFormContext);
  if (!ctx) throw new Error('Form fields must be used inside AppForm');
  return ctx;
}

export function useOptionalAppFormContext() {
  return useContext(AppFormContext);
}

type AppFormProps<TSchema extends z.ZodTypeAny> = {
  schema: TSchema;
  defaultValues: DefaultValues<z.infer<TSchema>>;
  onSubmit: (values: z.infer<TSchema>) => Promise<void> | void;
  children: ReactNode | ((form: UseFormReturn<z.infer<TSchema>>) => ReactNode);
  className?: string;
  /** Enable beforeunload + in-app link click confirmation when dirty. */
  dirtyGuard?: boolean;
  id?: string;
};

function applyServerFieldErrors<T extends FieldValues>(
  form: UseFormReturn<T>,
  error: ApiError,
) {
  if (!error.details?.length) return;
  for (const detail of error.details) {
    if (!detail.field) continue;
    form.setError(detail.field as Path<T>, {
      type: 'server',
      message: detail.constraint ?? error.message,
    });
  }
}

export function AppForm<TSchema extends z.ZodTypeAny>({
  schema,
  defaultValues,
  onSubmit,
  children,
  className,
  dirtyGuard = true,
  id,
}: AppFormProps<TSchema>) {
  const t = useTranslations();
  const reactId = useId();
  const formId = id ?? reactId;
  const form = useForm<z.infer<TSchema>>({
    resolver: zodResolver(schema),
    defaultValues,
  });

  const pending = form.formState.isSubmitting;
  const isDirty = form.formState.isDirty;

  useEffect(() => {
    if (!dirtyGuard || !isDirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirtyGuard, isDirty]);

  useEffect(() => {
    if (!dirtyGuard || !isDirty) return;
    const onClick = (e: MouseEvent) => {
      const target = e.target as Element | null;
      const anchor = target?.closest?.('a[href]');
      if (!anchor) return;
      if (anchor.getAttribute('target') === '_blank') return;
      if (!window.confirm(t('web.form.dirtyLeave'))) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [dirtyGuard, isDirty, t]);

  const handleSubmit: SubmitHandler<z.infer<TSchema>> = async (values) => {
    try {
      await onSubmit(values);
      form.reset(values);
    } catch (error) {
      if (error instanceof ApiError) {
        applyServerFieldErrors(form, error);
        if (!error.details?.length) {
          form.setError('root', { message: error.message });
        }
        return;
      }
      throw error;
    }
  };

  return (
    <FormProvider {...form}>
      <AppFormContext.Provider value={{ formId, pending }}>
        <form
          id={formId}
          className={cn('space-y-lg', className)}
          onSubmit={form.handleSubmit(handleSubmit)}
          noValidate
        >
          {typeof children === 'function' ? children(form) : children}
        </form>
      </AppFormContext.Provider>
    </FormProvider>
  );
}

export { applyServerFieldErrors };
