import puppeteer from 'puppeteer';
import fs from 'node:fs/promises';
import path from 'node:path';

const BASE_URL = (process.env.MEDIX_URL || 'https://medix-15sd.vercel.app').replace(/\/$/, '');
const OUT = path.resolve(process.env.OUT_DIR || './captures');
const WIDTH = Number(process.env.WIDTH || 1920);
const HEIGHT = Number(process.env.HEIGHT || 1080);
const EMAIL = process.env.MEDIX_EMAIL || '';
const PASSWORD = process.env.MEDIX_PASSWORD || '';
const WAIT_MS = Number(process.env.WAIT_MS || 1800);

const screens = [
  { name: '01-login', path: '/' },
  { name: '02-admin-dashboard', path: '/', role: 'admin' },
  { name: '03-operations', path: '/operations', role: 'admin' },
  { name: '04-intelligence', path: '/intelligence', role: 'admin' },
  { name: '05-simulation', path: '/simulation', role: 'admin' },
  { name: '06-strategy', path: '/strategy', role: 'admin' },
  { name: '07-reports', path: '/reports', role: 'admin' },
  { name: '08-doctor-dashboard', path: '/', role: 'doctor' },
  { name: '09-patient-management', path: '/patient-management', role: 'doctor' },
  { name: '10-appointment-management', path: '/appointment-management', role: 'doctor' },
  { name: '11-nurse-dashboard', path: '/', role: 'nurse' },
  { name: '12-register-patient', path: '/register-patient', role: 'nurse' },
  { name: '13-patient-vitals', path: '/patient-vitals', role: 'nurse' },
  { name: '14-patient-dashboard', path: '/', role: 'patient' },
  { name: '15-book-appointment', path: '/book-appointment', role: 'patient' },
  { name: '16-patient-profile', path: '/profile', role: 'patient' },
  { name: '17-patient-queries', path: '/patient-queries', role: 'patient' },
  { name: '18-ai-response-suggestions', path: '/response-suggestions', role: 'admin' },
  { name: '19-workflow-automation', path: '/workflow', role: 'admin' },
  { name: '20-clinical-decision-support', path: '/cdss', role: 'admin' },
];

await fs.mkdir(OUT, { recursive: true });
const browser = await puppeteer.launch({
  headless: true,
  executablePath: process.env.CHROME_BIN || undefined,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1 });
page.setDefaultTimeout(15000);
page.on('console', msg => { if (msg.type() === 'error') console.warn('[browser console]', msg.text()); });
page.on('pageerror', err => console.warn('[page error]', err.message));

async function settle() {
  await page.waitForFunction(() => document.readyState === 'complete').catch(() => {});
  await page.waitForTimeout(WAIT_MS);
  await page.evaluate(() => document.fonts?.ready).catch(() => {});
}

async function saveScreenshot(name) {
  const pngPath = path.join(OUT, name + '.png');
  await page.screenshot({ path: pngPath, fullPage: false, animations: 'disabled' });
  const png = await fs.readFile(pngPath);
  // SVG wrapper preserves the exact browser-rendered pixels; it is not a vector reconstruction of the React UI.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}"><image width="${WIDTH}" height="${HEIGHT}" href="data:image/png;base64,${png.toString('base64')}"/></svg>`;
  await fs.writeFile(path.join(OUT, name + '.svg'), svg);
  console.log('Captured', name);
}

async function loginIfConfigured() {
  if (!EMAIL || !PASSWORD) return false;
  await page.goto(BASE_URL, { waitUntil: 'networkidle2' });
  await settle();
  const emailInput = await page.$('input[type="email"], input[name="email"]');
  const passwordInput = await page.$('input[type="password"], input[name="password"]');
  if (!emailInput || !passwordInput) {
    console.warn('Login fields were not found. Authenticated captures skipped.');
    return false;
  }
  await emailInput.click({ clickCount: 3 });
  await emailInput.type(EMAIL);
  await passwordInput.click({ clickCount: 3 });
  await passwordInput.type(PASSWORD);
  const submit = await page.$('button[type="submit"]');
  if (!submit) {
    console.warn('Submit button not found. Authenticated captures skipped.');
    return false;
  }
  await Promise.allSettled([page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 12000 }), submit.click()]);
  await settle();
  return await page.evaluate(() => Boolean(sessionStorage.getItem('zi_user')));
}

try {
  await page.goto(BASE_URL, { waitUntil: 'networkidle2' });
  await settle();
  await saveScreenshot('01-login');

  if (!EMAIL || !PASSWORD) {
    console.log('No MEDIX_EMAIL/MEDIX_PASSWORD provided; captured public login screen only.');
  } else {
    const loggedIn = await loginIfConfigured();
    if (!loggedIn) {
      console.warn('Login did not establish a session. Only login capture is available; check credentials/API access.');
    } else {
      // Role session is provided by the account used above. Capture only routes permitted to that account.
      const role = await page.evaluate(() => {
        try { return JSON.parse(sessionStorage.getItem('zi_user') || '{}').role || ''; } catch { return ''; }
      });
      const roleScreens = screens.filter(s => s.role === role || (!s.role && s.path === '/'));
      for (const screen of roleScreens) {
        await page.goto(BASE_URL + screen.path, { waitUntil: 'networkidle2' }).catch(() => {});
        await settle();
        await saveScreenshot(screen.name);
      }
      console.log('Authenticated role detected:', role || '(unknown)');
      console.log('To capture all roles, run once per role using separate credentials and OUT_DIR= captures/<role>.');
    }
  }
  await fs.writeFile(path.join(OUT, 'capture-manifest.json'), JSON.stringify({
    baseUrl: BASE_URL, viewport: { width: WIDTH, height: HEIGHT },
    note: 'SVG files embed the exact screenshot pixels; they are not editable vector UI reconstructions.',
    files: (await fs.readdir(OUT)).filter(f => /\.(png|svg)$/.test(f)).sort()
  }, null, 2));
  console.log('Output directory:', OUT);
} finally {
  await browser.close();
}
