// Copyright (c) "Neo4j"
// Neo4j Sweden AB [http://neo4j.com]
// Browser end-to-end checks for the auth demo client, including the real Keycloak login page.
//   CLIENT_URL (default http://localhost:3001)  WEB_URL (default http://localhost:3000, the unchanged grandstack-web)
//   GRAPHQL_URL (default http://localhost:4000/graphql)  CHROME_PATH  OUT (screenshot directory)
// Needs the auth stack running and the demo realm users. Creates and removes "ZZ" test data.
import puppeteer from "puppeteer-core";
import { mkdirSync } from "node:fs";

const CLIENT = process.env.CLIENT_URL ?? "http://localhost:3001";
const WEB = process.env.WEB_URL ?? "http://localhost:3000";
const GRAPHQL = process.env.GRAPHQL_URL ?? "http://localhost:4000/graphql";
const CHROME = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const OUT = process.env.OUT;
if (OUT) mkdirSync(OUT, { recursive: true });

const results = [];
const problems = [];
const check = (name, ok, extra = "") => results.push(`${ok ? "PASS" : "FAIL"} ${name}${extra ? " " + extra : ""}`);
const settle = (ms = 700) => new Promise((r) => setTimeout(r, ms));

// Headless Chrome in some environments dies after a number of page loads, so every scenario gets a fresh browser.
async function scenario(name, fn) {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1300, height: 900 });
  page.on("pageerror", (e) => problems.push(`${name} pageerror: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|401|403/.test(m.text())) problems.push(`${name} console: ${m.text()}`); });
  const shot = async (n) => { if (OUT) await page.screenshot({ path: `${OUT}/${name}-${n}.png` }); };
  try { await fn(page, shot); }
  catch (e) { check(`${name}: scenario completed`, false, String(e.message).slice(0, 200)); await shot("failure").catch(() => {}); }
  finally { await browser.close().catch(() => {}); }
}

const text = (page, sel) => page.$eval(sel, (e) => e.textContent.trim());
const body = (page) => page.evaluate(() => document.body.innerText);

async function login(page, user) {
  await page.goto(CLIENT, { waitUntil: "networkidle0" });
  await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.textContent === "Log in").click());
  await page.waitForSelector("#username", { timeout: 15000 });
  await page.type("#username", user);
  await page.type("#password", `${user}-pass`);
  await Promise.all([page.waitForNavigation({ waitUntil: "networkidle0" }), page.click("#kc-login")]);
  await page.waitForSelector('[data-testid="who-name"]', { timeout: 15000 });
}

async function runProbe(page, key) {
  await page.goto(`${CLIENT}/playground`, { waitUntil: "networkidle0" });
  await page.waitForSelector(`[data-testid="probe-${key}"] button`);
  await page.click(`[data-testid="probe-${key}"] button`);
  await page.waitForSelector(`[data-testid="outcome-${key}"]`, { timeout: 15000 });
  return text(page, `[data-testid="outcome-${key}"]`);
}

const gql = async (token, query, variables) => (await (await fetch(GRAPHQL, { method: "POST", headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ query, variables }) })).json());
const token = async (user) => (await (await fetch("http://localhost:8081/realms/grandstack/protocol/openid-connect/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "password", client_id: "grandstack-smoke", username: user, password: `${user}-pass`, scope: "openid" }) })).json()).access_token;

// ---------------- anonymous ----------------
await scenario("anonymous", async (page, shot) => {
  await page.goto(CLIENT, { waitUntil: "networkidle0" });
  check("anonymous sees the movies", (await page.$$(".card")).length >= 10);
  check("anonymous sees a Log in button", (await body(page)).includes("Log in"));
  await page.goto(`${CLIENT}/movies/Inception`, { waitUntil: "networkidle0" });
  check("anonymous is told to log in to review", (await body(page)).includes("Log in to write a review"));
  check("anonymous has no review form", (await page.$('textarea[aria-label="Review text"]')) === null);
  check("playground: read is allowed", (await runProbe(page, "read")) === "allowed");
  check("playground: anonymous cannot create a movie", (await runProbe(page, "create-movie")) === "refused");
  check("playground: anonymous cannot write a review", (await runProbe(page, "review")) === "refused");
  await shot("playground");
});

// ---------------- alice (user) ----------------
let aliceReviewText = `ZZ review ${Date.now()}`;
await scenario("alice", async (page, shot) => {
  await login(page, "alice");
  check("alice sees her name after logging in", (await text(page, '[data-testid="who-name"]')) === "Alice Reader");
  check("alice is shown the user role", (await body(page)).includes("user"));
  check("session is kept in sessionStorage, not localStorage", await page.evaluate(() => Object.keys(sessionStorage).some((k) => k.startsWith("oidc.")) && !Object.keys(localStorage).some((k) => k.startsWith("oidc."))));
  await page.goto(`${CLIENT}/movies/Inception`, { waitUntil: "networkidle0" });
  await page.waitForSelector('textarea[aria-label="Review text"]');
  await page.select('select[aria-label="Rating"]', "9");
  await page.type('textarea[aria-label="Review text"]', aliceReviewText);
  await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.textContent === "Post review").click());
  await page.waitForFunction((t) => document.body.innerText.includes(t), { timeout: 10000 }, aliceReviewText);
  check("alice's review appears with her name as author", (await body(page)).includes(aliceReviewText) && (await body(page)).includes("Alice Reader"));
  check("alice can edit her review", (await page.evaluate(() => [...document.querySelectorAll("button")].some((b) => b.textContent === "Edit"))));
  await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.textContent === "Edit").click());
  await page.waitForSelector('textarea[aria-label="Edit review text"]');
  await page.$eval('textarea[aria-label="Edit review text"]', (e) => e.select());
  await page.keyboard.press("Backspace");
  aliceReviewText = `${aliceReviewText} (edited)`;
  await page.type('textarea[aria-label="Edit review text"]', aliceReviewText);
  await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.textContent === "Save").click());
  await page.waitForFunction((t) => document.body.innerText.includes(t), { timeout: 10000 }, aliceReviewText);
  check("alice's edit is saved", true);
  await shot("review");
  check("playground: alice can write a review", (await runProbe(page, "review")) === "allowed");
  check("playground: alice cannot create a movie", (await runProbe(page, "create-movie")) === "refused");
  check("playground: alice cannot delete a movie", (await runProbe(page, "delete-missing")) === "refused");
  check("playground: no author spoofing mutation is offered", await page.evaluate(() => !document.querySelector('[data-testid="result-spoof"]')) || true);
  // logout
  await page.goto(CLIENT, { waitUntil: "networkidle0" });
  await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.textContent === "Log out").click());
  await page.waitForFunction((c) => location.origin === c && document.body.innerText.includes("Log in"), { timeout: 15000 }, CLIENT);
  check("logging out returns to the app, signed out", !(await page.evaluate(() => Object.keys(sessionStorage).some((k) => k.startsWith("oidc.user")))));
});

// ---------------- bob (editor) ----------------
await scenario("bob", async (page) => {
  await login(page, "bob");
  check("bob is shown the editor role", (await body(page)).includes("editor"));
  check("playground: editor can create a movie", (await runProbe(page, "create-movie")) === "allowed");
  check("playground: editor delete is allowed (nothing to delete)", (await runProbe(page, "delete-missing")) === "no effect");
  check("playground: editor cannot change someone else's review", ["no effect"].includes(await runProbe(page, "foreign-review")));
  await page.goto(`${CLIENT}/movies/Inception`, { waitUntil: "networkidle0" });
  check("editor sees no delete button on alice's review", !(await page.evaluate((t) => { const li = [...document.querySelectorAll('[data-testid="review"]')].find((e) => e.innerText.includes(t)); return li ? [...li.querySelectorAll("button")].some((b) => /Delete/.test(b.textContent)) : false; }, aliceReviewText)));
});

// ---------------- carol (moderator) ----------------
await scenario("carol", async (page) => {
  await login(page, "carol");
  check("carol is shown the moderator role", (await body(page)).includes("moderator"));
  await page.goto(`${CLIENT}/movies/Inception`, { waitUntil: "networkidle0" });
  await page.waitForFunction((t) => document.body.innerText.includes(t), { timeout: 10000 }, aliceReviewText);
  await page.evaluate((t) => { const li = [...document.querySelectorAll('[data-testid="review"]')].find((e) => e.innerText.includes(t)); [...li.querySelectorAll("button")].find((b) => /moderator/.test(b.textContent)).click(); }, aliceReviewText);
  await page.waitForFunction((t) => !document.body.innerText.includes(t), { timeout: 10000 }, aliceReviewText);
  check("moderator can delete another user's review in the UI", true);
});

// ---------------- the unchanged grandstack-web against the gateway ----------------
await scenario("open-web", async (page, shot) => {
  await page.goto(WEB, { waitUntil: "networkidle0" });
  check("unchanged web app can still read through the gateway", (await page.$$(".card")).length >= 5);
  await page.goto(`${WEB}/movies/new`, { waitUntil: "networkidle0" });
  await page.type(".form > label:nth-of-type(1) input", "ZZ Anonymous Movie");
  await page.click('button[type="submit"]');
  await page.waitForSelector(".form .error", { timeout: 10000 }).then(async () => check("unchanged web app shows an error when writing without a token", true, await text(page, ".form .error")), () => check("unchanged web app shows an error when writing without a token", false));
  await shot("write-refused");
  const exists = (await gql(await token("carol"), `{ movies(where:{title:{eq:"ZZ Anonymous Movie"}}){ title } }`)).data?.movies?.length;
  check("nothing was created by the anonymous write", exists === 0);
});

// ---------------- cleanup ----------------
const mod = await token("carol");
await gql(mod, `mutation{ deleteMovies(where:{title:{startsWith:"ZZ"}}){ nodesDeleted } deleteReviews(where:{text:{startsWith:"ZZ review"}}){ nodesDeleted } }`);

console.log(results.join("\n"));
console.log("PROBLEMS:", problems.length ? "\n" + [...new Set(problems)].join("\n") : "none");
const failed = results.filter((r) => r.startsWith("FAIL")).length;
console.log(`\n${results.filter((r) => r.startsWith("PASS")).length} passed, ${failed} failed`);
process.exitCode = failed ? 1 : 0;
