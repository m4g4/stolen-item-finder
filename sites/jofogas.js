const { waitForAnySelector } = require("./scrapeUtils");

const scrapeJofogas = async (page, query) => {
  const site = "jofogas.hu";
  const url = `https://www.jofogas.hu/magyarorszag?q=${encodeURIComponent(query)}`;

  await page.goto(url, { waitUntil: "domcontentloaded" });

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

  return results.map((r) => ({
    ...r,
    site
  }));
};

module.exports = { scrapeJofogas };
