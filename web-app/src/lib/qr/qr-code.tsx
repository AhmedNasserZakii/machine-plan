'use client';

import { useMemo } from 'react';

import { cn } from '@/lib/utils';

import { encodeQrMatrix, qrMatrixToSvg } from './encode';

type QrCodeProps = {
  value: string;
  size?: number;
  title?: string;
  className?: string;
};

export function QrCode({ value, size = 160, title, className }: QrCodeProps) {
  const svg = useMemo(() => {
    const matrix = encodeQrMatrix(value);
    return qrMatrixToSvg(matrix, { size, margin: 2 });
  }, [value, size]);

  return (
    <span
      className={cn('inline-block bg-surface', className)}
      dir="ltr"
      role="img"
      aria-label={title ?? value}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

export function qrSvgDataUrl(value: string, size = 200): string {
  const matrix = encodeQrMatrix(value);
  const svg = qrMatrixToSvg(matrix, { size, margin: 2 });
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
