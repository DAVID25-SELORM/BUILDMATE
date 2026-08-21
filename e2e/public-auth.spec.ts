import { test, expect } from "@playwright/test";
test("health endpoint reports configured services", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.ok()).toBeTruthy();
  expect((await response.json()).status).toBe("ok");
});
test("password recovery is reachable from login", async ({ page }) => {
  await page.goto("/login");
  const password = page.getByLabel("Password", { exact: true });
  await password.fill("kept-secret");
  await expect(password).toHaveAttribute("type", "password");
  await page.getByRole("button", { name: "Show password" }).click();
  await expect(password).toHaveAttribute("type", "text");
  await expect(password).toHaveValue("kept-secret");
  await page.getByRole("button", { name: "Hide password" }).click();
  await expect(password).toHaveAttribute("type", "password");
  await Promise.all([
    page.waitForURL("**/forgot-password", { timeout: 15000 }),
    page.getByRole("link", { name: "Forgot password?" }).click(),
  ]);
  await expect(
    page.getByRole("heading", { name: "Reset your password" }),
  ).toBeVisible({ timeout: 15000 });
  await page.getByLabel("Email address").fill("not-an-email");
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(
    page.getByText("Enter a valid email address", { exact: true }),
  ).toBeVisible();
});
test("protected routes redirect anonymous visitors", async ({ page }) => {
  await page.goto("/admin/catalogue");
  await expect(page).toHaveURL(/\/login\?redirect=/);
});
test("support centre exposes ticket escalation without mobile overflow", async ({ page }) => {
  await page.goto("/shop");
  await page.getByRole("button", { name: "Get Support" }).click();
  await expect(page.getByRole("heading", { name: "How can we help?" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Still need help?" })).toBeVisible();
  await page.getByLabel("Problem").selectOption("orders");
  await expect(page.getByRole("button", { name: "Contact BuildMate Support" })).toBeVisible();
  await expect(page.getByText(/Cash on Delivery/)).toBeVisible();
  const box = await page.getByRole("dialog").boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
});
test("shop loads and filters eligible master products by default", async ({
  page,
}) => {
  await page.goto("/shop");
  await expect(
    page.getByRole("heading", { name: "Shop building materials" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Plywood", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Louvre Glass", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Confirm availability with supplier").first(),
  ).toBeVisible();
  await expect(page.getByText("Kwashieman, Accra").first()).toBeVisible();

  await Promise.all([
    page.waitForURL(/\/shop\/b111e44a-/),
    page
      .getByRole("heading", { name: "Plywood", exact: true })
      .locator("xpath=ancestor::article")
      .getByRole("link", { name: "View offer" })
      .click(),
  ]);
  await expect(
    page.getByRole("heading", { name: "Plywood", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Nana Attakorah II Ventures" }),
  ).toBeVisible();
  await expect(
    page.getByText("Confirm availability with supplier"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add to cart" }).click();
  await expect(page.getByRole("button", { name: "Added to cart" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Cart with 1 items" })).toBeVisible();
  await page.getByRole("link", { name: "View cart" }).click();
  await expect(page.getByRole("heading", { name: "Your Cart" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Plywood" })).toBeVisible();
  await expect(page.getByText("¾ inch", { exact: true })).toBeVisible();
  await expect(page.getByText("Cash on Delivery", { exact: true })).toBeVisible();
  await expect(page.getByText(/Pay only when you receive and verify/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Place Order" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Plywood" })).toBeVisible();
  await expect(page.getByText("¾ inch", { exact: true })).toBeVisible();
  await page.goto("/shop");

  const search = page.getByPlaceholder(
    "Search materials, brands or specifications",
  );
  await search.fill("Dahoma");
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page).toHaveURL(/q=Dahoma/);
  await expect(
    page.getByRole("heading", { name: "Sawn Hardwood Timber", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Dahoma 2×6")).toBeVisible();

  await search.fill("material-that-does-not-exist");
  await page.getByRole("button", { name: "Search" }).click();
  await expect(
    page.getByText(/couldn't find materials matching/i),
  ).toBeVisible();
  await page.getByRole("link", { name: "Browse all materials" }).click();
  await expect(
    page.getByRole("heading", { name: "Louvre Glass", exact: true }),
  ).toBeVisible();
});
test("material calculator produces an estimate and prefills an RFQ", async ({
  page,
}) => {
  await page.goto("/calculators");
  await page.getByRole("button", { name: "Open calculator" }).first().click();
  await page.getByLabel("Total wall length (m)").fill("10");
  await page.getByLabel("Wall height (m)").fill("3");
  await page.getByLabel("Openings to subtract (m²)").fill("2");
  await page.getByRole("button", { name: "Calculate estimate" }).click();
  await expect(page.getByText("308 blocks")).toBeVisible();
  await page.getByRole("link", { name: "Request supplier quotes" }).click();
  await expect(page.getByLabel("Material list")).toHaveValue(/308 blocks/);
});
test("homepage supplier search submits its query", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Start with a product" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Louvre Glass", exact: true }),
  ).toBeVisible();
  await page
    .getByPlaceholder("Search cement, roofing, tiles...")
    .fill("cement");
  await page.getByPlaceholder("Enter site location").fill("Accra");
  await page.getByRole("button", { name: "Find materials" }).click();
  await expect(page).toHaveURL(/\/shop\?q=cement&location=Accra/);
});
test("homepage categories apply canonical filters and support is always reachable", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: /Blocks & Bricks/ }).click();
  await expect(page).toHaveURL(/\/shop\?category=blocks-bricks/);
  await expect(page.getByRole("heading", { name: "Shop building materials" })).toBeVisible();
  await page.getByRole("button", { name: "Get Support" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("heading", { name: "How can we help?" })).toBeVisible();
  await page.getByRole("button", { name: "Close support centre" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
});
test("mobile navigation opens, closes, and navigates", async ({page},testInfo)=>{test.skip(testInfo.project.name!=="mobile","Mobile navigation only");await page.goto("/");const menu=page.getByRole("button",{name:"Open menu"});await menu.click();const dialog=page.getByRole("dialog",{name:"Mobile navigation"});await expect(dialog).toBeVisible();await page.getByRole("button",{name:"Close menu"}).click();await expect(dialog).not.toBeVisible();await menu.click();await dialog.getByRole("link",{name:"Shop",exact:true}).click();await expect(page).toHaveURL(/\/shop/);await expect(dialog).not.toBeVisible()});
test("quotation requests reject a past delivery date", async ({ page }) => {
  await page.goto("/request-quote");
  const deliveryDate = page.getByLabel("Required delivery date");
  const today = await deliveryDate.getAttribute("min");
  expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  await deliveryDate.fill("2020-01-01");
  expect(
    await deliveryDate.evaluate(
      (input: HTMLInputElement) => input.validity.rangeUnderflow,
    ),
  ).toBe(true);
  await expect(deliveryDate).toHaveAttribute("required", "");
});
test("cement and sand calculator shows both materials and its safety disclaimer", async ({
  page,
}) => {
  await page.goto("/calculators");
  await page.getByRole("button", { name: "Open calculator" }).nth(2).click();
  await page.getByLabel("Required wet mortar volume (m³)").fill("1");
  await page.getByLabel("Sand ratio (parts per 1 cement)").fill("4");
  await page.getByLabel("Waste allowance (%)").fill("0");
  await page.getByRole("button", { name: "Calculate estimate" }).click();
  await expect(page.getByText("8 50 kg bags Cement")).toBeVisible();
  await expect(page.getByText("1.07 m³ Sand")).toBeVisible();
  await expect(
    page.getByText("Planning estimate only.", { exact: false }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Request supplier quotes" }).click();
  await expect(page.getByLabel("Material list")).toHaveValue(/Sand: 1.07 m³/);
});
