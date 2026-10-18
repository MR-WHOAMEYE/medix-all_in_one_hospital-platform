import puppeteer from 'puppeteer';
import fs from 'node:fs/promises';
import path from 'node:path';

const BASE_URL = (process.env.MEDIX_URL || 'https://medix-15sd.vercel.app').replace(/\/$/, '');
const ROOT_OUT = path.resolve(process.env.OUT_DIR || './captures');
const WIDTH = Number(process.env.WIDTH || 1920);
const HEIGHT = Number(process.env.HEIGHT || 1080);
const WAIT_MS = Number(process.env.WAIT_MS || 1800);

const roles = [
  {
    role: 'admin',
    email: process.env.MEDIX_ADMIN_EMAIL || '',
    password: process.env.MEDIX_ADMIN_PASSWORD || '',
    screens: [
      { name: '02-admin-dashboard', path: '/' },
      { name: '03-operations', path: '/operations' },
      { name: '04-intelligence', path: '/intelligence' },
      { name: '05-simulation', path: '/simulation' },
      { name: '06-strategy', path: '/strategy' },
      { name: '07-reports', path: '/reports' },
      { name: '18-ai-response-suggestions', path: '/response-suggestions' },
      { name: '19-workflow-automation', path: '/workflow' },
      { name: '20-clinical-decision-support', path: '/cdss' },
    ],
  },
  {
    role: 'doctor',
    email: process.env.MEDIX_DOCTOR_EMAIL || '',
    password: process.env.MEDIX_DOCTOR_PASSWORD || '',
    screens: [
      { name: '08-doctor-dashboard', path: '/' },
      { name: '09-patient-management', path: '/patient-management' },
      { name: '10-appointment-management', path: '/appointment-management' },
      { name: '07-reports', path: '/reports' },
      { name: '18-ai-response-suggestions', path: '/response-suggestions' },
      { name: '19-workflow-automation', path: '/workflow' },
      { name: '20-clinical-decision-support', path: '/cdss' },
    ],
  },
  {
    role: 'nurse',
    email: process.env.MEDIX_NURSE_EMAIL || '',
    password: process.env.MEDIX_NURSE_PASSWORD || '',
    screens: [
      { name: '11-nurse-dashboard', path: '/' },
      { name: '12-register-patient', path: '/register-patient' },
      { name: '13-patient-vitals', path: '/patient-vitals' },
      { name: '07-reports', path: '/reports' },
      { name: '18-ai-response-suggestions', path: '/response-suggestions' },
      { name: '19-workflow-automation', path: '/workflow' },
      { name: '20-clinical-decision-support', path: '/cdss' },
    ],
  },
  {
    role: 'patient',
    email: process.env.MEDIX_PATIENT_EMAIL || '',
    password: process.env.MEDIX_PATIENT_PASSWORD || '',
    screens: [
      { name: '14-patient-dashboard', path: '/' },
      { name: '15-book-appointment', path: '/book-appointment' },
      { name: '16-patient-profile', path: '/profile' },
      { name: '17-patient-queries', path: '/patient-queries' },
      { name: '07-reports', path: '/reports' },
    ],
  },
];

await fs.mkdir(ROOT_OUT, { recursive: true });
const browser = await puppeteer.launch({
  headless: true,
  executablePath: process.env.CHROME_BIN || undefined,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
});

async function settle(page) {
  await page.waitForFunction(() => document.readyState === 'complete').catch(() => {});
  await new Promise(resolve => setTimeout(resolve, WAIT_MS));
  await page.evaluate(() => document.fonts?.ready).catch(() => {});
}

async function saveScreenshot(page, outDir, name) {
  await fs.mkdir(outDir, { recursive: true });
  const pngPath = path.join(outDir, name + '.png');
  await page.screenshot({ path: pngPath, fullPage: false, animations: 'disabled' });
  const png = await fs.readFile(pngPath);
  // Exact-pixel SVG wrapper; this is not a vector reconstruction of the React components.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}"><image width="${WIDTH}" height="${HEIGHT}" href="data:image/png;base64,${png.toString('base64')}"/></svg>`;
  await fs.writeFile(path.join(outDir, name + '.svg'), svg);
  console.log(`Captured: ${path.join(outDir, name)}.png + .svg`);
}

async function captureLogin() {
  const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1 });
  page.setDefaultTimeout(20000);
  page.on('console', msg => { if (msg.type() === 'error') console.warn('[browser console]', msg.text()); });
  page.on('pageerror', err => console.warn('[page error]', err.message));
  await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 60000 });
  await settle(page);
  await saveScreenshot(page, ROOT_OUT, '01-login');
  await page.close();
}

async function loginAndCapture(config) {
  if (!config.email || !config.password) {
    console.warn(`Skipping ${config.role}: set MEDIX_${config.role.toUpperCase()}_EMAIL and MEDIX_${config.role.toUpperCase()}_PASSWORD.`);
    return { role: config.role, status: 'skipped-no-credentials', files: [] };
  }

  const outDir = path.join(ROOT_OUT, config.role);
  const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1 });
  page.setDefaultTimeout(20000);
  page.on('console', msg => { if (msg.type() === 'error') console.warn(`[${config.role} console]`, msg.text()); });
  page.on('pageerror', err => console.warn(`[${config.role} page error]`, err.message));

  try {
    await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 60000 });
    await settle(page);

    // LoginPage.jsx uses type="text" for the email field and has no name attribute.
    // Prefer its email-like placeholder, then fall back to visible text inputs.
    const emailInput =
      await page.$('input[placeholder*="@"]') ||
      await page.$('input[type="email"]') ||
      await page.$('input[name="email"]') ||
      await page.$('input[autocomplete="username"]') ||
      await page.$('input[type="text"]');
    const passwordInput =
      await page.$('input[type="password"]') ||
      await page.$('input[name="password"]') ||
      await page.$('input[autocomplete="current-password"]');

    if (!emailInput || !passwordInput) {
      const inputDetails = await page.$eval('input', inputs =>
        inputs.map(input => ({
          type: input.type,
          name: input.name,
          placeholder: input.placeholder,
          ariaLabel: input.getAttribute('aria-label'),
          visible: Boolean(input.getClientRects().length),
        }))
      ).catch(() => []);
      console.warn(`Login inputs not found for ${config.role}. Inputs detected: ${JSON.stringify(inputDetails)}`);
      return { role: config.role, status: 'failed-login-fields-not-found', files: [] };
    }

    await emailInput.click({ clickCount: 3 });
    await emailInput.type(config.email);
    await passwordInput.click({ clickCount: 3 });
    await passwordInput.type(config.password);

    const submit = await page.$('button[type="submit"]');
    if (!submit) {
      console.warn(`Submit button not found for ${config.role}.`);
      return { role: config.role, status: 'failed-submit-button-not-found', files: [] };
    }

    await submit.click();
    await page.waitForFunction(() => {
      try { return Boolean(sessionStorage.getItem('zi_user')); } catch { return false; }
    }, { timeout: 20000 }).catch(() => {});
    await settle(page);

    const session = await page.evaluate(() => {
      try { return JSON.parse(sessionStorage.getItem('zi_user') || 'null'); } catch { return null; }
    });
    if (!session) {
      const errorText = await page.$eval('body', el => el.innerText.slice(-1000)).catch(() => '');
      console.warn(`Login failed for ${config.role}. Visible page tail: ${errorText}`);
      return { role: config.role, status: 'failed-authentication', files: [] };
    }
    if (session.role !== config.role) {
      console.warn(`Expected role ${config.role}, but login returned ${session.role}; skipping to avoid capturing the wrong portal.`);
      return { role: config.role, status: 'role-mismatch', actualRole: session.role, files: [] };
    }

    const captured = [];
    for (const screen of config.screens) {
      try {
        await page.goto(BASE_URL + screen.path, { waitUntil: 'networkidle2', timeout: 60000 });
        await settle(page);
        await saveScreenshot(page, outDir, screen.name);
        captured.push(screen.name);
      } catch (err) {
        console.warn(`Failed ${config.role} route ${screen.path}: ${err.message}`);
      }
    }
    return { role: config.role, status: 'completed', files: captured };
  } finally {
    await page.close();
  }
}

try {
  await captureLogin();
  const results = [];
  for (const role of roles) results.push(await loginAndCapture(role));

  const manifest = {
    baseUrl: BASE_URL,
    viewport: { width: WIDTH, height: HEIGHT },
    note: 'SVG outputs embed exact screenshot pixels. They are not editable vector UI reconstructions.',
    results,
  };
  await fs.writeFile(path.join(ROOT_OUT, 'capture-manifest.json'), JSON.stringify(manifest, null, 2));
  console.log('\nCapture summary:');
  for (const item of results) console.log(`- ${item.role}: ${item.status} (${item.files.length} screens)`);
  console.log('Output directory:', ROOT_OUT);
} finally {
  await browser.close();
}
