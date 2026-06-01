const dns = require("dns");
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
  email: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS ? process.env.EMAIL_PASS.replace(/\s+/g, "") : "",
  },
  frontendUrl: process.env.FRONTEND_URL || "storynest://",
  slack: {
    webhookUrl: process.env.SLACK_WEBHOOK_URL,
  },
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID,
  }
};

console.log("[Config] Email User present:", !!config.email.user);
console.log("[Config] Email Pass present:", !!config.email.pass);

/**
 * Mail Transporter Setup
 * v2.1 Production Fix: Use custom lookup to strictly force IPv4 and bypass ENETUNREACH errors.
 */
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false, // STARTTLS
  lookup: (hostname, options, callback) => {
    // Aggressively force IPv4 for cloud stability
    dns.lookup(hostname, { family: 4 }, callback);
  },
  auth: {
    user: config.email.user,
    pass: config.email.pass,
  },
  tls: {
    rejectUnauthorized: false
  },
  connectionTimeout: 10000, // 10 seconds
  greetingTimeout: 10000,
});

// Verify connection on startup
transporter.verify((error, success) => {
  if (error) {
    console.error("[Email] Transporter Configuration Error:", error.message);
  } else {
    console.log("[Email] StoryNest Mail Server is ready to take messages");
  }
});

module.exports = { config, transporter };
