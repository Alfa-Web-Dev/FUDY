import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { DEFAULT_SETTINGS, Link, setPreview, stockInfo, useMoney } from './lib';
import type { Product, Settings } from './lib';
import { PackArt } from './components';
import { GhError, clearCfg, compressImage, deleteFile, getJson, getSha, guessRepo, loadCfg, putBlob, putJson, saveCfg } from './github';
import type { Cfg } from './github';

const slugify = (s: string) => s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'product';
const rid = () => Math.random().toString(36).slice(2, 10);

export function Admin() {
  const [cfg, setCfg] = useState<Cfg | null>(() => loadCfg());
  useEffect(() => { document.title = 'Owner login'; }, []);
  return cfg ? <Editor cfg={cfg} onSignOut={() => { clearCfg(); setCfg(null); }} /> : <Login onDone={setCfg} />;
}

/* ================= LOGIN ================= */
function Login({ onDone }: { onDone: (c: Cfg) => void }) {
  const [repo, setRepo] = useState(guessRepo());
  const [token, setToken] = useState('');
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setError('');
    const m = /^\s*([\w.-]+)\/([\w.-]+)\s*$/.exec(repo);
    if (!m) { setError('Enter the repository as owner/name, for example fudy-owner/fudy-site.'); return; }
    const cfg = { owner: m[1], repo: m[2], token: token.trim() };
    setBusy(true);
    try {
      const r = await getJson(cfg, 'data/settings.json');
      if (!r) throw new GhError(404, 'We could not find docs/data/settings.json in that repository. Check the repository name.');
      saveCfg(cfg, remember); onDone(cfg);
    } catch (err: any) { setError(err.message); setBusy(false); }
  };
  return (
    <div className="wrap page narrow">
      <div className="page-head"><h1>Owner login</h1><p className="muted">Only the store owner can change products. Sign in with your GitHub access token.</p></div>
      <form className="form-card" onSubmit={submit}>
        {error && <div className="alert" role="alert">{error}</div>}
        <label className="field"><span>Repository</span><input value={repo} onChange={(e) => setRepo(e.target.value)} placeholder="owner/fudy-site" required autoCapitalize="none" spellCheck={false} /></label>
        <label className="field"><span>Access token</span><input type="password" value={token} onChange={(e) => setToken(e.target.value)} required autoComplete="off" placeholder="github_pat_..." /></label>
        <label className="check"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Keep me signed in on this device</label>
        <button className="btn btn-black btn-lg" disabled={busy}>{busy ? 'Checking' : 'Sign in'}</button>
        <p className="muted small">Your token stays in this browser and is only sent to GitHub. Do not tick "keep me signed in" on a shared computer.</p>
      </form>
    </div>
  );
}

/* ================= EDITOR ================= */
type Loaded = { products: Product[]; settings: Settings; pSha: string; sSha: string; used: string[] };

function Editor({ cfg, onSignOut }: { cfg: Cfg; onSignOut: () => void }) {
  const [orig, setOrig] = useState<Loaded | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [tab, setTab] = useState('products');
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const pending = useRef(new Map<string, Blob>());

  const load = async () => {
    setLoadError('');
    try {
      const [p, s] = await Promise.all([getJson<{ products: Product[] }>(cfg, 'data/products.json'), getJson<Settings>(cfg, 'data/settings.json')]);
      if (!p || !s) throw new GhError(404, 'The data files were not found in docs/data. Check the repository.');
      const st = { ...DEFAULT_SETTINGS, ...s.data };
      const list = p.data.products || [];
      setOrig({ products: list, settings: st, pSha: p.sha, sSha: s.sha, used: usedImages(list, st) });
      setProducts(list); setSettings(st); pending.current.clear();
    } catch (e: any) {
      if (e instanceof GhError && e.status === 401) { clearCfg(); onSignOut(); return; }
      setLoadError(e.message);
    }
  };
  useEffect(() => { load(); }, []);

  const dirty = !!orig && JSON.stringify([products, settings]) !== JSON.stringify([orig.products, orig.settings]);
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', h); return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  const addImage = async (file: File, folder: 'products' | 'gallery', maxSide: number) => {
    const { blob, ext } = await compressImage(file, maxSide);
    const path = `images/${folder}/${rid()}.${ext}`;
    pending.current.set(path, blob); setPreview(path, URL.createObjectURL(blob));
    return path;
  };

  const publish = async () => {
    if (!orig) return;
    setBusy(true); setNotice(null);
    try {
      const used = new Set(usedImages(products, settings));
      for (const [path, blob] of pending.current) if (used.has(path)) await putBlob(cfg, path, blob, 'Add photo');
      let { pSha, sSha } = orig;
      if (JSON.stringify(products) !== JSON.stringify(orig.products)) {
        if ((await getSha(cfg, 'data/products.json')) !== orig.pSha) throw new GhError(409, '');
        pSha = await putJson(cfg, 'data/products.json', { updated: new Date().toISOString(), products }, orig.pSha, 'Update products');
      }
      if (JSON.stringify(settings) !== JSON.stringify(orig.settings)) {
        if ((await getSha(cfg, 'data/settings.json')) !== orig.sSha) throw new GhError(409, '');
        sSha = await putJson(cfg, 'data/settings.json', settings, orig.sSha, 'Update settings');
      }
      for (const old of orig.used) if (!used.has(old)) { try { await deleteFile(cfg, old, 'Remove unused photo'); } catch { /* not critical */ } }
      pending.current.clear();
      setOrig({ products, settings, pSha, sSha, used: [...used] });
      setNotice({ kind: 'ok', text: 'Published. Your site will show these changes in about 1 to 2 minutes.' });
    } catch (e: any) {
      setNotice({ kind: 'error', text: e instanceof GhError && e.status === 409 ? 'The files changed on GitHub while you were editing. Reload this page and make your changes again.' : e.message || 'Something went wrong. Please try again.' });
    }
    setBusy(false);
  };

  const discard = () => { if (confirm('Throw away all unpublished changes?')) { pending.current.clear(); setProducts(orig!.products); setSettings(orig!.settings); setNotice(null); } };

  if (loadError) return <div className="wrap page narrow"><div className="alert">{loadError}</div><div className="row" style={{ marginTop: 16 }}><button className="btn btn-black" onClick={load}>Try again</button><button className="btn btn-ghost-dark" onClick={onSignOut}>Sign out</button></div></div>;
  if (!orig) return <div className="wrap page"><p className="muted">Loading your products</p></div>;

  const changes = countChanges(orig.products, products) + (JSON.stringify(settings) !== JSON.stringify(orig.settings) ? 1 : 0);
  const tabs: [string, string][] = [['products', `Products (${products.length})`], ['gallery', 'Gallery'], ['settings', 'Store details'], ['help', 'Help']];
  return (
    <div className="wrap page admin">
      <div className="page-head row-between">
        <h1>Owner admin</h1>
        <div className="row"><Link to="/" className="btn btn-sm btn-ghost-dark">View site</Link><button className="btn btn-sm btn-black" onClick={onSignOut}>Sign out</button></div>
      </div>
      <div className="tabs" role="tablist">{tabs.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}</div>
      {tab === 'products' && <ProductsTab products={products} setProducts={setProducts} settings={settings} addImage={addImage} />}
      {tab === 'gallery' && <GalleryTab settings={settings} setSettings={setSettings} addImage={addImage} />}
      {tab === 'settings' && <SettingsTab settings={settings} setSettings={setSettings} />}
      {tab === 'help' && <Help />}
      <div className={`publish ${dirty || notice ? 'show' : ''}`} role="status">
        {notice && !dirty ? <p className={notice.kind === 'ok' ? 'ok-text' : 'err-text'}>{notice.text}</p> : (
          <>
            <p>{notice?.kind === 'error' ? <span className="err-text">{notice.text}</span> : <><b>{changes} unpublished {changes === 1 ? 'change' : 'changes'}.</b> Visitors will not see them until you publish.</>}</p>
            <div className="row"><button className="btn btn-ghost" onClick={discard} disabled={busy}>Discard</button><button className="btn btn-red" onClick={publish} disabled={busy}>{busy ? 'Publishing' : 'Publish changes'}</button></div>
          </>
        )}
      </div>
    </div>
  );
}

const usedImages = (ps: Product[], s: Settings) => [...new Set([...ps.map((p) => p.image), ...s.gallery].filter(Boolean))];
const countChanges = (a: Product[], b: Product[]) => {
  const am = new Map(a.map((p) => [p.id, JSON.stringify(p)])); let n = 0;
  for (const p of b) if (am.get(p.id) !== JSON.stringify(p)) n++;
  for (const p of a) if (!b.some((x) => x.id === p.id)) n++;
  return n;
};

/* ================= PRODUCTS TAB ================= */
type AddImage = (f: File, folder: 'products' | 'gallery', maxSide: number) => Promise<string>;

function ProductsTab({ products, setProducts, settings, addImage }: { products: Product[]; setProducts: (p: Product[]) => void; settings: Settings; addImage: AddImage }) {
  const money = useMoney();
  const [editing, setEditing] = useState<Partial<Product> | null>(null);
  const [q, setQ] = useState('');
  const list = products.filter((p) => (p.name + p.category).toLowerCase().includes(q.toLowerCase()));
  const patch = (id: string, ch: Partial<Product>) => setProducts(products.map((p) => (p.id === id ? { ...p, ...ch } : p)));
  const remove = (p: Product) => { if (confirm(`Remove "${p.name}" from the site? You can still discard this before publishing.`)) setProducts(products.filter((x) => x.id !== p.id)); };
  return (
    <>
      <div className="row-between bar">
        <input type="search" placeholder="Search products" aria-label="Search products" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn btn-red" onClick={() => setEditing({ color: '#E4000F', stock: 100, status: 'current', active: true, featured: false, category: '', mrp: null })}>Add product</button>
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Product</th><th>Price</th><th>Stock</th><th>Status</th><th /></tr></thead>
          <tbody>
            {list.map((p) => {
              const s = stockInfo(p, settings);
              return (
                <tr key={p.id} className={p.active ? '' : 'dim'}>
                  <td><div className="cell-prod"><div className="thumb sm"><PackArt product={p} /></div><div><b>{p.name}</b><small>{p.category}{p.weight ? `, ${p.weight}` : ''}</small></div></div></td>
                  <td>{money(p.price)}{p.mrp ? <small>was {money(p.mrp)}{p.offerEnds ? `, ends ${p.offerEnds}` : ''}</small> : p.offerText ? <small>{p.offerText}</small> : null}</td>
                  <td>
                    <div className="stepper sm" role="group" aria-label={`Stock for ${p.name}`}>
                      <button onClick={() => patch(p.id, { stock: Math.max(0, p.stock - 1) })} aria-label="Decrease stock">−</button>
                      <input type="number" min="0" value={p.stock} onChange={(e) => patch(p.id, { stock: Math.max(0, Math.floor(Number(e.target.value) || 0)) })} aria-label="Stock" />
                      <button onClick={() => patch(p.id, { stock: p.stock + 1 })} aria-label="Increase stock">+</button>
                    </div>
                    <small className={`stock-line ${s.tone}`}>{s.label}</small>
                  </td>
                  <td>{!p.active ? 'Hidden' : p.status === 'upcoming' ? 'Coming soon' : p.featured ? 'Live, featured' : 'Live'}</td>
                  <td className="actions">
                    <button className="link-btn" onClick={() => setEditing(p)}>Edit</button>
                    <button className="link-btn" onClick={() => patch(p.id, { active: !p.active })}>{p.active ? 'Hide' : 'Show'}</button>
                    <button className="link-btn danger" onClick={() => remove(p)}>Delete</button>
                  </td>
                </tr>
              );
            })}
            {!list.length && <tr><td colSpan={5} className="muted">No products found.</td></tr>}
          </tbody>
        </table>
      </div>
      {editing && <ProductForm p={editing} all={products} addImage={addImage} onClose={() => setEditing(null)} onSave={(prod) => { setProducts(products.some((x) => x.id === prod.id) ? products.map((x) => (x.id === prod.id ? prod : x)) : [prod, ...products]); setEditing(null); }} />}
    </>
  );
}

function ProductForm({ p, all, addImage, onClose, onSave }: { p: Partial<Product>; all: Product[]; addImage: AddImage; onClose: () => void; onSave: (p: Product) => void }) {
  const [f, setF] = useState<any>({ ...p, mrp: p.mrp ?? '', offerText: p.offerText ?? '', offerEnds: p.offerEnds ?? '', description: p.description ?? '', weight: p.weight ?? '' });
  const [error, setError] = useState('');
  const set = (k: string, v: any) => setF((s: any) => ({ ...s, [k]: v }));
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose]);
  const upload = async (file?: File) => { if (!file) return; setError(''); try { set('image', await addImage(file, 'products', 900)); } catch (e: any) { setError(e.message); } };
  const save = (e: FormEvent) => {
    e.preventDefault();
    const name = String(f.name || '').trim(); const price = Number(f.price); const mrp = f.mrp === '' ? null : Number(f.mrp);
    if (!name) return setError('Enter the product name.');
    if (!Number.isFinite(price) || price < 0) return setError('Enter a valid selling price.');
    if (mrp !== null && (!Number.isFinite(mrp) || mrp <= price)) return setError('The original price must be higher than the selling price. Leave it empty if there is no discount.');
    if (f.offerEnds && isNaN(new Date(f.offerEnds).getTime())) return setError('Enter a valid offer end date.');
    let slug = p.id && p.name === name ? (p.slug as string) : slugify(name);
    const taken = (s: string) => all.some((x) => x.slug === s && x.id !== p.id);
    for (let i = 2, base = slug; taken(slug); i++) slug = `${base}-${i}`;
    onSave({
      id: p.id || 'p' + Date.now().toString(36) + rid().slice(0, 3), slug, name, category: String(f.category || '').trim() || 'Other',
      price, mrp, offerText: String(f.offerText || '').trim(), offerEnds: f.offerEnds || '', weight: String(f.weight || '').trim(),
      color: /^#[0-9a-f]{6}$/i.test(f.color) ? f.color : '#E4000F', description: String(f.description || '').trim(),
      stock: Math.max(0, Math.floor(Number(f.stock) || 0)), status: f.status === 'upcoming' ? 'upcoming' : 'current',
      featured: !!f.featured, active: f.active !== false, image: f.image || '', createdAt: p.createdAt || Date.now(),
    });
  };
  return (
    <div className="modal-root">
      <div className="scrim" onClick={onClose} />
      <form className="modal" onSubmit={save} role="dialog" aria-modal="true" aria-label={p.id ? 'Edit product' : 'Add product'}>
        <div className="drawer-head"><h2>{p.id ? 'Edit product' : 'Add product'}</h2><button type="button" className="icon-btn" onClick={onClose} aria-label="Close">✕</button></div>
        <div className="modal-body">
          {error && <div className="alert" role="alert">{error}</div>}
          <div className="fields">
            <label className="field span"><span>Name</span><input required value={f.name || ''} onChange={(e) => set('name', e.target.value)} /></label>
            <label className="field"><span>Category</span><input list="cats" required value={f.category || ''} onChange={(e) => set('category', e.target.value)} /><datalist id="cats">{[...new Set(all.map((x) => x.category))].map((c) => <option key={c} value={c} />)}</datalist></label>
            <label className="field"><span>Pack size</span><input value={f.weight} onChange={(e) => set('weight', e.target.value)} placeholder="e.g. 25 g" /></label>
            <label className="field"><span>Selling price</span><input type="number" min="0" step="any" required value={f.price ?? ''} onChange={(e) => set('price', e.target.value)} /></label>
            <label className="field"><span>Original price <em>(optional, shows a discount)</em></span><input type="number" min="0" step="any" value={f.mrp} onChange={(e) => set('mrp', e.target.value)} /></label>
            <label className="field"><span>Offer line <em>(optional)</em></span><input value={f.offerText} onChange={(e) => set('offerText', e.target.value)} placeholder="e.g. Buy 5, get 1 free" /></label>
            <label className="field"><span>Offer ends <em>(optional)</em></span><input type="date" value={f.offerEnds} onChange={(e) => set('offerEnds', e.target.value)} /></label>
            <label className="field"><span>Stock (packs)</span><input type="number" min="0" step="1" required value={f.stock ?? ''} onChange={(e) => set('stock', e.target.value)} /></label>
            <label className="field"><span>Status</span><select value={f.status} onChange={(e) => set('status', e.target.value)}><option value="current">Available now</option><option value="upcoming">Coming soon</option></select></label>
            <label className="field"><span>Pack colour <em>(used until you add a photo)</em></span><input type="color" value={f.color || '#E4000F'} onChange={(e) => set('color', e.target.value)} /></label>
            <label className="field span"><span>Description</span><textarea rows={3} value={f.description} onChange={(e) => set('description', e.target.value)} /></label>
            <div className="field span">
              <span>Photo</span>
              <div className="photo-row">
                <div className="thumb lg"><PackArt product={{ id: 'preview', name: f.name || 'Product', color: f.color, weight: f.weight, image: f.image }} /></div>
                <div>
                  <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(e) => upload(e.target.files?.[0])} aria-label="Upload photo" />
                  <small className="muted">It is made smaller automatically. A square photo on a plain background looks best.</small>
                  {f.image && <button type="button" className="link-btn" onClick={() => set('image', '')}>Remove photo</button>}
                </div>
              </div>
            </div>
            <label className="check"><input type="checkbox" checked={f.active !== false} onChange={(e) => set('active', e.target.checked)} /> Show on the site</label>
            <label className="check"><input type="checkbox" checked={!!f.featured} onChange={(e) => set('featured', e.target.checked)} /> Feature on the home page</label>
          </div>
        </div>
        <div className="modal-foot"><button type="button" className="btn btn-ghost-dark" onClick={onClose}>Cancel</button><button className="btn btn-red">{p.id ? 'Save product' : 'Add product'}</button></div>
      </form>
    </div>
  );
}

/* ================= GALLERY ================= */
function GalleryTab({ settings, setSettings, addImage }: { settings: Settings; setSettings: (s: Settings) => void; addImage: AddImage }) {
  const [error, setError] = useState('');
  const add = async (files: FileList | null) => {
    if (!files) return; setError('');
    const paths: string[] = [];
    for (const file of Array.from(files)) { try { paths.push(await addImage(file, 'gallery', 1400)); } catch (e: any) { setError(e.message); } }
    if (paths.length) setSettings({ ...settings, gallery: [...settings.gallery, ...paths] });
  };
  return (
    <>
      <p className="muted" style={{ marginBottom: 16 }}>These photos appear in the Gallery on the About page. Use photos of your products, team, events or hoardings.</p>
      {error && <div className="alert">{error}</div>}
      <input type="file" multiple accept="image/png,image/jpeg,image/webp,image/gif" onChange={(e) => { add(e.target.files); e.target.value = ''; }} aria-label="Add gallery photos" style={{ maxWidth: 420, marginBottom: 20 }} />
      {settings.gallery.length === 0 ? <p className="muted">No gallery photos yet.</p> : (
        <div className="gallery admin-gallery">
          {settings.gallery.map((g) => (
            <figure key={g}><PackArt product={{ id: g, name: 'Gallery photo', color: '', weight: '', image: g }} /><button className="link-btn danger" onClick={() => setSettings({ ...settings, gallery: settings.gallery.filter((x) => x !== g) })}>Remove</button></figure>
          ))}
        </div>
      )}
    </>
  );
}

/* ================= STORE DETAILS ================= */
function SettingsTab({ settings: s, setSettings }: { settings: Settings; setSettings: (s: Settings) => void }) {
  const set = (k: keyof Settings, v: any) => setSettings({ ...s, [k]: v });
  const T = (k: keyof Settings, label: string, extra: { hint?: string; type?: string; span?: boolean; placeholder?: string } = {}) => (
    <label className={`field ${extra.span ? 'span' : ''}`}><span>{label}{extra.hint && <em> ({extra.hint})</em>}</span>
      <input type={extra.type || 'text'} value={String(s[k] ?? '')} placeholder={extra.placeholder} onChange={(e) => set(k, extra.type === 'number' ? Number(e.target.value) : e.target.value)} /></label>
  );
  return (
    <div className="settings">
      <fieldset><legend>Store</legend><div className="fields">
        {T('storeName', 'Store name')}{T('tagline', 'Tagline')}
        {T('announcement', 'Top banner message', { hint: 'leave empty to hide', span: true })}
        {T('currency', 'Currency code', { hint: 'INR, USD, EUR' })}{T('locale', 'Number format', { hint: 'en-IN, en-US' })}
      </div></fieldset>
      <fieldset><legend>Stock display</legend><div className="fields">
        <label className="field"><span>Show stock as</span><select value={s.stockDisplay} onChange={(e) => set('stockDisplay', e.target.value)}><option value="exact">Exact number (In stock, 120 packs)</option><option value="label">Label only (In stock)</option></select></label>
        {T('lowStockAt', 'Show "Only N left" at or below', { type: 'number' })}
      </div></fieldset>
      <fieldset><legend>Where to find us</legend><div className="fields">
        {T('address', 'Stock point address', { span: true })}{T('hours', 'Opening hours', { span: true })}
        {T('phone', 'Phone')}{T('whatsapp', 'WhatsApp number', { hint: 'with country code, no + or spaces. Empty hides the button' })}
        {T('email', 'Public email')}{T('mapUrl', 'Google Maps link', { hint: 'optional' })}
      </div></fieldset>
      <fieldset><legend>Contact form</legend><div className="fields">
        {T('formEmail', 'Email that receives form messages', { span: true })}
      </div></fieldset>
      <fieldset><legend>Legal and social</legend><div className="fields">
        {T('fssai', 'FSSAI license number', { hint: 'shown in the footer once you add it', span: true })}
        {T('instagram', 'Instagram link')}{T('facebook', 'Facebook link')}{T('youtube', 'YouTube link')}
      </div></fieldset>
    </div>
  );
}

/* ================= HELP ================= */
function Help() {
  return (
    <div className="prose help">
      <h3>How this works</h3>
      <p>Edit as much as you like, then press <b>Publish changes</b>. Publishing saves your products and photos to your GitHub repository, and the site updates in about 1 to 2 minutes.</p>
      <h3>Add a product</h3>
      <p>Products tab, then Add product. Fill the form and add a photo if you have one. Until then, a FUDY pack illustration in the colour you pick is shown.</p>
      <h3>Remove a product</h3>
      <p>Delete removes it for good. Hide keeps it saved but off the site, which is useful for seasonal products.</p>
      <h3>Stock, discounts and offers</h3>
      <p>Use the plus and minus buttons for quick stock changes. To show a discount, set a selling price and a higher original price. When an offer end date passes, the discount disappears by itself and the original price is shown.</p>
      <h3>Keep stock honest</h3>
      <p>Visitors come to your stock point because of the numbers they see. Update stock whenever it changes, and the page shows the date it was last published.</p>
    </div>
  );
}
