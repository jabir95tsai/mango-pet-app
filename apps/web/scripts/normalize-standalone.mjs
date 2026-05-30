import { cp, readdir } from "node:fs/promises";
import path from "node:path";

const standaloneRoot = path.resolve(".next", "standalone");
const nestedAppRoot = path.join(standaloneRoot, "apps", "web");

try {
  const entries = await readdir(nestedAppRoot, { withFileTypes: true });

  await Promise.all(
    entries.map((entry) =>
      cp(path.join(nestedAppRoot, entry.name), path.join(standaloneRoot, entry.name), {
        recursive: true,
        force: true,
      }),
    ),
  );

  console.log(
    "[normalize-standalone] copied .next/standalone/apps/web into .next/standalone for App Hosting",
  );
} catch (err) {
  if (err && typeof err === "object" && "code" in err && err.code === "ENOENT") {
    console.log("[normalize-standalone] nested standalone app not found; skipping");
  } else {
    throw err;
  }
}
