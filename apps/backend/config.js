const nodemailer = require("nodemailer");

/**
 * v3.0 Centralized Configuration
 */
function parseOrigins(raw) {
  if (!raw) return [];
  return String(raw)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

const config = {
  port: process.env.PORT || 5000,
  databaseUrl: process.env.DATABASE_URL,
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET,
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET,
  redisUrl: process.env.REDIS_URL || "redis://127.0.0.1:6379",
  /** Comma-separated browser origins for CORS, e.g. https://app.vercel.app */
  corsOrigins: parseOrigins(
    process.env.CORS_ORIGINS || process.env.FRONTEND_URL || ""
  ),
  cloudinary: {
    name: process.env.CLOUDINARY_CLOUD_NAME,
    key: process.env.CLOUDINARY_API_KEY,
    secret: process.env.CLOUDINARY_API_SECRET,
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    refreshToken: process.env.GOOGLE_REFRESH_TOKEN,
  },
  smtp: {
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    from: process.env.SMTP_FROM || '"StoryNest" <no-reply@storynest.com>',
  },
  frontendUrl: process.env.FRONTEND_URL || "storynest://",
  slack: {
    webhookUrl: process.env.SLACK_WEBHOOK_URL,
    signingSecret: process.env.SLACK_SIGNING_SECRET,
  },
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID,
  },
  paystack: {
    secretKey: process.env.PAYSTACK_SECRET_KEY,
    publicKey: process.env.PAYSTACK_PUBLIC_KEY,
  },
  geminiApiKey: process.env.GEMINI_API_KEY,
};

console.log("[Config] v3.4 — Gmail REST + BullMQ + CORS origins:", config.corsOrigins.length || "(default)");

/**
 * Gmail REST API Email Sender (Port 443)
 */
const sendGmail = async ({ to, subject, html }) => {
  const axios = require("axios");
  const { OAuth2Client } = require("google-auth-library");

  const client = new OAuth2Client(config.google.clientId, config.google.clientSecret);
  client.setCredentials({ refresh_token: config.google.refreshToken });

  try {
    const { token } = await client.getAccessToken();

    const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString("base64")}?=`;
    const senderName = "StoryNest";
    const fromHeader = `${senderName} <${config.smtp.auth.user}>`;

    const messageParts = [
      `From: ${fromHeader}`,
      `To: ${to}`,
      `Content-Type: text/html; charset=utf-8`,
      `MIME-Version: 1.0`,
      `Subject: ${utf8Subject}`,
      "",
      html,
    ];
    const message = messageParts.join("\n");

    const encodedMessage = Buffer.from(message)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    await axios.post(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
      { raw: encodedMessage },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return { success: true };
  } catch (error) {
    console.error("[Gmail API] Send Failure:", error.response?.data || error.message);
    throw error;
  }
};

const sendSlack = async (text) => {
  const axios = require("axios");
  if (!config.slack.webhookUrl) return;
  try {
    await axios.post(config.slack.webhookUrl, { text });
    return { success: true };
  } catch (error) {
    console.error("[Slack API] Send Failure:", error.message);
  }
};

module.exports = { config, sendGmail, sendSlack };
