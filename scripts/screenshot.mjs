// Capture les screenshots de l'app pour le README.
//
// Préreq :
//   1. `npm install --no-save playwright`
//   2. `npx playwright install chromium`        (ou défini PLAYWRIGHT_CHROMIUM)
//   3. `npm run build && PORT=3737 npm start`   (dans un autre terminal)
//   4. `node scripts/screenshot.mjs`
//
// Variables d'environnement :
//   BASE_URL              : URL de l'app (défaut http://localhost:3737)
//   PLAYWRIGHT_CHROMIUM   : chemin absolu vers un binaire chromium custom
//
// Le script lit la base de questions, retrouve la question affichée par son
// énoncé, et tape la commande attendue. Cela donne une démo réaliste avec un
// vrai score à la fin.
import { chromium } from "playwright";
import { mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const OUT_DIR = resolve("public/screenshots");
mkdirSync(OUT_DIR, { recursive: true });

const BASE = process.env.BASE_URL ?? "http://localhost:3737";

const questions = JSON.parse(
  readFileSync(resolve("src/data/questions/kubectl.json"), "utf8")
);
const byScenario = new Map(questions.map((q) => [q.scenario, q]));

const browser = await chromium.launch({
  // Si non défini, playwright utilise son chromium bundled (téléchargé via
  // `npx playwright install chromium`).
  executablePath: process.env.PLAYWRIGHT_CHROMIUM || undefined,
  args: ["--no-sandbox"]
});
const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  deviceScaleFactor: 2,
  reducedMotion: "reduce",
  colorScheme: "dark"
});

async function shot(page, file) {
  await page.screenshot({ path: resolve(OUT_DIR, file), fullPage: false });
  console.log("✓", file);
}

// Récupère l'énoncé courant et retourne la commande attendue.
async function expectedForCurrent(page) {
  const article = page.locator("article");
  await article.waitFor({ state: "visible" });
  // L'énoncé est le seul <p> direct du <article> (pas dans un <header>).
  const scenario = (
    await article.locator("> p").first().innerText()
  ).trim();
  const q = byScenario.get(scenario);
  if (!q) throw new Error(`Question inconnue : ${scenario.slice(0, 60)}…`);
  return q.challenge.expected;
}

// 1. Home
{
  const page = await context.newPage();
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.waitForSelector("h1");
  await shot(page, "01-home.png");
  await page.close();
}

// 2 & 3. Session : énoncé + feedback (correct).
{
  const page = await context.newPage();
  await page.goto(`${BASE}/session`, { waitUntil: "networkidle" });
  await expectedForCurrent(page); // attend que l'article soit là
  await page.waitForTimeout(300);
  await shot(page, "02-session-question.png");

  // Tape la commande attendue (correcte) et capture le feedback OK.
  const expected = await expectedForCurrent(page);
  await page.locator('input[aria-label="Commande à exécuter"]').fill(expected);
  await page.keyboard.press("Enter");
  await page.waitForSelector('[role="status"]');
  await page.waitForTimeout(300);
  await shot(page, "03-session-feedback.png");
  await page.close();
}

// 4. Score summary : on enchaîne les 10 questions en répondant correctement
//    pour 7 d'entre elles, en sautant pour 3, ce qui donne un score "réaliste".
{
  const page = await context.newPage();
  await page.goto(`${BASE}/session`, { waitUntil: "networkidle" });

  // Plan : index des questions où on saute volontairement.
  const skipIndices = new Set([2, 5, 8]);

  for (let i = 0; i < 12; i++) {
    const onSummary = await page
      .locator("h2:has-text('Score')")
      .isVisible()
      .catch(() => false);
    if (onSummary) break;

    const article = page.locator("article");
    if (!(await article.isVisible().catch(() => false))) break;

    if (skipIndices.has(i)) {
      await page.getByRole("button", { name: "Passer" }).click();
    } else {
      const expected = await expectedForCurrent(page);
      await page
        .locator('input[aria-label="Commande à exécuter"]')
        .fill(expected);
      await page.keyboard.press("Enter");
      // Attend que le feedback s'affiche puis disparaisse (~1.8s par défaut
      // dans l'app, on attend un peu plus).
      await page.waitForSelector('[role="status"]');
      await page.waitForTimeout(1900);
    }
  }

  await page.waitForSelector("h2:has-text('Score')");
  await page.waitForTimeout(300);
  await shot(page, "04-score-summary.png");
  await page.close();
}

await browser.close();
console.log("Done.");
