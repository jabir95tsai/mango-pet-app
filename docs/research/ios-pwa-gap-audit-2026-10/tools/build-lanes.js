// Build per-lane gap files from the audit journal (audit + verify results).
// usage: node build-lanes.js <journalDir> <outDir>
const fs = require("fs");
const path = require("path");
const [journalDir, outDir] = process.argv.slice(2);
const lines = fs
  .readFileSync(path.join(journalDir, "journal.jsonl"), "utf8")
  .split("\n")
  .filter(Boolean)
  .map((l) => JSON.parse(l));
const started = {};
for (const l of lines) if (l.type === "started") started[l.key] = l.label;
const res = {};
for (const l of lines)
  if (l.type === "result") res[started[l.key] || l.label] = l.result ?? l.value;

const gaps = {}; // id -> gap (with verdict merged)
for (const [lab, r] of Object.entries(res)) {
  if (!lab.startsWith("audit:") || !r) continue;
  for (const g of r.gaps) gaps[g.id] = { ...g };
}
const verifiedSurfaces = [];
for (const [lab, r] of Object.entries(res)) {
  if (!lab.startsWith("verify:") || !r) continue;
  verifiedSurfaces.push(lab);
  for (const v of r.verdicts) {
    const g = gaps[v.id];
    if (!g) continue;
    g.verdict = v.verdict;
    g.verdict_reason = v.reason;
    if (v.corrected_fix_plan) g.corrected_fix_plan = v.corrected_fix_plan;
    if (v.corrected_severity) g.corrected_severity = v.corrected_severity;
  }
  for (const m of r.missed_gaps || []) gaps[m.id] = { ...m, verdict: "missed-by-auditor (verifier-found)" };
}

// lane -> gap id prefixes / explicit ids
const LANES = JSON.parse(fs.readFileSync(path.join(outDir, "lanes.json"), "utf8"));
const assigned = new Set();
for (const [lane, spec] of Object.entries(LANES)) {
  const picked = [];
  for (const id of Object.keys(gaps)) {
    const hit = spec.ids.includes(id) || (spec.prefixes || []).some((p) => id.startsWith(p) && !(spec.exclude || []).includes(id));
    if (hit) { picked.push(gaps[id]); assigned.add(id); }
  }
  fs.writeFileSync(path.join(outDir, `lane-${lane}.json`), JSON.stringify(picked, null, 1));
  console.log(lane, picked.length, picked.filter((g) => g.verdict === "refuted").length + " refuted");
}
const un = Object.keys(gaps).filter((id) => !assigned.has(id));
console.log("UNASSIGNED", un.join(" "));
console.log("verified surfaces:", verifiedSurfaces.join(" "));
fs.writeFileSync(path.join(outDir, "all-gaps.json"), JSON.stringify(gaps, null, 1));
