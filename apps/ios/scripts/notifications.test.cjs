const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

// Pull the pure helpers out of the route file (it imports native modules).
const file = path.join(__dirname, '../app/notifications.tsx');
const src = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const code = src.statements
  .filter((s) => ts.isFunctionDeclaration(s) && ['dueReminders', 'visibleActivity'].includes(s.name?.text))
  .map((s) => s.getText(src).replace(/^export /, ''))
  .join('\n');
const js = ts.transpileModule(`${code}\nmodule.exports = { dueReminders, visibleActivity };`, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const m = { exports: {} };
new Function('module', js)(m);
const { dueReminders, visibleActivity } = m.exports;

const ts_ = (ms) => ({ toMillis: () => ms });

test('dueReminders keeps overdue + due-today, drops done and future', () => {
  const end = 1000;
  const rows = [
    { reminderId: 'overdue', done: false, triggerAt: ts_(10) },
    { reminderId: 'today', done: false, triggerAt: ts_(1000) },
    { reminderId: 'done', done: true, triggerAt: ts_(10) },
    { reminderId: 'future', done: false, triggerAt: ts_(1001) },
    { reminderId: 'noTs', done: false },
  ];
  assert.deepEqual(dueReminders(rows, end).map((r) => r.reminderId), ['overdue', 'today']);
});

test('visibleActivity drops blocked actors and empty rows', () => {
  const rows = [
    { notificationId: 'c', type: 'comment', actorUids: ['bad'], actorCount: 1 },
    { notificationId: 'r', type: 'reaction', actorUids: ['bad', 'ok'], actorCount: 5 },
    { notificationId: 'f', type: 'friendRequest', actorUids: ['ok'], actorCount: 1 },
  ];
  const out = visibleActivity(rows, ['bad']);
  assert.deepEqual(out.map((n) => n.notificationId), ['r', 'f']);
  assert.deepEqual(out[0].actorUids, ['ok']);
  assert.equal(out[0].actorCount, 4);
  assert.equal(visibleActivity(rows, []), rows);
});
