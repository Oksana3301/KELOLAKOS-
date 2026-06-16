'use client';

// KelolaKos · optional bukti/proof file upload (png, pdf, jpg, jpeg, svg ≤ 50MB).
// Always present (even when optional) because proof is important for the owner.

import { useEffect, useRef, useState } from 'react';
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
// Resolve a usable extension from the file name, falling back to its MIME type —
// pasted screenshots often have no real filename/extension.
function resolveExt(file: File): string {
  const e = extOf(file.name);
  if (ALLOWED_EXT.includes(e as (typeof ALLOWED_EXT)[number])) return e;
  const m = (file.type || '').toLowerCase();
  if (m === 'image/png') return 'png';
  if (m === 'image/jpeg') return 'jpg';
  if (m === 'image/svg+xml') return 'svg';
  if (m === 'application/pdf') return 'pdf';
  return e;
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
  const [dragOver, setDragOver] = useState(false);
  // Keep the latest value in a ref so the document-level paste handler always
  // appends to the current list (not a stale closure).
  const valueRef = useRef(value);
  valueRef.current = value;

  async function addFiles(files: File[]) {
    if (!files.length) return;
    setBusy(true);
    const next = [...valueRef.current];
    for (const file of files) {
      const ext = resolveExt(file);
      if (!ALLOWED_EXT.includes(ext as (typeof ALLOWED_EXT)[number])) {
        toast.error(`"${file.name || 'berkas'}" formatnya tidak didukung. Pakai PNG, PDF, JPG, JPEG, atau SVG.`);
        continue;
      }
      if (file.size > MAX_BYTES) {
        toast.error(`"${file.name || 'berkas'}" terlalu besar (maksimal 50 MB).`);
        continue;
      }
      try {
        const base64 = await readBase64(file);
        // Pasted images may have no name → give them a friendly one.
        const name = file.name || `tempel-${Date.now()}.${ext}`;
        next.push({ name, mimeType: file.type || guessMime(ext), size: file.size, base64 });
      } catch {
        toast.error(`Gagal memuat "${file.name || 'berkas'}".`);
      }
    }
    onChange(next);
    setBusy(false);
    if (inputRef.current) inputRef.current.value = '';
  }

  // Paste (Ctrl+V) anywhere while this uploader is open: grab image/file items
  // from the clipboard. Guarded so it ignores plain-text pastes and so only one
  // mounted uploader handles a given paste.
  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      if (e.defaultPrevented) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      const files: File[] = [];
      for (const it of Array.from(items)) {
        if (it.kind === 'file') {
          const f = it.getAsFile();
          if (f) files.push(f);
        }
      }
      if (!files.length) return; // plain text / nothing useful → leave it alone
      e.preventDefault();
      addFiles(files);
      toast.success('Berkas dari tempel (Ctrl+V) ditambahkan.');
    }
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer?.files || []);
    if (files.length) addFiles(files);
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
        onDragOver={(e) => {
          e.preventDefault();
          if (!dragOver) setDragOver(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setDragOver(false);
        }}
        onDrop={onDrop}
        disabled={busy}
        className={cn(
          'w-full min-h-kk-touch flex flex-col items-center justify-center gap-1 border-2 border-dashed rounded-kk-btn px-4 py-4 text-body font-body font-semibold text-kk-navy disabled:opacity-50 transition-colors',
          dragOver ? 'border-kk-navy bg-kk-mint-soft' : 'border-kk-mauve bg-white hover:border-kk-navy',
        )}
      >
        <span className="flex items-center gap-2.5">
          <KkIcon name="unduh" size={22} strokeWidth={2.2} />
          {busy
            ? 'Memuat…'
            : dragOver
            ? 'Lepaskan berkas di sini'
            : value.length > 0
            ? 'Tambah berkas lain'
            : 'Pilih berkas bukti'}
        </span>
        <span className="text-caption font-normal text-kk-ink">
          Atau seret &amp; jatuhkan ke sini, atau tempel langsung (Ctrl+V)
        </span>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        className="hidden"
        onChange={(e) => addFiles(Array.from(e.target.files || []))}
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
