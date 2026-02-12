import path from "node:path";
import fs from "node:fs";
import { copyDir, ensureDir, projectRoot } from "./utils.js";

const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const tag = process.argv[2] ?? "manual";
const backupDir = path.join(projectRoot, "_backups", `${timestamp}_${tag}`);

ensureDir(backupDir);

const itemsToBackup = ["src", "package.json", "tsconfig.json", "vite.config.ts", "README.md", "_tools"];

itemsToBackup.forEach((item) => {
  const source = path.join(projectRoot, item);
  if (!fs.existsSync(source)) return;
  const target = path.join(backupDir, item);
  const stat = fs.statSync(source);
  if (stat.isDirectory()) {
    copyDir(source, target);
  } else {
    fs.copyFileSync(source, target);
  }
});

console.log(`Backup created at ${backupDir}`);
