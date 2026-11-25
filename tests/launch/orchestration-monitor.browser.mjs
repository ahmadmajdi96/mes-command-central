import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

// Start OMS on 127.0.0.1:4476 with VITE_SELF_HOSTED_SUPABASE=true and a fixture
// publishable key, then run this file with Node. Supply OMS_PLAYWRIGHT_MODULE
// when Playwright is installed outside OMS. OMS_AXE_SCRIPT optionally points
// to a local axe-core bundle for the WCAG scan of the recovery control.
const origin = "http://127.0.0.1:4476";
const { chromium } = await import(process.env.OMS_PLAYWRIGHT_MODULE ?? "playwright");
const artifacts = process.env.OMS_MONITOR_ARTIFACTS;
if (artifacts) await mkdir(artifacts, { recursive: true });

const userId = "a1000000-0000-4000-8000-000000000001";
const now = Math.floor(Date.now() / 1000);
const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
const token = [
  encode({ alg: "HS256", typ: "JWT" }),
  encode({ sub: userId, role: "authenticated", iat: now, exp: now + 3600 }),
  "fixture-only",
].join(".");
const user = {
  id: userId,
  email: "viewer@example.test",
  aud: "authenticated",
  role: "authenticated",
  app_metadata: {},
  user_metadata: {},
  created_at: new Date().toISOString(),
};
const session = {
  user,
  access_token: token,
  token_type: "bearer",
  refresh_token: "browser-fixture",
  expires_in: 3600,
  expires_at: now + 3600,
};
const order = {
  id: "a1000000-0000-4000-8000-000000000002",
  number: "ORD-FIXTURE-019",
  status: "confirmed",
  channel: "direct",
  customer_id: null,
  created_at: "2026-01-13T07:30:00Z",
  status_changed_at: "2026-01-13T07:30:00Z",
  hours_in_status: 2,
  sla_hours: 10,
  failed_steps: 0,
  unallocated_qty: 3,
};

const browser = await chromium.launch();
try {
  for (const width of [1440, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
    page.setDefaultTimeout(12_000);
    let failMonitor = true;
    let releaseRetry;
    const retryResponse = new Promise((resolve) => { releaseRetry = resolve; });
    await page.addInitScript((fixture) => {
      localStorage.setItem("sb-127-auth-token", JSON.stringify(fixture));
    }, session);
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.origin !== origin) return route.abort();
      if (url.pathname === "/supabase/rest/v1/v_order_monitor") {
        if (failMonitor) {
          return route.fulfill({
            status: 503,
            headers: { "retry-after": "0" },
            json: { message: "Synthetic monitor outage" },
          });
        }
        await retryResponse;
        return route.fulfill({ json: [order] });
      }
      if (url.pathname.startsWith("/supabase/")) {
        return route.fulfill({
          json: url.pathname === "/supabase/auth/v1/user" ? user : [],
          headers: { "content-range": "0-0/0" },
        });
      }
      return route.continue();
    });

    try {
      await page.goto(origin + "/orchestration");
      await page.getByRole("heading", { name: "Orchestration Monitor" }).waitFor();
      const alert = page.getByRole("alert").filter({
        hasText: "The orchestration queue could not be loaded.",
      });
      try {
        await alert.waitFor();
      } catch (error) {
        if (artifacts) await page.screenshot({ path: join(artifacts, `failure-${width}.png`) });
        throw error;
      }
      assert.equal(await page.getByText("0 open orders", { exact: true }).count(), 0);
      assert.equal(await page.getByText("Nothing in this queue", { exact: true }).count(), 0);
      assert.equal(await page.getByRole("button", { name: "Export CSV" }).count(), 0);
      await page.getByRole("heading", { name: "Problems needing attention" }).waitFor();
      if (artifacts) await page.screenshot({ path: join(artifacts, `unavailable-${width}.png`) });
      if (process.env.OMS_AXE_SCRIPT) {
        await page.addScriptTag({ path: process.env.OMS_AXE_SCRIPT });
        const violations = await alert.evaluate(async (element) => {
          const result = await window.axe.run(element, {
            runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] },
          });
          return result.violations.map(({ id }) => id);
        });
        assert.deepEqual(violations, []);
        console.log(`OMS orchestration recovery control axe scan passed at ${width}px`);
      }

      failMonitor = false;
      const retry = alert.getByRole("button", { name: "Retry", exact: true });
      await retry.focus();
      await page.keyboard.press("Enter");
      assert.equal(await alert.getByRole("button", { name: "Retrying…" }).isDisabled(), true);
      releaseRetry();
      await page.getByRole("link", { name: order.number, exact: true }).waitFor();
      await page.getByText("1 open order", { exact: true }).waitFor();
      assert.equal(await alert.count(), 0);
      assert.equal(await page.getByRole("button", { name: "Export CSV" }).isEnabled(), true);
      if (artifacts) await page.screenshot({ path: join(artifacts, `recovered-${width}.png`) });

      await page.getByRole("button", { name: "On hold", exact: true }).click();
      await page.getByText("Nothing in this queue", { exact: true }).waitFor();
      console.log(`OMS orchestration failure and retry verified at ${width}px`);
    } finally {
      releaseRetry();
      await page.close();
    }
  }
} finally {
  await browser.close();
}
