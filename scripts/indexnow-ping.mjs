#!/usr/bin/env node
/**
 * Submit all sitemap URLs to IndexNow (Bing, Yandex, and partners).
 * Google does not use IndexNow — submit to Google through Search Console.
 *
 * Usage: node scripts/indexnow-ping.mjs
 */

const HOST = "music.lab86.io";
const KEY = "15a63ecde6cdcf5ddb2d9f4461066382";
const SITEMAP = `https://${HOST}/sitemap.xml`;

const xml = await (await fetch(SITEMAP)).text();
const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
if (urls.length === 0) {
  console.error("No URLs found in sitemap");
  process.exit(1);
}

const response = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify({
    host: HOST,
    key: KEY,
    keyLocation: `https://${HOST}/${KEY}.txt`,
    urlList: urls,
  }),
});

console.log(`Submitted ${urls.length} URLs. Status: ${response.status}`);
if (!response.ok) {
  console.error(await response.text());
  process.exit(1);
}
