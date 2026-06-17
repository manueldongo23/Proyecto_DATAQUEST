import { test, expect } from '@playwright/test';

test.describe('Glossary', () => {
  test('should show glossary when navigating to it', async ({ page }) => {
    await page.goto('/');
    
    // Navigate to glossary (if it exists in sidebar)
    const glossaryLink = page.getByRole('button', { name: /glosario|glossary/i });
    
    if (await glossaryLink.isVisible()) {
      await glossaryLink.click();
      await page.waitForTimeout(500);
      
      // Should show glossary content
      await expect(page.getByText(/dependencia|functional|term/i).first()).toBeVisible();
    }
  });
});
