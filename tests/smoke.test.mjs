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
    assert.doesNotThrow(() => new vm.Script(source, { filename: \`index-inline-\${index}.js\` }));
  });
});

test("all referenced custom SVG assets exist", () => {
  const html = read("index.html");
  const references = [...html.matchAll(/(?:src|href)=["'](assets\/[^"']+)["']/g)]
    .map((match) => match[1]);

  assert.ok(references.length > 0, "expected HTML to reference custom artwork");
  references.forEach((path) => assert.ok(existsSync(path), \`missing HTML asset: \${path}\`));
});

test("every local service-worker precache entry exists", () => {
  const worker = read("sw.js");
  const entries = [...worker.matchAll(/["']\.\/([^"'?#]+)["']/g)]
    .map((match) => match[1])
    .filter((path) => path !== "");

  assert.ok(entries.includes("index.html"), "index.html must be precached");
  entries.forEach((path) => assert.ok(existsSync(path), \`missing precache asset: \${path}\`));
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
