"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api, pickAccessToken, setTokens } from "@/lib/api";

type Step = "email" | "otp" | "account";

export default function SignupPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [dob, setDob] = useState("");
  const [otp, setOtp] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  async function sendOtp(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");
    setLoading(true);
    try {
      if (!dob) throw new Error("Date of birth is required");
      const dobIso = new Date(dob + "T12:00:00").toISOString();
      await api.otpInitiate({ email: email.trim(), dob: dobIso });
      setInfo("Check your email for a verification code.");
      setStep("otp");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send code");
    } finally {
      setLoading(false);
    }
  }

  async function checkOtp(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");
    setLoading(true);
    try {
      await api.otpVerify({ email: email.trim(), otp: otp.trim() });
      setInfo("Email verified. Choose a username and password.");
      setStep("account");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid code");
    } finally {
      setLoading(false);
    }
  }

  async function finish(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");
    setLoading(true);
    try {
      const dobIso = dob ? new Date(dob + "T12:00:00").toISOString() : undefined;
      // Mobile sends firebaseUid; web registers without Firebase when not configured.
      const data = await api.register({
        email: email.trim(),
        password,
        username: username.trim(),
        dob: dobIso,
        firebaseUid: `web_${Date.now()}`,
      });
      const access = pickAccessToken(data);
      if (access) setTokens(access, data.refreshToken);
      router.push("/explore");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signup failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-md flex-col justify-center px-4 py-16">
      <Card>
        <CardHeader className="text-center">
          <CardTitle>Join the Nest</CardTitle>
          <CardDescription>
            {step === "email" && "We verify your email with a one-time code (same as the app)."}
            {step === "otp" && "Enter the code we sent to your inbox."}
            {step === "account" && "Pick a username and password."}
          </CardDescription>
          <p className="text-xs text-muted-foreground pt-2">
            Step {step === "email" ? "1" : step === "otp" ? "2" : "3"} of 3
          </p>
        </CardHeader>
        <CardContent>
          {error && (
            <p className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {error}
            </p>
          )}
          {info && (
            <p className="mb-4 text-sm text-primary bg-primary/5 border border-primary/20 rounded-md px-3 py-2">
              {info}
            </p>
          )}

          {step === "email" && (
            <form onSubmit={sendOtp} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="email">
                  Email
                </label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="dob">
                  Date of birth
                </label>
                <Input
                  id="dob"
                  type="date"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  required
                  max={new Date().toISOString().slice(0, 10)}
                />
                <p className="text-xs text-muted-foreground">Required for age-appropriate content.</p>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Sending…" : "Send verification code"}
              </Button>
            </form>
          )}

          {step === "otp" && (
            <form onSubmit={checkOtp} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="otp">
                  Verification code
                </label>
                <Input
                  id="otp"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  required
                  placeholder="6-digit code"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Verifying…" : "Verify code"}
              </Button>
              <button
                type="button"
                className="w-full text-sm text-muted-foreground hover:text-foreground"
                onClick={() => {
                  setStep("email");
                  setOtp("");
                  setError("");
                  setInfo("");
                }}
              >
                ← Change email
              </button>
            </form>
          )}

          {step === "account" && (
            <form onSubmit={finish} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="username">
                  Username
                </label>
                <Input
                  id="username"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  minLength={2}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="password">
                  Password
                </label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Creating…" : "Create account"}
              </Button>
            </form>
          )}

          <p className="mt-4 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="text-primary underline-offset-4 hover:underline">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
