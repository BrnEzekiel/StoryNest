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
const { config, sendGmail } = require("./config");

const prisma = new PrismaClient();
const cache = new NodeCache({ stdTTL: 600 });

admin.initializeApp({ projectId: config.firebase.projectId });
cloudinary.config({ cloud_name: config.cloudinary.name, api_key: config.cloudinary.key, api_secret: config.cloudinary.secret });

const storage = new CloudinaryStorage({ cloudinary, params: { folder: "storynest", allowed_formats: ["jpg", "png", "jpeg"] } });
const upload = multer({ storage });

const app = express();
app.use(cors());
app.use(express.json());

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
                    <h1 style="color: #003631; font-size: 24px; text-align: center;">Verification</h1>
                    <div style="background-color: #003631; color: #FFEDA8; padding: 20px; border-radius: 12px; text-align: center; margin: 30px 0;">
                        <span style="font-size: 32px; letter-spacing: 10px; font-weight: bold;">${otp}</span>
                    </div>
                    <p style="font-size: 10px; text-align: center; color: #8C7B6E; letter-spacing: 1px;">STORYNEST • THE HOME FOR IMAGINATION</p>
                   </div>`
        });
    } catch (e) { console.error("[Gmail API] failure:", e.message); }
};

const handleMentions = async (content, storyId, senderId) => {
    const mentions = content?.match(/@(\w+)/g);
    if (!mentions) return;
    for (const m of mentions) {
        const username = m.substring(1);
        const target = await prisma.user.findUnique({ where: { username } });
        if (target && target.id !== senderId) {
            await prisma.activity.create({
                data: { userId: senderId, targetUserId: target.id, type: "MENTION", storyId, content }
            });
        }
    }
};

const generateTokens = (user) => {
  const accessToken = jwt.sign({ id: user.id, role: user.role }, config.jwtAccessSecret, { expiresIn: "15m" });
  const refreshToken = jwt.sign({ id: user.id }, config.jwtRefreshSecret, { expiresIn: "7d" });
  return { accessToken, refreshToken };
};

// --- AUTH MIDDLEWARE ---
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) return res.status(401).json({ error: "Unauthorized" });
  const token = authHeader.split(" ")[1];
  try {
    req.user = jwt.verify(token, config.jwtAccessSecret);
    next();
  } catch (err) { res.status(401).json({ error: "Token expired or invalid" }); }
};

const isAdmin = (req, res, next) => {
  if (req.user.role !== "ADMIN") return res.status(403).json({ error: "Admin access required" });
  next();
};

const canEditStory = async (req, res, next) => {
    try {
        const storyId = req.params.id || req.body.storyId;
        const story = await prisma.story.findUnique({ where: { id: storyId }, include: { coAuthors: true } });
        if (!story) return res.status(404).json({ error: "Story not found" });
        if (story.ownerId === req.user.id || story.coAuthors.some(ca => ca.id === req.user.id) || req.user.role === "ADMIN") next();
        else res.status(403).json({ error: "Forbidden: No edit access" });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

// --- ROUTES ---

app.get("/health", (req, res) => res.json({ status: "ok", version: "3.5.4" }));

// --- AUTH FLOW ---

app.post("/auth/otp/initiate", async (req, res) => {
    let { email, dob } = req.body;
    if (email) email = email.toLowerCase().trim();
    try {
        const otp = generateOTP();
        const expiry = new Date(Date.now() + 10 * 60 * 1000);
        await prisma.user.upsert({
            where: { email },
            update: { otpCode: otp, otpExpiry: expiry },
            create: { email, username: `nestling_${uuidv4().substring(0, 4)}`, password: "otp_pending", otpCode: otp, otpExpiry: expiry, dateOfBirth: dob ? new Date(dob) : null }
        });
        sendOTPEmail(email, otp).catch(e => console.error(e));
        res.json({ message: "OTP sent" });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post("/auth/otp/verify", async (req, res) => {
    const { email, otp } = req.body;
    try {
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || user.otpCode !== otp || new Date() > user.otpExpiry) return res.status(400).json({ error: "Invalid or expired code" });
        await prisma.user.update({ where: { email }, data: { emailVerified: true, otpCode: null, otpExpiry: null } });
        res.json({ message: "Verified" });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post("/auth/register", async (req, res) => {
  let { email, password, username, firebaseUid, tosAccepted, privacyAccepted } = req.body;
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.emailVerified) return res.status(400).json({ error: "Email not verified" });
    const hashedPassword = await bcrypt.hash(password, 10);
    const updatedUser = await prisma.user.update({
      where: { email },
      data: { username, password: hashedPassword, firebaseUid, tosAccepted, privacyAccepted }
    });
    const tokens = generateTokens(updatedUser);
    res.status(201).json({ user: updatedUser, ...tokens });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post("/auth/login", async (req, res) => {
  const { idToken, email, password } = req.body;
  try {
    let user;
    if (idToken) {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        const firebaseEmail = decodedToken.email;
        user = await prisma.user.findUnique({ where: { email: firebaseEmail } });
        if (!user) user = await prisma.user.create({ data: { email: firebaseEmail, username: `nestling_${uuidv4().substring(0, 4)}`, password: "google_auth", emailVerified: true, tosAccepted: true, privacyAccepted: true } });
    } else {
        user = await prisma.user.findUnique({ where: { email } });
        if (!user || !(await bcrypt.compare(password, user.password))) return res.status(401).json({ error: "Invalid credentials" });
    }
    const tokens = generateTokens(user);
    res.json({ user, ...tokens });
  } catch (error) { res.status(401).json({ error: "Login failed" }); }
});

// --- STORIES ---

app.get("/stories/trending", async (req, res) => {
    try {
        const stories = await prisma.story.findMany({
            where: { isDraft: false },
            include: { _count: { select: { likes: true, history: true } } },
            take: 10
        });
        const trending = stories.sort((a, b) => ((b._count.likes * 2) + b._count.history) - ((a._count.likes * 2) + a._count.history));
        res.json(trending);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/stories", async (req, res) => {
  const { genre, mood, q, limit } = req.query;
  const now = new Date();
  try {
    const where = { isDraft: false, OR: [{ publishedAt: null }, { publishedAt: { lte: now } }] };
    if (genre && genre !== "All") where.genre = genre;
    if (mood && mood !== "All") where.mood = mood;
    if (q) where.OR = [{ title: { contains: q, mode: "insensitive" } }, { authorName: { contains: q, mode: "insensitive" } }];
    const stories = await prisma.story.findMany({ where, take: limit ? parseInt(limit) : 50, orderBy: { createdAt: "desc" }, include: { _count: { select: { likes: true, reviews: true } } } });
    res.json(stories);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get("/stories/:id", async (req, res) => {
  const now = new Date();
  try {
    const story = await prisma.story.findUnique({
      where: { id: req.params.id },
      include: { 
          _count: { select: { likes: true, comments: true, reviews: true } },
          characters: true, worldEntries: true,
          chapters: { where: { isDraft: false, OR: [{ publishedAt: null }, { publishedAt: { lte: now } }] }, orderBy: { order: "asc" }, select: { id: true, title: true, order: true } },
          polls: { where: { isActive: true }, include: { options: { include: { _count: { select: { votes: true } } } } } }
      }
    });
    if (!story) return res.status(404).json({ error: "Not found" });
    res.json({ ...story, isUnlocked: true });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post("/stories", authenticate, isAdmin, upload.single("cover"), async (req, res) => {
    const { title, genre, authorName, mood, body } = req.body;
    try {
        const story = await prisma.story.create({
            data: { 
                title, genre, authorName, mood, ownerId: req.user.id,
                coverUrl: req.file ? req.file.path : null,
                chapters: body ? { create: { title: "Chapter 1", body, order: 1 } } : undefined
            }
        });
        res.status(201).json(story);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put("/stories/:id", authenticate, canEditStory, upload.single("cover"), async (req, res) => {
    const updateData = { ...req.body };
    if (req.file) updateData.coverUrl = req.file.path;
    try {
        const story = await prisma.story.update({ where: { id: req.params.id }, data: updateData });
        res.json(story);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete("/stories/:id", authenticate, isAdmin, async (req, res) => {
    try {
        await prisma.story.delete({ where: { id: req.params.id } });
        res.json({ message: "Deleted" });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- CHAPTERS ---

app.get("/chapters/:id", async (req, res) => {
    try {
        const chapter = await prisma.chapter.findUnique({ where: { id: req.params.id } });
        res.json(chapter);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/stories/:id/chapters", authenticate, canEditStory, async (req, res) => {
    const { title, body, order, publishedAt } = req.body;
    try {
        const chapter = await prisma.chapter.create({
            data: { storyId: req.params.id, title, body, order: parseInt(order) || 0, publishedAt: publishedAt ? new Date(publishedAt) : null }
        });
        res.status(201).json(chapter);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put("/chapters/:id", authenticate, async (req, res) => {
    try {
        const updated = await prisma.chapter.update({ where: { id: req.params.id }, data: req.body });
        res.json(updated);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete("/chapters/:id", authenticate, async (req, res) => {
    try {
        await prisma.chapter.delete({ where: { id: req.params.id } });
        res.json({ message: "Deleted" });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- MESSAGING & SOCIAL ---

app.get("/messages/conversations", authenticate, async (req, res) => {
    try {
        const messages = await prisma.message.findMany({
            where: { OR: [{ senderId: req.user.id }, { receiverId: req.user.id }] },
            orderBy: { createdAt: "desc" },
            include: { sender: { select: { id: true, username: true, avatarUrl: true } }, receiver: { select: { id: true, username: true, avatarUrl: true } } }
        });
        const convs = []; const seen = new Set();
        for (const m of messages) {
            const other = m.senderId === req.user.id ? m.receiver : m.sender;
            if (other && !seen.has(other.id)) { convs.push({ user: other, lastMessage: m }); seen.add(other.id); }
        }
        res.json(convs);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/messages", authenticate, async (req, res) => {
    const { receiverId, content } = req.body;
    try {
        const msg = await prisma.message.create({ data: { senderId: req.user.id, receiverId, content } });
        await handleMentions(content, null, req.user.id);
        res.status(201).json(msg);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/users/:id/follow", authenticate, async (req, res) => {
    try {
        await prisma.follows.create({ data: { followerId: req.user.id, followingId: req.params.id } });
        res.json({ message: "Followed" });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/users/:id/profile", async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.params.id },
            select: { id: true, username: true, avatarUrl: true, bio: true, xp: true, _count: { select: { followers: true, following: true } } }
        });
        res.json(user);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- POLLS & REVIEWS ---

app.post("/polls/:id/vote", authenticate, async (req, res) => {
    const { optionId } = req.body;
    try {
        const vote = await prisma.pollVote.create({ data: { userId: req.user.id, pollId: req.params.id, optionId } });
        res.status(201).json(vote);
    } catch (e) { res.status(400).json({ error: "Already voted or invalid" }); }
});

app.post("/stories/:id/reviews", authenticate, async (req, res) => {
    const { rating, content } = req.body;
    try {
        const review = await prisma.review.create({ data: { userId: req.user.id, storyId: req.params.id, rating, content } });
        res.status(201).json(review);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- ANALYTICS ---

app.get("/admin/my-stories", authenticate, async (req, res) => {
    try {
        const stories = await prisma.story.findMany({
            where: { OR: [{ ownerId: req.user.id }, { coAuthors: { some: { id: req.user.id } } }] },
            include: { _count: { select: { likes: true, history: true } }, coAuthors: true },
            orderBy: { updatedAt: "desc" }
        });
        res.json(stories);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/admin/analytics", authenticate, async (req, res) => {
    try {
        const stories = await prisma.story.findMany({
            where: { ownerId: req.user.id },
            include: { _count: { select: { likes: true, comments: true, history: true, reviews: true } } }
        });
        res.json(stories.map(s => ({ id: s.id, title: s.title, reads: s._count.history, likes: s._count.likes, comments: s._count.comments, reviews: s._count.reviews })));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/admin/stats", authenticate, isAdmin, async (req, res) => {
    try {
        const [storyCount, totalReads, userCount] = await Promise.all([prisma.story.count(), prisma.history.count(), prisma.user.count()]);
        res.json({ storyCount, totalReads, userCount });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/users/me", authenticate, async (req, res) => {
    try {
        const user = await prisma.user.findUnique({ where: { id: req.user.id }, include: { bookmarks: true, achievements: true } });
        res.json(user);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

const PORT = config.port;
app.listen(PORT, () => console.log(`🚀 StoryNest Backend v3.5.4 running on port ${PORT}`));
