import { supabase } from "./supabase.js";

const app = document.getElementById("app");

let products = [];
let editingId = null;
let busy = false;
let storeSettings = {};
let activeTab = "dashboard";

const PRODUCT_COLUMNS =
  "id,name,price,image_url,category,sizes,description,is_active,created_at";

const DEFAULT_SETTINGS = {
  home: {
    title: "Quietly Distinct",
    subtitle: "A considered approach to modern dressing.",
    heroImage: "",
    buttonText: "DISCOVER THE COLLECTION",
    buttonLink: "/search.html"
  },
  men: {
    title: "THE MEN'S COLLECTION",
    subtitle: "Refined essentials. Timeless character.",
    heroImage: "",
    background: "#100b0e",
    textColor: "#f7f1ed",
    accent: "#70283d"
  },
  women: {
    title: "THE WOMEN'S COLLECTION",
    subtitle: "A softer kind of statement.",
    heroImage: "",
    background: "#f7e9f8",
    textColor: "#38213f",
    accent: "#bd83d4"
  },
  themes: {
    homeBackground: "#f8f6f2",
    homeText: "#24201f",
    font: "Cormorant Garamond",
    buttonStyle: "minimal"
  },
  navigation: {
    homeLabel: "Home",
    menLabel: "Men",
    womenLabel: "Women",
    discoverLabel: "Discover"
  },
  announcement: {
    text: "Complimentary shipping on orders over ₹2,500",
    enabled: true
  }
};

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

function msg(text, id = "notice") {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function showLogin(message = "") {
  app.innerHTML = `
    <section class="admin-login">
      <div class="admin-login-inner">
        <p class="eyebrow">AURENAR</p>
        <h1>Store Admin</h1>
        <p class="admin-muted">Manage your store.</p>

        <form id="loginForm" class="admin-form">
          <label>
            EMAIL ADDRESS
            <input id="email" type="email"
              autocomplete="username" required>
          </label>

          <label>
            PASSWORD
            <input id="password" type="password"
              autocomplete="current-password" required>
          </label>

          <button class="primary-btn" id="loginButton">
            SIGN IN
          </button>

          <p id="loginMessage" class="form-message" role="status">
            ${esc(message)}
          </p>
        </form>
      </div>
    </section>
  `;

  document.getElementById("loginForm")
    .addEventListener("submit", login);
}

async function login(event) {
  event.preventDefault();

  const button = document.getElementById("loginButton");
  const message = document.getElementById("loginMessage");

  button.disabled = true;
  button.textContent = "SIGNING IN…";
  message.textContent = "";

  try {
    const { error } = await supabase.auth.signInWithPassword({
      email: document.getElementById("email").value.trim(),
      password: document.getElementById("password").value
    });

    if (error) throw error;

    await checkAdmin();
  } catch (error) {
    message.textContent = error.message || "Login failed.";
    button.disabled = false;
    button.textContent = "SIGN IN";
  }
}

async function checkAdmin() {
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    showLogin(error.message);
    return;
  }

  const user = data.session?.user;

  if (!user) {
    showLogin();
    return;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id,role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || profile?.role !== "admin") {
    await supabase.auth.signOut();
    showLogin(
      profileError
        ? "Could not verify admin access. Check profiles permissions."
        : "This account does not have admin access."
    );
    return;
  }

  await loadSettings();
  await showDashboard();
}

async function loadSettings() {
  const { data, error } = await supabase
    .from("site_settings")
    .select("settings")
    .eq("id", "storefront")
    .maybeSingle();

  if (error) {
    console.error("Settings load failed:", error);
    storeSettings = structuredClone(DEFAULT_SETTINGS);
    return;
  }

  storeSettings = {
    ...structuredClone(DEFAULT_SETTINGS),
    ...(data?.settings || {})
  };
}

async function saveSettings() {
  const button = document.getElementById("saveSettings");
  if (busy || !button) return;

  busy = true;
  button.disabled = true;
  button.textContent = "SAVING…";
  msg("Saving settings…");

  try {
    const { data, error } = await supabase
      .from("site_settings")
      .upsert({
        id: "storefront",
        settings: storeSettings,
        updated_at: new Date().toISOString()
      }, { onConflict: "id" })
      .select("id");

    if (error) throw error;
    if (!data?.length) {
      throw new Error(
        "Nothing saved. Check the admin account and database policies."
      );
    }

    msg("Settings saved to the database.");
  } catch (error) {
    console.error(error);
    msg("Save failed: " + error.message);
  } finally {
    busy = false;
    button.disabled = false;
    button.textContent = "SAVE ALL SETTINGS";
  }
}

function updateSetting(section, key, value) {
  if (!storeSettings[section]) storeSettings[section] = {};
  storeSettings[section][key] = value;
}

function field(section, key, label, value, type = "text") {
  return `
    <label>
      ${esc(label)}
      <input
        type="${type}"
        data-section="${esc(section)}"
        data-key="${esc(key)}"
        value="${esc(value)}"
      >
    </label>
  `;
}

function textareaField(section, key, label, value) {
  return `
    <label>
      ${esc(label)}
      <textarea rows="3"
        data-section="${esc(section)}"
        data-key="${esc(key)}">${esc(value)}</textarea>
    </label>
  `;
}

function colorField(section, key, label, value) {
  return `
    <label>
      ${esc(label)}
      <input type="color"
        data-section="${esc(section)}"
        data-key="${esc(key)}"
        value="${/^#[0-9a-f]{6}$/i.test(value || "")
          ? value : "#000000"}">
    </label>
  `;
}

function checkboxField(section, key, label, value) {
  return `
    <label class="checkbox-label">
      <input type="checkbox"
        data-section="${esc(section)}"
        data-key="${esc(key)}"
        ${value ? "checked" : ""}>
      ${esc(label)}
    </label>
  `;
}

function settingsSection(title, description, content) {
  return `
    <section class="admin-form-wrap" style="margin-bottom:24px">
      <p class="eyebrow">AURENAR SETTINGS</p>
      <h2>${esc(title)}</h2>
      <p class="admin-muted">${esc(description)}</p>
      <div class="admin-form">${content}</div>
    </section>
  `;
}

function renderSettings() {
  const s = storeSettings;

  app.innerHTML = `
    <section class="admin-page">
      <header class="admin-top">
        <div>
          <p class="eyebrow">AURENAR</p>
          <h1>Website Settings</h1>
        </div>
        <button class="secondary-btn" id="backDashboard">
          DASHBOARD
        </button>
      </header>

      <p class="admin-muted">
        Changes are saved to Supabase. Storefront pages must read
        these settings before changes appear on the live website.
      </p>

      ${settingsSection("Homepage", "Main homepage content", `
        ${field("home","title","Hero heading",s.home.title)}
        ${textareaField("home","subtitle","Hero subtitle",s.home.subtitle)}
        ${field("home","heroImage","Hero image URL",s.home.heroImage,"url")}
        ${field("home","buttonText","Button text",s.home.buttonText)}
        ${field("home","buttonLink","Button link",s.home.buttonLink)}
      `)}

      ${settingsSection("Men's Collection", "Dark black and burgundy direction", `
        ${field("men","title","Heading",s.men.title)}
        ${textareaField("men","subtitle","Subtitle",s.men.subtitle)}
        ${field("men","heroImage","Hero image URL",s.men.heroImage,"url")}
        ${colorField("men","background","Background",s.men.background)}
        ${colorField("men","textColor","Text colour",s.men.textColor)}
        ${colorField("men","accent","Accent / burgundy",s.men.accent)}
      `)}

      ${settingsSection("Women's Collection", "Dreamy pink and purple direction", `
        ${field("women","title","Heading",s.women.title)}
        ${textareaField("women","subtitle","Subtitle",s.women.subtitle)}
        ${field("women","heroImage","Hero image URL",s.women.heroImage,"url")}
        ${colorField("women","background","Background",s.women.background)}
        ${colorField("women","textColor","Text colour",s.women.textColor)}
        ${colorField("women","accent","Accent colour",s.women.accent)}
      `)}

      ${settingsSection("Store Theme", "Shared visual settings", `
        ${colorField("themes","homeBackground","Homepage background",s.themes.homeBackground)}
        ${colorField("themes","homeText","Homepage text colour",s.themes.homeText)}
        <label>
          FONT
          <select data-section="themes" data-key="font">
            ${["Cormorant Garamond","Inter","Georgia","Arial"].map(font =>
              `<option ${s.themes.font === font ? "selected" : ""}>${font}</option>`
            ).join("")}
          </select>
        </label>
        <label>
          BUTTON STYLE
          <select data-section="themes" data-key="buttonStyle">
            ${["minimal","solid","outlined"].map(style =>
              `<option value="${style}" ${s.themes.buttonStyle === style ? "selected" : ""}>${style}</option>`
            ).join("")}
          </select>
        </label>
      `)}

      ${settingsSection("Navigation", "Menu labels", `
        ${field("navigation","homeLabel","Home label",s.navigation.homeLabel)}
        ${field("navigation","menLabel","Men label",s.navigation.menLabel)}
        ${field("navigation","womenLabel","Women label",s.navigation.womenLabel)}
        ${field("navigation","discoverLabel","Discover label",s.navigation.discoverLabel)}
      `)}

      ${settingsSection("Announcement Bar", "Storewide announcement", `
        ${field("announcement","text","Announcement text",s.announcement.text)}
        ${checkboxField("announcement","enabled","Show announcement",s.announcement.enabled)}
      `)}

      <p id="notice" class="form-message" role="status"></p>
      <button class="primary-btn" id="saveSettings">
        SAVE ALL SETTINGS
      </button>
    </section>
  `;

  app.querySelector("#backDashboard").onclick = showDashboard;

  app.querySelectorAll("[data-section][data-key]").forEach(input => {
    const eventName =
      input.type === "checkbox" || input.type === "color" ||
      input.tagName === "SELECT" ? "change" : "input";

    input.addEventListener(eventName, () => {
      const value = input.type === "checkbox"
        ? input.checked
        : input.value;

      updateSetting(input.dataset.section, input.dataset.key, value);
    });
  });

  app.querySelector("#saveSettings").onclick = saveSettings;
}

async function showDashboard() {
  activeTab = "dashboard";

  app.innerHTML = `
    <section class="admin-page">
      <header class="admin-top">
        <div>
          <p class="eyebrow">AURENAR</p>
          <h1>Store Admin</h1>
          <p class="admin-muted">Manage your store.</p>
        </div>
        <button class="secondary-btn" id="logout">SIGN OUT</button>
      </header>

      <section class="admin-content">
        <div class="admin-heading">
          <div>
            <p class="eyebrow">WEBSITE CONTROL</p>
            <h2>Store Dashboard</h2>
          </div>
        </div>

        <div class="admin-form-wrap" style="margin-bottom:24px">
          <h2>Website Content & Themes</h2>
          <p class="admin-muted">
            Homepage, Men's Collection, Women's Collection,
            colours, navigation and announcement.
          </p>
          <button class="primary-btn" id="openSettings">
            OPEN WEBSITE SETTINGS
          </button>
        </div>

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

  document.getElementById("logout").onclick = logout;
  document.getElementById("addProduct").onclick = () => showProductForm();
  document.getElementById("openSettings").onclick = renderSettings;

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
    list.innerHTML = `<p class="form-message">Could not load products: ${esc(error.message)}</p>`;
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
        <button class="primary-btn" id="emptyAdd">ADD PRODUCT</button>
      </div>
    `;
    document.getElementById("emptyAdd").onclick = () => showProductForm();
    return;
  }

  list.innerHTML = `
    <div class="admin-products">
      ${products.map(p => `
        <article class="admin-product">
          <div class="admin-product-image">
            ${p.image_url
              ? `<img src="${esc(p.image_url)}" alt="${esc(p.name)}" loading="lazy">`
              : "<span>AURENAR</span>"}
          </div>
          <div class="admin-product-info">
            <h3>${esc(p.name)}</h3>
            <p>${money(p.price)}</p>
            <small>${esc(p.category || "men")} · ${p.is_active ? "Active" : "Hidden"}</small>
            <p class="admin-muted">${esc(p.description || "")}</p>
            <div class="admin-product-actions">
              <button class="secondary-btn" data-edit="${esc(p.id)}">EDIT</button>
              <button class="secondary-btn" data-delete="${esc(p.id)}">DELETE</button>
            </div>
          </div>
        </article>
      `).join("")}
    </div>
  `;

  list.querySelectorAll("[data-edit]").forEach(button => {
    button.onclick = () => {
      const product = products.find(p => String(p.id) === button.dataset.edit);
      if (product) showProductForm(product);
    };
  });

  list.querySelectorAll("[data-delete]").forEach(button => {
    button.onclick = () => deleteProduct(button.dataset.delete);
  });
}

function showProductForm(product = null) {
  editingId = product?.id ?? null;
  const sizes = Array.isArray(product?.sizes) ? product.sizes.join(", ") : "";

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
          <label>PRODUCT NAME
            <input name="name" maxlength="150" required value="${esc(product?.name || "")}">
          </label>
          <label>PRICE (INR)
            <input name="price" type="number" min="0" step="0.01" required value="${product?.price ?? ""}">
          </label>
          <label>CATEGORY
            <select name="category">
              ${["men","women","unisex"].map(c =>
                `<option value="${c}" ${(product?.category || "men").toLowerCase() === c ? "selected" : ""}>${c}</option>`
              ).join("")}
            </select>
          </label>
          <label>PRODUCT IMAGE URL
            <input name="image_url" type="url" value="${esc(product?.image_url || "")}" placeholder="https://...">
          </label>
          <label>SIZES
            <input name="sizes" value="${esc(sizes)}" placeholder="S, M, L, XL">
          </label>
          <label>DESCRIPTION
            <textarea name="description" rows="5">${esc(product?.description || "")}</textarea>
          </label>
          <label class="checkbox-label">
            <input name="is_active" type="checkbox" ${product?.is_active !== false ? "checked" : ""}>
            SHOW PRODUCT ON STORE
          </label>
          <p id="formMessage" class="form-message" role="status"></p>
          <button class="primary-btn" id="saveProduct" type="submit">
            ${product ? "SAVE CHANGES" : "CREATE PRODUCT"}
          </button>
        </form>
      </section>
    </section>
  `;

  document.getElementById("back").onclick = showDashboard;
  document.getElementById("productForm").onsubmit = saveProduct;
}

async function saveProduct(event) {
  event.preventDefault();
  if (busy) return;

  const form = event.currentTarget;
  const button = document.getElementById("saveProduct");
  const message = document.getElementById("formMessage");
  const formData = new FormData(form);

  const name = String(formData.get("name") || "").trim();
  const category = String(formData.get("category") || "men").trim();
  const price = Number(formData.get("price"));
  const imageURL = String(formData.get("image_url") || "").trim();

  if (!name || !Number.isFinite(price) || price < 0) {
    message.textContent = "Enter a valid name and price.";
    return;
  }

  if (imageURL) {
    try {
      const url = new URL(imageURL);
      if (!["https:", "http:"].includes(url.protocol)) throw new Error();
    } catch {
      message.textContent = "Enter a valid image URL.";
      return;
    }
  }

  const sizes = String(formData.get("sizes") || "")
    .split(",").map(s => s.trim()).filter(Boolean);

  const payload = {
    name,
    price,
    category,
    image_url: imageURL || null,
    sizes: sizes.length ? sizes : ["S","M","L","XL"],
    description: String(formData.get("description") || "").trim() || null,
    is_active: formData.get("is_active") === "on"
  };

  busy = true;
  button.disabled = true;
  button.textContent = "SAVING…";
  message.textContent = "Saving product…";

  try {
    const result = editingId !== null
      ? await supabase.from("products").update(payload).eq("id", editingId).select("id")
      : await supabase.from("products").insert(payload).select("id");

    if (result.error) throw result.error;
    if (!result.data?.length) {
      throw new Error("No product saved. Check products table RLS policies.");
    }

    editingId = null;
    await showDashboard();
  } catch (error) {
    message.textContent = error.message || "Could not save product.";
    button.disabled = false;
    button.textContent = editingId !== null ? "SAVE CHANGES" : "CREATE PRODUCT";
  } finally {
    busy = false;
  }
}

async function deleteProduct(id) {
  const product = products.find(p => String(p.id) === String(id));
  if (!product) return;

  if (!confirm(`Delete "${product.name}" permanently?`)) return;

  const { data, error } = await supabase
    .from("products")
    .delete()
    .eq("id", id)
    .select("id");

  if (error) {
    alert("Product could not be deleted: " + error.message);
    return;
  }

  if (!data?.length) {
    alert("Nothing deleted. Check admin role and product RLS policies.");
    return;
  }

  await loadProducts();
}

async function logout() {
  const { error } = await supabase.auth.signOut();

  if (error) {
    alert("Sign out failed: " + error.message);
    return;
  }

  products = [];
  editingId = null;
  showLogin();
}

async function start() {
  if (!app) return;

  try {
    await checkAdmin();
  } catch (error) {
    console.error(error);
    showLogin(error.message || "Unable to start admin.");
  }
}

start();