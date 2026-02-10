import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const currentFilePath = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(currentFilePath), "..");

const reportDir = path.join(projectRoot, "_tools", "reports");
fs.mkdirSync(reportDir, { recursive: true });
const reportPath = path.join(reportDir, "smoke_report.md");
const reportLines = [];

const record = (label, status, details = "") => {
  reportLines.push(`- **${label}**: ${status}${details ? ` — ${details}` : ""}`);
};

const runCommand = (command, args, options = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", shell: true, cwd: projectRoot, ...options });
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with code ${code}`));
    });
  });

const checkFiles = (files) => {
  files.forEach((file) => {
    const exists = fs.existsSync(path.join(projectRoot, file));
    record(`File ${file}`, exists ? "OK" : "MISSING");
    if (!exists) process.exitCode = 1;
  });
};

const checkPowerShellParsers = () => {
  const psExe = process.platform === "win32" ? "powershell" : null;
  if (!psExe) {
    record("PowerShell parser", "SKIP", "Not running on Windows host");
    return;
  }

  const scripts = fs.readdirSync(path.join(projectRoot, "_tools", "ps")).filter((f) => f.endsWith(".ps1"));
  scripts.forEach((file) => {
    const fullPath = path.join(projectRoot, "_tools", "ps", file);
    const escaped = fullPath.replace(/'/g, "''");
    const cmd = `$tokens=$null; $errors=$null; [System.Management.Automation.Language.Parser]::ParseFile('${escaped}', [ref]$tokens, [ref]$errors) | Out-Null; if ($errors.Count -gt 0) { $errors | ForEach-Object { $_.Message }; exit 1 }`;
    const result = spawnSync(psExe, ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", cmd], {
      cwd: projectRoot,
      encoding: "utf-8"
    });

    if (result.error) {
      record(`PS parse ${file}`, "SKIP", result.error.message);
      return;
    }

    if (result.status === 0) {
      record(`PS parse ${file}`, "OK");
    } else {
      record(`PS parse ${file}`, "FAIL", (result.stdout || result.stderr || "ParserError").trim());
      process.exitCode = 1;
    }
  });
};

const checkDevServer = () =>
  new Promise((resolve) => {
    const maxRetries = 10;
    let retries = 0;
    const attempt = () => {
      http
        .get("http://127.0.0.1:5173", (res) => {
          const ok = res.statusCode && res.statusCode >= 200 && res.statusCode < 400;
          record("Dev server", ok ? "OK" : `FAIL (${res.statusCode})`);
          resolve(ok);
        })
        .on("error", () => {
          retries += 1;
          if (retries >= maxRetries) {
            record("Dev server", "FAIL", "No response");
            resolve(false);
            return;
          }
          setTimeout(attempt, 500);
        });
    };
    attempt();
  });

const main = async () => {
  try {
    await runCommand("npm", ["run", "tsc"]);
    record("TypeScript", "OK");
  } catch (error) {
    record("TypeScript", "FAIL", error.message);
    process.exitCode = 1;
  }

  checkFiles([
    "src/model/cardSchema.ts",
    "src/model/layoutSchema.ts",
    "src/state/store.ts",
    "src/ui/EditorCanvas.tsx",
    "src/io/importExport.ts",
    "src/pdf/exportPdf.ts",
    "src/ai/lmStudioClient.ts",
    "_tools/ps/backup_create.ps1"
  ]);

  checkPowerShellParsers();

  const serverProcess = spawn("npm", ["run", "dev", "--", "--host", "127.0.0.1", "--port", "5173"], {
    cwd: projectRoot,
    stdio: "ignore",
    shell: true
  });
  const ok = await checkDevServer();
  serverProcess.kill();
  if (!ok) process.exitCode = 1;

  fs.writeFileSync(reportPath, `# Smoke Report\n\n${reportLines.join("\n")}\n`);
  console.log(`Smoke report saved to ${reportPath}`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
