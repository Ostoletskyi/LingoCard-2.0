import fs from "node:fs";
import path from "node:path";
import { projectRoot } from "./utils.js";

const checks = [];

const pushCheck = (name, ok, details = "") => {
  checks.push({ name, ok, details });
  const tag = ok ? "[OK]" : "[FAIL]";
  console.log(`${tag} ${name}${details ? ` - ${details}` : ""}`);
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
  "src/ui/EditorCanvas.tsx",
  "src/io/normalizer.ts",
  "src/state/store.ts",
  "src/utils/cardFields.ts",
  "src/editor/semanticLayout.ts"
];

for (const filePath of requiredFiles) {
  pushCheck(`file ${filePath}`, exists(filePath), exists(filePath) ? "ok" : "missing");
}

const sourceFiles = fs
  .readdirSync(path.join(projectRoot, "src"), { recursive: true })
  .filter((p) => typeof p === "string" && /\.(ts|tsx|js|jsx|css)$/.test(p));

for (const rel of sourceFiles) {
  const full = path.join(projectRoot, "src", rel);
  try {
    const content = fs.readFileSync(full, "utf-8");
    const hasMarkers = content.includes("<<<<<<<") || content.includes("=======") || content.includes(">>>>>>>");
    if (hasMarkers) {
      pushCheck(`merge markers in src/${rel}`, false, "resolve conflict markers");
    }
  } catch (error) {
    pushCheck(`scan src/${rel}`, false, error instanceof Error ? error.message : String(error));
  }
}

const exportChecks = [
  { file: "src/io/normalizer.ts", exportName: "normalizeImportedJson" },
  { file: "src/io/normalizer.ts", exportName: "detectSchema" },
  { file: "src/editor/semanticLayout.ts", exportName: "applySemanticLayoutToCard" },
  { file: "src/model/cardSchema.ts", exportName: "normalizeCard" },
  { file: "src/utils/cardFields.ts", exportName: "getFieldText" },
  { file: "src/state/store.ts", exportName: "useAppStore" }
];

const runExportChecks = async () => {
  for (const item of exportChecks) {
    try {
      const fullPath = path.join(projectRoot, item.file);
      const content = fs.readFileSync(fullPath, "utf-8");
      const hasNamedExport =
        content.includes(`export const ${item.exportName}`) ||
        content.includes(`export function ${item.exportName}`) ||
        content.includes(`export { ${item.exportName}`) ||
        content.includes(`export {${item.exportName}`);
      pushCheck(`export ${item.exportName} from ${item.file}`, hasNamedExport);
    } catch (error) {
      pushCheck(
        `export ${item.exportName} from ${item.file}`,
        false,
        error instanceof Error ? error.message : String(error)
      );
    }
  }
};

const main = async () => {
  await runExportChecks();

  if (!hasNodeModules) {
    console.log("\n[INFO] For full testing, install dependencies: npm ci (or npm install).\n");
  }

  if (process.exitCode && process.exitCode !== 0) {
    console.error("\n[WARN] Preflight failed: one or more critical checks did not pass.\n");
  }

  console.log("\nPreflight complete.");
};

main().catch((error) => {
  console.error("Preflight failed:", error);
  process.exitCode = 1;
});
