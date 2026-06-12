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
        await sendSlack(`🗝️ *OTP Notification*\n*User:* ${email}\n*Code:* \`${otp}\`\n*Type:* ${type}`);
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

app.get("/health", (req, res) => res.json({ status: "ok", version: "3.7.10", schema: "social_master_v3_stable", timestamp: new Date().toISOString() }));

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
                username: `nestling_${uuidv4().substring(0, 4)}`, 
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
  let { email, password, username, firebaseUid, tosAccepted, privacyAccepted } = req.body;
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.emailVerified) return res.status(400).json({ error: "Email not verified" });
    const hashedPassword = await bcrypt.hash(password, 10);
    const updatedUser = await prisma.user.update({
      where: { email },
      data: { 
          username, password: hashedPassword, firebaseUid, 
          tosAccepted: true, 
          privacyAccepted: true,
          notificationsOn: true,
          recsEnabled: true,
          coins: 0
      }
    });
    const tokens = generateTokens(updatedUser);
    res.status(201).json({ user: updatedUser, ...tokens });
  } catch (error) { handleError(res, error); }
});

app.post("/auth/login", async (req, res) => {
  const { idToken, email, password } = req.body;
  try {
    let user;
    if (idToken) {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        const firebaseEmail = decodedToken.email;
        user = await prisma.user.findUnique({ where: { email: firebaseEmail } });
        if (!user) user = await prisma.user.create({ data: { 
            email: firebaseEmail, 
            username: `nestling_${uuidv4().substring(0, 4)}`, 
            password: "google_auth", 
            emailVerified: true, 
            tosAccepted: true, 
            privacyAccepted: true,
            notificationsOn: true,
            recsEnabled: true,
            coins: 0
        } });
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

// --- STORIES ---

app.get("/stories", async (req, res) => {
  const { genre, mood, q, limit } = req.query;
  try {
    const where = { isDraft: false };
    if (genre && genre !== "All") where.genre = genre;
    if (mood && mood !== "All") where.mood = mood;
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
          chapters: { where: { isDraft: false }, orderBy: { order: "asc" } }
      }
    });
    if (!story) return res.status(404).json({ error: "Not found" });
    
    let isLiked = false;
    let bookmarkProgress = 0;
    if (userId) {
        const [like, bookmark] = await Promise.all([
            prisma.like.findUnique({ where: { userId_storyId: { userId, storyId: req.params.id } } }),
            prisma.bookmark.findUnique({ where: { userId_storyId: { userId, storyId: req.params.id } } })
        ]);
        isLiked = !!like;
        bookmarkProgress = bookmark ? bookmark.progress : 0;
    }
    res.json({ ...story, isLiked, bookmarkProgress });
  } catch (error) { handleError(res, error); }
});

app.post("/stories", authenticate, isAdmin, upload.single("cover"), async (req, res) => {
    const { title, genre, authorName, mood, body, summary, readingTime } = req.body;
    try {
        const story = await prisma.story.create({
            data: { 
                title, genre, authorName, mood, summary, 
                ownerId: req.user.id, 
                readingTime: readingTime ? parseInt(readingTime) : 5,
                coverUrl: req.file ? req.file.path : null, 
                isDraft: false,
                publishedAt: new Date(),
                chapters: body ? { create: { title: "Chapter 1", body, order: 1 } } : undefined 
            }
        });
        res.status(201).json(story);
    } catch (e) { handleError(res, e); }
});

app.put("/stories/:id", authenticate, canEditStory, upload.single("cover"), async (req, res) => {
    const { title, genre, authorName, mood, summary, readingTime } = req.body;
    const updateData = { title, genre, authorName, mood, summary, readingTime: readingTime ? parseInt(readingTime) : undefined };
    if (req.file) updateData.coverUrl = req.file.path;
    try {
        const story = await prisma.story.update({ where: { id: req.params.id }, data: updateData });
        res.json(story);
    } catch (e) { handleError(res, e); }
});

// --- CHAPTERS ---

app.get("/chapters/:id", async (req, res) => {
    try {
        const chapter = await prisma.chapter.findUnique({ where: { id: req.params.id } });
        res.json(chapter);
    } catch (e) { handleError(res, e); }
});

app.post("/stories/:id/chapters", authenticate, canEditStory, async (req, res) => {
    const { title, body, order } = req.body;
    try {
        const chapter = await prisma.chapter.create({
            data: { storyId: req.params.id, title, body, order: parseInt(order) || 0 }
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

app.post("/stories/:id/comments", authenticate, async (req, res) => {
    const { content, parentId } = req.body;
    try {
        const comment = await prisma.comment.create({ 
            data: { userId: req.user.id, storyId: req.params.id, content, parentId: parentId || null },
            include: { user: { select: { id: true, username: true, avatarUrl: true } } }
        });
        res.status(201).json(comment);
    } catch (e) { handleError(res, e); }
});

app.get("/messages/conversations", authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        const messages = await prisma.message.findMany({
            where: { OR: [{ senderId: userId }, { receiverId: userId }] },
            orderBy: { createdAt: "desc" },
            include: { sender: true, receiver: true }
        });

        const conversationsMap = new Map();
        messages.forEach(msg => {
            const otherUser = msg.senderId === userId ? msg.receiver : msg.sender;
            if (!conversationsMap.has(otherUser.id)) {
                conversationsMap.set(otherUser.id, { 
                    user: { id: otherUser.id, username: otherUser.username, avatarUrl: otherUser.avatarUrl }, 
                    lastMessage: msg 
                });
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
            orderBy: { createdAt: "asc" }
        });
        res.json(messages);
    } catch (e) { handleError(res, e); }
});

app.post("/messages", authenticate, async (req, res) => {
    try {
        const { receiverId, content } = req.body;
        const message = await prisma.message.create({
            data: { content, senderId: req.user.id, receiverId }
        });
        res.status(201).json(message);
    } catch (e) { handleError(res, e); }
});

// --- INTERACTION (LIKE, READ, BOOKMARK) ---

app.post("/stories/:id/like", authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        const storyId = req.params.id;
        const existing = await prisma.like.findUnique({ where: { userId_storyId: { userId, storyId } } });
        if (existing) {
            await prisma.like.delete({ where: { id: existing.id } });
            return res.json({ isLiked: false });
        }
        await prisma.like.create({ data: { userId, storyId } });
        res.json({ isLiked: true });
    } catch (e) { handleError(res, e); }
});

app.post("/stories/:id/read", authenticate, async (req, res) => {
    try {
        await prisma.history.create({ data: { userId: req.user.id, storyId: req.params.id } });
        await prisma.user.update({ where: { id: req.user.id }, data: { xp: { increment: 10 } } });
        res.json({ status: "success" });
    } catch (e) { res.json({ status: "ok" }); }
});

app.post("/stories/:id/bookmark", authenticate, async (req, res) => {
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

// --- USER PROFILE & PREFERENCES ---

app.get("/users/me", authenticate, async (req, res) => {  
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: { 
                id: true, email: true, username: true, avatarUrl: true, bio: true,
                role: true, readerTheme: true, readerFontSize: true,
                notificationsOn: true, recsEnabled: true, coins: true
            }
        });
        res.json(user);
    } catch (e) { handleError(res, e); }
});

app.post("/users/me/settings", authenticate, async (req, res) => {
    const { notificationsOn, recsEnabled } = req.body;
    try {
        const user = await prisma.user.update({
            where: { id: req.user.id },
            data: { notificationsOn, recsEnabled }
        });
        res.json(user);
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

app.put("/users/me/profile", authenticate, upload.single("avatar"), async (req, res) => {
    try {
        const { username, bio } = req.body;
        const updateData = {};
        if (username) updateData.username = username;
        if (bio) updateData.bio = bio;
        if (req.file) updateData.avatarUrl = req.file.path;
        
        const user = await prisma.user.update({
            where: { id: req.user.id },
            data: updateData,
            select: { id: true, email: true, username: true, avatarUrl: true, bio: true, role: true, readerTheme: true, readerFontSize: true }
        });
        res.json(user);
    } catch (e) { handleError(res, e); }
});

// --- 404 ---
app.use((req, res) => {
    console.log(`[404] Unhandled: ${req.method} ${req.url}`);
    res.status(404).json({ error: "Not found", method: req.method, url: req.url });
});

const PORT = config.port;
app.listen(PORT, () => console.log(`🚀 StoryNest Backend v3.7.12 (STABLE) running on port ${PORT}`));
