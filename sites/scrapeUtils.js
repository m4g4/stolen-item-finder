async function waitForAnySelector(page, selectors, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    for (const sel of selectors) {
      // eslint-disable-next-line no-await-in-loop
      const handle = await page.$(sel);
      if (handle) return sel;
    }
    // eslint-disable-next-line no-await-in-loop
    await page.waitForTimeout(250);
  }
  throw new Error(`Timeout waiting for selectors: ${selectors.join(", ")}`);
}

async function extractListings(page, selectors) {
  return page.evaluate((selectorsArg) => {
    const normalize = (value) =>
      value ? value.replace(/\s+/g, " ").trim() : "";

    const pick = (root, list) => {
      for (const sel of list) {
        const el = root.querySelector(sel);
        if (el) return el;
      }
      return null;
    };

    const getText = (el) => normalize(el ? el.textContent : "");

    const getAttr = (el, names) => {
      if (!el) return "";
      for (const name of names) {
        const val = el.getAttribute(name);
        if (val) return val;
      }
      return "";
    };

    const toAbsoluteUrl = (url) => {
      if (!url) return "";
      try {
        return new URL(url, window.location.origin).href;
      } catch {
        return url;
      }
    };

    const rows = Array.from(
      document.querySelectorAll(selectorsArg.row.join(","))
    );

    const items = rows.map((row) => {
      const titleEl = pick(row, selectorsArg.title);
      const linkEl = pick(row, selectorsArg.link || selectorsArg.title);
      const priceEl = pick(row, selectorsArg.price || []);
      const imgEl = pick(row, selectorsArg.image || []);

      const title = getText(titleEl);
      const link = toAbsoluteUrl(linkEl ? linkEl.getAttribute("href") : "");
      const price = getText(priceEl) || "N/A";

      let image = getAttr(imgEl, ["data-src", "data-lazy", "src"]);
      if (image && image.startsWith("//")) {
        image = `${window.location.protocol}${image}`;
      }
      image = toAbsoluteUrl(image);

      const id = link;

      return {
        title,
        price,
        url: link,
        id,
        image: image || null
      };
    });

    return items.filter((item) => item.title && item.url);
  }, selectors);
}

module.exports = {
  waitForAnySelector,
  extractListings
};
