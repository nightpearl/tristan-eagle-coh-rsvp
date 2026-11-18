// POST /api/rsvp — saves or updates one RSVP (keyed by email) in the D1 database bound as DB.

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validate(input) {
  const first = String(input?.first ?? "").trim().slice(0, 60);
  const last = String(input?.last ?? "").trim().slice(0, 60);
  const email = String(input?.email ?? "").trim().toLowerCase().slice(0, 120);
  const guests = Number.parseInt(input?.guests, 10);

  if (!first || !last) return { error: "Please enter your first and last name." };
  if (!EMAIL_RE.test(email)) return { error: "Please enter a valid email address." };
  if (!Number.isInteger(guests) || guests < 1 || guests > 20)
    return { error: "Number attending must be between 1 and 20." };
  return { value: { first, last, email, guests } };
}

export async function onRequestPost({ request, env }) {
  let input;
  try {
    input = await request.json();
  } catch {
    return json({ error: "Something was wrong with the form. Please refresh and try again." }, 400);
  }

  // Honeypot: bots fill the hidden "website" field. Pretend success, save nothing.
  if (input && input.website) return json({ ok: true });

  const { value, error } = validate(input);
  if (error) return json({ error }, 400);

  try {
    const existing = await env.DB.prepare("SELECT id FROM rsvps WHERE email = ?")
      .bind(value.email)
      .first();

    await env.DB.prepare(
      `INSERT INTO rsvps (first_name, last_name, email, guests)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(email) DO UPDATE SET
         first_name = excluded.first_name,
         last_name  = excluded.last_name,
         guests     = excluded.guests,
         updated_at = datetime('now')`
    )
      .bind(value.first, value.last, value.email, value.guests)
      .run();

    return json({ ok: true, updated: Boolean(existing) });
  } catch (e) {
    console.error("RSVP save failed", e);
    return json({ error: "We couldn't save your RSVP just now. Please try again in a minute." }, 500);
  }
}

export function onRequest() {
  return json({ error: "Use the RSVP form to reply." }, 405);
}
