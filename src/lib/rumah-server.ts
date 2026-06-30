// Top Hills · /rumah — helper SERVER-SIDE untuk memanggil Apps Script.
// Dipakai hanya di route handlers (app/api/rumah/*). Memakai format dispatch
// yang sama dengan callApi publik: { apiKey, action, data }.

const APPS_URL = process.env.NEXT_PUBLIC_APPS_SCRIPT_URL || '';
const APPS_KEY = process.env.NEXT_PUBLIC_APPS_SCRIPT_API_KEY || '';

export interface AppsResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export async function callAppsScript<T = unknown>(
  action: string,
  data: Record<string, unknown> = {},
): Promise<AppsResult<T>> {
  if (!APPS_URL || !APPS_KEY) {
    return { ok: false, error: 'CONFIG', message: 'Apps Script URL/API key belum di-set.' };
  }
  try {
    const res = await fetch(APPS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ apiKey: APPS_KEY, action, data }),
      redirect: 'follow',
      cache: 'no-store',
    });
    if (!res.ok) return { ok: false, error: 'HTTP_' + res.status, message: 'HTTP ' + res.status };
    return (await res.json()) as AppsResult<T>;
  } catch (e) {
    return { ok: false, error: 'NETWORK', message: (e as Error).message || 'Gagal menghubungi server.' };
  }
}

export const TH_SESSION_COOKIE = 'th_session';
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 hari
