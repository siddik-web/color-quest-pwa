import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator(".bottle").first()).toBeVisible();
  if (await page.locator("#drDlg").evaluate(el => el.open)) {
    await page.locator("#drClaim").click();
  }
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
