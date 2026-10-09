// Verify every literal t("Ns.key") used in apps/ios exists in both catalogs.
// usage: node check-keys.js <repoRoot>
const fs = require("fs");
const path = require("path");
const root = process.argv[2];
const read = (f) => JSON.parse(fs.readFileSync(path.join(root, "packages/shared-i18n/src/messages", f), "utf8"));
const zh = read("zh-TW.json");
const en = read("en.json");
function has(o, k) {
  let x = o;
  for (const p of k.split(".")) {
    if (x == null || typeof x !== "object" || !(p in x)) return false;
    x = x[p];
  }
  return typeof x === "string";
}
const files = [];
(function walk(d) {
  for (const f of fs.readdirSync(d)) {
    if (f === "node_modules" || f === ".expo") continue;
    const p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (/\.(tsx?|jsx?)$/.test(f)) files.push(p);
  }
})(path.join(root, "apps/ios"));
const re = /\bt\(\s*["'`]([A-Za-z]\w*(?:\.\w+)+)["'`]/g;
const miss = [];
for (const f of files) {
  const src = fs.readFileSync(f, "utf8");
  let m;
  while ((m = re.exec(src))) {
    const k = m[1];
    const z = has(zh, k), e = has(en, k);
    if (!z || !e) miss.push(`${path.relative(root, f)} :: ${k}${z ? " (en missing)" : e ? " (zh missing)" : ""}`);
  }
}
console.log(miss.length ? miss.join("\n") : "ALL literal t() keys exist in zh-TW + en");
