/**
 * Sprint 6 E2E acceptance tests.
 *
 * Scenario: Supervisor logs in, sees the live risk heatmap, opens a CRITICAL
 * call, verifies the annotated transcript loads with at least one highlighted
 * risk phrase, and triggers an intervention.
 *
 * Requirement (PLAN.md): "supervisor receives alert, opens call detail, sees
 * highlighted phrase within 5 seconds."
 *
 * Prerequisites (set in CI secrets / local .env.e2e):
 *   ESO_TEST_SUPERVISOR_TOKEN   — valid JWT with role=supervisor
 *   ESO_TEST_COMPLIANCE_TOKEN   — valid JWT with role=compliance
 *   ESO_SEED_CALL_ID            — call_id of a pre-seeded CRITICAL call in the
 *                                  staging DB (used to bypass heatmap click)
 */

import { test, expect, type Page } from "@playwright/test";

const SUPERVISOR_TOKEN = process.env.ESO_TEST_SUPERVISOR_TOKEN ?? "";
const COMPLIANCE_TOKEN = process.env.ESO_TEST_COMPLIANCE_TOKEN ?? "";
const SEED_CALL_ID     = process.env.ESO_SEED_CALL_ID ?? "00000000-0000-0000-0000-000000000001";

// Inject a session token via localStorage shim so we bypass the Auth0 redirect.
// The AuthContext reads only from memory, so we inject via a custom event the
// test harness triggers before page load.
async function injectToken(page: Page, token: string) {
  await page.addInitScript(
    ({ tok }) => {
      // Simulates the hash-fragment callback that AppInner processes on mount.
      // We set it on window so the useEffect can pick it up immediately.
      Object.defineProperty(window, "__ESO_TEST_TOKEN__", {
        value: tok,
        configurable: true,
      });
    },
    { tok: token },
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────

async function navigateToCallDetail(page: Page, callId: string) {
  // Directly hit the API to verify the call exists before proceeding
  const apiRes = await page.request.get(
    `http://localhost:3001/api/calls/${callId}/detail`,
    { headers: { Authorization: `Bearer ${SUPERVISOR_TOKEN}` } },
  );
  expect(apiRes.status()).toBe(200);

  // Navigate via URL hash so the app routes to the call detail view.
  // The app reads page state from React, so we simulate a heatmap click
  // by triggering a custom DOM event that the test harness listens to.
  await page.evaluate((cid) => {
    window.dispatchEvent(new CustomEvent("eso:selectCall", { detail: { callId: cid } }));
  }, callId);
}

// ── Tests ────────────────────────────────────────────────────────────────────

test.describe("Sprint 6 — Call Detail & Intervention", () => {
  test.beforeEach(async ({ page }) => {
    if (!SUPERVISOR_TOKEN) {
      test.skip(!SUPERVISOR_TOKEN, "ESO_TEST_SUPERVISOR_TOKEN not set — skipping E2E");
    }
    await injectToken(page, SUPERVISOR_TOKEN);
    await page.goto("/");
  });

  test("supervisor sees live heatmap after login", async ({ page }) => {
    // The heatmap section heading should be visible within 5s of page load
    await expect(
      page.getByRole("heading", { name: /live risk heatmap/i }),
    ).toBeVisible({ timeout: 5_000 });
  });

  test("supervisor opens call detail and sees transcript within 5s", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /live risk heatmap/i })).toBeVisible({
      timeout: 5_000,
    });

    // Navigate to call detail
    await navigateToCallDetail(page, SEED_CALL_ID);

    // The transcript heading must appear within 5 seconds
    await expect(
      page.getByRole("heading", { name: /call transcript/i }),
    ).toBeVisible({ timeout: 5_000 });

    // At least one highlighted phrase (mark element) should be present for
    // a CRITICAL call that has risk events
    await expect(page.locator("mark").first()).toBeVisible({ timeout: 5_000 });
  });

  test("risk-flagged utterances carry category chip labels", async ({ page }) => {
    await page.goto("/");
    await navigateToCallDetail(page, SEED_CALL_ID);

    // Wait for transcript to load
    await expect(page.getByRole("heading", { name: /call transcript/i })).toBeVisible({
      timeout: 5_000,
    });

    // At least one risk-flag chip should be present
    const chips = page.locator('[aria-label*="alert"], [aria-label*="tactic"], [aria-label*="disclaimer"], [aria-label*="claim"]');
    await expect(chips.first()).toBeVisible({ timeout: 5_000 });
  });

  test("supervisor can trigger ALERT_AGENT intervention", async ({ page }) => {
    await page.goto("/");
    await navigateToCallDetail(page, SEED_CALL_ID);

    await expect(page.getByRole("heading", { name: /intervention log/i })).toBeVisible({
      timeout: 5_000,
    });

    // Click the "Alert agent" action button
    await page.getByRole("button", { name: /alert agent/i }).click();

    // Confirmation panel should appear
    await expect(page.getByRole("alertdialog")).toBeVisible();

    // Intercept the POST request to verify it's sent correctly
    const interventionPromise = page.waitForResponse(
      (resp) =>
        resp.url().includes("/interventions") && resp.request().method() === "POST",
    );

    await page.getByRole("button", { name: /confirm/i }).click();

    const resp = await interventionPromise;
    expect(resp.status()).toBe(201);

    // The intervention should now appear in the log
    await expect(page.getByText(/alert agent/i, { exact: false })).toBeVisible({
      timeout: 3_000,
    });
  });

  test("back button returns to dashboard", async ({ page }) => {
    await page.goto("/");
    await navigateToCallDetail(page, SEED_CALL_ID);

    await expect(page.getByRole("heading", { name: /call transcript/i })).toBeVisible({
      timeout: 5_000,
    });

    await page.getByRole("button", { name: /back to dashboard/i }).click();

    await expect(
      page.getByRole("heading", { name: /supervisor dashboard/i }),
    ).toBeVisible({ timeout: 3_000 });
  });
});

test.describe("Sprint 6 — Compliance report export", () => {
  test.beforeEach(async ({ page }) => {
    if (!COMPLIANCE_TOKEN) {
      test.skip(!COMPLIANCE_TOKEN, "ESO_TEST_COMPLIANCE_TOKEN not set — skipping");
    }
    await injectToken(page, COMPLIANCE_TOKEN);
    await page.goto("/");
  });

  test("compliance officer sees Export Report button on call detail", async ({
    page,
  }) => {
    await navigateToCallDetail(page, SEED_CALL_ID);
    await expect(
      page.getByTestId("export-report-btn"),
    ).toBeVisible({ timeout: 5_000 });
  });

  test("GET /api/calls/:id/report returns required JSON fields", async ({
    page,
  }) => {
    const res = await page.request.get(
      `http://localhost:3001/api/calls/${SEED_CALL_ID}/report`,
      { headers: { Authorization: `Bearer ${COMPLIANCE_TOKEN}` } },
    );
    expect(res.status()).toBe(200);

    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toHaveProperty("callId");
    expect(body).toHaveProperty("score");
    expect(body).toHaveProperty("riskLevel");
    expect(body).toHaveProperty("flaggedPhrases");
    expect(body).toHaveProperty("transcript");
    expect(body).toHaveProperty("rationale");
    expect(body).toHaveProperty("generatedAt");
  });

  test("supervisor cannot access /report endpoint", async ({ page }) => {
    const res = await page.request.get(
      `http://localhost:3001/api/calls/${SEED_CALL_ID}/report`,
      { headers: { Authorization: `Bearer ${SUPERVISOR_TOKEN}` } },
    );
    // supervisors have role=supervisor, not compliance — should get 403
    expect(res.status()).toBe(403);
  });
});
