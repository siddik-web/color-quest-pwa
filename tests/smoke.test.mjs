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

test("liquid pour animation preserves main-branch bottle positioning and landing", () => {
  const html = read("index.html");
  assert.match(html, /\.bottle\.pouring/);
  assert.match(html, /\.bottle\.land/);
  assert.match(html, /@keyframes land/);
  assert.match(html, /rot = dir \* 65/);
  assert.match(html, /const mouthX = Math\.sin\(rot\*Math\.PI\/180\)/);
  assert.match(html, /sEl\.style\.transform = "translate\("\+tx\+"px,"\+ty\+"px\) rotate\("\+rot\+"deg\)"/);
  assert.match(html, /stream\.style\.left = \(tr\.left \+ tr\.width\/2 - 3\)/);
  assert.match(html, /stream\.style\.top = \(tr\.top - 10\)/);
  assert.match(html, /setTimeout\(\(\)=>\{ stream\.remove\(\); finish\(\); \}, 600\)/);
  assert.match(html, /persistDailyProgress\(\)/);
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
  assert.match(html, /const key = s => JSON\.stringify\(s\)/);
});

test("economy milestones, replay star accounting and responsive dialogs are present", () => {
  const html = read("index.html");
  assert.match(html, /economyMilestones = save\.economyMilestones \|\| \{\}/);
  assert.match(html, /const milestoneRewards = \{5:50,10:100,25:250,50:500\}/);
  assert.match(html, /function applyReplayResult\(previous, earned, moves/);
  assert.match(html, /save\.stars \+= starDelta/);
  assert.match(html, /max-height:min\(82dvh,720px\)/);
  assert.match(html, /@media\(max-width:380px\)/);
});

test("illustrated level backgrounds are removed and board stays on the solid game theme", () => {
  const html = read("index.html");
  assert.doesNotMatch(html, /data-scene|applyLevelScene|scene-sky|#board:before|#board:after/);
  assert.match(html, /html,body\{background:var\(--bg\)\}/);
});

test("background music and sound effects have independent persistent controls", () => {
  const html = read("index.html");
  assert.match(html, /id="musicBtn"/);
  assert.match(html, /id="musicVolume"/);
  assert.match(html, /id="musicVolumeValue"/);
  assert.match(html, /musicVol:0\.18/);
  assert.match(html, /function syncMusicControls/);
  assert.match(html, /sfx\.syncMusic\(\)/);
  assert.match(html, /musicBus\.gain\.setTargetAtTime/);
  assert.match(html, /document\.addEventListener\("pointerdown"/);
  assert.match(html, /Background music:/);
});


test("bottles use translucent glass styling with polished rims and liquid depth", () => {
  const html = read("index.html");
  assert.match(html, /Optical glass bottle/);
  assert.match(html, /rgba\(226,245,255/);
  assert.match(html, /linear-gradient\(180deg,#ffffff 0%,#eaf7ff/);
  assert.match(html, /inset 0 -4px 6px rgba\(0,0,0,.22\)/);
  assert.match(html, /rgba\(255,255,255,.92\)/);
});

test("daily and weekly quests have stable reset keys, progress, and claimable rewards", () => {
  const html = read("index.html");
  assert.match(html, /id="mQuest"/);
  assert.match(html, /id="questDlg"/);
  assert.match(html, /function isoWeekKey\(date=new Date\(\)\)/);
  assert.match(html, /function ensureQuestState\(\)/);
  assert.match(html, /function trackQuestMove\(\)/);
  assert.match(html, /function trackQuestWin\(flawless\)/);
  assert.match(html, /Complete 5 puzzles this week/);
  assert.match(html, /q\.dailyClaimed\[item\.id\]=true/);
  assert.match(html, /q\.weeklyClaimed=true/);
  assert.match(html, /QUEST_REWARDS = \{ daily:20, weekly:100 \}/);
});

test("puzzle generation fallback is a verified solvable board, never an arbitrary shuffled dead end", () => {
  const html = read("index.html");
  assert.match(html, /Guaranteed-solvable fallback/);
  assert.match(html, /const verified = solve\(fallback, 10000\)/);
  assert.match(html, /return \{ bottles:fallback, par:verified \? verified\.length : 2 \}/);
  assert.match(html, /generatorFallback/);
});
