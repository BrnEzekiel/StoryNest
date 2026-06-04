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
    } catch (e) { console.error("[Gmail API] Send Failure:", e.message); }
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
        const story = await prisma.story.findUnique({ where: { id: storyId }, include: { coAuthors: true } });
        if (!story) return res.status(404).json({ error: "Story not found" });
        if (story.ownerId === req.user.id || story.coAuthors.some(ca => ca.id === req.user.id) || req.user.role === "ADMIN") next();
        else res.status(403).json({ error: "No edit access" });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

// --- ROUTES ---

app.get("/health", (req, res) => res.json({ status: "ok", version: "3.7.0" }));

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
  } catch (error) { res.status(401).json({ error: "Login failed: " + error.message }); }
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

app.get("/stories/trending", async (req, res) => {
    try {
        const stories = await prisma.story.findMany({
            where: { isDraft: false },
            include: { _count: { select: { likes: true, history: true } } },
            take: 15
        });
        const trending = stories.sort((a, b) => ((b._count.likes * 2) + b._count.history) - ((a._count.likes * 2) + a._count.history));
        res.json(trending);
    } catch (e) { res.status(500).json({ error: e.message }); }
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
  const authHeader = req.headers.authorization;
  let userId = null;
  if (authHeader && authHeader.startsWith("Bearer ")) {
      try { userId = jwt.verify(authHeader.split(" ")[1], config.jwtAccessSecret).id; } catch (e) {}
  }
  const now = new Date();
  try {
    const story = await prisma.story.findUnique({
      where: { id: req.params.id },
      include: { 
          _count: { select: { likes: true, comments: true, reviews: true } },
          characters: true, worldEntries: true,
          chapters: { 
              where: { isDraft: false }, 
              orderBy: { order: "asc" }, 
              select: { id: true, title: true, order: true } 
          },
          polls: { where: { isActive: true }, include: { options: { include: { _count: { select: { votes: true } } } } } }
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
    res.json({ ...story, isUnlocked: true, isLiked, bookmarkProgress });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post("/stories", authenticate, isAdmin, upload.single("cover"), async (req, res) => {
    console.log("[Stories] POST Body:", req.body);
    console.log("[Stories] POST File:", req.file ? "File Received" : "No File");
    
    const { title, genre, authorName, mood, body, summary, coverUrl: bodyCoverUrl, readingTime } = req.body;
    try {
        const story = await prisma.story.create({
            data: { 
                title, genre, authorName, mood, summary, 
                ownerId: req.user.id, 
                readingTime: readingTime ? parseInt(readingTime) : 5,
                coverUrl: req.file ? req.file.path : (bodyCoverUrl || null), 
                isDraft: false,
                publishedAt: new Date(),
                chapters: body ? { create: { title: "Chapter 1", body, order: 1 } } : undefined 
            }
        });
        res.status(201).json(story);
    } catch (e) { 
        console.error("[Stories] Create Error:", e.message);
        res.status(500).json({ error: e.message }); 
    }
});

app.put("/stories/:id", authenticate, canEditStory, upload.single("cover"), async (req, res) => {
    console.log("[Stories] PUT Body:", req.body);
    const { title, genre, authorName, mood, summary, coverUrl, readingTime } = req.body;
    
    const updateData = {};
    if (title) updateData.title = title;
    if (genre) updateData.genre = genre;
    if (authorName) updateData.authorName = authorName;
    if (mood) updateData.mood = mood;
    if (summary) updateData.summary = summary;
    if (readingTime) updateData.readingTime = parseInt(readingTime);

    if (req.file) {
        updateData.coverUrl = req.file.path;
    } else if (coverUrl) {
        updateData.coverUrl = coverUrl;
    }
    
    try {
        const story = await prisma.story.update({ where: { id: req.params.id }, data: updateData });
        res.json(story);
    } catch (e) { 
        console.error("[Stories] Update Error:", e.message);
        res.status(500).json({ error: e.message }); 
    }
});

// --- INTERACTION (LIKE, READ) ---

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
        await prisma.activity.create({ data: { userId, storyId, type: "LIKE" } });
        res.json({ isLiked: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/stories/:id/read", authenticate, async (req, res) => {
    try {
        await prisma.history.create({ data: { userId: req.user.id, storyId: req.params.id } });
        await prisma.activity.create({ data: { userId: req.user.id, storyId: req.params.id, type: "READ" } });
        await prisma.user.update({ where: { id: req.user.id }, data: { xp: { increment: 10 } } });
        res.json({ status: "success" });
    } catch (e) { res.json({ status: "ok" }); }
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

// --- SOCIAL (COMMENTS, REVIEWS, POLLS, PLAYLISTS) ---

app.get("/stories/:id/comments", async (req, res) => {
    try {
        const comments = await prisma.comment.findMany({
            where: { storyId: req.params.id, parentId: req.query.parentId || null },
            include: { user: true, _count: { select: { replies: true } } },
            orderBy: { createdAt: "desc" }
        });
        res.json(comments);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/stories/:id/comments", authenticate, async (req, res) => {
    const { content, parentId } = req.body;
    try {
        const comment = await prisma.comment.create({ data: { userId: req.user.id, storyId: req.params.id, content, parentId } });
        await handleMentions(content, req.params.id, req.user.id);
        res.status(201).json(comment);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/stories/:id/reviews", async (req, res) => {
    try {
        const reviews = await prisma.review.findMany({ where: { storyId: req.params.id }, include: { user: true }, orderBy: { createdAt: "desc" } });
        res.json(reviews);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/stories/:id/reviews", authenticate, async (req, res) => {
    const { rating, content } = req.body;
    try {
        const review = await prisma.review.create({ data: { userId: req.user.id, storyId: req.params.id, rating, content } });
        res.status(201).json(review);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/polls/:id/vote", authenticate, async (req, res) => {
    const { optionId } = req.body;
    try {
        const vote = await prisma.pollVote.create({ data: { userId: req.user.id, pollId: req.params.id, optionId } });
        res.status(201).json(vote);
    } catch (e) { res.status(400).json({ error: "Vote failed" }); }
});

app.get("/playlists/me", authenticate, async (req, res) => {
    try {
        const playlists = await prisma.playlist.findMany({ where: { userId: req.user.id }, include: { stories: { include: { story: true } } } });
        res.json(playlists);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/playlists", authenticate, async (req, res) => {
    const { title, description } = req.body;
    try {
        const playlist = await prisma.playlist.create({ data: { userId: req.user.id, title, description } });
        res.status(201).json(playlist);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/playlists/:id/stories", authenticate, async (req, res) => {
    try {
        await prisma.playlistStory.create({ data: { playlistId: req.params.id, storyId: req.body.storyId } });
        res.json({ message: "Added" });
    } catch (e) { res.status(400).json({ error: "Failed" }); }
});

// --- MESSAGING ---

app.get("/messages/conversations", authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        const messages = await prisma.message.findMany({
            where: { OR: [{ senderId: userId }, { receiverId: userId }] },
            orderBy: { createdAt: "desc" },
            include: { sender: true, receiver: true }
        });
        const convs = []; const seen = new Set();
        for (const m of messages) {
            const other = m.senderId === userId ? m.receiver : m.sender;
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

// --- USER TOOLS (NOTES, HIGHLIGHTS, FOLLOWS) ---

app.get("/stories/:id/notes", authenticate, async (req, res) => {
    try {
        const notes = await prisma.note.findMany({ where: { storyId: req.params.id, userId: req.user.id } });
        res.json(notes);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/stories/:id/notes", authenticate, async (req, res) => {
    try {
        const note = await prisma.note.create({ data: { userId: req.user.id, storyId: req.params.id, content: req.body.content } });
        res.status(201).json(note);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/stories/:id/highlights", authenticate, async (req, res) => {
    try {
        const highlights = await prisma.highlight.findMany({ where: { storyId: req.params.id, userId: req.user.id } });
        res.json(highlights);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/stories/:id/highlights", authenticate, async (req, res) => {
    try {
        const highlight = await prisma.highlight.create({ data: { userId: req.user.id, storyId: req.params.id, content: req.body.content, color: req.body.color } });
        res.status(201).json(highlight);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/users/:id/follow", authenticate, async (req, res) => {
    try {
        await prisma.follows.create({ data: { followerId: req.user.id, followingId: req.params.id } });
        res.json({ message: "Followed" });
    } catch (e) { res.status(400).json({ error: "Already following" }); }
});

app.post("/users/:id/tip", authenticate, async (req, res) => {
    const { amount } = req.body;
    try {
        const sender = await prisma.user.findUnique({ where: { id: req.user.id } });
        if (sender.coins < amount) return res.status(400).json({ error: "Insufficient coins" });
        await prisma.$transaction([
            prisma.user.update({ where: { id: req.user.id }, data: { coins: { decrement: amount } } }),
            prisma.user.update({ where: { id: req.params.id }, data: { coins: { increment: amount } } }),
            prisma.purchase.create({ data: { userId: req.user.id, amount: -amount, type: "TIP" } })
        ]);
        res.json({ message: "Tip sent" });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- ADMIN & ANALYTICS ---

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
    } catch (error) { res.status(500).json({ error: error.message }); }
});

// --- AI ---

app.post("/ai/assist", authenticate, async (req, res) => {
    const { text, type } = req.body;
    if (!config.geminiApiKey) return res.status(500).json({ error: "AI Key missing" });
    try {
        const response = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${config.geminiApiKey}`,
            { contents: [{ parts: [{ text: `You are an expert story writer. ${type === "twist" ? "Suggest a plot twist for:" : "Continue this story (150 words):"} \n\n${text}` }] }] }
        );
        res.json({ result: response.data.candidates[0].content.parts[0].text });
    } catch (e) { res.status(500).json({ error: "AI failed" }); }
});

app.post("/ai/translate", authenticate, async (req, res) => {
    try {
        const response = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${config.geminiApiKey}`,
            { contents: [{ parts: [{ text: `Translate this into ${req.body.targetLanguage}: \n\n${req.body.text}` }] }] }
        );
        res.json({ result: response.data.candidates[0].content.parts[0].text });
    } catch (e) { res.status(500).json({ error: "Translation failed" }); }
});

// --- USER ME ---

app.get("/users/me", authenticate, async (req, res) => {
    try {
        const user = await prisma.user.findUnique({ where: { id: req.user.id }, include: { bookmarks: true, achievements: true } });
        res.json(user);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/users/me/preferences", authenticate, async (req, res) => {
    const { readerTheme } = req.body;
    try {
        const user = await prisma.user.update({ where: { id: req.user.id }, data: { readerTheme } });
        res.json(user);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- 404 ---
app.use((req, res) => {
    console.log(`[404] Unhandled: ${req.method} ${req.url}`);
    res.status(404).json({ error: "Not found", method: req.method, url: req.url });
});

const PORT = config.port;
app.listen(PORT, () => console.log(`🚀 StoryNest Backend v3.7.0 (COMPLETE) running on port ${PORT}`));
