const express = require("express");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const cookieParser = require("cookie-parser");
const bcrypt = require("bcryptjs");

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, "data");
const DB_FILE = path.join(DATA_DIR, "db.json");
const SESSION_COOKIE = "sid";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

fs.mkdirSync(DATA_DIR, { recursive: true });

function readDB() {
  try {
    const raw = fs.readFileSync(DB_FILE, "utf8");
    return JSON.parse(raw);
  } catch (_) {
    return { users: [], sessions: [] };
  }
}

function writeDB(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), "utf8");
}

const db = readDB();

function save() {
  writeDB(db);
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function publicUser(user) {
  return user
    ? {
        email: user.email,
        passwordChangeRequired: !!user.requirePasswordChange,
      }
    : null;
}

function findUserByEmail(email) {
  const emailNorm = normalizeEmail(email);
  return db.users.find((u) => u.email === emailNorm) || null;
}

function createSession(userId) {
  const token = crypto.randomBytes(24).toString("hex");
  const expiresAt = Date.now() + SESSION_TTL_MS;
  db.sessions.push({ token, userId, expiresAt });
  save();
  return { token, expiresAt };
}

function pruneSessions() {
  const now = Date.now();
  db.sessions = db.sessions.filter((s) => s.expiresAt > now);
}

function getSessionUser(token) {
  if (!token) return null;
  pruneSessions();
  const session = db.sessions.find((s) => s.token === token);
  if (!session) return null;
  if (session.expiresAt <= Date.now()) return null;
  return db.users.find((u) => u.id === session.userId) || null;
}

function deleteSession(token) {
  if (!token) return;
  db.sessions = db.sessions.filter((s) => s.token !== token);
  save();
}

function revokeUserSessions(userId) {
  db.sessions = db.sessions.filter((s) => s.userId !== userId);
}

function setSessionCookie(res, token) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    maxAge: SESSION_TTL_MS,
  });
}

function generateId(prefix) {
  return `${prefix}-${crypto.randomBytes(8).toString("hex")}`;
}

function sendTempPassword(email, tempPassword) {
  // Replace this with a real mailer when SMTP is available.
  console.log(`Password reset for ${email}: temporary password is "${tempPassword}"`);
}

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "Not signed in." });
  next();
}

app.use(express.json());
app.use(cookieParser());

// Attach session user if present
app.use((req, _res, next) => {
  const token = req.cookies[SESSION_COOKIE];
  const user = getSessionUser(token);
  if (user) {
    req.user = user;
    req.sessionToken = token;
  } else {
    req.user = null;
    req.sessionToken = null;
  }
  next();
});

// Serve the static frontend
app.use(express.static(path.join(__dirname, "..")));

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, users: db.users.length });
});

app.get("/api/session", (req, res) => {
  res.json({ user: publicUser(req.user) });
});

app.post("/api/signup", async (req, res) => {
  const { email, password } = req.body || {};
  const emailNorm = normalizeEmail(email);
  if (!emailNorm || typeof password !== "string" || password.length < 8) {
    return res.status(400).json({ error: "Email and password (min 8 chars) are required." });
  }
  if (findUserByEmail(emailNorm)) {
    return res.status(400).json({ error: "An account with that email already exists." });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = {
    id: generateId("u"),
    email: emailNorm,
    passwordHash,
    tempPasswordHash: null,
    requirePasswordChange: false,
    orders: [],
    createdAt: new Date().toISOString(),
  };
  db.users.push(user);
  const session = createSession(user.id);
  setSessionCookie(res, session.token);
  save();
  res.json({ user: publicUser(user), message: "Account created and signed in." });
});

app.post("/api/login", async (req, res) => {
  const { email, password } = req.body || {};
  const emailNorm = normalizeEmail(email);
  if (!emailNorm || typeof password !== "string") {
    return res.status(400).json({ error: "Email and password are required." });
  }
  const user = findUserByEmail(emailNorm);
  if (!user) return res.status(400).json({ error: "Account not found." });

  const isPrimary = user.passwordHash ? await bcrypt.compare(password, user.passwordHash) : false;
  const isTemp = user.tempPasswordHash ? await bcrypt.compare(password, user.tempPasswordHash) : false;

  if (!isPrimary && !isTemp) {
    return res.status(400).json({ error: "Incorrect password." });
  }

  if (isTemp) {
    user.requirePasswordChange = true;
  }

  const session = createSession(user.id);
  setSessionCookie(res, session.token);
  save();
  res.json({
    user: publicUser(user),
    message: user.requirePasswordChange
      ? "Temporary password accepted. Update your password to continue."
      : "Signed in.",
  });
});

app.post("/api/logout", (req, res) => {
  if (req.sessionToken) deleteSession(req.sessionToken);
  res.clearCookie(SESSION_COOKIE);
  res.json({ message: "Signed out." });
});

app.post("/api/password/reset", async (req, res) => {
  const { email } = req.body || {};
  const emailNorm = normalizeEmail(email);
  if (!emailNorm) return res.status(400).json({ error: "Email is required." });
  const user = findUserByEmail(emailNorm);
  if (!user) return res.status(400).json({ error: "No account found for that email." });

  const tempPassword = crypto.randomBytes(8).toString("base64url").slice(0, 12);
  user.tempPasswordHash = await bcrypt.hash(tempPassword, 10);
  user.passwordHash = null;
  user.requirePasswordChange = true;
  revokeUserSessions(user.id);
  save();

  sendTempPassword(emailNorm, tempPassword);
  res.json({
    message: "Temporary password created. Check your email for instructions.",
    // Demo only: expose temp password for environments without email
    demoTempPassword: tempPassword,
  });
});

app.post("/api/password/update", requireAuth, async (req, res) => {
  const { newPassword } = req.body || {};
  if (!newPassword || newPassword.length < 8) {
    return res.status(400).json({ error: "New password must be at least 8 characters." });
  }
  req.user.passwordHash = await bcrypt.hash(newPassword, 10);
  req.user.tempPasswordHash = null;
  req.user.requirePasswordChange = false;
  save();
  res.json({ user: publicUser(req.user), message: "Password updated." });
});

app.get("/api/orders", requireAuth, (req, res) => {
  const orders = Array.isArray(req.user.orders) ? req.user.orders : [];
  res.json({ orders });
});

app.post("/api/orders", requireAuth, (req, res) => {
  const order = req.body?.order;
  if (!order || typeof order !== "object") {
    return res.status(400).json({ error: "Order payload is required." });
  }
  const newOrder = {
    id: order.id || generateId("ord"),
    createdAt: new Date().toISOString(),
    kind: order.kind || "custom",
    title: order.title || "Order",
    qty: Number(order.qty || order.quantity || 0),
    total: order.total != null ? Number(order.total) : null,
    summary: order.summary || order.detail || "",
    config: order.config || null,
  };
  req.user.orders = Array.isArray(req.user.orders) ? req.user.orders : [];
  req.user.orders.unshift(newOrder);
  req.user.orders = req.user.orders.slice(0, 50);
  save();
  res.json({ order: newOrder, message: "Order saved." });
});

// Fallback to index for any non-API route (optional)
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) return next();
  res.sendFile(path.join(__dirname, "..", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
