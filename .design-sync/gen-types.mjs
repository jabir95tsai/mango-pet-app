// design-sync: emit a .d.ts tree for the ui/ primitives so the converter's
// type extractor (ts-morph over the package's declared `types` entry) can
// resolve real <Name>Props contracts. apps/web is an app, not a library, so
// it has no dist/ — this stands in for one. Output is gitignored; run via
// cfg.buildCmd before every converter build.
import { execFileSync } from "node:child_process";
import { readdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
// rootDir is src/ (ui/ imports @/lib/*), so the ui declarations land under components/ui/.
const out = join(root, "apps/web/.design-sync-types/components/ui");
const tsc = join(root, "node_modules/typescript/bin/tsc");
execFileSync(process.execPath, [tsc, "-p", join(here, "tsconfig.types.json")], { stdio: "inherit" });
const files = readdirSync(out).filter((f) => f.endsWith(".d.ts") && f !== "index.d.ts");
writeFileSync(join(out, "index.d.ts"), files.map((f) => `export * from "./${f.replace(/\.d\.ts$/, "")}";`).join("\n") + "\n");
console.log(`design-sync types: ${files.length} declaration files → apps/web/.design-sync-types/components/ui/index.d.ts`);
