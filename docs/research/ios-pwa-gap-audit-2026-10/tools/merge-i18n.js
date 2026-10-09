// Merge new i18n keys into the shared catalogs (worktree copy).
// usage: node merge-i18n.js <catalogDir> <keys.json>
// keys.json = [{ key: "Ns.sub.key", zh: "...", en: "..." }, ...]
// Never overwrites an existing string; reports conflicts/duplicates.
const fs = require("fs");
const path = require("path");
const [dir, keysFile] = process.argv.slice(2);
const keys = JSON.parse(fs.readFileSync(keysFile, "utf8"));
const files = { zh: path.join(dir, "zh-TW.json"), en: path.join(dir, "en.json") };
const raw = { zh: fs.readFileSync(files.zh, "utf8"), en: fs.readFileSync(files.en, "utf8") };
const eol = raw.zh.includes("\r\n") ? "\r\n" : "\n";
const cat = { zh: JSON.parse(raw.zh), en: JSON.parse(raw.en) };
const report = { added: [], same: [], conflict: [], blocked: [] };
const seen = new Map();
for (const k of keys) {
  if (seen.has(k.key)) {
    const p = seen.get(k.key);
    if (p.zh !== k.zh || p.en !== k.en) report.conflict.push({ key: k.key, first: p, second: k, reason: "proposed twice differently (first kept)" });
    continue;
  }
  seen.set(k.key, k);
  const parts = k.key.split(".");
  let ok = true;
  for (const lang of ["zh", "en"]) {
    let o = cat[lang];
    for (let i = 0; i < parts.length - 1; i++) {
      if (o[parts[i]] === undefined) o[parts[i]] = {};
      if (typeof o[parts[i]] !== "object") { ok = false; report.blocked.push({ key: k.key, reason: `${parts.slice(0, i + 1).join(".")} is a string` }); break; }
      o = o[parts[i]];
    }
    if (!ok) break;
    const leaf = parts[parts.length - 1];
    const val = lang === "zh" ? k.zh : k.en;
    if (o[leaf] === undefined) { o[leaf] = val; if (lang === "zh") report.added.push(k.key); }
    else if (typeof o[leaf] === "object") { report.blocked.push({ key: k.key, reason: "is an object namespace" }); ok = false; break; }
    else if (o[leaf] === val) { if (lang === "zh") report.same.push(k.key); }
    else if (lang === "zh" || !report.conflict.find((c) => c.key === k.key)) report.conflict.push({ key: k.key, existing: o[leaf], proposed: val, lang });
  }
}
for (const lang of ["zh", "en"]) {
  fs.writeFileSync(files[lang], JSON.stringify(cat[lang], null, 2).replace(/\n/g, eol) + eol);
}
console.log(JSON.stringify(report, null, 1));
