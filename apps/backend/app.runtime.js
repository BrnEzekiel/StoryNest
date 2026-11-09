require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { PrismaClient } = require("@prisma/client");
const admin = require("firebase-admin");
const { v4: uuidv4 } = require("uuid");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const NodeCache = require("node-cache");
const { rateLimit, ipKeyGenerator } = require("express-rate-limit");
const axios = require("axios");
const crypto = require("crypto");
const { config, sendGmail, sendSlack } = require("./config");
const { enqueueWelcomeEmail, enqueueEmail } = require("./queues");

const _prisma = new PrismaClient();
// Transient-failure retry: the hosted database sleeps when idle and the first
// touch wakes it, so unreachable/timeout errors are retried with backoff
// instead of surfacing as 500s.
const prisma = _prisma.$extends({
  query: {
    $allModels: {
      async $allOperations({ args, query }) {
        let lastErr;
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            return await query(args);
          } catch (e) {
            lastErr = e;
            const transient = e.code === "P1001" || e.code === "P1002" || e.code === "P1008" || e.code === "P1017" || e.code === "P2024";
            if (!transient || attempt === 2) throw e;
            await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
          }
        }
        throw lastErr;
      },
    },
  },
});
const cache = new NodeCache({ stdTTL: 600 });

// Initialize Firebase Admin
try {
    admin.initializeApp({
        projectId: config.firebase.projectId
    });
    console.log("[Firebase] Admin SDK Initialized");
} catch (e) {
    console.error("[Firebase] Init Error:", e.message);
}

// Cloudinary Configuration
cloudinary.config({
  cloud_name: config.cloudinary.name,
  api_key: config.cloudinary.key,
  api_secret: config.cloudinary.secret,
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: { folder: "storynest", allowed_formats: ["jpg", "png", "jpeg"] },
});
const upload = multer({ storage: storage });

// Audio episodes go to Cloudinary as `video` resources (their type for audio).
const audioStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: { folder: "storynest/podcasts", resource_type: "video" },
});
const audioUpload = multer({ storage: audioStorage, limits: { fileSize: 60 * 1024 * 1024 } });

const app = express();
app.use(cors());
app.use(express.json());
app.set("trust proxy", 1);

// --- HELPERS ---
const handleError = (res, error, customMessage = "Something went wrong on our end. Please try again later.") => {
    console.error(`[Error] ${new Date().toISOString()}:`, error);
    res.status(500).json({ error: customMessage });
};

// Best-effort activity row: never breaks the action that triggered it.
const logActivity = async (entry) => {
    try { await prisma.activity.create({ data: entry }); }
    catch (e) { console.log("[Activity] log skipped:", e.message); }
};

// --- DEBUG LOGGER ---
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// --- RATE LIMITING (whole-system protection) ---
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many requests. Please slow down and try again shortly." },
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many sign-in attempts. Please try again in a few minutes." },
});
const otpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many code requests. Please try again later." },
});
// Per-user limiter for write actions (comments, messages, likes, ...).
const userOrIpKey = (req) => {
  try {
    const h = req.headers.authorization;
    if (h && h.startsWith("Bearer ")) {
      const d = jwt.verify(h.split(" ")[1], config.jwtAccessSecret);
      if (d && d.id) return "user:" + d.id;
    }
  } catch (e) {}
  return ipKeyGenerator(req);
};
const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  keyGenerator: userOrIpKey,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "You're doing that too fast. Please wait a moment and try again." },
});
app.use(globalLimiter);

// --- UTILS ---

const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// All auth lookups must use the same email form: signup stores the
// lowercased address, so every other endpoint must look it up the same
// way (phone keyboards often capitalize the first letter, which used to
// make valid OTP codes report as "expired").
const normalizeEmail = (value) => (value === null || value === undefined ? "" : String(value)).toLowerCase().trim();

// Common freemail domain typos -> correction. Catches "did you mean" cases
// (e.g. gmaill.com) whose OTP emails would otherwise vanish into the void.
const EMAIL_TYPO_DOMAINS = {
    "gmaill.com": "gmail.com", "gmial.com": "gmail.com", "gamil.com": "gmail.com",
    "gnail.com": "gmail.com", "gmail.con": "gmail.com", "gmali.com": "gmail.com",
    "yahooo.com": "yahoo.com", "yaho.com": "yahoo.com", "yahoo.con": "yahoo.com",
    "hotmai.com": "hotmail.com", "hotnail.com": "hotmail.com", "hotmail.con": "hotmail.com",
    "outlook.con": "outlook.com", "outlok.com": "outlook.com",
    "icloud.con": "icloud.com", "iclod.com": "icloud.com",
};
const suggestEmailCorrection = (email) => {
    const at = email.lastIndexOf("@");
    if (at === -1) return null;
    const fix = EMAIL_TYPO_DOMAINS[email.slice(at + 1).toLowerCase()];
    return fix ? email.slice(0, at + 1) + fix : null;
};

const generateReferralCode = (username = "NEST") => {
    const clean = (username || "NEST").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5) || "NEST";
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `NEST-${clean}-${rand}`;
};

const checkAndAwardReferralMilestone = async (referrerId) => {
    try {
        const referralCount = await prisma.user.count({
            where: { referrerId }
        });

        // 10 Referrals unlocks Premium (granted once per user)
        if (referralCount >= 10) {
            const referrer = await prisma.user.findUnique({ where: { id: referrerId } });
            if (referrer && !referrer.isPremium) {
                console.log(`[Referral Milestone] User ${referrer.username} reached ${referralCount} referrals! Granting Premium.`);
                await prisma.user.update({
                    where: { id: referrerId },
                    data: {
                        isPremium: true,
                        premiumExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1-year Pioneer Access
                        coins: { increment: 500 } // Bonus coins milestone reward
                    }
                });
            }
        }
    } catch (e) {
        console.error("[Referral Milestone Error]:", e.message);
    }
};

const sendOTPEmail = async (email, otp, type = "registration") => {
    const subject = type === "registration" ? "Your StoryNest Verification Code" : "Reset Your StoryNest Password";
    const html = `<div style="font-family: 'Georgia', serif; padding: 40px; background-color: #fdfaf5; color: #003631; border: 1px solid #e8e0d5; border-radius: 16px; max-width: 500px; margin: auto;">
                    <div style="text-align: center; margin-bottom: 30px;">
                        <span style="font-size: 28px; font-weight: bold; color: #003631; letter-spacing: 3px; border-bottom: 3px solid #FFEDA8; padding-bottom: 5px;">STORYNEST</span>
                    </div>
                    <h1 style="color: #003631; font-size: 24px; text-align: center;">Verification Code</h1>
                    <div style="background-color: #003631; color: #FFEDA8; padding: 20px; border-radius: 12px; text-align: center; margin: 30px 0;">
                        <span style="font-size: 32px; letter-spacing: 10px; font-weight: bold;">${otp}</span>
                    </div>
                    <p style="font-size: 10px; text-align: center; color: #8C7B6E; letter-spacing: 1px;">STORYNEST • THE HOME FOR IMAGINATION</p>
                   </div>`;
    // 1. SMTP (primary: delivers to any address; Resend's free tier only
    //    delivers to the account owner and rejects gmail.com senders).
    try {
        await sendOTPEmailSMTP(email, subject, html, otp);
        return;
    } catch (e) { /* fall through to Resend */ }
    // 2. Resend (last resort; without a verified domain it only delivers
    //    to the API key owner's own inbox, so gmail.com senders are invalid).
    if (config.resendApiKey) {
        try {
            await axios.post("https://api.resend.com/emails",
                { from: "StoryNest <onboarding@resend.dev>", to: [email], subject, html },
                { headers: { Authorization: `Bearer ${config.resendApiKey}` }, timeout: 15000 });
            console.log(`[OTP] code emailed to ${email} via Resend`);
            return;
        } catch (e) {
            console.error("[Resend] Send Failure:", e.response?.data || e.message);
        }
    }

    // Notify Slack as a backup, then report the failure so callers that await
    // (password reset) can answer honestly instead of claiming "sent".
    await sendSlack(`*OTP Notification*\n*User:* ${email}\n*Code:* \`${otp}\`\n*Type:* ${type}`);
    throw new Error("All email providers failed");
};

// SMTP delivery (Gmail app-password style credentials). Multipart text+HTML
// plus a calm subject keeps the code out of spam folders.
const sendOTPEmailSMTP = async (email, subject, html, otp) => {
    try {
        const nodemailer = require("nodemailer");
        const transporter = nodemailer.createTransport({
            host: config.smtp.host,
            port: config.smtp.port,
            secure: config.smtp.secure,
            auth: { user: config.smtp.auth.user, pass: config.smtp.auth.pass },
        });
        // Gmail only delivers reliably when the sender is the authenticated
        // account, so SMTP_FROM is ignored here on purpose.
        await transporter.sendMail({
            from: `"StoryNest" <${config.smtp.auth.user}>`,
            to: email,
            subject,
            text: `Your StoryNest verification code is: ${otp}\nIt expires in 10 minutes. If you didn't ask for it, ignore this message.`,
            html,
        });
        console.log(`[OTP] code emailed to ${email} via SMTP`);
    } catch (e) {
        console.error("[SMTP] Send Failure:", e.message);
        throw e;
    }
};

const handleMentions = async (content, storyId, senderId) => {
    const mentions = content?.match(/@(\w+)/g);
    if (!mentions) return;
    for (const m of mentions) {
        const username = m.substring(1);
        const target = await prisma.user.findUnique({ where: { username } });
        if (target && target.id !== senderId) {
            // Placeholder for notification system
        }
    }
};

const generateTokens = (user) => {
  const v = user.tokenVersion || 0;
  const accessToken = jwt.sign({ id: user.id, role: user.role, v }, config.jwtAccessSecret, { expiresIn: "1h" });
  const refreshToken = jwt.sign({ id: user.id, v }, config.jwtRefreshSecret, { expiresIn: "7d" });
  return { accessToken, refreshToken };
};

// --- AUTH MIDDLEWARE ---
const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) return res.status(401).json({ error: "Unauthorized" });
  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, config.jwtAccessSecret);
    if (decoded.v !== undefined) {
      const user = await prisma.user.findUnique({ where: { id: decoded.id }, select: { tokenVersion: true, isBanned: true } });
      if (!user || (user.tokenVersion || 0) !== decoded.v) return res.status(401).json({ error: "Session revoked" });
      if (user.isBanned) return res.status(403).json({ error: "Account suspended" });
    }
    req.user = decoded;
    next();
  } catch (err) { res.status(401).json({ error: "Token invalid" }); }
};

const isAdmin = (req, res, next) => {
  if (req.user.role !== "ADMIN") return res.status(403).json({ error: "Admin access required" });
  next();
};

// Parameterized form of isAdmin for routes that name their role.
const requireRole = (role) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });
  if (req.user.role !== role) return res.status(403).json({ error: "Admin access required" });
  next();
};

const canCreate = (req, res, next) => {
  if (req.user.role === "ADMIN" || req.user.role === "WRITER") return next();
  return res.status(403).json({ error: "A writer account is required" });
};

const canEditChapter = async (req, res, next) => {
    try {
        const chapter = await prisma.chapter.findUnique({ where: { id: req.params.id }, include: { story: { include: { coAuthors: { select: { id: true } } } } } });
        if (!chapter) return res.status(404).json({ error: "Chapter not found" });
        const isCoAuthor = (chapter.story.coAuthors || []).some((c) => c.id === req.user.id);
        if (chapter.story.ownerId === req.user.id || isCoAuthor || req.user.role === "ADMIN") return next();
        return res.status(403).json({ error: "No edit access" });
    } catch (e) { return res.status(403).json({ error: "No edit access" }); }
};

const canEditStory = async (req, res, next) => {
    try {
        const storyId = req.params.id || req.body.storyId;
        const story = await prisma.story.findUnique({ where: { id: storyId }, include: { coAuthors: { select: { id: true } } } });
        if (!story) return res.status(404).json({ error: "Story not found" });
        const isCoAuthor = (story.coAuthors || []).some((c) => c.id === req.user.id);
        if (story.ownerId === req.user.id || isCoAuthor || req.user.role === "ADMIN") next();
        else res.status(403).json({ error: "No edit access" });
    } catch (e) { handleError(res, e); }
};

// --- GAMIFICATION HELPERS ---
const ACHIEVEMENT_CATALOG = [
  { title: "First Steps", desc: "Read your first story", icon: "BookOpen" },
  { title: "Bookworm", desc: "Read 10 stories", icon: "Zap" },
  { title: "Getting Warm", desc: "Reach a 3-day streak", icon: "Flame" },
  { title: "On Fire", desc: "Reach a 7-day streak", icon: "Flame" },
  { title: "Unstoppable", desc: "Reach a 30-day streak", icon: "Trophy" },
  { title: "Marathon", desc: "Read for 500 total minutes", icon: "Clock" },
  { title: "Goal Crusher", desc: "Hit your daily reading goal", icon: "Target" },
];

const awardAchievement = async (userId, title) => {
  try {
    const def = ACHIEVEMENT_CATALOG.find((a) => a.title === title);
    const existing = await prisma.achievement.findFirst({ where: { userId, title } });
    if (existing) return null;
    return await prisma.achievement.create({ data: { userId, title, icon: def ? def.icon : "Award" } });
  } catch (e) { return null; }
};

const dayKey = (d) => new Date(d).toISOString().slice(0, 10);

const weekKey = (d = new Date()) => {
  const dt = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = dt.getUTCDay() || 7;
  dt.setUTCDate(dt.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((dt - yearStart) / 86400000) + 1) / 7);
  return `${dt.getUTCFullYear()}-W${week}`;
};

// --- TRUST & SAFETY HELPERS (pure logic lives in utils/trust.js, covered by __tests__/trust.test.js) ---
const { verifyTotp, newTotpSecret, containsBlocked, containmentScore, ageFromDob } = require("./utils/trust");

// --- ROUTES ---

app.get("/health", (req, res) => res.json({ status: "ok", version: "3.8.2", schema: "social_master_v3_stable", bullmq: true, timestamp: new Date().toISOString() }));

app.get("/health/detailed", async (req, res) => {
  const started = Date.now();
  let db = "down";
  let latencyMs = -1;
  try {
    await prisma.$queryRaw`SELECT 1`;
    db = "up";
    latencyMs = Date.now() - started;
  } catch (e) { db = "down"; }
  res.json({ status: db === "up" ? "ok" : "degraded", version: "3.8.2", db, latencyMs, uptimeSec: Math.round(process.uptime()), timestamp: new Date().toISOString() });
});

// --- QUEUE DEBUG / TEST (protect or remove in production later) ---
app.post("/queues/test-welcome", async (req, res) => {
  try {
    const email = (req.body?.email || "test@storynest.local").toLowerCase().trim();
    const username = req.body?.username || "Nestling";
    const job = await enqueueWelcomeEmail({ email, username });
    res.json({ message: "Welcome email job enqueued", jobId: job.id, queue: "email" });
  } catch (error) {
    console.error("[Queue] test-welcome failed:", error.message);
    res.status(500).json({ error: "Failed to enqueue job. Is Redis running and REDIS_URL set?", detail: error.message });
  }
});

app.get("/queues/health", async (req, res) => {
  try {
    const { emailQueue } = require("./queues");
    const [waiting, active, completed, failed] = await Promise.all([
      emailQueue.getWaitingCount(),
      emailQueue.getActiveCount(),
      emailQueue.getCompletedCount(),
      emailQueue.getFailedCount(),
    ]);
    res.json({
      redisUrlConfigured: Boolean(process.env.REDIS_URL) || true,
      email: { waiting, active, completed, failed },
    });
  } catch (error) {
    res.status(500).json({ error: "Queue health check failed", detail: error.message });
  }
});

app.post("/logs/error", async (req, res) => {
    const { error, stack, device, isFatal } = req.body;
    console.error(`[Client-Side Error] Fatal: ${isFatal} | Device: ${device}`);
    console.error(`Error: ${error}`);
    console.error(`Stack: ${stack}`);
    try {
        const message = String(error || "Unknown error").slice(0, 2000);
        const existing = await prisma.errorLog.findFirst({ where: { message, device: device || null } });
        if (existing) await prisma.errorLog.update({ where: { id: existing.id }, data: { count: { increment: 1 } } });
        else await prisma.errorLog.create({ data: { message, stack: stack ? String(stack).slice(0, 8000) : null, device: device || null, isFatal: !!isFatal } });
    } catch (e) {}
    res.json({ status: "logged" });
});

// --- AUTH ---

app.post("/auth/otp/initiate", otpLimiter, async (req, res) => {
    const { dob } = req.body;
    const email = normalizeEmail(req.body?.email);
    if (!email) return res.status(400).json({ error: "Email is required" });
    const typoFix = suggestEmailCorrection(email);
    if (typoFix) return res.status(400).json({ error: `Did you mean ${typoFix}? Please check your email address.`, suggestion: typoFix });
    try {
        const otp = generateOTP();
        const expiry = new Date(Date.now() + 10 * 60 * 1000);
        await prisma.user.upsert({
            where: { email },
            update: { otpCode: otp, otpExpiry: expiry },
            create: { 
                email, 
                username: `Nestling_${uuidv4().substring(0, 4)}`, 
                password: "otp_pending", 
                otpCode: otp, 
                otpExpiry: expiry, 
                dateOfBirth: dob ? new Date(dob) : null,
                tosAccepted: true, 
                privacyAccepted: true,
                emailVerified: false,
                notificationsOn: true,
                recsEnabled: true,
                coins: 0
            }
        });
        try {
            await sendOTPEmail(email, otp);
        } catch (e) {
            console.error("[OTP] code email failed:", e.message);
            return res.status(502).json({ error: "Could not send the code to that address. Please try again later." });
        }
        res.json({ message: "OTP sent" });
    } catch (error) { handleError(res, error); }
});

app.post("/auth/otp/verify", otpLimiter, async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    const otp = req.body?.otp === null || req.body?.otp === undefined ? "" : String(req.body.otp).trim();
    try {
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !user.otpCode || !user.otpExpiry) return res.status(400).json({ error: "No active code for this email. Please request a new code." });
        if (new Date() > user.otpExpiry) return res.status(400).json({ error: "That code has expired. Please request a new code." });
        if (user.otpCode !== otp) return res.status(400).json({ error: "That code doesn't match. Enter the code from your latest email." });
        await prisma.user.update({ where: { email }, data: { emailVerified: true, otpCode: null, otpExpiry: null } });
        res.json({ message: "Verified" });
    } catch (error) { handleError(res, error); }
});

app.post("/auth/password/forgot", otpLimiter, async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    if (!email) return res.status(400).json({ error: "Email is required" });
    const typoFix = suggestEmailCorrection(email);
    if (typoFix) return res.status(400).json({ error: `Did you mean ${typoFix}? Please check your email address.`, suggestion: typoFix });
    try {
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return res.status(404).json({ error: "No account with that email" });
        const otp = generateOTP();
        const expiry = new Date(Date.now() + 10 * 60 * 1000);
        await prisma.user.update({ where: { email }, data: { otpCode: otp, otpExpiry: expiry } });
        try {
            await sendOTPEmail(email, otp, "password");
        } catch (e) {
            console.error("[Password] reset code email failed:", e.message);
            return res.status(502).json({ error: "Could not send the reset code. Please try again later." });
        }
        res.json({ message: "Reset code sent" });
    } catch (error) { handleError(res, error); }
});

app.post("/auth/password/reset", authLimiter, async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    const otp = req.body?.otp === null || req.body?.otp === undefined ? "" : String(req.body.otp).trim();
    const { newPassword } = req.body;
    if (!email || !otp) return res.status(400).json({ error: "Email and code are required" });
    if (!newPassword || newPassword.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });
    try {
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !user.otpCode || !user.otpExpiry) return res.status(400).json({ error: "No active code for this email. Please request a new code." });
        if (new Date() > user.otpExpiry) return res.status(400).json({ error: "That code has expired. Please request a new code." });
        if (user.otpCode !== otp) return res.status(400).json({ error: "That code doesn't match. Enter the code from your latest email." });
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await prisma.user.update({ where: { email }, data: { password: hashedPassword, emailVerified: true, otpCode: null, otpExpiry: null } });
        // Best-effort Firebase sync so a later re-register sign-in still works.
        try {
            const fb = await admin.auth().getUserByEmail(email).catch(() => null);
            if (fb) await admin.auth().updateUser(fb.uid, { password: newPassword });
        } catch (e) { console.error("[Password] Firebase sync skipped:", e.message); }
        res.json({ message: "Password updated" });
    } catch (error) { handleError(res, error); }
});

app.post("/auth/register", authLimiter, async (req, res) => {
  let { password, username, firebaseUid, tosAccepted, privacyAccepted, referralCode: inputRefCode, accountType } = req.body;
  const email = normalizeEmail(req.body?.email);
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.emailVerified) return res.status(400).json({ error: "Email not verified" });
    const hashedPassword = await bcrypt.hash(password, 10);

    let userReferralCode = user.referralCode || generateReferralCode(username);
    let referrerId = user.referrerId || null;
    let initialCoins = 0;
    let initialXp = 0;

    // Check if valid referral code was supplied
    if (inputRefCode && !referrerId) {
      const trimmedRef = inputRefCode.trim().toUpperCase();
      const referrer = await prisma.user.findFirst({
        where: { referralCode: { equals: trimmedRef, mode: "insensitive" } }
      });
      if (referrer && referrer.id !== user.id) {
        referrerId = referrer.id;
        initialCoins = 25; // Bonus for new user
        initialXp = 50;
        // Reward referrer with coins & XP
        await prisma.user.update({
          where: { id: referrer.id },
          data: {
            coins: { increment: 50 },
            xp: { increment: 100 }
          }
        }).catch(err => console.error("[Referral] Failed to credit referrer:", err.message));

        // Check if referrer reached 10 referrals milestone to unlock Premium
        checkAndAwardReferralMilestone(referrer.id).catch(err => console.error(err));
      }
    }

    const updatedUser = await prisma.user.update({
      where: { email },
      data: { 
          username, password: hashedPassword, firebaseUid, 
          tosAccepted: true, 
          privacyAccepted: true,
          notificationsOn: true,
          recsEnabled: true,
          referralCode: userReferralCode,
          referrerId: referrerId,
          coins: { increment: initialCoins },
          xp: { increment: initialXp },
          // Signup role choice: readers stay readers, writers become writers.
          // Never changes an existing non-reader role, never grants admin.
          ...(user.role === "READER" && String(accountType || "").toLowerCase() === "writer" ? { role: "WRITER" } : {})
      }
    });
    const tokens = generateTokens(updatedUser);

    // Fire-and-forget welcome email via BullMQ (does not block response)
    enqueueWelcomeEmail({ email: updatedUser.email, username: updatedUser.username })
      .catch((err) => console.error("[Queue] welcome email enqueue failed:", err.message));

    res.status(201).json({ user: updatedUser, ...tokens });
  } catch (error) {
    // Unique-constraint conflicts (almost always a taken username) are the
    // caller's problem, not a server crash: answer 409 naming the field.
    if (error && error.code === "P2002") {
      const rawTarget = error.meta && error.meta.target;
      const target = Array.isArray(rawTarget) ? rawTarget.join(",") : String(rawTarget || "");
      if (target.indexOf("username") !== -1) return res.status(409).json({ error: "That username is taken. Please choose another one." });
      if (target.indexOf("firebaseUid") !== -1) return res.status(409).json({ error: "This account is already registered. Try logging in instead." });
      if (target.indexOf("email") !== -1) return res.status(409).json({ error: "This email is already registered. Try logging in instead." });
      return res.status(409).json({ error: "That is already in use. Please change it and try again." });
    }
    handleError(res, error);
  }
});

app.post("/auth/login", authLimiter, async (req, res) => {
  const { idToken, password } = req.body;
  const email = normalizeEmail(req.body?.email);
  try {
    let user;
    if (idToken) {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        const firebaseEmail = normalizeEmail(decodedToken.email);
        user = await prisma.user.findUnique({ where: { email: firebaseEmail } });
        if (!user) {
            const newUsername = `Nestling_${uuidv4().substring(0, 4)}`;
            user = await prisma.user.create({ data: { 
                email: firebaseEmail, 
                username: newUsername, 
                password: "google_auth", 
                avatarUrl: `https://api.dicebear.com/9.x/glass/svg?seed=${firebaseEmail}`,
                emailVerified: true, 
                tosAccepted: true, 
                privacyAccepted: true,
                notificationsOn: true,
                recsEnabled: true,
                coins: 0,
                referralCode: generateReferralCode(newUsername)
            } });
        }
    } else {
        user = await prisma.user.findUnique({ where: { email } });
        if (!user || !(await bcrypt.compare(password, user.password))) return res.status(401).json({ error: "Invalid credentials" });
    }
    if (user.isBanned) return res.status(403).json({ error: "This account has been suspended." });
    if (user.totpEnabled && !idToken) {
        const { totpCode: code } = req.body;
        if (!code) return res.json({ requires2FA: true, userId: user.id });
        if (!verifyTotp(user.totpSecret, code)) return res.status(401).json({ error: "Invalid 2FA code." });
    }
    const tokens = generateTokens(user);
    try {
        sendGmail({ to: user.email, subject: "New login to StoryNest", html: `<p>Hi ${user.username},</p><p>Someone just logged in to your StoryNest account. If this was not you, change your password immediately.</p>` }).catch(() => {});
    } catch (e) {}
    res.json({ user, ...tokens });
  } catch (error) { handleError(res, error, "Login failed. Please check your credentials."); }
});

app.post("/auth/refresh", authLimiter, async (req, res) => {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(401).json({ error: "No refresh token" });
    try {
        const decoded = jwt.verify(refreshToken, config.jwtRefreshSecret);
        const user = await prisma.user.findUnique({ where: { id: decoded.id } });
        if (!user) throw new Error();
        if (decoded.v !== undefined && (user.tokenVersion || 0) !== decoded.v) return res.status(401).json({ error: "Session revoked" });
        if (user.isBanned) return res.status(403).json({ error: "Account suspended" });
        const tokens = generateTokens(user);
        res.json(tokens);
    } catch (e) { res.status(401).json({ error: "Invalid refresh token" }); }
    });

    app.post("/auth/logout", (req, res) => {
    res.json({ message: "Logged out successfully" });
    });

    // --- STORIES ---

app.get("/stories", async (req, res) => {
  const { genre, mood, q, limit, featured } = req.query;
  try {
    const where = { isDraft: false };
    if (genre && genre !== "All") where.genre = genre;
    if (mood && mood !== "All") where.mood = mood;
    if (featured === "true") {
      where.isFeatured = true;
      where.AND = [{ OR: [{ featuredUntil: null }, { featuredUntil: { gt: new Date() } }] }];
    }
    if (q) where.OR = [{ title: { contains: q, mode: "insensitive" } }, { authorName: { contains: q, mode: "insensitive" } }];
    const stories = await prisma.story.findMany({ where, take: limit ? parseInt(limit) : 50, orderBy: { createdAt: "desc" }, include: { _count: { select: { likes: true, comments: true } } } });
    res.json(stories);
  } catch (error) { handleError(res, error); }
});

app.get("/stories/trending", async (req, res) => {
    try {
        const stories = await prisma.story.findMany({
            where: { isDraft: false },
            include: { _count: { select: { likes: true, history: true } } },
            take: 15
        });
        const trending = stories.sort((a, b) => ((b._count.likes * 2) + b._count.history) - ((a._count.likes * 2) + a._count.history));
        res.json(trending);
    } catch (e) { handleError(res, e); }
});

app.get("/stories/recommendations", authenticate, async (req, res) => {
    try {
        const history = await prisma.history.findMany({ where: { userId: req.user.id }, include: { story: true }, take: 10, orderBy: { createdAt: "desc" } });
        const genres = [...new Set(history.map(h => h.story.genre))];
        const recs = await prisma.story.findMany({
            where: { isDraft: false, genre: { in: genres.length > 0 ? genres : ["Fiction"] }, id: { notIn: history.map(h => h.storyId) } },
            take: 6, include: { _count: { select: { likes: true } } }
        });
        res.json(recs);
    } catch (e) { handleError(res, e); }
});

app.get("/stories/:id", async (req, res) => {
  const authHeader = req.headers.authorization;
  let userId = null;
  if (authHeader && authHeader.startsWith("Bearer ")) {
      try { userId = jwt.verify(authHeader.split(" ")[1], config.jwtAccessSecret).id; } catch (e) {}
  }
  try {
    const story = await prisma.story.findUnique({
      where: { id: req.params.id },
      include: { 
          _count: { select: { likes: true, comments: true } },
          chapters: { where: { isDraft: false }, orderBy: { order: "asc" }, select: { id: true, title: true, order: true } }
      }
    });
    if (!story) return res.status(404).json({ error: "Not found" });
    
    let isLiked = false;
    let bookmarkProgress = 0;
    let canRead = true;

    let blockedReason = null;
    if (story.isPremium) {
        if (!userId) {
            canRead = false;
            blockedReason = "premium";
        } else {
            const user = await prisma.user.findUnique({ where: { id: userId } });
            if (!user.isPremium) {
                // Check if user has purchased this specific story
                const purchase = await prisma.purchase.findFirst({
                    where: { userId, storyId: req.params.id, type: "STORY" }
                });
                if (!purchase) {
                    canRead = false;
                    blockedReason = "premium";
                }
            }
        }
    }

    if (story.isAdult) {
        if (!userId) {
            canRead = false;
            blockedReason = "age";
        } else {
            const reader = await prisma.user.findUnique({ where: { id: userId }, select: { dateOfBirth: true } });
            const age = ageFromDob(reader && reader.dateOfBirth);
            if (age === null || age < 18) {
                canRead = false;
                blockedReason = "age";
            }
        }
    }

    if (userId) {
        const [like, bookmark] = await Promise.all([
            prisma.like.findUnique({ where: { userId_storyId: { userId, storyId: req.params.id } } }),
            prisma.bookmark.findUnique({ where: { userId_storyId: { userId, storyId: req.params.id } } })
        ]);
        isLiked = !!like;
        bookmarkProgress = bookmark ? bookmark.progress : 0;
    }
    res.json({ ...story, isLiked, bookmarkProgress, canRead, blockedReason });
  } catch (error) { handleError(res, error); }
});

app.post("/stories", authenticate, canCreate, upload.single("cover"), async (req, res) => {
    const { title, genre, authorName, mood, body, summary, readingTime, coverUrl, contentWarnings, isAdult, coverTheme } = req.body;
    try {
        let autoFlag = containsBlocked(`${title} ${body} ${summary}`);
        if (body && body.split(/\s+/).length > 100 && !autoFlag) {
            const others = await prisma.story.findMany({ take: 200, orderBy: { createdAt: "desc" }, select: { body: true } });
            autoFlag = others.some((o) => o.body && containmentScore(body, o.body) > 0.5);
        }
        const story = await prisma.story.create({
            data: {
                title, genre, authorName, mood, summary,
                body: body || "",
                ownerId: req.user.id,
                readingTime: readingTime ? parseInt(readingTime) : 5,
                coverUrl: req.file ? req.file.path : (typeof coverUrl === "string" && coverUrl.trim() ? coverUrl.trim() : null),
                contentWarnings: contentWarnings || null,
                isAdult: isAdult === true || isAdult === "true",
                coverTheme: coverTheme || null,
                isDraft: false,
                publishedAt: new Date(),
                isFlagged: autoFlag,
                chapters: body ? { create: { title: "Chapter 1", body, order: 1 } } : undefined
            }
        });
        if (body) await prisma.version.create({ data: { storyId: story.id, body } });
        logActivity({ userId: req.user.id, type: "PUBLISH", storyId: story.id });
        res.status(201).json(story);
    } catch (e) { handleError(res, e); }
});

app.put("/stories/:id", authenticate, canEditStory, upload.single("cover"), async (req, res) => {
    const { title, genre, authorName, mood, summary, readingTime, coverUrl, body, contentWarnings, isAdult, coverTheme } = req.body;
    const updateData = { title, genre, authorName, mood, summary, readingTime: readingTime ? parseInt(readingTime) : undefined };
    if (req.file) updateData.coverUrl = req.file.path;
    else if (typeof coverUrl === "string" && coverUrl.trim()) updateData.coverUrl = coverUrl.trim();
    if (contentWarnings !== undefined) updateData.contentWarnings = contentWarnings || null;
    if (isAdult !== undefined) updateData.isAdult = isAdult === true || isAdult === "true";
    if (coverTheme !== undefined) updateData.coverTheme = coverTheme || null;
    if (body !== undefined) updateData.body = body;
    try {
        // Snapshot the previous body so version history stays meaningful.
        if (body !== undefined) {
            const prev = await prisma.story.findUnique({ where: { id: req.params.id }, select: { body: true } });
            if (prev && prev.body && prev.body !== body) {
                await prisma.version.create({ data: { storyId: req.params.id, body: prev.body } });
            }
        }
        const story = await prisma.story.update({ where: { id: req.params.id }, data: updateData });
        res.json(story);
    } catch (e) { handleError(res, e); }
});

app.delete("/stories/:id", authenticate, canEditStory, async (req, res) => {
    const storyId = req.params.id;
    try {
        // Ordered cascade: grandchildren first, story last.
        const polls = await prisma.poll.findMany({ where: { storyId }, select: { id: true } });
        const pollIds = polls.map(p => p.id);
        if (pollIds.length > 0) {
            await prisma.pollVote.deleteMany({ where: { pollId: { in: pollIds } } });
            await prisma.pollOption.deleteMany({ where: { pollId: { in: pollIds } } });
        }
        await prisma.poll.deleteMany({ where: { storyId } });
        await prisma.comment.deleteMany({ where: { storyId, parentId: { not: null } } });
        await prisma.comment.deleteMany({ where: { storyId } });
        await prisma.playlistStory.deleteMany({ where: { storyId } });
        await prisma.review.deleteMany({ where: { storyId } });
        await prisma.version.deleteMany({ where: { storyId } });
        await prisma.bookmark.deleteMany({ where: { storyId } });
        await prisma.history.deleteMany({ where: { storyId } });
        await prisma.like.deleteMany({ where: { storyId } });
        await prisma.note.deleteMany({ where: { storyId } });
        await prisma.highlight.deleteMany({ where: { storyId } });
        await prisma.activity.deleteMany({ where: { storyId } });
        await prisma.chapter.deleteMany({ where: { storyId } });
        await prisma.character.deleteMany({ where: { storyId } });
        await prisma.worldEntry.deleteMany({ where: { storyId } });
        await prisma.story.update({ where: { id: storyId }, data: { coAuthors: { set: [] } } });
        await prisma.story.delete({ where: { id: storyId } });
        res.json({ success: true });
    } catch (e) { handleError(res, e); }
});

app.get("/admin/my-stories", authenticate, async (req, res) => {
    try {
        const where = req.user.role === "ADMIN" ? {} : { ownerId: req.user.id };
        const stories = await prisma.story.findMany({
            where,
            orderBy: { updatedAt: "desc" },
            include: { _count: { select: { likes: true, comments: true, chapters: true } } }
        });
        res.json(stories);
    } catch (e) { handleError(res, e); }
});

app.get("/admin/stats", authenticate, async (req, res) => {
    try {
        const isAdminUser = req.user.role === "ADMIN";
        const where = isAdminUser ? {} : { ownerId: req.user.id };
        const stories = await prisma.story.findMany({ where, select: { id: true } });
        const ids = stories.map(s => s.id);
        const dayAgo = new Date(Date.now() - 86400000);
        const monthAgo = new Date(Date.now() - 30 * 86400000);
        const [totalReads, userCount, dau, mau, genreGroups, revenue, openReports] = await Promise.all([
            ids.length > 0 ? prisma.history.count({ where: { storyId: { in: ids } } }) : Promise.resolve(0),
            isAdminUser ? prisma.user.count() : Promise.resolve(0),
            isAdminUser ? prisma.history.groupBy({ by: ["userId"], where: { createdAt: { gte: dayAgo } } }).then((r) => r.length) : Promise.resolve(0),
            isAdminUser ? prisma.history.groupBy({ by: ["userId"], where: { createdAt: { gte: monthAgo } } }).then((r) => r.length) : Promise.resolve(0),
            isAdminUser ? prisma.story.groupBy({ by: ["genre"], _count: { id: true }, orderBy: { _count: { id: "desc" } }, take: 8 }) : Promise.resolve([]),
            isAdminUser ? prisma.purchase.aggregate({ _sum: { amount: true }, where: { status: "COMPLETED" } }).then((r) => r._sum.amount || 0) : Promise.resolve(0),
            isAdminUser ? prisma.report.count({ where: { status: "OPEN" } }).catch(() => 0) : Promise.resolve(0)
        ]);
        res.json({ storyCount: ids.length, totalReads, userCount, dau, mau, genreGroups, revenue, openReports });
    } catch (e) { handleError(res, e); }
});

// --- CHAPTERS ---

app.get("/stories/:id/chapters", authenticate, canEditStory, async (req, res) => {
    try {
        const chapters = await prisma.chapter.findMany({ where: { storyId: req.params.id }, orderBy: { order: "asc" } });
        res.json(chapters);
    } catch (e) { handleError(res, e); }
});

app.put("/chapters/:id", authenticate, canEditChapter, async (req, res) => {
    const { title, body, order, isDraft, publishedAt, audioUrl } = req.body;
    try {
        const data = {
            ...(title !== undefined ? { title } : {}),
            ...(body !== undefined ? { body } : {}),
            ...(order !== undefined ? { order: parseInt(order) } : {}),
            ...(isDraft !== undefined ? { isDraft } : {}),
            ...(audioUrl !== undefined ? { audioUrl: audioUrl ? String(audioUrl).slice(0, 500) : null } : {})
        };
        if (publishedAt !== undefined) {
            if (publishedAt) {
                const scheduled = new Date(publishedAt);
                const isFuture = !isNaN(scheduled.getTime()) && scheduled.getTime() > Date.now();
                data.publishedAt = isFuture ? scheduled : new Date();
                if (isDraft === undefined) data.isDraft = isFuture ? true : false;
            } else {
                // Cleared schedule: publish immediately.
                data.publishedAt = new Date();
                if (isDraft === undefined) data.isDraft = false;
            }
        }
        const chapter = await prisma.chapter.update({ where: { id: req.params.id }, data });
        res.json(chapter);
    } catch (e) { handleError(res, e); }
});

app.delete("/chapters/:id", authenticate, canEditChapter, async (req, res) => {
    try {
        await prisma.chapter.delete({ where: { id: req.params.id } });
        res.json({ success: true });
    } catch (e) { handleError(res, e); }
});

app.get("/chapters/:id", async (req, res) => {
    const authHeader = req.headers.authorization;
    let userId = null;
    if (authHeader && authHeader.startsWith("Bearer ")) {
        try { userId = jwt.verify(authHeader.split(" ")[1], config.jwtAccessSecret).id; } catch (e) {}
    }
    try {
        const chapter = await prisma.chapter.findUnique({ 
            where: { id: req.params.id },
            include: { story: true }
        });
        if (!chapter) return res.status(404).json({ error: "Not found" });

        if (chapter.story.isPremium) {
            if (!userId) return res.status(403).json({ error: "Premium story. Please log in." });
            const user = await prisma.user.findUnique({ where: { id: userId } });
            if (!user || !user.isPremium) return res.status(403).json({ error: "Premium story. Upgrade required." });
        }

        if (chapter.story.isAdult) {
            if (!userId) return res.status(403).json({ error: "This story is rated 18+.", blockedReason: "age" });
            const reader = await prisma.user.findUnique({ where: { id: userId }, select: { dateOfBirth: true } });
            const age = ageFromDob(reader && reader.dateOfBirth);
            if (age === null || age < 18) return res.status(403).json({ error: "This story is rated 18+.", blockedReason: "age" });
        }

        res.json(chapter);
    } catch (e) { handleError(res, e); }
});

app.post("/stories/:id/chapters", authenticate, canEditStory, async (req, res) => {
    const { title, body, order, publishedAt, audioUrl } = req.body;
    try {
        const scheduled = publishedAt ? new Date(publishedAt) : null;
        const isFuture = scheduled && !isNaN(scheduled.getTime()) && scheduled.getTime() > Date.now();
        const chapter = await prisma.chapter.create({
            data: {
                storyId: req.params.id, title, body, order: parseInt(order) || 0,
                publishedAt: isFuture ? scheduled : new Date(),
                isDraft: isFuture ? true : false,
                audioUrl: typeof audioUrl === "string" && audioUrl.trim() ? audioUrl.trim().slice(0, 500) : null
            }
        });
        res.status(201).json(chapter);
    } catch (e) { handleError(res, e); }
});

// --- SOCIAL (COMMENTS, MESSAGES) ---

app.get("/stories/:id/comments", async (req, res) => {
    try {
        const comments = await prisma.comment.findMany({
            where: { storyId: req.params.id },
            include: { user: { select: { id: true, username: true, avatarUrl: true } } },
            orderBy: { createdAt: "asc" }
        });
        res.json(comments);
    } catch (e) { handleError(res, e); }
});

app.post("/stories/:id/comments", authenticate, writeLimiter, async (req, res) => {
    const { content, parentId, paragraphIndex } = req.body;
    if (containsBlocked(content)) return res.status(400).json({ error: "This comment goes against community guidelines." });
    try {
        const comment = await prisma.comment.create({
            data: { userId: req.user.id, storyId: req.params.id, content, parentId: parentId || null, paragraphIndex: paragraphIndex === undefined || paragraphIndex === null ? null : parseInt(paragraphIndex) },
            include: { user: { select: { id: true, username: true, avatarUrl: true } } }
        });
        logActivity({ userId: req.user.id, type: "COMMENT", storyId: req.params.id, content: String(content || "").slice(0, 140) || null });
        res.status(201).json(comment);
    } catch (e) { handleError(res, e); }
});

app.get("/messages/conversations", authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        const messages = await prisma.message.findMany({
            where: { OR: [{ senderId: userId }, { receiverId: userId }] },
            orderBy: { createdAt: "desc" },
            take: 400,
            include: {
                sender: { select: { id: true, username: true, avatarUrl: true, publicKey: true } },
                receiver: { select: { id: true, username: true, avatarUrl: true, publicKey: true } }
            }
        });

        const conversationsMap = new Map();
        messages.forEach(msg => {
            const otherUser = msg.senderId === userId ? msg.receiver : msg.sender;
            const isUnread = !msg.isRead && msg.receiverId === userId;

            if (!conversationsMap.has(otherUser.id)) {
                conversationsMap.set(otherUser.id, {
                    user: { id: otherUser.id, username: otherUser.username, avatarUrl: otherUser.avatarUrl, publicKey: otherUser.publicKey || null },
                    lastMessage: { id: msg.id, senderId: msg.senderId, receiverId: msg.receiverId, content: msg.content, isRead: msg.isRead, isEncrypted: !!msg.isEncrypted, createdAt: msg.createdAt },
                    hasUnread: isUnread
                });
            } else if (isUnread) {
                conversationsMap.get(otherUser.id).hasUnread = true;
            }
        });

        res.json(Array.from(conversationsMap.values()));
    } catch (e) { handleError(res, e); }
});

app.get("/messages/:userId", authenticate, async (req, res) => {
    try {
        const messages = await prisma.message.findMany({
            where: {
                OR: [
                    { senderId: req.user.id, receiverId: req.params.userId },
                    { senderId: req.params.userId, receiverId: req.user.id }
                ]
            },
            orderBy: { createdAt: "desc" },
            take: 500,
            include: { sender: { select: { id: true, publicKey: true } } }
        });
        res.json(messages.reverse());
    } catch (e) { handleError(res, e); }
});

app.post("/messages", authenticate, writeLimiter, async (req, res) => {
    try {
        const { receiverId, content, isEncrypted } = req.body;
        if (!receiverId || !content) return res.status(400).json({ error: "receiverId and content are required" });
        const message = await prisma.message.create({
            data: { content, senderId: req.user.id, receiverId, isEncrypted: !!isEncrypted }
        });
        res.status(201).json(message);
    } catch (e) { handleError(res, e); }
});

app.put("/messages/:id", authenticate, writeLimiter, async (req, res) => {
    try {
        const msg = await prisma.message.findUnique({ where: { id: req.params.id } });
        if (!msg || msg.senderId !== req.user.id) return res.status(403).json({ error: "Unauthorized" });
        const updated = await prisma.message.update({ where: { id: req.params.id }, data: { content: req.body.content, isEncrypted: req.body.isEncrypted !== undefined ? !!req.body.isEncrypted : undefined } });
        res.json(updated);
    } catch (e) { handleError(res, e); }
});

app.delete("/messages/:id", authenticate, writeLimiter, async (req, res) => {
    try {
        const msg = await prisma.message.findUnique({ where: { id: req.params.id } });
        if (!msg || msg.senderId !== req.user.id) return res.status(403).json({ error: "Unauthorized" });
        await prisma.message.delete({ where: { id: req.params.id } });
        res.json({ success: true });
    } catch (e) { handleError(res, e); }
});

app.delete("/messages/conversations/:userId", authenticate, writeLimiter, async (req, res) => {
    try {
        const myId = req.user.id;
        const otherId = req.params.userId;
        await prisma.message.deleteMany({
            where: {
                OR: [
                    { senderId: myId, receiverId: otherId },
                    { senderId: otherId, receiverId: myId }
                ]
            }
        });
        res.json({ success: true });
    } catch (e) { handleError(res, e); }
});

app.patch("/messages/read-all/:userId", authenticate, async (req, res) => {
    try {
        await prisma.message.updateMany({
            where: { senderId: req.params.userId, receiverId: req.user.id, isRead: false },
            data: { isRead: true }
        });
        res.json({ success: true });
    } catch (e) { handleError(res, e); }
});

// --- INTERACTION (LIKE, READ, BOOKMARK) ---

app.post("/stories/:id/like", authenticate, writeLimiter, async (req, res) => {
    try {
        const userId = req.user.id;
        const storyId = req.params.id;
        const existing = await prisma.like.findUnique({ where: { userId_storyId: { userId, storyId } } });
        if (existing) {
            await prisma.like.delete({ where: { id: existing.id } });
            const likes = await prisma.like.count({ where: { storyId } });
            return res.json({ isLiked: false, likes });
        }
        await prisma.like.create({ data: { userId, storyId } });
        const likes = await prisma.like.count({ where: { storyId } });
        logActivity({ userId, type: "LIKE", storyId });
        res.json({ isLiked: true, likes });
    } catch (e) { handleError(res, e); }
});

app.post("/stories/:id/read", authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        await prisma.history.create({ data: { userId, storyId: req.params.id } });
        const user = await prisma.user.findUnique({ where: { id: userId }, select: { lastReadDate: true, streakCount: true } });
        const today = dayKey(new Date());
        const last = user && user.lastReadDate ? dayKey(user.lastReadDate) : null;
        const yesterday = dayKey(Date.now() - 86400000);
        let streak = 1;
        if (last === today) streak = user.streakCount || 1;
        else if (last === yesterday) streak = (user.streakCount || 0) + 1;
        await prisma.user.update({ where: { id: userId }, data: { xp: { increment: 10 }, streakCount: streak, lastReadDate: new Date() } });
        const newBadges = [];
        const reads = await prisma.history.count({ where: { userId } });
        if (reads === 1) { const b = await awardAchievement(userId, "First Steps"); if (b) newBadges.push(b); }
        if (reads >= 10) { const b = await awardAchievement(userId, "Bookworm"); if (b) newBadges.push(b); }
        if (streak >= 30) { const b = await awardAchievement(userId, "Unstoppable"); if (b) newBadges.push(b); }
        else if (streak >= 7) { const b = await awardAchievement(userId, "On Fire"); if (b) newBadges.push(b); }
        else if (streak >= 3) { const b = await awardAchievement(userId, "Getting Warm"); if (b) newBadges.push(b); }
        res.json({ status: "success", streak, newBadges });
    } catch (e) { res.json({ status: "ok" }); }
});

app.post("/stories/:id/read-time", authenticate, async (req, res) => {
    const minutes = Math.min(Math.max(Math.round((parseInt(req.body.seconds) || 0) / 60), 0), 10);
    if (!minutes) return res.json({ status: "ok" });
    try {
        const userId = req.user.id;
        const user = await prisma.user.findUnique({ where: { id: userId }, select: { lastReadDate: true, todayReadTime: true, totalReadTime: true, dailyGoalMinutes: true } });
        const today = dayKey(new Date());
        const last = user && user.lastReadDate ? dayKey(user.lastReadDate) : null;
        const todayTime = last === today ? (user.todayReadTime || 0) + minutes : minutes;
        const totalTime = (user.totalReadTime || 0) + minutes;
        await prisma.user.update({ where: { id: userId }, data: { todayReadTime: todayTime, totalReadTime: totalTime, lastReadDate: new Date() } });
        const newBadges = [];
        if (totalTime >= 500) { const b = await awardAchievement(userId, "Marathon"); if (b) newBadges.push(b); }
        let goalHit = false;
        if (todayTime >= (user.dailyGoalMinutes || 30)) {
            goalHit = true;
            const b = await awardAchievement(userId, "Goal Crusher"); if (b) newBadges.push(b);
        }
        res.json({ status: "success", todayReadTime: todayTime, goalHit, newBadges });
    } catch (e) { res.json({ status: "ok" }); }
});

app.post("/stories/:id/bookmark", authenticate, writeLimiter, async (req, res) => {
    const { progress } = req.body;
    try {
        const bookmark = await prisma.bookmark.upsert({
            where: { userId_storyId: { userId: req.user.id, storyId: req.params.id } },
            update: { progress },
            create: { userId: req.user.id, storyId: req.params.id, progress }
        });
        res.json(bookmark);
    } catch (e) { handleError(res, e); }
});

app.post("/stories/:id/unlock", authenticate, async (req, res) => {
    try {
        const story = await prisma.story.findUnique({ where: { id: req.params.id } });
        if (!story) return res.status(404).json({ error: "Story not found" });
        if (!story.isPremium) return res.json({ success: true, message: "Story is already free" });

        const user = await prisma.user.findUnique({ where: { id: req.user.id } });
        if (user.coins < story.price) return res.status(400).json({ error: "Insufficient coins" });

        // Atomic transaction to deduct coins and create purchase
        const [updatedUser, purchase] = await prisma.$transaction([
            prisma.user.update({
                where: { id: req.user.id },
                data: { coins: { decrement: story.price } }
            }),
            prisma.purchase.create({
                data: {
                    userId: req.user.id,
                    storyId: story.id,
                    type: "STORY",
                    amount: story.price,
                    currency: "COIN"
                }
            })
        ]);

        res.json({ success: true, user: updatedUser, purchase });
    } catch (e) { handleError(res, e); }
});

// --- USER PROFILE & PREFERENCES ---

app.get("/users/me", authenticate, async (req, res) => {  
    try {
        let user = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: {
                id: true, email: true, username: true, avatarUrl: true, bio: true,
                role: true, readerTheme: true, readerFontSize: true,
                notificationsOn: true, recsEnabled: true, coins: true, xp: true,
                isPremium: true, streakCount: true, totalReadTime: true, todayReadTime: true,
                dailyGoalMinutes: true, lastReadDate: true, totpEnabled: true, showActivity: true,
                referralCode: true, referrerId: true, discoverable: true, publicKey: true
            }
        });
        if (user && !user.referralCode) {
            const newCode = generateReferralCode(user.username);
            user = await prisma.user.update({
                where: { id: user.id },
                data: { referralCode: newCode },
                select: {
                    id: true, email: true, username: true, avatarUrl: true, bio: true,
                    role: true, readerTheme: true, readerFontSize: true,
                    notificationsOn: true, recsEnabled: true, coins: true, xp: true,
                    isPremium: true, streakCount: true, totalReadTime: true, todayReadTime: true,
                    dailyGoalMinutes: true, lastReadDate: true, totpEnabled: true, showActivity: true,
                    referralCode: true, referrerId: true, discoverable: true, publicKey: true
                }
            });
        }
        res.json(user);
    } catch (e) { handleError(res, e); }
});

// --- REFERRALS ---

app.get("/referrals/info", authenticate, async (req, res) => {
    try {
        let user = await prisma.user.findUnique({ where: { id: req.user.id } });
        if (!user) return res.status(404).json({ error: "User not found" });
        
        let referralCode = user.referralCode;
        if (!referralCode) {
            referralCode = generateReferralCode(user.username);
            await prisma.user.update({
                where: { id: user.id },
                data: { referralCode }
            });
        }

        const referredUsers = await prisma.user.findMany({
            where: { referrerId: user.id },
            select: { id: true, username: true, avatarUrl: true, createdAt: true },
            orderBy: { createdAt: "desc" }
        });

        const totalReferred = referredUsers.length;
        const coinsEarned = totalReferred * 50;
        const requiredForPremium = 10;
        const remainingForPremium = Math.max(0, requiredForPremium - totalReferred);
        
        if (totalReferred >= requiredForPremium && !user.isPremium) {
            await checkAndAwardReferralMilestone(user.id);
            user = await prisma.user.findUnique({ where: { id: req.user.id } });
        }

        const isPremiumUnlocked = user.isPremium || totalReferred >= requiredForPremium;

        res.json({
            referralCode,
            referralLink: `https://storynest.app/ref/${referralCode}`,
            totalReferred,
            coinsEarned,
            rewardPerReferral: 50,
            userBonus: 25,
            requiredForPremium,
            remainingForPremium,
            isPremiumUnlocked,
            hasBeenReferred: !!user.referrerId,
            referredUsers
        });
    } catch (e) { handleError(res, e); }
});

app.post("/referrals/claim", authenticate, writeLimiter, async (req, res) => {
    const { referralCode } = req.body;
    if (!referralCode || !referralCode.trim()) {
        return res.status(400).json({ error: "Please enter a valid referral code." });
    }

    try {
        const user = await prisma.user.findUnique({ where: { id: req.user.id } });
        if (!user) return res.status(404).json({ error: "User not found" });

        if (user.referrerId) {
            return res.status(400).json({ error: "You have already claimed a referral code." });
        }

        const cleanCode = referralCode.trim().toUpperCase();
        if (user.referralCode && user.referralCode.toUpperCase() === cleanCode) {
            return res.status(400).json({ error: "You cannot use your own referral code." });
        }

        const referrer = await prisma.user.findFirst({
            where: {
                referralCode: { equals: cleanCode, mode: "insensitive" }
            }
        });

        if (!referrer) {
            return res.status(404).json({ error: "Invalid referral code. Please check and try again." });
        }

        if (referrer.id === user.id) {
            return res.status(400).json({ error: "You cannot use your own referral code." });
        }

        // Apply reward: +25 coins to user, +50 coins to referrer
        const [updatedUser] = await prisma.$transaction([
            prisma.user.update({
                where: { id: user.id },
                data: {
                    referrerId: referrer.id,
                    coins: { increment: 25 },
                    xp: { increment: 50 }
                },
                select: { id: true, coins: true, xp: true, referrerId: true }
            }),
            prisma.user.update({
                where: { id: referrer.id },
                data: {
                    coins: { increment: 50 },
                    xp: { increment: 100 }
                }
            })
        ]);

        // Check if referrer reached 10 referrals milestone to unlock Premium
        checkAndAwardReferralMilestone(referrer.id).catch(err => console.error(err));

        res.json({
            success: true,
            message: "Referral code applied! You earned 25 Story Coins and 50 XP.",
            coinsEarned: 25,
            newCoins: updatedUser.coins,
            referrerName: referrer.username
        });
    } catch (e) { handleError(res, e); }
});

app.post("/users/me/role", authenticate, async (req, res) => {
    try {
        const me = await prisma.user.findUnique({ where: { id: req.user.id } });
        if (!me) return res.status(404).json({ error: "User not found" });
        const want = String(req.body?.role || "").toUpperCase();
        // Self-service upgrade is READER -> WRITER only. Nothing self-assigns ADMIN.
        if (want !== "WRITER" || me.role !== "READER") {
            return res.status(403).json({ error: "Role change not allowed" });
        }
        const updated = await prisma.user.update({ where: { id: me.id }, data: { role: "WRITER" } });
        const tokens = generateTokens(updated);
        const { password, ...safeUser } = updated;
        res.json({ user: safeUser, ...tokens });
    } catch (e) { handleError(res, e); }
});

app.post("/users/me/settings", authenticate, async (req, res) => {
    const { notificationsOn, recsEnabled, discoverable, showActivity, dateOfBirth } = req.body;
    try {
        const user = await prisma.user.update({
            where: { id: req.user.id },
            data: {
                ...(notificationsOn !== undefined ? { notificationsOn } : {}),
                ...(recsEnabled !== undefined ? { recsEnabled } : {}),
                ...(discoverable !== undefined ? { discoverable } : {}),
                ...(showActivity !== undefined ? { showActivity } : {}),
                ...(dateOfBirth ? { dateOfBirth: new Date(dateOfBirth) } : {}),
            }
        });
        res.json(user);
    } catch (e) { handleError(res, e); }
});

// Publish my chat encryption public key (private key never leaves the device).
app.post("/users/me/keys", authenticate, async (req, res) => {
    try {
        const { publicKey } = req.body;
        if (!publicKey || typeof publicKey !== "string" || publicKey.length > 200) {
            return res.status(400).json({ error: "A valid public key is required" });
        }
        await prisma.user.update({ where: { id: req.user.id }, data: { publicKey } });
        res.json({ status: "ok" });
    } catch (e) { handleError(res, e); }
});

// Anyone's public key (public by design; needed to encrypt to them).
app.get("/users/:id/key", authenticate, async (req, res) => {
    try {
        const user = await prisma.user.findUnique({ where: { id: req.params.id }, select: { id: true, publicKey: true } });
        if (!user) return res.status(404).json({ error: "User not found" });
        res.json({ userId: user.id, publicKey: user.publicKey || null });
    } catch (e) { handleError(res, e); }
});

// Find people to chat with: only users who stayed discoverable, never yourself.
app.get("/users/search", authenticate, async (req, res) => {
    try {
        const q = String(req.query.q || "").trim();
        if (q.length < 2) return res.json([]);
        const users = await prisma.user.findMany({
            where: {
                discoverable: true,
                id: { not: req.user.id },
                OR: [
                    { username: { contains: q, mode: "insensitive" } },
                    { email: { contains: q, mode: "insensitive" } },
                ],
            },
            select: { id: true, username: true, avatarUrl: true, publicKey: true },
            take: 20,
        });
        res.json(users);
    } catch (e) { handleError(res, e); }
});

app.get("/users/discoverable", authenticate, async (req, res) => {
    try {
        const users = await prisma.user.findMany({
            where: { discoverable: true, id: { not: req.user.id } },
            select: { id: true, username: true, avatarUrl: true, publicKey: true },
            orderBy: { username: "asc" },
            take: 50,
        });
        res.json(users);
    } catch (e) { handleError(res, e); }
});

app.get("/users/me/bookmarks", authenticate, async (req, res) => {
    try {
        const bookmarks = await prisma.bookmark.findMany({
            where: { userId: req.user.id },
            include: { story: { include: { _count: { select: { likes: true, comments: true } } } } },
            orderBy: { createdAt: "desc" }
        });
        res.json(bookmarks);
    } catch (e) { handleError(res, e); }
});

app.post("/users/me/preferences", authenticate, async (req, res) => {
    const { readerTheme, readerFontSize } = req.body;
    try {
        const user = await prisma.user.update({ 
            where: { id: req.user.id }, 
            data: { readerTheme, readerFontSize } 
        });
        res.json(user);
    } catch (e) { handleError(res, e); }
});

app.put("/users/me/profile", authenticate, writeLimiter, upload.single("avatar"), async (req, res) => {
    try {
        const { username, bio, dateOfBirth } = req.body;
        const updateData = {};
        if (username) updateData.username = username;
        if (bio) updateData.bio = bio;
        if (dateOfBirth) {
            const dob = new Date(dateOfBirth);
            if (!isNaN(dob.getTime())) updateData.dateOfBirth = dob;
        }
        if (req.file) updateData.avatarUrl = req.file.path;
        
        const user = await prisma.user.update({
            where: { id: req.user.id },
            data: updateData,
            select: { id: true, email: true, username: true, avatarUrl: true, bio: true, role: true, readerTheme: true, readerFontSize: true }
        });
        res.json(user);
    } catch (e) {
        if (e && e.code === "P2002") {
            const rawTarget = e.meta && e.meta.target;
            const target = Array.isArray(rawTarget) ? rawTarget.join(",") : String(rawTarget || "");
            if (target.indexOf("username") !== -1) return res.status(409).json({ error: "That username is taken. Please choose another one." });
            return res.status(409).json({ error: "That is already in use. Please change it and try again." });
        }
        handleError(res, e);
    }
});

// --- ANALYTICS ---

app.get("/admin/analytics", authenticate, async (req, res) => {
    try {
        const stories = await prisma.story.findMany({
            where: { ownerId: req.user.id },
            include: {
                _count: {
                    select: { likes: true, comments: true, history: true }
                }
            }
        });

        const weekAgo = new Date(Date.now() - 7 * 86400000);
        const twoWeeksAgo = new Date(Date.now() - 14 * 86400000);
        const stats = await Promise.all(stories.map(async (s) => {
            const reads = s._count.history;
            const engagement = s._count.likes + s._count.comments;
            const retention = reads > 0 ? Math.min(95, Math.floor(60 + (engagement / reads * 100))) : 0;
            const [bookmarks, finished, recentReads, priorReads] = await Promise.all([
                prisma.bookmark.count({ where: { storyId: s.id } }),
                prisma.bookmark.count({ where: { storyId: s.id, progress: { gte: 95 } } }),
                prisma.history.count({ where: { storyId: s.id, createdAt: { gte: weekAgo } } }),
                prisma.history.count({ where: { storyId: s.id, createdAt: { gte: twoWeeksAgo, lt: weekAgo } } })
            ]);
            const finishRate = bookmarks > 0 ? Math.round((finished / bookmarks) * 100) : 0;
            const trendPct = priorReads > 0 ? Math.round(((recentReads - priorReads) / priorReads) * 100) : (recentReads > 0 ? 100 : 0);

            return {
                id: s.id,
                title: s.title,
                reads,
                likes: s._count.likes,
                comments: s._count.comments,
                retention: `${retention}%`,
                trend: `${trendPct >= 0 ? "+" : ""}${trendPct}%`,
                publishedAt: s.publishedAt,
                finishRate: `${finishRate}%`,
                finishBadge: finishRate >= 90 && bookmarks >= 5
            };
        }));

        res.json(stats);
    } catch (e) { handleError(res, e); }
});

// --- PAYMENTS (PAYSTACK) ---

app.get("/payments/public-key", (req, res) => {
    res.json({ publicKey: config.paystack.publicKey });
});

app.post("/payments/verify", authenticate, async (req, res) => {
    const { reference } = req.body;
    try {
        const paystackRes = await axios.get(`https://api.paystack.co/transaction/verify/${reference}`, {
            headers: { Authorization: `Bearer ${config.paystack.secretKey}` }
        });

        if (paystackRes.data.status && paystackRes.data.data.status === "success") {
            const amount = paystackRes.data.data.amount / 100;

            // Upgrade user to premium
            const updatedUser = await prisma.user.update({
                where: { id: req.user.id },
                data: { 
                    isPremium: true,
                    premiumExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                    coins: { increment: 500 }
                }
            });

            // Log purchase
            await prisma.purchase.create({
                data: {
                    userId: req.user.id,
                    type: "SUBSCRIPTION",
                    amount: amount,
                    currency: paystackRes.data.data.currency
                }
            });

            res.json({ success: true, user: updatedUser });
        } else {
            res.status(400).json({ error: "Payment verification failed" });
        }
    } catch (e) { handleError(res, e); }
});

// --- ACTIVITY FEED ---
// Merged server feed: the user's own logged actions plus likes/comments
// other people left on the user's stories. Cursor: ?before=ISO date.
app.get("/activity/feed", authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        const limit = Math.min(parseInt(req.query.limit) || 20, 50);
        const before = req.query.before ? new Date(req.query.before) : null;
        const timeFilter = before && !isNaN(before) ? { lt: before } : undefined;
        const who = { select: { id: true, username: true, avatarUrl: true } };
        const whichStory = { select: { id: true, title: true, coverUrl: true } };

        const rows = await prisma.activity.findMany({
            where: {
                OR: [{ userId }, { targetUserId: userId }],
                ...(timeFilter ? { createdAt: timeFilter } : {}),
            },
            include: { user: who, story: whichStory },
            orderBy: { createdAt: "desc" },
            take: limit,
        });

        const mine = await prisma.story.findMany({ where: { ownerId: userId }, select: { id: true } });
        const myIds = mine.map(s => s.id);
        let social = [];
        if (myIds.length > 0) {
            const [likes, comments] = await Promise.all([
                prisma.like.findMany({
                    where: { storyId: { in: myIds }, userId: { not: userId }, ...(timeFilter ? { createdAt: timeFilter } : {}) },
                    include: { user: who, story: whichStory },
                    orderBy: { createdAt: "desc" }, take: limit,
                }),
                prisma.comment.findMany({
                    where: { storyId: { in: myIds }, userId: { not: userId }, ...(timeFilter ? { createdAt: timeFilter } : {}) },
                    include: { user: who, story: whichStory },
                    orderBy: { createdAt: "desc" }, take: limit,
                }),
            ]);
            social = [
                ...likes.map(l => ({ kind: "SOCIAL_LIKE", ...l })),
                ...comments.map(c => ({ kind: "SOCIAL_COMMENT", ...c })),
            ];
        }

        const items = [
            ...rows.map(r => ({ kind: "ACTIVITY", ...r })),
            ...social,
        ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, limit);

        res.json(items.map(it => ({
            id: it.id,
            kind: it.kind,
            type: it.type || null,
            text: it.kind === "SOCIAL_LIKE" ? `${it.user?.username || "Someone"} liked your story` :
                it.kind === "SOCIAL_COMMENT" ? `${it.user?.username || "Someone"} commented on your story` :
                it.content || it.type,
            storyId: it.storyId || it.story?.id || null,
            story: it.story || null,
            user: it.user || null,
            createdAt: it.createdAt,
        })));
    } catch (e) { handleError(res, e); }
});

// Client-side journal entries (reads, bookmarks, plays) land here too so
// the server feed stays complete. Fire-and-forget from the app.
app.post("/activity/log", authenticate, async (req, res) => {
    try {
        const { kind, title, sub, storyId } = req.body || {};
        const map = { PLAYLIST: "PLAYLIST_CREATE", PODCAST: "PODCAST_PLAY", REFERRAL: "ACHIEVEMENT", UNLOCK: "ACHIEVEMENT" };
        const type = map[kind] || kind;
        const valid = ["READ", "LIKE", "COMMENT", "ACHIEVEMENT", "PUBLISH", "REVIEW", "POLL_VOTE", "PLAYLIST_CREATE", "MENTION", "MESSAGE", "BOOKMARK", "PODCAST_PLAY"];
        if (!type || !valid.includes(type)) return res.status(400).json({ error: "Unknown activity kind" });
        await logActivity({ userId: req.user.id, type, storyId: storyId || null, content: [title, sub].filter(Boolean).join(" — ").slice(0, 280) || null });
        res.json({ status: "ok" });
    } catch (e) { handleError(res, e); }
});

// --- PODCASTS (real user uploads only) ---
app.get("/podcasts", async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 50, 100);
        const list = await prisma.podcast.findMany({
            orderBy: { createdAt: "desc" },
            take: limit,
            include: { author: { select: { id: true, username: true, avatarUrl: true } } },
        });
        res.json(list.map(p => ({ ...p, author: p.author?.username || p.authorName || "StoryNest Author" })));
    } catch (e) { handleError(res, e); }
});

app.post("/podcasts", authenticate, canCreate, audioUpload.single("audio"), async (req, res) => {
    try {
        const { title, blurb, audioUrl, youtubeUrl, youtubeId, thumbnailUrl } = req.body;
        if (!title || !String(title).trim()) return res.status(400).json({ error: "Title is required" });
        const fileUrl = req.file ? req.file.path : null;
        if (!fileUrl && !audioUrl && !youtubeUrl && !youtubeId) {
            return res.status(400).json({ error: "Attach an audio file, an audio URL, or a YouTube link" });
        }
        const me = await prisma.user.findUnique({ where: { id: req.user.id }, select: { username: true } });
        const cast = await prisma.podcast.create({
            data: {
                title: String(title).trim(),
                blurb: String(blurb || "").trim() || null,
                audioUrl: fileUrl || audioUrl || null,
                youtubeUrl: youtubeUrl || null,
                youtubeId: youtubeId || null,
                thumbnailUrl: thumbnailUrl || null,
                authorId: req.user.id,
                authorName: me?.username || null,
            },
            include: { author: { select: { id: true, username: true, avatarUrl: true } } },
        });
        res.status(201).json({ ...cast, author: cast.author?.username || cast.authorName || "StoryNest Author" });
    } catch (e) { handleError(res, e); }
});

app.post("/podcasts/:id/play", async (req, res) => {
    try {
        await prisma.podcast.update({ where: { id: req.params.id }, data: { plays: { increment: 1 } } });
        res.json({ status: "ok" });
    } catch (e) { res.json({ status: "ok" }); }
});

app.delete("/podcasts/:id", authenticate, async (req, res) => {
    try {
        const cast = await prisma.podcast.findUnique({ where: { id: req.params.id } });
        if (!cast) return res.status(404).json({ error: "Episode not found" });
        if (cast.authorId !== req.user.id && req.user.role !== "ADMIN") return res.status(403).json({ error: "No delete access" });
        await prisma.podcast.delete({ where: { id: req.params.id } });
        res.json({ status: "ok" });
    } catch (e) { handleError(res, e); }
});

// --- AI TRANSLATE (reader globe icon) ---
const translateCache = new NodeCache({ stdTTL: 7 * 24 * 3600 });
const geminiAgent = new (require("https").Agent)({ family: 4, keepAlive: true });
app.post("/ai/translate", authenticate, async (req, res) => {
    try {
        const { text, targetLanguage } = req.body;
        if (!text || !targetLanguage) return res.status(400).json({ error: "text and targetLanguage are required" });
        if (!config.geminiApiKey) return res.status(503).json({ error: "Translation is not configured on this server" });
        if (text.length > 60000) return res.status(400).json({ error: "That chapter is too long to translate at once" });
        const digest = crypto.createHash("sha1").update(`${targetLanguage}:${text}`).digest("hex");
        const chunks = [];
        const MAX = 4000;
        let rest = text;
        while (rest.length > MAX) {
            let cut = rest.lastIndexOf("\n\n", MAX);
            if (cut < 800) cut = rest.lastIndexOf(". ", MAX);
            if (cut < 800) cut = MAX;
            chunks.push(rest.slice(0, cut));
            rest = rest.slice(cut);
        }
        chunks.push(rest);
        const out = new Array(chunks.length);
        const translateGemini = async (text) => {
            const r = await axios.post(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${config.geminiApiKey}`,
                { contents: [{ parts: [{ text: `Translate into ${targetLanguage}. Output translation only:\n\n${text}` }] }] },
                { timeout: 30000, httpsAgent: geminiAgent }
            );
            return r.data?.candidates?.[0]?.content?.parts?.map(p => p.text || "").join("") || "";
        };
        // Last-resort provider when Gemini is down/overloaded (free, keyless).
        const LANG_CODE = { English: "en", Swahili: "sw", French: "fr", Spanish: "es", German: "de", Portuguese: "pt", Arabic: "ar", Hindi: "hi" };
        const translateFallback = async (text) => {
            const code = LANG_CODE[targetLanguage];
            if (!code || code === "en") throw new Error("No fallback for this language");
            const segs = [];
            let rest = text;
            while (rest.length > 450) {
                let cut = rest.lastIndexOf(" ", 450);
                if (cut < 100) cut = 450;
                segs.push(rest.slice(0, cut));
                rest = rest.slice(cut);
            }
            segs.push(rest);
            const parts = new Array(segs.length);
            const one = async (s, i) => {
                if (!s.trim()) { parts[i] = s; return; }
                const r = await axios.get("https://api.mymemory.translated.net/get", {
                    params: { q: s, langpair: `en|${LANG_CODE[targetLanguage]}` },
                    timeout: 20000,
                });
                const t = r.data?.responseData?.translatedText;
                if (!t) throw new Error("Fallback empty");
                parts[i] = t;
                await new Promise((rr) => setTimeout(rr, 150));
            };
            for (let i = 0; i < segs.length; i += 3) {
                await Promise.all(segs.slice(i, i + 3).map((s, j) => one(s, i + j)));
            }
            return parts.join("");
        };
        const translateOne = async (idx) => {
            const ck = `tr:${digest}:${idx}`;
            const hit = translateCache.get(ck);
            if (hit) { out[idx] = hit; return; }
            let lastErr = null;
            for (let attempt = 0; attempt < 2; attempt++) {
                try {
                    const t = await translateGemini(chunks[idx]);
                    if (!t) throw new Error("Empty translation");
                    translateCache.set(ck, t);
                    out[idx] = t;
                    return;
                } catch (e) {
                    lastErr = e;
                    console.error(`[Translate] chunk ${idx} attempt ${attempt + 1}:`, e.response?.data || e.message);
                    if (attempt === 0) await new Promise((rr) => setTimeout(rr, 1000));
                }
            }
            try {
                const t = await translateFallback(chunks[idx]);
                translateCache.set(ck, t);
                out[idx] = t;
            } catch (e2) {
                console.error(`[Translate] chunk ${idx} fallback:`, e2.message);
                throw lastErr;
            }
        };
        // 3 concurrent chunks: a full chapter finishes in one round-trip batch.
        for (let i = 0; i < chunks.length; i += 3) {
            await Promise.all(chunks.slice(i, i + 3).map((_, j) => translateOne(i + j)));
        }
        res.json({ result: out.join("") });
    } catch (e) {
        console.error("[Translate]", e.response?.data || e.message);
        res.status(502).json({ error: "Translation is struggling right now (provider overloaded). Please try again in a minute." });
    }
});

// --- UPLOAD ERRORS (JSON, not HTML) ---
app.use((err, req, res, next) => {
    if (err && (err.name === "MulterError" || String(err.message || "").includes("Cloudinary"))) {
        return res.status(400).json({ error: err.code === "LIMIT_FILE_SIZE" ? "That audio file is too large (60 MB max)." : "Upload failed. Try a smaller file or a link instead." });
    }
    console.error(`[Error] ${new Date().toISOString()}:`, (err && err.message) || err);
    res.status((err && err.status) || 500).json({ error: "Something went wrong on our end. Please try again later." });
});

// --- 404 ---
app.use((req, res) => {
    console.log(`[404] Unhandled: ${req.method} ${req.url}`);
    res.status(404).json({ error: "Not found", method: req.method, url: req.url });
});

// --- BATCHES 2-4: follows, versions, collaborators, reactions, clubs, requests, beta ---

app.post("/users/:id/follow", authenticate, writeLimiter, async (req, res) => {
  const targetId = req.params.id;
  if (targetId === req.user.id) return res.status(400).json({ error: "You cannot follow yourself." });
  try {
    const target = await prisma.user.findUnique({ where: { id: targetId }, select: { id: true } });
    if (!target) return res.status(404).json({ error: "User not found." });
    const key = { followerId_followingId: { followerId: req.user.id, followingId: targetId } };
    const existing = await prisma.follows.findUnique({ where: key.followerId_followingId });
    if (existing) {
      await prisma.follows.delete({ where: key.followerId_followingId });
      return res.json({ isFollowing: false });
    }
    await prisma.follows.create({ data: { followerId: req.user.id, followingId: targetId } });
    res.json({ isFollowing: true });
  } catch (e) { handleError(res, e); }
});

app.get("/users/:id/profile", authenticate, async (req, res) => {
  try {
    const profile = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: { id: true, username: true, avatarUrl: true, bio: true, role: true, streakCount: true, totalReadTime: true, createdAt: true, showActivity: true,
        _count: { select: { followers: true, following: true } } }
    });
    if (!profile) return res.status(404).json({ error: "User not found." });
    const activityHidden = profile.showActivity === false && req.user.id !== profile.id;
    const [stories, achievements, follow] = await Promise.all([
      prisma.story.findMany({ where: { ownerId: profile.id, isDraft: false }, orderBy: { createdAt: "desc" }, take: 20,
        include: { _count: { select: { likes: true, comments: true } } } }),
      activityHidden ? Promise.resolve([]) : prisma.achievement.findMany({ where: { userId: profile.id }, orderBy: { createdAt: "desc" }, take: 12 }),
      prisma.follows.findUnique({ where: { followerId_followingId: { followerId: req.user.id, followingId: profile.id } } })
    ]);
    res.json({ ...profile, stories, achievements, isFollowing: !!follow, activityHidden });
  } catch (e) { handleError(res, e); }
});

app.get("/stories/:id/versions", authenticate, canEditStory, async (req, res) => {
  try {
    const versions = await prisma.version.findMany({ where: { storyId: req.params.id }, orderBy: { createdAt: "desc" }, take: 30 });
    res.json(versions);
  } catch (e) { handleError(res, e); }
});

app.post("/versions/:id/restore", authenticate, writeLimiter, async (req, res) => {
  try {
    const version = await prisma.version.findUnique({ where: { id: req.params.id }, include: { story: { select: { ownerId: true, coAuthors: { select: { id: true } } } } } });
    if (!version) return res.status(404).json({ error: "Version not found." });
    const allowed = version.story.ownerId === req.user.id || req.user.role === "ADMIN" || version.story.coAuthors.some((c) => c.id === req.user.id);
    if (!allowed) return res.status(403).json({ error: "No edit access" });
    const current = await prisma.story.findUnique({ where: { id: version.storyId }, select: { body: true } });
    if (current && current.body) await prisma.version.create({ data: { storyId: version.storyId, body: current.body } });
    const story = await prisma.story.update({ where: { id: version.storyId }, data: { body: version.body } });
    res.json(story);
  } catch (e) { handleError(res, e); }
});

app.post("/stories/:id/collaborators", authenticate, canEditStory, writeLimiter, async (req, res) => {
  const { username } = req.body;
  if (!username || !username.trim()) return res.status(400).json({ error: "Username is required." });
  try {
    const user = await prisma.user.findUnique({ where: { username: username.trim() } });
    if (!user) return res.status(404).json({ error: "User not found." });
    if (user.role !== "WRITER" && user.role !== "ADMIN") return res.status(400).json({ error: "Only writers can co-author." });
    const story = await prisma.story.update({ where: { id: req.params.id }, data: { coAuthors: { connect: { id: user.id } } }, include: { coAuthors: { select: { id: true, username: true, avatarUrl: true } } } });
    res.json(story.coAuthors);
  } catch (e) { handleError(res, e); }
});

app.delete("/stories/:id/collaborators/:userId", authenticate, canEditStory, writeLimiter, async (req, res) => {
  try {
    await prisma.story.update({ where: { id: req.params.id }, data: { coAuthors: { disconnect: { id: req.params.userId } } } });
    res.json({ success: true });
  } catch (e) { handleError(res, e); }
});

app.get("/stories/:id/reactions", async (req, res) => {
  const { chapterId } = req.query;
  try {
    const reactions = await prisma.reaction.findMany({ where: { storyId: req.params.id, ...(chapterId ? { chapterId } : {}) } });
    const counts = {};
    reactions.forEach((r) => { counts[r.emoji] = (counts[r.emoji] || 0) + 1; });
    let mine = [];
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      try {
        const me = jwt.verify(authHeader.split(" ")[1], config.jwtAccessSecret).id;
        mine = reactions.filter((r) => r.userId === me).map((r) => r.emoji);
      } catch (e) {}
    }
    res.json({ counts, mine, total: reactions.length });
  } catch (e) { handleError(res, e); }
});

const ALLOWED_REACTIONS = ["❤️", "😂", "😮", "😢", "🔥"];

app.post("/stories/:id/reactions", authenticate, writeLimiter, async (req, res) => {
  const { emoji, chapterId } = req.body;
  if (!ALLOWED_REACTIONS.includes(emoji)) return res.status(400).json({ error: "Invalid reaction." });
  try {
    const where = { userId: req.user.id, storyId: req.params.id, chapterId: chapterId || null, emoji };
    const existing = await prisma.reaction.findFirst({ where });
    if (existing) await prisma.reaction.delete({ where: { id: existing.id } });
    else await prisma.reaction.create({ data: where });
    const reactions = await prisma.reaction.findMany({ where: { storyId: req.params.id, ...(chapterId ? { chapterId } : {}) } });
    const counts = {};
    reactions.forEach((r) => { counts[r.emoji] = (counts[r.emoji] || 0) + 1; });
    res.json({ counts, mine: reactions.filter((r) => r.userId === req.user.id).map((r) => r.emoji) });
  } catch (e) { handleError(res, e); }
});

app.get("/clubs", authenticate, async (req, res) => {
  try {
    const clubs = await prisma.club.findMany({ orderBy: { createdAt: "desc" }, take: 50 });
    const withCounts = await Promise.all(clubs.map(async (c) => {
      const [memberCount, mine] = await Promise.all([
        prisma.clubMember.count({ where: { clubId: c.id } }),
        prisma.clubMember.findUnique({ where: { clubId_userId: { clubId: c.id, userId: req.user.id } } })
      ]);
      return { ...c, memberCount, isMember: !!mine };
    }));
    res.json(withCounts);
  } catch (e) { handleError(res, e); }
});

app.post("/clubs", authenticate, canCreate, writeLimiter, async (req, res) => {
  const { name, description } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: "Club name is required." });
  try {
    const inviteCode = crypto.randomBytes(4).toString("hex").toUpperCase();
    const club = await prisma.club.create({ data: { name: name.trim(), description: description || null, ownerId: req.user.id, inviteCode } });
    await prisma.clubMember.create({ data: { clubId: club.id, userId: req.user.id, role: "OWNER" } });
    res.status(201).json(club);
  } catch (e) { handleError(res, e); }
});

app.post("/clubs/:id/join", authenticate, writeLimiter, async (req, res) => {
  try {
    const club = await prisma.club.findFirst({ where: { OR: [{ id: req.params.id }, { inviteCode: String(req.body.code || "").toUpperCase() }] } });
    if (!club) return res.status(404).json({ error: "Club not found." });
    await prisma.clubMember.upsert({ where: { clubId_userId: { clubId: club.id, userId: req.user.id } }, update: {}, create: { clubId: club.id, userId: req.user.id } });
    res.json({ success: true, clubId: club.id });
  } catch (e) { handleError(res, e); }
});

app.get("/clubs/:id/messages", authenticate, async (req, res) => {
  try {
    const member = await prisma.clubMember.findUnique({ where: { clubId_userId: { clubId: req.params.id, userId: req.user.id } } });
    if (!member) return res.status(403).json({ error: "Join this club to read messages." });
    const messages = await prisma.clubMessage.findMany({ where: { clubId: req.params.id }, orderBy: { createdAt: "asc" }, take: 200 });
    res.json(messages);
  } catch (e) { handleError(res, e); }
});

app.post("/clubs/:id/messages", authenticate, writeLimiter, async (req, res) => {
  const { content } = req.body;
  if (!content || !content.trim()) return res.status(400).json({ error: "Message is required." });
  try {
    const member = await prisma.clubMember.findUnique({ where: { clubId_userId: { clubId: req.params.id, userId: req.user.id } } });
    if (!member) return res.status(403).json({ error: "Join this club first." });
    const me = await prisma.user.findUnique({ where: { id: req.user.id }, select: { username: true, avatarUrl: true } });
    const message = await prisma.clubMessage.create({ data: { clubId: req.params.id, userId: req.user.id, username: me.username, avatarUrl: me.avatarUrl, content: content.trim() } });
    res.status(201).json(message);
  } catch (e) { handleError(res, e); }
});

app.get("/requests", async (req, res) => {
  try {
    const requests = await prisma.storyRequest.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
    res.json(requests);
  } catch (e) { handleError(res, e); }
});

app.post("/requests", authenticate, writeLimiter, async (req, res) => {
  const { title, genre, description } = req.body;
  if (!title || !title.trim()) return res.status(400).json({ error: "Title is required." });
  try {
    const me = await prisma.user.findUnique({ where: { id: req.user.id }, select: { username: true } });
    const request = await prisma.storyRequest.create({ data: { userId: req.user.id, username: me.username, title: title.trim(), genre: genre || "Fiction", description: description || null } });
    res.status(201).json(request);
  } catch (e) { handleError(res, e); }
});

app.post("/requests/:id/claim", authenticate, canCreate, writeLimiter, async (req, res) => {
  try {
    const existing = await prisma.storyRequest.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: "Request not found." });
    if (existing.status !== "OPEN") return res.status(400).json({ error: "Already claimed." });
    const me = await prisma.user.findUnique({ where: { id: req.user.id }, select: { username: true } });
    const updated = await prisma.storyRequest.update({ where: { id: req.params.id }, data: { status: "CLAIMED", claimedById: req.user.id, claimedByName: me.username } });
    res.json(updated);
  } catch (e) { handleError(res, e); }
});

app.post("/stories/:id/beta-invites", authenticate, canEditStory, writeLimiter, async (req, res) => {
  try {
    const code = "BETA-" + crypto.randomBytes(3).toString("hex").toUpperCase();
    const invite = await prisma.betaInvite.create({ data: { storyId: req.params.id, code, createdById: req.user.id } });
    res.status(201).json(invite);
  } catch (e) { handleError(res, e); }
});

app.get("/stories/:id/beta-invites", authenticate, canEditStory, async (req, res) => {
  try {
    const invites = await prisma.betaInvite.findMany({ where: { storyId: req.params.id }, orderBy: { createdAt: "desc" } });
    res.json(invites);
  } catch (e) { handleError(res, e); }
});

app.post("/beta/redeem", authenticate, async (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: "Code is required." });
  try {
    const invite = await prisma.betaInvite.findUnique({ where: { code: String(code).trim().toUpperCase() } });
    if (!invite) return res.status(404).json({ error: "Invalid beta code." });
    await prisma.betaInvite.update({ where: { id: invite.id }, data: { redeemedById: req.user.id } });
    res.json({ storyId: invite.storyId });
  } catch (e) { handleError(res, e); }
});

// --- BATCH 5: gamification ---

app.get("/gamification/leaderboard", authenticate, async (req, res) => {
  try {
    const leaders = await prisma.user.findMany({ orderBy: { xp: "desc" }, take: 20, select: { id: true, username: true, avatarUrl: true, xp: true, isPremium: true } });
    res.json(leaders);
  } catch (e) { handleError(res, e); }
});

app.get("/gamification/achievements", authenticate, async (req, res) => {
  try {
    const unlocked = await prisma.achievement.findMany({ where: { userId: req.user.id }, orderBy: { createdAt: "desc" } });
    const byTitle = {};
    unlocked.forEach((a) => { byTitle[a.title] = a; });
    res.json({ catalog: ACHIEVEMENT_CATALOG.map((c) => ({ ...c, unlocked: !!byTitle[c.title], unlockedAt: byTitle[c.title] ? byTitle[c.title].createdAt : null })), total: unlocked.length });
  } catch (e) { handleError(res, e); }
});

app.post("/gamification/streak-freeze", authenticate, writeLimiter, async (req, res) => {
  const COST = 50;
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id }, select: { coins: true, streakCount: true, lastReadDate: true } });
    if (!user || (user.streakCount || 0) <= 0) return res.status(400).json({ error: "No active streak to protect." });
    if ((user.coins || 0) < COST) return res.status(400).json({ error: `You need ${COST} coins for a freeze.` });
    const today = dayKey(new Date());
    const last = user.lastReadDate ? dayKey(user.lastReadDate) : null;
    if (last === today || last === dayKey(Date.now() - 86400000)) return res.status(400).json({ error: "Your streak is safe. Come back if you miss a day." });
    if (last !== dayKey(Date.now() - 2 * 86400000)) return res.status(400).json({ error: "Too late — that streak is already gone." });
    const updated = await prisma.user.update({ where: { id: req.user.id }, data: { coins: { decrement: COST }, lastReadDate: new Date() }, select: { coins: true, streakCount: true } });
    res.json({ success: true, coins: updated.coins, streak: updated.streakCount });
  } catch (e) { handleError(res, e); }
});

app.get("/gamification/challenges", authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const wk = weekKey();
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const [reads, user, claims] = await Promise.all([
      prisma.history.findMany({ where: { userId, createdAt: { gte: weekStart } }, include: { story: { select: { genre: true } } } }),
      prisma.user.findUnique({ where: { id: userId }, select: { streakCount: true } }),
      prisma.achievement.findMany({ where: { userId, title: { startsWith: "challenge:" } }, select: { title: true } })
    ]);
    const claimed = new Set(claims.map((c) => c.title));
    const genres = new Set(reads.map((r) => r.story && r.story.genre).filter(Boolean));
    const defs = [
      { id: `challenge:weekly-reads:${wk}`, title: "Weekly Reader", desc: "Read 5 stories this week", progress: Math.min(reads.length, 5), goal: 5, reward: 30 },
      { id: `challenge:genre-explorer:${wk}`, title: "Genre Explorer", desc: "Read 3 different genres this week", progress: Math.min(genres.size, 3), goal: 3, reward: 40 },
      { id: `challenge:streak-keeper:${wk}`, title: "Streak Keeper", desc: "Reach a 3-day streak", progress: Math.min((user && user.streakCount) || 0, 3), goal: 3, reward: 50 },
    ];
    res.json(defs.map((d) => ({ ...d, claimed: claimed.has(d.id), complete: d.progress >= d.goal })));
  } catch (e) { handleError(res, e); }
});

app.post("/gamification/claim", authenticate, writeLimiter, async (req, res) => {
  const { key, coins, title, icon } = req.body;
  const reward = Math.min(Math.max(parseInt(coins) || 0, 0), 200);
  if (!key || typeof key !== "string" || !reward) return res.status(400).json({ error: "Invalid claim." });
  if (!/^(challenge|season):[A-Za-z0-9-_:.]+$/.test(key)) return res.status(400).json({ error: "Invalid claim." });
  try {
    const existing = await prisma.achievement.findFirst({ where: { userId: req.user.id, title: key } });
    if (existing) return res.status(400).json({ error: "Already claimed." });
    await prisma.achievement.create({ data: { userId: req.user.id, title: key, icon: icon || "Gift" } });
    const user = await prisma.user.update({ where: { id: req.user.id }, data: { coins: { increment: reward } }, select: { coins: true } });
    res.json({ success: true, coins: user.coins, title: title || key });
  } catch (e) { handleError(res, e); }
});

app.get("/users/me/purchases", authenticate, async (req, res) => {
  try {
    const purchases = await prisma.purchase.findMany({ where: { userId: req.user.id }, orderBy: { createdAt: "desc" }, take: 50 });
    const storyIds = [...new Set(purchases.map((p) => p.storyId).filter(Boolean))];
    const stories = storyIds.length > 0 ? await prisma.story.findMany({ where: { id: { in: storyIds } }, select: { id: true, title: true } }) : [];
    const titles = {};
    stories.forEach((s) => { titles[s.id] = s.title; });
    res.json(purchases.map((p) => ({ ...p, storyTitle: p.storyId ? titles[p.storyId] || null : null })));
  } catch (e) { handleError(res, e); }
});

// --- BATCHES 10-11: trust, admin, platform ---

app.post("/auth/totp/setup", authenticate, async (req, res) => {
  try {
    const secret = newTotpSecret();
    await prisma.user.update({ where: { id: req.user.id }, data: { totpSecret: secret, totpEnabled: false } });
    const me = await prisma.user.findUnique({ where: { id: req.user.id }, select: { email: true } });
    const otpauth = `otpauth://totp/StoryNest:${encodeURIComponent(me.email)}?secret=${secret}&issuer=StoryNest`;
    res.json({ secret, otpauth });
  } catch (e) { handleError(res, e); }
});

app.post("/auth/totp/verify", authenticate, async (req, res) => {
  try {
    const me = await prisma.user.findUnique({ where: { id: req.user.id }, select: { totpSecret: true } });
    if (!verifyTotp(me && me.totpSecret, req.body.code)) return res.status(400).json({ error: "Invalid code." });
    await prisma.user.update({ where: { id: req.user.id }, data: { totpEnabled: true } });
    res.json({ success: true });
  } catch (e) { handleError(res, e); }
});

app.post("/auth/totp/disable", authenticate, async (req, res) => {
  try {
    const me = await prisma.user.findUnique({ where: { id: req.user.id }, select: { totpSecret: true, password: true } });
    const codeOk = req.body.code ? verifyTotp(me.totpSecret, req.body.code) : false;
    const pwOk = req.body.password ? await bcrypt.compare(req.body.password, me.password || "") : false;
    if (!codeOk && !pwOk) return res.status(401).json({ error: "Confirm with your 2FA code or password." });
    await prisma.user.update({ where: { id: req.user.id }, data: { totpEnabled: false, totpSecret: null } });
    res.json({ success: true });
  } catch (e) { handleError(res, e); }
});

app.post("/auth/logout-all", authenticate, async (req, res) => {
  try {
    await prisma.user.update({ where: { id: req.user.id }, data: { tokenVersion: { increment: 1 } } });
    res.json({ success: true, message: "All other sessions have been signed out." });
  } catch (e) { handleError(res, e); }
});

app.post("/reports", authenticate, writeLimiter, async (req, res) => {
  const { targetType, targetId, reason, details } = req.body;
  if (!["story", "comment", "user", "chapter"].includes(targetType) || !targetId || !reason) return res.status(400).json({ error: "Invalid report." });
  try {
    const report = await prisma.report.create({ data: { reporterId: req.user.id, targetType, targetId, reason: String(reason).slice(0, 120), details: details ? String(details).slice(0, 2000) : null } });
    res.status(201).json(report);
  } catch (e) { handleError(res, e); }
});

app.get("/admin/reports", authenticate, requireRole("ADMIN"), async (req, res) => {
  try {
    const { status } = req.query;
    const [reports, open] = await Promise.all([
      prisma.report.findMany({ where: status ? { status } : {}, orderBy: { createdAt: "desc" }, take: 100 }),
      prisma.report.count({ where: { status: "OPEN" } })
    ]);
    res.json({ reports, open });
  } catch (e) { handleError(res, e); }
});

app.post("/admin/reports/:id/resolve", authenticate, requireRole("ADMIN"), writeLimiter, async (req, res) => {
  const { action } = req.body;
  try {
    const report = await prisma.report.findUnique({ where: { id: req.params.id } });
    if (!report) return res.status(404).json({ error: "Report not found." });
    if (action === "REMOVE") {
      if (report.targetType === "story") await prisma.story.update({ where: { id: report.targetId }, data: { isDraft: true } }).catch(() => {});
      if (report.targetType === "comment") await prisma.comment.delete({ where: { id: report.targetId } }).catch(() => {});
      if (report.targetType === "chapter") await prisma.chapter.update({ where: { id: report.targetId }, data: { isDraft: true } }).catch(() => {});
    }
    if (action === "BAN" && report.targetType === "user") {
      await prisma.user.update({ where: { id: report.targetId }, data: { isBanned: true } }).catch(() => {});
    }
    await prisma.report.update({ where: { id: report.id }, data: { status: "RESOLVED" } });
    res.json({ success: true });
  } catch (e) { handleError(res, e); }
});

app.post("/users/:id/block", authenticate, writeLimiter, async (req, res) => {
  const targetId = req.params.id;
  if (targetId === req.user.id) return res.status(400).json({ error: "You cannot block yourself." });
  try {
    const key = { blockerId_blockedId: { blockerId: req.user.id, blockedId: targetId } };
    const existing = await prisma.block.findUnique({ where: key.blockerId_blockedId });
    if (existing) {
      await prisma.block.delete({ where: key.blockerId_blockedId });
      return res.json({ isBlocked: false });
    }
    await prisma.block.create({ data: { blockerId: req.user.id, blockedId: targetId } });
    res.json({ isBlocked: true });
  } catch (e) { handleError(res, e); }
});

app.get("/users/me/blocks", authenticate, async (req, res) => {
  try {
    const blocks = await prisma.block.findMany({ where: { blockerId: req.user.id }, select: { blockedId: true } });
    res.json(blocks.map((b) => b.blockedId));
  } catch (e) { handleError(res, e); }
});

app.get("/users/me/export", authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const [user, stories, bookmarks, history, comments, likes, achievements, purchases] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId } }),
      prisma.story.findMany({ where: { ownerId: userId } }),
      prisma.bookmark.findMany({ where: { userId } }),
      prisma.history.findMany({ where: { userId }, take: 1000 }),
      prisma.comment.findMany({ where: { userId }, take: 1000 }),
      prisma.like.findMany({ where: { userId } }),
      prisma.achievement.findMany({ where: { userId } }),
      prisma.purchase.findMany({ where: { userId } }),
    ]);
    if (user) { delete user.password; delete user.totpSecret; }
    res.json({ exportedAt: new Date().toISOString(), user, stories, bookmarks, history, comments, likes, achievements, purchases });
  } catch (e) { handleError(res, e); }
});

app.delete("/auth/account", authenticate, async (req, res) => {
  const userId = req.user.id;
  try {
    const owned = await prisma.story.findMany({ where: { ownerId: userId }, select: { id: true } });
    const storyIds = owned.map((s) => s.id);
    const ops = [
      prisma.history.deleteMany({ where: { userId } }),
      prisma.bookmark.deleteMany({ where: { userId } }),
      prisma.comment.deleteMany({ where: { userId } }),
      prisma.like.deleteMany({ where: { userId } }),
      prisma.achievement.deleteMany({ where: { userId } }),
      prisma.message.deleteMany({ where: { senderId: userId } }),
      prisma.follows.deleteMany({ where: { OR: [{ followerId: userId }, { followingId: userId }] } }),
      prisma.block.deleteMany({ where: { OR: [{ blockerId: userId }, { blockedId: userId }] } }),
      prisma.report.deleteMany({ where: { reporterId: userId } }),
      prisma.purchase.deleteMany({ where: { userId } }),
      prisma.poll.deleteMany({ where: { userId } }),
      prisma.review.deleteMany({ where: { userId } }),
      prisma.highlight.deleteMany({ where: { userId } }),
    ];
    if (storyIds.length > 0) {
      ops.push(
        prisma.history.deleteMany({ where: { storyId: { in: storyIds } } }),
        prisma.bookmark.deleteMany({ where: { storyId: { in: storyIds } } }),
        prisma.comment.deleteMany({ where: { storyId: { in: storyIds } } }),
        prisma.like.deleteMany({ where: { storyId: { in: storyIds } } }),
        prisma.chapter.deleteMany({ where: { storyId: { in: storyIds } } }),
        prisma.version.deleteMany({ where: { storyId: { in: storyIds } } }),
        prisma.story.deleteMany({ where: { id: { in: storyIds } } })
      );
    }
    ops.push(prisma.user.delete({ where: { id: userId } }));
    await prisma.$transaction(ops);
    res.json({ success: true });
  } catch (e) { handleError(res, e); }
});

app.get("/admin/users", authenticate, requireRole("ADMIN"), async (req, res) => {
  const { q, take } = req.query;
  try {
    const users = await prisma.user.findMany({
      where: q ? { OR: [{ username: { contains: q, mode: "insensitive" } }, { email: { contains: String(q).toLowerCase() } }] } : {},
      orderBy: { createdAt: "desc" }, take: Math.min(parseInt(take) || 30, 100),
      select: { id: true, username: true, email: true, role: true, isBanned: true, coins: true, xp: true, streakCount: true, createdAt: true, _count: { select: { ownedStories: true } } },
    });
    res.json(users);
  } catch (e) { handleError(res, e); }
});

app.put("/admin/users/:id/role", authenticate, requireRole("ADMIN"), writeLimiter, async (req, res) => {
  const { role } = req.body;
  if (!["READER", "WRITER", "ADMIN"].includes(role)) return res.status(400).json({ error: "Invalid role." });
  try {
    const user = await prisma.user.update({ where: { id: req.params.id }, data: { role }, select: { id: true, username: true, role: true } });
    res.json(user);
  } catch (e) { handleError(res, e); }
});

app.put("/admin/users/:id/ban", authenticate, requireRole("ADMIN"), writeLimiter, async (req, res) => {
  try {
    const target = await prisma.user.findUnique({ where: { id: req.params.id }, select: { isBanned: true, role: true } });
    if (!target) return res.status(404).json({ error: "User not found." });
    if (target.role === "ADMIN") return res.status(400).json({ error: "Cannot ban an admin." });
    const user = await prisma.user.update({ where: { id: req.params.id }, data: { isBanned: !target.isBanned }, select: { id: true, username: true, isBanned: true } });
    res.json(user);
  } catch (e) { handleError(res, e); }
});

app.get("/admin/errors", authenticate, requireRole("ADMIN"), async (req, res) => {
  try {
    const [errors, fatal] = await Promise.all([
      prisma.errorLog.findMany({ orderBy: { updatedAt: "desc" }, take: 100 }),
      prisma.errorLog.count({ where: { isFatal: true } })
    ]);
    res.json({ errors, fatal });
  } catch (e) { handleError(res, e); }
});

app.post("/admin/stories/bulk", authenticate, requireRole("ADMIN"), writeLimiter, async (req, res) => {
  const { ids, action, genre } = req.body;
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 100) return res.status(400).json({ error: "Provide 1-100 story ids." });
  try {
    let result;
    if (action === "publish") result = await prisma.story.updateMany({ where: { id: { in: ids } }, data: { isDraft: false, publishedAt: new Date() } });
    else if (action === "unlist") result = await prisma.story.updateMany({ where: { id: { in: ids } }, data: { isDraft: true } });
    else if (action === "feature") result = await prisma.story.updateMany({ where: { id: { in: ids } }, data: { isFeatured: true, featuredUntil: null } });
    else if (action === "unfeature") result = await prisma.story.updateMany({ where: { id: { in: ids } }, data: { isFeatured: false, featuredUntil: null } });
    else if (action === "tag" && genre) result = await prisma.story.updateMany({ where: { id: { in: ids } }, data: { genre } });
    else if (action === "delete") {
      await prisma.chapter.deleteMany({ where: { storyId: { in: ids } } });
      await prisma.comment.deleteMany({ where: { storyId: { in: ids } } });
      result = await prisma.story.deleteMany({ where: { id: { in: ids } } });
    }
    else return res.status(400).json({ error: "Invalid action." });
    res.json({ success: true, count: result.count });
  } catch (e) { handleError(res, e); }
});

app.put("/admin/stories/:id/feature", authenticate, requireRole("ADMIN"), writeLimiter, async (req, res) => {
  const { days } = req.body;
  try {
    const n = parseInt(days) || 0;
    const story = await prisma.story.update({ where: { id: req.params.id }, data: n > 0 ? { isFeatured: true, featuredUntil: new Date(Date.now() + n * 86400000) } : { isFeatured: false, featuredUntil: null } });
    res.json({ id: story.id, isFeatured: story.isFeatured, featuredUntil: story.featuredUntil });
  } catch (e) { handleError(res, e); }
});

app.get("/app/config", async (req, res) => {
  res.json({
    flags: { clubs: true, seasons: true, betaReader: true, podcasts: true, ...runtimeFlags },
    minSupportedVersion: "1.0.0",
    latestVersion: "1.0.7",
    supportEmail: "support@storynest.app",
  });
});

app.get("/v1/stories", async (req, res) => {
  const { genre, limit } = req.query;
  try {
    const stories = await prisma.story.findMany({ where: { isDraft: false, ...(genre ? { genre } : {}) }, take: Math.min(parseInt(limit) || 20, 50), orderBy: { createdAt: "desc" }, select: { id: true, title: true, genre: true, authorName: true, summary: true, coverUrl: true, readingTime: true, publishedAt: true } });
    res.json({ data: stories });
  } catch (e) { handleError(res, e); }
});

app.get("/v1/stories/:id", async (req, res) => {
  try {
    const story = await prisma.story.findUnique({ where: { id: req.params.id }, select: { id: true, title: true, genre: true, authorName: true, summary: true, coverUrl: true, readingTime: true, mood: true, contentWarnings: true, isAdult: true, publishedAt: true, chapters: { where: { isDraft: false }, orderBy: { order: "asc" }, select: { id: true, title: true, order: true } } } });
    if (!story) return res.status(404).json({ error: "Not found" });
    res.json({ data: story });
  } catch (e) { handleError(res, e); }
});

// --- BATCH 11: flags, announcements, sessions, schedule, currencies, backup ---
const runtimeFlags = {};
const announcements = [];

app.get("/admin/flags", authenticate, requireRole("ADMIN"), async (req, res) => {
  const base = { clubs: true, seasons: true, betaReader: true, podcasts: true, ...runtimeFlags };
  res.json(Object.entries(base).map(([key, v]) => (v && typeof v === "object" ? { key, enabled: !!v.enabled, percent: v.percent ?? 100 } : { key, enabled: !!v, percent: 100 })));
});

app.post("/admin/flags", authenticate, requireRole("ADMIN"), writeLimiter, async (req, res) => {
  const { key, enabled, percent } = req.body;
  if (!key || typeof key !== "string") return res.status(400).json({ error: "Flag key required." });
  const k = key.trim().slice(0, 60);
  const p = percent === undefined ? 100 : Math.max(0, Math.min(100, parseInt(percent) || 0));
  runtimeFlags[k] = p >= 100 ? !!enabled : { enabled: !!enabled, percent: p };
  res.json({ key: k, enabled: !!enabled, percent: p });
});

app.get("/announcements", async (req, res) => {
  res.json(announcements.slice(0, 20));
});

app.post("/admin/announcements", authenticate, requireRole("ADMIN"), writeLimiter, async (req, res) => {
  const { title, body } = req.body;
  if (!title || !body) return res.status(400).json({ error: "Title and body required." });
  const item = { id: `a_${Date.now()}`, title: String(title).slice(0, 120), body: String(body).slice(0, 2000), createdAt: new Date().toISOString() };
  announcements.unshift(item);
  while (announcements.length > 20) announcements.pop();
  res.json(item);
});

app.get("/users/me/sessions", authenticate, async (req, res) => {
  try {
    const me = await prisma.user.findUnique({ where: { id: req.user.id }, select: { tokenVersion: true } });
    res.json([{ id: "current", device: req.get("user-agent") || "This device", lastActive: new Date().toISOString(), tokenVersion: me ? me.tokenVersion : 0 }]);
  } catch (e) { handleError(res, e); }
});

app.post("/admin/users/:id/ban", authenticate, requireRole("ADMIN"), writeLimiter, async (req, res) => {
  try {
    const target = await prisma.user.findUnique({ where: { id: req.params.id }, select: { role: true } });
    if (!target) return res.status(404).json({ error: "User not found." });
    if (target.role === "ADMIN") return res.status(400).json({ error: "Cannot ban an admin." });
    const user = await prisma.user.update({ where: { id: req.params.id }, data: { isBanned: req.body.banned !== false }, select: { id: true, username: true, isBanned: true } });
    res.json(user);
  } catch (e) { handleError(res, e); }
});

app.post("/admin/stories/:id/schedule", authenticate, requireRole("ADMIN"), writeLimiter, async (req, res) => {
  const at = new Date(req.body.publishAt);
  if (isNaN(at.getTime()) || at.getTime() <= Date.now()) return res.status(400).json({ error: "Provide a future publishAt date." });
  try {
    const story = await prisma.story.update({ where: { id: req.params.id }, data: { isDraft: true, publishedAt: at }, select: { id: true } });
    setTimeout(() => { prisma.story.update({ where: { id: story.id }, data: { isDraft: false } }).catch(() => {}); }, Math.min(at.getTime() - Date.now(), 2147483647));
    res.json({ id: story.id, scheduledFor: at.toISOString() });
  } catch (e) { handleError(res, e); }
});

const CURRENCIES = [
  { code: "KES", symbol: "KSh", name: "Kenyan Shilling" },
  { code: "USD", symbol: "$", name: "US Dollar" },
  { code: "NGN", symbol: "₦", name: "Nigerian Naira" },
  { code: "GHS", symbol: "₵", name: "Ghanaian Cedi" },
  { code: "ZAR", symbol: "R", name: "South African Rand" },
  { code: "GBP", symbol: "£", name: "British Pound" },
  { code: "EUR", symbol: "€", name: "Euro" },
  { code: "UGX", symbol: "USh", name: "Ugandan Shilling" },
  { code: "TZS", symbol: "TSh", name: "Tanzanian Shilling" },
];

app.get("/currencies", async (req, res) => {
  res.json(CURRENCIES);
});

app.get("/admin/backup", authenticate, requireRole("ADMIN"), async (req, res) => {
  try {
    const [userCount, storyCount, chapterCount, commentCount, users, stories] = await Promise.all([
      prisma.user.count(),
      prisma.story.count(),
      prisma.chapter.count(),
      prisma.comment.count(),
      prisma.user.findMany({ select: { id: true, username: true, email: true, role: true, coins: true, xp: true, createdAt: true }, take: 5000 }),
      prisma.story.findMany({ select: { id: true, title: true, genre: true, ownerId: true, isDraft: true, createdAt: true }, take: 5000 }),
    ]);
    res.setHeader("Content-Disposition", `attachment; filename="storynest-backup-${Date.now()}.json"`);
    res.json({ exportedAt: new Date().toISOString(), counts: { userCount, storyCount, chapterCount, commentCount }, users, stories });
  } catch (e) { handleError(res, e); }
});

// --- GAP CLOSURE: audiobooks, analytics, digest, epub, status, scheduled backups ---
const sendEmail = async (to, subject, html, text) => {
  try {
    const nodemailer = require("nodemailer");
    const transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth: { user: config.smtp.auth.user, pass: config.smtp.auth.pass },
    });
    await transporter.sendMail({
      from: `"StoryNest" <${config.smtp.auth.user}>`,
      to, subject, html, text: text || String(html || "").replace(/<[^>]+>/g, " "),
    });
    return true;
  } catch (e) {
    console.error("[sendEmail] failed:", e.message);
    return false;
  }
};

app.post("/chapters/:id/audio", authenticate, canEditChapter, audioUpload.single("audio"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No audio file received." });
    const chapter = await prisma.chapter.update({ where: { id: req.params.id }, data: { audioUrl: req.file.path }, select: { id: true, audioUrl: true } });
    res.json(chapter);
  } catch (e) { handleError(res, e); }
});

app.get("/admin/analytics", authenticate, requireRole("ADMIN"), async (req, res) => {
  try {
    const now = new Date();
    const day = 86400000;
    const since = (n) => new Date(now.getTime() - n * day);
    const [dauRows, mauRows, newUsers7, newUsersPrev7, activeNew, genreReads, purchases, userCount, storyCount] = await Promise.all([
      prisma.history.groupBy({ by: ["userId"], where: { createdAt: { gte: since(1) } } }),
      prisma.history.groupBy({ by: ["userId"], where: { createdAt: { gte: since(30) } } }),
      prisma.user.findMany({ where: { createdAt: { gte: since(7) } }, select: { id: true } }),
      prisma.user.findMany({ where: { createdAt: { gte: since(14), lt: since(7) } }, select: { id: true } }),
      prisma.history.groupBy({ by: ["userId"], where: { createdAt: { gte: since(7) }, user: { createdAt: { gte: since(14), lt: since(7) } } } }),
      prisma.history.findMany({ where: { createdAt: { gte: since(30) } }, select: { story: { select: { genre: true } } }, take: 20000 }),
      prisma.purchase.findMany({ where: { createdAt: { gte: since(30) } }, select: { amount: true, currency: true, createdAt: true } }),
      prisma.user.count(),
      prisma.story.count(),
    ]);
    const readsPerGenre = {};
    genreReads.forEach((h) => {
      const g = (h.story && h.story.genre) || "Unknown";
      readsPerGenre[g] = (readsPerGenre[g] || 0) + 1;
    });
    const revenueByDay = {};
    const revenueByCurrency = {};
    purchases.forEach((p) => {
      const d = p.createdAt.toISOString().slice(0, 10);
      revenueByDay[d] = (revenueByDay[d] || 0) + (p.amount || 0);
      revenueByCurrency[p.currency || "COIN"] = (revenueByCurrency[p.currency || "COIN"] || 0) + (p.amount || 0);
    });
    res.json({
      dau: dauRows.length,
      mau: mauRows.length,
      newUsers7d: newUsers7.length,
      retention7d: newUsersPrev7.length > 0 ? Math.round((activeNew.length / newUsersPrev7.length) * 100) : null,
      readsPerGenre, revenueByDay, revenueByCurrency,
      totals: { users: userCount, stories: storyCount, purchases30d: purchases.length },
    });
  } catch (e) { handleError(res, e); }
});

app.get("/admin/scheduled", authenticate, requireRole("ADMIN"), async (req, res) => {
  try {
    const now = new Date();
    const [stories, chapters, featured] = await Promise.all([
      prisma.story.findMany({ where: { publishedAt: { gt: now } }, select: { id: true, title: true, publishedAt: true }, orderBy: { publishedAt: "asc" }, take: 50 }),
      prisma.chapter.findMany({ where: { publishedAt: { gt: now }, isDraft: true }, select: { id: true, title: true, storyId: true, publishedAt: true }, orderBy: { publishedAt: "asc" }, take: 50 }),
      prisma.story.findMany({ where: { isFeatured: true }, select: { id: true, title: true, featuredUntil: true }, take: 50 }),
    ]);
    res.json({ stories, chapters, featured });
  } catch (e) { handleError(res, e); }
});

app.post("/admin/digest/run", authenticate, requireRole("ADMIN"), writeLimiter, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.body.limit) || 50, 200);
    const users = await prisma.user.findMany({ where: { notificationsOn: true }, select: { id: true, email: true, username: true }, take: limit });
    const fresh = await prisma.story.findMany({ where: { isDraft: false, publishedAt: { gte: new Date(Date.now() - 7 * 86400000) } }, orderBy: { createdAt: "desc" }, take: 20, select: { id: true, title: true, genre: true, authorName: true } });
    if (fresh.length === 0) return res.json({ sent: 0, message: "No fresh stories this week." });
    let sent = 0;
    for (const u of users) {
      const mine = await prisma.history.findMany({ where: { userId: u.id }, orderBy: { createdAt: "desc" }, take: 10, select: { story: { select: { genre: true } } } }).catch(() => []);
      const genres = [...new Set(mine.map((h) => h.story && h.story.genre).filter(Boolean))];
      const picks = (genres.length > 0 ? fresh.filter((s) => genres.includes(s.genre)) : fresh).slice(0, 5);
      const list = (picks.length > 0 ? picks : fresh.slice(0, 5)).map((s) => `<li><b>${s.title}</b> — ${s.genre} by ${s.authorName}</li>`).join("");
      const ok = await sendEmail(u.email, "Your StoryNest weekly digest", `<p>Hi ${u.username},</p><p>New in your genres this week:</p><ul>${list}</ul><p>Open StoryNest to keep reading.</p>`);
      if (ok) sent += 1;
    }
    res.json({ sent, attempted: users.length });
  } catch (e) { handleError(res, e); }
});

app.get("/status", async (req, res) => {
  try {
    const [users, stories, reports] = await Promise.all([prisma.user.count(), prisma.story.count(), prisma.report.count({ where: { status: "OPEN" } }).catch(() => 0)]);
    res.json({ ok: true, uptimeSec: Math.round(process.uptime()), version: "3.8.0", users, stories, openReports: reports, time: new Date().toISOString() });
  } catch (e) { res.status(500).json({ ok: false }); }
});

const escXml = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

app.get("/stories/:id/epub", async (req, res) => {
  try {
    const story = await prisma.story.findUnique({
      where: { id: req.params.id },
      include: { chapters: { where: { isDraft: false }, orderBy: { order: "asc" } } },
    });
    if (!story) return res.status(404).json({ error: "Not found" });
    if (story.isPremium) return res.status(403).json({ error: "Premium story." });
    const JSZip = require("jszip");
    const zip = new JSZip();
    zip.file("mimetype", "application/epub+zip");
    zip.file("META-INF/container.xml", `<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`);
    const items = [];
    const spine = [];
    story.chapters.forEach((c, i) => {
      const name = `chap${i + 1}.xhtml`;
      const paras = String(c.body || "").split(/\n\n+/).map((p) => `<p>${escXml(p).replace(/\n/g, "<br/>")}</p>`).join("\n");
      zip.file(`OEBPS/${name}`, `<?xml version="1.0" encoding="utf-8"?><!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml"><head><title>${escXml(c.title)}</title></head><body><h1>${escXml(c.title)}</h1>\n${paras}</body></html>`);
      items.push(`<item id="chap${i + 1}" href="${name}" media-type="application/xhtml+xml"/>`);
      spine.push(`<itemref idref="chap${i + 1}"/>`);
    });
    zip.file("OEBPS/content.opf", `<?xml version="1.0" encoding="utf-8"?><package version="2.0" xmlns="http://www.idpf.org/2007/opf" unique-identifier="bid"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${escXml(story.title)}</dc:title><dc:creator>${escXml(story.authorName || "StoryNest")}</dc:creator><dc:language>en</dc:language><dc:identifier id="bid">${escXml(story.id)}</dc:identifier></metadata><manifest>${items.join("")}<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/></manifest><spine toc="ncx">${spine.join("")}</spine></package>`);
    zip.file("OEBPS/toc.ncx", `<?xml version="1.0" encoding="utf-8"?><ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1"><head><meta name="dtb:uid" content="${escXml(story.id)}"/></head><docTitle><text>${escXml(story.title)}</text></docTitle><navMap>${story.chapters.map((c, i) => `<navPoint id="np${i + 1}" playOrder="${i + 1}"><navLabel><text>${escXml(c.title)}</text></navLabel><content src="chap${i + 1}.xhtml"/></navPoint>`).join("")}</navMap></ncx>`);
    const buf = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
    const fname = `${String(story.title || "story").replace(/[^a-z0-9]+/gi, "-").slice(0, 60) || "story"}.epub`;
    res.setHeader("Content-Type", "application/epub+zip");
    res.setHeader("Content-Disposition", `attachment; filename="${fname}"`);
    res.send(buf);
  } catch (e) { handleError(res, e); }
});

// Daily on-disk backup (best-effort; Render disk is ephemeral — object storage pending).
try {
  const fs = require("fs");
  const path = require("path");
  const backupDir = path.join(__dirname, "backups");
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
  const runBackup = async () => {
    try {
      const [users, stories, chapters] = await Promise.all([
        prisma.user.count(), prisma.story.count(), prisma.chapter.count(),
      ]);
      const stamp = new Date().toISOString().slice(0, 10);
      fs.writeFileSync(path.join(backupDir, `backup-${stamp}.json`), JSON.stringify({ at: new Date().toISOString(), counts: { users, stories, chapters } }));
      console.log("[backup] daily snapshot written");
    } catch (e) { console.error("[backup] failed:", e.message); }
  };
  setInterval(runBackup, 24 * 3600 * 1000).unref();
} catch (e) { console.error("[backup] scheduler disabled:", e.message); }

const PORT = config.port;
app.listen(PORT, () => console.log(`StoryNest Backend v3.8.0 (BullMQ) running on port ${PORT}`));
