
import { execSync } from "node:child_process";
import fs from "node:fs";

const config = JSON.parse(
  fs.readFileSync(new URL("./config.json", import.meta.url))
);

function getGitDiff() {
  try {
    return execSync("git diff --staged", { encoding: "utf-8" });
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
      temperature: 0.1,
      max_tokens: 400,
      messages: [
        {
          role: "system",
          content:
            "You are a precise software engineer. Generate a conventional commit message."
        },
        {
          role: "user",
          content:
            `Generate a concise conventional commit message for the following git diff:

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
    console.log("No staged changes detected.");
    return;
  }

  const message = await callModel(diff);

  console.log("===== SUGGESTED COMMIT MESSAGE =====\n");
  console.log(message);
}

main();
