import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { runCommand, projectRoot, ensureDir } from "./utils.js";

const reportDir = path.join(projectRoot, "_reports");
ensureDir(reportDir);
const reportPath = path.join(reportDir, "smoke_report.md");
const reportLines = [];

const record = (label, status, details = "") => {
  reportLines.push(`- **${label}**: ${status}${details ? ` — ${details}` : ""}`);
};

const checkFiles = (files) => {
  files.forEach((file) => {
    const exists = fs.existsSync(path.join(projectRoot, file));
    record(`File ${file}`, exists ? "OK" : "MISSING");
    if (!exists) {
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

  try {
    await runCommand("npm", ["run", "build"]);
    record("Build", "OK");
  } catch (error) {
    record("Build", "FAIL", error.message);
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
    "_tools/backup.js"
  ]);

  let devServer;
  try {
    devServer = await import("node:child_process");
  } catch {
    record("Dev server", "SKIP", "Cannot import child_process");
  }

  if (devServer) {
    const serverProcess = devServer.spawn("npm", ["run", "dev", "--", "--host", "127.0.0.1", "--port", "5173"], {
      cwd: projectRoot,
      stdio: "ignore",
      shell: true
    });
    const ok = await checkDevServer();
    serverProcess.kill();
    if (!ok) {
      process.exitCode = 1;
    }
  }

  fs.writeFileSync(reportPath, `# Smoke Report\n\n${reportLines.join("\n")}\n`);
  console.log(`Smoke report saved to ${reportPath}`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
