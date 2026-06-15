'use client';

// KelolaKos · per-page Help "?" bottom sheet (ported from app/modals.jsx → HelpSheet).
// Plain-language tips + a WhatsApp prompt.

import { Sheet, SheetHead, KkButton } from './ui';
import { KkIcon } from './icons';

export interface HelpContent {
  title: string;
  tips: string[];
}

export function HelpSheet({
  open,
  onClose,
  content,
  supportWa = process.env.NEXT_PUBLIC_SUPPORT_WA || '62895610524580',
}: {
  open: boolean;
  onClose: () => void;
  content: HelpContent | null;
  supportWa?: string;
}) {
  if (!content) return null;
  return (
    <Sheet open={open} onClose={onClose}>
      <SheetHead title={`Tentang ${content.title}`} onClose={onClose} />
      <div className="px-6 pb-7">
        <div className="space-y-3 mb-6">
          {content.tips.map((tip, i) => (
            <div key={i} className="flex gap-3.5 items-start">
              <div className="flex-shrink-0 w-9 h-9 rounded-full bg-kk-mint-soft border-2 border-kk-mint text-kk-navy grid place-items-center font-heading font-black text-[18px]">
                {i + 1}
              </div>
              <p className="text-body text-kk-navy m-0 leading-snug pt-0.5">{tip}</p>
            </div>
          ))}
        </div>

        <div className="bg-kk-mint-soft border-2 border-kk-mint rounded-kk-card p-4 mb-4 flex items-start gap-3">
          <KkIcon name="bantuan" size={26} className="text-kk-navy flex-shrink-0 mt-0.5" />
          <p className="text-body text-kk-navy m-0 leading-snug">
            Masih bingung? Hubungi kami lewat WhatsApp, kami bantu dengan senang hati.
          </p>
        </div>

        <a
          href={`https://wa.me/${supportWa}?text=Halo,%20saya%20butuh%20bantuan%20KelolaKos`}
          target="_blank"
          rel="noopener noreferrer"
          className="block"
        >
          <KkButton variant="success" block>
            <KkIcon name="kirim" size={22} /> Chat lewat WhatsApp
          </KkButton>
        </a>
      </div>
    </Sheet>
  );
}
