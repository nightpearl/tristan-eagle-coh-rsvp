// /api/photos — POST one photo (multipart form: photo, name, caption). Stored privately in the
// R2 bucket bound as PHOTOS, with a row in the D1 `photos` table. There is no public listing.

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

export const MAX_BYTES = 25 * 1024 * 1024;
const TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/heic": "heic",
  "image/heif": "heif",
};

export function extFor(file) {
  if (TYPES[file.type]) return TYPES[file.type];
  const m = /\.(jpe?g|png|webp|gif|heic|heif)$/i.exec(file.name || "");
  return m ? m[1].toLowerCase().replace("jpeg", "jpg") : null;
}

export async function onRequestPost({ request, env }) {
  let form;
  try {
    form = await request.formData();
  } catch {
    return json({ error: "That upload didn't come through. Please try again." }, 400);
  }
  if (form.get("website")) return json({ ok: true }); // honeypot

  const file = form.get("photo");
  const name = String(form.get("name") ?? "").trim().slice(0, 80);
  const caption = String(form.get("caption") ?? "").trim().slice(0, 300) || null;

  if (!name) return json({ error: "Please add your name so we know who shared these." }, 400);
  if (!file || typeof file === "string") return json({ error: "Please choose a photo to upload." }, 400);
  const ext = extFor(file);
  if (!ext) return json({ error: `${file.name || "That file"} isn't a photo. Use JPG, PNG, HEIC, WebP, or GIF.` }, 400);
  if (file.size > MAX_BYTES) return json({ error: `${file.name || "That photo"} is over 25 MB. Please pick a smaller one.` }, 400);

  const contentType = (file.type || "").startsWith("image/") ? file.type : `image/${ext}`;
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "");
  const key = `photos/${stamp}-${crypto.randomUUID().slice(0, 8)}.${ext}`;

  try {
    await env.PHOTOS.put(key, file.stream(), {
      httpMetadata: { contentType },
      customMetadata: { name, caption: caption ?? "", original: (file.name || "").slice(0, 200) },
    });
    await env.DB.prepare(
      "INSERT INTO photos (object_key, name, caption, content_type, size_bytes) VALUES (?, ?, ?, ?, ?)"
    )
      .bind(key, name, caption, contentType, file.size)
      .run();
    return json({ ok: true });
  } catch (e) {
    console.error("Photo upload failed", e);
    return json({ error: "We couldn't save that photo just now. Please try again in a minute." }, 500);
  }
}

export function onRequest() {
  return json({ error: "Use the photo upload form." }, 405);
}
