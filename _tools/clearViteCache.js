import { existsSync, rmSync } from "node:fs";
import path from "node:path";

const cacheDir = path.resolve(process.cwd(), "node_modules/.vite");

if (existsSync(cacheDir)) {
  rmSync(cacheDir, { recursive: true, force: true });
  console.log(`[tools] cleared Vite cache: ${cacheDir}`);
}
