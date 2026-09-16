import { api } from './client';
import { endpoints } from './endpoints';

const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.8;

export type UploadProgress = (loaded: number, total: number) => void;

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read image'));
    };
    image.src = url;
  });
}

export async function compressImage(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/')) return file;
  const image = await loadImage(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(image.width, image.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return file;
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY),
  );
  return blob ?? file;
}

function putWithProgress(url: string, blob: Blob, contentType: string, onProgress?: UploadProgress) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', contentType);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(event.loaded, event.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload failed (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error('Upload failed'));
    xhr.send(blob);
  });
}

export async function uploadMedia(options: {
  file: File;
  purpose: string;
  idempotencyKey: string;
  onProgress?: UploadProgress;
}): Promise<{ id: string }> {
  const blob = options.file.type.startsWith('image/')
    ? await compressImage(options.file)
    : options.file;

  const presign = await api.post<{
    uploadUrl: string;
    mediaId: string;
    headers?: Record<string, string>;
  }>(
    endpoints.media.presign,
    {
      purpose: options.purpose,
      contentType: blob.type || options.file.type,
      byteSize: blob.size,
    },
    options.idempotencyKey,
  );

  await putWithProgress(
    presign.data.uploadUrl,
    blob,
    blob.type || options.file.type,
    options.onProgress,
  );

  const confirmed = await api.post<{ id: string }>(
    endpoints.media.confirm,
    { mediaId: presign.data.mediaId },
    `${options.idempotencyKey}:confirm`,
  );
  return { id: confirmed.data.id };
}
