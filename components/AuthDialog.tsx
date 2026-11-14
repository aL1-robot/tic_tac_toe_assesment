"use client";

import { useEffect, useState, type FormEvent } from "react";
import { authErrorMessage, syntheticEmail, USERNAME_PATTERN, usernameAvailable } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/client";
import { Dialog } from "./Dialog";

type AuthDialogProps = {
  onClose: () => void;
  onSuccess: () => void;
};

type Step = "signin" | "signup";
type UsernameStatus = "idle" | "checking" | "available" | "taken" | "error";

export function AuthDialog({ onClose, onSuccess }: AuthDialogProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [step, setStep] = useState<Step | null>(null);
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>("idle");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const normalized = username.trim().toLowerCase();
    if (!USERNAME_PATTERN.test(normalized)) {
      setUsernameStatus("idle");
      return;
    }

    let active = true;
    setUsernameStatus("checking");
    const timeout = window.setTimeout(async () => {
      try {
        const available = await usernameAvailable(normalized);
        if (active) setUsernameStatus(available ? "available" : "taken");
      } catch (error) {
        console.error("Could not check username availability.", error);
        if (active) setUsernameStatus("error");
      }
    }, 350);

    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [username]);

  async function submitCredentials(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = username.trim().toLowerCase();
    if (!USERNAME_PATTERN.test(normalized)) {
      setMessage("Username must be 3–16 letters, numbers, - or _.");
      return;
    }
    if (password.length < 6) {
      setMessage("Password must be at least 6 characters.");
      return;
    }

    setBusy(true);
    setMessage("");
    setUsername(normalized);
    try {
      const supabase = createClient();
      const available = await usernameAvailable(normalized);
      const nextStep: Step = available ? "signup" : "signin";
      setStep(nextStep);
      const email = syntheticEmail(normalized);
      if (nextStep === "signup") {
        const stillAvailable = await usernameAvailable(normalized);
        if (!stillAvailable) {
          setStep("signin");
          setMessage("That username is already taken. Try signing in instead.");
          return;
        }
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { username: normalized } },
        });
        if (error) throw error;
        if (!data.session) {
          setMessage("Account created. Email confirmation must be turned off in Supabase Auth.");
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      onSuccess();
    } catch (error) {
      console.error("Account sign-in or sign-up failed.", error);
      setMessage(
        error instanceof Error
          ? authErrorMessage(error.message)
          : "Couldn’t reach the account service. Check your connection and try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog labelledBy="auth-title" onClose={onClose} className="card-left">
      <h2 id="auth-title">Sign in or create an account</h2>
      <form onSubmit={submitCredentials}>
        <p>Enter your username and password. New usernames create an account.</p>
        <label className="field-label" htmlFor="account-username">Username</label>
        <input
          id="account-username"
          autoComplete="username"
          maxLength={16}
          autoCapitalize="none"
          value={username}
          onChange={(event) => {
            setUsername(event.target.value);
            setStep(null);
            setUsernameStatus("idle");
            setMessage("");
          }}
          required
        />
        {usernameStatus !== "idle" && (
          <p
            className={`username-status ${usernameStatus}`}
            role="status"
            aria-live="polite"
          >
            {usernameStatus === "checking" && "Checking username…"}
            {usernameStatus === "available" && (
              <>
                <span className="username-check" aria-hidden="true">✓</span> Username available
              </>
            )}
            {usernameStatus === "taken" && "✕ Username taken — you can sign in"}
            {usernameStatus === "error" && "Couldn’t check username availability. You can still try signing in."}
          </p>
        )}
        <label className="field-label" htmlFor="account-password">Password</label>
        <input
          id="account-password"
          type="password"
          minLength={6}
          autoComplete={step === "signup" ? "new-password" : "current-password"}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
        {message && <p className="msg" role="alert">{message}</p>}
        <div className="row">
          <button className="b" type="submit" disabled={busy}>
            {busy
              ? "Please wait…"
              : step === "signup"
                ? "Create account"
                : step === "signin"
                  ? "Sign in"
                  : usernameStatus === "available"
                    ? "Create account"
                    : usernameStatus === "taken"
                      ? "Sign in"
                  : "Sign in or create account"}
          </button>
          <button className="b alt" type="button" onClick={onClose}>Close</button>
        </div>
      </form>
    </Dialog>
  );
}
