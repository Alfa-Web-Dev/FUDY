import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, fmtDate, goto, imgUrl, replaceQuery, splitRoute, stockInfo, useData, useMoney, useRoute, useTitle, view } from './lib';
import type { Product } from './lib';
import { FindBox, PackArt, PriceLine, ProductCard, StockLine, Swoosh } from './components';

const current = (ps: Product[]) => ps.filter((p) => p.status !== 'upcoming');

/* ================= HOME ================= */
export function Home() {
  useTitle('');
  const { products, settings } = useData();
  const money = useMoney();
  const now = current(products);
  const upcoming = products.filter((p) => p.status === 'upcoming');
  const featured = now.filter((p) => p.featured && p.stock > 0);
  const hero = (featured.length >= 3 ? featured : now.filter((p) => p.stock > 0)).slice(0, 3);
  const prices = useMemo(() => {
    const m = new Map<number, number>();
    now.forEach((p) => { const v = view(p).price; m.set(v, (m.get(v) || 0) + 1); });
    return [...m.entries()].sort((a, b) => a[0] - b[0]);
  }, [products]);
  const deals = now.map(view).filter((p) => p.onOffer).sort((a, b) => b.pct - a.pct).slice(0, 4);
  const picks = [...featured, ...now.filter((p) => !featured.includes(p))].slice(0, 8);

  return (
    <>
      <section className="hero">
        <div className="wrap hero-grid">
          <div className="hero-copy">
            <h1>Crunch worth sharing.</h1>
            <p>Explore the {settings.storeName} snack range, spot the best deals and find where to pick them up.</p>
            <div className="row">
              <Link to="/products" className="btn btn-red btn-lg">Explore products</Link>
              <Link to="/deals" className="btn btn-ghost btn-lg">See deals</Link>
            </div>
          </div>
          <div className="hero-packs" aria-label="Featured products">
            <Swoosh className="hero-swoosh top" />
            <Swoosh className="hero-swoosh bottom" color="#E4000F" flip />
            {hero.map((p, i) => <Link key={p.id} to={`/products/${p.slug}`} className={`hp hp-${i}`} aria-label={p.name}><PackArt product={p} /></Link>)}
          </div>
        </div>
      </section>

      {prices.length > 0 && (
        <section className="section">
          <div className="wrap">
            <h2 className="h-section">Browse by price</h2>
            <ul className="cat-list">
              {prices.map(([price, n]) => (
                <li key={price}><Link to={`/products?price=${price}`}><span>{money(price)} packs</span><em>{n} {n === 1 ? 'product' : 'products'}</em></Link></li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {deals.length > 0 && (
        <section className="section section-tint">
          <div className="wrap">
            <div className="section-head"><h2 className="h-section">Deals right now</h2><Link to="/deals" className="text-link">See all deals</Link></div>
            <div className="grid">{deals.map((p) => <ProductCard key={p.id} product={p} />)}</div>
          </div>
        </section>
      )}

      <section className="section">
        <div className="wrap">
          <div className="section-head"><h2 className="h-section">Our range</h2><Link to="/products" className="text-link">See all products</Link></div>
          <div className="grid">{picks.map((p) => <ProductCard key={p.id} product={p} />)}</div>
        </div>
      </section>

      {upcoming.length > 0 && (
        <section className="section section-tint">
          <div className="wrap">
            <div className="section-head"><h2 className="h-section">Coming soon</h2><Link to="/products?tab=upcoming" className="text-link">See what is next</Link></div>
            <div className="grid">{upcoming.slice(0, 4).map((p) => <ProductCard key={p.id} product={p} />)}</div>
          </div>
        </section>
      )}

      <section className="statement">
        <div className="wrap">
          <p>Good snacks make any moment better. We make them for the table, the road and everything in between.</p>
          <Link to="/about" className="btn btn-ghost">About {settings.storeName}</Link>
        </div>
      </section>

      <section className="section"><div className="wrap"><FindBox /></div></section>
    </>
  );
}

/* ================= PRODUCTS ================= */
export function Products() {
  useTitle('Products');
  const { products, updated } = useData();
  const money = useMoney();
  const route = useRoute();
  const { path, params } = splitRoute(route);
  const tab = params.get('tab') === 'upcoming' ? 'upcoming' : 'current';
  const price = params.get('price') || '';
  const category = params.get('category') || '';
  const q = params.get('q') || '';
  const sort = params.get('sort') || 'featured';
  const set = (k: string, v: string) => { const n = new URLSearchParams(params); if (v) n.set(k, v); else n.delete(k); replaceQuery(path, n); };

  const inTab = products.filter((p) => (tab === 'upcoming' ? p.status === 'upcoming' : p.status !== 'upcoming')).map(view);
  const prices = [...new Set(inTab.map((p) => p.price))].filter((n) => n > 0).sort((a, b) => a - b);
  const cats = [...new Set(inTab.map((p) => p.category))];
  const list = inTab
    .filter((p) => (!price || String(p.price) === price) && (!category || p.category === category) && (!q || (p.name + ' ' + p.category + ' ' + p.description).toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => sort === 'price-asc' ? a.price - b.price : sort === 'price-desc' ? b.price - a.price : sort === 'discount' ? b.pct - a.pct : sort === 'name' ? a.name.localeCompare(b.name) : Number(b.featured) - Number(a.featured));

  return (
    <div className="wrap page">
      <div className="page-head">
        <h1>{tab === 'upcoming' ? 'Coming soon' : 'Products'}</h1>
        <p className="muted">{list.length} {list.length === 1 ? 'product' : 'products'}{updated ? `. Stock updated ${fmtDate(updated)}` : ''}</p>
      </div>
      <div className="tabs-row" role="tablist">
        <button role="tab" aria-selected={tab === 'current'} className={tab === 'current' ? 'on' : ''} onClick={() => replaceQuery(path, new URLSearchParams())}>Available now</button>
        <button role="tab" aria-selected={tab === 'upcoming'} className={tab === 'upcoming' ? 'on' : ''} onClick={() => replaceQuery(path, new URLSearchParams({ tab: 'upcoming' }))}>Coming soon</button>
      </div>
      <div className="toolbar">
        <div className="chips" role="group" aria-label="Filter by price">
          <button className={!price ? 'on' : ''} onClick={() => set('price', '')}>All prices</button>
          {prices.map((n) => <button key={n} className={price === String(n) ? 'on' : ''} onClick={() => set('price', String(n))}>{money(n)}</button>)}
        </div>
        <div className="tools">
          <input type="search" placeholder="Search products" aria-label="Search products" value={q} onChange={(e) => set('q', e.target.value)} />
          <select aria-label="Sort products" value={sort} onChange={(e) => set('sort', e.target.value)}>
            <option value="featured">Featured first</option><option value="price-asc">Price, low to high</option><option value="price-desc">Price, high to low</option>
            <option value="discount">Biggest discount</option><option value="name">Name</option>
          </select>
        </div>
      </div>
      {cats.length > 1 && (
        <div className="chips sub" role="group" aria-label="Filter by category">
          <button className={!category ? 'on' : ''} onClick={() => set('category', '')}>All categories</button>
          {cats.map((c) => <button key={c} className={category === c ? 'on' : ''} onClick={() => set('category', c)}>{c}</button>)}
        </div>
      )}
      {list.length ? <div className="grid">{list.map((p) => <ProductCard key={p.id} product={p} />)}</div> : (
        <div className="empty"><p>No products match these filters.</p><button className="btn btn-black" onClick={() => replaceQuery(path, new URLSearchParams())}>Clear filters</button></div>
      )}
    </div>
  );
}

/* ================= PRODUCT DETAIL ================= */
export function ProductPage({ slug }: { slug: string }) {
  const { products, settings, updated } = useData();
  const money = useMoney();
  const raw = products.find((x) => x.slug === slug);
  useTitle(raw?.name || 'Product not found');
  if (!raw) return <div className="wrap page empty"><h1>Product not found</h1><p>It may have been removed.</p><Link to="/products" className="btn btn-black">Back to products</Link></div>;
  const p = view(raw);
  const related = products.filter((x) => x.category === p.category && x.id !== p.id && x.status === p.status).slice(0, 4);
  const s = stockInfo(raw, settings);
  return (
    <div className="wrap page">
      <nav className="crumbs" aria-label="Breadcrumb"><Link to="/products">Products</Link><span>/</span><Link to={`/products?category=${encodeURIComponent(p.category)}`}>{p.category}</Link></nav>
      <div className="pdp">
        <div className="pdp-media"><PackArt product={p} /></div>
        <div className="pdp-info">
          <h1>{p.name}</h1>
          <PriceLine p={p} large />
          {p.mrp && <p className="save">You save {money(p.mrp - p.price)} on every pack.</p>}
          {p.offerText && <div className="offer-box"><b>{p.offerText}</b>{p.offerEnds && <span>Offer ends {fmtDate(p.offerEnds)}</span>}</div>}
          <p className="desc">{p.description}</p>
          <div className={`stock ${s.tone}`}><b>{s.label}</b>{updated && p.status !== 'upcoming' && <span>Stock updated {fmtDate(updated)}</span>}</div>
          <dl className="facts">
            {p.weight && <div><dt>Pack size</dt><dd>{p.weight}</dd></div>}
            <div><dt>Category</dt><dd>{p.category}</dd></div>
          </dl>
        </div>
      </div>
      <div className="pdp-find"><FindBox product={raw} /></div>
      {related.length > 0 && <section className="related"><h2 className="h-section">More from {p.category}</h2><div className="grid">{related.map((r) => <ProductCard key={r.id} product={r} />)}</div></section>}
    </div>
  );
}

/* ================= DEALS ================= */
export function Deals() {
  useTitle('Deals');
  const { products } = useData();
  const list = current(products).map(view).filter((p) => p.onOffer).sort((a, b) => b.pct - a.pct);
  return (
    <div className="wrap page">
      <div className="page-head"><h1>Deals</h1><p className="muted">Offers on right now. Ask for these at our stock point.</p></div>
      {list.length ? <div className="grid">{list.map((p) => <ProductCard key={p.id} product={p} />)}</div> : (
        <div className="empty"><p>No offers at the moment. Check back soon.</p><Link to="/products" className="btn btn-black">See all products</Link></div>
      )}
    </div>
  );
}

/* ================= FIND US ================= */
export function FindUs() {
  useTitle('Find us');
  const { settings } = useData();
  return (
    <div className="wrap page narrow">
      <div className="page-head"><h1>Find us</h1><p className="muted">Our products are available at our stock point. Visit us to pick up your snacks.</p></div>
      <FindBox />
      <dl className="facts wide">
        {settings.address && <div><dt>Address</dt><dd>{settings.address}</dd></div>}
        {settings.hours && <div><dt>Opening hours</dt><dd>{settings.hours}</dd></div>}
        {settings.phone && <div><dt>Phone</dt><dd><a href={`tel:${settings.phone.replace(/[^\d+]/g, '')}`}>{settings.phone}</a></dd></div>}
        {settings.email && <div><dt>Email</dt><dd><a href={`mailto:${settings.email}`}>{settings.email}</a></dd></div>}
      </dl>
      <p className="muted small">Stock changes during the day. Call before you visit to confirm a product is available.</p>
    </div>
  );
}

/* ================= ABOUT ================= */
export function About() {
  const { settings } = useData();
  useTitle('About');
  return (
    <>
      <section className="statement tall"><div className="wrap"><h1>We make snacks people pass around.</h1></div></section>
      <section className="section">
        <div className="wrap prose">
          <p>{settings.storeName} started with a simple idea: a good snack should be easy to find and easy to share. Replace this text with your own story, your founding year and what makes your recipes different.</p>
          <p>Browse the range, check what is in stock and visit us to pick up your favourites.</p>
          <Link to="/products" className="btn btn-red">Explore products</Link>
        </div>
      </section>
      {settings.gallery.length > 0 && (
        <section className="section section-tint">
          <div className="wrap">
            <h2 className="h-section">Gallery</h2>
            <div className="gallery">{settings.gallery.map((g) => <img key={g} src={imgUrl(g)} alt="" loading="lazy" decoding="async" />)}</div>
          </div>
        </section>
      )}
    </>
  );
}

/* ================= CONTACT ================= */
export function Contact() {
  const { settings } = useData();
  useTitle('Contact');
  const [kind, setKind] = useState('customer');
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState('');
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setError('');
    const f = Object.fromEntries(new FormData(e.currentTarget).entries()) as Record<string, string>;
    if (f.website) return; // hidden field: only bots fill it in
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(settings.formEmail)) { setError(`The contact form is not set up yet. Please email us at ${settings.email}.`); return; }
    setState('sending');
    try {
      const res = await fetch(`https://formsubmit.co/ajax/${settings.formEmail}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ _subject: `${settings.storeName} website: ${kind === 'retailer' ? 'retailer enquiry' : 'message'} from ${f.name}`, _template: 'table', _captcha: 'false', _replyto: f.email, ...f, website: undefined, type: kind === 'retailer' ? 'Retailer or distributor enquiry' : 'Customer message' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === 'false' || data.success === false) throw new Error('failed');
      setState('sent');
    } catch { setState('idle'); setError(`We could not send your message. Please try again, or email us at ${settings.email}.`); }
  };
  return (
    <div className="wrap page">
      <div className="page-head"><h1>Contact us</h1></div>
      <div className="contact-grid">
        {state === 'sent' ? <div className="thanks"><h2>Message sent.</h2><p>Thank you. We will reply soon.</p></div> : (
          <form className="form-card" onSubmit={submit}>
            {error && <div className="alert" role="alert">{error}</div>}
            <label className="field"><span>I am a</span>
              <select value={kind} onChange={(e) => setKind(e.target.value)}><option value="customer">Customer with a question</option><option value="retailer">Retailer or distributor</option></select>
            </label>
            <label className="field"><span>Your name</span><input name="name" required autoComplete="name" /></label>
            <div className="fields">
              <label className="field"><span>Email</span><input name="email" type="email" required autoComplete="email" /></label>
              <label className="field"><span>Phone <em>(optional)</em></span><input name="phone" type="tel" autoComplete="tel" /></label>
            </div>
            {kind === 'retailer' && (
              <div className="fields">
                <label className="field"><span>Shop name</span><input name="shop" required /></label>
                <label className="field"><span>City</span><input name="city" required /></label>
                <label className="field span"><span>Monthly requirement <em>(optional)</em></span><input name="requirement" placeholder="e.g. 20 boxes a month" /></label>
              </div>
            )}
            <label className="field"><span>Message</span><textarea name="message" rows={5} required /></label>
            <input name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hp-field" />
            <button className="btn btn-red btn-lg" disabled={state === 'sending'}>{state === 'sending' ? 'Sending' : 'Send message'}</button>
          </form>
        )}
        <div className="contact-info">
          {settings.email && <><h3>Email</h3><p><a href={`mailto:${settings.email}`}>{settings.email}</a></p></>}
          {settings.phone && <><h3>Phone</h3><p><a href={`tel:${settings.phone.replace(/[^\d+]/g, '')}`}>{settings.phone}</a></p></>}
          {settings.address && <><h3>Address</h3><p>{settings.address}</p></>}
          {settings.hours && <><h3>Hours</h3><p>{settings.hours}</p></>}
        </div>
      </div>
    </div>
  );
}
