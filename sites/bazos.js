const { waitForAnySelector, extractListings } = require("./scrapeUtils");

const scrapeBazos = async (page, countryDomain, query) => {
  const site = `bazos.${countryDomain}`;
  const submitLabel = countryDomain === "cz" ? "Hledat" : "Hľadať";
  const params = new URLSearchParams({
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
  const url = `https://www.bazos.${countryDomain}/search.php?${params.toString()}`;

  await page.goto(url, { waitUntil: "domcontentloaded" });

  const selectors = {
    row: [".inzeraty.inzeratyflex"],
    title: ["h2.nadpis a", "h2 a"],
    link: ["h2.nadpis a", "h2 a"],
    price: [".inzeratycena span", ".inzeratycena"],
    image: ["img.obrazek", ".inzeratynadpis img"]
  };

  try {
    await waitForAnySelector(page, selectors.row, 15000);
  } catch (err) {
    console.warn(`[${site}] No results found for "${query}": ${err.message}`);
    return [];
  }

  const results = await extractListings(page, selectors);

  return results.map((r) => ({
    ...r,
    site
  }));
};

module.exports = { scrapeBazos };
