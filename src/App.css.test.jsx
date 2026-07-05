// @cleaned-by-ai

import { readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, '..');

describe('App.css', () => {
  it('should exist as a stylesheet', () => {
    const css = readFileSync(join(__dirname, 'App.css'), 'utf-8');
    expect(css).toBeTruthy();
    expect(css.length).toBeGreaterThan(0);
  });
});
