const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.TEST_BROWSER,
    args: ['--enable-unsafe-swiftshader']
  });
  try {
    const page = await browser.newPage({viewport:{width:1440,height:1000}, acceptDownloads:true});
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const offlineUrl = 'http://uganda.test/Uganda-Watershed-Prioritization/';
    if (!process.env.TEST_URL) {
      await page.route('**/*', async route => {
        const url = route.request().url();
        if (!url.startsWith(offlineUrl)) return route.abort();
        const file = path.resolve('dist', url.slice(offlineUrl.length) || 'index.html');
        return fs.existsSync(file) ? route.fulfill({path:file}) : route.fulfill({status:404});
      });
    }
    await page.goto(process.env.TEST_URL || offlineUrl);
    const population = page.locator('.metric').filter({hasText:'IN THE ANALYSIS'});
    const expectCount = async text => population.getByText(text, {exact:true}).waitFor();
    await expectCount('1,910');
    await page.locator('table tbody tr').first().getByText('#1692', {exact:true}).waitFor();
    await page.getByRole('button', {name:'Locate Me', exact:true}).waitFor();
    await page.waitForFunction(() => !document.querySelector('.map-card button[title="Find your current location once"]').disabled);
    assert.equal(await page.locator('.maplibregl-canvas').count(), 1);
    const centroid = page.getByRole('checkbox', {name:'Watershed centroid within Uganda'});
    assert(await centroid.isChecked());
    await centroid.uncheck();
    await expectCount('2,028');
    await page.getByLabel('Minimum area (ha)').fill('5000');
    await page.waitForFunction(() => document.querySelectorAll('.metric strong')[1].textContent !== '2,028');
    await page.getByRole('button', {name:'Reset filters'}).click();
    await expectCount('1,910');
    for (const label of ['Water Management Zone','Basin','Catchment']) {
      const select = page.getByRole('combobox', {name:label, exact:true});
      await select.selectOption({index:1});
      await page.waitForFunction(() => document.querySelectorAll('.metric strong')[1].textContent !== '1,910');
      await page.getByRole('button', {name:'Reset filters'}).click();
      await expectCount('1,910');
    }
    await page.locator('.segmented').getByRole('button', {name:'Top 15%', exact:true}).click();
    await page.getByText('287 displayed', {exact:false}).waitFor();
    await page.getByRole('button', {name:'Reset filters'}).click();
    await page.getByRole('textbox', {name:'Search watershed ID'}).fill('1692');
    await page.locator('table tbody tr').first().getByText('#1692', {exact:true}).click();
    await page.locator('.detail-drawer').waitFor();
    await page.getByRole('button', {name:'Close watershed profile'}).click();
    await page.evaluate(() => {
      window.testExports = [];
      HTMLAnchorElement.prototype.click = function () {
        const item = {name:this.download};
        window.testExports.push(item);
        fetch(this.href).then(response => response.text()).then(body => { item.body = body; });
      };
    });
    await page.getByRole('button', {name:'Export current view'}).click();
    await page.waitForFunction(() => window.testExports.length === 2 && window.testExports.every(item => item.body));
    const exports = await page.evaluate(() => window.testExports);
    assert.equal(exports[0].name, 'Uganda-filtered-ranking.csv');
    assert.match(exports[0].body, /Priority_Rank,Lev12_ID/);
    assert.match(exports[0].body, /\r?\n1,1692,/);
    assert.equal(JSON.parse(exports[1].body).filters.centroidOnly, true);
    await page.getByRole('button', {name:'Criteria & weights', exact:true}).click();
    assert.equal(await page.locator('table.criteria tbody tr').count(), 25);
    assert.equal(await page.locator('table.criteria input[type=checkbox]:checked').count(), 6);
    assert.equal(await page.locator('.allocation').innerText(), '100% normalized');
    const weight = page.getByRole('spinbutton', {name:'Weight Nitrogen Total Export Rate', exact:true});
    await weight.fill('0');
    await page.getByRole('button', {name:'Excel defaults'}).click();
    assert.equal(await weight.inputValue(), '0.25');
    await page.getByRole('button', {name:'Explore', exact:true}).click();
    await page.getByRole('button', {name:'Reset filters'}).click();
    await page.setViewportSize({width:390,height:844});
    await expectCount('1,910');
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    assert.deepEqual(errors, []);
    console.log('PASS: subpath build, map, centroid and scope controls, tier, search, details, CSV, criteria and mobile.');
  } finally {
    await browser.close();
  }
})().catch(error => {console.error(error); process.exitCode = 1;});
