import type { BuktiFile } from '@/lib/api';

function rawBase64(file: File): Promise<BuktiFile> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const res = String(r.result || '');
      const base64 = res.includes(',') ? res.split(',')[1] : res;
      resolve({ name: file.name, mimeType: file.type || 'application/octet-stream', size: base64.length, base64 });
    };
    r.onerror = () => reject(new Error('Gagal membaca berkas'));
    r.readAsDataURL(file);
  });
}

/** Gambar → di-resize & dikompres jadi BuktiFile (JPEG). Non-gambar → base64 apa adanya. */
export async function fileToBukti(file: File, max = 1280, quality = 0.82): Promise<BuktiFile> {
  if (!file.type.startsWith('image/')) return rawBase64(file);
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Gagal membaca berkas'));
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > max || height > max) {
          const r = Math.min(max / width, max / height);
          width = Math.round(width * r);
          height = Math.round(height * r);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Canvas tidak didukung'));
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => reject(new Error('File bukan gambar yang valid'));
      img.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
  });
  const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
  return { name: file.name.replace(/\.[^.]+$/, '') + '.jpg', mimeType: 'image/jpeg', size: base64.length, base64 };
}
