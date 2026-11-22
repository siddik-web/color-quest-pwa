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
  const sourceTransform = await page.locator("#board .bottle").nth(move[0]).evaluate(el => el.style.transform);
  expect(sourceTransform).toContain("rotate(65deg)");
  await expect(page.locator(".stream")).toHaveCount(1, { timeout: 2000 });
  await expect(page.locator("#moves")).toContainText("Moves 1", { timeout: 3000 });
  await expect(page.locator(".stream")).toHaveCount(0);
  await expect(page.locator("#board .bottle.land")).toHaveCount(1);
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
  expect(result.solutionLength).toBeGreaterThan(0);
  expect(result.solved).toBe(true);
});

test("puzzle generator preserves color counts and solvability across difficulty bands", async ({ page }) => {
  const results = await page.evaluate(() => [4, 6, 8, 10, 11].map((colors, index) => {
    const puzzle = window.__cq.generate("generator-regression-" + colors + "-" + index, colors);
    const counts = Array(colors).fill(0);
    for (const bottle of puzzle.bottles) for (const color of bottle) counts[color]++;
    return {
      colors,
      bottleCount: puzzle.bottles.length,
      counts,
      par: puzzle.par,
      solvedAtStart: window.__cq.isSolved(puzzle.bottles)
    };
  }));
  for (const result of results) {
    expect(result.bottleCount).toBe(result.colors + 2);
    expect(result.counts).toEqual(Array(result.colors).fill(4));
    expect(result.par).toBeGreaterThan(0);
    expect(result.solvedAtStart).toBe(false);
  }
});

test("streak shield protects one missed daily challenge and is consumed only once", async ({ page }) => {
  await page.evaluate(() => {
    const dateKey = (date) => date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0");
    const today = new Date();
    const twoDaysAgo = new Date(today); twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    localStorage.setItem("cq.save", JSON.stringify({
      streak: 6, best: 6, last: dateKey(twoDaysAgo), streakFreezes: 1,
      streakFreezeMilestones: {}, dr: { last: dateKey(today), day: 1 }, tutorialSeen: true
    }));
  });
  await page.reload();
  const protectedState = await page.evaluate(() => ({
    streak: window.__cq.save.streak,
    shields: window.__cq.save.streakFreezes,
    graceDate: window.__cq.save.streakGraceDate,
    graceBase: window.__cq.save.streakGraceBase
  }));
  const today = await page.evaluate(() => {
    const d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  });
  expect(protectedState).toEqual({ streak: 6, shields: 0, graceDate: today, graceBase: 6 });
  await page.evaluate(() => window.__cq.syncStreakProtection());
  expect(await page.evaluate(() => window.__cq.save.streakFreezes)).toBe(0);
  expect(await page.evaluate(() => window.__cq.save.streak)).toBe(6);
});

test("seven-day streak milestones award at most one shield per milestone", async ({ page }) => {
  const result = await page.evaluate(() => {
    const first = window.__cq.awardStreakFreeze(7);
    const duplicate = window.__cq.awardStreakFreeze(7);
    const second = window.__cq.awardStreakFreeze(14);
    const capped = window.__cq.awardStreakFreeze(21);
    return { first, duplicate, second, capped, shields: window.__cq.save.streakFreezes };
  });
  expect(result).toEqual({ first: true, duplicate: false, second: true, capped: false, shields: 2 });
});

test("streak resets after multiple missed days when no shield is available", async ({ page }) => {
  await page.evaluate(() => {
    const dateKey = (date) => date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0");
    const today = new Date();
    const fourDaysAgo = new Date(today); fourDaysAgo.setDate(fourDaysAgo.getDate() - 4);
    localStorage.setItem("cq.save", JSON.stringify({
      streak: 9, best: 9, last: dateKey(fourDaysAgo), streakFreezes: 0,
      streakFreezeMilestones: {}, dr: { last: dateKey(today), day: 1 }, tutorialSeen: true
    }));
  });
  await page.reload();
  expect(await page.evaluate(() => window.__cq.save.streak)).toBe(0);
  expect(await page.evaluate(() => window.__cq.save.streakFreezes)).toBe(0);
});

test("milestone levels use a frozen reserve that thaws after two legal pours", async ({ page }) => {
  await page.evaluate(() => window.__cq.startGame("endless", 5));
  await expect(page.locator("#title")).toContainText("Level 5");
  await expect(page.locator("#modifierStatus")).toContainText("Frozen Reserve");
  await expect(page.locator("#modifierStatus")).toContainText("2 pours to thaw");
  await expect(page.locator("#board .bottle.frozen")).toHaveCount(1);

  const frozenIndex = await page.evaluate(() => window.__cq.frozenBottleIndex());
  await page.locator("#board .bottle").nth(frozenIndex).evaluate(el => el.click());
  await expect(page.locator("#moves")).toContainText("Moves 0");
  await expect(page.locator("#toast")).toContainText("Frozen reserve");

  for (let moveNumber = 1; moveNumber <= 2; moveNumber++) {
    const move = await page.evaluate((blocked) => {
      const state = window.__cq.state;
      for (let from = 0; from < state.length; from++) {
        if (from === blocked || !state[from].length) continue;
        const color = state[from][state[from].length - 1];
        for (let to = 0; to < state.length; to++) {
          if (to === blocked || from === to || state[to].length >= 4) continue;
          if (!state[to].length || state[to][state[to].length - 1] === color) return [from, to];
        }
      }
      return null;
    }, frozenIndex);
    expect(move).not.toBeNull();
    await page.locator("#board .bottle").nth(move[0]).click();
    await page.locator("#board .bottle").nth(move[1]).click();
    await expect(page.locator("#moves")).toContainText("Moves " + moveNumber);
  }

  await expect(page.locator("#board .bottle.frozen")).toHaveCount(0);
  await expect(page.locator("#modifierStatus")).toContainText("thawed");
});

test("ordinary levels do not enable a special puzzle modifier", async ({ page }) => {
  await page.evaluate(() => window.__cq.startGame("endless", 4));
  await expect(page.locator("#modifierStatus")).toBeEmpty();
  await expect(page.locator("#board .bottle.frozen")).toHaveCount(0);
});

test("level map shows unlocked progress and prevents locked-level selection", async ({ page }) => {
  await page.locator("#mEndless").click();
  await expect(page.locator("#levelMapBtn")).toBeVisible();
  await page.locator("#levelMapBtn").click();
  await expect(page.locator("#levelDlg")).toBeVisible();
  await expect(page.locator("#levelGrid .level-tile")).toHaveCount(100);
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
  await expect(page.locator("#levelSummary")).toContainText("Level 4 unlocked");
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
    const bottles = Array.from({ length: 10 }, (_, color) => Array(4).fill(color));
    bottles.push([10, 10, 10, 1], [1, 1, 1], [10], []);
    const solution = window.__cq.solve(bottles, 1000);
    if (!solution) return { solutionLength: 0, solved: false };
    const state = bottles.map(b => b.slice());
    for (const [from, to] of solution) {
      if (!window.__cq.pour(state, from, to)) return { solutionLength: solution.length, solved: false };
    }
    return { par: solution.length, solutionLength: solution.length, solved: window.__cq.isSolved(state) };
  });
  expect(result.par).toBeGreaterThan(0);
  expect(result.solutionLength).toBeGreaterThan(0);
  expect(result.solved).toBe(true);
});


test("source bottle returns to its original board position after pouring", async ({ page }) => {
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
  const source = page.locator("#board .bottle").nth(move[0]);
  const before = await source.boundingBox();
  await page.locator("#board .bottle").nth(move[0]).click();
  await page.locator("#board .bottle").nth(move[1]).click();
  await expect(page.locator("#moves")).toContainText("Moves 1");
  const landingBottle = page.locator("#board .bottle.land");
  await expect(landingBottle).toHaveCount(1);
  const landingOffsets = await landingBottle.evaluate(el => ({
    tx: el.style.getPropertyValue("--tx"),
    ty: el.style.getPropertyValue("--ty"),
    rot: el.style.getPropertyValue("--rot")
  }));
  expect(Number.parseFloat(landingOffsets.tx)).not.toBe(0);
  expect(Number.parseFloat(landingOffsets.ty)).not.toBe(0);
  expect(landingOffsets.rot).not.toBe("");
  await page.waitForTimeout(350);
  const after = await page.locator("#board .bottle").nth(move[0]).boundingBox();
  expect(Math.abs(after.x - before.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(after.y - before.y)).toBeLessThanOrEqual(1);
  const transform = await page.locator("#board .bottle").nth(move[0]).evaluate(el => getComputedStyle(el).transform);
  expect(transform).toBe("none");
});
