// Copies the static web app into www/ and bundles the native (Capacitor plugin) glue for the Android app.
import { cpSync, rmSync, mkdirSync } from "node:fs";
import { build } from "esbuild";

rmSync("www", { recursive: true, force: true });
mkdirSync("www", { recursive: true });
for (const f of ["index.html", "manifest.webmanifest", "sw.js", "icons"]) cpSync(f, "www/" + f, { recursive: true });

await build({
  entryPoints: ["native/entry.js"],
  bundle: true,
  minify: true,
  format: "iife",
  target: "es2019",
  outfile: "www/native.js",
  logLevel: "warning"
});
console.log("web assets + native.js written to www/");
