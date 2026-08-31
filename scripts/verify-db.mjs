// node scripts/verify-db.mjs -> checks .env creds + that the migration is applied
import fs from "node:fs";

const env = Object.fromEntries(
  fs
    .readFileSync(".env", "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const url = env.EXPO_PUBLIC_SUPABASE_URL;
const key = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error("FAIL: .env is missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY");
  process.exit(1);
}

const tables = ["profiles", "guardians", "emergency_contacts", "sos_events", "locations", "device_tokens", "notifications"];
let missing = 0;

for (const t of tables) {
  const res = await fetch(`${url}/rest/v1/${t}?select=*&limit=1`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  const ok = res.status !== 404;
  if (!ok) missing++;
  console.log(`${ok ? "OK  " : "MISS"} ${t}${ok ? "" : " (table not found)"}`);
}

const auth = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } }).then((r) => r.json());
console.log(`\nauth: email signup=${auth.external?.email}, auto-confirm=${auth.mailer_autoconfirm}`);
if (!auth.mailer_autoconfirm) console.log("NOTE: email confirmation is ON — new sign-ups must confirm before they get a session.");

console.log(missing === 0 ? "\nDatabase looks ready." : `\n${missing} table(s) missing — apply supabase/migrations/0001_init.sql.`);
process.exit(missing === 0 ? 0 : 1);
