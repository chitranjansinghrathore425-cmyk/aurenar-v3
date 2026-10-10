
import { supabase } from "./supabase.js";

const app = document.getElementById("app");

let products = [];
let editingId = null;
let busy = false;

const PRODUCT_COLUMNS =
  "id,name,price,image_url,category,sizes,description,is_active,created_at";

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function money(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(Number(value) || 0);
}

function messageHTML(text = "") {
  return `<p class="form-message" id="formMessage" role="status">${esc(text)}</p>`;
}

function showLogin(message = "") {
  app.innerHTML = `
    <section class="admin-login">
      <div class="admin-login-inner">
        <p class="eyebrow">AURENAR</p>
        <h1>Admin</h1>
        <p class="admin-muted">Sign in to manage your collection.</p>

        <form id="loginForm" class="admin-form">
          <label>
            EMAIL ADDRESS
            <input
              id="email"
              type="email"
              autocomplete="username"
              required
            >
          </label>

          <label>
            PASSWORD
            <input
              id="password"
              type="password"
              autocomplete="current-password"
              required
            >
          </label>

          <button class="primary-btn" id="loginButton" type="submit">
            SIGN IN
          </button>

          <p id="loginMessage" class="form-message" role="status">${esc(message)}</p>
        </form>
      </div>
    </section>
  `;

  document.getElementById("loginForm")
    ?.addEventListener("submit", login);
}

async function login(event) {
  event.preventDefault();

  const button = document.getElementById("loginButton");
  const message = document.getElementById("loginMessage");

  button.disabled = true;
  button.textContent = "SIGNING IN…";
  message.textContent = "";

  try {
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;
    if (!data.session || !data.user) {
      throw new Error("No login session was created.");
    }

    await checkAdmin();
  } catch (error) {
    message.textContent = error.message || "Unable to sign in.";
    button.disabled = false;
    button.textContent = "SIGN IN";
  }
}

async function checkAdmin() {
  try {
    const { data: sessionData, error: sessionError } =
      await supabase.auth.getSession();

    if (sessionError) throw sessionError;

    const user = sessionData.session?.user;

    if (!user) {
      showLogin();
      return false;
    }

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("id,role")
      .eq("id", user.id)
      .maybeSingle();

    if (error) {
      console.error("Admin role verification failed:", error);
      await supabase.auth.signOut();
      showLogin("Could not verify admin access. Check your profiles table and RLS policies.");
      return false;
    }

    if (!profile || profile.role !== "admin") {
      await supabase.auth.signOut();
      showLogin("This account does not have admin access.");
      return false;
    }

    await showDashboard();
    return true;
  } catch (error) {
    console.error("Admin verification error:", error);
    showLogin(error.message || "Unable to verify admin access.");
    return false;
  }
}

async function showDashboard() {
  app.innerHTML = `
    <section class="admin-page">
      <header class="admin-top">
        <div>
          <p class="eyebrow">AURENAR</p>
          <h1>Store Admin</h1>
        </div>
        <button class="secondary-btn" id="logout">SIGN OUT</button>
      </header>

      <section class="admin-content">
        <div class="admin-heading">
          <div>
            <p class="eyebrow">COLLECTION MANAGEMENT</p>
            <h2>Products</h2>
          </div>
          <button class="primary-btn" id="addProduct">ADD PRODUCT</button>
        </div>

        <p id="dashboardMessage" class="form-message" role="status"></p>
        <div id="productList">
          <p class="admin-muted">Loading products…</p>
        </div>
      </section>
    </section>
  `;

  document.getElementById("logout")
    ?.addEventListener("click", logout);

  document.getElementById("addProduct")
    ?.addEventListener("click", () => showProductForm());

  await loadProducts();
}

async function loadProducts() {
  const list = document.getElementById("productList");
  if (!list) return;

  list.innerHTML = '<p class="admin-muted">Loading products…</p>';

  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_COLUMNS)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Products load error:", error);
    list.innerHTML = `
      <p class="form-message">
        Could not load products: ${esc(error.message)}
      </p>
    `;
    return;
  }

  products = data || [];
  renderProducts();
}

function renderProducts() {
  const list = document.getElementById("productList");
  if (!list) return;

  if (!products.length) {
    list.innerHTML = `
      <div class="admin-empty">
        <p>No products found.</p>
        <p class="admin-muted">You can add your first product here.</p>
        <button class="primary-btn" id="emptyAdd">ADD PRODUCT</button>
      </div>
    `;

    document.getElementById("emptyAdd")
      ?.addEventListener("click", () => showProductForm());

    return;
  }

  list.innerHTML = `
    <div class="admin-products">
      ${products.map(product => `
        <article class="admin-product">
          <div class="admin-product-image">
            ${
              product.image_url
                ? `<img src="${esc(product.image_url)}" alt="${esc(product.name)}" loading="lazy">`
                : "<span>AURENAR</span>"
            }
          </div>

          <div class="admin-product-info">
            <div>
              <h3>${esc(product.name)}</h3>
              <p>${money(product.price)}</p>
              <small>
                ${esc(product.category || "men")}
                · ${product.is_active ? "Active" : "Hidden"}
              </small>
              <p class="admin-muted">${esc(product.description || "")}</p>
            </div>

            <div class="admin-product-actions">
              <button class="secondary-btn" data-edit="${esc(product.id)}">
                EDIT
              </button>
              <button class="secondary-btn" data-delete="${esc(product.id)}">
                DELETE
              </button>
            </div>
          </div>
        </article>
      `).join("")}
    </div>
  `;

  list.querySelectorAll("[data-edit]").forEach(button => {
    button.addEventListener("click", () => {
      const product = products.find(
        item => String(item.id) === String(button.dataset.edit)
      );

      if (product) showProductForm(product);
    });
  });

  list.querySelectorAll("[data-delete]").forEach(button => {
    button.addEventListener("click", () => deleteProduct(button.dataset.delete));
  });
}

function showProductForm(product = null) {
  editingId = product?.id ?? null;

  const sizes = Array.isArray(product?.sizes)
    ? product.sizes.join(", ")
    : "";

  app.innerHTML = `
    <section class="admin-page">
      <header class="admin-top">
        <div>
          <p class="eyebrow">AURENAR</p>
          <h1>${product ? "Edit Product" : "Add Product"}</h1>
        </div>
        <button class="secondary-btn" id="back">BACK</button>
      </header>

      <section class="admin-form-wrap">
        <form id="productForm" class="admin-form">
          <label>
            PRODUCT NAME
            <input
              name="name"
              required
              maxlength="150"
              value="${esc(product?.name || "")}"
            >
          </label>

          <label>
            PRICE (INR)
            <input
              name="price"
              type="number"
              min="0"
              step="0.01"
              required
              value="${product?.price ?? ""}"
            >
          </label>

          <label>
            CATEGORY
            <input
              name="category"
              maxlength="80"
              placeholder="men"
              value="${esc(product?.category || "men")}"
              required
            >
          </label>

          <label>
            PRODUCT IMAGE URL
            <input
              name="image_url"
              type="url"
              placeholder="https://..."
              value="${esc(product?.image_url || "")}"
            >
          </label>

          ${
            product?.image_url
              ? `<img src="${esc(product.image_url)}" alt="Current product image" style="width:120px;max-height:160px;object-fit:cover">`
              : ""
          }

          <label>
            SIZES
            <input
              name="sizes"
              placeholder="S, M, L, XL"
              value="${esc(sizes)}"
            >
          </label>

          <label>
            DESCRIPTION
            <textarea
              name="description"
              rows="5"
              maxlength="5000"
            >${esc(product?.description || "")}</textarea>
          </label>

          <label class="checkbox-label">
            <input
              name="is_active"
              type="checkbox"
              ${product?.is_active !== false ? "checked" : ""}
            >
            SHOW PRODUCT ON STORE
          </label>

          ${messageHTML()}

          <button class="primary-btn" id="saveProduct" type="submit">
            ${product ? "SAVE CHANGES" : "CREATE PRODUCT"}
          </button>
        </form>
      </section>
    </section>
  `;

  document.getElementById("back")
    ?.addEventListener("click", showDashboard);

  document.getElementById("productForm")
    ?.addEventListener("submit", saveProduct);
}

async function saveProduct(event) {
  event.preventDefault();
  if (busy) return;

  const form = event.currentTarget;
  const button = document.getElementById("saveProduct");
  const message = document.getElementById("formMessage");
  const formData = new FormData(form);

  const name = String(formData.get("name") || "").trim();
  const imageURL = String(formData.get("image_url") || "").trim();
  const price = Number(formData.get("price"));
  const category = String(formData.get("category") || "men").trim();

  if (!name || !category || !Number.isFinite(price) || price < 0) {
    message.textContent = "Enter a valid product name, category, and price.";
    return;
  }

  if (imageURL) {
    try {
      const url = new URL(imageURL);
      if (!["https:", "http:"].includes(url.protocol)) {
        throw new Error("Invalid image URL.");
      }
    } catch {
      message.textContent = "Enter a valid image URL, or leave it blank.";
      return;
    }
  }

  const sizes = String(formData.get("sizes") || "")
    .split(",")
    .map(size => size.trim())
    .filter(Boolean);

  const payload = {
    name,
    price,
    image_url: imageURL || null,
    category,
    sizes: sizes.length ? sizes : ["S", "M", "L", "XL"],
    description: String(formData.get("description") || "").trim() || null,
    is_active: formData.get("is_active") === "on"
  };

  busy = true;
  button.disabled = true;
  button.textContent = "SAVING…";
  message.textContent = "Saving product…";

  try {
    let result;

    if (editingId !== null) {
      result = await supabase
        .from("products")
        .update(payload)
        .eq("id", editingId)
        .select("id");
    } else {
      result = await supabase
        .from("products")
        .insert(payload)
        .select("id");
    }

    if (result.error) throw result.error;

    if (!result.data?.length) {
      throw new Error(
        "No product was saved. Check your admin role and Supabase RLS policies."
      );
    }

    editingId = null;
    busy = false;
    await showDashboard();
  } catch (error) {
    console.error("Product save error:", error);
    message.textContent = error.message || "Could not save the product.";
    button.disabled = false;
    button.textContent = editingId !== null ? "SAVE CHANGES" : "CREATE PRODUCT";
    busy = false;
  }
}

async function deleteProduct(id) {
  const product = products.find(
    item => String(item.id) === String(id)
  );

  if (!product) return;

  const confirmed = window.confirm(
    `Delete "${product.name}" permanently? This cannot be undone.`
  );

  if (!confirmed) return;

  const { data, error } = await supabase
    .from("products")
    .delete()
    .eq("id", id)
    .select("id");

  if (error) {
    window.alert("Product could not be deleted: " + error.message);
    return;
  }

  if (!data?.length) {
    window.alert(
      "No product was deleted. Check your admin role and RLS policies."
    );
    return;
  }

  await loadProducts();
}

async function logout() {
  const { error } = await supabase.auth.signOut();

  if (error) {
    window.alert("Sign out failed: " + error.message);
    return;
  }

  products = [];
  editingId = null;
  showLogin();
}

async function start() {
  if (!app) return;

  const { data, error } = await supabase.auth.getSession();

  if (error) {
    showLogin(error.message);
    return;
  }

  if (!data.session) {
    showLogin();
    return;
  }

  await checkAdmin();
}

start();
