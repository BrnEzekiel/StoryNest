const nodemailer = require("nodemailer");

/**
 * v3.0 Centralized Configuration
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
  }
};

console.log("[Config] v3.2 — Email: Gmail REST API (Port 443)");

/**
 * Gmail REST API Email Sender (Port 443)
 * Bypasses Render's SMTP blocks.
 */
const sendGmail = async ({ to, subject, html }) => {
    const axios = require("axios");
    const { OAuth2Client } = require("google-auth-library");
    
    const client = new OAuth2Client(
        config.google.clientId,
        config.google.clientSecret
    );
    client.setCredentials({ refresh_token: config.google.refreshToken });

    try {
        const { token } = await client.getAccessToken();
        
        const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;
        const messageParts = [
            `From: ${config.smtp.from}`,
            `To: ${to}`,
            `Content-Type: text/html; charset=utf-8`,
            `MIME-Version: 1.0`,
            `Subject: ${utf8Subject}`,
            '',
            html
        ];
        const message = messageParts.join('\n');

        // The body needs to be base64url encoded
        const encodedMessage = Buffer.from(message)
            .toString('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');

        await axios.post(
            'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
            { raw: encodedMessage },
            { headers: { Authorization: `Bearer ${token}` } }
        );
        return { success: true };
    } catch (error) {
        console.error("[Gmail API] Send Failure:", error.response?.data || error.message);
        throw error;
    }
};

module.exports = { config, sendGmail };
