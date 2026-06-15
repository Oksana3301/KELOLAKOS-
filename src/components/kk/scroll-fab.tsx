'use client';

// KelolaKos · floating scroll button (bottom-right). For long lists (many
// rooms) so elderly users can jump to the bottom (and back to top) easily.
// Scrolls the window by default, or a given scroll container.

import { useEffect, useState } from 'react';
import { KkIcon } from './icons';
import { cn } from '@/lib/utils';

export function ScrollFab({
  containerRef,
  className,
}: {
  /** Optional scroll container (e.g. a bottom-sheet body). Defaults to window. */
  containerRef?: React.RefObject<HTMLElement>;
  className?: string;
}) {
  const [atBottom, setAtBottom] = useState(false);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const el = containerRef?.current;
    function metrics() {
      if (el) {
        return { top: el.scrollTop, vh: el.clientHeight, full: el.scrollHeight };
      }
      const doc = document.documentElement;
      return { top: window.scrollY, vh: window.innerHeight, full: doc.scrollHeight };
    }
    function onScroll() {
      const { top, vh, full } = metrics();
      setShow(full - vh > 240); // only when there's meaningful scrolling
      setAtBottom(top + vh >= full - 80);
    }
    onScroll();
    const target: Window | HTMLElement = el || window;
    target.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      target.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [containerRef]);

  function go() {
    const el = containerRef?.current;
    const toBottom = !atBottom;
    if (el) {
      el.scrollTo({ top: toBottom ? el.scrollHeight : 0, behavior: 'smooth' });
    } else {
      window.scrollTo({ top: toBottom ? document.documentElement.scrollHeight : 0, behavior: 'smooth' });
    }
  }

  if (!show) return null;

  return (
    <button
      onClick={go}
      aria-label={atBottom ? 'Ke atas' : 'Ke bawah'}
      className={cn(
        'fixed z-40 right-5 bottom-24 min-[900px]:bottom-8 w-14 h-14 rounded-full bg-kk-navy text-white grid place-items-center shadow-[0_6px_18px_rgba(12,44,71,.35)] active:translate-y-0.5',
        className,
      )}
    >
      <KkIcon name={atBottom ? 'panahAtas' : 'chevron'} size={28} strokeWidth={2.4} className={atBottom ? '' : 'rotate-90'} />
    </button>
  );
}
