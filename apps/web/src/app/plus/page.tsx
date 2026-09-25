"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { api, hasToken, type MeUser } from "@/lib/api";

declare global {
  interface Window {
    PaystackPop?: {
      setup: (opts: {
        key: string;
        email: string;
        amount: number;
        currency?: string;
        ref: string;
        callback: (response: { reference: string }) => void;
        onClose: () => void;
      }) => { openIframe: () => void };
    };
  }
}

const PERKS = [
  "Ad-free reading experience",
  "Unlimited offline downloads",
  "Exclusive high-fidelity audio stories",
  "Priority access to new chapters",
  "Special Elite badge on profile",
];

function loadPaystackScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") return reject(new Error("No window"));
    if (window.PaystackPop) return resolve();
    const s = document.createElement("script");
    s.src = "https://js.paystack.co/v1/inline.js";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load Paystack"));
    document.body.appendChild(s);
  });
}

export default function PlusPage() {
  const [user, setUser] = useState<MeUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    const ok = hasToken();
    setAuthed(ok);
    if (!ok) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const me = await api.me();
        if (!cancelled) setUser(me);
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Could not load account");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Handle return from Paystack redirect (?reference=...)
  useEffect(() => {
    if (typeof window === "undefined" || !hasToken()) return;
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("reference") || params.get("trxref");
    if (!ref) return;

    let cancelled = false;
    (async () => {
      setBusy(true);
      setError("");
      try {
        const token = localStorage.getItem("sn_access_token");
        const res = await fetch("/api/paystack/verify", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ reference: ref }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Verification failed");
        if (!cancelled) {
          if (data.activated) {
            setSuccess("Nest Plus is active. Welcome to the elite.");
            const me = await api.me().catch(() => null);
            if (me) setUser(me);
          } else {
            setSuccess(
              `Payment received (${data.reference}). ${data.activateError || "Premium activation pending — refresh or contact support."}`
            );
          }
          window.history.replaceState({}, "", "/plus");
        }
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Could not verify payment");
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function startCheckout() {
    if (!user?.email) {
      setError("Your account needs an email to pay with Paystack.");
      return;
    }
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const origin = window.location.origin;
      const initRes = await fetch("/api/paystack/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: user.email,
          plan: "monthly",
          callback_url: `${origin}/plus`,
        }),
      });
      const init = await initRes.json();
      if (!initRes.ok) throw new Error(init.error || "Could not start payment");

      const publicKey = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY;
      if (publicKey) {
        await loadPaystackScript();
        if (!window.PaystackPop) throw new Error("Paystack popup unavailable");

        const handler = window.PaystackPop.setup({
          key: publicKey,
          email: user.email,
          amount: init.amount,
          currency: init.currency || "NGN",
          ref: init.reference,
          callback: (response) => {
            void (async () => {
              try {
                const token = localStorage.getItem("sn_access_token");
                const vRes = await fetch("/api/paystack/verify", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                  },
                  body: JSON.stringify({ reference: response.reference }),
                });
                const data = await vRes.json();
                if (!vRes.ok) throw new Error(data.error || "Verification failed");
                if (data.activated) {
                  setSuccess("Nest Plus is active. Welcome to the elite.");
                  const me = await api.me().catch(() => null);
                  if (me) setUser(me);
                } else {
                  setSuccess(
                    `Payment received. ${data.activateError || "Activation pending."}`
                  );
                }
              } catch (err) {
                setError(err instanceof Error ? err.message : "Verify failed");
              } finally {
                setBusy(false);
              }
            })();
          },
          onClose: () => setBusy(false),
        });
        handler.openIframe();
      } else if (init.authorization_url) {
        window.location.href = init.authorization_url;
      } else {
        throw new Error("No Paystack authorization URL or public key");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed");
      setBusy(false);
    }
  }

  if (!authed) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center space-y-4">
        <h1 className="text-2xl font-semibold text-primary">Nest Plus</h1>
        <p className="text-muted-foreground text-sm">Sign in to upgrade with Paystack.</p>
        <Link href="/login" className={cn(buttonVariants())}>
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight text-primary mb-2">Nest Plus</h1>
      <p className="text-muted-foreground text-sm mb-8">
        Unlock the full nest — secure checkout powered by Paystack.
      </p>

      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {error && (
        <p className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </p>
      )}
      {success && (
        <p className="mb-4 text-sm text-primary bg-primary/5 border border-primary/20 rounded-md px-3 py-2">
          {success}
        </p>
      )}

      <Card className="overflow-hidden border-primary/20">
        <div className="bg-primary px-6 py-8 text-primary-foreground">
          <p className="text-xs uppercase tracking-[0.2em] text-accent">Nest Plus</p>
          <p className="mt-2 text-3xl font-semibold text-white">Elite membership</p>
          <p className="mt-1 text-sm text-white/80">
            Billed monthly · amount set by NEST_PLUS_AMOUNT (Paystack subunits)
          </p>
          {user?.isPremium && (
            <span className="mt-4 inline-block rounded-full bg-accent px-3 py-1 text-xs font-semibold text-primary">
              ACTIVE
            </span>
          )}
        </div>
        <CardHeader>
          <CardTitle>What you get</CardTitle>
          <CardDescription>Same benefits as the mobile Nest Marketplace.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <ul className="space-y-3">
            {PERKS.map((p) => (
              <li key={p} className="flex gap-2 text-sm">
                <span className="text-primary">✓</span>
                <span>{p}</span>
              </li>
            ))}
          </ul>

          {user?.isPremium ? (
            <p className="text-sm text-muted-foreground text-center">
              You already have Nest Plus. Enjoy the nest.
            </p>
          ) : (
            <Button
              type="button"
              className="w-full"
              size="lg"
              disabled={busy || loading}
              onClick={startCheckout}
            >
              {busy ? "Processing…" : "Join the Elite · Pay with Paystack"}
            </Button>
          )}
        </CardContent>
      </Card>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        Payments are processed by Paystack. StoryNest never stores your card details.
      </p>
    </div>
  );
}
