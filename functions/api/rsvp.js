// /api/rsvp — POST saves or updates one RSVP (keyed by email); GET returns the public headcount.
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
  const message = String(input?.message ?? "").trim().slice(0, 500) || null;

  if (!first || !last) return { error: "Please enter your first and last name." };
  if (!EMAIL_RE.test(email)) return { error: "Please enter a valid email address." };

  const party = {};
  for (const c of CATEGORIES) {
    const n = Number.parseInt(input?.party?.[c.key] ?? 0, 10);
    if (!Number.isInteger(n) || n < 0 || n > 20) return { error: `${c.label} must be between 0 and 20.` };
    party[c.key] = n;
  }
  const guests = CATEGORIES.reduce((t, c) => t + party[c.key], 0);
  if (guests < 1) return { error: "Please add at least one person to your party." };
  if (guests > 20) return { error: "Parties are limited to 20 people. For a larger group, send separate RSVPs." };
  const relationship = CATEGORIES.filter((c) => party[c.key] > 0).map((c) => c.label).join(", ");
  return { value: { first, last, email, guests, party, relationship, message } };
}

export const CATEGORIES = [
  { key: "scout", label: "Scout / Leader", col: "n_scout" },
  { key: "parent", label: "Scout Parent", col: "n_parent" },
  { key: "family", label: "Family", col: "n_family" },
  { key: "friend", label: "Friend", col: "n_friend" },
];

// GET /api/rsvp — public headcount only: total people and people per category. No names or emails.
export async function onRequestGet({ env }) {
  try {
    const row = await env.DB.prepare(
      `SELECT COALESCE(SUM(guests), 0) AS total,
              COALESCE(SUM(n_scout), 0) AS scout, COALESCE(SUM(n_parent), 0) AS parent,
              COALESCE(SUM(n_family), 0) AS family, COALESCE(SUM(n_friend), 0) AS friend
       FROM rsvps`
    ).first();
    return json({
      total: row.total,
      counts: { scout: row.scout, parent: row.parent, family: row.family, friend: row.friend },
    });
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
      `INSERT INTO rsvps (first_name, last_name, email, guests, relationship, message,
                          n_scout, n_parent, n_family, n_friend)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(email) DO UPDATE SET
         first_name   = excluded.first_name,
         last_name    = excluded.last_name,
         guests       = excluded.guests,
         relationship = excluded.relationship,
         message      = excluded.message,
         n_scout      = excluded.n_scout,
         n_parent     = excluded.n_parent,
         n_family     = excluded.n_family,
         n_friend     = excluded.n_friend,
         updated_at   = datetime('now')`
    )
      .bind(value.first, value.last, value.email, value.guests, value.relationship, value.message,
            value.party.scout, value.party.parent, value.party.family, value.party.friend)
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
