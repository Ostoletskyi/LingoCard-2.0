import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const currentFilePath = fileURLToPath(import.meta.url);
export const projectRoot = path.resolve(path.dirname(currentFilePath), "..");

export const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

export const resolveCommand = (command) =>
  process.platform === "win32" && command === "npm" ? "npm.cmd" : command;

export const runCommand = (command, args, options = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn(resolveCommand(command), args, { stdio: "inherit", shell: false, ...options });
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with code ${code}`));
    });
  });

export const copyDir = (source, target) => {
  ensureDir(target);
  fs.readdirSync(source, { withFileTypes: true }).forEach((entry) => {
    const sourcePath = path.join(source, entry.name);
    const targetPath = path.join(target, entry.name);
    if (entry.isDirectory()) {
      copyDir(sourcePath, targetPath);
    } else {
      fs.copyFileSync(sourcePath, targetPath);
    }
  });
};

export const listDirs = (dir) =>
  fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
