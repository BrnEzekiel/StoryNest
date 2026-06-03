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

const handleMentions = async (content, storyId, senderId) => {
    const mentions = content.match(/@(\w+)/g);
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

// --- AUTH MIDDLEWARE ---
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) return res.status(401).json({ error: "Unauthorized" });
  const token = authHeader.split(" ")[1];
  try {
    req.user = jwt.verify(token, config.jwtAccessSecret);
    next();
  } catch (err) { res.status(401).json({ error: "Token invalid" }); }
};

const isAdmin = (req, res, next) => {
  if (req.user.role !== "ADMIN") return res.status(403).json({ error: "Admin required" });
  next();
};

const canEditStory = async (req, res, next) => {
    try {
        const storyId = req.params.storyId || req.params.id || req.body.storyId;
        const story = await prisma.story.findUnique({ where: { id: storyId }, include: { coAuthors: true } });
        if (!story) return res.status(404).json({ error: "Story not found" });
        if (story.ownerId === req.user.id || story.coAuthors.some(ca => ca.id === req.user.id) || req.user.role === "ADMIN") next();
        else res.status(403).json({ error: "No access" });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

// --- ROUTES ---

app.get("/health", (req, res) => res.json({ status: "ok", version: "3.5.3" }));

// --- COMMENTS WITH MENTIONS ---

app.post("/stories/:id/comments", authenticate, async (req, res) => {
    const { content, parentId } = req.body;
    try {
        const comment = await prisma.comment.create({ data: { userId: req.user.id, storyId: req.params.id, content, parentId } });
        await handleMentions(content, req.params.id, req.user.id);
        res.status(201).json(comment);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- STORIES & DISCOVERY ---

app.get("/stories/trending", async (req, res) => {
    try {
        const stories = await prisma.story.findMany({ where: { isDraft: false }, include: { _count: { select: { likes: true, history: true } } }, take: 10 });
        const trending = stories.sort((a, b) => ((b._count.likes * 2) + b._count.history) - ((a._count.likes * 2) + a._count.history));
        res.json(trending);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/stories", async (req, res) => {
  const { genre, mood, q } = req.query;
  const now = new Date();
  try {
    const where = { isDraft: false, OR: [{ publishedAt: null }, { publishedAt: { lte: now } }] };
    if (genre && genre !== "All") where.genre = genre;
    if (mood && mood !== "All") where.mood = mood;
    if (q) where.OR = [{ title: { contains: q, mode: "insensitive" } }, { authorName: { contains: q, mode: "insensitive" } }];
    const stories = await prisma.story.findMany({ where, orderBy: { createdAt: "desc" }, include: { _count: { select: { likes: true, reviews: true } } } });
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
    res.json({ ...story, isUnlocked: true });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// --- MESSAGING ---

app.post("/messages", authenticate, async (req, res) => {
    const { receiverId, content } = req.body;
    try {
        const msg = await prisma.message.create({ data: { senderId: req.user.id, receiverId, content } });
        await handleMentions(content, null, req.user.id);
        res.status(201).json(msg);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- OTHER ENDPOINTS (ANALYTICS, PLAYLISTS, TIPS, ETC) ---

app.get("/admin/analytics", authenticate, async (req, res) => {
    try {
        const stories = await prisma.story.findMany({ where: { ownerId: req.user.id }, include: { _count: { select: { likes: true, comments: true, history: true, reviews: true } } } });
        res.json(stories.map(s => ({ id: s.id, title: s.title, reads: s._count.history, likes: s._count.likes, comments: s._count.comments, reviews: s._count.reviews })));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

const PORT = config.port;
app.listen(PORT, () => console.log(`🚀 StoryNest Backend v3.5.3 (Mentions) running on port ${PORT}`));
