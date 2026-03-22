import { isImageFile } from '../file-utils';
import type { AttachedImage } from './types';

let imageIdCounter = 0;

export function generateImageId(): string {
  return `img-${Date.now()}-${++imageIdCounter}`;
}

export function makeAttachmentName(file: File): string {
  return file.webkitRelativePath || file.name || 'attached-file';
}

export function isLikelyImage(file: File): boolean {
  return file.type.startsWith('image/') || isImageFile(file.name);
}

export function isImageMatchVisible(file: AttachedImage): boolean {
  return typeof file.dataUrl === 'string' && file.dataUrl.length > 0;
}

export function fuzzyMatchScore(candidate: string, query: string): number {
  if (!query) return 0;
  const source = candidate.toLowerCase();
  const needle = query.toLowerCase();

  const direct = source.indexOf(needle);
  if (direct >= 0) return direct;

  let i = 0;
  for (const ch of source) {
    if (ch === needle[i]) {
      i += 1;
      if (i === needle.length) break;
    }
  }

  return i === needle.length ? 10_000 + source.length : Number.POSITIVE_INFINITY;
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(String(reader.result ?? ''));
    };
    reader.onerror = () => {
      resolve('');
    };
    reader.readAsDataURL(file);
  });
}

async function extractFilesFromEntry(entry: any): Promise<File[]> {
  if (!entry) return [];
  if (entry.isFile) {
    return new Promise((resolve) => {
      try {
        entry.file((file: File) => resolve([file]), () => resolve([]));
      } catch {
        resolve([]);
      }
    });
  }

  if (!entry.isDirectory || !entry.createReader) return [];
  const reader = entry.createReader();
  const files: File[] = [];

  while (true) {
    const batch = await new Promise<any[]>((resolve) => {
      reader.readEntries((items: any[]) => resolve(items || []), () => resolve([]));
    });
    if (!batch.length) break;
    for (const child of batch) {
      const childFiles = await extractFilesFromEntry(child);
      files.push(...childFiles);
    }
  }

  return files;
}

export async function collectFilesFromDataTransfer(dataTransfer: DataTransfer): Promise<File[]> {
  const collected: File[] = [];
  const items = Array.from(dataTransfer?.items ?? []);
  for (const item of items) {
    if (item.kind !== 'file') continue;
    const entry = (item as any).webkitGetAsEntry ? (item as any).webkitGetAsEntry() : null;
    if (entry && typeof entry === 'object') {
      const childFiles = await extractFilesFromEntry(entry);
      collected.push(...childFiles);
      continue;
    }
    const file = item.getAsFile?.();
    if (file) collected.push(file);
  }

  if (collected.length > 0) return collected;

  const fallback = Array.from(dataTransfer?.files ?? []);
  return fallback;
}
