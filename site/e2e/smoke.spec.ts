// Smoke tests over the production build (SITE-SPEC test plan: AC-2, AC-3, AC-4, AC-5, AC-7, AC-8, AC-15).
import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

const index = JSON.parse(readFileSync(new URL('../public/index.json', import.meta.url), 'utf8'));
const MP = index.marketplace.name as string;

test('search "onion" returns the nested skill with its parent plugin (AC-2)', async ({ page }) => {
  await page.goto('./#/');
  await page.getByRole('searchbox').fill('onion');
  await expect(page).toHaveURL(/#\/search\?q=onion/);
  const card = page.getByTestId('artifact-card-engineering-paved-path:onion-architecture');
  await expect(card).toBeVisible();
  await expect(card).toContainText('engineering-paved-path');
  await expect(card.locator('mark').first()).toHaveText(/onion/i);
});

test('a nonsense query shows the empty state (AC-3)', async ({ page }) => {
  await page.goto('./#/search?q=zzqxvplk');
  await expect(page.getByTestId('search-empty')).toBeVisible();
  await expect(page.getByTestId('search-empty').getByRole('link', { name: 'browse all plugins' })).toBeVisible();
});

test('plugin pages show manifest version and dependencies (AC-4)', async ({ page }) => {
  for (const p of index.plugins) {
    const manifest = JSON.parse(readFileSync(new URL(`../../${p.path}/.claude-plugin/plugin.json`, import.meta.url), 'utf8'));
    await page.goto(`./#/plugin/${p.name}`);
    await expect(page.getByTestId('plugin-version')).toHaveText(`v${manifest.version}`);
    for (const d of manifest.dependencies ?? []) {
      await expect(page.getByTestId('dependencies')).toContainText(`${d.name} ${d.version}`);
    }
  }
});

test('Copy install copies the right command on both channels (AC-5)', async ({ page }) => {
  await page.goto('./#/plugin/sdd-engineering');
  await page.getByTestId('copy-install').click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(`/plugin install sdd-engineering@${MP}`);
  await page.getByTestId('channel-stable').click();
  await page.getByTestId('copy-install').click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(`/plugin install sdd-engineering@${MP}-stable`);
});

test('team setup includes transitive dependencies (AC-7)', async ({ page }) => {
  await page.goto('./#/team-setup');
  const json = JSON.parse((await page.getByTestId('settings-json').textContent())!);
  expect(json.extraKnownMarketplaces[MP].source).toEqual({ source: 'github', repo: index.marketplace.repo });
  expect(Object.keys(json.enabledPlugins).sort()).toEqual(
    ['architecture-review', 'engineering-paved-path', 'research-tools', 'sdd-engineering'].map((n) => `${n}@${MP}`),
  );
});

test('graph draws one node per plugin and one edge per dependency (AC-8)', async ({ page }) => {
  await page.goto('./#/graph');
  const edges = index.plugins.reduce((n: number, p: { dependencies: unknown[] }) => n + p.dependencies.length, 0);
  await expect(page.getByTestId('graph-node')).toHaveCount(index.plugins.length);
  await expect(page.getByTestId('graph-edge')).toHaveCount(edges);
});

test.describe('phone width (AC-15)', () => {
  test.use({ viewport: { width: 360, height: 740 } });
  for (const route of ['#/', '#/search?q=review', '#/plugin/sdd-engineering', '#/artifact/sdd-engineering:run-plan', '#/graph', '#/team-setup', '#/compatibility', '#/getting-started', '#/whats-new']) {
    test(`no horizontal scroll at ${route}`, async ({ page }) => {
      await page.goto(`./${route}`);
      await page.waitForSelector('.topbar');
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }
});

test('the footer links the build report in a new tab', async ({ page }) => {
  await page.goto('./#/');
  const link = page.getByRole('contentinfo').getByRole('link', { name: 'Build report' });
  await expect(link).toHaveAttribute('href', 'https://claude.ai/artifact/C3uAY823HPG4uM1xUxLYb3');
  await expect(link).toHaveAttribute('target', '_blank');
});
