import { supabase } from "./supabase.js";

const app = document.getElementById("app");

let products = [];


/* =========================
   HELPERS
========================= */

function money(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(Number(value) || 0);
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));
}


/* =========================
   LOGIN SCREEN
========================= */

function showLogin(message = "") {
  app.innerHTML = `
    <section class="admin-login">

      <div class="admin-login-inner">

        <p class="eyebrow">AURENAR</p>

        <h1>Admin</h1>

        <p class="admin-muted">
          Sign in to manage your collection.
        </p>

        <form id="loginForm">

          <input
            id="email"
            type="email"
            placeholder="Email address"
            autocomplete="email"
            required
          >

          <input
            id="password"
            type="password"
            placeholder="Password"
            autocomplete="current-password"
            required
          >

          <button
            type="submit"
            class="primary-btn"
            id="loginButton"
          >
            SIGN IN
          </button>

          <p
            id="loginMessage"
            class="form-message"
          >
            ${esc(message)}
          </p>

        </form>

      </div>

    </section>
  `;

  document
    .getElementById("loginForm")
    ?.addEventListener("submit", login);
}


/* =========================
   LOGIN
========================= */

async function login(event) {

  event.preventDefault();

  const email =
    document.getElementById("email").value.trim();

  const password =
    document.getElementById("password").value;

  const button =
    document.getElementById("loginButton");

  const message =
    document.getElementById("loginMessage");

  button.disabled = true;
  button.textContent = "SIGNING IN…";
  message.textContent = "";

  try {

    const { data, error } =
      await supabase.auth.signInWithPassword({
        email,
        password
      });

    if (error) {
      throw error;
    }

    if (!data.session) {
      throw new Error("Login session was not created.");
    }

    await checkAdmin();

  } catch (error) {

    console.error("Admin login error:", error);

    message.textContent =
      error?.message ||
      "Unable to sign in.";

    button.disabled = false;
    button.textContent = "SIGN IN";
  }
}


/* =========================
   ADMIN CHECK
========================= */

async function checkAdmin() {

  const {
    data: sessionData,
    error: sessionError
  } = await supabase.auth.getSession();

  if (sessionError) {
    await supabase.auth.signOut();
    showLogin(sessionError.message);
    return;
  }

  const session = sessionData.session;

  if (!session) {
    showLogin();
    return;
  }


  const {
    data: profile,
    error
  } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", session.user.id)
    .maybeSingle();

  if (error) {

    console.error("Admin role check:", error);

    await supabase.auth.signOut();

    showLogin(
      "Could not verify admin access."
    );

    return;
  }


  if (!profile || profile.role !== "admin") {

    await supabase.auth.signOut();

    showLogin(
      "This account does not have admin access."
    );

    return;
  }


  showDashboard();
}


/* =========================
   DASHBOARD
========================= */

function showDashboard() {

  app.innerHTML = `
    <section class="admin-page">

      <header class="admin-top">

        <div>
          <p class="eyebrow">AURENAR</p>
          <h1>Store Admin</h1>
        </div>

        <button
          class="secondary-btn"
          id="logout"
        >
          SIGN OUT
        </button>

      </header>


      <section class="admin-content">

        <div class="admin-heading">

          <div>
            <p class="eyebrow">COLLECTION</p>
            <h2>Products</h2>
          </div>

          <button
            class="primary-btn"
            id="addProduct"
          >
            ADD PRODUCT
          </button>

        </div>


        <div id="productList">
          <p class="admin-muted">
            Loading products…
          </p>
        </div>

      </section>

    </section>
  `;


  document
    .getElementById("logout")
    ?.addEventListener("click", async () => {

      await supabase.auth.signOut();

      showLogin();
    });


  document
    .getElementById("addProduct")
    ?.addEventListener(
      "click",
      () => showProductForm()
    );


  loadProducts();
}


/* =========================
   LOAD PRODUCTS
========================= */

async function loadProducts() {

  const list =
    document.getElementById("productList");

  if (!list) return;


  const {
    data,
    error
  } = await supabase
    .from("products")
    .select("*")
    .order("created_at", {
      ascending: false
    });


  if (error) {

    console.error(error);

    list.innerHTML = `
      <p class="form-message">
        ${esc(error.message)}
      </p>
    `;

    return;
  }


  products = data || [];

  renderProducts();
}


/* =========================
   PRODUCT LIST
========================= */

function renderProducts() {

  const list =
    document.getElementById("productList");

  if (!list) return;


  if (!products.length) {

    list.innerHTML = `
      <div class="admin-empty">
        <p>No products yet.</p>

        <button
          class="primary-btn"
          id="emptyAdd"
        >
          ADD YOUR FIRST PRODUCT
        </button>
      </div>
    `;

    document
      .getElementById("emptyAdd")
      ?.addEventListener(
        "click",
        () => showProductForm()
      );

    return;
  }


  list.innerHTML = `
    <div class="admin-products">

      ${products.map(product => {

        const image =
          Array.isArray(product.images)
            ? product.images[0]
            : "";

        return `
          <article class="admin-product">

            <div class="admin-product-image">

              ${
                image
                  ? `
                    <img
                      src="${esc(image)}"
                      alt="${esc(product.name)}"
                    >
                  `
                  : `
                    <span>AURENAR</span>
                  `
              }

            </div>


            <div class="admin-product-info">

              <div>

                <h3>
                  ${esc(product.name)}
                </h3>

                <p>
                  ${money(product.price)}
                </p>

                <small>
                  Stock: ${Number(product.stock || 0)}
                  ·
                  ${
                    product.is_active
                      ? "Active"
                      : "Hidden"
                  }
                </small>

              </div>


              <div class="admin-product-actions">

                <button
                  class="secondary-btn"
                  data-edit="${esc(product.id)}"
                >
                  EDIT
                </button>

                <button
                  class="secondary-btn"
                  data-delete="${esc(product.id)}"
                >
                  DELETE
                </button>

              </div>

            </div>

          </article>
        `;

      }).join("")}

    </div>
  `;


  list
    .querySelectorAll("[data-edit]")
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          const product =
            products.find(
              item =>
                String(item.id) ===
                String(button.dataset.edit)
            );

          if (product) {
            showProductForm(product);
          }
        }
      );

    });


  list
    .querySelectorAll("[data-delete]")
    .forEach(button => {

      button.addEventListener(
        "click",
        () => deleteProduct(button.dataset.delete)
      );

    });
}


/* =========================
   PRODUCT FORM
========================= */

function showProductForm(product = null) {

  const editing = Boolean(product);


  app.innerHTML = `
    <section class="admin-page">

      <header class="admin-top">

        <div>
          <p class="eyebrow">AURENAR</p>

          <h1>
            ${editing ? "Edit Product" : "Add Product"}
          </h1>
        </div>

        <button
          class="secondary-btn"
          id="back"
        >
          BACK
        </button>

      </header>


      <section class="admin-form-wrap">

        <form
          id="productForm"
          class="admin-form"
        >

          <label>
            PRODUCT NAME

            <input
              name="name"
              required
              value="${esc(product?.name || "")}"
            >
          </label>


          <label>
            SLUG

            <input
              name="slug"
              required
              value="${esc(product?.slug || "")}"
              placeholder="white-linen-shirt"
            >
          </label>


          <label>
            DESCRIPTION

            <textarea
              name="description"
              rows="5"
            >${esc(product?.description || "")}</textarea>
          </label>


          <div class="two-col">

            <label>
              PRICE

              <input
                name="price"
                type="number"
                min="0"
                step="1"
                required
                value="${product?.price ?? ""}"
              >
            </label>


            <label>
              COMPARE AT PRICE

              <input
                name="compare_at_price"
                type="number"
                min="0"
                step="1"
                value="${product?.compare_at_price ?? ""}"
              >
            </label>

          </div>


          <label>
            IMAGE URL

            <input
              name="image"
              type="url"
              placeholder="https://..."
              value="${
                Array.isArray(product?.images)
                  ? esc(product.images[0] || "")
                  : ""
              }"
            >
          </label>


          <label>
            SIZES

            <input
              name="sizes"
              placeholder="S, M, L, XL"
              value="${
                Array.isArray(product?.sizes)
                  ? esc(product.sizes.join(", "))
                  : ""
              }"
            >
          </label>


          <label>
            STOCK

            <input
              name="stock"
              type="number"
              min="0"
              step="1"
              required
              value="${product?.stock ?? 0}"
            >
          </label>


          <label class="checkbox-label">

            <input
              name="is_active"
              type="checkbox"
              ${
                product?.is_active !== false
                  ? "checked"
                  : ""
              }
            >

            SHOW PRODUCT ON STORE

          </label>


          <p
            id="formMessage"
            class="form-message"
          ></p>


          <button
            type="submit"
            class="primary-btn"
            id="saveProduct"
          >
            ${editing ? "SAVE CHANGES" : "ADD PRODUCT"}
          </button>

        </form>

      </section>

    </section>
  `;


  document
    .getElementById("back")
    ?.addEventListener(
      "click",
      () => showDashboard()
    );


  document
    .getElementById("productForm")
    ?.addEventListener(
      "submit",
      event =>
        saveProduct(event, product)
    );
}


/* =========================
   SAVE PRODUCT
========================= */

async function saveProduct(event, existing) {

  event.preventDefault();


  const form =
    event.currentTarget;

  const button =
    document.getElementById("saveProduct");

  const message =
    document.getElementById("formMessage");


  const data =
    new FormData(form);


  const name =
    String(data.get("name") || "").trim();

  const slug =
    String(data.get("slug") || "").trim();

  const description =
    String(data.get("description") || "").trim();

  const price =
    Number(data.get("price") || 0);

  const compare =
    Number(data.get("compare_at_price") || 0);

  const image =
    String(data.get("image") || "").trim();

  const sizes =
    String(data.get("sizes") || "")
      .split(",")
      .map(size => size.trim())
      .filter(Boolean);

  const stock =
    Number(data.get("stock") || 0);

  const isActive =
    data.get("is_active") === "on";


  button.disabled = true;
  button.textContent = "SAVING…";
  message.textContent = "";


  const payload = {
    name,
    slug,
    description,
    price,
    compare_at_price:
      compare > 0 ? compare : null,
    images:
      image ? [image] : [],
    sizes,
    stock,
    is_active: isActive,
    updated_at: new Date().toISOString()
  };


  try {

    let result;


    if (existing) {

      result =
        await supabase
          .from("products")
          .update(payload)
          .eq("id", existing.id);

    } else {

      result =
        await supabase
          .from("products")
          .insert(payload);

    }


    if (result.error) {
      throw result.error;
    }


    showDashboard();

  } catch (error) {

    console.error(error);

    message.textContent =
      error?.message ||
      "Unable to save product.";

    button.disabled = false;

    button.textContent =
      existing
        ? "SAVE CHANGES"
        : "ADD PRODUCT";
  }
}


/* =========================
   DELETE PRODUCT
========================= */

async function deleteProduct(id) {

  const product =
    products.find(
      item =>
        String(item.id) === String(id)
    );

  if (!product) return;


  const confirmed =
    window.confirm(
      `Delete "${product.name}"?`
    );

  if (!confirmed) return;


  const {
    error
  } = await supabase
    .from("products")
    .delete()
    .eq("id", id);


  if (error) {

    window.alert(error.message);

    return;
  }


  await loadProducts();
}


/* =========================
   START
========================= */

checkAdmin();
