/**
 * Image Export Utility — convert DOM element to PNG.
 *
 * - downloadAsPNG: download to user's filesystem
 * - copyToClipboard: copy as image (paste-able to WhatsApp Web, Email, dll)
 *
 * Uses html2canvas (dynamic import for tree-shaking).
 */

interface ExportOptions {
  /** Element to capture */
  element: HTMLElement;
  /** Filename (without .png extension) */
  filename?: string;
  /** Scale factor for quality (default 2 = retina) */
  scale?: number;
  /** Background color (default white). Pass null for a transparent PNG. */
  backgroundColor?: string | null;
}

async function captureToBlob({
  element,
  scale = 2,
  backgroundColor = '#ffffff',
}: Omit<ExportOptions, 'filename'>): Promise<Blob> {
  // Dynamic import (html2canvas ~70KB)
  const html2canvas = (await import('html2canvas')).default;

  const canvas = await html2canvas(element, {
    scale,
    backgroundColor,
    useCORS: true,
    logging: false,
    // Higher quality settings
    imageTimeout: 15000,
    removeContainer: true,
  });

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Failed to create image blob'));
      },
      'image/png',
      1.0,
    );
  });
}

/**
 * Download captured element as PNG file
 */
export async function downloadAsPNG(options: ExportOptions): Promise<void> {
  const blob = await captureToBlob(options);
  const filename = options.filename || `kelolakos-${Date.now()}`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  // Cleanup after a tick
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

/**
 * Copy captured element to clipboard as image
 * (paste-able to WhatsApp Web, email, etc.)
 *
 * Note: requires HTTPS or localhost. Falls back to download if clipboard API unavailable.
 */
export async function copyAsPNGToClipboard(
  options: Omit<ExportOptions, 'filename'>,
): Promise<{ method: 'clipboard' | 'download' }> {
  const blob = await captureToBlob(options);

  // Try clipboard first
  if (
    typeof navigator !== 'undefined' &&
    navigator.clipboard &&
    typeof (window as { ClipboardItem?: unknown }).ClipboardItem !== 'undefined'
  ) {
    try {
      const ClipboardItemCtor = (window as unknown as { ClipboardItem: new (data: Record<string, Blob>) => unknown }).ClipboardItem;
      const item = new ClipboardItemCtor({ 'image/png': blob });
      await navigator.clipboard.write([item as never]);
      return { method: 'clipboard' };
    } catch (e) {
      console.warn('Clipboard write failed, falling back to download:', e);
    }
  }

  // Fallback: trigger download
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `kelolakos-${Date.now()}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 100);

  return { method: 'download' };
}
