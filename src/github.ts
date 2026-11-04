// Talks to GitHub's official contents API so the owner can edit the site's files from the browser.
import { GH_API } from './lib';

export type Cfg = { owner: string; repo: string; token: string };
export const ROOT = 'docs/'; // the folder GitHub Pages serves

export class GhError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}

const explain = (status: number, writing: boolean) => {
  if (status === 401) return 'GitHub did not accept this token. It may have expired or been copied incorrectly.';
  if (status === 403) return writing ? 'This token is not allowed to change the repository. Create it with "Contents: Read and write" for this repository.' : 'GitHub refused this request. Check the token permissions, or wait a minute and try again.';
  if (status === 404) return 'We could not find the repository or its files. Check the repository name, and that the token was created for this repository.';
  if (status === 409 || status === 422) return 'The files changed on GitHub while you were editing. Reload this page and make your changes again.';
  return `GitHub returned an error (${status}). Please try again.`;
};

async function call(cfg: Cfg, method: string, path: string, body?: unknown) {
  let res: Response;
  try {
    res = await fetch(`${GH_API}/repos/${cfg.owner}/${cfg.repo}/contents/${ROOT}${path}`, {
      method, cache: 'no-store',
      headers: { Authorization: `Bearer ${cfg.token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch { throw new GhError(0, 'We could not reach GitHub. Check your internet connection.'); }
  if (res.status === 404 && method === 'GET') return null;
  if (!res.ok) throw new GhError(res.status, explain(res.status, method !== 'GET'));
  return res.json();
}

const toB64 = (u8: Uint8Array) => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000)); return btoa(s); };
const fromB64 = (b: string) => Uint8Array.from(atob(b.replace(/\s/g, '')), (c) => c.charCodeAt(0));

export async function getJson<T>(cfg: Cfg, path: string): Promise<{ data: T; sha: string } | null> {
  const r = await call(cfg, 'GET', path);
  if (!r) return null;
  return { data: JSON.parse(new TextDecoder().decode(fromB64(r.content))), sha: r.sha };
}
export async function getSha(cfg: Cfg, path: string): Promise<string | null> {
  const r = await call(cfg, 'GET', path);
  return r ? r.sha : null;
}
export async function putJson(cfg: Cfg, path: string, data: unknown, sha: string | null, message: string) {
  const content = toB64(new TextEncoder().encode(JSON.stringify(data, null, 2) + '\n'));
  const r = await call(cfg, 'PUT', path, { message, content, ...(sha ? { sha } : {}) });
  return r.content.sha as string;
}
export async function putBlob(cfg: Cfg, path: string, blob: Blob, message: string) {
  const existing = await getSha(cfg, path);
  const content = toB64(new Uint8Array(await blob.arrayBuffer()));
  await call(cfg, 'PUT', path, { message, content, ...(existing ? { sha: existing } : {}) });
}
export async function deleteFile(cfg: Cfg, path: string, message: string) {
  const sha = await getSha(cfg, path);
  if (sha) await call(cfg, 'DELETE', path, { message, sha });
}

/* ---------- photos: shrink before upload so the site stays fast ---------- */
export async function compressImage(file: File, maxSide: number): Promise<{ blob: Blob; ext: string }> {
  if (!/^image\/(png|jpe?g|webp|gif)$/.test(file.type)) throw new Error('Please choose a PNG, JPG, WebP or GIF image.');
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => { throw new Error('This image could not be read. Try a different file.'); });
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bmp.width * scale)); canvas.height = Math.max(1, Math.round(bmp.height * scale));
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  const toBlob = (type: string, q?: number) => new Promise<Blob | null>((r) => canvas.toBlob(r, type, q));
  const webp = await toBlob('image/webp', 0.82);
  if (webp && webp.type === 'image/webp') return { blob: webp, ext: 'webp' };
  const png = file.type === 'image/png' ? await toBlob('image/png') : null;
  if (png) return { blob: png, ext: 'png' };
  const jpg = await toBlob('image/jpeg', 0.85);
  if (!jpg) throw new Error('This image could not be converted. Try a different file.');
  return { blob: jpg, ext: 'jpg' };
}

/* ---------- saved sign-in (only on the owner's own device) ---------- */
const KEY = 'fudy-admin';
export const loadCfg = (): Cfg | null => {
  for (const store of [localStorage, sessionStorage]) {
    try { const v = JSON.parse(store.getItem(KEY) || 'null'); if (v?.token) return v; } catch { /* ignore */ }
  }
  return null;
};
export const saveCfg = (cfg: Cfg, remember: boolean) => {
  clearCfg();
  try { (remember ? localStorage : sessionStorage).setItem(KEY, JSON.stringify(cfg)); } catch { /* ignore */ }
};
export const clearCfg = () => { try { localStorage.removeItem(KEY); sessionStorage.removeItem(KEY); } catch { /* ignore */ } };

/** On github.io the repository name is in the address, so we can fill it in. */
export const guessRepo = () => {
  const m = /^([^.]+)\.github\.io$/.exec(location.hostname);
  const repo = location.pathname.split('/').filter(Boolean)[0];
  return m && repo ? `${m[1]}/${repo}` : '';
};
