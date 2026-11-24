// tests/pages_deploy_retry_gate.mjs: DOOR's Pages deploy tries twice (2026-11-24).
//
// Jason, 2026-11-24: Rex's Week 1 sheet changed Wk1 FRI lunch from Potato Salad to Potato Hash, and EXPO never showed
// the change. DOOR published to main at 13:45, but both Pages runs went red: upload-pages-artifact succeeded and
// deploy-pages, a second later, found no "github-pages" artifact (GitHub had not made it visible yet). Pages kept
// serving the Nov 23 menu, and EXPO reads DOOR's menu through Pages. The same failure hit two runs on Nov 22.
// The deploy now retries once after a wait; a second failure still turns the run red.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const yml = fs.readFileSync(new URL('../.github/workflows/pages.yml', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const steps = yml.split(/^      - (?=name: |uses: )/m).slice(1);
const step = (name) => steps.find(s => s.startsWith('name: ' + name + '\n'));

test('R1 the first deploy may fail without ending the run', () => {
  const s = step('Deploy to GitHub Pages');
  assert.ok(s, 'first deploy step');
  assert.match(s, /id: deployment\n/);
  assert.match(s, /continue-on-error: true/);
  assert.match(s, /uses: actions\/deploy-pages@v4/);
});

test('R2 a failed first deploy waits, then deploys again, and that second try is not excused', () => {
  const wait = step('Wait before trying the deploy again');
  assert.ok(wait, 'wait step');
  assert.match(wait, /if: \$\{\{ steps\.deployment\.outcome == 'failure' \}\}/);
  assert.match(wait, /run: sleep \d+/);
  const again = step('Deploy to GitHub Pages (second try)');
  assert.ok(again, 'second deploy step');
  assert.match(again, /if: \$\{\{ steps\.deployment\.outcome == 'failure' \}\}/);
  assert.match(again, /uses: actions\/deploy-pages@v4/);
  assert.ok(!again.includes('continue-on-error'), 'a second failure keeps the run red');
  assert.ok(steps.indexOf(wait) > steps.indexOf(step('Deploy to GitHub Pages')) && steps.indexOf(again) > steps.indexOf(wait), 'order: deploy, wait, deploy');
});

test('R3 the environment URL comes from whichever try deployed; delivery still depends on no test', () => {
  assert.match(yml, /url: \$\{\{ steps\.deployment\.outputs\.page_url \|\| steps\.deployment_retry\.outputs\.page_url \}\}/);
  assert.deepEqual((yml.match(/^\s+needs:.*$/gm) || []).map(x => x.trim()), ['needs: build'], 'Pages depends on its own build job only, never the test workflow');
  assert.equal((yml.match(/uses: actions\/upload-pages-artifact@/g) || []).length, 1, 'one upload, deployed by either try');
});

test('R4 build and deploy are separate jobs, as HUB deploy.yml (the upload is listed before deploy-pages looks)', () => {
  const jobs = yml.slice(yml.indexOf('\njobs:\n'));
  assert.match(jobs, /\n  build:\n    runs-on: ubuntu-latest\n/);
  assert.match(jobs, /\n  deploy:\n    needs: build\n/);
  const build = jobs.slice(jobs.indexOf('\n  build:\n'), jobs.indexOf('\n  deploy:\n'));
  const deploy = jobs.slice(jobs.indexOf('\n  deploy:\n'));
  assert.match(build, /uses: actions\/upload-pages-artifact@/);
  assert.ok(!/deploy-pages/.test(build), 'no deploy in the build job');
  assert.ok(!/upload-pages-artifact/.test(deploy), 'no upload in the deploy job');
  assert.match(deploy, /environment:\n      name: github-pages/);
});
