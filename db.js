const sqlite3 = require("sqlite3").verbose();

const db = new sqlite3.Database("./bikewatch.db");

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS listings (
      id TEXT PRIMARY KEY,
      site TEXT,
      title TEXT,
      price TEXT,
      url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
});

function hasListing(id) {
  return new Promise((resolve, reject) => {
    db.get("SELECT id FROM listings WHERE id = ?", [id], (err, row) => {
      if (err) return reject(err);
      resolve(!!row);
    });
  });
}

function saveListing(listing) {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO listings (id, site, title, price, url) VALUES (?, ?, ?, ?, ?)`,
      [listing.id, listing.site, listing.title, listing.price, listing.url],
      (err) => {
        if (err) return reject(err);
        resolve();
      }
    );
  });
}

function getAllListings() {
  return new Promise((resolve, reject) => {
    db.all("SELECT * FROM listings ORDER BY created_at DESC", (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });
}

module.exports = {
  hasListing,
  saveListing,
  getAllListings
};
