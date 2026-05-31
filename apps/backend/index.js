require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { PrismaClient } = require("@prisma/client");
const cloudinary = require("cloudinary").v2;
const multer = require("multer");
const { v4: uuidv4 } = require("uuid");
const rateLimit = require("express-rate-limit");
const NodeCache = require("node-cache");
const admin = require("firebase-admin");

// Initialize Firebase Admin
admin.initializeApp({
  projectId: "fir-ai-logic"
});

const prisma = new PrismaClient();
const app = express();
const PORT = process.env.PORT || 5000;
const cache = new NodeCache({ stdTTL: 60, checkperiod: 120 });

// --- SUPER ADMIN CONFIG ---
const SUPER_ADMIN_EMAIL = "test@example.com";
const ALT_ADMIN_EMAIL = "text@example.com";
const DEFAULT_PASSWORD = "password123";

async function ensureAdminExists() {
  try {
    const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 10);

    // Ensure test@example.com
    await prisma.user.upsert({
      where: { email: SUPER_ADMIN_EMAIL },
      update: { password: hashedPassword, role: "ADMIN" },
      create: {
        email: SUPER_ADMIN_EMAIL,
        username: "SuperAdmin",
        password: hashedPassword,
        role: "ADMIN"
      }
    });

    // Ensure text@example.com (handling user's potential typo)
    await prisma.user.upsert({
      where: { email: ALT_ADMIN_EMAIL },
      update: { password: hashedPassword, role: "ADMIN" },
      create: {
        email: ALT_ADMIN_EMAIL,
        username: "TextAdmin",
        password: hashedPassword,
        role: "ADMIN"
      }
    });

    console.log(`[SEED] Super Admins verified`);
  } catch (e) { console.error("[SEED ERROR]", e.message); }
}
ensureAdminExists();


app.use(cors());
app.use(express.json());

// --- REMOTE ERROR MONITORING ---
app.post("/logs/error", (req, res) => {
  const { error, stack, device, timestamp, isFatal } = req.body;
  console.log("\n" + "=".repeat(50));
  console.log(`🚨 MOBILE ERROR CAPTURED [${timestamp}]`);
  console.log(`📱 DEVICE: ${device}`);
  console.log(`⚠️ FATAL: ${isFatal}`);
  console.log(`💬 MESSAGE: ${error}`);
  console.log("-".repeat(50));
  console.log(`📜 STACK TRACE:\n${stack}`);
  console.log("=".repeat(50) + "\n");
  res.json({ success: true });
});

// --- Rate Limiting ---
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 500,
  message: "Too many requests, please try again later."
});
app.use(globalLimiter);

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const upload = multer({ dest: "uploads/" });

const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) return res.status(401).json({ error: "Unauthorized" });
  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET || "secret");
    req.user = decoded;
    next();
  } catch (error) { return res.status(401).json({ error: "Invalid token" }); }
};

const isAdmin = (req, res, next) => {
  if (req.user && (req.user.role === "ADMIN" || req.user.email === SUPER_ADMIN_EMAIL)) next();
  else res.status(403).json({ error: "Forbidden" });
};

const generateTokens = (user) => {
  const accessToken = jwt.sign({ id: user.id, email: user.email, role: user.role }, process.env.JWT_ACCESS_SECRET || "secret", { expiresIn: "24h" });
  const refreshToken = jwt.sign({ id: user.id }, process.env.JWT_REFRESH_SECRET || "refresh-secret", { expiresIn: "7d" });
  return { accessToken, refreshToken };
};

// --- Auth ---
app.post("/auth/register", async (req, res) => {
  const { email, password, username, firebaseUid } = req.body;
  try {
    const existing = await prisma.user.findFirst({
      where: { OR: [{ email }, { username }] }
    });

    if (existing) {
      if (existing.email === email) return res.status(400).json({ error: "Email already exists" });
      if (existing.username === username) return res.status(400).json({ error: "Username taken" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({ 
      data: { 
        email, 
        username, 
        password: hashedPassword, 
        firebaseUid,
        role: email === SUPER_ADMIN_EMAIL ? "ADMIN" : "READER" 
      } 
    });
    const tokens = generateTokens(user);
    res.status(201).json({ user, ...tokens });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post("/auth/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.password))) return res.status(401).json({ error: "Invalid credentials" });
    const tokens = generateTokens(user);
    res.json({ user, ...tokens });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post("/auth/firebase", async (req, res) => {
  const { idToken } = req.body;
  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const { email, name, picture, uid } = decodedToken;

    let user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          username: (name || "user").replace(/\s+/g, '').toLowerCase() + uuidv4().substring(0, 4),
          password: uuidv4(),
          avatarUrl: picture,
          firebaseUid: uid,
          role: email === SUPER_ADMIN_EMAIL ? "ADMIN" : "READER"
        }
      });
    } else if (!user.firebaseUid) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { firebaseUid: uid }
      });
    }

    const tokens = generateTokens(user);
    res.json({ user, ...tokens });
  } catch (error) {
    console.error("Firebase verification error:", error);
    res.status(401).json({ error: "Firebase verification failed" });
  }
});

// --- Stories & Others (Rest of your endpoints ...) ---
app.get("/stories", async (req, res) => {
  const { genre, q } = req.query;
  const cacheKey = `stories_${genre || 'all'}_${q || 'none'}`;
  const cached = cache.get(cacheKey);
  if (cached) return res.json(cached);
  try {
    const where = {};
    if (genre && genre !== "All") where.genre = { equals: genre, mode: 'insensitive' };
    if (q) {
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { body: { contains: q, mode: 'insensitive' } },
        { authorName: { contains: q, mode: 'insensitive' } }
      ];
    }
    const stories = await prisma.story.findMany({ where, include: { _count: { select: { likes: true } } }, orderBy: { createdAt: 'desc' } });
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

    let isLiked = false;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      try {
        const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET || "secret");
        const like = await prisma.like.findUnique({
          where: { userId_storyId: { userId: decoded.id, storyId: req.params.id } }
        });
        isLiked = !!like;
      } catch (err) {
        // Safe to ignore, user is just treated as guest/not-liked
      }
    }

    res.json({ ...story, isLiked });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post("/stories", authenticate, isAdmin, upload.single("cover"), async (req, res) => {
  const { title, genre, body, authorName, readingTime } = req.body;
  try {
    let coverUrl = "";
    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path);
      coverUrl = result.secure_url;
    }
    const story = await prisma.story.create({ data: { title, genre, body, authorName, readingTime: parseInt(readingTime), coverUrl } });
    cache.flushAll();
    res.status(201).json(story);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post("/stories/:id/like", authenticate, async (req, res) => {
  try {
    const existingLike = await prisma.like.findUnique({ where: { userId_storyId: { userId: req.user.id, storyId: req.params.id } } });
    if (existingLike) await prisma.like.delete({ where: { userId_storyId: { userId: req.user.id, storyId: req.params.id } } });
    else await prisma.like.create({ data: { userId: req.user.id, storyId: req.params.id } });
    const count = await prisma.like.count({ where: { storyId: req.params.id } });
    res.json({ success: true, likes: count, isLiked: !existingLike });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get("/users/me", authenticate, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id }, include: { _count: { select: { history: true, bookmarks: true } } } });
    res.json(user);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get("/users/me/history", authenticate, async (req, res) => {
  try {
    const history = await prisma.history.findMany({ where: { userId: req.user.id }, include: { story: true }, orderBy: { createdAt: 'desc' } });
    const uniqueHistory = [];
    const seenStories = new Set();
    for (const entry of history) {
      if (!seenStories.has(entry.storyId)) {
        uniqueHistory.push(entry);
        seenStories.add(entry.storyId);
      }
    }
    res.json(uniqueHistory);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post("/stories/:id/read", authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const storyId = req.params.id;
    await prisma.history.deleteMany({ where: { userId, storyId } });
    await prisma.history.create({ data: { userId, storyId } });
    const story = await prisma.story.findUnique({ where: { id: storyId } });
    await prisma.user.update({ where: { id: userId }, data: { totalReadTime: { increment: story.readingTime }, lastReadDate: new Date() } });
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// --- Bookmarks Endpoints ---
app.get("/users/me/bookmarks", authenticate, async (req, res) => {
  try {
    const bookmarks = await prisma.bookmark.findMany({
      where: { userId: req.user.id },
      include: { story: true },
      orderBy: { createdAt: "desc" }
    });
    res.json(bookmarks);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post("/stories/:id/bookmark", authenticate, async (req, res) => {
  const { progress } = req.body;
  const storyId = req.params.id;
  const userId = req.user.id;
  try {
    if (progress < 0) {
      await prisma.bookmark.deleteMany({
        where: { userId, storyId }
      });
      res.json({ success: true, bookmarked: false });
    } else {
      const bookmark = await prisma.bookmark.upsert({
        where: { userId_storyId: { userId, storyId } },
        update: { progress: parseInt(progress) },
        create: { userId, storyId, progress: parseInt(progress) }
      });
      res.json({ success: true, bookmark });
    }
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// --- Comments Endpoints ---
app.get("/stories/:id/comments", async (req, res) => {
  try {
    const comments = await prisma.comment.findMany({
      where: { storyId: req.params.id },
      include: { user: { select: { username: true, avatarUrl: true } } },
      orderBy: { createdAt: "desc" }
    });
    res.json(comments);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post("/stories/:id/comments", authenticate, async (req, res) => {
  const { content } = req.body;
  const storyId = req.params.id;
  const userId = req.user.id;
  try {
    const comment = await prisma.comment.create({
      data: {
        content,
        userId,
        storyId
      },
      include: { user: { select: { username: true, avatarUrl: true } } }
    });
    res.status(201).json(comment);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// --- Profile Update ---
app.put("/users/me", authenticate, upload.single("avatar"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No avatar image provided" });
    const result = await cloudinary.uploader.upload(req.file.path);
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { avatarUrl: result.secure_url }
    });
    res.json(user);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// --- Token Refresh ---
app.post("/auth/refresh", async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ error: "Refresh token required" });
  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || "refresh-secret");
    const user = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (!user) return res.status(401).json({ error: "User not found" });
    const tokens = generateTokens(user);
    res.json(tokens);
  } catch (error) {
    return res.status(401).json({ error: "Invalid refresh token" });
  }
});

// --- Admin Story Management ---
app.put("/stories/:id", authenticate, isAdmin, upload.single("cover"), async (req, res) => {
  const { title, genre, body, authorName, readingTime } = req.body;
  try {
    const updateData = {
      title,
      genre,
      body,
      authorName,
      readingTime: readingTime ? parseInt(readingTime) : undefined
    };
    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path);
      updateData.coverUrl = result.secure_url;
    }
    const story = await prisma.story.update({
      where: { id: req.params.id },
      data: updateData
    });
    cache.flushAll();
    res.json(story);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.delete("/stories/:id", authenticate, isAdmin, async (req, res) => {
  const storyId = req.params.id;
  try {
    await prisma.$transaction([
      prisma.like.deleteMany({ where: { storyId } }),
      prisma.comment.deleteMany({ where: { storyId } }),
      prisma.history.deleteMany({ where: { storyId } }),
      prisma.bookmark.deleteMany({ where: { storyId } }),
      prisma.story.delete({ where: { id: storyId } })
    ]);
    cache.flushAll();
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get("/admin/stats", authenticate, isAdmin, async (req, res) => {
  try {
    const [storyCount, totalReads, userCount] = await Promise.all([
      prisma.story.count(),
      prisma.history.count(),
      prisma.user.count({ where: { email: { not: SUPER_ADMIN_EMAIL } } })
    ]);
    res.json({ storyCount, totalReads, userCount });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
