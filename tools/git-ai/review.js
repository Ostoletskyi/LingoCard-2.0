
import { execSync } from "node:child_process";
import fs from "node:fs";

const config = JSON.parse(
  fs.readFileSync(new URL("./config.json", import.meta.url))
);

function getGitDiff() {
  try {
    return execSync("git diff", { encoding: "utf-8" });
  } catch (e) {
    console.error("Git diff error:", e.message);
    process.exit(1);
  }
}

async function callModel(diff) {
  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: config.model,
      temperature: config.temperature,
      max_tokens: config.max_tokens,
      messages: [
        {
          role: "system",
          content:
            "You are a senior software architect and strict code reviewer. Be concise and precise."
        },
        {
          role: "user",
          content:
            `Review the following git diff. 
Focus on:
- logic errors
- architectural problems
- possible regressions
- performance issues
- missing edge cases
- security risks

Then propose:
1) Short technical review
2) Concrete improvement suggestions
3) A conventional commit message

DIFF:
${diff}`
        }
      ]
    })
  });

  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? "No response";
}

async function main() {
  const diff = getGitDiff();

  if (!diff.trim()) {
    console.log("No changes detected.");
    return;
  }

  console.log("Sending diff to model...\n");

  const result = await callModel(diff);

  console.log("===== AI REVIEW =====\n");
  console.log(result);
}

main();
