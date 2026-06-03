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
    console.log(`[SMTP] Preparing to send ${type} OTP to ${email}...`);
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
        await sendGmail({
            to: email,
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
        console.log(`[Gmail API] OTP sent successfully to ${email}`);
    } catch (e) {
        console.error("[Gmail API] Critical failure:", e.message);
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
        version: "3.0.0",
        engine: "smtp_nodemailer"
    });
});

// --- v2.0 AUTH FLOW ---

// 1. Initiate Registration (Age & Email Check)
app.post("/auth/otp/initiate", async (req, res) => {
    let { email, dob } = req.body;
    if (email) email = email.toLowerCase().trim();
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
        
        // Check Firebase as well
        let firebaseUserExists = false;
        try {
            await admin.auth().getUserByEmail(email);
            firebaseUserExists = true;
        } catch (e) {}

        if ((existing && existing.firebaseUid) || firebaseUserExists) {
            return res.status(400).json({ error: "An account with this email already exists." });
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

        // Send OTP Email via SMTP
        sendOTPEmail(email, otp, "registration").catch(e => {
            console.error("[SMTP] Background failure:", e.message);
        });
        
        sendSlackNotification(`🔑 OTP initiated for ${email}`);
        
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

        sendSlackNotification(`✅ Email verified: ${email}`);

        res.json({ message: "Email verified" });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

// 3. Finalize Registration
app.post("/auth/register", async (req, res) => {
  let { email, password, username, firebaseUid, tosAccepted, privacyAccepted } = req.body;
  if (email) email = email.toLowerCase().trim();
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

    sendSlackNotification(`🎉 New Nestling! **${username}** (${email}) has joined the nest.`);
    const tokens = generateTokens(updatedUser);

    // Welcome Email via Gmail API
    sendGmail({
        to: email,
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
    }).catch(e => console.error("[Gmail API] Welcome Email Error:", e.message));

    res.status(201).json({ user: updatedUser, ...tokens });
  } catch (error) { 
    console.error("[Auth] Registration Error:", error.message);
    if (error.code === 'P2002') {
        const field = error.meta?.target?.[0] || "Username";
        return res.status(400).json({ error: `${field} is already taken. Please try another.` });
    }
    res.status(500).json({ error: error.message }); 
  }
});

// Logout Route
app.post("/auth/logout", authenticate, async (req, res) => {
    try {
        const user = await prisma.user.findUnique({ where: { id: req.user.id } });
        sendSlackNotification(`🚪 **${user?.username}** signed out`);
        res.json({ message: "Logged out" });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete("/auth/account", authenticate, async (req, res) => {
    try {
        const user = await prisma.user.findUnique({ where: { id: req.user.id } });
        
        // 1. Delete from Firebase
        if (user.firebaseUid) {
            await admin.auth().deleteUser(user.firebaseUid);
        }

        // 2. Delete from DB (Prisma will handle relations if set to CASCADE, but we did it manually before)
        // For safety, we'll use a transaction
        await prisma.$transaction([
            prisma.achievement.deleteMany({ where: { userId: user.id } }),
            prisma.purchase.deleteMany({ where: { userId: user.id } }),
            prisma.bookmark.deleteMany({ where: { userId: user.id } }),
            prisma.history.deleteMany({ where: { userId: user.id } }),
            prisma.like.deleteMany({ where: { userId: user.id } }),
            prisma.comment.deleteMany({ where: { userId: user.id } }),
            prisma.note.deleteMany({ where: { userId: user.id } }),
            prisma.user.delete({ where: { id: user.id } })
        ]);

        sendSlackNotification(`🗑️ **Account Deleted**: ${user.email} has left the nest permanently.`);
        res.json({ message: "Account deleted successfully" });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

// 4. Forgot Password OTP
app.post("/auth/password/forgot", async (req, res) => {
    let { email } = req.body;
    if (email) email = email.toLowerCase().trim();
    try {
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return res.status(404).json({ error: "User not found" });

        const otp = generateOTP();
        const expiry = new Date(Date.now() + 10 * 60 * 1000);

        await prisma.user.update({ where: { email }, data: { otpCode: otp, otpExpiry: expiry } });
        
        sendOTPEmail(email, otp, "password").catch(e => console.error("[SMTP] Forgot pass error:", e.message));
        
        sendSlackNotification(`🔄 Password reset code requested for ${email}`);
        
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

        sendSlackNotification(`🔐 Password successfully reset for ${email}`);

        res.json({ message: "Password updated" });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post("/auth/login", async (req, res) => {
  const { idToken } = req.body;
  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const { email, uid: firebaseUid, name } = decodedToken;

    let user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      // Auto-register user since they successfully authenticated with Google/Firebase
      console.log(`[Auth] Auto-registering Google user ${email}...`);
      const baseUsername = name ? name.toLowerCase().replace(/[^a-z0-9_]/g, '') : `nestling_${uuidv4().substring(0, 4)}`;
      
      // Ensure unique username
      let finalUsername = baseUsername;
      let count = 1;
      while (true) {
        const conflict = await prisma.user.findUnique({ where: { username: finalUsername } });
        if (!conflict) break;
        finalUsername = `${baseUsername}_${count}`;
        count++;
      }

      user = await prisma.user.create({
        data: {
          email,
          username: finalUsername,
          password: "google_auth_placeholder",
          firebaseUid,
          emailVerified: true,
          tosAccepted: true,
          privacyAccepted: true,
          role: "READER"
        }
      });
      
      sendSlackNotification(`🎉 New Nestling via Google! ${user.username} (${email}) has joined the nest.`);
      
      // Welcome Email via Gmail API
      sendGmail({
          to: email,
          subject: "Welcome to the Nest!",
          html: `<div style="font-family: serif; padding: 40px; background-color: #003631; color: #FFEDA8;">
                  <div style="text-align: center; margin-bottom: 30px;">
                      <span style="font-size: 28px; font-weight: bold; color: #FFEDA8; letter-spacing: 3px; border-bottom: 3px solid #E91E63; padding-bottom: 5px;">STORYNEST</span>
                  </div>
                  <h1>The Nest Welcomes You</h1>
                  <p>Hello <b>${user.username}</b>,</p>
                  <p>Your journey into imagination has officially begun. Explore new worlds, connect with stories, and find your sanctuary.</p>
                  <p>We're glad to have you here.</p>
                 </div>`
      }).catch(e => console.error("[Gmail API] Google Welcome Email Error:", e.message));
    }

    if (!user.firebaseUid) {
        user = await prisma.user.update({
            where: { id: user.id },
            data: { firebaseUid }
        });
    }

    const tokens = generateTokens(user);
    
    sendSlackNotification(`🔑 **${user.username}** logged in`);
    
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

app.get("/stories/recommendations", authenticate, async (req, res) => {
    try {
        // 1. Get user's read history to find favorite genres
        const history = await prisma.history.findMany({
            where: { userId: req.user.id },
            include: { story: { select: { genre: true } } },
            take: 20,
            orderBy: { createdAt: "desc" }
        });

        const genres = history.map(h => h.story.genre);
        const uniqueGenres = [...new Set(genres)];

        // 2. Find stories in those genres not already in history
        const readIds = history.map(h => h.storyId);
        
        const recommendations = await prisma.story.findMany({
            where: {
                genre: { in: uniqueGenres.length > 0 ? uniqueGenres : ["Fiction", "Faith"] },
                id: { notIn: readIds },
                isDraft: false
            },
            take: 6,
            include: { _count: { select: { likes: true } } }
        });

        res.json(recommendations);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

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
    const authHeader = req.headers.authorization;
    let userId = null;
    if (authHeader && authHeader.startsWith("Bearer ")) {
        try {
            const decoded = jwt.verify(authHeader.split(" ")[1], config.jwtAccessSecret);
            userId = decoded.id;
        } catch (e) {}
    }

    const story = await prisma.story.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { likes: true, comments: true } } }
    });

    if (!story) return res.status(404).json({ error: "Story not found" });

    let isUnlocked = !story.isPremium;
    if (!isUnlocked && userId) {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (user.isPremium) {
            isUnlocked = true;
        } else {
            const purchase = await prisma.purchase.findFirst({
                where: { userId, storyId: req.params.id, type: "STORY" }
            });
            if (purchase) isUnlocked = true;
        }
    }

    res.json({ ...story, isUnlocked });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post("/stories", authenticate, isAdmin, upload.single("cover"), async (req, res) => {
  const { title, genre, body, authorName, readingTime, contentWarnings, isAdult } = req.body;
  const coverUrl = req.file ? req.file.path : null;
  try {
    const story = await prisma.story.create({ 
        data: { 
            title, 
            genre, 
            body, 
            authorName, 
            readingTime: parseInt(readingTime), 
            coverUrl,
            contentWarnings,
            isAdult: isAdult === "true" || isAdult === true
        } 
    });
    cache.flushAll();
    
    // Notify subscribed users via Gmail API
    const subbedUsers = await prisma.user.findMany({ where: { notificationsOn: true }, select: { email: true } });
    if (subbedUsers.length > 0) {
        const emails = subbedUsers.map(u => u.email);
        sendGmail({
            to: emails.join(", "),
            subject: `New Story Added: ${title}`,
            html: `<div style="font-family: serif; padding: 40px; background-color: #003631; color: #FFEDA8;">
                    <div style="text-align: center; margin-bottom: 30px;">
                        <span style="font-size: 28px; font-weight: bold; color: #FFEDA8; letter-spacing: 3px; border-bottom: 3px solid #E91E63; padding-bottom: 5px;">STORYNEST</span>
                    </div>
                    <h1>A New Discovery</h1>
                    <p>"${title}" by <b>${authorName}</b> has been added to the nest.</p>
                    <p>Open the app to start reading now.</p>
                   </div>`
        }).catch(e => console.error("[Gmail API] Story Notification Error:", e.message));
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

        // Notify subscribed users via Gmail API
        const subbedUsers = await prisma.user.findMany({ where: { notificationsOn: true }, select: { email: true } });
        if (subbedUsers.length > 0) {
            const emails = subbedUsers.map(u => u.email);
            sendGmail({
                to: emails.join(", "),
                subject: `Story Updated: ${title}`,
                html: `<div style="font-family: serif; padding: 40px; background-color: #003631; color: #FFEDA8;">
                        <div style="text-align: center; margin-bottom: 30px;">
                            <span style="font-size: 28px; font-weight: bold; color: #FFEDA8; letter-spacing: 3px; border-bottom: 3px solid #E91E63; padding-bottom: 5px;">STORYNEST</span>
                        </div>
                        <h1>A World Evolves</h1>
                        <p>"${title}" has been updated with new content.</p>
                        <p>Open the app to continue your journey.</p>
                       </div>`
            }).catch(e => console.error("[Gmail API] Update Notification Error:", e.message));
        }
        
        sendSlackNotification(`📝 **Admin** updated story: "${story.title}"`);

        res.json(story);
    } catch (error) { res.status(500).json({ error: error.message }); }
});

app.delete("/stories/:id", authenticate, isAdmin, async (req, res) => {
    try {
        const story = await prisma.story.findUnique({ where: { id: req.params.id }, select: { title: true } });
        await prisma.story.delete({ where: { id: req.params.id } });
        cache.flushAll();
        
        sendSlackNotification(`🗑️ **Admin** deleted story: "${story?.title || 'Unknown'}"`);
        
        res.json({ message: "Deleted successfully" });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

// --- USER ACTIONS ---

app.post("/stories/:id/read", authenticate, async (req, res) => {
    try {
        const story = await prisma.story.findUnique({ where: { id: req.params.id }, select: { title: true, readingTime: true } });
        const user = await prisma.user.findUnique({ where: { id: req.user.id } });
        
        await prisma.history.create({ data: { userId: req.user.id, storyId: req.params.id } });
        
        // Update user XP and reading stats
        const now = new Date();
        const readTime = story?.readingTime || 5;
        
        let streak = user.streakCount || 0;
        let todayTime = user.todayReadTime || 0;
        
        const lastRead = user.lastReadDate ? new Date(user.lastReadDate) : null;
        const isSameDay = lastRead && 
            lastRead.getDate() === now.getDate() && 
            lastRead.getMonth() === now.getMonth() && 
            lastRead.getFullYear() === now.getFullYear();

        if (!isSameDay) {
            // Check for streak (if yesterday)
            const yesterday = new Date();
            yesterday.setDate(now.getDate() - 1);
            const isYesterday = lastRead && 
                lastRead.getDate() === yesterday.getDate() && 
                lastRead.getMonth() === yesterday.getMonth() && 
                lastRead.getFullYear() === yesterday.getFullYear();
            
            streak = isYesterday ? streak + 1 : 1;
            todayTime = readTime;
        } else {
            todayTime += readTime;
        }

        const updatedUser = await prisma.user.update({ 
            where: { id: req.user.id }, 
            data: { 
                xp: { increment: 10 },
                totalReadTime: { increment: readTime },
                todayReadTime: todayTime,
                streakCount: streak,
                lastReadDate: now
            } 
        });

        if (todayTime >= user.dailyGoalMinutes && user.todayReadTime < user.dailyGoalMinutes) {
            sendSlackNotification(`🎯 **${user.username}** reached their daily reading goal! (${user.dailyGoalMinutes} min)`);
        }

        // --- ACHIEVEMENT LOGIC ---
        const checkAchievements = async () => {
            const hour = now.getHours();
            
            // 1. Early Bird (4 AM - 7 AM)
            if (hour >= 4 && hour <= 7) {
                const existing = await prisma.achievement.findFirst({ where: { userId: user.id, title: "Early Bird" } });
                if (!existing) {
                    await prisma.achievement.create({ data: { userId: user.id, title: "Early Bird", icon: "flame" } });
                    sendSlackNotification(`🌟 **${user.username}** unlocked badge: **Early Bird**`);
                }
            }

            // 2. Night Owl (11 PM - 3 AM)
            if (hour >= 23 || hour <= 3) {
                const existing = await prisma.achievement.findFirst({ where: { userId: user.id, title: "Night Owl" } });
                if (!existing) {
                    await prisma.achievement.create({ data: { userId: user.id, title: "Night Owl", icon: "moon" } });
                    sendSlackNotification(`🌟 **${user.username}** unlocked badge: **Night Owl**`);
                }
            }

            // 3. First Flight (First read)
            const readCount = await prisma.history.count({ where: { userId: user.id } });
            if (readCount === 1) {
                const existing = await prisma.achievement.findFirst({ where: { userId: user.id, title: "First Flight" } });
                if (!existing) {
                    await prisma.achievement.create({ data: { userId: user.id, title: "First Flight", icon: "award" } });
                    sendSlackNotification(`🌟 **${user.username}** unlocked badge: **First Flight**`);
                }
            }
        };

        checkAchievements().catch(e => console.error("Achievement error:", e));
        
        sendSlackNotification(`📖 **${user?.username}** just finished reading "${story?.title || 'a story'}" (+10 XP)`);
        
        res.json({ status: "success", todayReadTime: todayTime, dailyGoal: user.dailyGoalMinutes });
    } catch (e) { 
        console.error("[Read Endpoint] Error:", e.message);
        res.json({ status: "already_logged" }); 
    }
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
        
        sendSlackNotification(`⚙️ **${user.username}** updated their settings (Notifications: ${notificationsOn ? 'ON' : 'OFF'})`);
        
        res.json(user);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put("/users/me/profile", authenticate, async (req, res) => {
    const { username, bio } = req.body;
    try {
        const user = await prisma.user.update({
            where: { id: req.user.id },
            data: { username, bio }
        });
        
        sendSlackNotification(`👤 **${user.username}** updated their profile info`);
        
        res.json(user);
    } catch (e) { 
        if (e.code === 'P2002') return res.status(400).json({ error: "Username already taken" });
        res.status(500).json({ error: e.message }); 
    }
});

app.post("/users/me/avatar", authenticate, upload.single("avatar"), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No image provided" });
    try {
        const user = await prisma.user.update({ where: { id: req.user.id }, data: { avatarUrl: req.file.path } });
        
        sendSlackNotification(`📸 **${user.username}** updated their profile picture`);
        
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
        const story = await prisma.story.findUnique({ where: { id: req.params.id }, select: { title: true } });
        const user = await prisma.user.findUnique({ where: { id: req.user.id }, select: { username: true } });

        if (progress === -1) {
            await prisma.bookmark.delete({ where: { userId_storyId: { userId: req.user.id, storyId: req.params.id } } });
            sendSlackNotification(`🔖 **${user?.username}** removed "${story?.title}" from bookmarks`);
            return res.json({ message: "Removed" });
        }
        const bookmark = await prisma.bookmark.upsert({
            where: { userId_storyId: { userId: req.user.id, storyId: req.params.id } },
            update: { progress: parseInt(progress) },
            create: { userId: req.user.id, storyId: req.params.id, progress: parseInt(progress) }
        });
        
        sendSlackNotification(`🔖 **${user?.username}** bookmarked "${story?.title}" (${progress}% read)`);
        
        res.json(bookmark);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/stories/:id/like", authenticate, async (req, res) => {
    try {
        const story = await prisma.story.findUnique({ where: { id: req.params.id }, select: { title: true } });
        const user = await prisma.user.findUnique({ where: { id: req.user.id }, select: { username: true } });

        const existing = await prisma.like.findUnique({ where: { userId_storyId: { userId: req.user.id, storyId: req.params.id } } });
        if (existing) {
            await prisma.like.delete({ where: { id: existing.id } });
            const count = await prisma.like.count({ where: { storyId: req.params.id } });
            
            sendSlackNotification(`💔 **${user?.username}** unliked "${story?.title}"`);
            
            return res.json({ isLiked: false, likes: count });
        }
        await prisma.like.create({ data: { userId: req.user.id, storyId: req.params.id } });
        const count = await prisma.like.count({ where: { storyId: req.params.id } });
        
        await prisma.user.update({ where: { id: req.user.id }, data: { lastLikeDate: new Date() } });
        
        sendSlackNotification(`❤️ **${user?.username}** liked "${story?.title}"`);
        
        res.json({ isLiked: true, likes: count });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- NOTES ---

app.get("/stories/:id/notes", authenticate, async (req, res) => {
    try {
        const notes = await prisma.note.findMany({
            where: { storyId: req.params.id, userId: req.user.id },
            orderBy: { createdAt: "desc" }
        });
        res.json(notes);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/stories/:id/notes", authenticate, async (req, res) => {
    const { content } = req.body;
    try {
        const note = await prisma.note.create({
            data: { content, storyId: req.params.id, userId: req.user.id }
        });
        res.status(201).json(note);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete("/notes/:id", authenticate, async (req, res) => {
    try {
        await prisma.note.delete({ where: { id: req.params.id, userId: req.user.id } });
        res.json({ message: "Deleted" });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- COMMENTS ---

app.get("/stories/:id/comments", async (req, res) => {
    try {
      const { parentId } = req.query;
      const comments = await prisma.comment.findMany({
        where: { 
            storyId: req.params.id,
            parentId: parentId || null // Fetch top-level if no parentId
        },
        include: { 
            user: { select: { username: true, avatarUrl: true } },
            _count: { select: { replies: true } }
        },
        orderBy: { createdAt: "desc" }
      });
      res.json(comments);
    } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post("/stories/:id/comments", authenticate, async (req, res) => {
    const { content, parentId } = req.body;
    try {
      const comment = await prisma.comment.create({
        data: {
          content,
          storyId: req.params.id,
          userId: req.user.id,
          parentId: parentId || null
        },
        include: { user: { select: { username: true, avatarUrl: true } } }
      });
      
      await prisma.user.update({ where: { id: req.user.id }, data: { lastCommentDate: new Date() } });
      
      sendSlackNotification(`💬 **${req.user.id}** commented on story ${req.params.id}${parentId ? ' (Reply)' : ''}`);
      
      res.status(201).json(comment);
    } catch (error) { res.status(500).json({ error: error.message }); }
});

// --- MONETIZATION ---

app.post("/monetization/coins/purchase", authenticate, async (req, res) => {
    const { amount, planId } = req.body; // amount is number of coins
    try {
        const user = await prisma.user.update({
            where: { id: req.user.id },
            data: { coins: { increment: amount } }
        });

        await prisma.purchase.create({
            data: {
                userId: req.user.id,
                type: "COINS",
                amount: amount,
                currency: "COIN"
            }
        });

        sendSlackNotification(`💰 **${user.username}** purchased ${amount} Nest Coins!`);
        res.json({ coins: user.coins });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/monetization/subscribe", authenticate, async (req, res) => {
    try {
        const expiry = new Date();
        expiry.setMonth(expiry.getMonth() + 1);

        const user = await prisma.user.update({
            where: { id: req.user.id },
            data: { 
                isPremium: true,
                premiumExpiresAt: expiry
            }
        });

        await prisma.purchase.create({
            data: {
                userId: req.user.id,
                type: "SUBSCRIPTION",
                amount: 9.99, // Simulated price
                currency: "USD"
            }
        });

        sendSlackNotification(`👑 **${user.username}** subscribed to **Nest Plus**!`);
        res.json(user);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/stories/:id/purchase", authenticate, async (req, res) => {
    try {
        const story = await prisma.story.findUnique({ where: { id: req.params.id } });
        const user = await prisma.user.findUnique({ where: { id: req.user.id } });

        if (!story || !story.isPremium) return res.status(400).json({ error: "Story is not for sale" });
        if (user.coins < story.price) return res.status(400).json({ error: "Insufficient Nest Coins" });

        // Check if already purchased
        const existing = await prisma.purchase.findFirst({
            where: { userId: req.user.id, storyId: req.params.id, type: "STORY" }
        });
        if (existing) return res.json({ message: "Already owned" });

        const [updatedUser] = await prisma.$transaction([
            prisma.user.update({
                where: { id: req.user.id },
                data: { coins: { decrement: story.price } }
            }),
            prisma.purchase.create({
                data: {
                    userId: req.user.id,
                    storyId: req.params.id,
                    type: "STORY",
                    amount: story.price,
                    currency: "COIN"
                }
            })
        ]);

        sendSlackNotification(`📖 **${user.username}** unlocked premium story: "${story.title}"`);
        res.json({ message: "Unlocked", coins: updatedUser.coins });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- GAMIFICATION ---

app.get("/gamification/leaderboard", async (req, res) => {
    try {
        const leaders = await prisma.user.findMany({
            take: 10,
            orderBy: { xp: "desc" },
            select: {
                username: true,
                avatarUrl: true,
                xp: true,
                isPremium: true
            }
        });
        res.json(leaders);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/gamification/shop/purchase", authenticate, async (req, res) => {
    const { itemId, price, name } = req.body;
    try {
        const user = await prisma.user.findUnique({ where: { id: req.user.id } });
        if (user.coins < price) return res.status(400).json({ error: "Insufficient coins" });

        const updatedUser = await prisma.user.update({
            where: { id: req.user.id },
            data: { coins: { decrement: price } }
        });

        await prisma.purchase.create({
            data: {
                userId: req.user.id,
                type: "COINS", // Using COINS as a general virtual purchase type for now
                amount: price,
                currency: "COIN"
            }
        });

        sendSlackNotification(`🎁 **${user.username}** bought ${name} from the Achievement Shop!`);
        res.json({ message: "Success", coins: updatedUser.coins });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- SOCIAL ---

app.get("/users/:id/profile", async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.params.id },
            select: {
                id: true,
                username: true,
                avatarUrl: true,
                bio: true,
                xp: true,
                isPremium: true,
                _count: {
                    select: {
                        followers: true,
                        following: true,
                        history: true
                    }
                },
                achievements: true
            }
        });
        if (!user) return res.status(404).json({ error: "User not found" });

        // Check if current user follows them
        let isFollowing = false;
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith("Bearer ")) {
            try {
                const decoded = jwt.verify(authHeader.split(" ")[1], config.jwtAccessSecret);
                const follow = await prisma.follows.findUnique({
                    where: { followerId_followingId: { followerId: decoded.id, followingId: req.params.id } }
                });
                isFollowing = !!follow;
            } catch (e) {}
        }

        res.json({ ...user, isFollowing });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/users/:id/follow", authenticate, async (req, res) => {
    try {
        if (req.user.id === req.params.id) return res.status(400).json({ error: "Cannot follow yourself" });
        
        await prisma.follows.create({
            data: {
                followerId: req.user.id,
                followingId: req.params.id
            }
        });
        
        const follower = await prisma.user.findUnique({ where: { id: req.user.id }, select: { username: true } });
        const followed = await prisma.user.findUnique({ where: { id: req.params.id }, select: { username: true } });
        
        sendSlackNotification(`👥 **${follower.username}** followed **${followed.username}**!`);
        res.json({ message: "Followed" });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete("/users/:id/follow", authenticate, async (req, res) => {
    try {
        await prisma.follows.delete({
            where: { followerId_followingId: { followerId: req.user.id, followingId: req.params.id } }
        });
        res.json({ message: "Unfollowed" });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/activity/feed", authenticate, async (req, res) => {
    try {
        // 1. Get IDs of users we follow
        const following = await prisma.follows.findMany({
            where: { followerId: req.user.id },
            select: { followingId: true }
        });
        const followingIds = following.map(f => f.followingId);

        // 2. Get activities from those users
        const feed = await prisma.activity.findMany({
            where: { userId: { in: followingIds } },
            include: {
                user: { select: { username: true, avatarUrl: true } },
                story: { select: { title: true, coverUrl: true, genre: true } }
            },
            take: 30,
            orderBy: { createdAt: "desc" }
        });
        res.json(feed);
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
app.listen(PORT, () => console.log(`🚀 StoryNest Backend v3.3 (Gmail API) running on port ${PORT}`));
