import fs from "node:fs";
import https from "node:https";
import { app } from "./app.js";
import { config } from "./config.js";

fs.mkdirSync(config.dataDir, { recursive: true });
app.listen(config.port, config.host, () =>
  console.log(`ItalianLearent: http://${config.host}:${config.port}`),
);
if (config.httpsPort && config.tlsKeyPath && config.tlsCertPath) {
  https
    .createServer(
      {
        key: fs.readFileSync(config.tlsKeyPath),
        cert: fs.readFileSync(config.tlsCertPath),
      },
      app,
    )
    .listen(config.httpsPort, config.host, () =>
      console.log(`ItalianLearent HTTPS enabled on port ${config.httpsPort}`),
    );
}
