import { useEffect, useState } from 'react';
import { Link, imgUrl, mapsHref, stockInfo, telHref, useData, useMoney, useRoute, view, waHref } from './lib';
import type { Product } from './lib';

/* ---------- brand swoosh (echoes the two arcs in the FUDY logo) ---------- */
export function Swoosh({ className = '', color = '#FFC20E', flip = false }: { className?: string; color?: string; flip?: boolean }) {
  return (
    <svg className={className} viewBox="0 0 800 220" preserveAspectRatio="none" aria-hidden="true" style={flip ? { transform: 'scaleY(-1)' } : undefined}>
      <path d="M10 190 C200 60 560 -10 760 70 C800 88 806 140 790 200 C770 120 420 100 10 190 Z" fill={color} />
    </svg>
  );
}

/* ---------- pack illustration, used until a real photo is uploaded ---------- */
const lum = (hex: string) => { const n = parseInt((hex || '#E4000F').slice(1), 16); return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255; };
const wrap = (name: string, max = 11) => {
  const out: string[] = [];
  for (const w of name.toUpperCase().split(/\s+/).filter(Boolean)) {
    const last = out[out.length - 1];
    if (last && (last + ' ' + w).length <= max) out[out.length - 1] = last + ' ' + w; else out.push(w);
  }
  return out.slice(0, 4);
};

export function PackArt({ product }: { product: Pick<Product, 'name' | 'color' | 'weight' | 'image' | 'id'> }) {
  if (product.image) return <img className="pack-photo" src={imgUrl(product.image)} alt={product.name} loading="lazy" decoding="async" />;
  const c = product.color || '#E4000F';
  const light = lum(c) > 0.6;
  const ink = light ? '#000' : '#fff';
  const accent = light ? '#000' : '#FFC20E';
  const lines = wrap(product.name || 'Product');
  const longest = Math.max(1, ...lines.map((l) => l.length));
  const size = Math.max(22, Math.min(46, 196 / (longest * 0.66)));
  const startY = 215 - ((lines.length - 1) * size * 1.02) / 2;
  const id = 'p' + String(product.id).replace(/\W/g, '');
  return (
    <svg className="pack" viewBox="0 0 300 400" role="img" aria-label={product.name}>
      <defs>
        <clipPath id={id}><path d="M44 30 C120 42 180 42 256 30 L272 368 C190 354 110 354 28 368 Z" /></clipPath>
        <linearGradient id={id + 'g'} x1="0" x2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".28" /><stop offset=".22" stopColor="#fff" stopOpacity="0" />
          <stop offset=".8" stopColor="#000" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity=".22" />
        </linearGradient>
        <pattern id={id + 'c'} width="9" height="10" patternUnits="userSpaceOnUse"><rect width="4" height="10" fill="#000" opacity=".2" /></pattern>
      </defs>
      <ellipse cx="150" cy="374" rx="104" ry="6" fill="#000" opacity=".18" />
      <g clipPath={`url(#${id})`}>
        <rect width="300" height="400" fill={c} />
        <path d="M-10 250 C80 150 200 110 330 150 L330 200 C210 170 90 220 -10 300 Z" fill={accent} opacity={light ? 0.12 : 1} />
        <path d="M-10 330 C100 290 220 280 330 240 L330 262 C230 310 110 330 -10 360 Z" fill={ink} opacity=".9" />
        <rect y="20" width="300" height="46" fill={`url(#${id}c)`} />
        <rect y="334" width="300" height="46" fill={`url(#${id}c)`} />
        <rect width="300" height="400" fill={`url(#${id}g)`} />
        <text x="150" y="104" textAnchor="middle" fontSize="30" fontWeight="900" fontStyle="italic" letterSpacing="-1" fill={ink} transform="skewX(-6) translate(14 0)">FUDY</text>
        {lines.map((l, i) => <text key={i} x="150" y={startY + i * size * 1.02} textAnchor="middle" fontSize={size} fontWeight="900" letterSpacing="-1.2" fill={ink}>{l}</text>)}
        {product.weight && <text x="150" y="326" textAnchor="middle" fontSize="15" fontWeight="700" fill={light ? '#fff' : '#000'}>{product.weight}</text>}
      </g>
    </svg>
  );
}

/* ---------- header ---------- */
const NAV: [string, string][] = [['/products', 'Products'], ['/deals', 'Deals'], ['/find-us', 'Find us'], ['/about', 'About'], ['/contact', 'Contact']];

export function Header() {
  const { settings } = useData();
  const route = useRoute();
  const [menu, setMenu] = useState(false);
  useEffect(() => { setMenu(false); }, [route]);
  return (
    <>
      {settings.announcement && <div className="announce">{settings.announcement}</div>}
      <header className="header">
        <div className="wrap header-in">
          <Link to="/" className="brand" aria-label={`${settings.storeName} home`}><img src="./fudy-logo.png" alt={settings.storeName} /></Link>
          <nav className={`nav ${menu ? 'open' : ''}`} aria-label="Main">
            {NAV.map(([to, label]) => <Link key={to} to={to} className={route.startsWith(to) ? 'active' : ''}>{label}</Link>)}
          </nav>
          <div className="header-actions">
            {settings.phone && <a className="call-btn" href={telHref(settings.phone)}>Call us</a>}
            <button className="menu-btn" onClick={() => setMenu(!menu)} aria-expanded={menu} aria-label="Menu"><span /><span /></button>
          </div>
        </div>
      </header>
    </>
  );
}

/* ---------- footer ---------- */
export function Footer() {
  const { settings, products } = useData();
  const cats = [...new Set(products.map((p) => p.category))].slice(0, 6);
  const socials = [['Instagram', settings.instagram], ['Facebook', settings.facebook], ['YouTube', settings.youtube]].filter(([, u]) => u);
  return (
    <footer className="footer">
      <div className="wrap footer-grid">
        <div className="footer-brand">
          <img src="./fudy-logo.png" alt={settings.storeName} />
          <p>{settings.tagline}</p>
          {settings.fssai && <p className="fssai">FSSAI License No. {settings.fssai}</p>}
        </div>
        <div>
          <h4>Products</h4>
          <ul>
            <li><Link to="/products">All products</Link></li>
            {cats.map((c) => <li key={c}><Link to={`/products?category=${encodeURIComponent(c)}`}>{c}</Link></li>)}
          </ul>
        </div>
        <div>
          <h4>Explore</h4>
          <ul>
            <li><Link to="/deals">Deals</Link></li>
            <li><Link to="/find-us">Find us</Link></li>
            <li><Link to="/about">About {settings.storeName}</Link></li>
            <li><Link to="/contact">Contact</Link></li>
          </ul>
        </div>
        <div>
          <h4>Get in touch</h4>
          <ul className="plain">
            {settings.email && <li><a href={`mailto:${settings.email}`}>{settings.email}</a></li>}
            {settings.phone && <li><a href={telHref(settings.phone)}>{settings.phone}</a></li>}
            {settings.address && <li>{settings.address}</li>}
            {socials.map(([n, u]) => <li key={n}><a href={u} target="_blank" rel="noopener noreferrer">{n}</a></li>)}
          </ul>
        </div>
      </div>
      <div className="wrap footer-base">
        <span>© {new Date().getFullYear()} {settings.storeName}. All rights reserved.</span>
        <Link to="/admin">Owner login</Link>
      </div>
    </footer>
  );
}

/* ---------- product card ---------- */
export function StockLine({ p }: { p: Product }) {
  const { settings } = useData();
  const s = stockInfo(p, settings);
  return <p className={`stock-line ${s.tone}`}>{s.label}</p>;
}

export function PriceLine({ p, large = false }: { p: ReturnType<typeof view>; large?: boolean }) {
  const money = useMoney();
  return (
    <p className={`price ${large ? 'price-lg' : ''}`}>
      {p.status === 'upcoming' && !p.price ? 'Price soon' : money(p.price)}
      {p.mrp ? <s>{money(p.mrp)}</s> : null}
      {p.pct > 0 && <span className="off">{p.pct}% off</span>}
    </p>
  );
}

export function ProductCard({ product }: { product: Product }) {
  const p = view(product);
  const soon = p.status === 'upcoming';
  return (
    <article className="card">
      <Link to={`/products/${p.slug}`} className="card-media" aria-label={p.name}>
        <PackArt product={p} />
        {soon ? <span className="tag tag-dark">Coming soon</span> : p.stock <= 0 ? <span className="tag tag-dark">Out of stock</span> : p.pct > 0 ? <span className="tag tag-red">{p.pct}% off</span> : p.offerText ? <span className="tag tag-red">Offer</span> : null}
      </Link>
      <div className="card-body">
        <h3><Link to={`/products/${p.slug}`}>{p.name}</Link></h3>
        <p className="muted">{p.category}{p.weight ? `, ${p.weight}` : ''}</p>
        <PriceLine p={p} />
        {p.offerText && <p className="offer-line">{p.offerText}</p>}
        <StockLine p={p} />
      </div>
    </article>
  );
}

/* ---------- where to find it ---------- */
export function FindBox({ product }: { product?: Product }) {
  const { settings } = useData();
  const msg = product ? `Hi ${settings.storeName}, is ${product.name} available?` : `Hi ${settings.storeName}, I would like to know more about your products.`;
  return (
    <div className="find-box">
      <h3>Pick it up from our stock point</h3>
      {settings.address && <p>{settings.address}</p>}
      {settings.hours && <p className="muted">{settings.hours}</p>}
      <div className="row">
        {settings.address && <a className="btn btn-red" href={mapsHref(settings)} target="_blank" rel="noopener noreferrer">Get directions</a>}
        {settings.phone && <a className="btn btn-black" href={telHref(settings.phone)}>Call</a>}
        {settings.whatsapp && <a className="btn btn-ghost-dark" href={waHref(settings.whatsapp, msg)} target="_blank" rel="noopener noreferrer">Check on WhatsApp</a>}
      </div>
    </div>
  );
}
