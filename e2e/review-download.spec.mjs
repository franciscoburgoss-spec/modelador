import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

test('SPEC-003-E: la aplicación abre la revisión y descarga su informe', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto('/');
  await expect(page.getByRole('button', { name: /Herramientas/ })).toBeVisible();

  await page.getByRole('button', { name: /Herramientas/ }).click();
  await page.getByRole('button', { name: 'Verificación' }).hover();
  await page.getByRole('button', { name: 'Validación geométrica' }).click();

  await expect(
    page.getByRole('heading', { name: 'Verificación de coherencia geométrica' })
  ).toBeVisible();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar informe (.md)' }).click();
  const download = await downloadPromise;
  assertDownloadName(download.suggestedFilename());

  const downloadPath = await download.path();
  const markdown = await readFile(downloadPath, 'utf8');
  expect(markdown).toContain('# Informe de revisión constructiva');
  expect(markdown).toContain('## Resumen');

  await page.getByRole('button', { name: 'Cerrar' }).click();
  await expect(
    page.getByRole('heading', { name: 'Verificación de coherencia geométrica' })
  ).toBeHidden();
  expect(pageErrors).toEqual([]);
});

function assertDownloadName(filename) {
  expect(filename).toBe('revision-constructiva.md');
}
