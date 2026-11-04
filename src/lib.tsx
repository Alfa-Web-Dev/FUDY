import { createContext, useCallback, useContext, useEffect, useState, useSyncExternalStore } from 'react';
import type { AnchorHTMLAttributes, ReactNode } from 'react';

declare const __GH_API__: string;
export const GH_API: string = __GH_API__;

/* ---------- types ---------- */
export type Product = {
  id: string; slug: string; name: string; category: string;
  price: number; mrp: number | null; offerText: string; offerEnds: string;
  weight: string; color: string; description: string; stock: number;
  status: 'current' | 'upcoming'; featured: boolean; active: boolean; image: string; createdAt: number;
};
export type Settings = {
  storeName: string; tagline: string; announcement: string; currency: string; locale: string;
  lowStockAt: number; stockDisplay: 'exact' | 'label';
  phone: string; whatsapp: string; email: string; formEmail: string;
  address: string; hours: string; mapUrl: string; fssai: string;
  instagram: string; facebook: string; youtube: string; gallery: string[];
};
export const DEFAULT_SETTINGS: Settings = {
  storeName: 'FUDY', tagline: 'Snacks made to be shared.', announcement: '', currency: 'INR', locale: 'en-IN',
  lowStockAt: 10, stockDisplay: 'exact', phone: '', whatsapp: '', email: '', formEmail: '', address: '', hours: '', mapUrl: '',
  fssai: '', instagram: '', facebook: '', youtube: '', gallery: [],
};

/* ---------- images (admin shows not-yet-published photos from memory) ---------- */
const previews = new Map<string, string>();
export const setPreview = (path: string, url: string) => previews.set(path, url);
export const imgUrl = (path: string) => previews.get(path) || './' + path;

/* ---------- hash router (works on any static host, no server rules needed) ---------- */
const subscribe = (cb: () => void) => { window.addEventListener('hashchange', cb); return () => window.removeEventListener('hashchange', cb); };
export const useRoute = () => useSyncExternalStore(subscribe, () => location.hash.slice(1) || '/');
export const splitRoute = (route: string) => { const [path, q = ''] = route.split('?'); return { path: path.replace(/\/+$/, '') || '/', params: new URLSearchParams(q) }; };
export const goto = (to: string) => { location.hash = to; };
export const replaceQuery = (path: string, params: URLSearchParams) => { const q = params.toString(); location.replace('#' + path + (q ? '?' + q : '')); };
export function Link({ to, children, ...rest }: { to: string; children: ReactNode } & AnchorHTMLAttributes<HTMLAnchorElement>) {
  return <a href={'#' + to} {...rest}>{children}</a>;
}

/* ---------- data ---------- */
type Data = { products: Product[]; updated: string; settings: Settings };
const Ctx = createContext<Data | null>(null);
export const useData = () => useContext(Ctx)!;

const fetchJson = async (path: string) => {
  const res = await fetch(path, { cache: 'no-cache' });
  if (!res.ok) throw new Error('load failed');
  return res.json();
};

export function DataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState(false);
  const load = useCallback(async () => {
    try {
      const [p, s] = await Promise.all([fetchJson('./data/products.json'), fetchJson('./data/settings.json')]);
      setData({ products: (p.products || []).filter((x: Product) => x.active !== false), updated: p.updated || '', settings: { ...DEFAULT_SETTINGS, ...s } });
      setError(false);
    } catch { setError(true); }
  }, []);
  useEffect(() => { load(); }, [load]);
  if (error) return <div className="boot"><p>We could not load the products. Check your connection and try again.</p><button className="btn btn-red" onClick={load}>Try again</button></div>;
  if (!data) return <div className="boot" aria-busy="true"><img src="./fudy-logo.png" alt="FUDY" width="160" /></div>;
  return <Ctx.Provider value={data}>{children}</Ctx.Provider>;
}

/* ---------- pricing, offers, stock ---------- */
export type View = Product & { pct: number; onOffer: boolean };

/** What a visitor should see today. An offer that has passed its end date disappears and the price returns to the original price. */
export function view(p: Product, now = Date.now()): View {
  const ends = p.offerEnds ? new Date(p.offerEnds + 'T23:59:59').getTime() : null;
  const expired = ends !== null && ends < now;
  const hasMrp = !!p.mrp && p.mrp > p.price;
  const price = hasMrp && expired ? (p.mrp as number) : p.price;
  const mrp = hasMrp && !expired ? p.mrp : null;
  const offerText = expired ? '' : p.offerText;
  const pct = mrp ? Math.round(((mrp - price) / mrp) * 100) : 0;
  return { ...p, price, mrp, offerText, offerEnds: expired ? '' : p.offerEnds, pct, onOffer: !!(mrp || offerText) };
}

export function stockInfo(p: Product, s: Settings): { label: string; tone: 'ok' | 'low' | 'out' | 'soon' } {
  if (p.status === 'upcoming') return { label: 'Coming soon', tone: 'soon' };
  if (p.stock <= 0) return { label: 'Out of stock', tone: 'out' };
  if (p.stock <= s.lowStockAt) return { label: `Only ${p.stock} left`, tone: 'low' };
  return { label: s.stockDisplay === 'exact' ? `In stock, ${p.stock} packs` : 'In stock', tone: 'ok' };
}

export function useMoney() {
  const { settings } = useData();
  return (n: number) => {
    try { return new Intl.NumberFormat(settings.locale, { style: 'currency', currency: settings.currency, minimumFractionDigits: Number.isInteger(n) ? 0 : 2 }).format(n); }
    catch { return `${settings.currency} ${n}`; }
  };
}

export const fmtDate = (iso: string, withTime = false) => {
  const d = iso.length <= 10 ? new Date(iso + 'T00:00:00') : new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, withTime ? { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' } : { day: 'numeric', month: 'short', year: 'numeric' });
};

export function useTitle(title: string) {
  const { settings } = useData();
  useEffect(() => { document.title = title ? `${title} | ${settings.storeName}` : `${settings.storeName}: ${settings.tagline}`; }, [title, settings]);
}

/* ---------- contact links ---------- */
export const telHref = (phone: string) => 'tel:' + phone.replace(/[^\d+]/g, '');
export const waHref = (number: string, text: string) => `https://wa.me/${number.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`;
export const mapsHref = (s: Settings) => s.mapUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.address)}`;
