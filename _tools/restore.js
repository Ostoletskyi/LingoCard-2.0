import path from "node:path";
import fs from "node:fs";
import { copyDir, listDirs, projectRoot } from "./utils.js";

const backupsRoot = path.join(projectRoot, "_backups");
if (!fs.existsSync(backupsRoot)) {
  console.error("No backups directory found.");
  process.exit(1);
}

const backupName = process.argv[2];
const backups = listDirs(backupsRoot);

if (!backupName) {
  console.log("Available backups:");
  backups.forEach((name) => console.log(`- ${name}`));
  process.exit(0);
}

if (!backups.includes(backupName)) {
  console.error("Backup not found.");
  process.exit(1);
}

const backupDir = path.join(backupsRoot, backupName);
copyDir(backupDir, projectRoot);
console.log(`Restored from ${backupName}`);
