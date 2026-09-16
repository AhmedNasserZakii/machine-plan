'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api/client';
import { endpoints } from '@/lib/api/endpoints';
import type { Schema } from '@/lib/api/types';

type LookupResult = Schema<'MachineLookupResponse'>;

type WebScannerProps = {
  onMatch: (result: LookupResult) => void;
  continuous?: boolean;
  className?: string;
};

type BarcodeDetectorLike = {
  detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue?: string }>>;
};

function getBarcodeDetector(): (new (opts?: { formats?: string[] }) => BarcodeDetectorLike) | null {
  if (typeof window === 'undefined') return null;
  return (window as unknown as { BarcodeDetector?: new (opts?: { formats?: string[] }) => BarcodeDetectorLike })
    .BarcodeDetector ?? null;
}

export function WebScanner({ onMatch, continuous = false, className }: WebScannerProps) {
  const t = useTranslations();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [manual, setManual] = useState('');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [matchedOn, setMatchedOn] = useState<LookupResult['matchedOn'] | null>(null);
  const [seen, setSeen] = useState<string[]>([]);
  const Detector = getBarcodeDetector();

  const lookup = useCallback(
    async (code: string) => {
      const trimmed = code.trim();
      if (!trimmed) return;
      if (continuous && seen.includes(trimmed)) {
        toast.message(t('web.scanning.duplicate'));
        return;
      }
      try {
        const result = await api.get<LookupResult>(endpoints.machines.lookup, { code: trimmed });
        setMatchedOn(result.data.matchedOn);
        if (continuous) setSeen((prev) => [...prev, trimmed]);
        onMatch(result.data);
        if (!continuous) setManual('');
      } catch {
        toast.error(t('web.scanning.notFound'));
      }
    },
    [continuous, onMatch, seen, t],
  );

  useEffect(() => {
    if (!Detector || !scanning) return;
    let stream: MediaStream | null = null;
    let cancelled = false;
    let raf = 0;
    const detector = new Detector({ formats: ['qr_code', 'code_128', 'ean_13'] });

    const tick = async () => {
      if (cancelled) return;
      const video = videoRef.current;
      if (video && video.readyState >= 2) {
        try {
          const codes = await detector.detect(video);
          const value = codes[0]?.rawValue;
          if (value) await lookup(value);
        } catch {
          // ignore frame errors
        }
      }
      raf = window.setTimeout(() => void tick(), 500);
    };

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        void tick();
      } catch {
        setCameraError(t('web.scanning.cameraDenied'));
        setScanning(false);
      }
    })();

    return () => {
      cancelled = true;
      window.clearTimeout(raf);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [Detector, lookup, scanning, t]);

  return (
    <div className={className}>
      <div className="space-y-sm">
        <Label htmlFor="web-scanner-manual">{t('web.scanning.manualLabel')}</Label>
        <div className="flex gap-sm">
          <Input
            id="web-scanner-manual"
            dir="ltr"
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void lookup(manual);
              }
            }}
            placeholder={t('web.scanning.manualPlaceholder')}
          />
          <Button type="button" onClick={() => void lookup(manual)}>
            {t('web.scanning.lookup')}
          </Button>
        </div>
        {matchedOn ? (
          <p className="t-caption text-text-secondary">
            {t('web.scanning.matchedOn', {
              field: t(`web.machines.matchedOn.${matchedOn}` as 'web.machines.matchedOn.MACHINE'),
            })}
          </p>
        ) : null}
      </div>

      <div className="mt-md space-y-sm">
        {Detector ? (
          <>
            <Button type="button" variant="outline" onClick={() => setScanning((v) => !v)}>
              {scanning ? t('web.scanning.stopCamera') : t('web.scanning.startCamera')}
            </Button>
            {scanning ? (
              <video ref={videoRef} className="aspect-video w-full rounded-md bg-background object-cover" muted playsInline />
            ) : null}
          </>
        ) : (
          <p className="t-caption text-text-secondary">{t('web.scanning.noBarcodeDetector')}</p>
        )}
        {cameraError ? <p className="t-caption text-danger">{cameraError}</p> : null}
      </div>

      {continuous && seen.length ? (
        <ul className="mt-md space-y-xs rounded-md border border-border p-sm">
          {seen.map((code) => (
            <li key={code} className="t-mono" dir="ltr">
              {code}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
