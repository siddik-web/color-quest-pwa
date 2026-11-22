import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.clear();
    const d = new Date();
    const today = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    localStorage.setItem("cq.save", JSON.stringify({ dr: { last: today, day: 1 }, tutorialSeen: true }));
  });
  await page.reload();
  await expect(page.locator(".bottle").first()).toBeVisible();
});

test("daily puzzle loads with interactive bottles and no runtime errors", async ({ page }) => {
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.reload();
  await expect(page).toHaveTitle("Color Quest");
  await expect(page.locator("#mDaily")).toHaveClass(/on/);
  const bottleCount = await page.locator("#board .bottle").count();
  expect(bottleCount).toBeGreaterThanOrEqual(6);
  expect(bottleCount).toBeLessThanOrEqual(11);
  await expect(page.locator("#moves")).toContainText("Moves 0");
  expect(errors).toEqual([]);
});

test("calendar shows a seven-day daily challenge journey", async ({ page }) => {
  await page.locator("#mCal").click();
  await expect(page.locator("#calDlg")).toBeVisible();
  await expect(page.locator("#journeyPath .journey-day")).toHaveCount(7);
  await expect(page.locator("#journeyPath .today")).toHaveCount(1);
  await expect(page.locator("#journeySummary")).toContainText("daily challenges completed");
  await page.locator("#calClose").click();
});

test("daily board and undo history survive refresh and mode switching", async ({ page }) => {
  const initial = await page.evaluate(() => window.__cq.state.map(b => b.slice()));
  const move = await page.evaluate(() => {
    const s = window.__cq.state;
    for (let from = 0; from < s.length; from++) {
      if (!s[from].length) continue;
      const color = s[from][s[from].length - 1];
      for (let to = 0; to < s.length; to++) {
        if (from === to || s[to].length >= 4) continue;
        if (!s[to].length || s[to][s[to].length - 1] === color) return [from, to];
      }
    }
    return null;
  });
  expect(move).not.toBeNull();
  await page.locator("#board .bottle").nth(move[0]).click();
  await page.locator("#board .bottle").nth(move[1]).click();
  await expect(page.locator("#moves")).toContainText("Moves 1");
  await expect.poll(() => page.evaluate(() => window.__cq.state.map(b => b.slice()))).not.toEqual(initial);

  const afterMove = await page.evaluate(() => window.__cq.state.map(b => b.slice()));
  await page.reload();
  await expect(page.locator("#moves")).toContainText("Moves 1");
  expect(await page.evaluate(() => window.__cq.state.map(b => b.slice()))).toEqual(afterMove);

  await page.locator("#mEndless").click();
  await expect(page.locator("#title")).toContainText("Level");
  await page.locator("#mDaily").click();
  await expect(page.locator("#moves")).toContainText("Moves 1");
  expect(await page.evaluate(() => window.__cq.state.map(b => b.slice()))).toEqual(afterMove);

  await page.locator("#undo").click();
  await expect(page.locator("#moves")).toContainText("Moves 0");
  expect(await page.evaluate(() => window.__cq.state.map(b => b.slice()))).toEqual(initial);
});

test("mobile layout has no horizontal overflow and keeps game actions visible", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.reload();
  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    footerBottom: document.querySelector("footer").getBoundingClientRect().bottom,
    viewportHeight: window.innerHeight
  }));
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth);
  expect(metrics.footerBottom).toBeLessThanOrEqual(metrics.viewportHeight + 1);
  await expect(page.locator("#undo")).toBeVisible();
  await expect(page.locator("#hint")).toBeVisible();
});
test("pour animation tilts the source, streams liquid, and completes the move", async ({ page }) => {
  const move = await page.evaluate(() => {
    const s = window.__cq.state;
    for (let from = 0; from < s.length; from++) {
      if (!s[from].length) continue;
      const color = s[from][s[from].length - 1];
      for (let to = 0; to < s.length; to++) {
        if (from === to || s[to].length >= 4) continue;
        if (!s[to].length || s[to][s[to].length - 1] === color) return [from, to];
      }
    }
    return null;
  });
  expect(move).not.toBeNull();
  await page.locator("#board .bottle").nth(move[0]).click();
  await page.locator("#board .bottle").nth(move[1]).click();
  await expect(page.locator(".bottle.pouring")).toHaveCount(1);
  await expect(page.locator(".stream")).toHaveCount(1, { timeout: 2000 });
  await expect(page.locator(".bottle.receiving")).toHaveCount(1);
  await expect(page.locator("#moves")).toContainText("Moves 1", { timeout: 3000 });
  await expect(page.locator(".stream")).toHaveCount(0);
  await expect(page.locator(".bottle.pouring")).toHaveCount(0);
});

test("endless progression exposes balanced difficulty tiers and color milestones", async ({ page }) => {
  const milestones = [
    { level: 1, colors: 4, tier: "Easy" },
    { level: 4, colors: 5, tier: "Easy" },
    { level: 7, colors: 6, tier: "Medium" },
    { level: 13, colors: 8, tier: "Hard" },
    { level: 19, colors: 10, tier: "Expert" },
    { level: 22, colors: 11, tier: "Expert" }
  ];
  for (const milestone of milestones) {
    const result = await page.evaluate(({ level }) => ({
      colors: window.__cq.levelColorCount(level),
      tier: window.__cq.difficultyForLevel(level)
    }), milestone);
    expect(result).toEqual({ colors: milestone.colors, tier: milestone.tier });
  }
});

test("generated starting puzzle is solvable and has a valid par score", async ({ page }) => {
  const result = await page.evaluate(() => {
    const p = window.__cq.puzzle;
    const solution = window.__cq.solve(p.bottles, 60000);
    return {
      par: p.par,
      solutionLength: solution ? solution.length : 0,
      solved: solution ? window.__cq.isSolved((() => {
        const state = p.bottles.map(b => b.slice());
        for (const [from, to] of solution) {
          if (!window.__cq.pour(state, from, to)) return state;
        }
        return state;
      })()) : false
    };
  });
  expect(result.par).toBeGreaterThan(0);
  expect(result.solutionLength).toBeGreaterThan(0);
  expect(result.solved).toBe(true);
});

test("level map shows unlocked progress and prevents locked-level selection", async ({ page }) => {
  await page.locator("#mEndless").click();
  await expect(page.locator("#levelMapBtn")).toBeVisible();
  await page.locator("#levelMapBtn").click();
  await expect(page.locator("#levelDlg")).toBeVisible();
  await expect(page.locator("#levelGrid .level-tile")).toHaveCount(30);
  await expect(page.locator("#levelGrid .level-tile:not(:disabled)")).toHaveCount(1);
  await expect(page.locator("#levelGrid .level-tile").nth(1)).toBeDisabled();
  await page.locator("#levelGrid .level-tile").first().click();
  await expect(page.locator("#levelDlg")).toBeHidden();
  await expect(page.locator("#title")).toContainText("Level 1");
  expect(await page.evaluate(() => window.__cq.selectedLevel)).toBe(1);
});

test("level map reflects saved unlocks and completed stars", async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem("cq.save", JSON.stringify({
      level: 4,
      levelResults: {
        "1": { stars: 3, moves: 12, bestMoves: 12 },
        "2": { stars: 2, moves: 16, bestMoves: 16 }
      },
      dr: { last: new Date().toISOString().slice(0, 10), day: 1 }
    }));
  });
  await page.reload();
  await page.locator("#mEndless").click();
  await page.locator("#levelMapBtn").click();
  await expect(page.locator("#levelGrid .level-tile:not(:disabled)")).toHaveCount(4);
  await expect(page.locator("#levelGrid .level-tile.completed")).toHaveCount(2);
  await expect(page.locator("#levelSummary")).toContainText("Level 4 is unlocked");
  await page.locator("#levelGrid .level-tile").nth(2).click();
  await expect(page.locator("#title")).toContainText("Level 3");
  expect(await page.evaluate(() => window.__cq.selectedLevel)).toBe(3);
});

test("endless level map fits a narrow mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.locator("#mEndless").click();
  await page.locator("#levelMapBtn").click();
  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    dialogWidth: document.querySelector("#levelDlg").getBoundingClientRect().width
  }));
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth);
  expect(metrics.dialogWidth).toBeLessThanOrEqual(metrics.clientWidth);
  await expect(page.locator("#levelGrid .level-tile").first()).toBeVisible();
});

test("first-time player sees the tutorial and can complete all steps", async ({ page }) => {
  await page.evaluate(() => {
    const save = JSON.parse(localStorage.getItem("cq.save"));
    delete save.tutorialSeen;
    localStorage.setItem("cq.save", JSON.stringify(save));
  });
  await page.reload();
  await expect(page.locator("#tutorialDlg")).toBeVisible();
  await expect(page.locator("#tutorialTitle")).toContainText("Welcome to Color Quest");
  await expect(page.locator("#tutorialProgress i")).toHaveCount(5);
  for (let step = 0; step < 4; step++) {
    await page.locator("#tutorialNext").click();
  }
  await expect(page.locator("#tutorialTitle")).toContainText("Earn rewards");
  await page.locator("#tutorialNext").click();
  await expect(page.locator("#tutorialDlg")).toBeHidden();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("cq.save")).tutorialSeen)).toBe(true);
});

test("tutorial can be reopened from settings and skipped", async ({ page }) => {
  await page.locator("#mSet").click();
  await page.locator("#howToBtn").click();
  await expect(page.locator("#tutorialDlg")).toBeVisible();
  await page.locator("#tutorialSkip").click();
  await expect(page.locator("#tutorialDlg")).toBeHidden();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("cq.save")).tutorialSeen)).toBe(true);
});

test("replaying a level only credits newly earned stars and improves best moves", async ({ page }) => {
  const result = await page.evaluate(() => {
    const record = { stars: 1, moves: 20, bestMoves: 20 };
    const firstDelta = window.__cq.applyReplayResult(record, 3, 15);
    const secondDelta = window.__cq.applyReplayResult(record, 2, 18);
    return { firstDelta, secondDelta, stars: record.stars, moves: record.moves, bestMoves: record.bestMoves };
  });
  expect(result).toEqual({ firstDelta: 2, secondDelta: 0, stars: 3, moves: 18, bestMoves: 15 });
});

test("dialogs remain within a small mobile viewport and scroll internally", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.locator("#mEndless").click();
  await page.locator("#levelMapBtn").click();
  const box = await page.locator("#levelDlg").boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(320);
  expect(box.height).toBeLessThanOrEqual(640);
  await expect(page.locator("#levelGrid .level-tile").first()).toBeVisible();
});


test("game remains free of horizontal overflow across phone, tablet and desktop widths", async ({ page }) => {
  for (const width of [320, 375, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.reload();
    const metrics = await page.evaluate(() => ({
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
      appWidth: document.querySelector("#app").getBoundingClientRect().width
    }));
    expect(metrics.documentWidth, `horizontal overflow at ${width}px`).toBeLessThanOrEqual(metrics.viewportWidth);
    expect(metrics.appWidth).toBeLessThanOrEqual(width);
  }
});

test("reduced-motion preference disables game transition animations", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  const move = await page.evaluate(() => {
    const state = window.__cq.state;
    for (let from = 0; from < state.length; from++) {
      if (!state[from].length) continue;
      for (let to = 0; to < state.length; to++) {
        if (from !== to && state[to].length < 4 &&
          (!state[to].length || state[to][state[to].length - 1] === state[from][state[from].length - 1])) return [from, to];
      }
    }
    return null;
  });
  expect(move).not.toBeNull();
  await page.locator("#board .bottle").nth(move[0]).click();
  await page.locator("#board .bottle").nth(move[1]).click();
  await expect(page.locator("#moves")).toContainText("Moves 1");
  expect(await page.locator(".stream").count()).toBe(0);
  expect(await page.locator(".bottle.pouring").count()).toBe(0);
});

test("primary navigation and dialogs run without uncaught JavaScript errors", async ({ page }) => {
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  for (const [nav, dialog, close] of [
    ["#mCal", "#calDlg", "#calClose"],
    ["#mAch", "#achDlg", "#achClose"],
    ["#mShop", "#shopDlg", "#shopClose"],
    ["#mSet", "#setDlg", "#setClose"]
  ]) {
    await page.locator(nav).click();
    await expect(page.locator(dialog)).toBeVisible();
    await page.locator(close).click();
    await expect(page.locator(dialog)).toBeHidden();
  }
  expect(errors).toEqual([]);
});

test("interactive controls expose visible keyboard focus", async ({ page }) => {
  await page.keyboard.press("Tab");
  const focus = await page.evaluate(() => ({
    tag: document.activeElement?.tagName,
    outlineStyle: getComputedStyle(document.activeElement).outlineStyle,
    outlineWidth: getComputedStyle(document.activeElement).outlineWidth
  }));
  expect(focus.tag).toBe("BUTTON");
  expect(focus.outlineStyle).not.toBe("none");
  expect(parseFloat(focus.outlineWidth)).toBeGreaterThan(0);
});


test("expert puzzle solver preserves bottle identity with double-digit color IDs", async ({ page }) => {
  const result = await page.evaluate(() => {
    const puzzle = window.__cq.generate("phase-9-expert-regression", 11);
    const solution = window.__cq.solve(puzzle.bottles, 120000);
    if (!solution) return { par: puzzle.par, solutionLength: 0, solved: false };
    const state = puzzle.bottles.map(b => b.slice());
    for (const [from, to] of solution) {
      if (!window.__cq.pour(state, from, to)) return { par: puzzle.par, solutionLength: solution.length, solved: false };
    }
    return { par: puzzle.par, solutionLength: solution.length, solved: window.__cq.isSolved(state) };
  });
  expect(result.par).toBeGreaterThan(0);
  expect(result.solutionLength).toBeGreaterThan(0);
  expect(result.solved).toBe(true);
});
