import { runSmoke } from "./smoke.core.js";

runSmoke({ robustSpawn: true, blockingDevServerFailure: false }).catch((error) => {
  console.error(error);
  process.exit(1);
});
