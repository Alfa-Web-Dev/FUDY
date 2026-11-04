// Writes demo data into docs/data. Run once: node scripts/seed.mjs   (overwrites existing data)
import fs from 'node:fs';

const day = 864e5;
const inDays = (n) => new Date(Date.now() + n * day).toISOString().slice(0, 10);
const slug = (s) => s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
let n = 0;
const P = (name, category, price, weight, color, description, extra = {}) => ({
  id: 'p' + String(++n).padStart(3, '0'), slug: slug(name), name, category, price, mrp: null, offerText: '', offerEnds: '',
  weight, color, description, stock: 120, status: 'current', featured: false, active: true, image: '', createdAt: Date.now(), ...extra,
});

const products = [
  P('Tikka Twirls', 'Chips', 5, '25 g', '#E4000F', 'Spiral crisps with a bold tikka masala seasoning.', { featured: true, stock: 240 }),
  P('Masala Pops', 'Puffs', 2, '12 g', '#F26B1D', 'Light, airy puffs dusted with a warm house masala.', { featured: true, mrp: 3, offerEnds: inDays(21), offerText: 'Festival price', stock: 500 }),
  P('Salt Slices', 'Chips', 5, '25 g', '#FFC20E', 'Thin, crisp potato slices with just the right amount of salt.', { featured: true, stock: 180 }),
  P('Spicy Sticks', 'Sticks', 1, '8 g', '#B3000C', 'Tiny crunchy sticks with a fiery kick.', { stock: 800 }),
  P('Cheese Corn Crunch', 'Corn snacks', 10, '45 g', '#FFC20E', 'Crunchy corn pieces coated in rich cheese.', { featured: true, mrp: 12, offerEnds: inDays(10), stock: 7 }),
  P('Peri Peri Bites', 'Chips', 10, '45 g', '#000000', 'Big, bold bites with a slow-building peri peri heat.', { offerText: 'Buy 5, get 1 free', offerEnds: inDays(30), stock: 96 }),
  P('Mint Masala Chips', 'Chips', 5, '25 g', '#1F7A4D', 'A cool mint and masala blend that keeps you reaching for more.', { stock: 150 }),
  P('Mini Munchies', 'Sticks', 1, '8 g', '#2457C5', 'Pocket-sized crunchy bites for a quick snack.', { stock: 0 }),
  P('Chatpata Mix', 'Namkeen', 10, '50 g', '#6B2FA3', 'Sev, peanuts and lentils in a tangy chatpata mix.', { stock: 64 }),
  P('Tomato Tangy Chips', 'Chips', 5, '25 g', '#E4000F', 'Sweet and tangy tomato flavour on a crisp chip.', { stock: 9 }),
  P('Jeera Puffs', 'Puffs', 2, '12 g', '#C98A1A', 'Roasted cumin and a hint of salt on light puffs.', { stock: 320 }),
  P('Pizza Pops', 'Puffs', 5, '25 g', '#E4000F', 'Cheesy pizza flavour in a popped snack.', { status: 'upcoming', stock: 0 }),
  P('Honey Crisps', 'Sweet snacks', 10, '45 g', '#C98A1A', 'Golden crisps glazed with honey.', { status: 'upcoming', stock: 0 }),
];

const settings = {
  storeName: 'FUDY',
  tagline: 'Snacks made to be shared.',
  announcement: 'New flavours are coming soon',
  currency: 'INR', locale: 'en-IN',
  lowStockAt: 10, stockDisplay: 'exact',
  phone: '+00 00000 00000', whatsapp: '', email: 'fudy.contact@gmail.com', formEmail: 'fudy.contact@gmail.com',
  address: 'Your stock point address goes here', hours: 'Mon to Sat, 10:00 to 18:00', mapUrl: '',
  fssai: '', instagram: '', facebook: '', youtube: '',
  gallery: [],
};

fs.mkdirSync('docs/data', { recursive: true });
fs.writeFileSync('docs/data/products.json', JSON.stringify({ updated: new Date().toISOString(), products }, null, 2));
fs.writeFileSync('docs/data/settings.json', JSON.stringify(settings, null, 2));
console.log(`Wrote ${products.length} demo products.`);
