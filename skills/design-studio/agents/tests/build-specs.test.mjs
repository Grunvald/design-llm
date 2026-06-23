// CLI tests for agents/annotate/build-specs.mjs (two-spec generator).
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';

import { tmpdir, write, read, exists, runScript } from './helpers.mjs';

const SCRIPT = 'annotate/build-specs.mjs';

function pin(over) {
  return Object.assign(
    { id: 'a' + Math.random().toString(36).slice(2), selector: 'div', domPath: ['div'], snippet: '', kind: 'design', text: 'change it' },
    over,
  );
}

test('mixed kinds across pages → two specs, partitioned by kind', (t) => {
  const root = tmpdir(t);
  write(root, 'designs/proj/annotations.json', JSON.stringify([
    pin({ kind: 'design', selector: '.hero', text: 'bigger title' }),
    pin({ kind: 'code', selector: '.cart', text: 'wire up the real checkout call' }),
  ]));
  write(root, 'designs/other/annotations.json', JSON.stringify([
    pin({ kind: 'design', selector: '.card', text: 'hover lift' }),
  ]));
  const out = path.join(root, 'out');
  const r = runScript(SCRIPT, ['--root', path.join(root, 'designs'), '--out', out]);
  assert.equal(r.status, 0, r.stderr);

  const design = read(out, 'design-spec.md');
  const code = read(out, 'code-spec.md');
  // design spec has the two design pins, across both pages, not the code one
  assert.match(design, /bigger title/);
  assert.match(design, /hover lift/);
  assert.doesNotMatch(design, /real checkout/);
  assert.match(design, /## \/proj/);
  assert.match(design, /## \/other/);
  // code spec has only the code pin
  assert.match(code, /real checkout/);
  assert.doesNotMatch(code, /bigger title/);
  assert.match(r.stdout, /design-spec\.md \(2\)/);
  assert.match(r.stdout, /code-spec\.md \(1\)/);
});

test('empty stream produces no file', (t) => {
  const root = tmpdir(t);
  write(root, 'designs/proj/annotations.json', JSON.stringify([pin({ kind: 'design' })]));
  const out = path.join(root, 'out');
  runScript(SCRIPT, ['--root', path.join(root, 'designs'), '--out', out]);
  assert.ok(exists(out, 'design-spec.md'));
  assert.ok(!exists(out, 'code-spec.md'));
});

test('legacy pins (no kind/page) default to design and a derived page', (t) => {
  const root = tmpdir(t);
  write(root, 'designs/legacy/annotations.json', JSON.stringify([
    { id: 'x1', selector: '.x', domPath: ['.x'], snippet: '', text: 'legacy note' },
  ]));
  const out = path.join(root, 'out');
  runScript(SCRIPT, ['--root', path.join(root, 'designs'), '--out', out]);
  const design = read(out, 'design-spec.md');
  assert.match(design, /legacy note/);
  assert.match(design, /## \/legacy/);
});

test('app mode: --store file is read and grouped by each pin page', (t) => {
  const root = tmpdir(t);
  // app-mode store lives outside the designs root, keyed by route
  write(root, '.annotate/annotations.json', JSON.stringify([
    pin({ kind: 'code', page: '/dashboard', selector: '.kpi', text: 'pull live metrics' }),
    pin({ kind: 'design', page: '/settings', selector: '.row', text: 'tighten spacing' }),
  ]));
  const storeFile = path.join(root, '.annotate/annotations.json');
  const out = path.join(root, 'out');
  const r = runScript(SCRIPT, ['--root', path.join(root, 'designs'), '--store', storeFile, '--out', out]);
  assert.equal(r.status, 0, r.stderr);
  assert.match(read(out, 'code-spec.md'), /## \/dashboard/);
  assert.match(read(out, 'code-spec.md'), /pull live metrics/);
  assert.match(read(out, 'design-spec.md'), /## \/settings/);
});

test('no annotations → no files, exit 0', (t) => {
  const root = tmpdir(t);
  write(root, 'designs/empty/.keep', '');
  const out = path.join(root, 'out');
  const r = runScript(SCRIPT, ['--root', path.join(root, 'designs'), '--out', out]);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /no annotations found/);
  assert.ok(!exists(out, 'design-spec.md'));
});
