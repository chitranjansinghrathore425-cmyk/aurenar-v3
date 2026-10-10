
import { supabase } from './supabase-client.js';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const CART_KEY = 'aurenar_cart';
const WISH_KEY = 'aurenar_wishlist';

const FALLBACK = [
  {
    id: 'fallback-1',
    name: 'White Linen Shirt',
    price: 1499,
    image_url: 'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?auto=format&fit=crop&w=1400&q=84',
    sizes: ['S', 'M', 'L', 'XL'],
    description: 'A clean linen essential with a relaxed, considered silhouette.',
    is_active: true
  },
  {
    id: 'fallback-2',
    name: 'Noir Overshirt',
    price: 1899,
    image_url: 'https://images.unsplash.com/photo-1598808503746-f34c53b9323e?auto=format&fit=crop&w=1400&q=84',
    sizes: ['S', 'M', 'L', 'XL'],
    description: 'A structured everyday layer in a deep, understated tone.',
    is_active: true
  },
  {
    id: 'fallback-3',
    name: 'Stone Trousers',
    price: 1799,
    image_url: 'https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?auto=format&fit=crop&w=1400&q=84',
    sizes: ['30', '32', '34', '36'],
    description: 'Relaxed tailored trousers designed for an effortless line.',
    is_active: true
  }
];

let products = [];
let selectedProduct = null;
let selectedSize = '';

function readStorage(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function writeStorage(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function money(value) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(Number(value) || 0);
}

function safe(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[char]);
}

function imageOf(product) {
  if (Array.isArray(product.images) && product.images.length) {
    return product.images[0];
  }

  if (typeof product.images === 'string' && product.images.trim()) {
    try {
      const parsed = JSON.parse(product.images);
      if (Array.isArray(parsed) && parsed[0]) return parsed[0];
    } catch {
      return product.images;
    }
  }

  return product.image_url ||
    'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=1400&q=84';
}

function normalize(product) {
  return {
    ...product,
    images: Array.isArray(product.images)
      ? product.images
      : [product.image_url].filter(Boolean),
    sizes: Array.isArray(product.sizes)
      ? product.sizes
      : typeof product.sizes === 'string'
        ? product.sizes.split(',').map(size => size.trim()).filter(Boolean)
        : ['S', 'M', 'L', 'XL']
  };
}

function toast(message) {
  const element = $('#toast');
  if (!element) return;

  element.textContent = message;
  element.classList.add('show');

  clearTimeout(window.__aurenarToastTimer);
  window.__aurenarToastTimer = setTimeout(() => {
    element.classList.remove('show');
  }, 2300);
}

function openDrawer(id) {
  const drawer = $('#' + id);
  const overlay = $('#overlay');

  if (!drawer) return;

  drawer.classList.add('open');
  drawer.setAttribute('aria-hidden', 'false');

  if (overlay) {
    overlay.hidden = false;
    overlay.classList.add('open');
  }
}

function closeDrawer(id) {
  const drawer = $('#' + id);
  if (!drawer) return;

  drawer.classList.remove('open');
  drawer.setAttribute('aria-hidden', 'true');

  if (!$$('.drawer.open').length) {
    const overlay = $('#overlay');
    if (overlay) {
      overlay.hidden = true;
      overlay.classList.remove('open');
    }
  }
}

function closeAllDrawers() {
  $$('.drawer.open').forEach(drawer => closeDrawer(drawer.id));
}

function updateBagCount() {
  const count = readStorage(CART_KEY)
    .reduce((total, item) => total + (Number(item.qty) || 0), 0);

  $$('#bagCount').forEach(element => {
    element.textContent = count;
  });
}

function wishlistIds() {
  return readStorage(WISH_KEY).map(String);
}

function toggleWishlist(product) {
  const current = wishlistIds();
  const id = String(product.id);
  const exists = current.includes(id);

  const next = exists
    ? current.filter(item => item !== id)
    : [...current, id];

  writeStorage(WISH_KEY, next);
  updateWishlistButton();
  renderProduct();

  toast(exists ? 'Removed from wishlist' : 'Added to wishlist');
}

function updateWishlistButton() {
  const button = $('#wishlistBtn');
  if (!button) return;

  const saved = wishlistIds();
  button.setAttribute(
    'aria-label',
    `Wishlist, ${saved.length} saved item${saved.length === 1 ? '' : 's'}`
  );
  button.classList.toggle('is-active', saved.length > 0);
}

function renderProduct() {
  const root = $('#productDetail');
  if (!root || !selectedProduct) return;

  const product = selectedProduct;
  const images = product.images.length
    ? product.images
    : [imageOf(product)];

  const saved = wishlistIds().includes(String(product.id));
  const hasStockColumn = product.stock !== undefined && product.stock !== null;
  const soldOut = hasStockColumn && Number(product.stock) <= 0;

  document.title = `${product.name} — AURENAR`;

  root.innerHTML = `
    <div class="detail-gallery">
      ${images.map((url, index) => `
        <div class="detail-image">
          <img
            src="${safe(url)}"
            alt="${safe(product.name)}${index ? ' alternate view' : ''}"
            loading="${index ? 'lazy' : 'eager'}"
          >
        </div>
      `).join('')}
    </div>

    <div class="detail-info">
      <p class="eyebrow">
        AURENAR / ${soldOut ? 'SOLD OUT' : 'MODERN ESSENTIALS'}
      </p>

      <h1>${safe(product.name)}</h1>

      <div class="detail-price">
        ${money(product.price)}
        ${product.compare_at_price
          ? `<del>${money(product.compare_at_price)}</del>`
          : ''}
      </div>

      <p class="detail-desc">
        ${safe(product.description || 'A considered AURENAR essential.')}
      </p>

      ${product.sizes.length ? `
        <div class="detail-field">
          <div class="field-label">
            <span>SELECT SIZE</span>
            <button type="button" id="sizeGuide">SIZE GUIDE</button>
          </div>

          <div class="size-grid" id="sizes">
            ${product.sizes.map(size => `
              <button
                type="button"
                class="size-option"
                data-size="${safe(size)}"
              >${safe(size)}</button>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <div class="detail-actions">
        <button
          type="button"
          class="primary-btn"
          id="addBtn"
          ${soldOut ? 'disabled' : ''}
        >
          ${soldOut ? 'SOLD OUT' : 'ADD TO BAG'}
        </button>

        <button
          type="button"
          class="wishlist-large"
          id="wishBtn"
          aria-pressed="${saved}"
        >
          ${saved ? '♥' : '♡'}
          <span>${saved ? 'WISHLISTED' : 'WISHLIST'}</span>
        </button>
      </div>

      <div class="product-notes">
        <div>
          <strong>COLLECTION</strong>
          <span>${safe(product.category || 'Modern essentials')}</span>
        </div>
        <div>
          <strong>DELIVERY</strong>
          <span>Complimentary over ₹2,500</span>
        </div>
        <div>
          <strong>DETAIL</strong>
          <span>Designed with everyday versatility in mind.</span>
        </div>
      </div>
    </div>
  `;

  selectedSize = '';

  $$('.size-option', root).forEach(button => {
    button.addEventListener('click', () => {
      $$('.size-option', root).forEach(item => {
        item.classList.remove('selected');
      });

      button.classList.add('selected');
      selectedSize = button.dataset.size;
    });
  });

  $('#addBtn', root)?.addEventListener('click', addSelectedProduct);
  $('#wishBtn', root)?.addEventListener('click', () => {
    toggleWishlist(product);
  });

  $('#sizeGuide', root)?.addEventListener('click', () => {
    toast('Please check the product size before ordering.');
  });
}

function addSelectedProduct() {
  const product = selectedProduct;
  if (!product) return;

  if (product.sizes.length && !selectedSize) {
    toast('Please select a size first');
    return;
  }

  const cart = readStorage(CART_KEY);
  const key = `${product.id}::${selectedSize}`;
  const existing = cart.find(item => item.key === key);

  if (existing) {
    existing.qty = (Number(existing.qty) || 0) + 1;
  } else {
    cart.push({
      key,
      id: product.id,
      size: selectedSize,
      qty: 1
    });
  }

  writeStorage(CART_KEY, cart);
  updateBagCount();
  renderBag();
  toast('Added to bag');
  openDrawer('bagDrawer');
}

function renderBag() {
  const body = $('#bagBody');
  const footer = $('#bagFoot');
  if (!body || !footer) return;

  const cart = readStorage(CART_KEY);

  if (!cart.length) {
    body.innerHTML = '<div class="empty-state">Your bag is empty.</div>';
    footer.innerHTML = '';
    return;
  }

  let subtotal = 0;

  body.innerHTML = cart.map(item => {
    const product = products.find(
      candidate => String(candidate.id) === String(item.id)
    );

    if (!product) return '';

    subtotal += Number(product.price) * Number(item.qty);

    return `
      <div class="bag-item">
        <img src="${safe(imageOf(product))}" alt="${safe(product.name)}">

        <div class="bag-item-main">
          <strong>${safe(product.name)}</strong>
          <span>
            ${item.size ? `Size ${safe(item.size)} · ` : ''}
            ${money(product.price)}
          </span>

          <div class="qty">
            <button type="button" data-k="${safe(item.key)}" data-d="-1">−</button>
            <span>${Number(item.qty) || 1}</span>
            <button type="button" data-k="${safe(item.key)}" data-d="1">+</button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  $$('[data-k]', body).forEach(button => {
    button.addEventListener('click', () => {
      const updated = readStorage(CART_KEY);
      const item = updated.find(entry => entry.key === button.dataset.k);
      if (!item) return;

      item.qty = (Number(item.qty) || 1) + Number(button.dataset.d);

      const finalCart = updated.filter(entry => entry.qty > 0);
      writeStorage(CART_KEY, finalCart);

      updateBagCount();
      renderBag();
    });
  });

  const shipping = subtotal >= 2500 ? 0 : 199;

  footer.innerHTML = `
    <div class="totals">
      <span>SUBTOTAL</span>
      <strong>${money(subtotal)}</strong>
    </div>

    <div class="totals">
      <span>SHIPPING</span>
      <strong>${shipping ? money(shipping) : 'COMPLIMENTARY'}</strong>
    </div>

    <button type="button" class="primary-btn" id="checkoutBtn">
      PROCEED TO CHECKOUT
    </button>
  `;

  $('#checkoutBtn')?.addEventListener('click', () => {
    renderCheckout();
    openDrawer('checkoutDrawer');
  });
}

function renderCheckout() {
  const summary = $('#checkoutSummary');
  if (!summary) return;

  const cart = readStorage(CART_KEY);
  const subtotal = cart.reduce((total, item) => {
    const product = products.find(
      candidate => String(candidate.id) === String(item.id)
    );

    return total + (Number(product?.price) || 0) * (Number(item.qty) || 0);
  }, 0);

  const shipping = subtotal >= 2500 ? 0 : 199;

  summary.innerHTML = `
    <div><span>SUBTOTAL</span><strong>${money(subtotal)}</strong></div>
    <div>
      <span>SHIPPING</span>
      <strong>${shipping ? money(shipping) : 'COMPLIMENTARY'}</strong>
    </div>
    <div class="summary-total">
      <span>TOTAL</span>
      <strong>${money(subtotal + shipping)}</strong>
    </div>
  `;
}

function showWishlist() {
  const results = $('#searchResults');
  const input = $('#searchInput');
  if (!results) return;

  if (input) input.value = '';

  const saved = wishlistIds();
  const items = products.filter(product => saved.includes(String(product.id)));

  results.innerHTML = items.length
    ? `<p class="eyebrow">YOUR WISHLIST</p>` + items.map(product => `
        <a class="search-result" href="/product.html?id=${encodeURIComponent(product.id)}">
          <img src="${safe(imageOf(product))}" alt="">
          <span>${safe(product.name)} · ${money(product.price)}</span>
        </a>
      `).join('')
    : '<p class="empty-state">Your wishlist is empty.</p>';

  openDrawer('searchDrawer');
}

function renderSearch(query) {
  const results = $('#searchResults');
  if (!results) return;

  const term = query.trim().toLowerCase();

  if (!term) {
    results.innerHTML = '<p class="empty-state">Search the collection.</p>';
    return;
  }

  const matches = products.filter(product =>
    `${product.name} ${product.category || ''} ${product.description || ''}`
      .toLowerCase()
      .includes(term)
  );

  results.innerHTML = matches.length
    ? matches.map(product => `
        <a class="search-result" href="/product.html?id=${encodeURIComponent(product.id)}">
          <img src="${safe(imageOf(product))}" alt="">
          <span>${safe(product.name)} · ${money(product.price)}</span>
        </a>
      `).join('')
    : '<p class="empty-state">No matching products found.</p>';
}

async function renderAccount() {
  const body = $('#accountBody');
  if (!body) return;

  body.innerHTML = '<p class="empty-state">Loading account…</p>';

  const { data, error } = await supabase.auth.getSession();

  if (error) {
    body.innerHTML = '<p>Account could not be loaded. Please try again.</p>';
    return;
  }

  if (data.session) {
    body.innerHTML = `
      <p class="eyebrow">SIGNED IN</p>
      <h2>${safe(data.session.user.email)}</h2>
      <button type="button" class="secondary-btn" id="signOut">SIGN OUT</button>
    `;

    $('#signOut')?.addEventListener('click', async () => {
      const { error: signOutError } = await supabase.auth.signOut();

      if (signOutError) {
        toast('Could not sign out. Try again.');
        return;
      }

      renderAccount();
      toast('Signed out');
    });

    return;
  }

  body.innerHTML = `
    <p class="eyebrow">YOUR AURENAR ACCOUNT</p>
    <form id="accountForm" class="auth-form">
      <input required type="email" name="email" placeholder="Email address">
      <input required minlength="6" type="password" name="password" placeholder="Password">
      <button type="submit" class="primary-btn">SIGN IN</button>
      <button type="button" class="secondary-btn" id="signupBtn">CREATE ACCOUNT</button>
      <p id="accountMessage" class="form-message"></p>
    </form>
  `;

  $('#accountForm')?.addEventListener('submit', async event => {
    event.preventDefault();

    const form = new FormData(event.currentTarget);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: form.get('email'),
      password: form.get('password')
    });

    const message = $('#accountMessage');

    if (message) {
      message.textContent = signInError
        ? signInError.message
        : 'Signed in successfully.';
    }

    if (!signInError) renderAccount();
  });

  $('#signupBtn')?.addEventListener('click', async () => {
    const form = new FormData($('#accountForm'));

    const { error: signupError } = await supabase.auth.signUp({
      email: form.get('email'),
      password: form.get('password')
    });

    const message = $('#accountMessage');

    if (message) {
      message.textContent = signupError
        ? signupError.message
        : 'Account request submitted. Check your email if confirmation is enabled.';
    }
  });
}

function wireInterface() {
  updateBagCount();
  updateWishlistButton();
  renderBag();

  $('#bagBtn')?.addEventListener('click', () => {
    renderBag();
    openDrawer('bagDrawer');
  });

  $('#accountBtn')?.addEventListener('click', () => {
    openDrawer('accountDrawer');
    renderAccount();
  });

  $('#searchBtn')?.addEventListener('click', () => {
    openDrawer('searchDrawer');
    $('#searchInput')?.focus();
    renderSearch($('#searchInput')?.value || '');
  });

  $('#wishlistBtn')?.addEventListener('click', showWishlist);

  $('#searchInput')?.addEventListener('input', event => {
    renderSearch(event.target.value);
  });

  $('#overlay')?.addEventListener('click', closeAllDrawers);

  $$('[data-close]').forEach(button => {
    button.addEventListener('click', () => {
      closeDrawer(button.dataset.close);
    });
  });

  $('#menuBtn')?.addEventListener('click', () => {
    const nav = $('#mobileNav');
    if (!nav) return;

    const opened = nav.classList.toggle('open');
    nav.setAttribute('aria-hidden', String(!opened));
  });

  $('#checkoutForm')?.addEventListener('submit', event => {
    event.preventDefault();
    toast('Online payment is not connected yet.');
  });
}

async function loadProducts() {
  const params = new URLSearchParams(location.search);
  const requestedId = params.get('id');
  const requestedSlug = params.get('slug');

  try {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('is_active', true);

    if (error) throw error;

    products = (data || []).map(normalize);
  } catch (error) {
    console.error('AURENAR product loading error:', error);
    products = [];
  }

  if (!products.length) {
    products = FALLBACK.map(normalize);
  }

  selectedProduct = products.find(product =>
    requestedId && String(product.id) === String(requestedId)
  );

  if (!selectedProduct && requestedSlug) {
    selectedProduct = products.find(product => {
      const slug = String(product.slug || product.name || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

      return slug === requestedSlug.toLowerCase();
    });
  }

  if (!selectedProduct) {
    selectedProduct = products[0];
  }

  renderProduct();
  renderBag();
  updateBagCount();
  updateWishlistButton();
}

wireInterface();
loadProducts();
