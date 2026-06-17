import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test('should navigate through all main views', async ({ page }) => {
    await page.goto('/');
    
    // Dashboard should be visible by default
    await expect(page.getByText(/dataquest|panel principal|academia/i).first()).toBeVisible();
    
    // Test all sidebar navigation items
    const navItems = [
      { label: /laboratorio|normalización|lab/i, expected: /atributos|dependencias|validar/i },
      { label: /academia/i, expected: /ruta de aprendizaje|forma normal/i },
      { label: /juegos|retos/i, expected: /juegos|puzzles|retos/i },
    ];
    
    for (const item of navItems) {
      const navLink = page.getByRole('button', { name: item.label }).or(
        page.getByRole('link', { name: item.label })
      ).first();
      
      await navLink.click();
      await page.waitForTimeout(500);
      
      // Check that the view changed
      await expect(page.getByText(item.expected).first()).toBeVisible();
    }
  });

  test('should have working sidebar', async ({ page }) => {
    await page.goto('/');
    
    const sidebar = page.getByRole('navigation');
    await expect(sidebar).toBeVisible();
    
    // Should have nav items
    const navItems = sidebar.getByRole('button').or(sidebar.getByRole('link'));
    await expect(navItems.first()).toBeVisible();
  });

  test('should show academy learning path', async ({ page }) => {
    await page.goto('/');
    
    // Navigate to academy
    await page.getByRole('button', { name: /academia/i }).click();
    await page.waitForTimeout(500);
    
    // Academy should show learning path
    await expect(page.getByText(/ruta de aprendizaje|formas normales/i).first()).toBeVisible();
    
    // Should list normal forms
    await expect(page.getByText(/1FN|2FN|3FN|BCNF/i).first()).toBeVisible();
  });
});
