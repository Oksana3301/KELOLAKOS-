'use client';

// KelolaKos · reassuring confirmation dialogs (payment / delete).
// Presentational only — caller wires the real mutation via onConfirm.

import { Dialog, KkButton } from './ui';
import { KkIcon } from './icons';
import { rupiah } from './status';

export function PaymentConfirm({
  open,
  name,
  amount,
  loading,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  name: string;
  amount: number;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Dialog open={open}>
      <div className="w-14 h-14 rounded-full bg-kk-mint-soft text-kk-green grid place-items-center mx-auto mb-4">
        <KkIcon name="cek" size={32} />
      </div>
      <h3 className="font-heading font-bold text-subhead text-center m-0 mb-2">Tandai sudah lunas?</h3>
      <p className="text-body text-kk-ink text-center mt-0 mb-6 leading-snug">
        Pembayaran dari <b className="text-kk-navy">{name}</b> sebesar{' '}
        <b className="text-kk-navy">{rupiah(amount)}</b> akan dicatat sebagai lunas.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <KkButton variant="secondary" onClick={onCancel} disabled={loading}>
          Nanti Dulu
        </KkButton>
        <KkButton variant="success" onClick={onConfirm} disabled={loading}>
          {loading ? 'Menyimpan…' : 'Ya, Lunas'}
        </KkButton>
      </div>
    </Dialog>
  );
}

export function DeleteConfirm({
  open,
  title = 'Hapus data ini?',
  message,
  confirmLabel = 'Ya, Hapus',
  loading,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title?: string;
  message: React.ReactNode;
  confirmLabel?: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Dialog open={open}>
      <div className="w-14 h-14 rounded-full bg-kk-orange-soft text-kk-orange grid place-items-center mx-auto mb-4">
        <KkIcon name="hapus" size={30} />
      </div>
      <h3 className="font-heading font-bold text-subhead text-center m-0 mb-2">{title}</h3>
      <p className="text-body text-kk-ink text-center mt-0 mb-6 leading-snug">{message}</p>
      <div className="grid grid-cols-2 gap-3">
        <KkButton variant="secondary" onClick={onCancel} disabled={loading}>
          Tidak Jadi
        </KkButton>
        <KkButton variant="primary" onClick={onConfirm} disabled={loading}>
          {loading ? 'Menghapus…' : confirmLabel}
        </KkButton>
      </div>
    </Dialog>
  );
}
