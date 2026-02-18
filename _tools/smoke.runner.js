import { runSmoke } from "./smoke.core.js";

runSmoke({ robustSpawn: true, blockingDevServerFailure: false })
  .then((code) => {
    process.exit(code);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
