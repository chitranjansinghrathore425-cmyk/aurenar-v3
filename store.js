
import { supabase } from "./supabase.js";

/* AURENAR — Storefront compatible with the current SQL schema */

const CART_KEY = "aurenar_cart";
const WISH_KEY = "aurenar_wishlist";

const $ = id => document.getElementById(id);
const all = selector => [...document.querySelectorAll(selector)];

let products = [];
let activeFilter = "all";

const fallbackProducts = [
  {
    id: "fallback-1",
    name: "White Linen Shirt",
    price: 1499,
    image_url: "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?auto=format&fit=crop&w=1000&q=85",
    category: "men",
    sizes: ["S", "M", "L", "XL"],
    description: "A clean linen essential."
  },
  {
    id: "fallback-2",
    name: "Noir Overshirt",
    price: 1899,
    image_url: "https://images.unsplash.com/photo-1598808503746-f34c53b9323e?auto=format&fit=crop&w=1000&q=85",
    category: "men",
    sizes: ["S", "M", "L", "XL"],
    description: "A structured everyday layer."
  },
  {
    id: "fallback-3",
    name: "Stone Trousers",
    price: 1799,
    image_url: "https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?auto=format&fit=crop&w=1000&q=85",
    category: "men",
    sizes: ["30", "32", "34", "36"],
    description: "Relaxed tailored trousers."
  }
];

function readArray(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

let cart = readArray(CART_KEY);
let wishlist = readArray(WISH_KEY).map(String);

function saveCart() {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
}

function saveWishlist() {
  localStorage.setItem(WISH_KEY, JSON.stringify(wishlist));
}

function money(value) {
  return "₹" + Number(value || 0).toLocaleString("en-IN");
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function getImage(product) {
  if (Array.isArray(product.images) && product.images.length) {
    return product.images[0];
  }

  if (typeof product.images === "string" && product.images.trim()) {
    try {
      const parsed = JSON.parse(product.images);
      if (Array.isArray(parsed) && parsed[0]) return parsed[0];
    } catch {
      return product.images;
    }
  }

  return product.image_url || "";
}

function normalizeProduct(product) {
  let sizes = product.sizes;

  if (typeof sizes === "string") {
    try {
      sizes = JSON.parse(sizes);
    } catch {
      sizes = sizes.split(",").map(size => size.trim());
    }
  }

  return {
    ...product,
    sizes: Array.isArray(sizes) ? sizes : ["S", "M", "L", "XL"]
  };
}

function toast(message) {
  const element = $("toast");
  if (!element) return;

  element.textContent = message;
  element.classList.add("show");

  clearTimeout(window.__aurenarToastTimer);
  window.__aurenarToastTimer = setTimeout(() => {
    element.classList.remove("show");
  }, 2300);
}

/* PRODUCTS */

async function loadProducts() {
  const status = $("productStatus");

  try {
    const { data, error } = await supabase
      .from("products")
      .select("id,name,price,image_url,category,sizes,description,is_active,created_at")
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (error) throw error;

    products = (data || []).map(normalizeProduct);
  } catch (error) {
    console.error("AURENAR product loading error:", error);
    products = [];
  }

  if (!products.length) {
    products = fallbackProducts.map(normalizeProduct);

    if (status) {
      status.textContent = "Preview collection";
    }
  }

  renderProducts();
  updateBagCount();
  renderBag();
  updateWishlistButton();
}

/* FILTERS */

function filteredProducts() {
  if (activeFilter === "all") return products;

  return products.filter(product => {
    const category = String(product.category || "").toLowerCase();
    return category === activeFilter;
  });
}

/* PRODUCT CARDS */

function renderProducts() {
  const container = $("products");
  if (!container) return;

  const visible = filteredProducts();
  const status = $("productStatus");

  if (status && !status.textContent.includes("Preview")) {
    status.textContent =
      `${visible.length} ${visible.length === 1 ? "piece" : "pieces"}`;
  }

  if (!visible.length) {
    container.innerHTML =
      '<div class="empty-products">No pieces available in this collection.</div>';
    return;
  }

  container.innerHTML = visible.map(product => {
    const image = getImage(product);
    const saved = wishlist.includes(String(product.id));

    return `
      <article class="product-card">
        <div class="photo">
          <a
            href="/product.html?id=${encodeURIComponent(product.id)}"
            aria-label="${escapeHTML(product.name)}"
          >
            ${
              image
                ? `<img src="${escapeHTML(image)}" alt="${escapeHTML(product.name)}" loading="lazy">`
                : `<div class="placeholder">AURENAR</div>`
            }
          </a>

          <button
            type="button"
            class="product-wishlist ${saved ? "is-active" : ""}"
            data-wishlist="${escapeHTML(product.id)}"
            aria-label="${saved ? "Remove from wishlist" : "Add to wishlist"}"
            aria-pressed="${saved}"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M20.8 8.7c0 5.2-8.8 10.3-8.8 10.3S3.2 13.9 3.2 8.7C3.2 5.8 5.3 4 7.8 4c1.7 0 3.3.9 4.2 2.3C12.9 4.9 14.5 4 16.2 4c2.5 0 4.6 1.8 4.6 4.7Z"></path>
            </svg>
          </button>
        </div>

        <div class="info">
          <a
            href="/product.html?id=${encodeURIComponent(product.id)}"
            class="product-link"
          >
            <div class="name">${escapeHTML(product.name)}</div>
            <div class="price">${money(product.price)}</div>
          </a>

          <button
            type="button"
            class="cardbtn"
            data-add="${escapeHTML(product.id)}"
          >
            ADD TO BAG
          </button>
        </div>
      </article>
    `;
  }).join("");
}

/* WISHLIST */

function toggleWishlist(id) {
  const key = String(id);
  const exists = wishlist.includes(key);

  wishlist = exists
    ? wishlist.filter(item => item !== key)
    : [...wishlist, key];

  saveWishlist();
  renderProducts();
  updateWishlistButton();

  toast(exists ? "Removed from wishlist" : "Added to wishlist");
}

function updateWishlistButton() {
  const button = $("wishlistBtn");
  if (!button) return;

  button.classList.toggle("is-active", wishlist.length > 0);
  button.setAttribute(
    "aria-label",
    `Wishlist, ${wishlist.length} saved items`
  );
}

function showWishlist() {
  const results = $("searchResults");
  const input = $("searchInput");
  if (!results) return;

  if (input) input.value = "";

  const saved = products.filter(product =>
    wishlist.includes(String(product.id))
  );

  results.innerHTML = saved.length
    ? `<p class="eyebrow">YOUR WISHLIST · ${saved.length}</p>` +
      saved.map(product => `
        <div class="search-result">
          <a href="/product.html?id=${encodeURIComponent(product.id)}">
            ${escapeHTML(product.name)} · ${money(product.price)}
          </a>
          <button type="button" data-remove-wish="${escapeHTML(product.id)}">
            REMOVE
          </button>
        </div>
      `).join("")
    : '<p class="msg">Your wishlist is empty. Save a piece you love.</p>';

  openDrawer("searchDrawer");
}

/* BAG */

function addToBag(id) {
  const product = products.find(item => String(item.id) === String(id));
  if (!product) return;

  const existing = cart.find(item => String(item.id) === String(id));

  if (existing) {
    existing.qty = Number(existing.qty || 1) + 1;
  } else {
    cart.push({ id: product.id, qty: 1 });
  }

  saveCart();
  updateBagCount();
  renderBag();

  toast("Added to bag");
  openDrawer("bagDrawer");
}

function changeQuantity(id, amount) {
  const item = cart.find(entry => String(entry.id) === String(id));
  if (!item) return;

  item.qty = Number(item.qty || 1) + amount;

  cart = cart.filter(entry => item !== entry || item.qty > 0);

  saveCart();
  updateBagCount();
  renderBag();
}

function updateBagCount() {
  const count = cart.reduce(
    (total, item) => total + Number(item.qty || 0),
    0
  );

  if ($("bagCount")) $("bagCount").textContent = count;
}

function renderBag() {
  const body = $("bagBody");
  const foot = $("bagFoot");
  if (!body) return;

  cart = cart.filter(item =>
    products.some(product => String(product.id) === String(item.id))
  );

  saveCart();

  if (!cart.length) {
    body.innerHTML = '<p class="msg">Your bag is empty.</p>';
    if (foot) foot.innerHTML = "";
    updateBagCount();
    return;
  }

  let subtotal = 0;

  body.innerHTML = cart.map(item => {
    const product = products.find(
      candidate => String(candidate.id) === String(item.id)
    );

    if (!product) return "";

    const lineTotal = Number(product.price || 0) * Number(item.qty || 1);
    subtotal += lineTotal;

    const image = getImage(product);

    return `
      <div class="bagrow">
        ${
          image
            ? `<img src="${escapeHTML(image)}" alt="" width="56" height="70">`
            : ""
        }

        <div>
          <strong>${escapeHTML(product.name)}</strong>
          <br>
          <span class="msg">${money(product.price)}</span>
        </div>

        <div>
          <button type="button" data-quantity="${escapeHTML(product.id)}" data-change="-1" aria-label="Decrease quantity">−</button>
          <span>${Number(item.qty || 1)}</span>
          <button type="button" data-quantity="${escapeHTML(product.id)}" data-change="1" aria-label="Increase quantity">+</button>
        </div>
      </div>
    `;
  }).join("");

  const shipping = subtotal >= 2500 ? 0 : 199;

  if (foot) {
    foot.innerHTML = `
      <div class="bag-total">
        <span>Subtotal</span>
        <strong>${money(subtotal)}</strong>
      </div>
      <div class="bag-total">
        <span>Shipping</span>
        <strong>${shipping ? money(shipping) : "COMPLIMENTARY"}</strong>
      </div>
      <div class="bag-total">
        <span>Total</span>
        <strong>${money(subtotal + shipping)}</strong>
      </div>
      <button type="button" class="primary" id="checkoutButton">
        CONTINUE TO CHECKOUT
      </button>
    `;
  }

  updateBagCount();
}

/* DRAWERS */

function openDrawer(id) {
  const drawer = $(id);
  const overlay = $("overlay");
  if (!drawer) return;

  all(".drawer.open").forEach(item => {
    item.classList.remove("open");
    item.setAttribute("aria-hidden", "true");
  });

  drawer.classList.add("open");
  drawer.setAttribute("aria-hidden", "false");

  if (overlay) {
    overlay.hidden = false;
    requestAnimationFrame(() => overlay.classList.add("open"));
  }
}

function closeDrawers() {
  all(".drawer.open").forEach(drawer => {
    drawer.classList.remove("open");
    drawer.setAttribute("aria-hidden", "true");
  });

  const overlay = $("overlay");

  if (overlay) {
    overlay.classList.remove("open");
    setTimeout(() => {
      if (!document.querySelector(".drawer.open")) overlay.hidden = true;
    }, 250);
  }
}

/* SEARCH — name, category, and description */

function searchProducts(query) {
  const results = $("searchResults");
  if (!results) return;

  const term = String(query || "").trim().toLowerCase();

  if (!term) {
    results.innerHTML = '<p class="msg">Search the AURENAR collection.</p>';
    return;
  }

  const matches = products.filter(product => {
    const searchable = [
      product.name,
      product.category,
      product.description
    ].join(" ").toLowerCase();

    return searchable.includes(term);
  });

  results.innerHTML = matches.length
    ? matches.map(product => `
        <a class="search-result" href="/product.html?id=${encodeURIComponent(product.id)}">
          <span>${escapeHTML(product.name)}</span>
          <span>${money(product.price)} ↗</span>
        </a>
      `).join("")
    : '<p class="msg">No matching pieces found.</p>';
}

/* ACCOUNT */

function renderAccount() {
  const body = $("accountBody");
  if (!body) return;

  body.innerHTML = `
    <div class="account-panel">
      <p class="eyebrow">AURENAR ACCOUNT</p>
      <h3>Your account</h3>
      <p class="msg">
        Account sign-in and order history can be connected here.
      </p>
      <a
        href="/checkout.html"
        class="primary"
        style="display:block;text-align:center;margin-top:25px"
      >
        CONTINUE TO CHECKOUT
      </a>
    </div>
  `;
}

/* EVENTS */

document.addEventListener("click", event => {
  const filter = event.target.closest("[data-filter]");

  if (filter) {
    event.preventDefault();

    activeFilter = filter.dataset.filter || "all";

    all(".filter").forEach(button => {
      button.classList.toggle(
        "is-active",
        button.dataset.filter === activeFilter
      );
    });

    renderProducts();

    const mobileNav = $("mobileNav");
    if (mobileNav) {
      mobileNav.classList.remove("open");
      mobileNav.setAttribute("aria-hidden", "true");
    }

    return;
  }

  const wish = event.target.closest("[data-wishlist]");
  if (wish) {
    event.preventDefault();
    event.stopPropagation();
    toggleWishlist(wish.dataset.wishlist);
    return;
  }

  const removeWish = event.target.closest("[data-remove-wish]");
  if (removeWish) {
    event.preventDefault();
    toggleWishlist(removeWish.dataset.removeWish);
    showWishlist();
    return;
  }

  const add = event.target.closest("[data-add]");
  if (add) {
    event.preventDefault();
    addToBag(add.dataset.add);
    return;
  }

  const quantity = event.target.closest("[data-quantity]");
  if (quantity) {
    event.preventDefault();
    changeQuantity(
      quantity.dataset.quantity,
      Number(quantity.dataset.change)
    );
    return;
  }

  if (event.target.closest("#bagBtn")) {
    renderBag();
    openDrawer("bagDrawer");
    return;
  }

  if (event.target.closest("#wishlistBtn")) {
    showWishlist();
    return;
  }

  if (event.target.closest("#accountBtn")) {
    renderAccount();
    openDrawer("accountDrawer");
    return;
  }

  if (event.target.closest("#searchBtn")) {
    openDrawer("searchDrawer");
    setTimeout(() => $("searchInput")?.focus(), 250);
    return;
  }

  if (event.target.closest("#menuBtn")) {
    const nav = $("mobileNav");
    if (nav) {
      const opened = nav.classList.toggle("open");
      nav.setAttribute("aria-hidden", String(!opened));
    }
    return;
  }

  if (event.target.closest("[data-close]") || event.target.id === "overlay") {
    closeDrawers();
    return;
  }

  if (event.target.closest("#checkoutButton")) {
    closeDrawers();
    const checkout = $("checkoutDrawer");

    if (checkout) {
      openDrawer("checkoutDrawer");
    } else {
      window.location.href = "/checkout.html";
    }
  }
});

document.addEventListener("input", event => {
  if (event.target.id === "searchInput") {
    searchProducts(event.target.value);
  }
});

document.addEventListener("submit", event => {
  if (event.target.id === "checkoutForm") {
    event.preventDefault();
    toast("Online payment is not connected yet.");
  }
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape") closeDrawers();
});

/* START */

loadProducts();
