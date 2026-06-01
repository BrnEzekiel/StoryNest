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

console.log("[Config] v2.3 Loading Environment...");

/**
 * Mail Transporter Setup
 * v2.3 Cloud Hardened: Increased timeouts and explicit SNI servername.
 */
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false, // STARTTLS
  lookup: (hostname, options, callback) => {
    // Strictly force IPv4
    dns.lookup(hostname, { family: 4 }, callback);
  },
  auth: {
    user: config.email.user,
    pass: config.email.pass,
  },
  tls: {
    rejectUnauthorized: false,
    servername: 'smtp.gmail.com', // Explicit SNI for cloud routing
    minVersion: "TLSv1.2"
  },
  connectionTimeout: 30000, // 30 seconds for slow cloud handshakes
  greetingTimeout: 30000,
  socketTimeout: 30000,
  debug: true, // Enable detailed SMTP logs in Render console
  logger: true
});

module.exports = { config, transporter };
