import { supabase } from "./supabase.js";

const BUCKET = "aurenar-media";

export function initMediaLibrary(container) {
  if (!container) return;

  container.innerHTML = `
    <section class="media-library">
      <h2>Media Library</h2>
      <p>Upload and manage AURENAR images.</p>

      <label for="mediaCategory">Image category</label>
      <select id="mediaCategory">
        <option value="home">Homepage</option>
        <option value="men">Men</option>
        <option value="women">Women</option>
        <option value="products">Products</option>
        <option value="editorial">Editorial</option>
      </select>

      <label for="mediaFiles">Choose images from your phone</label>
      <input
        id="mediaFiles"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
      >

      <button id="uploadMedia" type="button">Upload Images</button>
      <p id="mediaStatus" role="status"></p>
      <div id="mediaGrid" class="media-grid"></div>
    </section>
  `;

  const category = container.querySelector("#mediaCategory");
  const filesInput = container.querySelector("#mediaFiles");
  const uploadButton = container.querySelector("#uploadMedia");
  const status = container.querySelector("#mediaStatus");
  const grid = container.querySelector("#mediaGrid");

  async function loadImages() {
    grid.replaceChildren();
    status.textContent = "Loading images…";

    const { data, error } = await supabase.storage
      .from(BUCKET)
      .list(category.value, {
        limit: 100,
        sortBy: { column: "created_at", order: "desc" }
      });

    if (error) {
      status.textContent = "Could not load images: " + error.message;
      return;
    }

    const images = (data || []).filter(file =>
      /\.(jpe?g|png|webp)$/i.test(file.name)
    );

    status.textContent = images.length
      ? `${images.length} images`
      : "No images in this category yet.";

    for (const file of images) {
      const path = `${category.value}/${file.name}`;
      const { data: urlData } = supabase.storage
        .from(BUCKET)
        .getPublicUrl(path);

      const card = document.createElement("article");
      card.className = "media-card";

      const image = document.createElement("img");
      image.src = urlData.publicUrl;
      image.alt = file.name;
      image.loading = "lazy";

      const name = document.createElement("p");
      name.textContent = file.name;

      const copyButton = document.createElement("button");
      copyButton.type = "button";
      copyButton.textContent = "Copy image URL";

      copyButton.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(urlData.publicUrl);
          status.textContent = "Image URL copied.";
        } catch {
          window.prompt("Copy this image URL:", urlData.publicUrl);
        }
      });

      card.append(image, name, copyButton);
      grid.append(card);
    }
  }

  uploadButton.addEventListener("click", async () => {
    const files = Array.from(filesInput.files || []);

    if (!files.length) {
      status.textContent = "Choose at least one image first.";
      return;
    }

    uploadButton.disabled = true;

    try {
      for (const file of files) {
        if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
          status.textContent = `Unsupported image: ${file.name}`;
          continue;
        }

        if (file.size > 8 * 1024 * 1024) {
          status.textContent = `${file.name} is over 8 MB.`;
          continue;
        }

        const safeName = file.name
          .normalize("NFKD")
          .replace(/[^a-zA-Z0-9._-]/g, "-")
          .replace(/-+/g, "-");

        const path =
          `${category.value}/${Date.now()}-${safeName}`;

        status.textContent = `Uploading ${file.name}…`;

        const { error } = await supabase.storage
          .from(BUCKET)
          .upload(path, file, {
            cacheControl: "3600",
            contentType: file.type,
            upsert: false
          });

        if (error) {
          throw error;
        }
      }

      filesInput.value = "";
      await loadImages();
      status.textContent += " Upload finished.";
    } catch (error) {
      status.textContent = "Upload failed: " + error.message;
    } finally {
      uploadButton.disabled = false;
    }
  });

  category.addEventListener("change", loadImages);
  loadImages();
}