/* Enregistre la vidéo de prise en main (FR et EN) : `npm run record:tour`.
 *
 * 1. construit et lance l'application en mode mémoire (ou utilise --url=… / --dev) ;
 * 2. rejoue le parcours de scripts/tour-script.ts dans Chromium (recordVideo 1440×900),
 *    avec sous-titres, compteur d'étapes et curseur injectés dans la page ;
 * 3. convertit en MP4 H.264 (ffmpeg, crf 28, ≤ 10 Mo), extrait le poster,
 *    écrit les durées dans src/components/home/tour-meta.json.
 *
 * Options : --only=fr|en  --url=http://localhost:3000  --dev  --keep-raw
 */
import type { Browser, Locator, Page } from '@playwright/test';
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { homedir, tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { INTRO, OUTRO, STEPS, seedOps, type TourCtx, type TourLocale } from './tour-script.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = join(ROOT, 'public');
const META = join(ROOT, 'src/components/home/tour-meta.json');
const W = 1440;
const H = 900;
const MAX_BYTES = 10 * 1024 * 1024;
const POSTER_AT = 4.5; // s : accueil affiché, premier sous-titre lisible
const CHROMIUM = '/opt/pw-browsers/chromium';

const arg = (name: string) => process.argv.find((a) => a === `--${name}` || a.startsWith(`--${name}=`))?.split('=')[1] ?? (process.argv.includes(`--${name}`) ? '' : undefined);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const log = (...a: unknown[]) => console.log('[tour]', ...a);

/* ───────────── Encodeur vidéo de Playwright ───────────── */

/** recordVideo a besoin du ffmpeg de Playwright ; s'il manque, on lui prête /usr/bin/ffmpeg
 *  via un dossier de navigateurs temporaire (rien n'est installé ni modifié). */
function ensurePlaywrightFfmpeg(scratch: string) {
  const req = createRequire(import.meta.url);
  const browsers = JSON.parse(readFileSync(join(dirname(req.resolve('playwright-core/package.json')), 'browsers.json'), 'utf8')) as { browsers: { name: string; revision: string }[] };
  const rev = browsers.browsers.find((b) => b.name === 'ffmpeg')?.revision;
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH || join(homedir(), '.cache/ms-playwright');
  if (!rev || existsSync(join(base, `ffmpeg-${rev}`, 'ffmpeg-linux'))) return;
  const system = '/usr/bin/ffmpeg';
  if (!existsSync(system)) throw new Error(`Playwright ffmpeg-${rev} missing and no ${system}`);
  const shim = join(scratch, 'pw-browsers');
  mkdirSync(join(shim, `ffmpeg-${rev}`), { recursive: true });
  symlinkSync(system, join(shim, `ffmpeg-${rev}`, 'ffmpeg-linux'));
  if (existsSync(base)) for (const e of readdirSync(base)) if (!existsSync(join(shim, e))) symlinkSync(join(base, e), join(shim, e));
  process.env.PLAYWRIGHT_BROWSERS_PATH = shim;
  log(`using ${system} for Playwright video (ffmpeg-${rev} not installed)`);
}

/* ───────────── Serveur ───────────── */

async function waitFor(url: string, ms = 180_000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try {
      const r = await fetch(url, { redirect: 'manual' });
      if (r.status < 500) return;
    } catch { /* pas encore prêt */ }
    await sleep(500);
  }
  throw new Error(`server not ready: ${url}`);
}

async function startServer(): Promise<{ base: string; stop(): void }> {
  const given = arg('url');
  if (given) return { base: given.replace(/\/$/, ''), stop() {} };
  const port = Number(process.env.TOUR_PORT ?? 3197);
  const inUse = await fetch(`http://localhost:${port}/`, { redirect: 'manual' }).then(() => true, () => false);
  if (inUse) throw new Error(`port ${port} is already in use: stop that server, set TOUR_PORT, or pass --url=…`);
  const env = { ...process.env, NEXT_PUBLIC_DATA_MODE: 'memory', NEXT_TELEMETRY_DISABLED: '1' };
  let child: ChildProcess;
  if (arg('dev') !== undefined) {
    child = spawn('npx', ['next', 'dev', '-p', String(port)], {
      cwd: ROOT, env: { ...env, NEXT_DIST_DIR: '.next-tour-dev', BOS_HIDE_DEV_INDICATOR: '1' }, stdio: 'inherit', detached: true,
    });
  } else {
    const prod = { ...env, BOS_ALLOW_MEMORY_BUILD: '1', NEXT_DIST_DIR: '.next-tour' };
    log('building a memory-mode production bundle (.next-tour)…');
    const b = spawnSync('npx', ['next', 'build'], { cwd: ROOT, env: prod, stdio: 'inherit' });
    if (b.status !== 0) throw new Error('next build failed');
    child = spawn('npx', ['next', 'start', '-p', String(port)], { cwd: ROOT, env: prod, stdio: 'inherit', detached: true });
  }
  const base = `http://localhost:${port}`;
  const stop = () => { try { process.kill(-child.pid!, 'SIGTERM'); } catch { /* déjà arrêté */ } };
  process.on('exit', stop);
  await waitFor(`${base}/login`);
  return { base, stop };
}

/* ───────────── Habillage injecté (sous-titres, curseur, cartons) ───────────── */

type TourApi = { caption(text: string, i: number, n: number): void; hideCaption(): void; slate(show: boolean, title?: string, sub?: string): void; raise(): void };

function installOverlay() {
  const css = `
  #tour-cap, #tour-cursor, #tour-slate, .tour-ring { margin: 0; border: 0; padding: 0; overflow: visible; background: transparent; color: #fff; pointer-events: none; }
  #tour-cap { inset: auto auto 30px 50%; transform: translate(-50%, 10px); max-width: 1100px; width: max-content; display: flex; align-items: center; gap: 16px;
    padding: 15px 26px 15px 16px; border-radius: 12px; background: #10203b; box-shadow: 0 12px 34px rgb(13 27 48 / .32), 0 0 0 1px rgb(255 255 255 / .06) inset;
    font: 500 21px/1.42 var(--font-inter), Inter, system-ui, sans-serif; letter-spacing: -.2px; opacity: 0; transition: opacity .32s ease, transform .32s ease; }
  #tour-cap.on { opacity: 1; transform: translate(-50%, 0); }
  #tour-cap .n { flex: none; padding: 4px 11px; border-radius: 999px; background: rgb(255 255 255 / .12); color: #b6c9e6; font-size: 15px; font-weight: 650; font-variant-numeric: tabular-nums; }
  #tour-cap .t { text-wrap: balance; }
  #tour-cursor { inset: 0 auto auto 0; width: 28px; height: 28px; transform: translate(720px, 450px); will-change: transform; }
  #tour-cursor svg { display: block; width: 28px; height: 28px; filter: drop-shadow(0 2px 3px rgb(13 27 48 / .35)); }
  .tour-ring { position: fixed; width: 44px; height: 44px; margin: -22px 0 0 -22px; border-radius: 50%; border: 3px solid #305edd; animation: tour-ring .5s ease-out forwards; }
  @keyframes tour-ring { from { transform: scale(.2); opacity: .9; } to { transform: scale(1.3); opacity: 0; } }
  #tour-slate { inset: 0; width: 100vw; height: 100vh; display: grid; place-items: center; text-align: center; isolation: isolate;
    background: linear-gradient(109deg, #0d1b30 5%, #10203b 63%, #13294d); font-family: var(--font-inter), Inter, system-ui, sans-serif; opacity: 1; transition: opacity .6s ease; }
  #tour-slate.off { opacity: 0; }
  #tour-slate img { position: absolute; right: 0; top: 0; height: 100%; width: 52%; object-fit: cover; z-index: -1; opacity: .9; -webkit-mask-image: linear-gradient(to right, transparent, #000 30%); mask-image: linear-gradient(to right, transparent, #000 30%); }
  #tour-slate .brand { display: inline-flex; align-items: center; gap: 12px; font-size: 40px; font-weight: 760; letter-spacing: -2px; }
  #tour-slate .brand svg { width: 46px; height: 44px; }
  #tour-slate h1 { margin: 26px 0 12px; font-size: 52px; font-weight: 600; letter-spacing: -1.8px; }
  #tour-slate p { margin: 0; font-size: 22px; color: #cfdaec; }`;
  const style = document.createElement('style');
  style.id = 'tour-style';
  style.textContent = css;
  document.head.appendChild(style);

  const mk = (id: string, html: string) => {
    const el = document.createElement('div');
    el.id = id;
    el.setAttribute('popover', 'manual');
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = html;
    document.body.appendChild(el);
    return el as HTMLElement & { showPopover(): void; hidePopover(): void };
  };
  const logo = '<svg viewBox="0 0 36 34"><path fill="#3e6cfa" d="M1 28 8 8h7L8 28zM12 28 21 3h7l-9 25zM23 28l6-16h7l-6 16z"/></svg>';
  const cap = mk('tour-cap', '<span class="n"></span><span class="t"></span>');
  const slate = mk('tour-slate', `<img src="/terrain.svg" alt=""><div><div class="brand">${logo}BOS</div><h1></h1><p></p></div>`);
  const cursor = mk('tour-cursor', '<svg viewBox="0 0 28 28"><path d="M5 3v19.5l5.3-5.1 3.4 7.6 3.5-1.5-3.3-7.4H21z" fill="#10203b" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>');
  const layers = [cap, cursor, slate];
  layers.forEach((l) => l.showPopover());

  let x = 720, y = 450;
  window.addEventListener('mousemove', (e) => { x = e.clientX; y = e.clientY; cursor.style.transform = `translate(${x - 5}px, ${y - 3}px)`; }, true);
  window.addEventListener('mousedown', () => {
    const r = document.createElement('div') as HTMLElement & { showPopover(): void };
    r.setAttribute('popover', 'manual');
    r.className = 'tour-ring';
    document.body.appendChild(r);
    r.style.left = `${x}px`;
    r.style.top = `${y}px`;
    r.showPopover();
    setTimeout(() => r.remove(), 600);
  }, true);

  const api: TourApi = {
    caption(text, i, n) {
      cap.querySelector('.n')!.textContent = `${i}/${n}`;
      cap.querySelector('.t')!.textContent = text;
      cap.classList.add('on');
    },
    hideCaption() { cap.classList.remove('on'); },
    slate(show, title, sub) {
      if (title != null) slate.querySelector('h1')!.textContent = title;
      if (sub != null) slate.querySelector('p')!.textContent = sub;
      slate.classList.toggle('off', !show);
      // pas de curseur sur les cartons d'ouverture et de fin
      cursor.style.visibility = show ? 'hidden' : 'visible';
    },
    // Un <dialog> modal passe au premier plan : on y remet sous-titres et curseur.
    raise() { [cap, cursor].forEach((l) => { l.hidePopover(); l.showPopover(); }); },
  };
  (window as unknown as { __tour: TourApi }).__tour = api;
}

/** Typographie française : espace insécable avant « : ; ! ? » et dans les guillemets. */
const typo = (locale: TourLocale, s: string) =>
  locale === 'fr' ? s.replace(/ ([:;!?»])/g, '\u00a0$1').replace(/« /g, '«\u00a0') : s;

/** Pilotage de l'habillage depuis Node. */
function overlay(page: Page) {
  return {
    caption: (text: string, i: number, n: number) =>
      page.evaluate(({ text, i, n }) => (window as unknown as { __tour: TourApi }).__tour.caption(text, i, n), { text, i, n }),
    hideCaption: () => page.evaluate(() => (window as unknown as { __tour: TourApi }).__tour.hideCaption()),
    slate: (show: boolean, title?: string, sub?: string) =>
      page.evaluate(({ show, title, sub }) => (window as unknown as { __tour: TourApi }).__tour.slate(show, title, sub), { show, title, sub }),
    raise: () => page.evaluate(() => (window as unknown as { __tour: TourApi }).__tour.raise()),
  };
}

/* ───────────── Parcours ───────────── */

type SeedWindow = { __bosRepo: Record<string, (...a: unknown[]) => Promise<unknown>> & { asMember(id: string): void } };

async function seed(page: Page, locale: TourLocale) {
  await page.waitForFunction(() => !!(window as unknown as { __bosRepo?: unknown }).__bosRepo);
  await page.evaluate(async (ops) => {
    const r = (window as unknown as SeedWindow).__bosRepo;
    const me = 'u-admin';
    const ids: Record<string, string> = {};
    for (const o of ops) {
      r.asMember(o.as ?? me);
      if (o.op === 'import') ids[o.key!] = (await r.importDeal(...o.args)) as string;
      else await r[o.op](o.ref ? ids[o.ref] ?? o.ref : undefined, ...o.args);
    }
    r.asMember(me);
  }, seedOps(locale));
}

function makeCtx(page: Page, locale: TourLocale): TourCtx {
  let mx = W / 2, my = H / 2;
  const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const settle = async () => {
    // attend la fin d'un défilement doux
    let last = -1;
    for (let i = 0; i < 40; i++) {
      const y = await page.evaluate(() => window.scrollY);
      if (y === last) return;
      last = y;
      await sleep(80);
    }
  };
  const scroll: TourCtx['scroll'] = async (target, block = 'center') => {
    if (typeof target === 'number') await page.evaluate((top) => window.scrollTo({ top, behavior: 'smooth' }), target);
    else {
      await target.waitFor({ state: 'visible' });
      await target.evaluate((el, b) => el.scrollIntoView({ behavior: 'smooth', block: b }), block);
    }
    await sleep(120);
    await settle();
  };
  const point = async (target: Locator, dx = 0, dy = 0) => {
    await target.waitFor({ state: 'visible' });
    let box = await target.boundingBox();
    const inDialog = await target.evaluate((el) => !!el.closest('dialog[open]'));
    if (box && !inDialog && (box.y < 70 || box.y + box.height > H - 130)) await scroll(target, 'center');
    // attend une position stable (défilement ou animation en cours)
    for (let i = 0; i < 20; i++) {
      await sleep(i ? 60 : 0);
      const b = await target.boundingBox();
      if (b && box && Math.abs(b.x - box.x) < 0.5 && Math.abs(b.y - box.y) < 0.5) break;
      box = b;
    }
    if (!box) throw new Error(`no box for ${target}`);
    return { x: Math.min(W - 8, Math.max(8, box.x + box.width / 2 + dx)), y: Math.min(H - 8, Math.max(8, box.y + box.height / 2 + dy)) };
  };
  const moveTo = async (x: number, y: number, ms: number) => {
    const x0 = mx, y0 = my, t0 = Date.now();
    for (;;) {
      const k = Math.min(1, (Date.now() - t0) / ms);
      const e = ease(k);
      await page.mouse.move(x0 + (x - x0) * e, y0 + (y - y0) * e);
      if (k >= 1) break;
      await sleep(14);
    }
    mx = x; my = y;
  };
  const glide: TourCtx['glide'] = async (target, opts = {}) => {
    const p = await point(target, opts.dx, opts.dy);
    await moveTo(p.x, p.y, opts.ms ?? 700);
  };
  return {
    page,
    locale,
    tr: (fr, en) => (locale === 'en' ? en : fr),
    glide,
    async click(target) {
      await glide(target, { ms: 650 });
      await sleep(120);
      await page.mouse.click(mx, my, { delay: 70 });
    },
    scroll,
    pause: async (ms) => { await sleep(ms); },
    raise: async () => { await overlay(page).raise(); },
  };
}

async function recordOne(browser: Browser, base: string, locale: TourLocale, rawDir: string) {
  const context = await browser.newContext({
    baseURL: base,
    viewport: { width: W, height: H },
    deviceScaleFactor: 1,
    locale: locale === 'en' ? 'en-GB' : 'fr-FR',
    timezoneId: 'Europe/Paris',
    colorScheme: 'light',
    reducedMotion: 'no-preference',
    permissions: ['clipboard-read', 'clipboard-write'],
    recordVideo: { dir: rawDir, size: { width: W, height: H } },
  });
  const videoStart = Date.now();
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`${m.text()} ${m.location().url}`); });

  // Préparation (coupée au montage) : connexion, langue, données, habillage.
  await page.goto('/login?as=admin');
  await page.waitForURL(/\/$/);
  await page.locator('[data-deal-card]').first().waitFor();
  if (locale === 'en') await page.locator('.lang select').selectOption('en');
  await seed(page, locale);
  await page.evaluate(installOverlay);
  const ui = overlay(page);
  await ui.slate(true, INTRO[locale].title, typo(locale, INTRO[locale].sub));
  await page.evaluate(() => (window as unknown as { __bosGo(p: string): void }).__bosGo('/dossiers'));
  await page.waitForURL(/\/dossiers$/);
  await sleep(1500);

  // Début du film : carton d'ouverture, puis l'accueil s'anime.
  const tourStart = Date.now();
  await sleep(2200);
  await page.evaluate(() => (window as unknown as { __bosGo(p: string): void }).__bosGo('/'));
  await page.waitForURL(/\/$/);
  await page.locator('[data-deal-card]').first().waitFor();
  await ui.slate(false);
  await sleep(700);

  const ctx = makeCtx(page, locale);
  const timings: { id: string; ms: number }[] = [];
  for (const [i, step] of STEPS.entries()) {
    const t0 = Date.now();
    await ui.hideCaption();
    await sleep(320);
    await ui.caption(typo(locale, step.caption[locale]), i + 1, STEPS.length);
    try {
      await step.run(ctx);
    } catch (e) {
      const shot = join(rawDir, `fail-${locale}-${step.id}.png`);
      await page.screenshot({ path: shot }).catch(() => {});
      await context.close().catch(() => {});
      throw new Error(`step ${step.id} failed (screenshot: ${shot}): ${(e as Error).message}`);
    }
    const left = step.ms - (Date.now() - t0);
    if (left > 0) await sleep(left);
    timings.push({ id: step.id, ms: Date.now() - t0 });
  }
  await ui.hideCaption();
  await ui.slate(true, OUTRO[locale].title, typo(locale, OUTRO[locale].sub));
  await sleep(2600);
  const tourEnd = Date.now();

  const video = page.video();
  await context.close();
  const raw = await video!.path();
  if (errors.length) log(`${locale}: page errors during recording:\n  ${errors.join('\n  ')}`);
  log(`${locale}: steps`, timings.map((t) => `${t.id} ${(t.ms / 1000).toFixed(1)}s`).join(', '));
  return { raw, offset: (tourStart - videoStart) / 1000 + 0.15, duration: (tourEnd - tourStart) / 1000 };
}

/* ───────────── Montage ───────────── */

function ffmpeg(args: string[]) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: 'inherit' });
  if (r.status !== 0) throw new Error(`ffmpeg failed: ${args.join(' ')}`);
}

function probeDuration(file: string): number {
  const r = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { encoding: 'utf8' });
  return Number(r.stdout.trim());
}

function encode(raw: string, out: string, offset: number, duration: number) {
  const tmp = `${out}.tmp.mp4`;
  for (let crf = 28; crf <= 40; crf += 2) {
    ffmpeg(['-ss', offset.toFixed(2), '-i', raw, '-t', duration.toFixed(2), '-an', '-r', '25',
      '-c:v', 'libx264', '-preset', 'slow', '-crf', String(crf), '-pix_fmt', 'yuv420p', '-movflags', '+faststart', tmp]);
    const size = statSync(tmp).size;
    log(`${out.split('/').pop()}: crf ${crf} → ${(size / 1024 / 1024).toFixed(2)} MB`);
    if (size <= MAX_BYTES) { renameSync(tmp, out); return; }
  }
  rmSync(tmp, { force: true });
  throw new Error(`${out} stays above 10 MB`);
}

async function main() {
  const only = arg('only') as TourLocale | undefined;
  const locales: TourLocale[] = only ? [only] : ['fr', 'en'];
  const rawDir = mkdtempSync(join(tmpdir(), 'bos-tour-'));
  ensurePlaywrightFfmpeg(rawDir);
  const { chromium } = await import('@playwright/test');
  const server = await startServer();
  const meta = existsSync(META) ? JSON.parse(readFileSync(META, 'utf8')) as Record<TourLocale, number> : { fr: 75, en: 75 };
  try {
    for (const locale of locales) {
      log(`recording ${locale}…`);
      // --lang : champs date au format de la langue (jj/mm/aaaa en français).
      const lang = locale === 'en' ? 'en-GB' : 'fr-FR';
      const browser = await chromium.launch({ ...(existsSync(CHROMIUM) ? { executablePath: CHROMIUM } : {}), args: [`--lang=${lang}`], env: { ...process.env, LANG: `${lang.replace('-', '_')}.UTF-8`, LANGUAGE: lang.replace('-', '_') } });
      const { raw, offset, duration } = await recordOne(browser, server.base, locale, rawDir).finally(() => browser.close());
      const out = join(PUBLIC, `tour-${locale}.mp4`);
      encode(raw, out, offset, duration);
      meta[locale] = Math.round(probeDuration(out));
      log(`${locale}: ${meta[locale]} s, ${(statSync(out).size / 1024 / 1024).toFixed(2)} MB`);
      if (locale === 'fr') ffmpeg(['-ss', String(POSTER_AT), '-i', out, '-frames:v', '1', '-q:v', '4', join(PUBLIC, 'tour-poster.jpg')]);
    }
    writeFileSync(META, JSON.stringify(meta) + '\n');
  } finally {
    server.stop();
    if (arg('keep-raw') === undefined) rmSync(rawDir, { recursive: true, force: true });
    else log(`raw videos kept in ${rawDir}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
