import { NextRequest, NextResponse } from "next/server";

/**
 * Server-only: verify Paystack payment, then activate Nest Plus on the Express API
 * via POST /monetization/subscribe (same path mobile uses) using the caller's JWT.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) {
    return NextResponse.json(
      { error: "Paystack is not configured (PAYSTACK_SECRET_KEY)" },
      { status: 503 }
    );
  }

  let body: { reference?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const reference = body.reference?.trim();
  if (!reference) {
    return NextResponse.json({ error: "reference is required" }, { status: 400 });
  }

  const verifyRes = await fetch(
    `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
    {
      headers: { Authorization: `Bearer ${secret}` },
    }
  );

  const verifyData = await verifyRes.json().catch(() => ({}));

  if (!verifyRes.ok || !verifyData.status) {
    return NextResponse.json(
      { error: verifyData.message || "Verification failed", detail: verifyData },
      { status: verifyRes.status >= 400 ? verifyRes.status : 502 }
    );
  }

  const tx = verifyData.data;
  if (tx?.status !== "success") {
    return NextResponse.json(
      { error: "Payment not successful", status: tx?.status },
      { status: 402 }
    );
  }

  // Activate premium on backend if user JWT is present
  const authHeader = req.headers.get("authorization");
  const apiUrl =
    process.env.API_URL?.replace(/\/$/, "") ||
    process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ||
    "http://localhost:5000";

  let activated = false;
  let activateError: string | null = null;

  if (authHeader) {
    try {
      const actRes = await fetch(`${apiUrl}/monetization/subscribe`, {
        method: "POST",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          provider: "paystack",
          reference,
          amount: tx.amount,
          currency: tx.currency,
        }),
      });
      if (actRes.ok) {
        activated = true;
      } else {
        const errBody = await actRes.json().catch(() => ({}));
        activateError =
          (errBody as { error?: string; message?: string }).error ||
          (errBody as { message?: string }).message ||
          `Backend returned ${actRes.status}`;
      }
    } catch (e) {
      activateError = e instanceof Error ? e.message : "Activation request failed";
    }
  } else {
    activateError = "No auth token — payment verified but premium not activated on account";
  }

  return NextResponse.json({
    ok: true,
    reference,
    amount: tx.amount,
    currency: tx.currency,
    paid_at: tx.paid_at,
    activated,
    activateError,
  });
}
