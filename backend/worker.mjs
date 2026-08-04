import { env as workerEnv } from 'cloudflare:workers';
import { handleAsNodeRequest } from 'cloudflare:node';

let appInitialization;

async function initializeApp() {
  if (!appInitialization) {
    appInitialization = (async () => {
      if (!process.env) process.env = {};
      globalThis.__CF_WORKER_RUNTIME__ = true;
      for (const [key, value] of Object.entries(workerEnv)) {
        if (typeof value === 'string') process.env[key] = value;
      }
      process.env.CF_WORKER_RUNTIME = 'true';
      process.env.DATABASE_URL ||= 'hyperdrive://binding';

      const { default: app } = await import('./src/app.js');
      app.listen(3000);
    })();
  }
  await appInitialization;
}

export default {
  async fetch(request) {
    await initializeApp();
    return handleAsNodeRequest(3000, request);
  }
};
