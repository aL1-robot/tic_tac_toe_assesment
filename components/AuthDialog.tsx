"use client";

import { useState, type FormEvent } from "react";
import { authErrorMessage, syntheticEmail, USERNAME_PATTERN, usernameAvailable } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/client";
import { Dialog } from "./Dialog";

type AuthDialogProps = {
  onClose: () => void;
  onSuccess: () => void;
};

type Step = "username" | "signin" | "signup";

export function AuthDialog({ onClose, onSuccess }: AuthDialogProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [step, setStep] = useState<Step>("username");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function checkUsername(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = username.trim().toLowerCase();
    if (!USERNAME_PATTERN.test(normalized)) {
      setMessage("Username must be 3–16 letters, numbers, - or _.");
      return;
    }

    setBusy(true);
    setMessage("");
    try {
      const available = await usernameAvailable(normalized);
      setUsername(normalized);
      setStep(available ? "signup" : "signin");
    } catch (error) {
      console.error("Could not check username availability.", error);
      setMessage(
        error instanceof Error
          ? authErrorMessage(error.message)
          : "Couldn’t reach the account service. Check your connection and try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function submitPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password.length < 6) {
      setMessage("Password must be at least 6 characters.");
      return;
    }

    setBusy(true);
    setMessage("");
    try {
      const supabase = createClient();
      const email = syntheticEmail(username);
      if (step === "signup") {
        const available = await usernameAvailable(username);
        if (!available) {
          setStep("signin");
          setMessage("That username is already taken. Try signing in instead.");
          return;
        }
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { username } },
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
      <h2 id="auth-title">Sign in</h2>
      {step === "username" ? (
        <form onSubmit={checkUsername}>
          <p>Enter your username. New names can create an account.</p>
          <label className="field-label" htmlFor="account-username">Username</label>
          <input
            id="account-username"
            autoComplete="username"
            maxLength={16}
            autoCapitalize="none"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            required
          />
          {message && <p className="msg" role="alert">{message}</p>}
          <div className="row">
            <button className="b" type="submit" disabled={busy}>
              {busy ? "Checking…" : "Continue"}
            </button>
            <button className="b alt" type="button" onClick={onClose}>Close</button>
          </div>
        </form>
      ) : (
        <form onSubmit={submitPassword}>
          <p>
            {step === "signup" ? `Create an account as ${username}.` : `Welcome back, ${username}.`}
          </p>
          <label className="field-label" htmlFor="account-password">Password</label>
          <input
            id="account-password"
            type="password"
            minLength={6}
            autoComplete={step === "signup" ? "new-password" : "current-password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            autoFocus
          />
          {message && <p className="msg" role="alert">{message}</p>}
          <div className="row">
            <button className="b" type="submit" disabled={busy}>
              {busy ? "Please wait…" : step === "signup" ? "Create account" : "Sign in"}
            </button>
            <button
              className="b alt"
              type="button"
              disabled={busy}
              onClick={() => {
                setStep("username");
                setPassword("");
                setMessage("");
              }}
            >
              Change name
            </button>
          </div>
        </form>
      )}
    </Dialog>
  );
}
