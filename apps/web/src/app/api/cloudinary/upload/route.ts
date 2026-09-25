import { NextRequest, NextResponse } from "next/server";

/**
 * Server-side Cloudinary upload (multipart).
 * Env: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
 * Optional: CLOUDINARY_UPLOAD_FOLDER=storynest/covers
 */
export async function POST(req: NextRequest) {
  const cloud = process.env.CLOUDINARY_CLOUD_NAME;
  const key = process.env.CLOUDINARY_API_KEY;
  const secret = process.env.CLOUDINARY_API_SECRET;

  if (!cloud || !key || !secret) {
    return NextResponse.json(
      {
        error:
          "Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET.",
      },
      { status: 503 }
    );
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }

  const folder = process.env.CLOUDINARY_UPLOAD_FOLDER || "storynest/covers";
  const timestamp = Math.floor(Date.now() / 1000);

  // Signature: folder=…&timestamp=… + API secret (sorted params)
  const toSign = `folder=${folder}&timestamp=${timestamp}${secret}`;
  const signature = await sha1(toSign);

  const upload = new FormData();
  upload.append("file", file);
  upload.append("api_key", key);
  upload.append("timestamp", String(timestamp));
  upload.append("folder", folder);
  upload.append("signature", signature);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/image/upload`, {
    method: "POST",
    body: upload,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return NextResponse.json(
      { error: data.error?.message || data.message || "Cloudinary upload failed", detail: data },
      { status: res.status >= 400 ? res.status : 502 }
    );
  }

  return NextResponse.json({
    url: data.secure_url || data.url,
    public_id: data.public_id,
    width: data.width,
    height: data.height,
  });
}

async function sha1(message: string): Promise<string> {
  const enc = new TextEncoder().encode(message);
  const buf = await crypto.subtle.digest("SHA-1", enc);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
