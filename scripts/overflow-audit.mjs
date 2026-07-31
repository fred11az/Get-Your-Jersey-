/**
 * Contrôle de débordement horizontal — « rien ne doit dépasser ».
 *   npm run dev            (dans un autre terminal)
 *   npm run audit:overflow
 *
 * Le critère est mesuré, pas jugé à l'œil : `document.scrollWidth` comparé à
 * `clientWidth`. Un décalage d'un seul pixel suffit à déclencher la barre de
 * défilement horizontale sur un téléphone, et il est invisible sur capture.
 *
 * Deux précautions rendent le verdict fiable :
 *
 *   - le parcours du builder VÉRIFIE le numéro d'étape affiché avant de mesurer.
 *     Sans cela, un clic manqué ferait mesurer six fois l'étape 1 en annonçant
 *     six étapes conformes ;
 *   - un élément qui dépasse à l'intérieur d'un conteneur défilant est écarté :
 *     le tableau des commandes est volontairement plus large que l'écran, dans
 *     un `overflow-x-auto` qui l'absorbe. Le compter serait un faux positif.
 *
 * Variables : BASE (défaut http://localhost:3000), ADMIN_TOKEN, PHOTOS (chemins
 * séparés par des virgules, pour franchir l'étape 4), SHOTS (dossier de
 * captures).
 */
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const WIDTHS = [320, 375, 414, 768];
const LOCALES = ['fr', 'en', 'es', 'de', 'it'];
const BASE = process.env.BASE ?? 'http://localhost:3000';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN ?? '';
const PHOTOS = (process.env.PHOTOS ?? '').split(',').filter(Boolean);
const SHOTS = process.env.SHOTS;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const CHROMIUM =
  process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

/** Évalué dans la page : liste les éléments qui débordent réellement. */
const findOffenders = () => {
  const doc = document.documentElement;
  const limit = doc.clientWidth;
  const out = [];
  for (const el of document.querySelectorAll('*')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    if (r.right <= limit + 0.5 && r.left >= -0.5) continue;

    let clipped = false;
    for (let p = el.parentElement; p; p = p.parentElement) {
      const ox = getComputedStyle(p).overflowX;
      if (ox === 'auto' || ox === 'scroll' || ox === 'hidden' || ox === 'clip') {
        clipped = true;
        break;
      }
    }
    if (clipped) continue;

    out.push({
      tag: el.tagName.toLowerCase(),
      cls: (el.getAttribute('class') || '').slice(0, 90),
      text: (el.textContent || '').trim().slice(0, 40),
      left: Math.round(r.left),
      right: Math.round(r.right),
    });
  }
  return { scrollWidth: doc.scrollWidth, clientWidth: limit, offenders: out.slice(0, 8) };
};

let failures = 0;

async function measure(page, label) {
  const r = await page.evaluate(findOffenders);
  const overflow = r.scrollWidth - r.clientWidth;
  const verdict = overflow > 0 ? `DÉBORDE +${overflow}px` : 'ok';
  console.log(`  ${label.padEnd(30)} ${r.scrollWidth}/${r.clientWidth}  ${verdict}`);
  if (overflow > 0) {
    failures++;
    for (const o of r.offenders) {
      console.log(`      <${o.tag} class="${o.cls}"> ${o.left}→${o.right} « ${o.text} »`);
    }
  }
  if (SHOTS) {
    await page.screenshot({ path: `${SHOTS}/${label.replace(/[^\w]+/g, '-')}.png`, fullPage: true });
  }
}

async function currentStep(page) {
  const label = await page.locator('ol[aria-label]').first().getAttribute('aria-label');
  const match = /(\d+)/.exec(label ?? '');
  return match ? Number(match[1]) : 0;
}

async function advance(page) {
  await page
    .getByRole('button', { name: /^(continuer|valider|c'est parfait.*)$/i })
    .first()
    .click();
  await page.waitForTimeout(600);
}

async function auditBuilder(page, width) {
  await page.goto(`${BASE}/fr/builder`, { waitUntil: 'networkidle' });

  for (let expected = 1; expected <= 6; expected++) {
    const step = await currentStep(page);
    if (step !== expected) {
      console.log(`  !! étape ${expected} attendue, ${step} affichée — parcours interrompu`);
      failures++;
      return;
    }
    await measure(page, `builder étape ${step} @${width}`);

    if (expected === 1 || expected === 2) {
      await page.locator('button[aria-pressed]').first().click();
      await advance(page);
    } else if (expected === 3) {
      const select = page.locator('select').first();
      if (await select.count()) await select.selectOption({ index: 3 });
      const inputs = page.locator('input[type="text"], input:not([type]):not([type=file])');
      if (await inputs.count()) {
        await inputs.nth(0).fill('BELLINGHAM');
        await inputs.nth(1).fill('10');
      }
      await advance(page);
    } else if (expected === 4) {
      if (PHOTOS.length === 0) {
        console.log('  (PHOTOS non fourni : étapes 5 et 6 non mesurées)');
        return;
      }
      await page.locator('input[type=file]').first().setInputFiles(PHOTOS);
      await page.waitForTimeout(2500);
      await advance(page);
    } else if (expected === 5) {
      await page.waitForTimeout(6000); // rendu Sharp côté serveur
      await measure(page, `builder étape 5 rendue @${width}`);
      await advance(page);
    }
  }
}

async function auditAdmin(page, width) {
  if (!ADMIN_TOKEN) return;

  await page.goto(`${BASE}/admin/login`, { waitUntil: 'networkidle' });
  await page.locator('input[type=password], input[type=text]').first().fill(ADMIN_TOKEN);
  await page.locator('button[type=submit]').first().click();
  await page.waitForTimeout(2000);

  for (const [label, url] of [
    ['admin tableau de bord', '/admin'],
    ['admin commandes', '/admin/orders'],
    ['admin analytics', '/admin/analytics'],
    ['admin réglages', '/admin/settings'],
  ]) {
    await page.goto(BASE + url, { waitUntil: 'networkidle' });
    if (page.url().includes('/admin/login')) {
      console.log(`  !! ${label} : session refusée (ADMIN_TOKEN ?)`);
      failures++;
      continue;
    }
    await measure(page, `${label} @${width}`);
  }
}

const browser = await chromium.launch({ executablePath: CHROMIUM });

for (const width of WIDTHS) {
  console.log(`\n=== ${width} px`);
  const context = await browser.newContext({ viewport: { width, height: 800 } });
  const page = await context.newPage();

  for (const locale of LOCALES) {
    for (const [label, url] of [
      [`accueil ${locale}`, `/${locale}`],
      [`maillot ${locale}`, `/${locale}/maillot/real-madrid-away`],
      [`confirmation ${locale}`, `/${locale}/checkout/confirmation`],
    ]) {
      await page.goto(BASE + url, { waitUntil: 'networkidle' });
      await measure(page, `${label} @${width}`);
    }
  }

  await auditBuilder(page, width);
  await auditAdmin(page, width);
  await context.close();
}

await browser.close();

if (failures > 0) {
  console.log(`\n${failures} mesure(s) en échec.`);
  process.exit(1);
}
console.log('\nAucun débordement.');
