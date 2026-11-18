# Tristan's Eagle Court of Honor — RSVP

RSVP page for Tristan Marcus Bond's Eagle Scout Court of Honor, Saturday, December 19, 2026, 1:00–3:00 PM at the Skokie Devonshire Theatre.

- `public/index.html` — the page guests see
- `functions/api/rsvp.js` — saves each RSVP (one per email; resubmitting updates it)
- `wrangler.toml` — Cloudflare Pages config, binds the D1 database `tristan-eagle-coh-rsvp` as `DB`
- `schema.sql` — the `rsvps` table (already created)

Hosted on Cloudflare Pages, deployed automatically from the `main` branch.

## Headcount

```sql
SELECT COUNT(*) AS replies, SUM(guests) AS attending FROM rsvps;
```
