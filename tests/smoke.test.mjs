import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import vm from "node:vm";

const read = (path) => readFileSync(path, "utf8");

test("inline game JavaScript parses without syntax errors", () => {
  const html = read("index.html");
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
    .map((match) => match[1].trim())
    .filter(Boolean);

  assert.ok(scripts.length > 0, "expected at least one inline game script");
  scripts.forEach((source, index) => {
    assert.doesNotThrow(() => new vm.Script(source, { filename: "index-inline-" + index + ".js" }));
  });
});

test("all referenced custom SVG assets exist", () => {
  const html = read("index.html");
  const references = [...html.matchAll(/(?:src|href)=["'](assets\/[^"']+)["']/g)]
    .map((match) => match[1]);

  assert.ok(references.length > 0, "expected HTML to reference custom artwork");
  references.forEach((path) => assert.ok(existsSync(path), "missing HTML asset: " + path));
});

test("every local service-worker precache entry exists", () => {
  const worker = read("sw.js");
  const entries = [...worker.matchAll(/["']\.\/([^"'?#]+)["']/g)]
    .map((match) => match[1])
    .filter((path) => path !== "");

  assert.ok(entries.includes("index.html"), "index.html must be precached");
  entries.forEach((path) => assert.ok(existsSync(path), "missing precache asset: " + path));
});

test("native web copy includes the complete assets directory", () => {
  const copyScript = read("scripts/copy-web.mjs");
  assert.match(copyScript, /"assets"/, "Capacitor web copy must include assets/");
});

test("PWA manifest is valid and declares required icons", () => {
  const manifest = JSON.parse(read("manifest.webmanifest"));
  assert.equal(manifest.display, "standalone");
  assert.ok(manifest.icons.some((icon) => icon.sizes === "192x192"));
  assert.ok(manifest.icons.some((icon) => icon.sizes === "512x512"));
});

test("game controls retain unique HTML IDs", () => {
  const html = read("index.html");
  const ids = [...html.matchAll(/\bid=["']([^"']+)["']/g)].map((match) => match[1]);
  assert.equal(ids.length, new Set(ids).size, "duplicate id attributes found");
});

test("daily challenge progress is persisted and restored after reload", () => {
  const html = read("index.html");
  assert.match(html, /function persistDailyProgress\(\)/);
  assert.match(html, /function restoreDailyProgress\(\)/);
  assert.match(html, /history:history\.map/);
  assert.match(html, /const resumed = restoreDailyProgress\(\)/);
  assert.match(html, /clearDailyProgress\(\)/);
});

test("daily challenge journey tracker is present and uses saved results", () => {
  const html = read("index.html");
  assert.match(html, /id="journeySummary"/);
  assert.match(html, /id="journeyPath"/);
  assert.match(html, /function renderDailyJourney\(\)/);
  assert.match(html, /save\.won\[k\]/);
  assert.match(html, /save\.streak/);
});

test("liquid pour animation includes source tilt, stream and receiving feedback", () => {
  const html = read("index.html");
  assert.match(html, /\.bottle\.pouring/);
  assert.match(html, /\.bottle\.receiving/);
  assert.match(html, /@keyframes streamShimmer/);
  assert.match(html, /stream\.style\.setProperty\("--liquid"/);
  assert.match(html, /stream\.remove\(\);/);
});

test("endless progression has explicit difficulty tiers and color milestones", () => {
  const html = read("index.html");
  assert.match(html, /function levelColorCount\(level\)/);
  assert.match(html, /function difficultyForLevel\(level\)/);
  assert.match(html, /Level " \+ lv \+ " · " \+ difficultyForLevel\(lv\)/);
  assert.match(html, /levelColorCount,\s*difficultyForLevel,\s*generate,\s*isSolved,\s*solve/);
});

test("level map and persistent unlock data are wired into the game", () => {
  const html = read("index.html");
  assert.match(html, /id="levelMapBtn"/);
  assert.match(html, /id="levelDlg"/);
  assert.match(html, /id="levelGrid"/);
  assert.match(html, /function renderLevelMap\(\)/);
  assert.match(html, /save\.levelResults\[String\(completedLevel\)\]/);
  assert.match(html, /tile\.disabled=!unlocked/);
});

test("first-time tutorial is accessible, skippable and persisted", () => {
  const html = read("index.html");
  assert.match(html, /id="tutorialDlg"/);
  assert.match(html, /const TUTORIAL = \[/);
  assert.match(html, /function renderTutorial\(\)/);
  assert.match(html, /function openTutorial\(\)/);
  assert.match(html, /save\.tutorialSeen=true/);
  assert.match(html, /id="howToBtn"/);
});

test("solver keeps bottle indexes stable while tracking visited states", () => {
  const html = read("index.html");
  assert.ok(html.includes('const key = s => s.map(b=>b.join("")).join("|");'));
});

test("economy milestones, replay star accounting and responsive dialogs are present", () => {
  const html = read("index.html");
  assert.match(html, /economyMilestones = save\.economyMilestones \|\| \{\}/);
  assert.match(html, /const milestoneRewards = \{5:50,10:100,25:250,50:500\}/);
  assert.match(html, /function applyReplayResult\(previous, earned\)/);
  assert.match(html, /save\.stars \+= starDelta/);
  assert.match(html, /max-height:min\(82dvh,720px\)/);
  assert.match(html, /@media\(max-width:380px\)/);
});
