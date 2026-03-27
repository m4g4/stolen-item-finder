const { spawnSync } = require("child_process");
const config = require("./config");

async function sendEmailAlert(listing) {
  if (!config.email?.enabled || !config.email?.to) return;

  const subject = `[Stolen Bike] ${listing.title} - ${listing.price}`;
  const body =
    `Possible match found!\n\n` +
    `Site: ${listing.site}\n` +
    `Title: ${listing.title}\n` +
    `Price: ${listing.price}\n` +
    `Link: ${listing.url}`;

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
    console.log(`Email sent: ${subject}`);
  } catch (err) {
    console.error("Failed to send email:", err.message);
  }
}

module.exports = { sendEmailAlert };
