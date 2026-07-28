/**
 * web/routes/auth.js
 * GET /auth/login    — redirect to Discord's OAuth2 consent screen
 * GET /auth/callback — exchange code, create session, redirect to dashboard
 * GET /auth/logout   — destroy session
 */

const express = require('express');
const crypto = require('crypto');
const { exchangeCode, getCurrentUser, getManageableGuilds } = require('../discordApi');
const { createSession, destroySession } = require('../sessionStore');
const { COOKIE_NAME } = require('../middleware/auth');
const { redact } = require('../../utils/validateEnv');

const router = express.Router();

const isProd = process.env.NODE_ENV === 'production';
const cookieOpts = {
  httpOnly: true,
  signed: true,
  secure: isProd,
  sameSite: 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

router.get('/login', (req, res) => {
  // CSRF protection for the OAuth flow via the `state` param.
  const state = crypto.randomBytes(16).toString('hex');
  res.cookie('oauth_state', state, { httpOnly: true, signed: true, secure: isProd, sameSite: 'lax', maxAge: 5 * 60 * 1000 });

  const params = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID,
    redirect_uri: process.env.DISCORD_REDIRECT_URI,
    response_type: 'code',
    scope: 'identify guilds',
    state,
  });

  res.redirect(`https://discord.com/oauth2/authorize?${params.toString()}`);
});

router.get('/callback', async (req, res) => {
  const { code, state } = req.query;
  const expectedState = req.signedCookies?.oauth_state;
  res.clearCookie('oauth_state');

  if (!code || !state || state !== expectedState) {
    return res.status(400).send('Login failed: invalid or expired OAuth state. Please try logging in again.');
  }

  try {
    const tokens = await exchangeCode(code);
    const [user, guilds] = await Promise.all([
      getCurrentUser(tokens.access_token),
      getManageableGuilds(tokens.access_token),
    ]);

    const sessionId = createSession({
      userId: user.id,
      username: `${user.username}${user.discriminator && user.discriminator !== '0' ? `#${user.discriminator}` : ''}`,
      avatar: user.avatar
        ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${user.avatar.startsWith('a_') ? 'gif' : 'png'}`
        : null,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      guilds,
    });

    res.cookie(COOKIE_NAME, sessionId, cookieOpts);
    res.redirect('/dashboard.html');
  } catch (err) {
    console.error('[Auth] OAuth callback failed:', redact(err?.message ?? String(err)));
    res.status(500).send('Login failed while talking to Discord. Please try again in a moment.');
  }
});

router.get('/logout', (req, res) => {
  const sessionId = req.signedCookies?.[COOKIE_NAME];
  if (sessionId) destroySession(sessionId);
  res.clearCookie(COOKIE_NAME);
  res.redirect('/');
});

module.exports = router;
