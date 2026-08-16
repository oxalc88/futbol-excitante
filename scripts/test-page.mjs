import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  page.on("console", (msg) => console.log("CONSOLE:", msg.type(), msg.text()));
  page.on("pageerror", (err) => console.log("PAGE_ERROR:", err.message));

  await page.goto("http://127.0.0.1:5173/src/apps/browser/index.html?mode=ai-match", {
    waitUntil: "networkidle",
  });
  await page.waitForTimeout(5000);

  const info = await page.evaluate(() => ({
    title: document.title,
    bodyLen: document.body.innerHTML.length,
    hasGameContainer: !!document.getElementById("game-container"),
    allIds: Array.from(document.querySelectorAll("[id]")).map((el) => el.id),
    bodyText: document.body.innerText.substring(0, 300),
  }));
  console.log("Info:", JSON.stringify(info, null, 2));

  await page.screenshot({ path: "docs/screenshots/BROWSER-MATCH-START-URL/frame-000.png" });
  console.log("Screenshot saved.");

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
