import { test, expect } from '@playwright/test';

test('login page should load and show main elements', async ({ page }) => {
  await page.goto('/login');

  // Expect a title "to contain" a substring.
  await expect(page).toHaveTitle(/Create Next App/);

  // Check for the main heading
  await expect(page.getByText('Bem-vindo de volta')).toBeVisible();

  // Check for input fields
  await expect(page.getByPlaceholder('seu@email.com')).toBeVisible();
  await expect(page.getByPlaceholder('••••••••')).toBeVisible();

  // Check for the login button
  await expect(page.getByRole('button', { name: 'Entrar no Sistema' })).toBeVisible();
});

test('should allow typing in email and password fields', async ({ page }) => {
  await page.goto('/login');

  const emailInput = page.getByPlaceholder('seu@email.com');
  const passwordInput = page.getByPlaceholder('••••••••');

  await emailInput.fill('teste@exemplo.com');
  await passwordInput.fill('senha123');

  await expect(emailInput).toHaveValue('teste@exemplo.com');
  await expect(passwordInput).toHaveValue('senha123');
});
