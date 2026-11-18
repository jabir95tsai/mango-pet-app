const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

// Pull the pure route mapper out (the module imports native code).
const file = path.join(__dirname, '../src/lib/push-open.ts');
const src = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
const code = src.statements
  .filter((s) => ts.isFunctionDeclaration(s) && s.name?.text === 'pushOpenRoute')
  .map((s) => s.getText(src).replace(/^export /, ''))
  .join('\n');
const js = ts.transpileModule(`${code}\nmodule.exports = { pushOpenRoute };`, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const m = { exports: {} };
new Function('module', js)(m);
const { pushOpenRoute } = m.exports;

test('maps every server push link to an iOS route', () => {
  assert.equal(pushOpenRoute({ url: '/app' }), '/(tabs)');
  assert.equal(pushOpenRoute({ url: '/app/walks' }), '/(tabs)/walks');
  assert.equal(pushOpenRoute({ url: '/app/leaderboard/' }), '/(tabs)/leaderboard');
  assert.equal(pushOpenRoute({ url: '/app/achievements?unlocked=x' }), '/achievements');
  assert.equal(pushOpenRoute({ url: '/app/feed' }), '/feed');
  assert.deepEqual(pushOpenRoute({ url: '/app/feed', postId: 'p1' }), { pathname: '/feed', params: { postId: 'p1' } });
  assert.deepEqual(pushOpenRoute({ url: '/app/pets/abc' }), { pathname: '/(tabs)/pets', params: { tab: 'reminders' } });
});

test('ignores pushes without a known link', () => {
  assert.equal(pushOpenRoute(undefined), null);
  assert.equal(pushOpenRoute({ kind: 'walk-return' }), null);
  assert.equal(pushOpenRoute({ url: 'https://evil.example/app' }), null);
  assert.equal(pushOpenRoute({ url: '/app/unknown' }), null);
});
