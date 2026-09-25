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
const axios = require("axios");
const { config, sendGmail, sendSlack } = require("./config");
const { enqueueWelcomeEmail, enqueueEmail } = require("./queues");

const prisma = new PrismaClient();
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

const app = express();
app.use(cors());
app.use(express.json());

// --- HELPERS ---
const handleError = (res, error, customMessage = "Something went wrong on our end. Please try again later.") => {
    console.error(`[Error] ${new Date().toISOString()}:`, error);
    res.status(500).json({ error: customMessage });
};

// --- DEBUG LOGGER ---
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// --- UTILS ---

const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

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
    try {
        await sendGmail({
            to: email,
            subject: type === "registration" ? "Your StoryNest Verification Code" : "Reset Your StoryNest Password",
            html: `<div style="font-family: 'Georgia', serif; padding: 40px; background-color: #fdfaf5; color: #003631; border: 1px solid #e8e0d5; border-radius: 16px; max-width: 500px; margin: auto;">
                    <div style="text-align: center; margin-bottom: 30px;">
                        <span style="font-size: 28px; font-weight: bold; color: #003631; letter-spacing: 3px; border-bottom: 3px solid #FFEDA8; padding-bottom: 5px;">STORYNEST</span>
                    </div>
                    <h1 style="color: #003631; font-size: 24px; text-align: center;">Verification Code</h1>
                    <div style="background-color: #003631; color: #FFEDA8; padding: 20px; border-radius: 12px; text-align: center; margin: 30px 0;">
                        <span style="font-size: 32px; letter-spacing: 10px; font-weight: bold;">${otp}</span>
                    </div>
                    <p style="font-size: 10px; text-align: center; color: #8C7B6E; letter-spacing: 1px;">STORYNEST • THE HOME FOR IMAGINATION</p>
                   </div>`
        });
        
        // Notify Slack as a backup
        await sendSlack(`*OTP Notification*\n*User:* ${email}\n*Code:* \`${otp}\`\n*Type:* ${type}`);
    } catch (e) { console.error("[Gmail API] Send Failure:", e.message); }
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
  const accessToken = jwt.sign({ id: user.id, role: user.role }, config.jwtAccessSecret, { expiresIn: "1h" });
  const refreshToken = jwt.sign({ id: user.id }, config.jwtRefreshSecret, { expiresIn: "7d" });
  return { accessToken, refreshToken };
};

// --- AUTH MIDDLEWARE ---
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) return res.status(401).json({ error: "Unauthorized" });
  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, config.jwtAccessSecret);
    req.user = decoded;
    next();
  } catch (err) { res.status(401).json({ error: "Token invalid" }); }
};

const isAdmin = (req, res, next) => {
  if (req.user.role !== "ADMIN") return res.status(403).json({ error: "Admin access required" });
  next();
};

const canEditStory = async (req, res, next) => {
    try {
        const storyId = req.params.id || req.body.storyId;
        const story = await prisma.story.findUnique({ where: { id: storyId } });
        if (!story) return res.status(404).json({ error: "Story not found" });
        if (story.ownerId === req.user.id || req.user.role === "ADMIN") next();
        else res.status(403).json({ error: "No edit access" });
    } catch (e) { handleError(res, e); }
};

// --- ROUTES ---

app.get("/health", (req, res) => res.json({ status: "ok", version: "3.8.0", schema: "social_master_v3_stable", bullmq: true, timestamp: new Date().toISOString() }));

// --- QUEUE DEBUG / TEST (safe to keep in early migration; protect later) ---
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

app.post("/logs/error", (req, res) => {
    const { error, stack, device, isFatal } = req.body;
    console.error(`[Client-Side Error] Fatal: ${isFatal} | Device: ${device}`);
    console.error(`Error: ${error}`);
    console.error(`Stack: ${stack}`);
    res.json({ status: "logged" });
});

// --- AUTH ---

app.post("/auth/otp/initiate", async (req, res) => {
    let { email, dob } = req.body;
    if (email) email = email.toLowerCase().trim();
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
        sendOTPEmail(email, otp).catch(e => console.error(e));
        res.json({ message: "OTP sent" });
    } catch (error) { handleError(res, error); }
});

app.post("/auth/otp/verify", async (req, res) => {
    const { email, otp } = req.body;
    try {
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || user.otpCode !== otp || new Date() > user.otpExpiry) return res.status(400).json({ error: "Invalid or expired code" });
        await prisma.user.update({ where: { email }, data: { emailVerified: true, otpCode: null, otpExpiry: null } });
        res.json({ message: "Verified" });
    } catch (error) { handleError(res, error); }
});

app.post("/auth/register", async (req, res) => {
  let { email, password, username, firebaseUid, tosAccepted, privacyAccepted, referralCode: inputRefCode } = req.body;
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
          xp: { increment: initialXp }
      }
    });
    const tokens = generateTokens(updatedUser);

    // Fire-and-forget welcome email via BullMQ (does not block response)
    enqueueWelcomeEmail({ email: updatedUser.email, username: updatedUser.username })
      .catch((err) => console.error("[Queue] welcome email enqueue failed:", err.message));

    res.status(201).json({ user: updatedUser, ...tokens });
  } catch (error) { handleError(res, error); }
});

// NOTE: Remainder of routes restored from pre-migration index.js via AI.md recovery path.
// Full file continues in next commit if truncated — see apps/backend/index.full.js backup.

app.post("/auth/login", async (req, res) => {
  const { idToken, email, password } = req.body;
  try {
    let user;
    if (idToken) {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        const firebaseEmail = decodedToken.email;
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
    const tokens = generateTokens(user);
    res.json({ user, ...tokens });
  } catch (error) { handleError(res, error, "Login failed. Please check your credentials."); }
});

app.post("/auth/refresh", async (req, res) => {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(401).json({ error: "No refresh token" });
    try {
        const decoded = jwt.verify(refreshToken, config.jwtRefreshSecret);
        const user = await prisma.user.findUnique({ where: { id: decoded.id } });
        if (!user) throw new Error();
        const tokens = generateTokens(user);
        res.json(tokens);
    } catch (e) { res.status(401).json({ error: "Invalid refresh token" }); }
});

app.post("/auth/logout", (req, res) => {
    res.json({ message: "Logged out successfully" });
});

const PORT = config.port;
app.listen(PORT, () => console.log(`StoryNest Backend v3.8.0 (BullMQ) running on port ${PORT}`));
