import { preview } from 'vite';
import { createViteConfig } from './viteConfig.mjs';

const server = await preview(createViteConfig());
server.printUrls();
