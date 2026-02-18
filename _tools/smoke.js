import { runSmoke } from "./smoke.core.js";

runSmoke({ robustSpawn: false, blockingDevServerFailure: true })
  .then((code) => {
    process.exit(code);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
