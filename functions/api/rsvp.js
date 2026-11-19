// /api/rsvp — POST saves or updates one RSVP (keyed by email); GET returns the public guest list.
// Uses the D1 database bound as DB.

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
  const relationship = String(input?.relationship ?? "");
  if (!RELATIONSHIPS.includes(relationship))
    return { error: "Please choose Scout, Family, or Friend." };
  const message = String(input?.message ?? "").trim().slice(0, 500) || null;
  return { value: { first, last, email, guests, relationship, message } };
}

const RELATIONSHIPS = ["Scout", "Family", "Friend"];

// GET /api/rsvp — public headcount only: total people and people per category. No names or emails.
export async function onRequestGet({ env }) {
  try {
    const { results } = await env.DB.prepare(
      `SELECT relationship, COUNT(*) AS replies, SUM(guests) AS people
       FROM rsvps GROUP BY relationship`
    ).all();
    const counts = { Scout: 0, Family: 0, Friend: 0 };
    let total = 0;
    for (const r of results) {
      total += r.people;
      if (r.relationship in counts) counts[r.relationship] += r.people;
    }
    return json({ total, counts });
  } catch (e) {
    console.error("Headcount failed", e);
    return json({ error: "Couldn't load the headcount." }, 500);
  }
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
      `INSERT INTO rsvps (first_name, last_name, email, guests, relationship, message)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(email) DO UPDATE SET
         first_name   = excluded.first_name,
         last_name    = excluded.last_name,
         guests       = excluded.guests,
         relationship = excluded.relationship,
         message      = excluded.message,
         updated_at   = datetime('now')`
    )
      .bind(value.first, value.last, value.email, value.guests, value.relationship, value.message)
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
