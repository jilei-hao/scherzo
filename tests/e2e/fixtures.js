import { test as base, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PIPELINES_DIR = fileURLToPath(
  new URL('../../node_modules/@itk-wasm/image-io/dist/pipelines/', import.meta.url));
const PIPELINE_PATH = /\/@itk-wasm\/image-io@[^/]+\/dist\/pipelines\/([^/]+)$/;
const CONTENT_TYPES = { '.js': 'text/javascript', '.wasm': 'application/wasm' };

export const test = base.extend({
  // @itk-wasm/image-io downloads its pipelines from jsDelivr at runtime. Serve
  // them from node_modules instead so the tests need no network; any other
  // external request is aborted.
  context: async ({ context }, use) => {
    await context.route(/^https?:\/\/(?!localhost[:/])/, async (route) => {
      const match = new URL(route.request().url()).pathname.match(PIPELINE_PATH);
      if (!match)
        return route.abort();

      const file = path.join(PIPELINES_DIR, match[1]);
      await route.fulfill({
        body: await readFile(file),
        contentType: CONTENT_TYPES[path.extname(file)] ?? 'application/octet-stream',
      });
    });
    await use(context);
  },

  // uncaught exceptions in the page, checked by tests that must not crash
  pageErrors: async ({ page }, use) => {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await use(errors);
  },
});

export { expect };
