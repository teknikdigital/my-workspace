// Aktifkan commit & push otomatis (agent v1.6.0) di agent/apps.json tanpa menimpa isi lain.
// Pakai:  node scripts/aktifkan-autocommit.mjs          (aktifkan)
//         node scripts/aktifkan-autocommit.mjs --matikan (nonaktifkan)
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const file = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "agent", "apps.json");
const SETTINGS = {
  myworkspace: { autoCommit: true, push: true, verify: ["npx tsc --noEmit", "npx vitest run"] },
  "rally-district": { autoCommit: true, push: true, repo: "main-app/rally-district-app", verify: ["npx tsc --noEmit"] },
  rapiuang: { autoCommit: true, push: true, verify: ["npm --prefix client run build"] },
};
const off = process.argv.includes("--matikan");
const raw = fs.readFileSync(file, "utf8");
const cfg = JSON.parse(raw);
fs.writeFileSync(`${file}.bak`, raw);
for (const app of cfg.apps || []) {
  const s = SETTINGS[app.id];
  if (!s || !app.claude) continue;
  if (app.claude.mode !== "edit") {
    console.log(`- ${app.id}: dilewati (mode baca saja)`);
    continue;
  }
  if (off) delete app.claude.git;
  else app.claude.git = { ...(app.claude.git || {}), ...s };
  console.log(`- ${app.id}: ${off ? "dimatikan" : `aktif${s.push ? " (commit + push)" : " (commit saja)"}`}`);
}
fs.writeFileSync(file, JSON.stringify(cfg, null, 2) + "\n");
console.log(`Tersimpan: ${file} (cadangan: apps.json.bak). Restart agent agar berlaku.`);
