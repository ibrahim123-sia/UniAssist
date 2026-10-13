// Bootstrap (or recover) a UniAssist administrator account.
//
//   npm run create-admin -- --email <email> [--name "<name>"] [--password <pw>] [--reset-password]
//
// Connects with MONGODB_URI (server/.env, unless it's already set in the
// environment) and creates a verified admin. Without --password a strong
// random password is generated and printed ONCE. An existing email is left
// alone unless --reset-password is given, which makes that user an admin with
// the new password (older sessions are signed out). Admins don't need a MAJU
// student email. Never prints the connection string.
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import User, { EMAIL_REGEX } from "../models/User.js";
import Department from "../models/Department.js";

const SERVER_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// dotenv never overrides variables that are already set.
dotenv.config({ path: path.join(SERVER_DIR, ".env"), quiet: true });

const USAGE =
  'Usage: npm run create-admin -- --email <email> [--name "<name>"] [--password <password>] [--reset-password]';
const MIN_PASSWORD = 8;
const DEFAULT_NAME = "Administrator";

class CliError extends Error {}

function parseArgs(argv) {
  const opts = { resetPassword: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const [flag, inline] = arg.startsWith("--") && arg.includes("=") ? [arg.slice(0, arg.indexOf("=")), arg.slice(arg.indexOf("=") + 1)] : [arg, undefined];
    const value = () => {
      if (inline !== undefined) return inline;
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) throw new CliError(`${flag} needs a value`);
      i++;
      return next;
    };
    if (flag === "--email") opts.email = value();
    else if (flag === "--name") opts.name = value();
    else if (flag === "--password") opts.password = value();
    else if (flag === "--reset-password") opts.resetPassword = true;
    else if (flag === "--help" || flag === "-h") opts.help = true;
    else throw new CliError(`Unknown option: ${arg}`);
  }
  return opts;
}

// Strong random password: 16 chars from an unambiguous set, with at least one
// upper, lower, digit and symbol.
function generatePassword(length = 16) {
  const sets = ["ABCDEFGHJKLMNPQRSTUVWXYZ", "abcdefghjkmnpqrstuvwxyz", "23456789", "!@#$%^&*-_=+"];
  const all = sets.join("");
  const chars = sets.map((set) => set[crypto.randomInt(set.length)]);
  while (chars.length < length) chars.push(all[crypto.randomInt(all.length)]);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

// Driver errors can embed the connection string — never echo it.
const safe = (message) =>
  String(message || "unknown error")
    .replace(/mongodb(\+srv)?:\/\/\S+/gi, "[connection string]")
    .slice(0, 300);

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log(USAGE);
    return 0;
  }

  const email = typeof opts.email === "string" ? opts.email.trim().toLowerCase() : "";
  if (!email) throw new CliError(`--email is required.\n${USAGE}`);
  if (!EMAIL_REGEX.test(email) || email.length > 254) throw new CliError(`Invalid email address: ${email}`);

  const name = (opts.name ?? DEFAULT_NAME).trim();
  if (name.length < 2 || name.length > 80) throw new CliError("Name must be between 2 and 80 characters");

  if (opts.password !== undefined && opts.password.length < MIN_PASSWORD) {
    throw new CliError(`Password must be at least ${MIN_PASSWORD} characters`);
  }

  if (!process.env.MONGODB_URI) throw new CliError("MONGODB_URI is not set (server/.env)");

  try {
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
  } catch (error) {
    throw new CliError(`Could not connect to the database: ${safe(error.message)}`);
  }

  const existing = await User.findOne({ email });
  if (existing && !opts.resetPassword) {
    throw new CliError(
      `A user with email ${email} already exists (role: ${existing.role}). ` +
        "Re-run with --reset-password to make it an admin and set a new password."
    );
  }

  const generated = opts.password === undefined;
  const password = generated ? generatePassword() : opts.password;
  const hashed = await bcrypt.hash(password, 10);

  if (existing) {
    existing.role = "admin";
    existing.password = hashed;
    existing.passwordChangedAt = new Date();
    existing.isVerified = true;
    existing.isBlocked = false;
    existing.loginAttempts = 0;
    existing.accountLockedUntil = null;
    if (opts.name !== undefined) existing.name = name;
    await existing.save();
    // An admin can't stay a department head (heads must be staff).
    await Department.updateMany({ head: existing._id }, { $set: { head: null } });
    console.log(`Updated ${email}: role admin, new password set (older sessions are signed out).`);
  } else {
    await User.create({ name, email, password: hashed, role: "admin", isVerified: true });
    console.log(`Created admin ${email} (${name}).`);
  }

  if (generated) {
    console.log("");
    console.log(`  Password: ${password}`);
    console.log("");
    console.log("This password is shown only once — store it safely and change it after logging in.");
  }
  return 0;
}

let code = 0;
try {
  code = await main();
} catch (error) {
  console.error(error instanceof CliError ? error.message : `create-admin failed: ${safe(error.message)}`);
  code = 1;
} finally {
  await mongoose.disconnect().catch(() => {});
}
process.exit(code);
