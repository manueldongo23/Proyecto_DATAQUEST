import { test, expect } from '@playwright/test';

test.describe('Smoke Tests', () => {
  test('app loads without errors', async ({ page }) => {
    const errors: string[] = [];
    
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    
    await page.goto('/');
    
    // Wait for app to render
    await expect(page.getByRole('main')).toBeVisible({ timeout: 10000 });
    
    // No critical errors
    const criticalErrors = errors.filter(e => 
      !e.includes('favicon') && 
      !e.includes('404') && 
      !e.includes('Failed to load resource')
    );
    
    expect(criticalErrors).toEqual([]);
  });

  test('sidebar is accessible via keyboard', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Tab'); // Focus skip link
    await page.keyboard.press('Tab'); // Focus first sidebar item
    
    const focused = page.locator(':focus');
    await expect(focused).toBeVisible();
  });

  test('page has proper title', async ({ page }) => {
    await page.goto('/');
    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);
  });
});
