import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

const APP_URL = "http://localhost:3000";

const uniqueEmail = () =>
  `e2e+${Date.now()}${Math.floor(Math.random() * 1000)}@example.com`;

const validDob = () => {
  const today = new Date();
  return `${today.getFullYear() - 19}-01-01`;
};

test.beforeEach(async ({ page }) => {
  await page.goto(`${APP_URL}/signup`);
});

async function fillStepOne(
  page: Page,
  {
    email = uniqueEmail(),
    password = "ValidPass1!",
  }: { email?: string; password?: string } = {},
) {
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.fill('input[name="confirmPassword"]', password);
  return email;
}

async function fillStepTwo(page: Page) {
  await page.fill('input[name="firstName"]', "Test");
  await page.fill('input[name="lastName"]', "User");
  await page.fill('input[name="phoneNumber"]', "+14155552671");
  await page.fill('input[name="dateOfBirth"]', validDob());
  await page.locator("form").getByRole("button", { name: "Next" }).click();
}

async function fillStepThree(
  page: Page,
  { state = "CA", ssn }: { state?: string; ssn?: string } = {},
) {
  const randomSsn =
    ssn ||
    `${Math.floor(Math.random() * 900000000)
      .toString()
      .padStart(9, "0")}`;
  await page.fill('input[name="ssn"]', randomSsn);
  await page.fill('input[name="address"]', "123 Main St");
  await page.fill('input[name="city"]', "Testville");
  await page.fill('input[name="state"]', state);
  await page.fill('input[name="zipCode"]', "12345");
}

async function completeSignupAndCreateAccount(page: Page) {
  await fillStepOne(page);
  await page.locator("form").getByRole("button", { name: "Next" }).click();
  await fillStepTwo(page);
  await fillStepThree(page);
  await page.getByRole("button", { name: "Create Account" }).click();
  await page.waitForURL("**/dashboard");
  await page.getByRole("button", { name: "Open New Account" }).click();
  await page
    .locator("form")
    .getByRole("button", { name: "Create Account" })
    .click();
  await expect(
    page.getByRole("button", { name: "Fund Account" }).first(),
  ).toBeVisible();
}

async function openFundingModal(page: Page) {
  await page.getByRole("button", { name: "Fund Account" }).first().click();
  await expect(
    page.getByRole("heading", { name: "Fund Your Account" }),
  ).toBeVisible();
}

async function submitFunding(page: Page, amount: string) {
  await page.fill('input[name="amount"]', amount);
  await page.fill('input[name="accountNumber"]', "4242424242424242");
  await page.getByRole("button", { name: "Fund Account" }).last().click();
  await page
    .getByRole("heading", { name: "Fund Your Account" })
    .waitFor({ state: "detached" });
}

async function fundAccount(page: Page, amount: string) {
  await openFundingModal(page);
  await submitFunding(page, amount);
}

async function selectFirstAccountCard(page: Page) {
  const card = page.locator("dd").filter({ hasText: "Account: ****" }).first();
  await card.click();
  await expect(
    page.getByRole("heading", { name: "Transaction History" }),
  ).toBeVisible();
}

test("shows email and password validation errors", async ({ page }) => {
  await fillStepOne(page, { email: "invalid", password: "short" });
  await page.locator("form").getByRole("button", { name: "Next" }).click();
  await expect(page.getByText("Invalid email address")).toBeVisible();
  await expect(
    page.getByText("Password must be at least 8 characters"),
  ).toBeVisible();
});

test("rejects underage dob and invalid phone number", async ({ page }) => {
  await fillStepOne(page);
  await page.locator("form").getByRole("button", { name: "Next" }).click();

  await page.fill('input[name="firstName"]', "Test");
  await page.fill('input[name="lastName"]', "User");
  await page.fill('input[name="phoneNumber"]', "+1(234)");
  await page.fill('input[name="dateOfBirth"]', "2010-01-01");
  await page.locator("form").getByRole("button", { name: "Next" }).click();

  await expect(
    page.getByText("Enter a valid phone number with country code"),
  ).toBeVisible();
  await expect(
    page.getByText("You must be at least 18 years old"),
  ).toBeVisible();
});

test("rejects invalid state codes on final step", async ({ page }) => {
  await fillStepOne(page);
  await page.locator("form").getByRole("button", { name: "Next" }).click();
  await fillStepTwo(page);
  await fillStepThree(page, { state: "XX" });
  await page.getByRole("button", { name: "Create Account" }).click();
  await expect(
    page.getByText("Enter a valid 2-letter US state code"),
  ).toBeVisible();
});

test("accepts valid user info and shows step 3 fields", async ({ page }) => {
  await fillStepOne(page);
  await page.locator("form").getByRole("button", { name: "Next" }).click();
  await fillStepTwo(page);
  await expect(page.locator('input[name="ssn"]')).toBeVisible();
});

test("funding modal rejects invalid credit card number", async ({ page }) => {
  await completeSignupAndCreateAccount(page);
  await openFundingModal(page);
  await page.fill('input[name="amount"]', "50");
  await page.fill('input[name="accountNumber"]', "4242424242424241");
  await page.getByRole("button", { name: "Fund Account" }).last().click();
  await expect(page.getByText("Invalid card number")).toBeVisible();
});

test("funding modal rejects amount leading zeros", async ({ page }) => {
  await completeSignupAndCreateAccount(page);
  await openFundingModal(page);
  await page.fill('input[name="amount"]', "000.50");
  await page.fill('input[name="accountNumber"]', "4242424242424242");
  await page.getByRole("button", { name: "Fund Account" }).last().click();
  await expect(page.getByText("Invalid amount format")).toBeVisible();
});

test("funding modal rejects zero amount", async ({ page }) => {
  await completeSignupAndCreateAccount(page);
  await openFundingModal(page);
  await page.fill('input[name="amount"]', "0");
  await page.fill('input[name="accountNumber"]', "4242424242424242");
  await page.getByRole("button", { name: "Fund Account" }).last().click();
  await expect(page.getByText("Amount must be at least $0.01")).toBeVisible();
});

test("routing number required for bank but optional for card", async ({
  page,
}) => {
  await completeSignupAndCreateAccount(page);
  await openFundingModal(page);
  await page.fill('input[name="amount"]', "10");
  await page.locator('input[value="bank"]').check();
  await page.fill('input[name="accountNumber"]', "123456789");
  await page.getByRole("button", { name: "Fund Account" }).last().click();
  await expect(page.getByText("Routing number is required")).toBeVisible();

  await page.locator('input[value="card"]').check();
  await expect(page.getByLabel("Routing Number")).toHaveCount(0);
});

test("successful funding creates transaction entry", async ({ page }) => {
  await completeSignupAndCreateAccount(page);
  await fundAccount(page, "50");
  await selectFirstAccountCard(page);
  const firstRow = page.locator("tbody tr").first();
  await expect(firstRow).toContainText("$50.00");
});

test("all transactions appear after multiple fundings", async ({ page }) => {
  await completeSignupAndCreateAccount(page);
  await fundAccount(page, "25");
  await fundAccount(page, "30");
  await fundAccount(page, "35");
  await fundAccount(page, "40");
  await fundAccount(page, "45");
  await fundAccount(page, "50");
  await selectFirstAccountCard(page);
  await expect(page.locator("tbody tr")).toHaveCount(6);
  await expect(page.locator("dd").filter({ hasText: "$225" })).toHaveCount(1);
  await expect(page.locator("tbody tr").first()).toContainText("$50.00");
});

test("logout revokes dashboard access", async ({ page }) => {
  await completeSignupAndCreateAccount(page);
  await page.getByRole("button", { name: "Sign Out" }).click();
  await expect(page).toHaveURL(`${APP_URL}/`);
  await page.goto(`${APP_URL}/dashboard`);
  await page.getByRole("button", { name: "Open New Account" }).click();
  await page
    .locator("form")
    .getByRole("button", { name: "Create Account" })
    .click();
  await expect(page.getByText("UNAUTHORIZED")).toBeVisible();
});
