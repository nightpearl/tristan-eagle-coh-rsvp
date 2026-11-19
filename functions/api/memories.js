// /api/memories — the Memory Book. POST adds one memory. There is no public listing: memories are
// private to the Bond family and read directly from the database.
// Uses the D1 database bound as DB. To hide an entry: UPDATE memories SET hidden = 1 WHERE id = ?

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

const RELATIONSHIPS = ["Scout / Leader", "Scout Parent", "Family", "Friend"];

export function validateMemory(input) {
  const name = String(input?.name ?? "").trim().slice(0, 80);
  const memory = String(input?.memory ?? "").trim().slice(0, 1000);
  const rel = String(input?.relationship ?? "");
  const relationship = RELATIONSHIPS.includes(rel) ? rel : null;
  if (!name) return { error: "Please add your name so Tristan knows who wrote this." };
  if (memory.length < 3) return { error: "Please write a memory to share." };
  return { value: { name, memory, relationship } };
}

export async function onRequestPost({ request, env }) {
  let input;
  try {
    input = await request.json();
  } catch {
    return json({ error: "Something was wrong with the form. Please refresh and try again." }, 400);
  }
  if (input && input.website) return json({ ok: true }); // honeypot

  const { value, error } = validateMemory(input);
  if (error) return json({ error }, 400);

  try {
    await env.DB.prepare("INSERT INTO memories (name, relationship, memory) VALUES (?, ?, ?)")
      .bind(value.name, value.relationship, value.memory)
      .run();
    return json({ ok: true });
  } catch (e) {
    console.error("Memory save failed", e);
    return json({ error: "We couldn't save your memory just now. Please try again in a minute." }, 500);
  }
}

export function onRequest() {
  return json({ error: "Use the Memory Book form." }, 405);
}
