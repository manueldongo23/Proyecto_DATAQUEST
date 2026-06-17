import { Page, expect } from '@playwright/test';

export async function waitForApp(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('main')).toBeVisible({ timeout: 10000 });
}

export async function navigateTo(page: Page, view: string) {
  const button = page.getByRole('button', { name: new RegExp(view, 'i') });
  if (await button.isVisible()) {
    await button.click();
    await page.waitForTimeout(500);
  }
}

export async function getErrors(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));
  return errors;
}
