/**
 * Load env files the same way developers expect locally: `.env` then `.env.local`
 * (local overrides). Use in Node CLI scripts so they work even when not wrapped
 * in `dotenv-cli`, and so `.env.local` always wins for duplicate keys.
 */
const path = require("path");
const fs = require("fs");
const dotenv = require("dotenv");

/**
 * Last assignment wins (same as typical .env expectations). Ignores blank lines and # comments.
 * @param {string} filePath
 * @param {string} key
 * @returns {string | null}
 */
function readLastKeyFromEnvFile(filePath, key) {
  if (!fs.existsSync(filePath)) return null;
  const text = fs.readFileSync(filePath, "utf8");
  const lines = text.split(/\r?\n/);
  let last = null;
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`^\\s*${escaped}\\s*=\\s*(.*)$`);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const m = trimmed.match(re);
    if (!m) continue;
    let val = m[1].trim();
    const hash = val.indexOf(" #");
    if (hash !== -1) val = val.slice(0, hash).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    last = val.trim();
  }
  return last;
}

/**
 * After dotenv, force `SEED_CLERK_USER_ID` from the last line in `.env.local` on disk.
 * Avoids stale values from a duplicated key, shell env, or an unsaved editor buffer vs what Node reads.
 */
function applyLastSeedClerkUserIdFromEnvLocal() {
  const root = process.cwd();
  const localPath = path.join(root, ".env.local");
  const v = readLastKeyFromEnvFile(localPath, "SEED_CLERK_USER_ID");
  if (v == null || v === "") return null;
  let normalized = v;
  if (normalized.startsWith("\ufeff")) normalized = normalized.replace(/^\ufeff/, "").trim();
  process.env.SEED_CLERK_USER_ID = normalized;
  return normalized;
}

function loadEnvForCli() {
  const root = process.cwd();
  const envPath = path.join(root, ".env");
  const localPath = path.join(root, ".env.local");

  dotenv.config({ path: envPath });
  dotenv.config({ path: localPath, override: true });
}

/** @returns {{ envFile: string, localFile: string, cwd: string }} */
function describeEnvFiles() {
  const root = process.cwd();
  return {
    cwd: root,
    envFile: path.join(root, ".env"),
    localFile: path.join(root, ".env.local"),
  };
}

function envFileExists(p) {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}

module.exports = {
  loadEnvForCli,
  describeEnvFiles,
  envFileExists,
  readLastKeyFromEnvFile,
  applyLastSeedClerkUserIdFromEnvLocal,
};
