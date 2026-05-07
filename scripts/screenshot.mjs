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
import Database from "better-sqlite3";
import * as sqliteVec from "sqlite-vec";
import { mkdirSync, readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function seedDemoSources(userId) {
  // Create the kb-user.db ourselves with the local-bge-small schema if the
  // server hasn't done it yet. The shape must match
  // src/lib/kb/user-db.ts::initSchema.
  mkdirSync(resolve("data"), { recursive: true });
  const path = resolve("data/kb-user.db");
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  sqliteVec.load(db);
  db.exec(`
    CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);
    CREATE TABLE IF NOT EXISTS sources (
      id              TEXT PRIMARY KEY,
      url             TEXT NOT NULL,
      display_name    TEXT,
      added_by        TEXT,
      added_at        INTEGER NOT NULL,
      last_fetched_at INTEGER,
      last_etag       TEXT,
      last_modified   TEXT,
      content_hash    TEXT,
      status          TEXT NOT NULL DEFAULT 'pending',
      error           TEXT,
      chunk_count     INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS chunks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_id      TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
      source_url     TEXT NOT NULL,
      source_section TEXT NOT NULL,
      content        TEXT NOT NULL
    );
    CREATE VIRTUAL TABLE IF NOT EXISTS chunks_vec USING vec0(embedding float[384]);
  `);
  db.exec("DELETE FROM sources;");
  const insert = db.prepare(
    `INSERT INTO sources
      (id, url, display_name, added_by, added_at, last_fetched_at,
       status, chunk_count)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const now = Date.now();
  const fixtures = [
    {
      id: "demo-1",
      url: "https://kubernetes.io/docs/reference/kubectl/cheatsheet/",
      name: "kubectl cheatsheet",
      status: "ok",
      chunks: 14,
      fetched: now - 6 * 60 * 60 * 1000
    },
    {
      id: "demo-2",
      url: "https://kubernetes.io/docs/concepts/security/rbac-good-practices/",
      name: null,
      status: "ok",
      chunks: 9,
      fetched: now - 26 * 60 * 60 * 1000
    },
    {
      id: "demo-3",
      url: "https://example.test/missing-page",
      name: "Demo error page",
      status: "error",
      chunks: 0,
      fetched: now - 2 * 60 * 1000,
      error: "HTTP 404 fetching https://example.test/missing-page"
    }
  ];
  for (const f of fixtures) {
    insert.run(
      f.id,
      f.url,
      f.name,
      userId,
      now,
      f.fetched,
      f.status,
      f.chunks
    );
    if (f.error) {
      db.prepare("UPDATE sources SET error = ? WHERE id = ?").run(
        f.error,
        f.id
      );
    }
  }
  db.close();
}

const OUT_DIR = resolve("public/screenshots");
mkdirSync(OUT_DIR, { recursive: true });

const BASE = process.env.BASE_URL ?? "http://localhost:3737";

const kubectlQuestions = JSON.parse(
  readFileSync(resolve("src/data/questions/kubectl.json"), "utf8")
);
const shellQuestions = JSON.parse(
  readFileSync(resolve("src/data/questions/shell.json"), "utf8")
);
// command-type questions only; vi questions are auto-skipped during the
// "play a session" loop (the script can't simulate vim keystrokes).
const commandQuestions = [...kubectlQuestions, ...shellQuestions].filter(
  (q) => q.challenge.type === "command"
);
const byScenarioEn = new Map(commandQuestions.map((q) => [q.scenario.en, q]));
const byScenarioFr = new Map(commandQuestions.map((q) => [q.scenario.fr, q]));

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

  // 2 & 3. Session — returns null for vi questions (no command to type).
  async function expectedForCurrent(page) {
    const article = page.locator("article");
    await article.waitFor({ state: "visible" });
    const scenario = (
      await article.locator("> p").first().innerText()
    ).trim();
    const map = isEn ? byScenarioEn : byScenarioFr;
    const q = map.get(scenario);
    return q ? q.challenge.expected : null;
  }

  async function isViQuestion(page) {
    return page
      .locator(".cm-editor")
      .isVisible()
      .catch(() => false);
  }

  {
    const page = await context.newPage();
    await page.goto(`${BASE}/${locale}/session`, {
      waitUntil: "networkidle"
    });
    // Skip until we land on a non-vi question (the "question" + "feedback"
    // screenshots use the command Prompt; vi gets its own dedicated capture).
    for (let i = 0; i < 30; i++) {
      const onVi = await isViQuestion(page);
      const hasExpected = await expectedForCurrent(page);
      if (!onVi && hasExpected) break;
      await page.getByRole("button", { name: skipBtn, exact: true }).click();
      await page.waitForTimeout(120);
    }
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

  // 4. Score summary — single session. vi questions are auto-skipped
  //    (the script can't simulate vim sequences).
  async function playSession(page, skipIndices = new Set([2, 5, 8])) {
    await page.goto(`${BASE}/${locale}/session`, {
      waitUntil: "networkidle"
    });
    for (let i = 0; i < 18; i++) {
      const onSummary = await page
        .locator(`h2:has-text('${scoreHeading}')`)
        .isVisible()
        .catch(() => false);
      if (onSummary) return;
      const article = page.locator("article");
      if (!(await article.isVisible().catch(() => false))) return;
      const expected = await expectedForCurrent(page);
      const vi = await isViQuestion(page);
      if (vi || !expected || skipIndices.has(i)) {
        await page
          .getByRole("button", { name: skipBtn, exact: true })
          .click();
        await page.waitForTimeout(120);
      } else {
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

async function captureSettings(locale) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 1900 },
    deviceScaleFactor: 2,
    reducedMotion: "reduce",
    colorScheme: "dark"
  });
  // 1. Default state
  {
    const page = await context.newPage();
    await page.goto(`${BASE}/${locale}/settings`, {
      waitUntil: "networkidle"
    });
    await page.waitForSelector("h1");
    // Seed a few demo sources directly via the DB. We attribute them to
    // the real cookie uid so the route's added_by filter returns them.
    const cookies = await context.cookies();
    const uid = cookies.find((c) => c.name === "cka-sim-uid")?.value;
    if (uid) seedDemoSources(uid);
    await page.reload({ waitUntil: "networkidle" });

    // Switch to OpenRouter to display the API key + model fields, then enable
    // the tutor and switch the embedding provider for a richer screenshot.
    // The Anthropic radio is selected by default — fill its API key field
    // (each interaction triggers an autosave + setState round-trip, so we
    // click and wait rather than using .check()).
    await page.waitForSelector("input#anthropic-key");
    await page
      .locator("input#anthropic-key")
      .fill("sk-ant-demo-screenshot-key");
    await page
      .getByRole("button", {
        name: locale === "en" ? "Save changes" : "Sauvegarder"
      })
      .first()
      .click();
    await page.waitForTimeout(700);
    // Enable AI tutor toggle.
    await page
      .locator("label")
      .filter({
        hasText:
          locale === "en" ? "Enable the AI tutor" : "Activer le tuteur IA"
      })
      .locator('input[type="checkbox"]')
      .first()
      .click();
    await page.waitForTimeout(500);
    // Pick the Opus model for visual distinctiveness.
    await page.locator("select#anthropic-key-model").selectOption("claude-opus-4-7");
    await page.waitForTimeout(500);
    // Switch embedding to OpenRouter 3-small for visual variety.
    await page
      .locator(
        'input[type="radio"][name="embeddingProvider"][value="openrouter-text-embedding-3-small"]'
      )
      .first()
      .click();
    await page.waitForTimeout(700);
    await shotPage(page, `06-settings.${locale}.png`);
    await page.close();
  }
  await context.close();
}

async function captureVi(locale) {
  const skipBtn = locale === "en" ? "Skip" : "Passer";
  const scoreHeading = "Score";
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    deviceScaleFactor: 2,
    reducedMotion: "reduce",
    colorScheme: "dark"
  });
  const page = await context.newPage();

  // Retry up to 5 fresh sessions until we land on a vi question.
  let found = false;
  for (let attempt = 0; attempt < 5 && !found; attempt++) {
    await page.goto(`${BASE}/${locale}/session`, { waitUntil: "networkidle" });
    for (let i = 0; i < 12; i++) {
      const onVi = await page
        .locator(".cm-editor")
        .isVisible()
        .catch(() => false);
      if (onVi) {
        found = true;
        break;
      }
      const onSummary = await page
        .locator(`h2:has-text('${scoreHeading}')`)
        .isVisible()
        .catch(() => false);
      if (onSummary) break;
      const hasArticle = await page
        .locator("article")
        .isVisible()
        .catch(() => false);
      if (!hasArticle) break;
      await page.getByRole("button", { name: skipBtn, exact: true }).click();
      await page.waitForTimeout(120);
    }
  }

  if (!found) {
    console.warn(`[screenshot] could not land on a vi question in ${locale}`);
    await page.close();
    await context.close();
    return;
  }

  await page.locator(".cm-content").click();
  await page.waitForTimeout(400);
  await shotPage(page, `07-vi-editor.${locale}.png`);
  await page.close();
  await context.close();
}

await captureLocale("en");
await captureLocale("fr");
await captureSettings("en");
await captureSettings("fr");
await captureVi("en");
await captureVi("fr");

await browser.close();
console.log("Done.");
