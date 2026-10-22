// Copyright (c) "Neo4j"
// Neo4j Sweden AB [http://neo4j.com]
// Acceptance check for the exercise "add authentication to grandstack-web".
// Run it against YOUR modified copy of the web app, served with the auth stack (see docs/exercise-add-auth-to-grandstack-web.md).
//   WEB_URL (default http://localhost:3000)   GRAPHQL_URL (default http://localhost:4000/graphql)   CHROME_PATH
// It expects these hooks in your app (the exercise says where they come from):
//   a control with the text "Log in" when signed out and "Log out" when signed in;
//   an element with data-testid="who-name" showing the signed-in user's name;
//   the existing "Add" menu in the header (button text starting with "Add") only for users who may write the catalogue.
import puppeteer from "puppeteer-core";

const WEB = process.env.WEB_URL ?? "http://localhost:3000";
const GRAPHQL = process.env.GRAPHQL_URL ?? "http://localhost:4000/graphql";
const CHROME = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const results = [];
const check = (name, ok, extra = "") => results.push(`${ok ? "PASS" : "FAIL"} ${name}${extra ? " " + extra : ""}`);
const body = (page) => page.evaluate(() => document.body.innerText);
const hasButton = (page, re) => page.evaluate((src) => [...document.querySelectorAll("button, a")].some((e) => new RegExp(src).test(e.textContent.trim())), re.source);
const click = (page, label) => page.evaluate((l) => [...document.querySelectorAll("button, a")].find((e) => e.textContent.trim() === l)?.click(), label);

// Test data is named "ZZ Exercise ..." and removed with a moderator's token, before and after the run.
async function cleanup() {
  const res = await fetch("http://localhost:8081/realms/grandstack/protocol/openid-connect/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "password", client_id: "grandstack-smoke", username: "carol", password: "carol-pass", scope: "openid" }) });
  const { access_token } = await res.json();
  await fetch(GRAPHQL, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${access_token}` }, body: JSON.stringify({ query: `mutation { deleteMovies(where:{title:{startsWith:"ZZ Exercise"}}){ nodesDeleted } }` }) });
}

async function scenario(name, fn) {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1300, height: 900 });
  try { await fn(page); } catch (e) { check(`${name}: scenario completed`, false, String(e.message).slice(0, 160)); }
  finally { await browser.close().catch(() => {}); }
}

async function login(page, user) {
  await page.goto(WEB, { waitUntil: "networkidle0" });
  await click(page, "Log in");
  await page.waitForSelector("#username", { timeout: 15000 });
  await page.type("#username", user);
  await page.type("#password", `${user}-pass`);
  await Promise.all([page.waitForNavigation({ waitUntil: "networkidle0" }), page.click("#kc-login")]);
  await page.waitForSelector('[data-testid="who-name"]', { timeout: 15000 });
}

await cleanup();

await scenario("anonymous", async (page) => {
  await page.goto(`${WEB}/movies`, { waitUntil: "networkidle0" });
  check("anonymous can browse movies", (await page.$$(".card")).length >= 10);
  check("anonymous sees a Log in control", await hasButton(page, /^Log in$/));
  check("anonymous does not see the Add menu", !(await hasButton(page, /^Add/)));
  await page.goto(`${WEB}/movies/new`, { waitUntil: "networkidle0" }).catch(() => {});
  await page.waitForFunction(() => location.host !== "localhost:3000", { timeout: 15000 }).catch(() => {});
  check("anonymous opening /movies/new is sent to the login page", new URL(page.url()).host === "localhost:8081", page.url());
});

await scenario("alice", async (page) => {
  await login(page, "alice");
  check("alice's name is shown", (await page.$eval('[data-testid="who-name"]', (e) => e.textContent.trim())) === "Alice Reader");
  check("alice has no Add menu", !(await hasButton(page, /^Add/)));
  await page.goto(`${WEB}/movies/Inception`, { waitUntil: "networkidle0" });
  check("alice sees no Edit or Delete on a movie", !(await hasButton(page, /^(Edit|Delete)$/)));
  await page.goto(`${WEB}/movies/new`, { waitUntil: "networkidle0" });
  await page.waitForFunction(() => document.body.innerText.includes("editor"), { timeout: 8000 }).catch(() => {});
  check("alice opening /movies/new is told she needs the editor role", /editor/i.test(await body(page)) && !(await page.$(".form")));
  await page.goto(WEB, { waitUntil: "networkidle0" });
  await click(page, "Log out");
  await page.waitForFunction(() => location.origin === "http://localhost:3000" && document.body.innerText.includes("Log in"), { timeout: 15000 }).catch(() => {});
  check("logging out returns to the app, signed out", await hasButton(page, /^Log in$/));
});

await scenario("bob", async (page) => {
  await login(page, "bob");
  check("bob has the Add menu", await hasButton(page, /^Add/));
  await page.goto(`${WEB}/movies/new`, { waitUntil: "networkidle0" });
  await page.waitForSelector(".form input", { timeout: 8000 });
  await page.type(".form > label:nth-of-type(1) input", "ZZ Exercise Movie");
  await page.click('button[type="submit"]');
  await page.waitForFunction(() => location.pathname === "/movies/ZZ%20Exercise%20Movie", { timeout: 10000 }).then(() => check("bob can create a movie (the token is sent)", true), () => check("bob can create a movie (the token is sent)", false, page.url()));
  await page.waitForFunction(() => [...document.querySelectorAll("button, a")].some((e) => e.textContent.trim() === "Edit"), { timeout: 10000 }).catch(() => {});
  check("bob sees Edit and Delete", await hasButton(page, /^Edit$/) && await hasButton(page, /^Delete$/));
  await click(page, "Delete");
  await page.waitForSelector("dialog[open]", { timeout: 5000 }).catch(() => {});
  await page.evaluate(() => document.querySelector("dialog[open] .btn-danger")?.click());
  await page.waitForFunction(() => location.pathname === "/movies", { timeout: 10000 }).catch(() => {});
  check("bob can delete it again", page.url().endsWith("/movies"));
});

await cleanup();

console.log(results.join("\n"));
const failed = results.filter((r) => r.startsWith("FAIL")).length;
console.log(`\n${results.filter((r) => r.startsWith("PASS")).length} passed, ${failed} failed`);
process.exitCode = failed ? 1 : 0;
