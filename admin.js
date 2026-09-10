import { supabase } from "./supabase.js";

const app = document.getElementById("app");

let products = [];
let editingId = null;

function showLogin(error = "") {
  app.innerHTML = `
    <div class="admin-shell">
      <div class="admin-card">
        <div class="admin-brand">AURENAR</div>
        <div class="admin-label">ADMIN</div>

        <form id="loginForm">
          <input
            id="email"
            type="email"
            placeholder="Email"
            required
            autocomplete="email"
          />

          <input
            id="password"
            type="password"
            placeholder="Password"
            required
            autocomplete="current-password"
          />

          <button type="submit">Sign in</button>

          <p id="loginMessage" class="admin-message">
            ${error}
          </p>
        </form>
      </div>
    </div>
  `;

  document
    .getElementById("loginForm")
    .addEventListener("submit", login);
}

async function login(event) {
  event.preventDefault();

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const message = document.getElementById("loginMessage");

  message.textContent = "Signing in...";

  const { data, error } =
    await supabase.auth.signInWithPassword({
      email,
      password
    });

  if (error) {
    message.textContent = error.message;
    return;
  }

  if (!data.user) {
    message.textContent = "Login succeeded, but no user was returned.";
    return;
  }

  await verifyAdmin(data.user);
}

async function verifyAdmin(user) {
  const message = document.getElementById("loginMessage");

  if (message) {
    message.textContent = "Verifying admin...";
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    console.error("Admin verification error:", error);

    await supabase.auth.signOut();

    if (message) {
      message.textContent =
        "Admin verification failed: " + error.message;
    }

    return;
  }

  if (!data || data.role !== "admin") {
    await supabase.auth.signOut();

    if (message) {
      message.textContent = "This account is not an admin.";
    }

    return;
  }

  await dashboard();
}

async function dashboard() {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    app.innerHTML = `
      <div class="admin-shell">
        <div class="admin-card">
          <h2>Admin Dashboard</h2>
          <p>Products could not be loaded.</p>
          <p>${error.message}</p>
          <button id="logout">Log out</button>
        </div>
      </div>
    `;

    document
      .getElementById("logout")
      .addEventListener("click", logout);

    return;
  }

  products = data || [];
  renderDashboard();
}

function renderDashboard() {
  app.innerHTML = `
    <div class="admin-shell">
      <div class="admin-header">
        <div>
          <div class="admin-brand">AURENAR</div>
          <div class="admin-label">ADMIN</div>
        </div>

        <button id="logout">Log out</button>
      </div>

      <div class="admin-content">
        <div class="admin-top">
          <h1>Products</h1>
          <button id="addProduct">Add product</button>
        </div>

        <div id="productList">
          ${
            products.length
              ? products.map(productCard).join("")
              : "<p>No products yet.</p>"
          }
        </div>
      </div>
    </div>
  `;

  document
    .getElementById("logout")
    .addEventListener("click", logout);

  document
    .getElementById("addProduct")
    .addEventListener("click", () => openProductForm());

  document.querySelectorAll("[data-edit]").forEach(button => {
    button.addEventListener("click", () => {
      const id = button.dataset.edit;
      const product = products.find(p => p.id === id);
      if (product) openProductForm(product);
    });
  });

  document.querySelectorAll("[data-delete]").forEach(button => {
    button.addEventListener("click", () => {
      deleteProduct(button.dataset.delete);
    });
  });
}

function productCard(product) {
  return `
    <div class="admin-product">
      <div>
        <strong>${escapeHtml(product.name)}</strong>
        <div>₹${Number(product.price).toLocaleString("en-IN")}</div>
        <small>
          Stock: ${product.stock ?? 0}
          · ${product.is_active ? "Active" : "Hidden"}
        </small>
      </div>

      <div>
        <button data-edit="${product.id}">Edit</button>
        <button data-delete="${product.id}">Delete</button>
      </div>
    </div>
  `;
}

function openProductForm(product = null) {
  editingId = product?.id || null;

  app.innerHTML = `
    <div class="admin-shell">
      <div class="admin-content">
        <h1>${product ? "Edit product" : "Add product"}</h1>

        <form id="productForm">
          <input
            name="name"
            placeholder="Product name"
            value="${escapeAttr(product?.name || "")}"
            required
          />

          <input
            name="slug"
            placeholder="Slug"
            value="${escapeAttr(product?.slug || "")}"
            required
          />

          <textarea
            name="description"
            placeholder="Description"
          >${escapeHtml(product?.description || "")}</textarea>

          <input
            name="price"
            type="number"
            step="0.01"
            placeholder="Price"
            value="${product?.price ?? ""}"
            required
          />

          <input
            name="compare_at_price"
            type="number"
            step="0.01"
            placeholder="Compare at price"
            value="${product?.compare_at_price ?? ""}"
          />

          <input
            name="images"
            placeholder="Image URLs, separated by commas"
            value="${escapeAttr(
              Array.isArray(product?.images)
                ? product.images.join(", ")
                : ""
            )}"
          />

          <input
            name="sizes"
            placeholder="Sizes, e.g. S, M, L, XL"
            value="${escapeAttr(
              Array.isArray(product?.sizes)
                ? product.sizes.join(", ")
                : ""
            )}"
          />

          <input
            name="stock"
            type="number"
            placeholder="Stock"
            value="${product?.stock ?? 0}"
            required
          />

          <label>
            <input
              name="is_active"
              type="checkbox"
              ${product?.is_active !== false ? "checked" : ""}
            />
            Active
          </label>

          <button type="submit">
            ${product ? "Save changes" : "Create product"}
          </button>

          <button type="button" id="cancel">
            Cancel
          </button>

          <p id="formMessage"></p>
        </form>
      </div>
    </div>
  `;

  document
    .getElementById("cancel")
    .addEventListener("click", renderDashboard);

  document
    .getElementById("productForm")
    .addEventListener("submit", saveProduct);
}

async function saveProduct(event) {
  event.preventDefault();

  const form = new FormData(event.target);
  const message = document.getElementById("formMessage");

  const name = form.get("name").trim();
  const slug = form.get("slug").trim();
  const description = form.get("description").trim();
  const price = Number(form.get("price"));
  const compare = form.get("compare_at_price");
  const images = form
    .get("images")
    .split(",")
    .map(x => x.trim())
    .filter(Boolean);
  const sizes = form
    .get("sizes")
    .split(",")
    .map(x => x.trim())
    .filter(Boolean);
  const stock = Number(form.get("stock"));
  const is_active = form.get("is_active") === "on";

  const payload = {
    name,
    slug,
    description,
    price,
    compare_at_price: compare ? Number(compare) : null,
    images,
    sizes,
    stock,
    is_active,
    updated_at: new Date().toISOString()
  };

  message.textContent = "Saving...";

  let result;

  if (editingId) {
    result = await supabase
      .from("products")
      .update(payload)
      .eq("id", editingId);
  } else {
    result = await supabase
      .from("products")
      .insert(payload);
  }

  if (result.error) {
    message.textContent = result.error.message;
    return;
  }

  editingId = null;
  await dashboard();
}

async function deleteProduct(id) {
  if (!confirm("Delete this product?")) return;

  const { error } = await supabase
    .from("products")
    .delete()
    .eq("id", id);

  if (error) {
    alert(error.message);
    return;
  }

  await dashboard();
}

async function logout() {
  await supabase.auth.signOut();
  showLogin();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}

async function start() {
  const { data } = await supabase.auth.getSession();

  if (!data.session) {
    showLogin();
    return;
  }

  await verifyAdmin(data.session.user);
}

start();
