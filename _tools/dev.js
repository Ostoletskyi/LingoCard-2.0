import { runCommand } from "./utils.js";

const openUrl = async (url) => {
  const platform = process.platform;
  if (platform === "win32") {
    await runCommand("cmd", ["/c", "start", url]);
  } else if (platform === "darwin") {
    await runCommand("open", [url]);
  } else {
    await runCommand("xdg-open", [url]);
  }
};

const main = async () => {
  const url = "http://127.0.0.1:5173";
  openUrl(url).catch(() => {
    console.warn("Could not auto-open browser.");
  });
  await runCommand("npm", ["run", "dev", "--", "--host", "127.0.0.1", "--port", "5173"]);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
