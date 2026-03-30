const { waitForAnySelector, extractListings } = require("./scrapeUtils");

const scrapeBazos = async (page, countryDomain, query) => {
  const site = `bazos.${countryDomain}`;
  const submitLabel = countryDomain === "cz" ? "Hledat" : "Hľadať";
  const baseParams = new URLSearchParams({
    hledat: query,
    rubriky: "www",
    hlokalita: "",
    humkreis: "25",
    cenaod: "",
    cenado: "",
    Submit: submitLabel,
    order: "",
    kitx: "ano"
  });
  let baseUrl = `https://www.bazos.${countryDomain}/search.php?${baseParams.toString()}`;

  const selectors = {
    row: [".inzeraty.inzeratyflex"],
    title: ["h2.nadpis a", "h2 a"],
    link: ["h2.nadpis a", "h2 a"],
    price: [".inzeratycena span", ".inzeratycena"],
    image: ["img.obrazek", ".inzeratynadpis img"],
    date: ["span.velikost10"],
    nextPage: ["div.strankovani a[rel='nofollow']"]
  };

  const allResults = [];
  let currentPage = 1;
  let hasNextPage = true;

  while (hasNextPage) {
    console.log(`[${site}] Scraping page ${currentPage}: ${baseUrl}`);

    await page.goto(baseUrl, { waitUntil: "domcontentloaded" });

    try {
      await waitForAnySelector(page, selectors.row, 15000);
    } catch (err) {
      console.warn(`[${site}] No results found on page ${currentPage}: ${err.message}`);
      break;
    }

    const results = await extractListings(page, selectors);
    allResults.push(...results.map((r) => ({
      ...r,
      site
    })));

    const nextPageEl = await page.$(selectors.nextPage.join(","));
    if (nextPageEl) {
      const nextHref = await page.evaluate(el => el.href, nextPageEl);
      if (nextHref && nextHref.includes("bazos.")) {
        baseUrl = nextHref;
      } else {
        hasNextPage = false;
      }
    } else {
      hasNextPage = false;
    }
    currentPage++;
  }

  console.log(`[${site}] Total results: ${allResults.length}`);

  return allResults;
};

module.exports = { scrapeBazos };
