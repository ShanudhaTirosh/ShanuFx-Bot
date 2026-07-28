/**
 * web/server.js
 * Entry point for the dashboard process. Runs completely independently
 * from the bot process (index.js) — they only share the SQLite DB file.
 * Start with: node web/server.js  (or `npm run dashboard`)
 */

require('dotenv').config();
const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { validateEnv, redact } = require('../utils/validateEnv');

validateEnv(
  ['DISCORD_CLIENT_ID', 'DISCORD_CLIENT_SECRET', 'DISCORD_REDIRECT_URI', 'SESSION_SECRET'],
  { label: 'Dashboard', minLength: { SESSION_SECRET: 32 } },
);

const { attachSession, requireAuth } = require('./middleware/auth');
const authRoutes = require('./routes/auth');
const apiRoutes = require('./routes/api');

const app = express();
const PORT = process.env.DASHBOARD_PORT || 3000;

// Reverse proxies (Nginx/Caddy/most PaaS hosts) sit in front of this in
// production — trust the X-Forwarded-* headers they set so rate limiting
// keys on the real client IP instead of the proxy's.
app.set('trust proxy', 1);

// ── Security headers ────────────────────────────────────────────────────────
// Default helmet CSP would block this app's inline <script>/<style> tags
// and the Google Fonts import in style.css — tuned here instead of turned
// off, so we keep clickjacking/MIME-sniffing protection etc. without
// breaking the pages.
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'https://cdn.discordapp.com'],
      connectSrc: ["'self'"],
      frameAncestors: ["'none'"], // extra belt-and-braces on top of X-Frame-Options
    },
  },
}));

// ── Rate limiting ────────────────────────────────────────────────────────────
// Global floor: even routes with no specific limiter (static assets,
// /health, /invite) get a generous cap so a single client can't hammer the
// process. Auth/API get tighter, purpose-specific limits below.
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
});

// Login/OAuth endpoints: tight limit — these hit Discord's own token
// endpoint on our behalf, so abuse here isn't just noise, it risks our
// application's own Discord API rate limit.
const authLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please wait a few minutes and try again.' },
});

// API endpoints: generous enough for normal dashboard use (a guild page
// does a handful of calls on load) while still capping scraping/abuse.
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down.' },
});

app.use(globalLimiter);

// Explicit body size cap — express.json() defaults to 100kb already, but
// setting it explicitly documents the intent and protects against a future
// change to that default silently loosening it. Nothing this app sends
// should ever approach this (the largest payload is a guild config object).
app.use(express.json({ limit: '64kb' }));
app.use(cookieParser(process.env.SESSION_SECRET));
app.use(attachSession);

// ── CSRF defense-in-depth ────────────────────────────────────────────────────
// SameSite=Lax cookies (set in routes/auth.js) already stop the browser
// from attaching the session cookie to cross-site state-changing requests,
// which is the primary CSRF defense here. This is a second, independent
// check: state-changing API requests must also carry an Origin (or
// Referer, as a fallback for clients that omit Origin) matching this
// server's own host. Belt-and-braces in case a browser's SameSite handling
// is ever weaker than expected.
function requireSameOrigin(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();

  const origin = req.get('origin') || req.get('referer');
  if (!origin) {
    return res.status(403).json({ error: 'Missing Origin/Referer header on a state-changing request.' });
  }

  let originHost;
  try {
    originHost = new URL(origin).host;
  } catch {
    return res.status(403).json({ error: 'Malformed Origin/Referer header.' });
  }

  if (originHost !== req.get('host')) {
    return res.status(403).json({ error: 'Cross-origin request blocked.' });
  }
  next();
}

// ── Public bot-invite link builder ──────────────────────────────────────────
// Centralizes the invite URL so it's defined once and reused by the
// landing page's "Add to Server" button.
app.get('/invite', (req, res) => {
  const params = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID,
    permissions: process.env.BOT_INVITE_PERMISSIONS || '1099780064326',
    scope: 'bot applications.commands',
  });
  res.redirect(`https://discord.com/oauth2/authorize?${params.toString()}`);
});

app.get('/health', (req, res) => res.json({ ok: true }));

app.use('/auth', authLimiter, authRoutes);
app.use('/api', apiLimiter, requireAuth, requireSameOrigin, apiRoutes);

// These two must be registered BEFORE express.static — otherwise the static
// middleware would serve public/dashboard.html and public/guild.html
// directly off disk and requireAuth would never run.
app.get('/dashboard.html', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});
app.get('/guild.html', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'guild.html'));
});

// ── Static frontend (landing page, shared css/js, etc.) ─────────────────────
app.use(express.static(path.join(__dirname, 'public')));

app.use((req, res) => res.status(404).send('Not found'));

app.listen(PORT, () => {
  console.log(`[Dashboard] Listening on http://localhost:${PORT}`);
});
