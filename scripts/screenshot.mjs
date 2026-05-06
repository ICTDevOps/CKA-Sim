// Capture les screenshots de l'app pour les READMEs (EN et FR).
//
// Préreq :
//   1. `npm install --no-save playwright`
//   2. `npx playwright install chromium`        (ou défini PLAYWRIGHT_CHROMIUM)
//   3. `npm run build && PORT=3737 npm start`   (autre terminal)
//   4. `node scripts/screenshot.mjs`
//
// Variables d'environnement :
//   BASE_URL              : URL de l'app (défaut http://localhost:3737)
//   PLAYWRIGHT_CHROMIUM   : chemin absolu vers un binaire chromium custom
//
// Le script tourne deux fois — une fois en /en, une fois en /fr — et produit
// des PNG suffixés par locale dans public/screenshots/.
import { chromium } from "playwright";
import { mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const OUT_DIR = resolve("public/screenshots");
mkdirSync(OUT_DIR, { recursive: true });

const BASE = process.env.BASE_URL ?? "http://localhost:3737";

const questions = JSON.parse(
  readFileSync(resolve("src/data/questions/kubectl.json"), "utf8")
);
const byScenarioEn = new Map(
  questions.map((q) => [q.scenario.en, q])
);
const byScenarioFr = new Map(
  questions.map((q) => [q.scenario.fr, q])
);

const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM || undefined,
  args: ["--no-sandbox"]
});

async function shotPage(page, file) {
  await page.screenshot({ path: resolve(OUT_DIR, file), fullPage: false });
  console.log("✓", file);
}

async function captureLocale(locale) {
  const isEn = locale === "en";
  const promptAria = isEn ? "Command to run" : "Commande à exécuter";
  const skipBtn = isEn ? "Skip" : "Passer";
  const scoreHeading = isEn ? "Score" : "Score"; // identique
  const dashboardHeading = isEn ? "Dashboard" : "Dashboard";

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 2,
    reducedMotion: "reduce",
    colorScheme: "dark"
  });

  // 1. Home
  {
    const page = await context.newPage();
    await page.goto(`${BASE}/${locale}`, { waitUntil: "networkidle" });
    await page.waitForSelector("h1");
    await shotPage(page, `01-home.${locale}.png`);
    await page.close();
  }

  // 2 & 3. Session
  async function expectedForCurrent(page) {
    const article = page.locator("article");
    await article.waitFor({ state: "visible" });
    const scenario = (
      await article.locator("> p").first().innerText()
    ).trim();
    const map = isEn ? byScenarioEn : byScenarioFr;
    const q = map.get(scenario);
    if (!q) throw new Error(`Question inconnue : ${scenario.slice(0, 60)}…`);
    return q.challenge.expected;
  }

  {
    const page = await context.newPage();
    await page.goto(`${BASE}/${locale}/session`, {
      waitUntil: "networkidle"
    });
    await expectedForCurrent(page);
    await page.waitForTimeout(300);
    await shotPage(page, `02-session-question.${locale}.png`);

    const expected = await expectedForCurrent(page);
    await page.locator(`input[aria-label="${promptAria}"]`).fill(expected);
    await page.keyboard.press("Enter");
    await page.waitForSelector('[role="status"]');
    await page.waitForTimeout(300);
    await shotPage(page, `03-session-feedback.${locale}.png`);
    await page.close();
  }

  // 4. Score summary — single session.
  async function playSession(page, skipIndices = new Set([2, 5, 8])) {
    await page.goto(`${BASE}/${locale}/session`, {
      waitUntil: "networkidle"
    });
    for (let i = 0; i < 12; i++) {
      const onSummary = await page
        .locator(`h2:has-text('${scoreHeading}')`)
        .isVisible()
        .catch(() => false);
      if (onSummary) return;
      const article = page.locator("article");
      if (!(await article.isVisible().catch(() => false))) return;
      if (skipIndices.has(i)) {
        await page
          .getByRole("button", { name: skipBtn, exact: true })
          .click();
      } else {
        const expected = await expectedForCurrent(page);
        await page
          .locator(`input[aria-label="${promptAria}"]`)
          .fill(expected);
        await page.keyboard.press("Enter");
        await page.waitForSelector('[role="status"]');
        await page.waitForTimeout(1900);
      }
    }
    await page.waitForSelector(`h2:has-text('${scoreHeading}')`);
  }

  {
    const page = await context.newPage();
    await playSession(page);
    await page.waitForTimeout(300);
    await shotPage(page, `04-score-summary.${locale}.png`);
    await page.close();
  }

  // 5. Dashboard — drive 5 more sessions for a populated dashboard.
  {
    const page = await context.newPage();
    const skipPatterns = [
      new Set([1, 4]),
      new Set([0, 3, 7, 9]),
      new Set([2, 6]),
      new Set([1, 5, 8]),
      new Set([4])
    ];
    for (const skip of skipPatterns) {
      await playSession(page, skip);
      await page.waitForTimeout(400);
    }
    await page.goto(`${BASE}/${locale}/dashboard`, {
      waitUntil: "networkidle"
    });
    await page.waitForSelector(`h1:has-text('${dashboardHeading}')`);
    await page.waitForTimeout(400);
    await shotPage(page, `05-dashboard.${locale}.png`);
    await page.close();
  }

  await context.close();
}

await captureLocale("en");
await captureLocale("fr");

await browser.close();
console.log("Done.");
