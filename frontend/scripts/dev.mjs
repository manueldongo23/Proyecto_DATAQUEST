import { createServer } from 'vite';
import { createViteConfig } from './viteConfig.mjs';

const server = await createServer(createViteConfig());
await server.listen();
server.printUrls();

process.on('SIGINT', async () => {
  await server.close();
  process.exit(0);
});
