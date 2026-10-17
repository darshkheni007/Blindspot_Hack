import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

const sample = (f: string) => path.join(process.cwd(), "prisma", "sample", f);
const stamp = Date.now();

async function signUp(page: Page, name: string) {
  await page.goto("/sign-up");
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Email").fill(`${name.toLowerCase()}${stamp}@e2e.test`);
  await page.getByLabel("Password").fill("a-long-test-password");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL("**/dashboard");
}

test("upload -> analyze -> view findings, then triage one", async ({ page }) => {
  await signUp(page, "Alice");
  await expect(page.getByText("No projects yet")).toBeVisible();

  await page.getByRole("link", { name: "Start a scan" }).click();
  await page.getByLabel("Project name").fill("E2E migration");
  await page.getByLabel("Goal").fill("Replace the legacy billing system without interrupting invoicing.");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Deadline").fill("2027-03-15");
  await page.getByLabel("Budget").fill("$350,000");
  await page.getByLabel("Team size").fill("6");
  await page.getByRole("button", { name: "Create project" }).click();

  await page.getByLabel("Upload documents").setInputFiles(["Meridian-Billing-PRD.md", "Meridian-Migration-Plan.md", "Meridian-Budget.csv"].map(sample));
  await expect(page.getByText("Ready", { exact: true })).toHaveCount(3);
  await page.getByRole("button", { name: "Analyze documents" }).click();

  await page.waitForURL(/tab=findings/);
  const cards = page.locator("[data-finding-id]");
  await expect(cards.first()).toBeVisible();
  await expect.poll(() => cards.count()).toBeGreaterThanOrEqual(8);

  const detail = page.getByRole("region", { name: "Finding details" });
  await expect(detail.getByRole("heading", { name: "Evidence" })).toBeVisible();
  await expect(detail.locator("blockquote").first()).toBeVisible();
  await expect(detail.getByRole("heading", { name: "Score breakdown" })).toBeVisible();
  await detail.getByRole("button", { name: /View in document/ }).first().click();
  await expect(page.getByRole("dialog")).toContainText("Cited location");
  await page.keyboard.press("Escape");

  // Rejecting requires a reason
  await detail.getByRole("button", { name: "Reject", exact: true }).click();
  await detail.getByRole("button", { name: "Reject finding" }).click();
  await expect(detail.getByText("Add a short reason.")).toBeVisible();
  await detail.getByLabel("Why are you rejecting this?").fill("Covered in the steering committee notes.");
  await detail.getByRole("button", { name: "Reject finding" }).click();
  await expect(detail.getByRole("button", { name: "Reject", exact: true, pressed: true })).toBeVisible();

  // Filter by status shows just that one
  await page.getByRole("checkbox", { name: /^Rejected/ }).check();
  await expect(cards).toHaveCount(1);

  // Report tab and CSV export
  await page.getByRole("tab", { name: "Report" }).click();
  await expect(page.getByRole("heading", { name: "Executive summary" })).toBeVisible();
  const id = page.url().match(/projects\/([^/?]+)/)![1];
  const csv = await page.request.get(`/api/projects/${id}/report?format=csv`);
  expect(csv.status()).toBe(200);
  expect(await csv.text()).toContain("Rank,Title");
});

test("another account cannot open someone else's project", async ({ page, browser }) => {
  await signUp(page, "Carol");
  await page.getByRole("link", { name: "Start a scan" }).click();
  await page.getByLabel("Project name").fill("Carol private");
  await page.getByLabel("Goal").fill("Private goal for tenant check.");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Create project" }).click();
  await page.getByRole("button", { name: "Skip analysis for now" }).click();
  await page.waitForURL(/\/projects\/(?!new)[^/?]+\?tab=documents/);
  const url = page.url().split("?")[0];
  const id = url.split("/").pop()!;

  const other = await browser.newContext({ baseURL: "http://localhost:3101" });
  const p2 = await other.newPage();
  await signUp(p2, "Dave");
  await p2.goto(url);
  await expect(p2.getByRole("heading", { name: "Project not found" })).toBeVisible();
  await expect(p2.getByText("Carol private")).toHaveCount(0);
  expect((await p2.request.get(`/api/projects/${id}/findings`)).status()).toBe(404);
  await other.close();
});
