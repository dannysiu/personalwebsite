import { cp, readdir, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const buildRoot = join(projectRoot, "static-dist");

// The generated JavaScript and CSS are content-hashed, so clear only the
// build-owned asset directory before copying the fresh static site in place.
await rm(join(projectRoot, "assets"), { recursive: true, force: true });

for (const entry of await readdir(buildRoot)) {
  await cp(join(buildRoot, entry), join(projectRoot, entry), {
    recursive: true,
    force: true,
  });
}

console.log("Prepared /riftrotor for GitHub Pages.");
