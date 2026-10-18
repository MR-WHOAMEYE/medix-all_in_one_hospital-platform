import puppeteer from 'puppeteer';
import fs from 'node:fs/promises';
import path from 'node:path';

const BASE_URL = (process.env.MEDIX_URL || 'https://medix-15sd.vercel.app').replace(/\/$/, '');
const OUT = path.resolve(process.env.OUT_DIR || './svg-pages');
const WIDTH = Number(process.env.WIDTH || 1920);
const HEIGHT = Number(process.env.HEIGHT || 1080);
const WAIT_MS = Number(process.env.WAIT_MS || 1800);

const roles = [
  { role: 'admin', email: process.env.MEDIX_ADMIN_EMAIL, password: process.env.MEDIX_ADMIN_PASSWORD,
    routes: [['dashboard','/'],['operations','/operations'],['intelligence','/intelligence'],['simulation','/simulation'],['strategy','/strategy'],['reports','/reports'],['settings','/settings'],['users','/admin/users'],['response-suggestions','/response-suggestions'],['workflow','/workflow'],['clinical-decision-support','/cdss']] },
  { role: 'doctor', email: process.env.MEDIX_DOCTOR_EMAIL, password: process.env.MEDIX_DOCTOR_PASSWORD,
    routes: [['dashboard','/'],['patient-management','/patient-management'],['appointment-management','/appointment-management'],['reports','/reports'],['response-suggestions','/response-suggestions'],['workflow','/workflow'],['clinical-decision-support','/cdss']] },
  { role: 'nurse', email: process.env.MEDIX_NURSE_EMAIL, password: process.env.MEDIX_NURSE_PASSWORD,
    routes: [['dashboard','/'],['register-patient','/register-patient'],['patient-vitals','/patient-vitals'],['reports','/reports']] },
  { role: 'patient', email: process.env.MEDIX_PATIENT_EMAIL, password: process.env.MEDIX_PATIENT_PASSWORD,
    routes: [['dashboard','/'],['book-appointment','/book-appointment'],['profile','/profile'],['patient-queries','/patient-queries'],['reports','/reports']] },
];

const browser = await puppeteer.launch({
  headless: true,
  executablePath: process.env.CHROME_BIN || undefined,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
});
await fs.mkdir(OUT, { recursive: true });
const manifest = { source: BASE_URL, format: 'SVG with XHTML foreignObject', width: WIDTH, height: HEIGHT, pages: [] };

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const esc = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

async function exportPage(page, role, name) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await wait(WAIT_MS);
  await page.evaluate(() => document.fonts?.ready).catch(() => {});
  const result = await page.evaluate(({ width, height }) => {
    const css = [];
    for (const sheet of Array.from(document.styleSheets)) {
      try { css.push(Array.from(sheet.cssRules).map(rule => rule.cssText).join('\n')); }
      catch { if (sheet.href) css.push('@import url("' + sheet.href + '");'); }
    }
    const clone = document.body.cloneNode(true);
    clone.querySelectorAll('script, iframe, object, embed').forEach(node => node.remove());
    const originalInteractive = Array.from(document.querySelectorAll('button,a,input,select,textarea,[role="button"],[onclick]'));
    const hotspots = originalInteractive.map((el, index) => {
      const r = el.getBoundingClientRect();
      const id = 'medix-hit-' + index;
      const cloneEl = clone.querySelectorAll('button,a,input,select,textarea,[role="button"],[onclick]')[index];
      if (cloneEl) cloneEl.setAttribute('data-medix-hit-id', id);
      return { id, x: Math.max(0,r.x), y: Math.max(0,r.y), width: Math.max(0,r.width), height: Math.max(0,r.height),
        label: (el.getAttribute('aria-label') || el.innerText || el.getAttribute('placeholder') || el.tagName).trim().slice(0,100) };
    }).filter(h => h.width > 0 && h.height > 0 && h.x < width && h.y < height);
    const base = document.createElement('base'); base.href = location.origin + '/';
    const root = clone.querySelector(':scope > #root');
    const markup = clone.innerHTML;
    return { css: css.join('\n'), markup, hotspots, title: document.title, base: base.href, url: location.href };
  }, { width: WIDTH, height: HEIGHT });

  const xhtml = '<div xmlns="http://www.w3.org/1999/xhtml" style="width:'+WIDTH+'px;height:'+HEIGHT+'px;overflow:hidden;background:#f8fafc">' +
    '<base href="'+esc(result.base)+'"/><style>'+result.css+' html,body{margin:0!important;width:'+WIDTH+'px!important;height:'+HEIGHT+'px!important;overflow:hidden!important} body{font-family:Inter,ui-sans-serif,system-ui,sans-serif} #root{min-height:100vh}</style>' +
    result.markup + '</div>';
  const overlay = result.hotspots.map(h =>
    '<g id="'+esc(h.id)+'" data-label="'+esc(h.label)+'" class="medix-click-target" tabindex="0" role="button" aria-label="'+esc(h.label)+'">' +
    '<title>'+esc(h.label)+'</title><rect x="'+h.x+'" y="'+h.y+'" width="'+h.width+'" height="'+h.height+'" fill="transparent" stroke="transparent" stroke-width="1" pointer-events="all" ' +
    'onclick="var d=document.querySelector(\'[data-medix-hit-id=&quot;'+h.id+'&quot;]\');if(d){d.dispatchEvent(new MouseEvent(&quot;click&quot;,{bubbles:true,cancelable:true,view:window}));}"/>' +
    '</g>'
  ).join('');
  const svg = '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:xlink="http://www.w3.org/1999/xlink" width="'+WIDTH+'" height="'+HEIGHT+'" viewBox="0 0 '+WIDTH+' '+HEIGHT+'" role="img" aria-label="MediX '+esc(role)+' '+esc(name)+'">' +
    '<title>MediX '+esc(role)+' — '+esc(name)+'</title><desc>Rendered from the live React application. UI is preserved in foreignObject; transparent SVG hit targets identify interactive controls.</desc>' +
    '<foreignObject x="0" y="0" width="'+WIDTH+'" height="'+HEIGHT+'">'+xhtml+'</foreignObject>' +
    '<g id="interactive-hotspots" fill="none">'+overlay+'</g></svg>';
  const filename = role + '-' + name + '.svg';
  await fs.writeFile(path.join(OUT, filename), svg, 'utf8');
  manifest.pages.push({ role, name, url: result.url, file: filename, interactiveTargets: result.hotspots.length, status: 'exported' });
  console.log('Exported', filename, '| interactive targets:', result.hotspots.length);
}

try {
  const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1 });
  await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 60000 });
  await wait(WAIT_MS);
  await exportPage(page, 'public', 'login');

  for (const config of roles) {
    if (!config.email || !config.password) {
      console.log('Skipped role', config.role, '- set MEDIX_'+config.role.toUpperCase()+'_EMAIL and MEDIX_'+config.role.toUpperCase()+'_PASSWORD');
      manifest.pages.push({ role: config.role, status: 'skipped-no-credentials' });
      continue;
    }
    // The previous role's successful login leaves sessionStorage populated, so
    // navigating to "/" would show its dashboard instead of the login form.
    // Clear only this capture tab's session before starting the next role.
    await page.evaluate(() => sessionStorage.clear()).catch(() => {});
    await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 60000 });
    await wait(500);
    const email = await page.$('input[placeholder*="@"]') || await page.$('input[type="email"]') || await page.$('input[type="text"]');
    const password = await page.$('input[type="password"]');
    if (!email || !password) throw new Error('Login inputs not found. Inspect the current deployed login DOM.');
    await email.click({ clickCount: 3 }); await email.type(config.email);
    await password.type(config.password);
    await page.locator('button[type="submit"]').click();

    // A password field can remain visible when credentials are rejected. Wait for
    // the actual success token or the inline login error instead of guessing from DOM.
    let loginState;
    try {
      await page.waitForFunction(
        () => Boolean(sessionStorage.getItem('zi_token')) ||
          Boolean(document.querySelector('.text-rose-500')),
        { timeout: 30000 }
      );
      loginState = await page.evaluate(() => ({
        authenticated: Boolean(sessionStorage.getItem('zi_token')),
        error: document.querySelector('.text-rose-500')?.innerText?.trim() || ''
      }));
    } catch {
      loginState = await page.evaluate(() => ({
        authenticated: Boolean(sessionStorage.getItem('zi_token')),
        error: document.querySelector('.text-rose-500')?.innerText?.trim() || ''
      }));
    }

    if (!loginState.authenticated) {
      const reason = loginState.error || 'No auth token appeared within 30 seconds; check API reachability and credentials.';
      console.warn('Skipping role', config.role, '- login did not succeed:', reason);
      manifest.pages.push({ role: config.role, status: 'login-failed', reason });
      continue;
    }

    await wait(WAIT_MS);
    for (const [name, route] of config.routes) {
      await page.goto(BASE_URL + route, { waitUntil: 'networkidle2', timeout: 60000 });
      await wait(WAIT_MS);
      await exportPage(page, config.role, name);
    }
  }
  await fs.writeFile(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log('Manifest:', path.join(OUT, 'manifest.json'));
} finally {
  await browser.close();
}
