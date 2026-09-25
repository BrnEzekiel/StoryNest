# StoryNest AI Memory

**Repo:** https://github.com/BrnEzekiel/StoryNest  
**Updated:** 2026-09-25

## Studio writing tools
- **TipTap** chapter editor (`RichTextEditor`) — bold/italic/H2/list/quote; saves **plain text** paragraphs for mobile reader compatibility
- **Cloudinary** `POST /api/cloudinary/upload` + `CoverUpload` on new/edit story
- Env on web: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`

## After pull
```bash
cd apps/web && npm install && npm run dev
```

## Still open
- Production CORS + Vercel deploy checklist
- Optional Firebase Auth on web
