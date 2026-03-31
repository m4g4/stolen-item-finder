const { spawnSync } = require("child_process");
const config = require("./config");

async function sendEmailAlert(listing) {}

async function sendSummaryEmail(listings, reportUrl, errors = []) {
  if (!config.email?.enabled || !config.email?.to) return;
  if (listings.length === 0 && errors.length === 0) return;

  const itemsSummary = listings.map(item =>
    `- ${item.title} (${item.price}) - ${item.url}`
  ).join("\n");

  const errorsSummary = errors.length > 0
    ? `\n\n⚠️ Scrape Errors (${errors.length}):\n` +
      errors.map(e => `- ${e.site}/${e.query}: ${e.error}`).join("\n")
    : "";

  const subject = errors.length > 0 
    ? `[Stolen Bike] ${listings.length} listings, ${errors.length} errors`
    : `[Stolen Bike] Found ${listings.length} new listings`;
  const body =
    (listings.length > 0 
      ? `Found ${listings.length} possible matches!\n\n${itemsSummary}`
      : `No new listings found.`) +
    `${errorsSummary}\n\n` +
    `Full report: ${reportUrl}`;

  const emailContent = `To: ${config.email.to}
Subject: ${subject}

${body}`;

  try {
    const result = spawnSync(
      "msmtp",
      ["--tls=on", "--tls-certcheck=off", config.email.to],
      { input: emailContent, stdio: ["pipe", "inherit", "inherit"] }
    );
    if (result.status !== 0) {
      throw new Error(`msmtp exited with code ${result.status}`);
    }
    console.log(`Summary email sent with ${listings.length} listings`);
  } catch (err) {
    console.error("Failed to send email:", err.message);
  }
}

module.exports = { sendEmailAlert, sendSummaryEmail };
