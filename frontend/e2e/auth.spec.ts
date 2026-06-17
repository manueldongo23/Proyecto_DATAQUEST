import { test, expect } from '@playwright/test';

test.describe('Authentication Flows', () => {
  test('should show login and register modal', async ({ page }) => {
    await page.goto('/');
    
    // Find and click login button
    const loginBtn = page.getByRole('button', { name: /iniciar sesión/i });
    await expect(loginBtn).toBeVisible();
    await loginBtn.click();
    
    // Modal should appear
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText(/registrarse/i)).toBeVisible();
  });

  test('should switch between login and register', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /iniciar sesión/i }).click();
    
    // Switch to register
    await page.getByText(/registrate aquí/i).click();
    await expect(page.getByLabel(/correo electrónico/i)).toBeVisible();
    await expect(page.getByLabel(/apodo/i)).toBeVisible();
    await expect(page.getByLabel(/contraseña/i)).toBeVisible();
  });

  test('should show validation errors on empty form', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /iniciar sesión/i }).click();
    await page.getByText(/registrate aquí/i).click();
    
    // Submit empty form
    await page.getByRole('button', { name: /registrarse/i }).click();
    
    // Should show validation errors
    await expect(page.getByText(/requerido|obligatorio/i).first()).toBeVisible();
  });

  test('should reject blocked nickname', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /iniciar sesión/i }).click();
    await page.getByText(/registrate aquí/i).click();
    
    // Fill with blocked name
    await page.getByLabel(/apodo/i).fill('admin');
    await page.getByLabel(/correo electrónico/i).fill('test@example.com');
    await page.getByLabel(/contraseña/i).fill('Test1234!');
    
    // This might be blocked client-side or by the API
    // Submit and check result
    await page.getByRole('button', { name: /registrarse/i }).click();
    
    // Should show error (either validation or API error)
    await expect(page.getByText(/términos no permitidos|bloqueado|no permitido/i).or(
      page.getByText(/error/i)
    )).toBeVisible();
  });
});
