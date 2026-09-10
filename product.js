import { supabase } from "./supabase.js";

const FALLBACK = [
  {
    id: "fallback-1",
    name: "White Linen Shirt",
    slug: "white-linen-shirt",
    price: 1499,
    compare_at_price: null,
    description:
      "A clean linen essential with a relaxed, considered silhouette.",
    images: [
      "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?auto=format&fit=crop&w=1400&q=84"
    ],
    sizes: ["S", "M", "L", "XL"],
    stock: 25,
    is_active: true
  },
  {
    id: "fallback-2",
    name: "Noir Overshirt",
    slug: "noir-overshirt",
    price: 1899,
    compare_at_price: null,
    description:
      "A structured everyday layer in a deep, understated tone.",
    images: [
      "https://images.unsplash.com/photo-1598808503746-f34c53b9323e?auto=format&fit=crop&w=1400&q=84"
    ],
    sizes: ["S", "M", "L", "XL"],
    stock: 18,
    is_active: true
  },
  {
    id: "fallback-3",
    name: "Stone Trousers",
    slug: "stone-trousers",
    price: 1799,
    compare_at_price: null,
    description:
      "Relaxed tailored trousers designed for an effortless line.",
    images: [
      "https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?auto=format&fit=crop&w=1400&q=84"
    ],
    sizes: ["30", "32", "34", "36"],
    stock: 14,
    is_active: true
  }
];

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const CART_KEY = "aurenar_cart";
const WISHLIST_KEY = "aurenar_wishlist";

let products = [];
let currentProduct = null;


/* -------------------- HELPERS -------------------- */

function readCart() {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY) || "[]");
  } catch {
    return [];
  }
}

function writeCart(value) {
  localStorage.setItem(CART_KEY, JSON.stringify(value));
}

function readWishlist() {
  try {
    return JSON.parse(localStorage.getItem(WISHLIST_KEY) || "[]");
  } catch {
    return [];
  }
}

function writeWishlist(value) {
  localStorage.setItem(WISHLIST_KEY, JSON.stringify(value));
}

function money(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(Number(value) || 0);
}

function safe(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));
}

function getImages(product) {
  if (Array.isArray(product.images)) {
    return product.images.filter(Boolean);
  }

  if (typeof product.images === "string") {
    try {
      const parsed = JSON.parse(product.images);
      return Array.isArray(parsed) ? parsed.filter(Boolean) : [product.images];
    } catch {
      return [product.images];
    }
  }

  return [];
}

function productImage(product) {
  return (
    getImages(product)[0] ||
    "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=1400&q=84"
  );
}


/* -------------------- TOAST -------------------- */

function toast(message) {
  const element = $("#toast");

  if (!element) return;

  element.textContent = message;
  element.classList.add("show");

  clearTimeout(window.__aurenarToast);

  window.__aurenarToast = setTimeout(() => {
    element.classList.remove("show");
  }, 2200);
}


/* -------------------- DRAWERS -------------------- */

function openDrawer(id) {
  const drawer = $("#" + id);
  const overlay = $("#overlay");

  if (!drawer) return;

  drawer.classList.add("open");
  drawer.setAttribute("aria-hidden", "false");

  if (overlay) {
    overlay.hidden = false;
    overlay.classList.add("open");
  }
}

function closeDrawer(id) {
  const drawer = $("#" + id);

  if (!drawer) return;

  drawer.classList.remove("open");
  drawer.setAttribute("aria-hidden", "true");

  if (!$$(".drawer.open").length) {
    const overlay = $("#overlay");

    if (overlay) {
      overlay.hidden = true;
      overlay.classList.remove("open");
    }
  }
}


/* -------------------- BAG COUNT -------------------- */

function updateBagCount() {
  const count = readCart().reduce(
    (total, item) => total + Number(item.qty || 0),
    0
  );

  const counter = $("#bagCount");

  if (counter) {
    counter.textContent = count;
  }
}


/* -------------------- PRODUCT LOAD -------------------- */

async function loadProducts() {
  let data = null;

  try {
    const response = await supabase
      .from("products")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (response.error) {
      throw response.error;
    }

    data = response.data || [];
  } catch (error) {
    console.warn("Supabase product loading failed:", error);
  }

  products = (data || []).map(product => ({
    ...product,
    images: getImages(product),
    sizes: Array.isArray(product.sizes) ? product.sizes : []
  }));

  if (!products.length) {
    products = FALLBACK;
  }

  const params = new URLSearchParams(window.location.search);

  const id = params.get("id");
  const slug = params.get("slug");

  currentProduct =
    products.find(product => String(product.id) === String(id)) ||
    products.find(product => product.slug === slug) ||
    products[0];

  if (currentProduct) {
    renderProduct(currentProduct);
  }
}


/* -------------------- PRODUCT RENDER -------------------- */

function renderProduct(product) {
  const root = $("#productDetail");

  if (!root) return;

  document.title = `${product.name} — AURENAR`;

  const images = getImages(product);

  const galleryImages = images.length
    ? images
    : [productImage(product)];

  const wishlist = readWishlist();

  const isWishlisted = wishlist.some(
    id => String(id) === String(product.id)
  );

  root.innerHTML = `
    <div class="detail-gallery">

      ${galleryImages
        .map(
          (image, index) => `
            <div class="detail-image">
              <img
                src="${safe(image)}"
                alt="${safe(product.name)}${index ? " alternate view" : ""}"
                loading="${index === 0 ? "eager" : "lazy"}"
              >
            </div>
          `
        )
        .join("")}

    </div>

    <div class="detail-info">

      <p class="eyebrow">
        AURENAR / ${Number(product.stock) > 0 ? "AVAILABLE" : "SOLD OUT"}
      </p>

      <h1>${safe(product.name)}</h1>

      <div class="detail-price">
        ${money(product.price)}

        ${
          product.compare_at_price
            ? `<del>${money(product.compare_at_price)}</del>`
            : ""
        }
      </div>

      <p class="detail-desc">
        ${safe(
          product.description ||
            "A considered AURENAR essential designed for everyday wear."
        )}
      </p>

      ${
        product.sizes?.length
          ? `
            <div class="detail-field">

              <div class="field-label">
                <span>SELECT SIZE</span>

                <button
                  type="button"
                  id="sizeGuide"
                >
                  SIZE GUIDE
                </button>
              </div>

              <div
                class="size-grid"
                id="sizes"
              >

                ${product.sizes
                  .map(
                    size => `
                      <button
                        type="button"
                        class="size-option"
                        data-size="${safe(size)}"
                      >
                        ${safe(size)}
                      </button>
                    `
                  )
                  .join("")}

              </div>

            </div>
          `
          : ""
      }

      <div class="detail-actions">

        <button
          class="primary-btn"
          id="addBtn"
          ${Number(product.stock) <= 0 ? "disabled" : ""}
        >
          ${
            Number(product.stock) <= 0
              ? "OUT OF STOCK"
              : "ADD TO BAG"
          }
        </button>

        <button
          type="button"
          class="wishlist-large ${isWishlisted ? "active" : ""}"
          id="wishBtn"
        >
          ${isWishlisted ? "♥" : "♡"}
          <span>
            ${isWishlisted ? "WISHLISTED" : "WISHLIST"}
          </span>
        </button>

      </div>

      <div class="product-notes">

        <div>
          <strong>STOCK</strong>
          <span>
            ${
              Number(product.stock) > 0
                ? `${product.stock} available`
                : "Currently unavailable"
            }
          </span>
        </div>

        <div>
          <strong>DELIVERY</strong>
          <span>
            Complimentary over ₹2,500
          </span>
        </div>

        <div>
          <strong>DETAIL</strong>
          <span>
            Designed with everyday versatility in mind.
          </span>
        </div>

      </div>

    </div>
  `;

  wireProduct(product);
}


/* -------------------- PRODUCT ACTIONS -------------------- */

function wireProduct(product) {
  let selectedSize =
    product.sizes?.length === 1
      ? product.sizes[0]
      : "";

  $$(".size-option").forEach(button => {
    button.addEventListener("click", () => {

      $$(".size-option").forEach(item =>
        item.classList.remove("selected")
      );

      button.classList.add("selected");

      selectedSize = button.dataset.size;
    });
  });


  $("#addBtn")?.addEventListener("click", () => {

    if (Number(product.stock) <= 0) {
      return;
    }

    if (product.sizes?.length && !selectedSize) {
      toast("Select a size first");
      return;
    }

    const cart = readCart();

    const key = `${product.id}::${selectedSize}`;

    const existing = cart.find(item => item.key === key);

    if (existing) {
      existing.qty = Math.min(
        existing.qty + 1,
        Number(product.stock)
      );
    } else {
      cart.push({
        key,
        id: product.id,
        size: selectedSize,
        qty: 1
      });
    }

    writeCart(cart);
    updateBagCount();
    renderBag();

    toast("Added to bag");

    openDrawer("bagDrawer");
  });


  $("#wishBtn")?.addEventListener("click", () => {

    let wishlist = readWishlist();

    const exists = wishlist.some(
      id => String(id) === String(product.id)
    );

    if (exists) {
      wishlist = wishlist.filter(
        id => String(id) !== String(product.id)
      );
    } else {
      wishlist.push(product.id);
    }

    writeWishlist(wishlist);

    const button = $("#wishBtn");

    if (button) {
      const active = wishlist.some(
        id => String(id) === String(product.id)
      );

      button.classList.toggle("active", active);

      button.innerHTML = active
        ? `♥ <span>WISHLISTED</span>`
        : `♡ <span>WISHLIST</span>`;
    }

    toast(
      exists
        ? "Removed from wishlist"
        : "Added to wishlist"
    );
  });


  $("#sizeGuide")?.addEventListener("click", () => {
    toast("Size guide will be added with final measurements.");
  });
}


/* -------------------- BAG -------------------- */

function renderBag() {
  const body = $("#bagBody");
  const foot = $("#bagFoot");

  if (!body || !foot) return;

  const cart = readCart();

  if (!cart.length) {
    body.innerHTML = `
      <div class="empty-state">
        Your bag is empty.
      </div>
    `;

    foot.innerHTML = "";

    return;
  }

  let subtotal = 0;

  body.innerHTML = cart
    .map(item => {

      const product = products.find(
        p => String(p.id) === String(item.id)
      );

      if (!product) return "";

      subtotal +=
        Number(product.price || 0) *
        Number(item.qty || 0);

      return `
        <div class="bag-item">

          <img
            src="${safe(productImage(product))}"
            alt="${safe(product.name)}"
          >

          <div class="bag-item-main">

            <strong>
              ${safe(product.name)}
            </strong>

            <span>
              ${
                item.size
                  ? `Size ${safe(item.size)} · `
                  : ""
              }
              ${money(product.price)}
            </span>

            <div class="qty">

              <button
                type="button"
                data-cart-key="${safe(item.key)}"
                data-cart-delta="-1"
              >
                −
              </button>

              <span>
                ${item.qty}
              </span>

              <button
                type="button"
                data-cart-key="${safe(item.key)}"
                data-cart-delta="1"
              >
                +
              </button>

            </div>

          </div>

        </div>
      `;
    })
    .join("");

  $$("[data-cart-key]", body).forEach(button => {

    button.addEventListener("click", () => {

      const cartNow = readCart();

      const item = cartNow.find(
        entry => entry.key === button.dataset.cartKey
      );

      if (!item) return;

      item.qty += Number(
        button.dataset.cartDelta
      );

      if (item.qty <= 0) {
        const updated = cartNow.filter(
          entry => entry.key !== item.key
        );

        writeCart(updated);
      } else {
        writeCart(cartNow);
      }

      updateBagCount();
      renderBag();
    });

  });


  const shipping =
    subtotal >= 2500 || subtotal === 0
      ? 0
      : 199;

  const total = subtotal + shipping;

  foot.innerHTML = `
    <div class="totals">

      <span>
        TOTAL
      </span>

      <strong>
        ${money(total)}
      </strong>

    </div>

    <button
      class="primary-btn"
      id="checkoutBtn"
    >
      PROCEED TO CHECKOUT
    </button>
  `;

  $("#checkoutBtn")?.addEventListener(
    "click",
    () => {
      renderCheckout();
      openDrawer("checkoutDrawer");
    }
  );
}


/* -------------------- CHECKOUT -------------------- */

function renderCheckout() {
  const summary = $("#checkoutSummary");

  if (!summary) return;

  const cart = readCart();

  let subtotal = 0;

  cart.forEach(item => {

    const product = products.find(
      p => String(p.id) === String(item.id)
    );

    if (product) {
      subtotal +=
        Number(product.price || 0) *
        Number(item.qty || 0);
    }
  });

  const shipping =
    subtotal >= 2500 || subtotal === 0
      ? 0
      : 199;

  summary.innerHTML = `
    <div>
      <span>SUBTOTAL</span>
      <strong>${money(subtotal)}</strong>
    </div>

    <div>
      <span>SHIPPING</span>
      <strong>
        ${
          shipping
            ? money(shipping)
            : "COMPLIMENTARY"
        }
      </strong>
    </div>

    <div class="summary-total">
      <span>TOTAL</span>
      <strong>
        ${money(subtotal + shipping)}
      </strong>
    </div>
  `;
}


/* -------------------- ACCOUNT -------------------- */

async function account() {

  const body = $("#accountBody");

  if (!body) return;

  const {
    data,
    error
  } = await supabase.auth.getSession();

  if (error) {
    body.innerHTML = `
      <p>
        Unable to load account.
      </p>
    `;

    return;
  }

  if (data.session) {

    body.innerHTML = `
      <p class="eyebrow">
        SIGNED IN
      </p>

      <h2>
        ${safe(data.session.user.email)}
      </h2>

      <button
        class="secondary-btn"
        id="signOut"
      >
        SIGN OUT
      </button>
    `;

    $("#signOut")?.addEventListener(
      "click",
      async () => {

        await supabase.auth.signOut();

        account();
      }
    );

    return;
  }


  body.innerHTML = `
    <p class="eyebrow">
      ACCOUNT
    </p>

    <p>
      Sign in or create an account to keep
      your details ready for future orders.
    </p>

    <form
      id="accountForm"
      class="auth-form"
    >

      <input
        required
        type="email"
        name="email"
        placeholder="Email address"
      >

      <input
        required
        minlength="6"
        type="password"
        name="password"
        placeholder="Password"
      >

      <button
        class="primary-btn"
        type="submit"
      >
        SIGN IN
      </button>

      <button
        type="button"
        class="secondary-btn"
        id="signup"
      >
        CREATE ACCOUNT
      </button>

      <p
        id="accountMessage"
        class="form-message"
      ></p>

    </form>
  `;


  $("#accountForm")?.addEventListener(
    "submit",
    async event => {

      event.preventDefault();

      const form =
        event.currentTarget;

      const data =
        new FormData(form);

      const email =
        data.get("email");

      const password =
        data.get("password");

      const message =
        $("#accountMessage");

      message.textContent =
        "Signing in…";

      const result =
        await supabase.auth.signInWithPassword({
          email,
          password
        });

      if (result.error) {
        message.textContent =
          result.error.message;

        return;
      }

      message.textContent =
        "Signed in successfully.";

      account();
    }
  );


  $("#signup")?.addEventListener(
    "click",
    async () => {

      const form =
        $("#accountForm");

      const data =
        new FormData(form);

      const email =
        data.get("email");

      const password =
        data.get("password");

      const message =
        $("#accountMessage");

      message.textContent =
        "Creating account…";

      const result =
        await supabase.auth.signUp({
          email,
          password
        });

      if (result.error) {
        message.textContent =
          result.error.message;

        return;
      }

      message.textContent =
        "Account created. Check your email if confirmation is enabled.";
    }
  );
}


/* -------------------- HEADER -------------------- */

function wireHeader() {

  updateBagCount();
  renderBag();

  $("#bagBtn")?.addEventListener(
    "click",
    () => openDrawer("bagDrawer")
  );

  $("#accountBtn")?.addEventListener(
    "click",
    () => {
      openDrawer("accountDrawer");
      account();
    }
  );

  $("#searchBtn")?.addEventListener(
    "click",
    () => openDrawer("searchDrawer")
  );

  $("#wishlistBtn")?.addEventListener(
    "click",
    () => {
      const wishlist = readWishlist();

      toast(
        wishlist.length
          ? `${wishlist.length} item${wishlist.length > 1 ? "s" : ""} in wishlist`
          : "Your wishlist is empty"
      );
    }
  );


  $("#menuBtn")?.addEventListener(
    "click",
    () => {
      $("#mobileNav")?.classList.toggle("open");
    }
  );


  $("#overlay")?.addEventListener(
    "click",
    () => {
      $$(".drawer.open").forEach(
        drawer => closeDrawer(drawer.id)
      );
    }
  );


  $$("[data-close]").forEach(
    button => {
      button.addEventListener(
        "click",
        () => closeDrawer(button.dataset.close)
      );
    }
  );


  $("#checkoutForm")?.addEventListener(
    "submit",
    event => {
      event.preventDefault();
    }
  );
}


/* -------------------- START -------------------- */

wireHeader();
loadProducts();
