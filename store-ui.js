/* ════════════════════════════════════════════════════════════════
   VESPER — Storefront UI (rendering + interactions)
   Depends on window.VDStore from shopify-store.js
═══════════════════════════════════════════════════════════════════ */
(function () {
  const { fetchProducts, Cart, money, DEMO_MODE } = window.VDStore;

  const grid       = document.getElementById('product-grid');
  const drawer     = document.getElementById('cart-drawer');
  const scrim      = document.getElementById('cart-scrim');
  const drawerBody = document.getElementById('cart-lines');
  const drawerFoot = document.getElementById('cart-foot');
  const countBadge = document.getElementById('cart-count');
  const toastEl    = document.getElementById('toast');

  const selectedVariant = {}; // productId -> variantId

  /* ── Toast ─────────────────────────────────────────────────────── */
  let toastTimer;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2600);
  }

  /* ── Product grid ──────────────────────────────────────────────── */
  function productCard(p) {
    const firstAvail = p.variants.find(v => v.available) || p.variants[0];
    selectedVariant[p.id] = firstAvail.id;
    const single = p.variants.length === 1;

    const sizeChips = single ? '' : `
      <div class="size-row" data-product="${p.id}">
        ${p.variants.map(v => `
          <button class="size-chip${v.id === firstAvail.id ? ' active' : ''}${v.available ? '' : ' oos'}"
                  data-variant="${v.id}" ${v.available ? '' : 'disabled'}
                  title="${v.available ? v.title : v.title + ' — sold out'}">${v.title}</button>`).join('')}
      </div>`;

    return `
      <article class="product-card" data-product="${p.id}">
        <div class="pc-media">
          ${p.badge ? `<span class="pc-badge">${p.badge}</span>` : ''}
          <img src="${p.images[0]}" alt="${p.title}" loading="lazy">
          <div class="pc-media-glow"></div>
        </div>
        <div class="pc-info">
          <p class="pc-type">${p.type || 'Apparel'}</p>
          <h3 class="pc-title">${p.title}</h3>
          <p class="pc-desc">${p.description || ''}</p>
          ${sizeChips}
          <div class="pc-buy">
            <span class="pc-price">${money(p.price, p.currency)}</span>
            <button class="pc-add" data-product="${p.id}">Add to Cart</button>
          </div>
        </div>
      </article>`;
  }

  // "T-Shirt" -> "T-Shirts", "Hoodie" -> "Hoodies", "Hat" -> "Hats".
  function typeHeading(t) {
    if (!t) return 'Other';
    return /s$/i.test(t) ? t : t + 's';
  }

  function renderGrid(products) {
    if (!products.length) { grid.innerHTML = ''; return; }

    // Primary grouping: product type. Insertion order is preserved so the
    // server's BEST_SELLING sort still drives which section comes first.
    const byType = new Map();
    products.forEach(p => {
      const t = p.type || 'Other';
      if (!byType.has(t)) byType.set(t, []);
      byType.get(t).push(p);
    });

    let html = '';
    byType.forEach((items, t) => {
      // Secondary grouping: collection (a product's first collection).
      const byCol = new Map();
      items.forEach(p => {
        const c = (p.collections && p.collections[0]) || '';
        if (!byCol.has(c)) byCol.set(c, []);
        byCol.get(c).push(p);
      });

      // Only surface collection sub-headings when a type spans 2+ collections.
      const splitByCollection = byCol.size > 1;
      let inner = '';
      byCol.forEach((cItems, c) => {
        if (splitByCollection && c) inner += `<h3 class="collection-title">${c}</h3>`;
        inner += `<div class="section-grid">${cItems.map(productCard).join('')}</div>`;
      });

      html += `<section class="store-section">
        <h2 class="section-type-title">${typeHeading(t)}</h2>
        ${inner}
      </section>`;
    });

    grid.innerHTML = html;
  }

  /* ── Cart drawer rendering ─────────────────────────────────────── */
  function renderCart(cart) {
    const count = cart.lines.reduce((a, l) => a + l.quantity, 0);
    countBadge.textContent = count;
    countBadge.classList.toggle('has', count > 0);

    if (!cart.lines.length) {
      drawerBody.innerHTML = `
        <div class="cart-empty">
          <div class="cart-empty-eye">◉</div>
          <p>Your cart is empty.</p>
          <span>Nothing observed yet.</span>
        </div>`;
      drawerFoot.innerHTML = '';
      return;
    }

    drawerBody.innerHTML = cart.lines.map(l => `
      <div class="cart-line" data-line="${l.lineId}" data-variant="${l.variantId}">
        <div class="cl-media"><img src="${l.image}" alt="${l.title}"></div>
        <div class="cl-info">
          <p class="cl-title">${l.title}</p>
          <p class="cl-variant">${l.variantTitle}</p>
          <div class="cl-controls">
            <div class="qty">
              <button class="qty-btn" data-act="dec">−</button>
              <span class="qty-n">${l.quantity}</span>
              <button class="qty-btn" data-act="inc">+</button>
            </div>
            <button class="cl-remove" data-act="remove">Remove</button>
          </div>
        </div>
        <div class="cl-price">${money(l.price * l.quantity, cart.currency)}</div>
      </div>`).join('');

    drawerFoot.innerHTML = `
      <div class="cart-subtotal">
        <span>Subtotal</span>
        <span>${money(cart.subtotal, cart.currency)}</span>
      </div>
      <p class="cart-ship-note">Shipping & taxes calculated at checkout.</p>
      <button class="checkout-btn" id="checkout-btn">
        ${DEMO_MODE ? 'Checkout (Demo)' : 'Secure Checkout →'}
      </button>
      ${DEMO_MODE ? '<p class="demo-note">Demo mode — connect your Shopify Storefront token to enable real checkout.</p>' : '<p class="demo-note">You\'ll be redirected to Shopify\'s secure checkout.</p>'}`;

    document.getElementById('checkout-btn').addEventListener('click', onCheckout);
  }

  async function refreshCart() {
    const cart = await Cart.get();
    renderCart(cart);
    return cart;
  }

  /* ── Drawer open/close ─────────────────────────────────────────── */
  function openCart() { drawer.classList.add('open'); scrim.classList.add('show'); document.body.style.overflow = 'hidden'; }
  function closeCart() { drawer.classList.remove('open'); scrim.classList.remove('show'); document.body.style.overflow = ''; }

  /* ── Checkout ──────────────────────────────────────────────────── */
  async function onCheckout() {
    const cart = await Cart.get();
    if (!cart.lines.length) { toast('Your cart is empty.'); return; }
    if (DEMO_MODE || !cart.checkoutUrl) {
      toast('Demo mode — add your Shopify token to enable checkout.');
      return;
    }
    window.location.href = cart.checkoutUrl;
  }

  /* ── Events (delegated) ────────────────────────────────────────── */
  grid.addEventListener('click', async (e) => {
    // size selection
    const chip = e.target.closest('.size-chip');
    if (chip && !chip.disabled) {
      const row = chip.closest('.size-row');
      row.querySelectorAll('.size-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      selectedVariant[row.dataset.product] = chip.dataset.variant;
      return;
    }
    // add to cart
    const addBtn = e.target.closest('.pc-add');
    if (addBtn) {
      const pid = addBtn.dataset.product;
      const variantId = selectedVariant[pid];
      addBtn.classList.add('loading');
      addBtn.textContent = 'Adding…';
      try {
        await Cart.add(variantId, 1);
        await refreshCart();
        addBtn.textContent = 'Added ✓';
        toast('Added to cart');
        openCart();
      } catch (err) {
        addBtn.textContent = 'Try again';
        toast('Could not add — ' + err.message);
      } finally {
        setTimeout(() => { addBtn.classList.remove('loading'); addBtn.textContent = 'Add to Cart'; }, 1400);
      }
    }
  });

  drawerBody.addEventListener('click', async (e) => {
    const line = e.target.closest('.cart-line');
    if (!line) return;
    const act = e.target.dataset.act;
    if (!act) return;
    const lineId = line.dataset.line;
    const variantId = line.dataset.variant;
    const qtyN = parseInt(line.querySelector('.qty-n').textContent, 10);
    if (act === 'inc') renderCart(await Cart.setQty(lineId, variantId, qtyN + 1));
    else if (act === 'dec') renderCart(await Cart.setQty(lineId, variantId, qtyN - 1));
    else if (act === 'remove') renderCart(await Cart.remove(lineId, variantId));
  });

  document.getElementById('cart-toggle').addEventListener('click', openCart);
  document.getElementById('cart-close').addEventListener('click', closeCart);
  scrim.addEventListener('click', closeCart);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeCart(); });

  /* ── Boot ──────────────────────────────────────────────────────── */
  async function boot() {
    if (DEMO_MODE) document.getElementById('demo-banner').classList.add('show');
    try {
      const products = await fetchProducts();
      renderGrid(products);
      document.getElementById('product-count').textContent = products.length + ' items';
    } catch (err) {
      grid.innerHTML = `<div class="grid-error">Couldn't load products.<br><span>${err.message}</span></div>`;
    }
    await refreshCart();
  }
  boot();
})();
