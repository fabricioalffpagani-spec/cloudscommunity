/**
 * Shared file-based database helpers for auth routes.
 * Uses a JSON file as a simple persistence layer for dev/demo purposes.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export type User = {
  id: string;
  email: string;
  password: string;
  name: string;
  username: string;
  bio: string;
  birthDate: string;    // "YYYY-MM-DD"
  region: string;
  gender: string;
  verified: boolean;
  createdAt: string;
};

export type PendingVerification = {
  email: string;
  code: string;
  expiresAt: string;  // ISO string
  /** Full profile payload waiting to be committed once code is verified */
  payload: Omit<User, "id" | "createdAt" | "verified">;
};

export type DbShape = {
  users: User[];
  pending_verifications: PendingVerification[];
};

export const DB_FILE = path.join(
  process.cwd(),
  "app",
  "api",
  "auth",
  "_db.json"
);

export async function readDb(): Promise<DbShape> {
  try {
    const raw = await fs.readFile(DB_FILE, "utf-8");
    const parsed = JSON.parse(raw) as DbShape;
    if (!parsed?.users) return { users: [], pending_verifications: [] };
    if (!parsed.pending_verifications) parsed.pending_verifications = [];
    return parsed;
  } catch {
    return { users: [], pending_verifications: [] };
  }
}

export async function writeDb(db: DbShape): Promise<void> {
  const dir = path.dirname(DB_FILE);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(DB_FILE, JSON.stringify(db, null, 2), "utf-8");
}

/** Generates a random 6-digit numeric string */
export function generateOtp(): string {
  return String(crypto.randomInt(100000, 999999));
}

/** Returns a Date 15 minutes from now */
export function otpExpiry(): Date {
  const d = new Date();
  d.setMinutes(d.getMinutes() + 15);
  return d;
}
