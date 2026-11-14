import { createClient } from "./client";

export const USERNAME_PATTERN = /^[a-z0-9_-]{3,16}$/;

export function syntheticEmail(username: string): string {
  const domain = process.env.NEXT_PUBLIC_ACCOUNT_EMAIL_DOMAIN?.trim().replace(/^@/, "").toLowerCase();
  if (!domain) throw new Error("Set NEXT_PUBLIC_ACCOUNT_EMAIL_DOMAIN to use accounts.");
  return `${username.toLowerCase()}@${domain}`;
}

export async function usernameAvailable(username: string): Promise<boolean> {
  const { data, error } = await createClient().rpc("username_available", {
    p_username: username,
  });
  if (error) throw error;
  return data;
}

export function authErrorMessage(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("supabase") && lower.includes("config")) {
    return "Accounts are unavailable until Supabase is configured.";
  }
  if (lower.includes("invalid login credentials")) return "That password doesn’t match this username.";
  if (lower.includes("already registered") || lower.includes("already been registered")) {
    return "That username is already taken. Try signing in instead.";
  }
  if (lower.includes("password") && lower.includes("length")) {
    return "Password must be at least 6 characters.";
  }
  if (lower.includes("fetch") || lower.includes("network") || lower.includes("timeout")) {
    return "Couldn’t reach the account service. Check your connection and try again.";
  }
  return "Couldn’t complete that request. Please try again.";
}
