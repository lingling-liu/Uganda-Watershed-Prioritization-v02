const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const url=process.env.TEST_URL||'http://127.0.0.1:8093/';
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.TEST_BROWSER,args:['--enable-unsafe-swiftshader']});
 const context=await browser.newContext({viewport:{width:1550,height:1050},permissions:['geolocation'],geolocation:{longitude:32.5825,latitude:.3476,accuracy:10}});
 await context.addInitScript(()=>{
  window.__geoCalls=0;window.__watchCalls=0;
  const original=navigator.geolocation.getCurrentPosition.bind(navigator.geolocation);
  navigator.geolocation.getCurrentPosition=(...args)=>{window.__geoCalls++;return original(...args)};
  navigator.geolocation.watchPosition=()=>{window.__watchCalls++;throw Error('Continuous location tracking must not be used')};
 });
 const p=await context.newPage(),errors=[],tiles=[];p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.url().startsWith('https://tile.openstreetmap.org/'))tiles.push({url:r.url(),status:r.status()})});
 await p.goto(url);await p.getByRole('button',{name:'Locate Me',exact:true}).waitFor();await p.waitForTimeout(1500);
 assert.equal(await p.evaluate(()=>window.__geoCalls),0);assert.equal(tiles.length,0,'Existing default basemap must not request tiles');
 const baseline=await p.locator('.ranking tbody tr').first().innerText();assert(baseline.includes('#1584'));
 await p.getByRole('checkbox',{name:'Compare watershed 1584',exact:true}).check();await p.getByRole('button',{name:'Close watershed profile'}).click();
 await p.locator('.layer-control summary').click();assert.equal(await p.getByRole('combobox',{name:'Basemap',exact:true}).inputValue(),'existing');
 const tileLoaded=p.waitForResponse(r=>r.url().startsWith('https://tile.openstreetmap.org/')&&r.status()===200,{timeout:25000});
 await p.getByRole('combobox',{name:'Basemap',exact:true}).selectOption('osm');await tileLoaded;
 assert(await p.getByRole('link',{name:'© OpenStreetMap contributors',exact:true}).isVisible());
 assert.equal(await p.locator('.ranking tbody tr').first().innerText(),baseline);assert(await p.getByRole('checkbox',{name:'Compare watershed 1584',exact:true}).isChecked());
 await p.getByRole('combobox',{name:'Basemap',exact:true}).selectOption('existing');assert.equal(await p.getByRole('link',{name:'© OpenStreetMap contributors',exact:true}).count(),0);
 await p.getByRole('combobox',{name:'Basemap',exact:true}).selectOption('osm');await p.locator('.layer-control summary').click();
 await p.getByRole('button',{name:'Locate Me',exact:true}).click();await p.getByRole('img',{name:'Your current location',exact:true}).waitFor();await p.waitForTimeout(1800);
 assert.equal(await p.evaluate(()=>window.__geoCalls),1);assert.equal(await p.evaluate(()=>window.__watchCalls),0);
 const dot=await p.getByRole('img',{name:'Your current location',exact:true}).boundingBox(),canvas=await p.locator('.map canvas').boundingBox();
 assert(Math.abs(dot.x+dot.width/2-(canvas.x+canvas.width/2))<3,'Location should center the map horizontally');assert(Math.abs(dot.y+dot.height/2-(canvas.y+canvas.height/2))<3,'Location should center the map vertically');
 assert.equal(await p.getByRole('img',{name:'Your current location',exact:true}).evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(26, 115, 232)');
 const storage=await p.evaluate(()=>JSON.stringify({...localStorage}));assert(!storage.includes('32.5825')&&!storage.includes('0.3476'));
 await p.getByRole('button',{name:'Locate Me',exact:true}).click();await p.waitForTimeout(500);assert.equal(await p.getByRole('img',{name:'Your current location',exact:true}).count(),1,'A repeat fix replaces the dot');
 // Existing watershed toggle can reveal full OSM road and town detail without changing polygon opacity.
 await p.locator('.layer-control summary').click();await p.getByRole('checkbox',{name:'Watersheds',exact:true}).uncheck();await p.locator('.layer-control summary').click();await p.waitForTimeout(1500);await p.locator('.map-card').screenshot({path:'reports/osm-locate-desktop.png'});
 await p.getByRole('button',{name:'Reset view',exact:true}).click();await p.setViewportSize({width:390,height:844});await p.waitForTimeout(1000);await p.getByRole('button',{name:'Locate Me',exact:true}).click();await p.waitForTimeout(1800);await p.locator('.map-card').screenshot({path:'reports/osm-locate-mobile.png'});
 assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert(await p.getByRole('button',{name:'Locate Me',exact:true}).isEnabled());assert.deepEqual(errors,[]);
 console.log('Actual OSM tile responses:',tiles.filter(t=>t.status===200).length);await context.close();
 for(const [code,text] of [[1,'permission was denied'],[2,'could not determine'],[3,'timed out']]){
  const c=await browser.newContext({viewport:{width:390,height:844}});
  await c.addInitScript(code=>{Object.defineProperty(navigator,'geolocation',{value:{getCurrentPosition:(_,error)=>setTimeout(()=>error({code}),80),watchPosition:()=>{throw Error('must not track')}},configurable:true})},code);
  const page=await c.newPage();await page.goto(url);await page.getByRole('button',{name:'Locate Me',exact:true}).waitFor();await page.getByRole('button',{name:'Locate Me',exact:true}).click();await page.getByRole('status').filter({hasText:text}).waitFor();assert(await page.getByRole('button',{name:'Locate Me',exact:true}).isEnabled());assert.equal(await page.locator('[data-user-location]').count(),0);await c.close();
 }
 const c=await browser.newContext();await c.addInitScript(()=>Object.defineProperty(navigator,'geolocation',{value:undefined,configurable:true}));const page=await c.newPage();await page.goto(url);await page.getByRole('button',{name:'Locate Me',exact:true}).waitFor();await page.getByRole('button',{name:'Locate Me',exact:true}).click();await page.getByRole('status').filter({hasText:'unavailable in this browser'}).waitFor();await c.close();
 await browser.close();console.log('PASS: default preserved; actual OSM tiles/attribution; switching preserves rank/selection; blue dot and centering; one-shot/no watch/no stored coordinates; repeat fix; mobile layout; denied/unavailable/timeout/unsupported handling. Location was simulated; no real user coordinates were requested.');
})().catch(e=>{console.error(e);process.exit(1)});
