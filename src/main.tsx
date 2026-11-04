import { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { DataProvider, splitRoute, useRoute } from './lib';
import { Footer, Header } from './components';
import { About, Contact, Deals, FindUs, Home, ProductPage, Products } from './pages';
import { Admin } from './admin';

function Routes() {
  const { path } = splitRoute(useRoute());
  let m: RegExpExecArray | null;
  if (path === '/') return <Home />;
  if (path === '/products') return <Products />;
  if ((m = /^\/products\/([\w-]+)$/.exec(path))) return <ProductPage slug={m[1]} />;
  if (path === '/deals') return <Deals />;
  if (path === '/find-us') return <FindUs />;
  if (path === '/about') return <About />;
  if (path === '/contact') return <Contact />;
  if (path === '/admin') return <Admin />;
  return <div className="wrap page empty"><h1>Page not found</h1><p>The page you are looking for does not exist.</p><a className="btn btn-black" href="#/">Go home</a></div>;
}

function App() {
  const { path } = splitRoute(useRoute());
  useEffect(() => { window.scrollTo(0, 0); }, [path]);
  return (
    <DataProvider>
      <a className="skip" href="#main" onClick={(e) => { e.preventDefault(); document.getElementById('main')?.focus(); }}>Skip to content</a>
      <Header />
      <main id="main" tabIndex={-1}><Routes /></main>
      <Footer />
    </DataProvider>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
