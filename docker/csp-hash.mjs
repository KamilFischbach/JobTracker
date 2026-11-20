// Prints the CSP source ('sha256-...') of every inline <script> in an HTML
// file, so the Content-Security-Policy always matches the built index.html.
// Usage: node csp-hash.mjs dist/index.html
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const html = readFileSync(process.argv[2], 'utf8');
const inline = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)];
const sources = inline.map(
  ([, body]) => `'sha256-${createHash('sha256').update(body, 'utf8').digest('base64')}'`,
);
process.stdout.write(sources.join(' '));
