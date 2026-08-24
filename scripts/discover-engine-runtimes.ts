import { discoverEngineEnvironments } from "../integrations/engines/discover";

const environments = await discoverEngineEnvironments();
process.stdout.write(`${JSON.stringify({ schema: "clunk.engine-environments.v1", environments }, null, 2)}\n`);
