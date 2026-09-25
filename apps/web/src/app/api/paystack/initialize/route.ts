import { NextRequest, NextResponse } from "next/server";

/**
 * Server-only: initialize a Paystack transaction for Nest Plus.
 * Requires PAYSTACK_SECRET_KEY in env (never expose to the browser).
 */
export async function POST(req: NextRequest) {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) {
    return NextResponse.json(
      { error: "Paystack is not configured (PAYSTACK_SECRET_KEY)" },
      { status: 503 }
    );
  }

  let body: { email?: string; plan?: string; callback_url?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = body.email?.trim();
  if (!email) {
    return NextResponse.json({ error: "email is required" }, { status: 400 });
  }

  // Amount in smallest currency unit (kobo for NGN, cents for USD, etc.)
  const amount = Number(
    process.env.NEST_PLUS_AMOUNT || process.env.PAYSTACK_NEST_PLUS_AMOUNT || "1000000"
  );
  const currency = (process.env.NEST_PLUS_CURRENCY || "NGN").toUpperCase();

  const reference = `nestplus_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

  const payload: Record<string, unknown> = {
    email,
    amount,
    currency,
    reference,
    metadata: {
      product: "nest_plus",
      plan: body.plan || "monthly",
    },
  };

  if (body.callback_url) {
    payload.callback_url = body.callback_url;
  }

  const res = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok || !data.status) {
    return NextResponse.json(
      {
        error: data.message || "Paystack initialize failed",
        detail: data,
      },
      { status: res.status >= 400 ? res.status : 502 }
    );
  }

  return NextResponse.json({
    authorization_url: data.data?.authorization_url,
    access_code: data.data?.access_code,
    reference: data.data?.reference || reference,
    amount,
    currency,
  });
}
