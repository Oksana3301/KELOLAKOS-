'use client';

// KelolaKos · optional bukti/proof file upload (png, pdf, jpg, jpeg, svg ≤ 50MB).
// Always present (even when optional) because proof is important for the owner.

import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { KkIcon } from './icons';
import { cn } from '@/lib/utils';
import type { BuktiFile } from '@/lib/api';

const MAX_BYTES = 50 * 1024 * 1024; // 50 MB
const ALLOWED_EXT = ['png', 'pdf', 'jpg', 'jpeg', 'svg'] as const;
const ACCEPT = '.png,.pdf,.jpg,.jpeg,.svg,image/png,image/jpeg,image/svg+xml,application/pdf';

function extOf(name: string) {
  return (name.split('.').pop() || '').toLowerCase();
}
function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
function guessMime(ext: string) {
  return (
    {
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      svg: 'image/svg+xml',
      pdf: 'application/pdf',
    }[ext] || 'application/octet-stream'
  );
}
function readBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const res = String(r.result || '');
      // strip the "data:<mime>;base64," prefix → raw base64
      resolve(res.includes(',') ? res.split(',')[1] : res);
    };
    r.onerror = () => reject(new Error('Gagal membaca berkas'));
    r.readAsDataURL(file);
  });
}

export function FileUpload({
  value,
  onChange,
  label = 'Bukti pembayaran',
  optional = true,
}: {
  value: BuktiFile[];
  onChange: (files: BuktiFile[]) => void;
  label?: string;
  optional?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function addFiles(list: FileList | null) {
    if (!list || list.length === 0) return;
    setBusy(true);
    const next = [...value];
    for (const file of Array.from(list)) {
      const ext = extOf(file.name);
      if (!ALLOWED_EXT.includes(ext as (typeof ALLOWED_EXT)[number])) {
        toast.error(`"${file.name}" formatnya tidak didukung. Pakai PNG, PDF, JPG, JPEG, atau SVG.`);
        continue;
      }
      if (file.size > MAX_BYTES) {
        toast.error(`"${file.name}" terlalu besar (maksimal 50 MB).`);
        continue;
      }
      try {
        const base64 = await readBase64(file);
        next.push({ name: file.name, mimeType: file.type || guessMime(ext), size: file.size, base64 });
      } catch {
        toast.error(`Gagal memuat "${file.name}".`);
      }
    }
    onChange(next);
    setBusy(false);
    if (inputRef.current) inputRef.current.value = '';
  }

  function remove(i: number) {
    onChange(value.filter((_, idx) => idx !== i));
  }

  return (
    <div className="mb-5">
      <div className="flex items-baseline gap-2 mb-1">
        <label className="kk-label mb-0">{label}</label>
        {optional && <span className="text-caption text-kk-ink">(opsional)</span>}
      </div>
      <p className="kk-help mb-2">
        Boleh dilewati. Foto/scan struk, transfer, atau dokumen — PNG, PDF, JPG, JPEG, SVG (maks. 50 MB).
      </p>

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="w-full min-h-kk-touch flex items-center justify-center gap-2.5 border-2 border-dashed border-kk-mauve rounded-kk-btn px-4 py-3 text-body font-body font-semibold text-kk-navy bg-white hover:border-kk-navy disabled:opacity-50"
      >
        <KkIcon name="unduh" size={22} strokeWidth={2.2} />
        {busy ? 'Memuat…' : value.length > 0 ? 'Tambah berkas lain' : 'Pilih berkas bukti'}
      </button>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        className="hidden"
        onChange={(e) => addFiles(e.target.files)}
      />

      {value.length > 0 && (
        <ul className="mt-3 space-y-2">
          {value.map((f, i) => (
            <li
              key={i}
              className="flex items-center gap-3 bg-kk-mauve-soft border-2 border-kk-mauve rounded-kk-btn px-3 py-2.5"
            >
              <span className="flex-shrink-0 w-9 h-9 rounded-[10px] bg-white text-kk-navy grid place-items-center">
                <KkIcon name={extOf(f.name) === 'pdf' ? 'kwitansi' : 'fasilitas'} size={20} strokeWidth={2.2} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-body font-semibold text-[17px] text-kk-navy break-words">{f.name}</div>
                <div className="text-caption text-kk-ink">{fmtSize(f.size)}</div>
              </div>
              <button
                type="button"
                onClick={() => remove(i)}
                aria-label={`Hapus ${f.name}`}
                className="flex-shrink-0 w-10 h-10 rounded-[10px] border-2 border-kk-mauve bg-white text-kk-ink grid place-items-center hover:text-kk-orange hover:border-kk-orange"
              >
                <KkIcon name="silang" size={20} strokeWidth={2.2} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
