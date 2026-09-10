import { supabase } from "./supabase.js";

/* =========================
   AURENAR STORE
========================= */

const fallbackProducts = [
  {
    id: "demo1",
    name: "White Linen Shirt",
    price: 1499,
    images: [],
    sizes: ["S", "M", "L", "XL"],
    stock: 10,
    description: "A clean linen essential."
  },
  {
    id: "demo2",
    name: "Noir Overshirt",
    price: 1899,
    images: [],
    sizes: ["S", "M", "L", "XL"],
    stock: 10,
    description: "A structured everyday layer."
  },
  {
    id: "demo3",
    name: "Stone Trousers",
    price: 1799,
    images: [],
    sizes: ["30", "32", "34", "36"],
    stock: 10,
    description: "Relaxed tailored trousers."
  }
];

let products = [];
let activeFilter = "all";
let wishlist = JSON.parse(
  localStorage.getItem("aurenar_wishlist") || "[]"
);
let cart = JSON.parse(
  localStorage.getItem("aurenar_cart") || "[]"
);


/* =========================
   HELPERS
========================= */

const $ = id => document.getElementById(id);

const money = value =>
  "₹" + Number(value || 0).toLocaleString("en-IN");

const escapeHTML = value =>
  String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));

function saveCart() {
  localStorage.setItem(
    "aurenar_cart",
    JSON.stringify(cart)
  );
}

function saveWishlist() {
  localStorage.setItem(
    "aurenar_wishlist",
    JSON.stringify(wishlist)
  );
}

function getImage(product) {
  if (
    Array.isArray(product.images) &&
    product.images.length
  ) {
    return product.images[0];
  }

  return "";
}


/* =========================
   LOAD PRODUCTS
========================= */

async function loadProducts() {

  try {

    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("is_active", true)
      .order("created_at", {
        ascending: false
      });

    if (error) throw error;

    products = data || [];

  } catch (error) {

    console.warn(
      "Supabase products unavailable:",
      error
    );

    products = [];

  }

  if (!products.length) {
    products = fallbackProducts;
  }

  renderProducts();
  updateBagCount();
}


/* =========================
   FILTER
========================= */

function filteredProducts() {

  if (activeFilter === "all") {
    return products;
  }

  return products.filter(product => {

    const category =
      String(
        product.category ||
        product.gender ||
        ""
      ).toLowerCase();

    return category === activeFilter;

  });

}


/* =========================
   PRODUCT IMAGE
========================= */

function productImage(product) {

  const image = getImage(product);

  if (!image) {

    return `
      <div class="placeholder">
        AURENAR
      </div>
    `;

  }

  return `
    <img
      src="${escapeHTML(image)}"
      alt="${escapeHTML(product.name)}"
      loading="lazy"
    >
  `;
}


/* =========================
   WISHLIST BUTTON
========================= */

function wishlistButton(product) {

  const active = wishlist.some(
    id => String(id) === String(product.id)
  );

  return `
    <button
      class="product-wishlist ${active ? "is-active" : ""}"
      data-wishlist="${escapeHTML(product.id)}"
      aria-label="${active ? "Remove from wishlist" : "Add to wishlist"}"
      title="${active ? "Remove from wishlist" : "Add to wishlist"}"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M20.8 8.7c0 5.2-8.8 10.3-8.8 10.3S3.2 13.9 3.2 8.7C3.2 5.8 5.3 4 7.8 4c1.7 0 3.3.9 4.2 2.3C12.9 4.9 14.5 4 16.2 4c2.5 0 4.6 1.8 4.6 4.7Z"></path>
      </svg>
    </button>
  `;
}


/* =========================
   PRODUCT CARDS
========================= */

function renderProducts() {

  const container = $("products");

  if (!container) return;

  const visibleProducts = filteredProducts();

  const status = $("productStatus");

  if (status) {

    status.textContent =
      visibleProducts.length +
      (visibleProducts.length === 1
        ? " piece"
        : " pieces");

  }

  if (!visibleProducts.length) {

    container.innerHTML = `
      <div class="empty-products">
        No pieces available in this collection.
      </div>
    `;

    return;
  }

  container.innerHTML =
    visibleProducts.map(product => {

      const outOfStock =
        Number(product.stock || 0) <= 0;

      return `
        <article class="product-card">

          <div class="photo">

            <a
              href="/product.html?id=${encodeURIComponent(product.id)}"
              aria-label="${escapeHTML(product.name)}"
            >
              ${productImage(product)}
            </a>

            ${wishlistButton(product)}

          </div>

          <div class="info">

            <a
              href="/product.html?id=${encodeURIComponent(product.id)}"
              class="product-link"
            >
              <div class="name">
                ${escapeHTML(product.name)}
              </div>

              <div class="price">
                ${money(product.price)}
              </div>
            </a>

            <button
              class="cardbtn"
              data-add="${escapeHTML(product.id)}"
              ${outOfStock ? "disabled" : ""}
            >
              ${outOfStock ? "OUT OF STOCK" : "ADD TO BAG"}
            </button>

          </div>

        </article>
      `;

    }).join("");

}


/* =========================
   WISHLIST
========================= */

function toggleWishlist(id) {

  const index = wishlist.findIndex(
    item => String(item) === String(id)
  );

  if (index >= 0) {

    wishlist.splice(index, 1);
    showToast("Removed from wishlist");

  } else {

    wishlist.push(id);
    showToast("Added to wishlist");

  }

  saveWishlist();
  renderProducts();

}


/* =========================
   BAG
========================= */

function addToBag(id) {

  const product = products.find(
    item => String(item.id) === String(id)
  );

  if (!product) return;

  if (Number(product.stock || 0) <= 0) {
    showToast("This piece is out of stock");
    return;
  }

  const existing = cart.find(
    item => String(item.id) === String(id)
  );

  if (existing) {

    if (
      existing.qty <
      Number(product.stock)
    ) {
      existing.qty += 1;
    } else {
      showToast("Maximum available stock reached");
      return;
    }

  } else {

    cart.push({
      id: product.id,
      qty: 1
    });

  }

  saveCart();
  updateBagCount();
  renderBag();

  showToast("Added to bag");

}


function changeQuantity(id, change) {

  const item = cart.find(
    product => String(product.id) === String(id)
  );

  if (!item) return;

  item.qty += change;

  if (item.qty <= 0) {

    cart = cart.filter(
      product =>
        String(product.id) !== String(id)
    );

  }

  saveCart();
  updateBagCount();
  renderBag();

}


function updateBagCount() {

  const count =
    cart.reduce(
      (total, item) =>
        total + Number(item.qty || 0),
      0
    );

  const element = $("bagCount");

  if (element) {
    element.textContent = count;
  }

}


/* =========================
   BAG DRAWER
========================= */

function renderBag() {

  const body = $("bagBody");
  const foot = $("bagFoot");

  if (!body) return;

  if (!cart.length) {

    body.innerHTML = `
      <p class="msg">
        Your bag is empty.
      </p>
    `;

    if (foot) foot.innerHTML = "";

    return;
  }

  let total = 0;

  body.innerHTML = cart.map(item => {

    const product = products.find(
      p =>
        String(p.id) ===
        String(item.id)
    );

    if (!product) return "";

    const subtotal =
      Number(product.price || 0) *
      Number(item.qty || 0);

    total += subtotal;

    return `
      <div class="bagrow">

        <div>
          <strong>
            ${escapeHTML(product.name)}
          </strong>

          <br>

          <span class="msg">
            ${money(product.price)}
          </span>
        </div>

        <div>

          <button
            data-quantity="${escapeHTML(product.id)}"
            data-change="-1"
            aria-label="Decrease quantity"
          >
            −
          </button>

          <span>
            ${item.qty}
          </span>

          <button
            data-quantity="${escapeHTML(product.id)}"
            data-change="1"
            aria-label="Increase quantity"
          >
            +
          </button>

        </div>

      </div>
    `;

  }).join("");

  if (foot) {

    foot.innerHTML = `
      <div class="bag-total">
        <span>Total</span>
        <strong>${money(total)}</strong>
      </div>

      <button
        class="primary"
        id="checkoutButton"
      >
        CHECKOUT
      </button>
    `;

  }

}


/* =========================
   DRAWERS
========================= */

function openDrawer(id) {

  const drawer = $(id);
  const overlay = $("overlay");

  if (!drawer) return;

  drawer.classList.add("open");
  drawer.setAttribute(
    "aria-hidden",
    "false"
  );

  if (overlay) {

    overlay.hidden = false;

    requestAnimationFrame(() => {
      overlay.classList.add("open");
    });

  }

}


function closeDrawers() {

  document
    .querySelectorAll(".drawer.open")
    .forEach(drawer => {

      drawer.classList.remove("open");
      drawer.setAttribute(
        "aria-hidden",
        "true"
      );

    });

  const overlay = $("overlay");

  if (overlay) {

    overlay.classList.remove("open");

    setTimeout(() => {
      overlay.hidden = true;
    }, 250);

  }

}


/* =========================
   SEARCH
========================= */

function searchProducts(query) {

  const results = $("searchResults");

  if (!results) return;

  const term =
    String(query || "")
      .trim()
      .toLowerCase();

  if (!term) {

    results.innerHTML = `
      <p class="msg">
        Search the AURENAR collection.
      </p>
    `;

    return;
  }

  const matches =
    products.filter(product =>
      String(product.name || "")
        .toLowerCase()
        .includes(term)
    );

  if (!matches.length) {

    results.innerHTML = `
      <p class="msg">
        No pieces found.
      </p>
    `;

    return;
  }

  results.innerHTML =
    matches.map(product => {

      return `
        <a
          class="search-result"
          href="/product.html?id=${encodeURIComponent(product.id)}"
        >

          <div style="flex:1">
            <div>
              ${escapeHTML(product.name)}
            </div>

            <div class="msg">
              ${money(product.price)}
            </div>
          </div>

          <span>↗</span>

        </a>
      `;

    }).join("");

}


/* =========================
   ACCOUNT
========================= */

function renderAccount() {

  const body = $("accountBody");

  if (!body) return;

  body.innerHTML = `
    <div class="account-panel">

      <p class="eyebrow">
        AURENAR ACCOUNT
      </p>

      <h3>
        Your account
      </h3>

      <p class="msg">
        Sign in or create an account to manage
        your orders and personal details.
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


/* =========================
   TOAST
========================= */

let toastTimer;

function showToast(message) {

  const toast = $("toast");

  if (!toast) return;

  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(toastTimer);

  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 2200);

}


/* =========================
   FILTER EVENTS
========================= */

document.addEventListener(
  "click",
  event => {

    const filter =
      event.target.closest("[data-filter]");

    if (
      filter &&
      filter.classList.contains("filter")
    ) {

      event.preventDefault();

      activeFilter =
        filter.dataset.filter || "all";

      document
        .querySelectorAll(".filter")
        .forEach(button =>
          button.classList.remove("is-active")
        );

      filter.classList.add("is-active");

      renderProducts();

      return;
    }


    /* NAV FILTER */

    const navFilter =
      event.target.closest(
        ".desktop-nav [data-filter], .mobile-nav [data-filter]"
      );

    if (navFilter) {

      activeFilter =
        navFilter.dataset.filter || "all";

      document
        .querySelectorAll(".filter")
        .forEach(button => {

          button.classList.toggle(
            "is-active",
            button.dataset.filter ===
              activeFilter
          );

        });

      renderProducts();

    }


    /* WISHLIST */

    const wish =
      event.target.closest(
        "[data-wishlist]"
      );

    if (wish) {

      event.preventDefault();

      toggleWishlist(
        wish.dataset.wishlist
      );

      return;
    }


    /* ADD TO BAG */

    const add =
      event.target.closest(
        "[data-add]"
      );

    if (add) {

      event.preventDefault();

      addToBag(add.dataset.add);

      return;
    }


    /* QUANTITY */

    const quantity =
      event.target.closest(
        "[data-quantity]"
      );

    if (quantity) {

      event.preventDefault();

      changeQuantity(
        quantity.dataset.quantity,
        Number(quantity.dataset.change)
      );

      return;
    }


    /* BAG */

    if (
      event.target.closest("#bagBtn")
    ) {

      renderBag();
      openDrawer("bagDrawer");

      return;
    }


    /* ACCOUNT */

    if (
      event.target.closest("#accountBtn")
    ) {

      renderAccount();
      openDrawer("accountDrawer");

      return;
    }


    /* SEARCH */

    if (
      event.target.closest("#searchBtn")
    ) {

      openDrawer("searchDrawer");

      setTimeout(() => {

        const input = $("searchInput");

        if (input) input.focus();

      }, 250);

      return;
    }


    /* MOBILE MENU */

    if (
      event.target.closest("#menuBtn")
    ) {

      const nav = $("mobileNav");

      if (nav) {

        nav.classList.toggle("open");

        nav.setAttribute(
          "aria-hidden",
          nav.classList.contains("open")
            ? "false"
            : "true"
        );

      }

      return;
    }


    /* CLOSE */

    if (
      event.target.closest("[data-close]")
    ) {

      closeDrawers();
      return;
    }


    if (
      event.target.id === "overlay"
    ) {

      closeDrawers();
      return;
    }


    /* CHECKOUT */

    if (
      event.target.closest("#checkoutButton")
    ) {

      window.location.href =
        "/checkout.html";

    }

  }
);


/* =========================
   SEARCH INPUT
========================= */

document.addEventListener(
  "input",
  event => {

    if (
      event.target.id === "searchInput"
    ) {

      searchProducts(
        event.target.value
      );

    }

  }
);


/* =========================
   ESCAPE KEY
========================= */

document.addEventListener(
  "keydown",
  event => {

    if (event.key === "Escape") {
      closeDrawers();
    }

  }
);


/* =========================
   INITIALISE
========================= */

renderBag();
updateBagCount();
loadProducts();
