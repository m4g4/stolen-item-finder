const { waitForAnySelector, scrollToLoadImages, handleCookiePopup } = require("./scrapeUtils");

const scrapeMtbiker = async (page, query) => {
  const site = "mtbiker_sk";
  const allResults = [];
  let od = 1;

  while (true) {
    const url = `https://www.mtbiker.sk/bazar/all?modul=bazar&s=${encodeURIComponent(query)}&od=${od}`;

    console.log(`[${site}] Scraping page ${od}: ${url}`);

    await page.goto(url, { waitUntil: "domcontentloaded" });
    await handleCookiePopup(page);

    const emptyState = await page.$("div.alert.alert-primary");
    if (emptyState) {
      const emptyText = await page.evaluate(el => el.textContent, emptyState);
      if (emptyText.includes("Žiadne inzeráty")) {
        console.log(`[${site}] No more results`);
        break;
      }
    }

    try {
      await waitForAnySelector(page, [".bazaar-item"], 15000);
    } catch (err) {
      console.warn(`[${site}] No results on page ${od}: ${err.message}`);
      if (od === 1) {
        return { listings: [], error: `No results found: ${err.message}` };
      }
      break;
    }

    await scrollToLoadImages(page);

    const results = await extractMtbikerListings(page);
    allResults.push(...results.map(r => ({ ...r, site })));

    if (results.length < 10) {
      break;
    }

    od++;

    if (od > 20) break;
  }

  console.log(`[${site}] Total results: ${allResults.length}`);
  return { listings: allResults };
};

async function extractMtbikerListings(page) {
  return page.evaluate(() => {
    const normalize = value =>
      value ? value.replace(/\s+/g, " ").trim() : "";

    const items = [];
    const rows = document.querySelectorAll(".bazaar-item");

    rows.forEach(row => {
      const titleEl = row.querySelector(".bazaar-item-title a");
      if (!titleEl) return;

      const title = normalize(titleEl.textContent);
      const url = titleEl.href;
      if (!title || !url) return;

      const rowId = row.id || "";
      const id = rowId || url;

      const priceEl = row.querySelector(".badge-dark") || row.querySelector(".bazaar-item-info strong.text-biggest");
      const price = priceEl ? normalize(priceEl.textContent) : "N/A";

      let image = "";
      const imgEl = row.querySelector(".photo-thumb img");
      if (imgEl) {
        image = imgEl.getAttribute("data-src") || imgEl.getAttribute("src") || "";
        if (image.startsWith("//")) {
          image = window.location.protocol + image;
        }
      }

      let date = null;
      const dateEl = row.querySelector(".metadata-date");
      if (dateEl) {
        const dateSpan = dateEl.querySelector("span");
        date = dateSpan ? normalize(dateSpan.textContent) : normalize(dateEl.textContent);
      }

      items.push({
        title,
        price,
        url,
        id,
        image: image || null,
        date
      });
    });

    return items;
  });
}

module.exports = { scrapeMtbiker };
