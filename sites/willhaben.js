const { waitForAnySelector } = require("./scrapeUtils");

const scrapeWillhaben = async (page, query) => {
  const site = "willhaben.at";
  const url = new URL(
    "https://www.willhaben.at/iad/kaufen-und-verkaufen/marktplatz"
  );
  url.searchParams.set("keyword", query);

  await page.goto(url.toString(), { waitUntil: "domcontentloaded" });

  try {
    await waitForAnySelector(page, ["script#__NEXT_DATA__"], 15000);
  } catch (err) {
    console.warn(`[${site}] No results found for "${query}": ${err.message}`);
    return [];
  }

  const results = await page.evaluate(() => {
    const script = document.querySelector("script#__NEXT_DATA__");
    if (!script || !script.textContent) return [];

    let data;
    try {
      data = JSON.parse(script.textContent);
    } catch {
      return [];
    }

    const ads =
      data?.props?.pageProps?.searchResult?.advertSummaryList?.advertSummary ||
      [];

    const normalize = (value) =>
      value ? String(value).replace(/\s+/g, " ").trim() : "";

    const getAttrMap = (ad) => {
      const map = {};
      const attrs = ad?.attributes?.attribute || [];
      for (const attr of attrs) {
        if (!attr?.name) continue;
        const val = Array.isArray(attr.values) ? attr.values[0] : attr.values;
        map[attr.name] = val;
      }
      return map;
    };

    return ads
      .map((ad) => {
        const attrs = getAttrMap(ad);
        const title = normalize(attrs.HEADING || ad?.description || "");
        const price =
          normalize(attrs.PRICE_FOR_DISPLAY || attrs.PRICE || attrs["PRICE/AMOUNT"]) ||
          "N/A";

        const seoUrl = attrs.SEO_URL || "";
        let url = "";
        if (seoUrl) {
          url = `https://www.willhaben.at/iad/${seoUrl.replace(/^[\/]+/, "")}`;
        } else if (ad?.id) {
          url = `https://www.willhaben.at/iad/object?adId=${ad.id}`;
        }

        const image =
          ad?.advertImageList?.advertImage?.[0]?.mainImageUrl || null;

        return {
          title,
          price,
          url,
          id: url || String(ad?.id || ""),
          image
        };
      })
      .filter((item) => item.title && item.url);
  });

  return results.map((r) => ({
    ...r,
    site
  }));
};

module.exports = { scrapeWillhaben };
