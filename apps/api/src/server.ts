import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";
import { createDbHandle } from "./db/client.js";
import { createKycClient } from "./kyc/persona.js";

const config = await loadConfig();
const db = createDbHandle(config.databaseUrl);
const kyc = createKycClient(config.persona);

const app = await buildApp({ config, db, kyc });

const shutdown = async () => {
  await app.close();
  await db.end();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

await app.listen({ port: config.port, host: "0.0.0.0" });
