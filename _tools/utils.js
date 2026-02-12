import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const currentFilePath = fileURLToPath(import.meta.url);
export const projectRoot = path.resolve(path.dirname(currentFilePath), "..");

export const resolveCommand = (cmd) => (process.platform === "win32" ? `${cmd}.cmd` : cmd);

const quote = (value) => {
  if (/^[A-Za-z0-9_./:-]+$/.test(value)) return value;
  return `"${value.replace(/"/g, '\\"')}"`;
};

export const spawnCommand = (command, args, options = {}) => {
  const opts = { cwd: projectRoot, stdio: "inherit", ...options };
  if (process.platform === "win32") {
    const cmdFile = resolveCommand(command);
    const commandLine = [cmdFile, ...args].map(quote).join(" ");
    return spawn("cmd.exe", ["/d", "/s", "/c", commandLine], opts);
  }
  return spawn(command, args, opts);
};

export const runCommand = (command, args, options = {}) =>
  new Promise((resolve, reject) => {
    const child = spawnCommand(command, args, options);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with code ${code}`));
    });
    child.on("error", (error) => reject(error));
  });
