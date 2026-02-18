import { runSmoke } from "./smoke.core.js";

runSmoke({ robustSpawn: false, blockingDevServerFailure: true }).catch((error) => {
  console.error(error);
  process.exit(1);
});
