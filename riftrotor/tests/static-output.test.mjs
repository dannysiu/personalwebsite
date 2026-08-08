import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

test("builds the public /riftrotor entrypoint", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const assetDirectory = new URL("../assets/", import.meta.url);
  const javascript = (await Promise.all(
    (await readdir(assetDirectory))
      .filter((name) => name.endsWith(".js"))
      .map((name) => readFile(new URL(name, assetDirectory), "utf8")),
  )).join("\n");
  assert.match(html, /Rift Rotor: Two Worlds, One Flight/i);
  assert.match(html, /\/riftrotor\/assets\//);
  assert.match(javascript, /Sign in with Gmail/i);
  assert.doesNotMatch(`${html}\n${javascript}`, /signin-with-chatgpt|jongreenofficial\.chatgpt\.site/i);
});
