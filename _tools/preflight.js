import fs from "node:fs";
import path from "node:path";
import { projectRoot } from "./utils.js";

const checks = [];

const pushCheck = (name, ok, details = "") => {
  checks.push({ name, ok, details });
  const icon = ok ? "✅" : "❌";
  console.log(`${icon} ${name}${details ? ` — ${details}` : ""}`);
  if (!ok) {
    process.exitCode = 1;
  }
};

const exists = (relPath) => fs.existsSync(path.join(projectRoot, relPath));

const hasNodeModules = exists("node_modules");
pushCheck("node_modules installed", hasNodeModules, hasNodeModules ? "found" : "missing");

const requiredBins = [
  "node_modules/.bin/vite",
  "node_modules/.bin/tsc",
  "node_modules/.bin/eslint"
];

for (const binPath of requiredBins) {
  pushCheck(`binary ${binPath}`, exists(binPath), exists(binPath) ? "found" : "missing");
}

const requiredFiles = [
  "package.json",
  "tsconfig.json",
  "src/main.tsx",
  "src/ui/App.tsx",
  "src/ui/EditorCanvas.tsx"
];

for (const filePath of requiredFiles) {
  pushCheck(`file ${filePath}`, exists(filePath), exists(filePath) ? "ok" : "missing");
}

if (!hasNodeModules) {
  console.log("\nℹ️ Для полного тестирования установите зависимости: npm ci (или npm install).");
}

console.log("\nPreflight complete.");
