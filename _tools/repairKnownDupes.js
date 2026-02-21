import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const repair = (targetRel, templateRel, shouldRepair) => {
  const target = path.join(root, targetRel);
  const template = path.join(root, templateRel);
  if (!fs.existsSync(target) || !fs.existsSync(template)) return false;

  const content = fs.readFileSync(target, "utf8");
  if (!shouldRepair(content)) return false;

  fs.copyFileSync(template, target);
  console.log(`[repair] restored ${targetRel} from ${templateRel}`);
  return true;
};

const repairedPrompt = repair(
  "src/ai/promptBuilder.ts",
  "_tools/templates/promptBuilder.ts",
  (content) => {
    const genCount = (content.match(/export const buildGenerateMessages\b/g) ?? []).length;
    const repCount = (content.match(/export const buildRepairMessages\b/g) ?? []).length;
    return genCount > 1 || repCount > 1;
  }
);

const repairedCardFields = repair(
  "src/utils/cardFields.ts",
  "_tools/templates/cardFields.ts",
  (content) => {
    const aggCount = (content.match(/const aggregatedEditableFields = new Set\(/g) ?? []).length;
    const exampleTextCount = (content.match(/const text = \[1, 2, 3, 4, 5\]/g) ?? []).length;
    return aggCount > 1 || exampleTextCount > 2;
  }
);

if (!repairedPrompt && !repairedCardFields) {
  console.log("[repair] no duplicate-declaration corruption detected");
}
