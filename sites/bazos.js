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
      if (currentPage === 1) {
        return { listings: [], error: `No results found: ${err.message}` };
      }
      break;
    }

    const results = await extractListings(page, selectors);
    allResults.push(...results.map((r) => ({
      ...r,
      site
    })));

    const nextPageLinks = await page.$$(selectors.nextPage.join(","));
    
    let hasNextPageLink = false;
    let nextUrl = null;
    
    for (const link of nextPageLinks) {
      const text = await page.evaluate(el => el.textContent.trim().toLowerCase(), link);
      if (text.includes("další") || text.includes("ďalšia")) {
        hasNextPageLink = true;
        nextUrl = await page.evaluate(el => el.href, link);
        break;
      }
    }
    
    if (hasNextPageLink && nextUrl && nextUrl.includes("bazos.")) {
      baseUrl = nextUrl;
    } else {
      hasNextPage = false;
    }
    currentPage++;
  }

  console.log(`[${site}] Total results: ${allResults.length}`);

  return { listings: allResults };
};

module.exports = { scrapeBazos };
