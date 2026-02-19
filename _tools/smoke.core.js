import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { pathToFileURL } from "node:url";
import { runCommand, projectRoot, ensureDir, resolveCommand } from "./utils.js";
import { createResultCollector, STATUS } from "./resultClassifier.js";

const REQUIRED_FILES = [
  "src/model/cardSchema.ts",
  "src/model/layoutSchema.ts",
  "src/state/store.ts",
  "src/ui/EditorCanvas.tsx",
  "src/io/importExport.ts",
  "src/io/normalizer.ts",
  "src/normalizer/canonicalTypes.ts",
  "src/normalizer/ensureTemplate.ts",
  "src/layout/defaultTemplate.ts",
  "src/pdf/exportPdf.ts",
  "src/ai/lmStudioClient.ts",
  "_tools/backup.js"
];

const runtimeContractSource = (importPath) => `import { normalizeImportedJson } from "${importPath("src/io/normalizer.ts")}";
import { DEFAULT_TEMPLATE_BOXES } from "${importPath("src/layout/defaultTemplate.ts")}";
import { getFieldText } from "${importPath("src/utils/cardFields.ts")}";
import { normalizeCard } from "${importPath("src/model/cardSchema.ts")}";

const assert = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message);
};

const fixtures = [
  { cards: [{ id: "a1", inf: "machen", translations: [{ value: "to do" }] }] },
  { verbs: [{ infinitive: "gehen", translations: [{ ru: "to go" }], forms: { p3: "geht" } }] },
  [{ id: "arr-1", inf: "sein", tr_1_ru: "to be" }],
  { cards: [{ id: "bad-1", inf: 123, forms: { aux: "invalid" }, boxes: [{ id: "b", fieldId: "inf", wMm: -20, hMm: 0 }] }] }
];

const referenceCardPayload = [{
  id: "ablehnen",
  frequency: 5,
  infinitive: "ablehnen",
  translations: ["to reject", "to refuse", "to decline"],
  forms: {
    praesens_3: "lehnt ab",
    praeteritum: "lehnte ab",
    partizip_2: "abgelehnt",
    auxiliary: "hat"
  },
  examples: {
    praesens: { de: "Ich lehne das Angebot ab.", ru: "I reject the offer." },
    modal: { de: "Man kann ablehnen.", ru: "One can reject it." },
    praeteritum: { de: "Er lehnte ab.", ru: "He refused." },
    perfekt: { de: "Sie hat abgelehnt.", ru: "She refused." }
  },
  synonyms: [
    { word: "zurueckweisen", translation: "to reject" },
    { word: "verweigern", translation: "to refuse" }
  ],
  prefixes: ["separable: ab-"]
}];

for (const [index, fixture] of fixtures.entries()) {
  const cards = normalizeImportedJson(fixture);
  assert(Array.isArray(cards) && cards.length > 0, \`fixture \${index} produced no cards\`);
  const card = cards[0];
  assert(typeof card.id === "string" && card.id.length > 0, \`fixture \${index} missing id\`);
  assert(typeof card.inf === "string", \`fixture \${index} missing inf\`);
  assert(typeof card.title === "string", \`fixture \${index} missing title\`);
  assert(Array.isArray(card.boxes) && card.boxes.length > 0, \`fixture \${index} missing boxes\`);
  assert(typeof card.freq === "number" && card.freq >= 0 && card.freq <= 5, \`fixture \${index} invalid freq\`);
}

const [referenceCard] = normalizeImportedJson(referenceCardPayload);
assert(referenceCard.inf === "ablehnen", "reference schema: inf mapping failed");
assert(referenceCard.freq === 5, "reference schema: frequency mapping failed");
assert(referenceCard.forms_p3 === "lehnt ab", "reference schema: forms.praesens_3 mapping failed");
assert(referenceCard.forms_prat === "lehnte ab", "reference schema: forms.praeteritum mapping failed");
assert(referenceCard.forms_p2 === "abgelehnt", "reference schema: forms.partizip_2 mapping failed");
assert(referenceCard.forms_aux === "haben", "reference schema: forms.auxiliary=hat normalization failed");
assert(referenceCard.ex_1_de.length > 0 && referenceCard.ex_1_ru.length > 0, "reference schema: examples object mapping failed");
assert(referenceCard.tags.some((tag) => tag.includes("ab-")), "reference schema: prefixes->tags mapping failed");

const sampleCard = normalizeCard({ inf: "testen", tr_1_ru: "test", forms_p3: "testet", ex_1_de: "Ich teste." });
for (const box of DEFAULT_TEMPLATE_BOXES) {
  const result = getFieldText(sampleCard, box.fieldId);
  assert(typeof result.text === "string", \`getFieldText invalid for \${box.fieldId}\`);
}
`;

const createReportWriter = () => {
  const reportDir = path.join(projectRoot, "_reports");
  ensureDir(reportDir);
  return {
    mdPath: path.join(reportDir, "smoke_report.md"),
    jsonPath: path.join(reportDir, "smoke_report.json")
  };
};

async function runRuntimeContracts(collector) {
  const tmpDir = path.join(projectRoot, "_tmp", "smoke-runtime");
  ensureDir(tmpDir);

  const entryPath = path.join(tmpDir, "runtime-contract-entry.ts");
  const bundlePath = path.join(tmpDir, "runtime-contract-entry.mjs");
  const importPath = (rel) => path.join(projectRoot, rel).replace(/\\/g, "/");

  fs.writeFileSync(entryPath, runtimeContractSource(importPath));

  try {
    const esbuild = await import("esbuild");
    await esbuild.build({
      entryPoints: [entryPath],
      outfile: bundlePath,
      bundle: true,
      platform: "node",
      format: "esm",
      logLevel: "silent"
    });

    await import(`${pathToFileURL(bundlePath).href}?t=${Date.now()}`);
    collector.addStep({ label: "Runtime contracts", status: STATUS.OK, blocking: true });
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

const checkFiles = (collector) => {
  for (const file of REQUIRED_FILES) {
    const exists = fs.existsSync(path.join(projectRoot, file));
    collector.addStep({
      label: `File ${file}`,
      status: exists ? STATUS.OK : STATUS.FAIL,
      blocking: true
    });
  }
};

const checkDevServer = ({ blockingDevServerFailure }) =>
  new Promise((resolve) => {
    const maxRetries = 10;
    let retries = 0;

    const attempt = () => {
      http
        .get("http://127.0.0.1:5173", (res) => {
          const ok = Boolean(res.statusCode && res.statusCode >= 200 && res.statusCode < 400);
          resolve({ ok, statusCode: res.statusCode, blocking: blockingDevServerFailure });
        })
        .on("error", () => {
          retries += 1;
          if (retries >= maxRetries) {
            resolve({ ok: false, statusCode: null, blocking: blockingDevServerFailure });
            return;
          }
          setTimeout(attempt, 500);
        });
    };

    attempt();
  });

const runStep = async (collector, label, fn) => {
  try {
    await fn();
    collector.addStep({ label, status: STATUS.OK, blocking: true });
  } catch (error) {
    collector.addStep({
      label,
      status: STATUS.FAIL,
      details: error instanceof Error ? error.message : String(error),
      blocking: true
    });
  }
};

async function runDevServerCheck(collector, options) {
  let childProcess;
  try {
    childProcess = await import("node:child_process");
  } catch {
    collector.addStep({
      label: "Dev server",
      status: STATUS.SKIP,
      details: "Cannot import child_process",
      blocking: false
    });
    return;
  }

  let serverProcess;
  try {
    const npmCommand = options.robustSpawn ? resolveCommand("npm") : "npm";
    serverProcess = childProcess.spawn(npmCommand, ["run", "dev", "--", "--host", "127.0.0.1", "--port", "5173"], {
      cwd: projectRoot,
      stdio: "ignore",
      shell: !options.robustSpawn
    });

    serverProcess.on("error", (error) => {
      collector.addStep({
        label: "Dev server",
        status: options.blockingDevServerFailure ? STATUS.FAIL : STATUS.SKIP,
        details: `spawn failed: ${error.code ?? error.message}`,
        blocking: options.blockingDevServerFailure
      });
    });

    const result = await checkDevServer(options);
    const status = result.ok ? STATUS.OK : options.blockingDevServerFailure ? STATUS.FAIL : STATUS.SKIP;
    const details = result.ok
      ? "health-check passed"
      : result.statusCode
        ? `health-check failed (${result.statusCode})`
        : "No response";
    collector.addStep({
      label: "Dev server",
      status,
      details,
      blocking: options.blockingDevServerFailure
    });
  } catch (error) {
    collector.addStep({
      label: "Dev server",
      status: options.blockingDevServerFailure ? STATUS.FAIL : STATUS.SKIP,
      details: `spawn failed: ${error.code ?? error.message}`,
      blocking: options.blockingDevServerFailure
    });
  } finally {
    if (serverProcess && !serverProcess.killed) {
      serverProcess.kill();
    }
  }
}

export async function runSmoke(options = {}) {
  process.exitCode = 0;

  const {
    robustSpawn = true,
    blockingDevServerFailure = false
  } = options;

  const collector = createResultCollector();
  const report = createReportWriter();

  await runStep(collector, "TypeScript", () => runCommand("npm", ["run", "tsc"]));
  await runStep(collector, "Preflight", () => runCommand("npm", ["run", "tools:preflight"]));
  await runStep(collector, "Build", () => runCommand("npm", ["run", "build"]));

  try {
    await runRuntimeContracts(collector);
  } catch (error) {
    collector.addStep({
      label: "Runtime contracts",
      status: STATUS.FAIL,
      details: error instanceof Error ? error.message : String(error),
      blocking: true
    });
  }

  checkFiles(collector);
  await runDevServerCheck(collector, { robustSpawn, blockingDevServerFailure });

  const summary = collector.getSummary();

  fs.writeFileSync(report.mdPath, collector.toMarkdown());
  fs.writeFileSync(report.jsonPath, JSON.stringify(collector.toJson(), null, 2));
  console.log(`Smoke report saved to ${report.mdPath}`);
  console.log(`Smoke report saved to ${report.jsonPath}`);

  process.exitCode = summary.code;
  return summary.code;
}
