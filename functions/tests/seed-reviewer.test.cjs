const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
test('client seed rejects absent and whitespace neighbor passwords before contacting Firebase', () => {
  for (const neighbor of ['', '  ']) {
    const run = spawnSync(process.execPath, [path.join(__dirname, '../scripts/seed-reviewer-account.mjs'), '--client', '--commit', '--generate-password'], {
      encoding: 'utf8', env: { ...process.env, REVIEWER_PASSWORD: '', NEIGHBOR_PASSWORD: neighbor },
    });
    assert.equal(run.status, 1);
    assert.equal(run.stdout, '');
    assert.equal(run.stderr.trim(), 'Client seed requires NEIGHBOR_PASSWORD.');
  }
});
