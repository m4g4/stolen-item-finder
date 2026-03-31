const { waitForAnySelector } = require("./scrapeUtils");

const scrapeJofogas = async (page, query) => {
  const site = "jofogas.hu";
  const baseUrl = `https://www.jofogas.hu/magyarorszag?q=${encodeURIComponent(query)}`;

  const selectors = {
    dataScript: "script#__NEXT_DATA__",
    nextPage: ["[data-testid='pagination'] button[aria-label='Következő oldalra']:not([disabled])", "[data-testid='pagination'] a[aria-label*='Next']"]
  };

  const extractResults = async () => {
    return page.evaluate(() => {
      const script = document.querySelector("script#__NEXT_DATA__");
      if (!script || !script.textContent) return [];

      let data;
      try {
        data = JSON.parse(script.textContent);
      } catch {
        return [];
      }

      const ads = data?.props?.pageProps?.adList?.ads || [];
      return ads.map((ad) => {
        const image =
          ad?.images?.find((img) =>
            img.image_size_variations?.some((v) => v.type === "620x620aspect")
          )?.image_size_variations?.find((v) => v.type === "620x620aspect")?.url ||
          ad?.images?.[0]?.url ||
          null;

        return {
          title: ad?.subject || "",
          price: ad?.price?.label || "N/A",
          url: ad?.url || "",
          id: ad?.url || "",
          image,
          date: ad?.createdAt ? new Date(ad.createdAt).toLocaleDateString() : null
        };
      }).filter((item) => item.title && item.url);
    });
  };

  const allResults = [];
  let currentPage = 1;
  let hasNextPage = true;

  while (hasNextPage) {
    const url = currentPage === 1 ? baseUrl : `${baseUrl}&page=${currentPage}`;
    console.log(`[${site}] Scraping page ${currentPage}: ${url}`);

    await page.goto(url, { waitUntil: "domcontentloaded" });

    try {
      await waitForAnySelector(page, [selectors.dataScript], 15000);
    } catch (err) {
      console.warn(`[${site}] No results found on page ${currentPage}: ${err.message}`);
      if (currentPage === 1) {
        return { listings: [], error: `No results found: ${err.message}` };
      }
      break;
    }

    const results = await extractResults();
    allResults.push(...results.map((r) => ({
      ...r,
      site
    })));

    const nextPageEl = await page.$(selectors.nextPage.join(","));
    hasNextPage = !!nextPageEl;
    currentPage++;
  }

  console.log(`[${site}] Total results: ${allResults.length}`);

  return { listings: allResults };
};

module.exports = { scrapeJofogas };
