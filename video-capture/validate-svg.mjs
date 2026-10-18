import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer';

const DIR = path.resolve(process.env.SVG_DIR || './svg-pages');
const PREVIEW_DIR = path.join(DIR, 'validation-previews');
const WIDTH = Number(process.env.WIDTH || 1920);
const HEIGHT = Number(process.env.HEIGHT || 1080);

const files = (await fs.readdir(DIR)).filter(name => name.toLowerCase().endsWith('.svg'));
if (!files.length) {
  console.error('No SVG files found in:', DIR);
  process.exit(1);
}
await fs.mkdir(PREVIEW_DIR, { recursive: true });

const browser = await puppeteer.launch({
  headless: true,
  executablePath: process.env.CHROME_BIN || undefined,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
});
const results = [];

try {
  const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1 });
  page.setDefaultTimeout(15000);

  for (const file of files) {
    const fullPath = path.join(DIR, file);
    const xml = await fs.readFile(fullPath, 'utf8');
    const checks = {
      file,
      bytes: Buffer.byteLength(xml),
      xmlWellFormed: false,
      svgRoot: false,
      hasForeignObject: false,
      hotspotCount: 0,
      imageCount: 0,
      renderLoaded: false,
      errors: [],
    };

    try {
      const parsed = await page.evaluate(source => {
        const doc = new DOMParser().parseFromString(source, 'image/svg+xml');
        const parserError = doc.querySelector('parsererror');
        const root = doc.documentElement;
        return {
          ok: !parserError && root?.localName === 'svg',
          parserError: parserError?.textContent?.slice(0, 500) || '',
          root: root?.localName || '',
          width: root?.getAttribute('width') || '',
          height: root?.getAttribute('height') || '',
          viewBox: root?.getAttribute('viewBox') || '',
          foreignObjects: doc.querySelectorAll('foreignObject').length,
          hotspots: doc.querySelectorAll('.medix-click-target').length,
          images: doc.querySelectorAll('image, img').length,
          hasTitle: Boolean(doc.querySelector('title')?.textContent?.trim()),
        };
      }, xml);
      checks.xmlWellFormed = parsed.ok;
      checks.svgRoot = parsed.root === 'svg';
      checks.hasForeignObject = parsed.foreignObjects > 0;
      checks.hotspotCount = parsed.hotspots;
      checks.imageCount = parsed.images;
      checks.dimensions = { width: parsed.width, height: parsed.height, viewBox: parsed.viewBox };
      checks.hasTitle = parsed.hasTitle;
      if (!parsed.ok) checks.errors.push('XML parse error: ' + parsed.parserError);
      if (!checks.svgRoot) checks.errors.push('Root element is not <svg>.');
      if (!parsed.width || !parsed.height || !parsed.viewBox) checks.errors.push('Missing SVG dimensions or viewBox.');
      if (!parsed.foreignObjects) checks.errors.push('No foreignObject found; expected embedded rendered UI.');
      if (!parsed.hotspots) checks.errors.push('No interactive hotspot groups found.');

      const pageErrors = [];
      const failedRequests = [];
      const consoleErrors = [];
      const onPageError = error => pageErrors.push(error.message);
      const onRequestFailed = request => failedRequests.push(request.url() + ' — ' + (request.failure()?.errorText || 'failed'));
      const onConsole = message => { if (message.type() === 'error') consoleErrors.push(message.text()); };
      page.on('pageerror', onPageError);
      page.on('requestfailed', onRequestFailed);
      page.on('console', onConsole);

      await page.goto(pathToFileURL(fullPath).href, { waitUntil: 'load', timeout: 30000 });
      await new Promise(resolve => setTimeout(resolve, 800));
      await page.screenshot({ path: path.join(PREVIEW_DIR, file.replace(/\.svg$/i, '.png')), fullPage: false });
      checks.renderLoaded = await page.evaluate(() => document.documentElement?.localName === 'svg');
      checks.runtimeErrors = [...pageErrors, ...consoleErrors].slice(0, 20);
      checks.failedRequests = failedRequests.slice(0, 20);
      if (checks.runtimeErrors.length) checks.errors.push('Browser console/runtime errors were logged.');
      if (checks.failedRequests.length) checks.errors.push('One or more resources failed to load.');
      page.off('pageerror', onPageError);
      page.off('requestfailed', onRequestFailed);
      page.off('console', onConsole);
    } catch (error) {
      checks.errors.push(error.message);
    }
    checks.status = checks.errors.length ? 'CHECK' : 'PASS';
    results.push(checks);
    console.log('[' + checks.status + '] ' + file + ' | hotspots=' + checks.hotspotCount + ' | ' + checks.errors.join(' '));
  }
} finally {
  await browser.close();
}

const report = {
  checkedAt: new Date().toISOString(),
  directory: DIR,
  total: results.length,
  passed: results.filter(r => r.status === 'PASS').length,
  needsReview: results.filter(r => r.status !== 'PASS').length,
  results,
};
await fs.writeFile(path.join(DIR, 'validation-report.json'), JSON.stringify(report, null, 2));
console.log('\nReport:', path.join(DIR, 'validation-report.json'));
console.log('Rendered previews:', PREVIEW_DIR);
if (report.needsReview) process.exitCode = 1;
