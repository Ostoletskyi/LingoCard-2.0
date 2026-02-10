import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const currentFilePath = fileURLToPath(import.meta.url);
export const projectRoot = path.resolve(path.dirname(currentFilePath), "..");

export const resolveCommand = (cmd) => (process.platform === "win32" ? `${cmd}.cmd` : cmd);

export const runCommand = (command, args, options = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn(resolveCommand(command), args, { cwd: projectRoot, stdio: "inherit", ...options });
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with code ${code}`));
    });
  });
