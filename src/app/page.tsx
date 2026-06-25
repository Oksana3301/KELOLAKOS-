import { redirect } from 'next/navigation';

// Root domain → halaman publik /info (bukan dashboard).
// Dashboard owner pindah ke /beranda.
export default function RootPage() {
  redirect('/info');
}
