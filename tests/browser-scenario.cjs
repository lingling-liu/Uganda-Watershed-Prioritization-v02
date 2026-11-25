const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const browser = await chromium.launch({executablePath: process.env.TEST_BROWSER, args:['--enable-unsafe-swiftshader']});
  try {
    const page = await browser.newPage({viewport: {width:1440,height:1050}});
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => {if (m.type() === 'error' && !m.text().startsWith('Failed to load resource') && (process.env.TEST_URL || !m.text().includes('https://tile.openstreetmap.org/'))) errors.push(m.text());});
    const url = process.env.TEST_URL || 'http://uganda.test/Uganda-Watershed-IPT-v04/';
    if (!process.env.TEST_URL) await page.route('**/*', async route => {
      const target = route.request().url();
      if (!target.startsWith(url)) return route.abort();
      const file = path.resolve('dist', new URL(target).pathname.slice(new URL(url).pathname.length) || 'index.html');
      return fs.existsSync(file) ? route.fulfill({path:file}) : route.fulfill({status:404});
    });
    await page.goto(url);
    await page.locator('table tbody tr').first().getByText('#1692', {exact:true}).waitFor();
    await page.getByRole('button', {name:'Scenario Comparison', exact:true}).click();
    const value = label => page.locator('.scenario-metrics > div').filter({has:page.getByText(label,{exact:true})}).locator('dd');
    const expect = (label, text) => value(label).getByText(text,{exact:true}).waitFor();
    await expect('Watersheds analyzed','1,910');
    await expect('Consistently high priority','96');
    await expect('Spearman rank correlation','1');
    await page.waitForFunction(() => document.querySelectorAll('.scenario-map canvas').length === 4);
    const baselineMap = page.locator('.scenario-map').filter({has:page.getByRole('heading',{name:'Baseline prioritization',exact:true})});
    const altCanvas = page.locator('.scenario-map').filter({has:page.getByRole('heading',{name:'Alternative prioritization',exact:true})}).locator('canvas');
    // Wait for the synchronized maps to finish the initial GeoJSON worker load.
    await page.waitForTimeout(1100);
    const before = await altCanvas.screenshot();
    await baselineMap.getByRole('button',{name:'Zoom in',exact:true}).click();
    let after = before;
    for (let attempt = 0; attempt < 10 && before.equals(after); attempt++) {
      await page.waitForTimeout(200);
      after = await altCanvas.screenshot();
    }
    assert(!before.equals(after), 'Baseline zoom should update the alternative map');
    await page.getByLabel('Top-priority threshold').selectOption('15');
    await expect('Consistently high priority','287');
    const weight = page.getByRole('spinbutton',{name:'Alternative weight for Sediment Export Rate',exact:true});
    await weight.fill('1.25');
    await page.waitForFunction(() => {
      const item=[...document.querySelectorAll('.scenario-metrics > div')].find(e=>e.firstElementChild?.textContent==='Newly selected');
      return Number(item?.lastElementChild?.textContent) > 0;
    });
    await page.getByRole('button',{name:'Improved',exact:true}).click();
    assert.equal(await page.getByRole('button',{name:'Improved',exact:true}).getAttribute('aria-pressed'),'true');
    await page.getByLabel('Priority group change').selectOption('Newly selected');
    assert(await page.locator('.scenario tbody tr').last().getByText('Newly selected',{exact:true}).isVisible());
    await page.getByLabel('Priority group change').selectOption('');
    await page.getByLabel('Search watersheds').fill('1692');
    await page.locator('.scenario').getByRole('button',{name:'#1692',exact:true}).click();
    await page.getByText('Watershed #1692',{exact:true}).waitFor();
    await page.getByRole('button',{name:'Reset to Default Weights'}).click();
    await expect('Consistently high priority','287');
    await page.getByLabel('Minimum area (ha)').fill('0');
    await expect('Watersheds analyzed','2,057');
    await expect('Consistently high priority','309');
    await page.setViewportSize({width:390,height:844});
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Scenario page overflows on mobile');
    assert.deepEqual(errors,[]);
    console.log('PASS: original Explore, scenario maps, filters, cutoff, alternative weights, legend, selection, reset, and mobile layout.');
  } finally { await browser.close(); }
})().catch(error => {console.error(error);process.exitCode=1;});
