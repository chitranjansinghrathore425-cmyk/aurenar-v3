
import { supabase } from "./supabase-client.js";

const CART_KEY = "aurenar_cart";
const WISH_KEY = "aurenar_wishlist";

let products = [];
let currentProduct = null;
let selectedSize = "";
let galleryImages = [];
let galleryIndex = 0;

const $ = (id) => document.getElementById(id);

function readStorage(key, fallback = []) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "null");
    return Array.isArray(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

function saveStorage(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));
}

function safeImage(url) {
  if (!url) return "";
  try {
    const parsed = new URL(url, window.location.origin);
    return ["http:", "https:"].includes(parsed.protocol) ? parsed.href : "";
  } catch {
    return "";
  }
}

function money(value) {
  return "₹" + Number(value || 0).toLocaleString("en-IN");
}

function toast(message) {
  const element = $("toast");
  if (!element) return;
  element.textContent = message;
  element.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => element.classList.remove("show"), 2500);
}

function normalizeProduct(product) {
  let images = [];

  if (Array.isArray(product.images)) {
    images = product.images;
  } else if (typeof product.images === "string") {
    try {
      const parsed = JSON.parse(product.images);
      if (Array.isArray(parsed)) images = parsed;
    } catch {}
  }

  if (product.image_url) images.unshift(product.image_url);

  images = [...new Set(images.map(safeImage).filter(Boolean))];

  return {
    ...product,
    id: String(product.id),
    name: product.name || "AURENAR Product",
    price: Number(product.price || 0),
    images,
    sizes: Array.isArray(product.sizes)
      ? product.sizes
      : typeof product.sizes === "string"
        ? product.sizes.split(",").map(size => size.trim()).filter(Boolean)
        : []
  };
}

function openDrawer(id) {
  closeDrawers();
  const drawer = $(id);
  if (!drawer) return;
  drawer.classList.add("open");
  $("overlay")?.classList.add("show");
  document.body.style.overflow = "hidden";
}

function closeDrawers() {
  document.querySelectorAll(".drawer.open").forEach(drawer => {
    drawer.classList.remove("open");
  });
  $("overlay")?.classList.remove("show");
  document.body.style.overflow = "";
}

function openSizeGuide() {
  $("sizeModal")?.classList.add("open");
}

function closeSizeGuide() {
  $("sizeModal")?.classList.remove("open");
}

function getProductIdFromURL() {
  const params = new URLSearchParams(location.search);
  return params.get("id") || params.get("slug");
}

function findProductFromURL() {
  const requested = getProductIdFromURL();

  if (!requested) return null;

  return products.find(product =>
    String(product.id) === String(requested) ||
    String(product.slug || "") === String(requested)
  ) || null;
}

function renderGallery() {
  const mainImage = $("mainImage");
  const thumbs = $("galleryThumbs");

  if (!mainImage || !thumbs) return;

  if (!galleryImages.length) {
    mainImage.removeAttribute("src");
    mainImage.alt = "Product image unavailable";
    thumbs.innerHTML = "";
    $("galleryCount").textContent = "0 / 0";
    return;
  }

  galleryIndex = Math.max(0, Math.min(galleryIndex, galleryImages.length - 1));

  mainImage.src = galleryImages[galleryIndex];
  mainImage.alt = currentProduct?.name || "AURENAR product";
  $("galleryCount").textContent = `${galleryIndex + 1} / ${galleryImages.length}`;

  thumbs.innerHTML = galleryImages.map((image, index) => `
    <button class="gallery-thumb ${index === galleryIndex ? "selected" : ""}"
      type="button" data-image-index="${index}" aria-label="View image ${index + 1}">
      <img src="${image}" alt="">
    </button>
  `).join("");
}

function changeImage(direction) {
  if (!galleryImages.length) return;
  galleryIndex = (galleryIndex + direction + galleryImages.length) % galleryImages.length;
  renderGallery();
}

function renderSizes() {
  const container = $("sizeOptions");
  if (!container || !currentProduct) return;

  const sizes = currentProduct.sizes.length
    ? currentProduct.sizes
    : ["S", "M", "L", "XL"];

  if (!sizes.includes(selectedSize)) selectedSize = "";

  container.innerHTML = sizes.map(size => `
    <button type="button"
      class="size-option ${selectedSize === size ? "selected" : ""}"
      data-size="${escapeHTML(size)}">
      ${escapeHTML(size)}
    </button>
  `).join("");
}

function isWishlisted(id) {
  return readStorage(WISH_KEY).some(item => String(item) === String(id));
}

function updateWishlistButton() {
  const button = $("productHeart");
  if (!button || !currentProduct) return;
  button.textContent = isWishlisted(currentProduct.id) ? "♥" : "♡";
  button.setAttribute("aria-pressed", String(isWishlisted(currentProduct.id)));
}

function toggleWishlist(id) {
  let wishlist = readStorage(WISH_KEY);
  const exists = wishlist.some(item => String(item) === String(id));

  wishlist = exists
    ? wishlist.filter(item => String(item) !== String(id))
    : [...wishlist, id];

  saveStorage(WISH_KEY, wishlist);
  updateWishlistButton();
  toast(exists ? "Removed from wishlist" : "Added to wishlist");
}

function renderProduct() {
  if (!currentProduct) return;

  $("productName").textContent = currentProduct.name;
  $("productPrice").textContent = money(currentProduct.price);
  $("productColour").textContent = currentProduct.colour
    ? `Colour: ${currentProduct.colour}`
    : "";

  $("productDescription").textContent =
    currentProduct.description || "Discover the details of this AURENAR piece.";

  $("productDetailsText").textContent =
    currentProduct.material || "Designed with attention to fabric, fit and finish.";

  galleryImages = currentProduct.images;
  galleryIndex = 0;

  renderGallery();
  renderSizes();
  updateWishlistButton();
}

function getCart() {
  return readStorage(CART_KEY).map(item => ({
    id: String(item.id),
    size: item.size || "",
    qty: Math.max(1, Number(item.qty || item.quantity || 1))
  }));
}

function saveCart(cart) {
  saveStorage(CART_KEY, cart);
  updateBagCount();
  renderBag();
}

function updateBagCount() {
  const count = getCart().reduce((sum, item) => sum + item.qty, 0);
  if ($("bagCount")) $("bagCount").textContent = count;
}

function addToBag() {
  if (!currentProduct) return;

  if (!selectedSize) {
    toast("Please select a size first");
    return;
  }

  const cart = getCart();
  const existing = cart.find(item =>
    item.id === currentProduct.id && item.size === selectedSize
  );

  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({
      id: currentProduct.id,
      size: selectedSize,
      qty: 1
    });
  }

  saveCart(cart);
  toast("Added to your bag");
}

function changeCartQuantity(id, size, amount) {
  const cart = getCart();
  const item = cart.find(entry =>
    entry.id === String(id) && entry.size === (size || "")
  );

  if (!item) return;

  item.qty += amount;
  saveCart(cart.filter(entry => entry.qty > 0));
}

function removeCartItem(id, size) {
  const cart = getCart().filter(item =>
    !(item.id === String(id) && item.size === (size || ""))
  );
  saveCart(cart);
}

function renderBag() {
  const body = $("bagBody");
  const foot = $("bagFoot");
  if (!body || !foot) return;

  const cart = getCart();

  if (!cart.length) {
    body.innerHTML = `<p>Your bag is currently empty.</p><a href="/search.html">DISCOVER COLLECTION</a>`;
    foot.innerHTML = "";
    return;
  }

  let subtotal = 0;

  body.innerHTML = cart.map(item => {
    const product = products.find(product => product.id === item.id);
    if (!product) {
      return `
        <div style="padding:12px 0;border-bottom:1px solid #333">
          <p>Product unavailable</p>
          <button class="text-button" data-remove-id="${escapeHTML(item.id)}"
            data-remove-size="${escapeHTML(item.size)}">REMOVE</button>
        </div>`;
    }

    const lineTotal = product.price * item.qty;
    subtotal += lineTotal;
    const image = product.images[0] || "";

    return `
      <div style="display:flex;gap:13px;padding:12px 0;border-bottom:1px solid #333">
        ${image ? `<img src="${image}" alt="" style="width:82px;height:108px;object-fit:cover">` : ""}
        <div style="flex:1">
          <strong>${escapeHTML(product.name)}</strong>
          <p style="font-size:12px;color:#aaa">Size: ${escapeHTML(item.size || "Not selected")}</p>
          <p>${money(product.price)}</p>
          <div style="display:flex;gap:13px;align-items:center">
            <button class="secondary" data-qty="-1" data-id="${escapeHTML(item.id)}" data-size="${escapeHTML(item.size)}">−</button>
            <span>${item.qty}</span>
            <button class="secondary" data-qty="1" data-id="${escapeHTML(item.id)}" data-size="${escapeHTML(item.size)}">+</button>
            <button class="text-button" data-remove-id="${escapeHTML(item.id)}" data-remove-size="${escapeHTML(item.size)}">REMOVE</button>
          </div>
        </div>
      </div>`;
  }).join("");

  const shipping = subtotal === 0 || subtotal >= 2500 ? 0 : 199;
  const total = subtotal + shipping;

  foot.innerHTML = `
    <p style="display:flex;justify-content:space-between">Subtotal <span>${money(subtotal)}</span></p>
    <p style="display:flex;justify-content:space-between">Shipping <span>${shipping ? money(shipping) : "Complimentary"}</span></p>
    <p style="display:flex;justify-content:space-between;font-weight:700">Total <span>${money(total)}</span></p>
    <button id="goCheckout" type="button">CONTINUE TO CHECKOUT</button>`;
}

function renderCheckout() {
  const summary = $("checkoutSummary");
  if (!summary) return;

  const cart = getCart();
  const total = cart.reduce((sum, item) => {
    const product = products.find(product => product.id === item.id);
    return sum + (product ? product.price * item.qty : 0);
  }, 0);

  summary.innerHTML = `
    <h3>Order summary</h3>
    ${cart.map(item => {
      const product = products.find(product => product.id === item.id);
      if (!product) return "";
      return `<p>${escapeHTML(product.name)} · ${escapeHTML(item.size)} × ${item.qty}
        <span style="float:right">${money(product.price * item.qty)}</span></p>`;
    }).join("")}
    <hr><p><strong>Total: ${money(total)}</strong></p>`;
}

function renderRelatedProducts() {
  const container = $("relatedProducts");
  if (!container || !currentProduct) return;

  const related = products
    .filter(product => product.id !== currentProduct.id)
    .sort((a, b) => {
      const aMatch = a.category === currentProduct.category ? 1 : 0;
      const bMatch = b.category === currentProduct.category ? 1 : 0;
      return bMatch - aMatch;
    })
    .slice(0, 4);

  container.innerHTML = related.map(product => {
    const image = product.images[0] || "";
    return `
      <a href="/product.html?id=${encodeURIComponent(product.id)}">
        ${image ? `<img src="${image}" alt="${escapeHTML(product.name)}">` : `<div style="aspect-ratio:3/4;background:#181818"></div>`}
        <p>${escapeHTML(product.name)}</p>
        <small>${money(product.price)}</small>
      </a>`;
  }).join("");
}

function renderSearch(query = "") {
  const container = $("searchResults");
  if (!container) return;

  const term = query.trim().toLowerCase();

  const matches = products.filter(product =>
    product.name.toLowerCase().includes(term) ||
    String(product.category || "").toLowerCase().includes(term)
  ).slice(0, 10);

  if (!matches.length) {
    container.innerHTML = `<p style="color:#aaa;font-size:12px">No matching products found.</p>`;
    return;
  }

  container.innerHTML = matches.map(product => `
    <a href="/product.html?id=${encodeURIComponent(product.id)}"
      style="display:flex;gap:12px;align-items:center;padding:12px 0;border-bottom:1px solid #333">
      ${product.images[0] ? `<img src="${product.images[0]}" alt="" style="width:55px;height:70px;object-fit:cover">` : ""}
      <span>${escapeHTML(product.name)}<br><small>${money(product.price)}</small></span>
    </a>
  `).join("");
}

async function renderAccount() {
  const message = $("accountMessage");
  if (!message) return;

  const { data: { session }, error } = await supabase.auth.getSession();

  if (error) {
    message.textContent = error.message;
    return;
  }

  if (session?.user) {
    $("accountBody").innerHTML = `
      <p>Signed in as</p>
      <p>${escapeHTML(session.user.email)}</p>
      <button class="primary-button" id="logoutBtn">SIGN OUT</button>`;
    $("logoutBtn")?.addEventListener("click", async () => {
      const result = await supabase.auth.signOut();
      if (result.error) toast(result.error.message);
      else {
        toast("Signed out");
        renderAccount();
      }
    });
  }
}

async function login() {
  const email = $("accountEmail")?.value.trim();
  const password = $("accountPassword")?.value;
  const message = $("accountMessage");

  if (!email || !password) {
    if (message) message.textContent = "Enter your email and password.";
    return;
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    if (message) message.textContent = error.message;
    return;
  }

  toast("Welcome back");
  renderAccount();
}

async function signup() {
  const email = $("accountEmail")?.value.trim();
  const password = $("accountPassword")?.value;
  const message = $("accountMessage");

  if (!email || !password) {
    if (message) message.textContent = "Enter your email and password.";
    return;
  }

  if (password.length < 6) {
    if (message) message.textContent = "Password must be at least 6 characters.";
    return;
  }

  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    if (message) message.textContent = error.message;
    return;
  }

  if (message) {
    message.textContent = data.session
      ? "Your account has been created."
      : "Check your email to confirm your account.";
  }
}

async function loadProducts() {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) {
    $("productName").textContent = "Unable to load product";
    $("productMessage").textContent = error.message;
    return;
  }

  products = (data || []).map(normalizeProduct);
  currentProduct = findProductFromURL();

  if (!currentProduct) {
    $("productName").textContent = "Product not found";
    $("productMessage").textContent = "Please return to the collection and choose a product.";
    $("productDetail").querySelector(".purchase-row")?.remove();
    $("productDetail").querySelector(".product-accordions")?.remove();
    $("relatedSection").hidden = true;
    return;
  }

  selectedSize = "";
  renderProduct();
  renderRelatedProducts();
  renderBag();
  renderCheckout();
  updateBagCount();
}

function wireInterface() {
  $("bagBtn")?.addEventListener("click", () => {
    renderBag();
    openDrawer("bagDrawer");
  });

  $("accountBtn")?.addEventListener("click", () => {
    renderAccount();
    openDrawer("accountDrawer");
  });

  $("searchBtn")?.addEventListener("click", () => {
    openDrawer("searchDrawer");
    renderSearch($("searchInput")?.value || "");
    $("searchInput")?.focus();
  });

  $("wishlistBtn")?.addEventListener("click", () => {
    const wishlist = readStorage(WISH_KEY);
    const saved = products.filter(product => wishlist.includes(product.id));

    $("searchResults").innerHTML = saved.length
      ? saved.map(product => `
        <a href="/product.html?id=${encodeURIComponent(product.id)}"
          style="display:flex;gap:12px;padding:12px 0;border-bottom:1px solid #333">
          ${product.images[0] ? `<img src="${product.images[0]}" alt="" style="width:55px;height:70px;object-fit:cover">` : ""}
          <span>${escapeHTML(product.name)}<br><small>${money(product.price)}</small></span>
        </a>`).join("")
      : "<p>Your wishlist is empty.</p>";

    openDrawer("searchDrawer");
  });

  $("productHeart")?.addEventListener("click", () => {
    if (currentProduct) toggleWishlist(currentProduct.id);
  });

  $("addToBagBtn")?.addEventListener("click", addToBag);

  $("sizeOptions")?.addEventListener("click", event => {
    const button = event.target.closest("[data-size]");
    if (!button) return;
    selectedSize = button.dataset.size;
    renderSizes();
  });

  $("galleryThumbs")?.addEventListener("click", event => {
    const button = event.target.closest("[data-image-index]");
    if (!button) return;
    galleryIndex = Number(button.dataset.imageIndex);
    renderGallery();
  });

  $("prevImage")?.addEventListener("click", () => changeImage(-1));
  $("nextImage")?.addEventListener("click", () => changeImage(1));

  let touchStartX = 0;
  $("galleryStage")?.addEventListener("touchstart", event => {
    touchStartX = event.changedTouches[0].clientX;
  }, { passive: true });

  $("galleryStage")?.addEventListener("touchend", event => {
    const difference = event.changedTouches[0].clientX - touchStartX;
    if (Math.abs(difference) > 45) changeImage(difference < 0 ? 1 : -1);
  }, { passive: true });

  $("sizeGuideBtn")?.addEventListener("click", openSizeGuide);
  $("closeSizeGuide")?.addEventListener("click", closeSizeGuide);

  $("sizeModal")?.addEventListener("click", event => {
    if (event.target.id === "sizeModal") closeSizeGuide();
  });

  $("overlay")?.addEventListener("click", closeDrawers);

  document.querySelectorAll("[data-close]").forEach(button => {
    button.addEventListener("click", closeDrawers);
  });

  $("menuBtn")?.addEventListener("click", () => {
    $("mobileNav")?.classList.toggle("open");
  });

  $("searchInput")?.addEventListener("input", event => {
    renderSearch(event.target.value);
  });

  $("bagBody")?.addEventListener("click", event => {
    const quantityButton = event.target.closest("[data-qty]");
    if (quantityButton) {
      changeCartQuantity(
        quantityButton.dataset.id,
        quantityButton.dataset.size,
        Number(quantityButton.dataset.qty)
      );
      return;
    }

    const removeButton = event.target.closest("[data-remove-id]");
    if (removeButton) {
      removeCartItem(removeButton.dataset.removeId, removeButton.dataset.removeSize);
    }
  });

  $("bagFoot")?.addEventListener("click", event => {
    if (event.target.id !== "goCheckout") return;
    renderCheckout();
    openDrawer("checkoutDrawer");
  });

  $("loginBtn")?.addEventListener("click", login);
  $("signupBtn")?.addEventListener("click", signup);

  supabase.auth.onAuthStateChange(() => {
    if ($("accountDrawer")?.classList.contains("open")) renderAccount();
  });
}

wireInterface();
updateBagCount();
loadProducts();
