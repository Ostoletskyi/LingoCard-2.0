// _tools/smoke.js
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { pathToFileURL } from "node:url";
import { runCommand, projectRoot, ensureDir } from "./utils.js";

const reportDir = path.join(projectRoot, "_reports");
ensureDir(reportDir);
const reportPath = path.join(reportDir, "smoke_report.md");
const reportLines = [];

const record = (label, status, details = "") => {
  reportLines.push(`- **${label}**: ${status}${details ? ` — ${details}` : ""}`);
};

const checkFiles = (files) => {
  for (const file of files) {
    const abs = path.join(projectRoot, file);
    const exists = fs.existsSync(abs);
    record(`File ${file}`, exists ? "OK" : "MISSING");
    if (!exists) process.exitCode = 1;
  }
};


const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

async function runRuntimeContracts() {
  const tmpDir = path.join(projectRoot, "_tmp", "smoke-runtime");
  ensureDir(tmpDir);

  const entryPath = path.join(tmpDir, "runtime-contract-entry.ts");
  const bundlePath = path.join(tmpDir, "runtime-contract-entry.mjs");

  fs.writeFileSync(
    entryPath,
    `import { normalizeImportedJson } from "${projectRoot}/src/io/normalizer.ts";
import { DEFAULT_TEMPLATE_BOXES } from "${projectRoot}/src/layout/defaultTemplate.ts";
import { getFieldText } from "${projectRoot}/src/utils/cardFields.ts";
import { normalizeCard } from "${projectRoot}/src/model/cardSchema.ts";

const assert = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message);
};

const fixtures = [
  { cards: [{ id: "a1", inf: "machen", translations: [{ value: "делать" }] }] },
  { verbs: [{ infinitive: "gehen", translations: [{ ru: "идти" }], forms: { p3: "geht" } }] },
  [{ id: "arr-1", inf: "sein", tr_1_ru: "быть" }],
  { cards: [{ id: "bad-1", inf: 123, forms: { aux: "invalid" }, boxes: [{ id: "b", fieldId: "inf", wMm: -20, hMm: 0 }] }] }
];

const referenceCardPayload = [{
  id: "ablehnen",
  frequency: 5,
  infinitive: "ablehnen",
  translations: ["отклонять", "отказываться", "не принимать"],
  forms: {
    praesens_3: "lehnt ab",
    praeteritum: "lehnte ab",
    partizip_2: "abgelehnt",
    auxiliary: "hat"
  },
  examples: {
    praesens: { de: "Ich lehne das Angebot ab.", ru: "Я отклоняю предложение." },
    modal: { de: "Man kann ablehnen.", ru: "Можно отклонить." },
    praeteritum: { de: "Er lehnte ab.", ru: "Он отказал." },
    perfekt: { de: "Sie hat abgelehnt.", ru: "Она отказала." }
  },
  synonyms: [
    { word: "zurückweisen", translation: "отклонять" },
    { word: "verweigern", translation: "отказывать" }
  ],
  prefixes: ["отделяемые: ab-"]
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

const sampleCard = normalizeCard({ inf: "testen", tr_1_ru: "тест", forms_p3: "testet", ex_1_de: "Ich teste." });
for (const box of DEFAULT_TEMPLATE_BOXES) {
  const result = getFieldText(sampleCard, box.fieldId);
  assert(typeof result.text === "string", \`getFieldText invalid for \${box.fieldId}\`);
}
`
  );

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
    record("Runtime contracts", "OK");
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

const checkDevServer = () =>
  new Promise((resolve) => {
    const maxRetries = 10;
    let retries = 0;

    const attempt = () => {
      http
        .get("http://127.0.0.1:5173", (res) => {
          const ok = res.statusCode && res.statusCode >= 200 && res.statusCode < 400;
          record("Dev server", ok ? "OK" : `FAIL (${res.statusCode})`);
          resolve(Boolean(ok));
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

const spawnDevServer = () => {
  const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
  return spawn(npmCmd, ["run", "dev", "--", "--host", "127.0.0.1", "--port", "5173"], {
    cwd: projectRoot,
    stdio: "ignore",
    shell: false,
  });
};

const main = async () => {
  try {
    await runCommand("npm", ["run", "tsc"]);
    record("TypeScript", "OK");
  } catch (error) {
    record("TypeScript", "FAIL", error?.message ?? String(error));
    process.exitCode = 1;
  }

  try {
    await runCommand("npm", ["run", "tools:preflight"]);
    record("Preflight", "OK");
  } catch (error) {
    record("Preflight", "FAIL", error?.message ?? String(error));
    process.exitCode = 1;
  }


  try {
    await runCommand("npm", ["run", "tools:preflight"]);
    record("Preflight", "OK");
  } catch (error) {
    record("Preflight", "FAIL", error.message);
    process.exitCode = 1;
  }


  try {
    await runCommand("npm", ["run", "tools:preflight"]);
    record("Preflight", "OK");
  } catch (error) {
    record("Preflight", "FAIL", error.message);
    process.exitCode = 1;
  }


  try {
    await runCommand("npm", ["run", "tools:preflight"]);
    record("Preflight", "OK");
  } catch (error) {
    record("Preflight", "FAIL", error.message);
    process.exitCode = 1;
  }


  try {
    await runCommand("npm", ["run", "tools:preflight"]);
    record("Preflight", "OK");
  } catch (error) {
    record("Preflight", "FAIL", error.message);
    process.exitCode = 1;
  }


  try {
    await runCommand("npm", ["run", "tools:preflight"]);
    record("Preflight", "OK");
  } catch (error) {
    record("Preflight", "FAIL", error.message);
    process.exitCode = 1;
  }


  try {
    await runCommand("npm", ["run", "tools:preflight"]);
    record("Preflight", "OK");
  } catch (error) {
    record("Preflight", "FAIL", error.message);
    process.exitCode = 1;
  }


  try {
    await runCommand("npm", ["run", "tools:preflight"]);
    record("Preflight", "OK");
  } catch (error) {
    record("Preflight", "FAIL", error.message);
    process.exitCode = 1;
  }


  try {
    await runCommand("npm", ["run", "tools:preflight"]);
    record("Preflight", "OK");
  } catch (error) {
    record("Preflight", "FAIL", error.message);
    process.exitCode = 1;
  }


  try {
    await runCommand("npm", ["run", "tools:preflight"]);
    record("Preflight", "OK");
  } catch (error) {
    record("Preflight", "FAIL", error.message);
    process.exitCode = 1;
  }

  try {
    await runCommand("npm", ["run", "build"]);
    record("Build", "OK");
  } catch (error) {
    record("Build", "FAIL", error?.message ?? String(error));
    process.exitCode = 1;
  }

  try {
    await runRuntimeContracts();
  } catch (error) {
    record("Runtime contracts", "FAIL", error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }

  try {
    await runRuntimeContracts();
  } catch (error) {
    record("Runtime contracts", "FAIL", error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }

  try {
    await runRuntimeContracts();
  } catch (error) {
    record("Runtime contracts", "FAIL", error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }

  try {
    await runRuntimeContracts();
  } catch (error) {
    record("Runtime contracts", "FAIL", error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }

  try {
    await runRuntimeContracts();
  } catch (error) {
    record("Runtime contracts", "FAIL", error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }

  try {
    await runRuntimeContracts();
  } catch (error) {
    record("Runtime contracts", "FAIL", error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }

  try {
    await runRuntimeContracts();
  } catch (error) {
    record("Runtime contracts", "FAIL", error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }

  try {
    await runRuntimeContracts();
  } catch (error) {
    record("Runtime contracts", "FAIL", error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }

  try {
    await runRuntimeContracts();
  } catch (error) {
    record("Runtime contracts", "FAIL", error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }

  try {
    await runRuntimeContracts();
  } catch (error) {
    record("Runtime contracts", "FAIL", error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }

  checkFiles([
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
    "_tools/backup.js",
  ]);

  // Dev server probe (optional, but useful).
  const serverProcess = spawnDevServer();
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
