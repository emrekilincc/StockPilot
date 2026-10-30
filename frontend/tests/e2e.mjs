import { chromium, expect } from '@playwright/test'
import { spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { existsSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import net from 'node:net'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const python = path.join(root, '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python')
const screenshots = path.join(root, 'docs', 'screenshots')
mkdirSync(screenshots, { recursive: true })
const password = randomBytes(24).toString('base64url')
const port = await new Promise((resolve, reject) => {
  const server = net.createServer()
  server.on('error', reject)
  server.listen(0, '127.0.0.1', () => { const port = server.address().port; server.close(() => resolve(port)) })
})
const base = `http://127.0.0.1:${port}`
const child = spawn(python, ['-m', 'scripts.qa_server'], {
  cwd: path.join(root, 'backend'), windowsHide: true,
  env: { ...process.env, QA_PASSWORD: password, QA_PORT: String(port) }, stdio: ['pipe', 'pipe', 'pipe'],
})
let serverLog = '', browser, failures = []
child.stdout.on('data', (data) => { serverLog += data.toString() })
child.stderr.on('data', (data) => { serverLog += data.toString() })
child.on('error', (error) => { serverLog += error.message })
const deadline = Date.now() + 45000
try {
  while (true) {
    if (child.exitCode !== null) throw new Error(`QA server exited: ${serverLog.slice(-2000)}`)
    try { if ((await fetch(`${base}/api/health`)).ok) break } catch { /* startup */ }
    if (Date.now() > deadline) throw new Error(`QA server timeout: ${serverLog.slice(-2000)}`)
    await new Promise((resolve) => setTimeout(resolve, 300))
  }
  const candidates = [process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].filter(Boolean)
  const executablePath = candidates.find(existsSync)
  browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) })
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'tr-TR', reducedMotion: 'reduce' })
  const page = await context.newPage()
  page.on('pageerror', (error) => failures.push(error.message))
  const step = (name) => console.log(`PASS ${name}`)
  await page.goto(`${base}/products`)
  await expect(page).toHaveURL(/\/login$/)
  await page.getByLabel('E-posta adresi').fill('qa@example.com')
  await page.getByLabel('Parola', { exact: true }).fill('incorrect-password')
  await page.getByRole('button', { name: 'Giriş yap', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('E-posta veya parola hatalı')
  await page.getByLabel('Parola', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Giriş yap', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Genel bakış', exact: true })).toBeVisible()
  await expect(page.getByText('Satış performansı', { exact: true })).toBeVisible()
  await expect(page.locator('.stat-value').first()).not.toHaveText('₺0,00')
  await page.screenshot({ path: path.join(screenshots, 'dashboard-desktop.png'), animations: 'disabled' })
  step('login, wrong password, protected route, database dashboard')

  await page.getByRole('link', { name: 'Ürünler', exact: true }).click()
  await expect(page.locator('tbody tr')).toHaveCount(20)
  await page.getByRole('button', { name: 'Sonraki sayfa' }).click()
  await expect(page.locator('tbody tr')).toHaveCount(4)
  await page.getByRole('button', { name: 'Yeni ürün', exact: true }).click()
  await page.getByRole('button', { name: 'Ürünü kaydet' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByLabel('Ürün adı', { exact: true }).fill('QA Ergonomik Mouse')
  await page.getByLabel('SKU', { exact: true }).fill('QA-001')
  await page.getByLabel('Kategori', { exact: true }).selectOption({ label: 'Elektronik' })
  await page.getByLabel('Satış fiyatı (₺)').fill('125.50')
  await page.getByLabel('Alış fiyatı (₺)').fill('80')
  await page.getByRole('button', { name: 'Ürünü kaydet' }).click()
  await expect(page.getByRole('heading', { name: 'QA Ergonomik Mouse', exact: true })).toBeVisible()
  const productURL = page.url()
  await page.getByRole('button', { name: 'Stok hareketi', exact: true }).click()
  await page.getByLabel('İşlem adedi').fill('15')
  await page.getByLabel('İşlem açıklaması').fill('Tarayıcı testi stok girişi')
  await page.getByRole('button', { name: 'Hareketi kaydet' }).click()
  await expect(page.getByRole('dialog')).not.toBeVisible()
  await expect(page.locator('.detail-stats').getByText('15 adet')).toBeVisible()
  step('product create, required fields, pagination, stock input')

  await page.getByRole('link', { name: 'Siparişler', exact: true }).click()
  await page.getByRole('button', { name: 'Yeni sipariş', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: 'Müşteri seçin', exact: true }).click()
  await dialog.getByRole('button', { name: /Ada Danışmanlık/ }).click()
  await dialog.getByRole('button', { name: 'Siparişe ürün ekle seçin', exact: true }).click()
  await dialog.getByRole('searchbox').fill('QA-001')
  await dialog.getByRole('button', { name: /QA Ergonomik Mouse/ }).click()
  await dialog.getByRole('button', { name: 'Ekle', exact: true }).click()
  await dialog.getByLabel('QA Ergonomik Mouse adedi').fill('3')
  await dialog.getByRole('button', { name: 'Siparişi kaydet' }).click()
  await expect(page.getByRole('button', { name: 'Siparişi onayla' })).toBeVisible()
  await expect(page.locator('.order-summary-total')).toHaveText('₺376,50')
  await page.getByRole('button', { name: 'Siparişi onayla' }).click()
  await expect(page.getByRole('button', { name: 'Hazırlamaya başla' })).toBeVisible()
  await page.getByRole('button', { name: 'İptal et', exact: true }).click()
  await page.getByRole('button', { name: 'İptali onayla' }).click()
  await expect(page.locator('.order-summary-strip .badge')).toHaveText('İptal edildi')
  await page.goto(productURL)
  await expect(page.locator('.detail-stats').getByText('15 adet')).toBeVisible()
  step('order create, trusted totals, confirm, cancel and stock restoration')

  for (const [route, heading] of [['categories', 'Kategoriler'], ['inventory', 'Stok hareketleri'], ['customers', 'Müşteriler'], ['suppliers', 'Tedarikçiler'], ['users', 'Kullanıcılar'], ['settings', 'Ayarlar'], ['reports', 'Raporlar']]) {
    await page.goto(`${base}/${route}`)
    await expect(page.getByRole('heading', { name: heading, exact: true }).first()).toBeVisible()
    await expect(page.locator('.skeleton-list')).toHaveCount(0)
    await expect(page.getByRole('alert')).toHaveCount(0)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
    expect(overflow, `desktop overflow on ${route}`).toBe(false)
  }
  const download = page.waitForEvent('download')
  await page.getByRole('link', { name: 'CSV dışa aktar' }).click()
  expect((await download).suggestedFilename()).toBe('stockpilot-monthly.csv')
  step('all module routes, desktop overflow, CSV download')

  await page.goto(base)
  await expect(page.locator('.stat-value')).toHaveCount(4)
  await page.getByRole('button', { name: 'Koyu temaya geç' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.waitForFunction(() => getComputedStyle(document.querySelector('.brand')).color === 'rgb(232, 236, 247)')
  await page.screenshot({ path: path.join(screenshots, 'dashboard-dark.png'), animations: 'disabled' })
  await page.getByRole('button', { name: 'Açık temaya geç' }).click()
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.getByRole('button', { name: 'Menüyü aç' })).toBeVisible()
  await page.screenshot({ path: path.join(screenshots, 'dashboard-mobile.png'), fullPage: true, animations: 'disabled' })
  for (const [route, heading] of [['products', 'Ürünler'], ['orders', 'Siparişler'], ['customers', 'Müşteriler'], ['inventory', 'Stok hareketleri'], ['reports', 'Raporlar'], ['settings', 'Ayarlar']]) {
    await page.goto(`${base}/${route}`)
    await expect(page.getByRole('heading', { name: heading, exact: true }).first()).toBeVisible()
    await expect(page.locator('.skeleton-list')).toHaveCount(0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), `mobile overflow on ${route}`).toBe(false)
  }
  await page.getByRole('button', { name: 'Menüyü aç' }).click()
  await page.getByRole('link', { name: 'Ürünler', exact: true }).click()
  await expect(page.locator('.sidebar')).not.toHaveClass(/open/)
  await page.getByRole('button', { name: 'Yeni ürün', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  const bounds = await page.getByRole('dialog').boundingBox()
  expect(bounds.x >= 0 && bounds.x + bounds.width <= 390).toBe(true)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).not.toBeVisible()
  step('dark theme, mobile routes and menu, modal sizing, Escape keyboard interaction')

  await page.getByRole('button', { name: 'Menüyü aç' }).click()
  await page.getByRole('button', { name: 'Çıkış yap' }).click()
  await expect(page.getByRole('heading', { name: 'Tekrar hoş geldiniz' })).toBeVisible()
  expect(failures).toEqual([])
  step('logout, no browser runtime errors')
  console.log('E2E passed. Temporary database and generated test credentials only.')
} catch (error) {
  console.error(error.message)
  if (browser) {
    const pages = browser.contexts().flatMap((context) => context.pages())
    if (pages[0]) await pages[0].screenshot({ path: path.join(root, 'artifacts', 'e2e-failure.png'), fullPage: true }).catch(() => {})
  }
  process.exitCode = 1
} finally {
  await browser?.close()
  child.stdin.end('stop\n')
  await new Promise((resolve) => {
    if (child.exitCode !== null) { resolve(); return }
    const timer = setTimeout(() => { child.kill(); resolve() }, 5000)
    child.once('exit', () => { clearTimeout(timer); resolve() })
  })
}
