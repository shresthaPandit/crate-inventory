// Captures real screens of Crate for the product video.
// node scripts/capture.mjs [baseUrl]
import puppeteer from "puppeteer-core"
import { mkdirSync } from "node:fs"

const BASE = process.argv[2] ?? "https://crate-inventory-eight.vercel.app"
const OUT = new URL("../public/shots/", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1")
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe"
mkdirSync(OUT, { recursive: true })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  defaultViewport: { width: 1440, height: 900, deviceScaleFactor: 2 },
})
const page = await browser.newPage()

async function go(path, settle = 1800) {
  await page.goto(BASE + path, { waitUntil: "networkidle0" })
  await page.waitForFunction(() => document.querySelector("main h1"), { timeout: 20000 })
  await sleep(settle)
}

async function shot(name) {
  await page.screenshot({ path: OUT + name + ".png" })
  console.log("saved", name)
}

/** Click the deepest visible element whose trimmed text is exactly `text`. */
async function clickText(text, within = "body") {
  const ok = await page.evaluate(
    (text, within) => {
      const root = document.querySelector(within) ?? document.body
      const all = [...root.querySelectorAll("*")].filter(
        (el) => el.textContent?.trim() === text && el.getClientRects().length > 0,
      )
      const deepest = all.filter((el) => !all.some((o) => o !== el && el.contains(o)))
      const el = deepest[0]
      if (!el) return false
      el.scrollIntoView({ block: "center" })
      el.click()
      return true
    },
    text,
    within,
  )
  if (!ok) throw new Error("not found: " + text)
  await sleep(1000)
}

// fresh seed, dark theme
await page.goto(BASE + "/", { waitUntil: "networkidle0" })
await page.evaluate(() => {
  localStorage.clear()
  localStorage.setItem("theme", "dark")
})

await go("/", 2600)
await shot("dashboard")

await go("/stock")
await shot("stock")
await clickText("LED panel 15W, round, cool white", "main")
await sleep(900)
await shot("item")
await page.keyboard.press("Escape")

await go("/purchases")
await shot("purchases")
await clickText("PO-1141", "main table")
await sleep(600)
await shot("po")
await clickText("Mark received", "[role=dialog]")
await sleep(500)
await shot("po-received")
await page.keyboard.press("Escape")

await go("/", 2600)
await shot("dashboard-after")

await go("/sales")
await shot("sales")
await clickText("Kulkarni Builders", "main table")
await sleep(600)
await shot("sale")
await clickText("Ship order", "[role=dialog]")
await sleep(500)
await shot("sale-shipped")
await page.keyboard.press("Escape")

await go("/godowns")
await shot("godowns")
await go("/reports", 3000)
await shot("reports")
await go("/transfers")
await shot("transfers")

await go("/")
await page.keyboard.down("Control")
await page.keyboard.press("k")
await page.keyboard.up("Control")
await sleep(500)
await page.keyboard.type("led", { delay: 60 })
await sleep(500)
await shot("command")
await page.keyboard.press("Escape")

await page.evaluate(() => localStorage.setItem("theme", "light"))
await go("/", 2600)
await shot("dashboard-light")
await go("/stock")
await shot("stock-light")

await page.evaluate(() => localStorage.setItem("theme", "dark"))
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 3 })
await go("/", 2600)
await shot("mobile-dashboard")
await go("/sales")
await shot("mobile-sales")

await browser.close()
