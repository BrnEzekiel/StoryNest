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
const { config, resend } = require("./config");

const prisma = new PrismaClient();
const cache = new NodeCache({ stdTTL: 600 }); // 10 minutes cache

// Initialize Firebase Admin
admin.initializeApp({
  projectId: config.firebase.projectId
});

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

// --- UTILS ---

const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

const sendOTPEmail = async (email, otp, type = "registration") => {
    console.log(`[Resend] Preparing to send ${type} OTP to ${email}...`);
    const subjects = {
        registration: "Your StoryNest Verification Code",
        password: "Reset Your StoryNest Password"
    };
    const titles = {
        registration: "Welcome to the Nest",
        password: "Password Reset"
    };
    const messages = {
        registration: "Thank you for joining StoryNest. Use the code below to verify your account and start your journey.",
        password: "We received a request to reset your password. Use the code below to proceed."
    };

    try {
        const { data, error } = await resend.emails.send({
            from: "StoryNest <onboarding@resend.dev>", // Default for unverified domains
            to: [email],
            subject: subjects[type],
            html: `<div style="font-family: 'Georgia', serif; padding: 40px; background-color: #fdfaf5; color: #003631; border: 1px solid #e8e0d5; border-radius: 16px; max-width: 500px; margin: auto;">
                    <div style="text-align: center; margin-bottom: 30px;">
                        <span style="font-size: 28px; font-weight: bold; color: #003631; letter-spacing: 3px; border-bottom: 3px solid #FFEDA8; padding-bottom: 5px;">STORYNEST</span>
                    </div>
                    <h1 style="color: #003631; font-size: 24px; text-align: center;">${titles[type]}</h1>
                    <p style="font-size: 16px; line-height: 1.6; text-align: center;">${messages[type]}</p>
                    <div style="background-color: #003631; color: #FFEDA8; padding: 20px; border-radius: 12px; text-align: center; margin: 30px 0;">
                        <span style="font-size: 32px; letter-spacing: 10px; font-weight: bold;">${otp}</span>
                    </div>
                    <p style="font-size: 12px; color: #8C7B6E; text-align: center;">This code will expire in 10 minutes. If you didn't request this, you can safely ignore this email.</p>
                    <hr style="border: none; border-top: 1px solid #e8e0d5; margin: 30px 0;" />
                    <p style="font-size: 10px; text-align: center; color: #8C7B6E; letter-spacing: 1px;">STORYNEST • THE HOME FOR IMAGINATION</p>
                   </div>`
        });

        if (error) {
            console.error("[Resend] API Error:", error);
            throw error;
        }
        console.log(`[Resend] OTP sent successfully: ${data.id}`);
    } catch (e) { 
        console.error("[Resend] Critical failure:", e.message); 
        throw e;
    }
};

const generateTokens = (user) => {
  const accessToken = jwt.sign({ id: user.id, role: user.role }, config.jwtAccessSecret, { expiresIn: "15m" });
  const refreshToken = jwt.sign({ id: user.id }, config.jwtRefreshSecret, { expiresIn: "7d" });
  return { accessToken, refreshToken };
};

const sendSlackNotification = async (message) => {
    if (!config.slack.webhookUrl) return;
    try {
        await axios.post(config.slack.webhookUrl, { text: message });
    } catch (e) { console.error("Slack error:", e.message); }
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
  } catch (err) {
    res.status(401).json({ error: "Token expired or invalid" });
  }
};

const isAdmin = (req, res, next) => {
  if (req.user.role !== "ADMIN") return res.status(403).json({ error: "Admin access required" });
  next();
};

// --- ROUTES ---

// Health Check
app.get("/health", async (req, res) => {
    res.json({ 
        status: "ok", 
        version: "2.5.0",
        engine: "resend_api"
    });
});

// --- v2.0 AUTH FLOW ---

// 1. Initiate Registration (Age & Email Check)
app.post("/auth/otp/initiate", async (req, res) => {
    const { email, dob } = req.body;
    console.log(`[Auth] Initiating OTP for ${email}, DOB: ${dob}`);
    try {
        // Age Check
        const birthDate = new Date(dob);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }

        if (age < 13) {
            console.log(`[Auth] Blocked Underage User: ${age} years old`);
            return res.status(403).json({ 
                error: "Underage", 
                message: "Thank you for your interest in StoryNest. However, you must be 13 years or older to join our community." 
            });
        }

        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing && existing.firebaseUid) {
            return res.status(400).json({ error: "Email already exists" });
        }

        const otp = generateOTP();
        const expiry = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

        if (existing) {
            await prisma.user.update({ where: { email }, data: { otpCode: otp, otpExpiry: expiry, dateOfBirth: birthDate } });
        } else {
            // Temporary user record for OTP (no password yet)
            await prisma.user.create({ 
                data: { 
                    email, 
                    username: `nestling_${uuidv4().substring(0, 4)}`,
                    password: "otp_pending",
                    otpCode: otp, 
                    otpExpiry: expiry,
                    dateOfBirth: birthDate
                } 
            });
        }

        // Send OTP Email via Resend
        sendOTPEmail(email, otp, "registration").catch(e => {
            console.error("[Resend] Background failure:", e.message);
        });
        
        res.json({ message: "OTP sent" });

    } catch (error) { 
        console.error("[Auth] OTP Initiate Error:", error.message);
        res.status(500).json({ error: error.message }); 
    }
});

// 2. Verify OTP
app.post("/auth/otp/verify", async (req, res) => {
    const { email, otp } = req.body;
    try {
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || user.otpCode !== otp) return res.status(400).json({ error: "Invalid code" });
        
        if (new Date() > user.otpExpiry) return res.status(400).json({ error: "Code expired" });

        await prisma.user.update({ 
            where: { email }, 
            data: { emailVerified: true, otpCode: null, otpExpiry: null } 
        });

        res.json({ message: "Email verified" });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

// 3. Finalize Registration
app.post("/auth/register", async (req, res) => {
  const { email, password, username, firebaseUid, tosAccepted, privacyAccepted } = req.body;
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.emailVerified) return res.status(400).json({ error: "Email not verified" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const updatedUser = await prisma.user.update({
      where: { email },
      data: { 
        username, 
        password: hashedPassword, 
        firebaseUid,
        tosAccepted,
        privacyAccepted,
        role: "READER"
      }
    });

    sendSlackNotification(`🎉 New Nestling! ${username} (${email}) has joined the nest.`);
    const tokens = generateTokens(updatedUser);

    // Welcome Email via Resend
    resend.emails.send({
        from: "StoryNest <onboarding@resend.dev>",
        to: [email],
        subject: "Welcome to the Nest!",
        html: `<div style="font-family: serif; padding: 40px; background-color: #003631; color: #FFEDA8;">
                <div style="text-align: center; margin-bottom: 30px;">
                    <span style="font-size: 28px; font-weight: bold; color: #FFEDA8; letter-spacing: 3px; border-bottom: 3px solid #E91E63; padding-bottom: 5px;">STORYNEST</span>
                </div>
                <h1>The Nest Welcomes You</h1>
                <p>Hello <b>${username}</b>,</p>
                <p>Your journey into imagination has officially begun. Explore new worlds, connect with stories, and find your sanctuary.</p>
                <p>We're glad to have you here.</p>
               </div>`
    }).catch(e => console.error("[Resend] Welcome Email Error:", e.message));

    res.status(201).json({ user: updatedUser, ...tokens });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// 4. Forgot Password OTP
app.post("/auth/password/forgot", async (req, res) => {
    const { email } = req.body;
    try {
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return res.status(404).json({ error: "User not found" });

        const otp = generateOTP();
        const expiry = new Date(Date.now() + 10 * 60 * 1000);

        await prisma.user.update({ where: { email }, data: { otpCode: otp, otpExpiry: expiry } });
        
        sendOTPEmail(email, otp, "password").catch(e => console.error("[Resend] Forgot pass error:", e.message));
        res.json({ message: "Reset code sent" });

    } catch (error) { res.status(500).json({ error: error.message }); }
});

// 5. Reset Password
app.post("/auth/password/reset", async (req, res) => {
    const { email, otp, newPassword } = req.body;
    try {
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || user.otpCode !== otp) return res.status(400).json({ error: "Invalid code" });
        if (new Date() > user.otpExpiry) return res.status(400).json({ error: "Code expired" });

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await prisma.user.update({
            where: { email },
            data: { 
                password: hashedPassword,
                otpCode: null, 
                otpExpiry: null 
            }
        });

        // Also update Firebase Password if UID exists
        if (user.firebaseUid) {
            await admin.auth().updateUser(user.firebaseUid, {
                password: newPassword
            });
        }

        res.json({ message: "Password updated" });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post("/auth/login", async (req, res) => {
  const { idToken } = req.body;
  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const { email, uid: firebaseUid } = decodedToken;

    let user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return res.status(404).json({ error: "User not found in backend" });
    }

    if (!user.firebaseUid) {
        user = await prisma.user.update({
            where: { id: user.id },
            data: { firebaseUid }
        });
    }

    const tokens = generateTokens(user);
    res.json({ user, ...tokens });
  } catch (error) {
    console.error("Firebase verification error:", error);
    res.status(401).json({ error: "Firebase verification failed" });
  }
});

app.post("/auth/refresh", async (req, res) => {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ error: "Refresh token required" });
    try {
        const decoded = jwt.verify(refreshToken, config.jwtRefreshSecret);
        const user = await prisma.user.findUnique({ where: { id: decoded.id } });
        if (!user) return res.status(401).json({ error: "User not found" });
        const tokens = generateTokens(user);
        res.json(tokens);
    } catch (e) { res.status(401).json({ error: "Invalid refresh token" }); }
});

// --- STORIES ---

app.get("/stories", async (req, res) => {
  const { genre, q, limit } = req.query;
  const cacheKey = `stories_${genre || "all"}_${q || ""}_${limit || 50}`;
  
  const cachedData = cache.get(cacheKey);
  if (cachedData) return res.json(cachedData);

  try {
    const where = {};
    if (genre && genre !== "All") where.genre = genre;
    if (q) where.OR = [{ title: { contains: q, mode: "insensitive" } }, { authorName: { contains: q, mode: "insensitive" } }];

    const stories = await prisma.story.findMany({
      where,
      take: limit ? parseInt(limit) : 50,
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { likes: true } } }
    });
    
    cache.set(cacheKey, stories);
    res.json(stories);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get("/stories/:id", async (req, res) => {
  try {
    const story = await prisma.story.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { likes: true, comments: true } } }
    });
    if (!story) return res.status(404).json({ error: "Story not found" });
    res.json(story);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post("/stories", authenticate, isAdmin, upload.single("cover"), async (req, res) => {
  const { title, genre, body, authorName, readingTime } = req.body;
  const coverUrl = req.file ? req.file.path : null;
  try {
    const story = await prisma.story.create({ data: { title, genre, body, authorName, readingTime: parseInt(readingTime), coverUrl } });
    cache.flushAll();
    
    // Notify users via Resend
    const subbedUsers = await prisma.user.findMany({ where: { notificationsOn: true }, select: { email: true } });
    if (subbedUsers.length > 0) {
        const emails = subbedUsers.map(u => u.email);
        resend.emails.send({
            from: "StoryNest <onboarding@resend.dev>",
            to: emails,
            subject: `New Story Added: ${title}`,
            text: `A new world awaits! Read "${title}" by ${authorName} in the StoryNest app now.`,
            html: `<div style="font-family: serif; padding: 40px; background-color: #003631; color: #FFEDA8;">
                    <div style="text-align: center; margin-bottom: 30px;">
                        <span style="font-size: 28px; font-weight: bold; color: #FFEDA8; letter-spacing: 3px; border-bottom: 3px solid #E91E63; padding-bottom: 5px;">STORYNEST</span>
                    </div>
                    <h1>A New Discovery</h1>
                    <p>"${title}" by <b>${authorName}</b> has been added to the nest.</p>
                    <p>Open the app to start reading now.</p>
                   </div>`
        }).catch(e => console.error("[Resend] Story Notification Error:", e.message));
    }

    sendSlackNotification(`New Story! "${title}" by ${authorName} is now in the nest.`);
    res.status(201).json(story);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.put("/stories/:id", authenticate, isAdmin, upload.single("cover"), async (req, res) => {
    const { title, genre, body, authorName, readingTime } = req.body;
    let updateData = { title, genre, body, authorName, readingTime: parseInt(readingTime) };
    if (req.file) updateData.coverUrl = req.file.path;
    try {
        const story = await prisma.story.update({ where: { id: req.params.id }, data: updateData });
        cache.flushAll();

        // Notify users via Resend
        const subbedUsers = await prisma.user.findMany({ where: { notificationsOn: true }, select: { email: true } });
        if (subbedUsers.length > 0) {
            const emails = subbedUsers.map(u => u.email);
            resend.emails.send({
                from: "StoryNest <onboarding@resend.dev>",
                to: emails,
                subject: `Story Updated: ${title}`,
                html: `<div style="font-family: serif; padding: 40px; background-color: #003631; color: #FFEDA8;">
                        <div style="text-align: center; margin-bottom: 30px;">
                            <span style="font-size: 28px; font-weight: bold; color: #FFEDA8; letter-spacing: 3px; border-bottom: 3px solid #E91E63; padding-bottom: 5px;">STORYNEST</span>
                        </div>
                        <h1>A World Evolves</h1>
                        <p>"${title}" has been updated with new content.</p>
                        <p>Open the app to continue your journey.</p>
                       </div>`
            }).catch(e => console.error("[Resend] Update Notification Error:", e.message));
        }

        res.json(story);
    } catch (error) { res.status(500).json({ error: error.message }); }
});

app.delete("/stories/:id", authenticate, isAdmin, async (req, res) => {
    try {
        await prisma.story.delete({ where: { id: req.params.id } });
        cache.flushAll();
        res.json({ message: "Deleted successfully" });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

// --- USER ACTIONS ---

app.post("/stories/:id/read", authenticate, async (req, res) => {
    try {
        await prisma.history.create({ data: { userId: req.user.id, storyId: req.params.id } });
        // Update user XP
        await prisma.user.update({ where: { id: req.user.id }, data: { xp: { increment: 10 } } });
        res.json({ status: "success" });
    } catch (e) { res.json({ status: "already_logged" }); }
});

app.get("/users/me", authenticate, async (req, res) => {
    try {
        const user = await prisma.user.findUnique({ where: { id: req.user.id } });
        res.json(user);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/users/me/settings", authenticate, async (req, res) => {
    const { notificationsOn } = req.body;
    try {
        const user = await prisma.user.update({
            where: { id: req.user.id },
            data: { notificationsOn }
        });
        res.json(user);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/users/me/avatar", authenticate, upload.single("avatar"), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No image provided" });
    try {
        const user = await prisma.user.update({ where: { id: req.user.id }, data: { avatarUrl: req.file.path } });
        res.json(user);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/users/me/bookmarks", authenticate, async (req, res) => {
    try {
        const bookmarks = await prisma.bookmark.findMany({ where: { userId: req.user.id }, include: { story: true } });
        res.json(bookmarks);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/stories/:id/bookmark", authenticate, async (req, res) => {
    const { progress } = req.body; // percentage 0-100 or -1 to delete
    try {
        if (progress === -1) {
            await prisma.bookmark.delete({ where: { userId_storyId: { userId: req.user.id, storyId: req.params.id } } });
            return res.json({ message: "Removed" });
        }
        const bookmark = await prisma.bookmark.upsert({
            where: { userId_storyId: { userId: req.user.id, storyId: req.params.id } },
            update: { progress: parseInt(progress) },
            create: { userId: req.user.id, storyId: req.params.id, progress: parseInt(progress) }
        });
        res.json(bookmark);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/stories/:id/like", authenticate, async (req, res) => {
    try {
        const existing = await prisma.like.findUnique({ where: { userId_storyId: { userId: req.user.id, storyId: req.params.id } } });
        if (existing) {
            await prisma.like.delete({ where: { id: existing.id } });
            const count = await prisma.like.count({ where: { storyId: req.params.id } });
            return res.json({ isLiked: false, likes: count });
        }
        await prisma.like.create({ data: { userId: req.user.id, storyId: req.params.id } });
        const count = await prisma.like.count({ where: { storyId: req.params.id } });
        res.json({ isLiked: true, likes: count });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- ADMIN STATS ---
app.get("/admin/stats", authenticate, isAdmin, async (req, res) => {
  try {
    const SUPER_ADMIN_EMAIL = "test@example.com";
    const [storyCount, totalReads, userCount] = await Promise.all([
      prisma.story.count(),
      prisma.history.count(),
      prisma.user.count({ where: { NOT: { email: SUPER_ADMIN_EMAIL } } })
    ]);
    res.json({ storyCount, totalReads, userCount });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

const PORT = config.port;
app.listen(PORT, () => console.log(`🚀 StoryNest Backend v2.5 running on port ${PORT}`));
