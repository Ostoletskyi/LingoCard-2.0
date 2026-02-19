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

export const resolveCommand = (command) => {
  if (process.platform !== "win32") return command;
  if (command === "npm") return "npm.cmd";
  if (command === "npx") return "npx.cmd";
  return command;
};

export const runCommand = (command, args, options = {}) =>
  new Promise((resolve, reject) => {
    const executable = resolveCommand(command);
    const spawnOptions = { stdio: "inherit", shell: false, ...options };

    const attach = (child) => {
      child.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`${command} exited with code ${code}`));
      });
      child.on("error", (error) => {
        if (process.platform === "win32" && error?.code === "EINVAL") {
          const fallback = spawn(`${executable} ${args.join(" ")}`, [], {
            stdio: "inherit",
            shell: true,
            ...options
          });
          fallback.on("close", (code) => {
            if (code === 0) resolve();
            else reject(new Error(`${command} exited with code ${code}`));
          });
          fallback.on("error", reject);
          return;
        }
        reject(error);
      });
    };

    attach(spawn(executable, args, spawnOptions));
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
