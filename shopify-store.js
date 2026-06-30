/* ════════════════════════════════════════════════════════════════
   VESPER — Custom Storefront
   Talks to the Shopify Storefront API (headless commerce).

   ▸ HOW TO GO LIVE:
     1. Shopify admin → Settings → Apps and sales channels →
        Develop apps → Create an app → Configure Storefront API scopes
        (unauthenticated_read_product_listings,
         unauthenticated_write_checkouts, unauthenticated_read_checkouts).
     2. Install the app, copy the **Storefront API access token**.
     3. Paste your domain + token into SHOPIFY_CONFIG below.
     That public token is safe to ship in client code — it only allows
     reading products and building carts, never admin access.

   Until you fill those in, the store runs in DEMO mode with the
   placeholder products defined in DEMO_PRODUCTS (no real checkout).
═══════════════════════════════════════════════════════════════════ */

const SHOPIFY_CONFIG = {
  domain: 'm5vw0t-1j.myshopify.com',          // ← REQUIRED: your 'xxxx.myshopify.com' domain
  storefrontToken: 'ffe452f503786727bb1cc9bd2cdf3e43', // Storefront API access token
  apiVersion: '2024-10',
};

const DEMO_MODE = !SHOPIFY_CONFIG.domain || !SHOPIFY_CONFIG.storefrontToken;

/* ── Demo catalog (used only until real credentials are set) ──────── */
const DEMO_PRODUCTS = [
  {
    id: 'demo-tee-remote', handle: 'remote-execution-tee',
    title: 'Remote Execution Tour Tee', type: 'T-Shirt',
    description: 'Heavyweight black cotton tee. Front pyramid sigil, “Remote Execution” lockup beneath. MMXXVI tour print.',
    price: 35, currency: 'USD',
    images: ['uploads/merch-tee-remote.jpg'],
    options: [{ name: 'Size', values: ['S', 'M', 'L', 'XL', 'XXL'] }],
    variants: ['S','M','L','XL','XXL'].map(s => ({
      id: 'demo-tee-remote-' + s, title: s, price: 35, available: s !== 'XXL',
      selectedOptions: [{ name: 'Size', value: s }],
    })),
    badge: 'NEW',
  },
  {
    id: 'demo-tee-logo', handle: 'vesper-duck-logo-tee',
    title: 'Vesper Logo Tee', type: 'T-Shirt',
    description: 'Bone-white cotton tee with the classic pyramid logo and “Keep On Watching” underline in crimson.',
    price: 32, currency: 'USD',
    images: ['uploads/merch-tee-logo.jpg'],
    options: [{ name: 'Size', values: ['S', 'M', 'L', 'XL', 'XXL'] }],
    variants: ['S','M','L','XL','XXL'].map(s => ({
      id: 'demo-tee-logo-' + s, title: s, price: 32, available: true,
      selectedOptions: [{ name: 'Size', value: s }],
    })),
  },
  {
    id: 'demo-hoodie-sigil', handle: 'pyramid-sigil-hoodie',
    title: 'Pyramid Sigil Hoodie', type: 'Hoodie',
    description: 'Premium 400gsm fleece hoodie. Oversized cyan pyramid-and-eye sigil, embroidered cuff tag.',
    price: 68, currency: 'USD',
    images: ['uploads/merch-hoodie-sigil.jpg'],
    options: [{ name: 'Size', values: ['S', 'M', 'L', 'XL', 'XXL'] }],
    variants: ['S','M','L','XL','XXL'].map(s => ({
      id: 'demo-hoodie-sigil-' + s, title: s, price: 68, available: true,
      selectedOptions: [{ name: 'Size', value: s }],
    })),
    badge: 'BESTSELLER',
  },
  {
    id: 'demo-ls-static', handle: 'into-the-static-long-sleeve',
    title: 'Into The Static Long Sleeve', type: 'Long Sleeve',
    description: 'Charcoal long-sleeve with glitch-bar chest print and sleeve static graphics.',
    price: 44, currency: 'USD',
    images: ['uploads/merch-ls-static.jpg'],
    options: [{ name: 'Size', values: ['S', 'M', 'L', 'XL'] }],
    variants: ['S','M','L','XL'].map(s => ({
      id: 'demo-ls-static-' + s, title: s, price: 44, available: true,
      selectedOptions: [{ name: 'Size', value: s }],
    })),
  },
  {
    id: 'demo-cap-broadcast', handle: 'broadcast-cap',
    title: 'Broadcast Cap', type: 'Headwear',
    description: 'Structured 6-panel cap. Embroidered all-seeing eye + “VD Broadcast” underbill detail.',
    price: 28, currency: 'USD',
    images: ['uploads/merch-cap-broadcast.jpg'],
    options: [{ name: 'Size', values: ['One Size'] }],
    variants: [{ id: 'demo-cap-broadcast-os', title: 'One Size', price: 28, available: true, selectedOptions: [{ name: 'Size', value: 'One Size' }] }],
  },
  {
    id: 'demo-tee-eye', handle: 'all-seeing-tee',
    title: 'All-Seeing Tee', type: 'T-Shirt',
    description: 'Deep crimson tee. Bone all-seeing eye with “All Signals Observed” cyan lockup.',
    price: 34, currency: 'USD',
    images: ['uploads/merch-tee-eye.jpg'],
    options: [{ name: 'Size', values: ['S', 'M', 'L', 'XL', 'XXL'] }],
    variants: ['S','M','L','XL','XXL'].map(s => ({
      id: 'demo-tee-eye-' + s, title: s, price: 34, available: s !== 'S',
      selectedOptions: [{ name: 'Size', value: s }],
    })),
  },
];

/* ── Storefront API GraphQL client ───────────────────────────────── */
async function sfQuery(query, variables = {}) {
  const url = `https://${SHOPIFY_CONFIG.domain}/api/${SHOPIFY_CONFIG.apiVersion}/graphql.json`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': SHOPIFY_CONFIG.storefrontToken,
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json.data;
}

const PRODUCTS_QUERY = `
  query Products($n: Int!) {
    products(first: $n, sortKey: BEST_SELLING) {
      edges { node {
        id title handle description productType
        collections(first: 5) { edges { node { title handle } } }
        priceRange { minVariantPrice { amount currencyCode } }
        options { name values }
        images(first: 4) { edges { node { url altText } } }
        variants(first: 25) { edges { node {
          id title availableForSale
          price { amount currencyCode }
          selectedOptions { name value }
        } } }
      } }
    }
  }`;

function mapProduct(node) {
  const variants = node.variants.edges.map(e => ({
    id: e.node.id,
    title: e.node.title,
    price: parseFloat(e.node.price.amount),
    currency: e.node.price.currencyCode,
    available: e.node.availableForSale,
    selectedOptions: e.node.selectedOptions,
  }));
  return {
    id: node.id,
    handle: node.handle,
    title: node.title,
    type: node.productType,
    description: node.description,
    price: parseFloat(node.priceRange.minVariantPrice.amount),
    currency: node.priceRange.minVariantPrice.currencyCode,
    images: node.images.edges.map(e => e.node.url),
    collections: node.collections ? node.collections.edges.map(e => e.node.title) : [],
    options: node.options.map(o => ({ name: o.name, values: o.values })),
    variants,
  };
}

async function fetchProducts() {
  if (DEMO_MODE) return DEMO_PRODUCTS;
  const data = await sfQuery(PRODUCTS_QUERY, { n: 24 });
  return data.products.edges.map(e => mapProduct(e.node));
}

/* ── Cart (Storefront Cart API) ──────────────────────────────────── */
const CART_KEY = 'vd_cart_id';
const DEMO_CART_KEY = 'vd_demo_cart';

const CART_FIELDS = `
  id checkoutUrl
  cost { subtotalAmount { amount currencyCode } }
  lines(first: 50) { edges { node {
    id quantity
    merchandise { ... on ProductVariant {
      id title
      price { amount currencyCode }
      product { title images(first:1){edges{node{url}}} }
      selectedOptions { name value }
    } }
  } } }`;

async function cartCreate(lines) {
  const data = await sfQuery(`
    mutation CartCreate($lines:[CartLineInput!]) {
      cartCreate(input:{ lines:$lines }) {
        cart { ${CART_FIELDS} }
        userErrors { message }
      }
    }`, { lines });
  const cart = data.cartCreate.cart;
  localStorage.setItem(CART_KEY, cart.id);
  return cart;
}

async function cartLinesAdd(cartId, lines) {
  const data = await sfQuery(`
    mutation CartLinesAdd($cartId:ID!,$lines:[CartLineInput!]!) {
      cartLinesAdd(cartId:$cartId, lines:$lines) {
        cart { ${CART_FIELDS} }
        userErrors { message }
      }
    }`, { cartId, lines });
  return data.cartLinesAdd.cart;
}

async function cartLinesUpdate(cartId, lines) {
  const data = await sfQuery(`
    mutation CartLinesUpdate($cartId:ID!,$lines:[CartLineUpdateInput!]!) {
      cartLinesUpdate(cartId:$cartId, lines:$lines) {
        cart { ${CART_FIELDS} }
        userErrors { message }
      }
    }`, { cartId, lines });
  return data.cartLinesUpdate.cart;
}

async function cartLinesRemove(cartId, lineIds) {
  const data = await sfQuery(`
    mutation CartLinesRemove($cartId:ID!,$lineIds:[ID!]!) {
      cartLinesRemove(cartId:$cartId, lineIds:$lineIds) {
        cart { ${CART_FIELDS} }
        userErrors { message }
      }
    }`, { cartId, lineIds });
  return data.cartLinesRemove.cart;
}

async function cartGet(cartId) {
  const data = await sfQuery(`query CartGet($id:ID!){ cart(id:$id){ ${CART_FIELDS} } }`, { id: cartId });
  return data.cart;
}

/* Normalize a Storefront cart into the shape the UI renders. */
function normalizeCart(cart) {
  if (!cart) return { lines: [], subtotal: 0, currency: 'USD', checkoutUrl: null };
  return {
    id: cart.id,
    checkoutUrl: cart.checkoutUrl,
    subtotal: parseFloat(cart.cost.subtotalAmount.amount),
    currency: cart.cost.subtotalAmount.currencyCode,
    lines: cart.lines.edges.map(e => ({
      lineId: e.node.id,
      variantId: e.node.merchandise.id,
      quantity: e.node.quantity,
      title: e.node.merchandise.product.title,
      variantTitle: e.node.merchandise.title,
      price: parseFloat(e.node.merchandise.price.amount),
      image: e.node.merchandise.product.images.edges[0]?.node.url || '',
    })),
  };
}

/* ════════════════════════════════════════════════════════════════
   DEMO cart — mirrors the real cart shape, stored in localStorage.
═══════════════════════════════════════════════════════════════════ */
function demoCartRead() {
  try { return JSON.parse(localStorage.getItem(DEMO_CART_KEY)) || []; }
  catch { return []; }
}
function demoCartWrite(lines) { localStorage.setItem(DEMO_CART_KEY, JSON.stringify(lines)); }

function demoFindProductByVariant(variantId) {
  for (const p of DEMO_PRODUCTS) {
    const v = p.variants.find(v => v.id === variantId);
    if (v) return { p, v };
  }
  return null;
}

function demoCartNormalized() {
  const raw = demoCartRead();
  const lines = raw.map(l => {
    const found = demoFindProductByVariant(l.variantId);
    if (!found) return null;
    return {
      lineId: l.variantId,
      variantId: l.variantId,
      quantity: l.quantity,
      title: found.p.title,
      variantTitle: found.v.title,
      price: found.v.price,
      image: found.p.images[0],
    };
  }).filter(Boolean);
  const subtotal = lines.reduce((a, l) => a + l.price * l.quantity, 0);
  return { id: 'demo', checkoutUrl: null, subtotal, currency: 'USD', lines };
}

/* ════════════════════════════════════════════════════════════════
   Public cart actions used by the UI (demo-aware).
═══════════════════════════════════════════════════════════════════ */
const Cart = {
  async add(variantId, quantity = 1) {
    if (DEMO_MODE) {
      const lines = demoCartRead();
      const ex = lines.find(l => l.variantId === variantId);
      if (ex) ex.quantity += quantity; else lines.push({ variantId, quantity });
      demoCartWrite(lines);
      return demoCartNormalized();
    }
    const cartId = localStorage.getItem(CART_KEY);
    const lines = [{ merchandiseId: variantId, quantity }];
    let cart;
    if (cartId) {
      try { cart = await cartLinesAdd(cartId, lines); }
      catch { cart = await cartCreate(lines); }
    } else {
      cart = await cartCreate(lines);
    }
    return normalizeCart(cart);
  },

  async setQty(lineId, variantId, quantity) {
    if (DEMO_MODE) {
      let lines = demoCartRead();
      if (quantity <= 0) lines = lines.filter(l => l.variantId === variantId ? false : true);
      else { const ex = lines.find(l => l.variantId === variantId); if (ex) ex.quantity = quantity; }
      demoCartWrite(lines);
      return demoCartNormalized();
    }
    const cartId = localStorage.getItem(CART_KEY);
    if (quantity <= 0) return normalizeCart(await cartLinesRemove(cartId, [lineId]));
    return normalizeCart(await cartLinesUpdate(cartId, [{ id: lineId, quantity }]));
  },

  async remove(lineId, variantId) {
    if (DEMO_MODE) {
      const lines = demoCartRead().filter(l => l.variantId !== variantId);
      demoCartWrite(lines);
      return demoCartNormalized();
    }
    const cartId = localStorage.getItem(CART_KEY);
    return normalizeCart(await cartLinesRemove(cartId, [lineId]));
  },

  async get() {
    if (DEMO_MODE) return demoCartNormalized();
    const cartId = localStorage.getItem(CART_KEY);
    if (!cartId) return { lines: [], subtotal: 0, currency: 'USD', checkoutUrl: null };
    try {
      const cart = await cartGet(cartId);
      if (!cart) { localStorage.removeItem(CART_KEY); return { lines: [], subtotal: 0, currency: 'USD', checkoutUrl: null }; }
      return normalizeCart(cart);
    } catch { return { lines: [], subtotal: 0, currency: 'USD', checkoutUrl: null }; }
  },
};

/* ── Currency helper ──────────────────────────────────────────────── */
function money(amount, currency = 'USD') {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
  } catch { return '$' + amount.toFixed(2); }
}

window.VDStore = { fetchProducts, Cart, money, DEMO_MODE };
