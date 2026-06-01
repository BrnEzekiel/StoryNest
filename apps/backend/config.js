const nodemailer = require("nodemailer");

/**
 * v2.0 Centralized Configuration
 */
const config = {
  port: process.env.PORT || 5000,
  databaseUrl: process.env.DATABASE_URL,
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET,
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET,
  cloudinary: {
    name: process.env.CLOUDINARY_CLOUD_NAME,
    key: process.env.CLOUDINARY_API_KEY,
    secret: process.env.CLOUDINARY_API_SECRET,
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
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
  }
};

console.log("[Config] v3.0 Switching to Nodemailer SMTP...");

/**
 * Nodemailer Transporter Setup
 */
const transporter = nodemailer.createTransport({
  host: config.smtp.host,
  port: config.smtp.port,
  secure: config.smtp.secure,
  auth: {
    user: config.smtp.auth.user,
    pass: config.smtp.auth.pass,
  },
});

module.exports = { config, transporter };
