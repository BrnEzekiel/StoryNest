# StoryNest - Full-Stack Mobile Stories App

StoryNest is a production-ready mobile application for reading stories, built with a robust tech stack and a polished, professional UI.

## 🚀 Tech Stack

- **Frontend:** React Native (Expo) with TypeScript
- **Backend:** Node.js + Express.js
- **Database:** PostgreSQL with Prisma ORM
- **Auth:** JWT (Access + Refresh Tokens)
- **Storage:** Cloudinary (for cover images)
- **Styling:** Vanilla StyleSheet with Brand Identity (Deep Forest Green & Warm Cream)

## 📱 Features

- **Auth Flow:** Onboarding, Login, Signup with JWT persistence in SecureStore.
- **Home Screen:** Featured stories, genre filtering, and recently added stories.
- **Explore Screen:** Genre grid and search functionality.
- **Reader Screen:** Three themes (Light, Sepia, Dark), font size control, and reading progress tracking.
- **Bookmarks:** Save stories and resume reading from the last position.
- **Profile:** Reading history, stats (stories read, day streak), and logout.
- **Admin Panel:** Upload, edit, and delete stories (Role-based access).

## 🛠️ Setup Guide

### 1. Prerequisites
- Node.js & npm
- PostgreSQL database
- Cloudinary account

### 2. Backend Setup
1. Navigate to `apps/backend`.
2. Create a `.env` file based on `.env.example`.
3. Install dependencies: `npm install`.
4. Push database schema: `npx prisma db push`.
5. Start server: `npm run dev`.

### 3. Mobile Setup
1. Navigate to `apps/mobile`.
2. Install dependencies: `npm install`.
3. Start Expo: `npm start`.

### 4. Seed Data
To pre-load sample stories, run from the root:
```bash
npm run db:seed
```

## 📦 Deliverables
- Fully functional Expo project with 6+ screens.
- Complete Express.js backend with JWT and Prisma.
- Seed data with 5+ stories.
- Cloudinary integration for image uploads.

## 🏗️ Building for Production
To build the APK via Expo EAS:
```bash
eas build -p android
```
