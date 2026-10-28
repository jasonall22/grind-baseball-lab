import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

function moduleUrl(source) {
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  return `data:text/javascript;base64,${Buffer.from(js).toString("base64")}`;
}
const mapperUrl = moduleUrl(await readFile(new URL("../src/lib/facebookNews.ts", import.meta.url), "utf8"));
const { facebookPostsToSlides } = await import(mapperUrl);
const serviceSource = (await readFile(new URL("../src/lib/getFacebookNews.ts", import.meta.url), "utf8")).replace('"@/lib/facebookNews"', JSON.stringify(mapperUrl));
const { getFacebookNews } = await import(moduleUrl(serviceSource));
const page = "415532371652979";
const post = {
  id: `${page}_100`, message: "Training at The Grind\n\nA daily update with a photo.",
  full_picture: "https://scontent.example.fbcdn.net/photo.jpg", permalink_url: `https://www.facebook.com/${page}/posts/100`,
  created_time: "2026-10-28T14:00:00+0000", is_published: true, is_hidden: false,
};
const slides = facebookPostsToSlides([post, post, { ...post, id: `${page}_101`, created_time: "2026-10-29T14:00:00Z" }], page);
assert.equal(slides.length, 2); assert.equal(slides[0].id, `facebook-${page}_101`);
assert.equal(slides[1].title, "Training at The Grind"); assert.equal(slides[1].body, "A daily update with a photo.");
assert.equal(slides[1].right_image_url, post.full_picture); assert.equal(slides[1].cta_text, "View on Facebook");
for (const patch of [
  { is_published: false }, { is_hidden: true }, { id: "different_page_100" },
  { permalink_url: "javascript:alert(1)" }, { permalink_url: "https://facebook.com.evil.test/post" },
  { permalink_url: "https://www.facebook.com/post?access_token=secret" }, { created_time: "invalid" },
  { message: "", full_picture: "" },
]) assert.equal(facebookPostsToSlides([{ ...post, ...patch }], page).length, 0);
assert.equal(facebookPostsToSlides([null, false, {}, post], "bad-page-id").length, 0);
assert.equal(facebookPostsToSlides([{ ...post, full_picture: "https://evil.test/tracker" }], page)[0].right_image_url, null);
assert.equal(facebookPostsToSlides([{ ...post, message: "Photo update" }], page)[0].body, "");
assert.equal(facebookPostsToSlides(Array.from({ length: 10 }, (_, i) => ({ ...post, id: `${page}_${i}` })), page).length, 6);
const longMessage = "A".repeat(140);
assert.equal(facebookPostsToSlides([{ ...post, message: longMessage }], page)[0].body, longMessage);

const originalFetch = globalThis.fetch;
const originalError = console.error;
const envKeys = ["FACEBOOK_PAGE_ACCESS_TOKEN", "FACEBOOK_PAGE_ID", "FACEBOOK_GRAPH_API_VERSION"];
const originalEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
const logs = [];
try {
  envKeys.forEach((key) => delete process.env[key]);
  globalThis.fetch = () => { throw new Error("Unexpected request without a token"); };
  assert.equal((await getFacebookNews()).status, "not_configured");
  process.env.FACEBOOK_PAGE_ACCESS_TOKEN = "test-only-secret";
  globalThis.fetch = async (url, options) => {
    assert.equal(url.hostname, "graph.facebook.com"); assert.ok(url.pathname.endsWith(`/${page}/published_posts`));
    assert.ok(!url.toString().includes("test-only-secret")); assert.equal(options.headers.Authorization, "Bearer test-only-secret");
    assert.equal(options.next.revalidate, 3600); assert.ok(options.signal instanceof AbortSignal);
    return Response.json({ data: [post] });
  };
  const connected = await getFacebookNews();
  assert.equal(connected.status, "connected"); assert.equal(connected.slides.length, 1);
  assert.ok(!JSON.stringify(connected).includes("test-only-secret"));
  console.error = (...args) => logs.push(args);
  globalThis.fetch = async () => Response.json({ error: { message: "test-only-secret" } }, { status: 401 });
  assert.equal((await getFacebookNews()).status, "unavailable");
  globalThis.fetch = async () => { throw new Error("test-only-secret network failure"); };
  assert.equal((await getFacebookNews()).status, "unavailable");
  globalThis.fetch = async () => Response.json({ error: "not a feed" });
  assert.equal((await getFacebookNews()).status, "unavailable");
  assert.ok(!JSON.stringify(logs).includes("test-only-secret"));
  process.env.FACEBOOK_PAGE_ID = "bad/page";
  assert.equal((await getFacebookNews()).status, "unavailable");
} finally {
  globalThis.fetch = originalFetch; console.error = originalError;
  for (const [key, value] of Object.entries(originalEnv)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
}
console.log("PASS: Facebook post ordering, deduplication, privacy filtering, safe links/images, token secrecy, caching, and failure handling.");
