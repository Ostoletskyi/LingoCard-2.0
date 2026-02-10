import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { spawnSync, spawn } from "node:child_process";
import { projectRoot, runCommand, resolveCommand } from "./utils.js";

const reportDir = path.join(projectRoot, "_tools", "reports");
fs.mkdirSync(reportDir, { recursive: true });
const reportPath = path.join(reportDir, "smoke_report.md");
const lines = [];

const record = (name, status, details = "") => {
  lines.push(`- **${name}**: ${status}${details ? ` - ${details}` : ""}`);
};

const hasBom = (filePath) => {
  const buf = fs.readFileSync(filePath);
  return buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf;
};

const checkPsFiles = () => {
  const psDir = path.join(projectRoot, "_tools", "ps");
  const files = fs.readdirSync(psDir).filter((f) => f.endsWith(".ps1"));
  files.forEach((file) => {
    const fullPath = path.join(psDir, file);
    if (!hasBom(fullPath)) {
      record(`BOM ${file}`, "WARN", "UTF-8 BOM is missing");
      process.exitCode = 1;
    } else {
      record(`BOM ${file}`, "OK");
    }

    if (process.platform === "win32") {
      const cmd = `$null = [ScriptBlock]::Create((Get-Content -Raw -Path '${fullPath.replace(/'/g, "''")}'));`;
      const res = spawnSync("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", cmd], {
        cwd: projectRoot,
        encoding: "utf-8"
      });
      if (res.status === 0) record(`Parse ${file}`, "OK");
      else {
        record(`Parse ${file}`, "FAIL", (res.stderr || res.stdout || "ParserError").trim());
        process.exitCode = 1;
      }
    } else {
      record(`Parse ${file}`, "SKIP", "Windows-only parser check");
    }
  });
};

const checkServer = () =>
  new Promise((resolve) => {
    let retries = 0;
    const attempt = () => {
      http
        .get("http://127.0.0.1:5173", (res) => resolve(res.statusCode >= 200 && res.statusCode < 400))
        .on("error", () => {
          retries += 1;
          if (retries > 10) resolve(false);
          else setTimeout(attempt, 500);
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

  checkPsFiles();

  const server = spawn(resolveCommand("npm"), ["run", "dev", "--", "--host", "127.0.0.1", "--port", "5173"], {
    cwd: projectRoot,
    stdio: "ignore"
  });
  const serverOk = await checkServer();
  server.kill();
  record("Dev server boot", serverOk ? "OK" : "FAIL");
  if (!serverOk) process.exitCode = 1;

  fs.writeFileSync(reportPath, `# Smoke Report\n\n${lines.join("\n")}\n`);
  console.log(`Smoke report saved to ${reportPath}`);
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
