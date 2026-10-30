import { supabase } from "./supabase-client.js";

const CART_KEY = "aurenar_cart";
const WISH_KEY = "aurenar_wishlist";

let products = [];
let currentProduct = null;
let selectedSize = "";
let galleryImages = [];
let galleryIndex = 0;
let touchStartX = 0;

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
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
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
  toast.timer = setTimeout(() => element.classList.remove("show"), 2400);
}

function getImages(product) {
  let images = [];

  if (Array.isArray(product.images)) {
    images = product.images;
  } else if (typeof product.images === "string") {
    try {
      const parsed = JSON.parse(product.images);
      if (Array.isArray(parsed)) images = parsed;
    } catch {
      images = product.images.split(",").map(item => item.trim());
    }
  }

  if (product.image_url) images.unshift(product.image_url);

  return [...new Set(images.filter(url =>
    typeof url === "string" && /^https?:\/\//i.test(url)
  ))];
}

function getSizes(product) {
  let sizes = product.sizes || [];

  if (typeof sizes === "string") {
    try {
      sizes = JSON.parse(sizes);
    } catch {
      sizes = sizes.split(",").map(size => size.trim());
    }
  }

  if (!Array.isArray(sizes)) sizes = [];
  return sizes.map(size => String(size).trim()).filter(Boolean);
}

function getCart() {
  return readStorage(CART_KEY);
}

function saveCart(cart) {
  saveStorage(CART_KEY, cart);
  updateBagCount();
}

function getWishlist() {
  return readStorage(WISH_KEY);
}

function saveWishlist(items) {
  saveStorage(WISH_KEY, items);
  updateWishlistButton();
}

function updateBagCount() {
  const count = getCart().reduce((total, item) => {
    return total + Number(item.qty ?? item.quantity ?? 1);
  }, 0);

  if ($("bagCount")) $("bagCount").textContent = count;
}

function updateWishlistButton() {
  const button = $("productHeart");
  if (!button || !currentProduct) return;

  const saved = getWishlist().some(item =>
    String(typeof item === "object" ? item.id : item) === String(currentProduct.id)
  );

  button.classList.toggle("active", saved);
  button.textContent = saved ? "♥" : "♡";
}

function showDrawer(id) {
  closeDrawers();
  const drawer = $(id);
  if (!drawer) return;
  drawer.classList.add("open");
  $("overlay")?.classList.add("open");
  document.body.style.overflow = "hidden";
}

function closeDrawers() {
  document.querySelectorAll(".p-drawer").forEach(drawer => {
    drawer.classList.remove("open");
  });

  $("overlay")?.classList.remove("open");
  document.body.style.overflow = "";
}

function renderGallery() {
  const mainImage = $("mainImage");
  const thumbs = $("galleryThumbs");

  if (!galleryImages.length) {
    mainImage.src = "";
    mainImage.alt = "Image unavailable";
    thumbs.innerHTML = "";
    return;
  }

  galleryIndex = Math.max(0, Math.min(galleryIndex, galleryImages.length - 1));
  mainImage.src = galleryImages[galleryIndex];
  mainImage.alt = currentProduct?.name || "AURENAR product";

  thumbs.innerHTML = galleryImages.map((image, index) => `
    <button class="p-thumb ${index === galleryIndex ? "active" : ""}" data-image-index="${index}" aria-label="View image ${index + 1}">
      <img src="${escapeHTML(image)}" alt="">
    </button>
  `).join("");

  $("prevImage").style.display = galleryImages.length > 1 ? "" : "none";
  $("nextImage").style.display = galleryImages.length > 1 ? "" : "none";
}

function changeImage(index) {
  if (!galleryImages.length) return;
  galleryIndex = (index + galleryImages.length) % galleryImages.length;
  renderGallery();
}

function renderSizes() {
  const container = $("sizeOptions");
  const sizes = getSizes(currentProduct);

  if (!sizes.length) {
    selectedSize = "";
    container.innerHTML = `<p class="p-note">Size selection is not available for this product.</p>`;
    return;
  }

  if (!sizes.includes(selectedSize)) selectedSize = "";

  container.innerHTML = sizes.map(size => `
    <button class="p-size ${selectedSize === size ? "selected" : ""}" data-size="${escapeHTML(size)}">
      ${escapeHTML(size)}
    </button>
  `).join("");
}

function renderProduct() {
  if (!currentProduct) return;

  $("productName").textContent = currentProduct.name || "AURENAR Product";
  $("productPrice").textContent = money(currentProduct.price);
  $("productColour").textContent = currentProduct.color || currentProduct.colour || "As shown";
  $("productDescription").textContent =
    currentProduct.description || "A considered essential from the AURENAR collection.";
  $("productDetailsText").textContent =
    currentProduct.details || "Designed with attention to fabric, fit and finish.";
  $("breadcrumbName").textContent = currentProduct.name || "PRODUCT";
  document.title = `${currentProduct.name || "Product"} | AURENAR`;

  galleryImages = getImages(currentProduct);
  galleryIndex = 0;
  renderGallery();
  renderSizes();
  updateWishlistButton();
}

function addToBag() {
  if (!currentProduct) return;

  const sizes = getSizes(currentProduct);
  if (sizes.length && !selectedSize) {
    $("productMessage").textContent = "Please select a size first.";
    toast("Please select a size.");
    return;
  }

  const cart = getCart();
  const existing = cart.find(item =>
    String(item.id) === String(currentProduct.id) &&
    String(item.size || "") === selectedSize
  );

  if (existing) {
    existing.qty = Number(existing.qty ?? existing.quantity ?? 1) + 1;
    delete existing.quantity;
  } else {
    cart.push({
      id: currentProduct.id,
      size: selectedSize,
      qty: 1
    });
  }

  saveCart(cart);
  $("productMessage").textContent = "Added to your bag.";
  toast("Added to your bag.");
}

function toggleWishlist() {
  if (!currentProduct) return;

  let wishlist = getWishlist();
  const id = String(currentProduct.id);

  const exists = wishlist.some(item =>
    String(typeof item === "object" ? item.id : item) === id
  );

  if (exists) {
    wishlist = wishlist.filter(item =>
      String(typeof item === "object" ? item.id : item) !== id
    );
    toast("Removed from wishlist.");
  } else {
    wishlist.push(id);
    toast("Added to wishlist.");
  }

  saveWishlist(wishlist);
}

function findProduct(id) {
  return products.find(product => String(product.id) === String(id));
}

function cartItemProduct(item) {
  return findProduct(item.id);
}

function renderBag() {
  const cart = getCart();
  const body = $("bagBody");
  const foot = $("bagFoot");

  if (!cart.length) {
    body.innerHTML = `<p class="p-empty">Your bag is currently empty.</p>`;
    foot.innerHTML = `<button onclick="location.href='/search.html'">DISCOVER THE COLLECTION</button>`;
    return;
  }

  let subtotal = 0;

  body.innerHTML = cart.map((item, index) => {
    const product = cartItemProduct(item);
    if (!product) {
      return `
        <div class="p-cart-row">
          <div></div>
          <div>
            <h3>Product unavailable</h3>
            <p>This item is no longer available.</p>
            <button class="p-remove" data-remove-index="${index}">REMOVE</button>
          </div>
        </div>
      `;
    }

    const qty = Number(item.qty ?? item.quantity ?? 1);
    subtotal += Number(product.price || 0) * qty;
    const image = getImages(product)[0] || "";

    return `
      <div class="p-cart-row">
        <img src="${escapeHTML(image)}" alt="${escapeHTML(product.name)}">
        <div>
          <h3>${escapeHTML(product.name)}</h3>
          <p>${money(product.price)}</p>
          <p>Size: ${escapeHTML(item.size || "One size")}</p>
          <div class="p-qty">
            <button data-qty-index="${index}" data-change="-1">−</button>
            <span>${qty}</span>
            <button data-qty-index="${index}" data-change="1">+</button>
            <button class="p-remove" data-remove-index="${index}">REMOVE</button>
          </div>
        </div>
      </div>
    `;
  }).join("");

  const shipping = subtotal === 0 || subtotal >= 2500 ? 0 : 199;
  const total = subtotal + shipping;

  foot.innerHTML = `
    <div class="p-total"><span>Subtotal</span><strong>${money(subtotal)}</strong></div>
    <div class="p-total"><span>Shipping</span><strong>${shipping ? money(shipping) : "Complimentary"}</strong></div>
    <div class="p-total"><strong>Total</strong><strong>${money(total)}</strong></div>
    <p class="p-note">Shipping is complimentary on orders over ₹2,500.</p>
    <button id="openCheckoutBtn">CONTINUE TO CHECKOUT</button>
  `;
}

function updateCartQuantity(index, change) {
  const cart = getCart();
  if (!cart[index]) return;

  const qty = Number(cart[index].qty ?? cart[index].quantity ?? 1) + change;

  if (qty <= 0) {
    cart.splice(index, 1);
  } else {
    cart[index].qty = qty;
    delete cart[index].quantity;
  }

  saveCart(cart);
  renderBag();
}

function removeCartItem(index) {
  const cart = getCart();
  cart.splice(index, 1);
  saveCart(cart);
  renderBag();
}

function renderCheckout() {
  const cart = getCart();
  let subtotal = 0;

  const rows = cart.map(item => {
    const product = cartItemProduct(item);
    if (!product) return "";

    const qty = Number(item.qty ?? item.quantity ?? 1);
    subtotal += Number(product.price || 0) * qty;

    return `
      <div class="p-total">
        <span>${escapeHTML(product.name)} × ${qty}</span>
        <strong>${money(Number(product.price || 0) * qty)}</strong>
      </div>
    `;
  }).join("");

  const shipping = subtotal === 0 || subtotal >= 2500 ? 0 : 199;

  $("checkoutSummary").innerHTML = `
    ${rows}
    <div class="p-total"><span>Subtotal</span><strong>${money(subtotal)}</strong></div>
    <div class="p-total"><span>Shipping</span><strong>${shipping ? money(shipping) : "Complimentary"}</strong></div>
    <div class="p-total"><strong>Total</strong><strong>${money(subtotal + shipping)}</strong></div>
  `;
}

function renderRelatedProducts() {
  const related = products
    .filter(product => String(product.id) !== String(currentProduct.id))
    .sort((a, b) => {
      const sameA = a.category === currentProduct.category ? 1 : 0;
      const sameB = b.category === currentProduct.category ? 1 : 0;
      return sameB - sameA;
    })
    .slice(0, 4);

  $("relatedProducts").innerHTML = related.length ? related.map(product => {
    const image = getImages(product)[0] || "";

    return `
      <a class="p-card" href="/product.html?id=${encodeURIComponent(product.id)}">
        <img src="${escapeHTML(image)}" alt="${escapeHTML(product.name)}">
        <h3>${escapeHTML(product.name)}</h3>
        <p>${money(product.price)}</p>
      </a>
    `;
  }).join("") : `<p class="p-empty">More pieces coming soon.</p>`;
}

function renderSearch(query = "") {
  const term = query.trim().toLowerCase();

  const matches = products.filter(product =>
    String(product.name || "").toLowerCase().includes(term) ||
    String(product.category || "").toLowerCase().includes(term) ||
    String(product.description || "").toLowerCase().includes(term)
  ).slice(0, 10);

  $("searchResults").innerHTML = matches.length ? matches.map(product => {
    const image = getImages(product)[0] || "";

    return `
      <a class="p-search-result" href="/product.html?id=${encodeURIComponent(product.id)}">
        <img src="${escapeHTML(image)}" alt="">
        <span>
          <strong>${escapeHTML(product.name)}</strong>
          <p>${money(product.price)}</p>
        </span>
      </a>
    `;
  }).join("") : `<p class="p-empty">No matching products found.</p>`;
}

async function renderAccount() {
  const body = $("accountBody");

  const { data: { session }, error } = await supabase.auth.getSession();

  if (error) {
    body.innerHTML = `<p class="p-note">Unable to load your account. Please try again.</p>`;
    return;
  }

  if (session?.user) {
    body.innerHTML = `
      <p>Signed in as</p>
      <strong>${escapeHTML(session.user.email)}</strong>
      <p class="p-note">Your AURENAR account is active.</p>
      <button class="p-primary" id="signOutBtn">SIGN OUT</button>
    `;

    $("signOutBtn").addEventListener("click", async () => {
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) return toast(signOutError.message);
      toast("Signed out.");
      renderAccount();
    });

    return;
  }

  body.innerHTML = `
    <h3 style="font:24px Georgia,serif;font-weight:400">Welcome to AURENAR</h3>
    <p class="p-note">Sign in or create an account.</p>
    <form id="accountForm">
      <input class="p-field" id="accountEmail" type="email" placeholder="Email address" required>
      <input class="p-field" id="accountPassword" type="password" placeholder="Password" minlength="6" required>
      <button class="p-primary" type="submit" id="loginSubmit">SIGN IN</button>
      <button class="p-primary" type="button" id="signupSubmit" style="margin-top:10px;background:transparent;color:#171715;border:1px solid #171715">CREATE ACCOUNT</button>
    </form>
    <p class="p-note" id="accountMessage"></p>
  `;

  $("accountForm").addEventListener("submit", async event => {
    event.preventDefault();

    const email = $("accountEmail").value.trim();
    const password = $("accountPassword").value;
    const message = $("accountMessage");

    message.textContent = "Signing in...";

    const { error: loginError } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    message.textContent = loginError
      ? loginError.message
      : "You are signed in.";

    if (!loginError) renderAccount();
  });

  $("signupSubmit").addEventListener("click", async () => {
    const email = $("accountEmail").value.trim();
    const password = $("accountPassword").value;
    const message = $("accountMessage");

    if (!email || password.length < 6) {
      message.textContent = "Enter a valid email and a password of at least 6 characters.";
      return;
    }

    message.textContent = "Creating your account...";

    const { data, error: signupError } = await supabase.auth.signUp({
      email,
      password
    });

    if (signupError) {
      message.textContent = signupError.message;
      return;
    }

    message.textContent = data.session
      ? "Account created. You are signed in."
      : "Account created. Check your email to confirm your account.";

    if (data.session) renderAccount();
  });
}

function showWishlist() {
  const wishlist = getWishlist();

  const ids = wishlist.map(item =>
    String(typeof item === "object" ? item.id : item)
  );

  const saved = products.filter(product => ids.includes(String(product.id)));

  $("searchInput").value = "";
  $("searchResults").innerHTML = saved.length ? saved.map(product => {
    const image = getImages(product)[0] || "";

    return `
      <a class="p-search-result" href="/product.html?id=${encodeURIComponent(product.id)}">
        <img src="${escapeHTML(image)}" alt="">
        <span>
          <strong>${escapeHTML(product.name)}</strong>
          <p>${money(product.price)}</p>
        </span>
      </a>
    `;
  }).join("") : `<p class="p-empty">Your wishlist is empty.</p>`;

  showDrawer("searchDrawer");
}

async function loadProducts() {
  $("productName").textContent = "Loading product...";

  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("is_active", true);

  if (error) {
    $("productName").textContent = "Unable to load product";
    $("productDescription").textContent =
      "Please refresh the page. If the issue continues, check the Supabase products table and permissions.";
    console.error("AURENAR product loading error:", error);
    return;
  }

  products = data || [];

  const params = new URLSearchParams(location.search);
  const productId = params.get("id");
  const productSlug = params.get("slug");

  if (productId) {
    currentProduct = products.find(product =>
      String(product.id) === String(productId)
    );
  } else if (productSlug) {
    currentProduct = products.find(product =>
      String(product.slug) === String(productSlug)
    );
  }

  if (!productId && !productSlug) {
    $("productName").textContent = "Product not selected";
    $("productDescription").textContent =
      "Please open a product from the collection to view its details.";
    $("relatedProducts").innerHTML = "";
    return;
  }

  if (!currentProduct) {
    $("productName").textContent = "Product not found";
    $("productDescription").textContent =
      "This product may be unavailable or the link may be incorrect.";
    $("relatedProducts").innerHTML = "";
    return;
  }

  renderProduct();
  renderRelatedProducts();
  updateBagCount();
}

function wireInterface() {
  $("bagBtn").addEventListener("click", () => {
    renderBag();
    showDrawer("bagDrawer");
  });

  $("accountBtn").addEventListener("click", () => {
    showDrawer("accountDrawer");
    renderAccount();
  });

  $("searchBtn").addEventListener("click", () => {
    renderSearch("");
    showDrawer("searchDrawer");
    $("searchInput").focus();
  });

  $("wishlistBtn").addEventListener("click", showWishlist);
  $("productHeart").addEventListener("click", toggleWishlist);
  $("addToBagBtn").addEventListener("click", addToBag);

  $("sizeOptions").addEventListener("click", event => {
    const button = event.target.closest("[data-size]");
    if (!button) return;

    selectedSize = button.dataset.size;
    renderSizes();
    $("productMessage").textContent = "";
  });

  $("galleryThumbs").addEventListener("click", event => {
    const button = event.target.closest("[data-image-index]");
    if (!button) return;
    changeImage(Number(button.dataset.imageIndex));
  });

  $("prevImage").addEventListener("click", () => changeImage(galleryIndex - 1));
  $("nextImage").addEventListener("click", () => changeImage(galleryIndex + 1));

  $("galleryStage").addEventListener("touchstart", event => {
    touchStartX = event.changedTouches[0].screenX;
  }, { passive: true });

  $("galleryStage").addEventListener("touchend", event => {
    const difference = event.changedTouches[0].screenX - touchStartX;

    if (Math.abs(difference) > 45) {
      changeImage(galleryIndex + (difference < 0 ? 1 : -1));
    }
  }, { passive: true });

  $("overlay").addEventListener("click", closeDrawers);

  document.querySelectorAll("[data-close]").forEach(button => {
    button.addEventListener("click", closeDrawers);
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      closeDrawers();
      $("sizeModal").classList.remove("open");
    }
  });

  $("bagBody").addEventListener("click", event => {
    const quantityButton = event.target.closest("[data-qty-index]");
    const removeButton = event.target.closest("[data-remove-index]");

    if (quantityButton) {
      updateCartQuantity(
        Number(quantityButton.dataset.qtyIndex),
        Number(quantityButton.dataset.change)
      );
    }

    if (removeButton) {
      removeCartItem(Number(removeButton.dataset.removeIndex));
    }
  });

  $("bagFoot").addEventListener("click", event => {
    if (event.target.id !== "openCheckoutBtn") return;

    if (!getCart().length) {
      toast("Your bag is empty.");
      return;
    }

    renderCheckout();
    showDrawer("checkoutDrawer");
  });

  $("searchInput").addEventListener("input", event => {
    renderSearch(event.target.value);
  });

  $("sizeGuideBtn").addEventListener("click", () => {
    $("sizeModal").classList.add("open");
  });

  $("closeSizeGuide").addEventListener("click", () => {
    $("sizeModal").classList.remove("open");
  });

  $("sizeModal").addEventListener("click", event => {
    if (event.target.id === "sizeModal") {
      $("sizeModal").classList.remove("open");
    }
  });

  $("paymentNoticeBtn").addEventListener("click", () => {
    toast("Online payment is not connected yet.");
  });

  $("menuBtn").addEventListener("click", () => {
    showDrawer("searchDrawer");
    $("searchResults").innerHTML = `
      <a class="p-search-result" href="/men.html"><strong>MEN</strong></a>
      <a class="p-search-result" href="/women.html"><strong>WOMEN</strong></a>
      <a class="p-search-result" href="/search.html"><strong>DISCOVER</strong></a>
    `;
  });
}

wireInterface();
loadProducts();
updateBagCount();