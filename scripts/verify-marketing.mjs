import assert from "node:assert/strict";

const base = process.argv[2] || "http://localhost:3000";
let checks = 0;
async function check(path, status, options = {}) {
  const response = await fetch(new URL(path, base), { redirect: "manual", ...options });
  assert.equal(response.status, status, `${path}: expected ${status}, got ${response.status}`);
  checks++;
  return response;
}

for (const path of ["/", "/contact", "/login", "/signup", "/robots.txt", "/sitemap.xml", "/logo.png"]) {
  const response = await check(path, 200);
  if (path === "/" || path === "/contact") {
    const body = await response.text();
    assert.ok(body.includes("(941) 307-7362"), `${path}: public phone missing`);
    assert.ok(body.includes("tel:+19413077362"), `${path}: clickable phone missing`);
    assert.ok(!/19419467386|19415250880/.test(body), `${path}: outdated phone`);
    checks += 3;
    if (path === "/") {
      for (const heading of ["NEWS AND UPDATES", "OUR TRAINING FACILITY", "BOOK CAGE TIME HERE", "OUR TRAINERS"]) {
        assert.ok(body.includes(heading), `Missing marketing section: ${heading}`); checks++;
      }
      assert.ok(body.includes('"telephone":"+19413077362"')); checks++;
    }
  }
}

for (const path of ["/admin", "/admin/hero", "/admin/news", "/admin/trainers", "/admin/pricing", "/admin/settings"]) {
  const response = await check(path, 307);
  assert.ok(response.headers.get("location")?.includes("/login"), `${path}: anonymous admin access was not denied`); checks++;
}

const booking = await check("/book", 307);
assert.equal(booking.headers.get("location"), "https://book.runswiftapp.com/facilities/the-grind-baseball-lab"); checks++;
for (const path of ["/api/book/public", "/api/book/customers", "/api/book/bookings", "/api/book/memberships", "/api/book/memberships/cancel-request", "/api/admin/staff", "/api/stripe/cards", "/api/stripe/payments", "/api/stripe/webhook", "/api/stripe/charges/checkout-session", "/api/stripe/memberships/cancel"]) {
  await check(path, 404);
  await check(path, 404, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
}
for (const path of ["/api/admin/hero/add", "/api/admin/hero/save", "/api/admin/hero/delete"]) {
  await check(path, 401, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
}
console.log(`PASS: ${checks} HTTP, content, redirect, and authorization checks against ${base}`);
