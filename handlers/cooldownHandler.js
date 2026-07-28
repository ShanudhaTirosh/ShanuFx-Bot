/**
 * handlers/cooldownHandler.js
 * Per-user, per-command cooldowns — prevents a moderator (or anyone,
 * accidentally or otherwise) from hammering commands like /purge, /ban,
 * or /warn faster than makes sense. This is intentionally about abuse/
 * misuse protection, not permission control — Discord's own permission
 * checks still gate who can run what.
 *
 * A command opts into a custom cooldown via `module.exports.cooldown = <seconds>`.
 * Unset falls back to DEFAULT_COOLDOWN.
 */

const DEFAULT_COOLDOWN = 3; // seconds

// Map<commandName, Map<userId, expiryTimestampMs>>
const cooldowns = new Map();

// Periodic sweep so this doesn't grow forever across many users/commands.
setInterval(() => {
  const now = Date.now();
  for (const [commandName, userMap] of cooldowns) {
    for (const [userId, expiry] of userMap) {
      if (expiry <= now) userMap.delete(userId);
    }
    if (userMap.size === 0) cooldowns.delete(commandName);
  }
}, 5 * 60 * 1000).unref();

/**
 * Checks whether a user is currently on cooldown for a command.
 * If not, starts a new cooldown window for them.
 *
 * Cooldowns are scoped per-guild (when a guildId is available) as well as
 * per-user/per-command. Previously this was keyed only by command name +
 * user id, so running e.g. /purge in one server would block that same
 * user from running /purge in a *different* server for the cooldown
 * window, even though the two usages have nothing to do with each other.
 * DM-context commands (no guildId) fall back to a global 'dm' scope.
 *
 * @returns {{ onCooldown: boolean, remainingMs: number }}
 */
function checkAndStart(command, userId, guildId) {
  const seconds = command.cooldown ?? DEFAULT_COOLDOWN;
  const name = `${guildId ?? 'dm'}:${command.data.name}`;
  const now = Date.now();

  if (!cooldowns.has(name)) cooldowns.set(name, new Map());
  const userMap = cooldowns.get(name);

  const expiry = userMap.get(userId);
  if (expiry && expiry > now) {
    return { onCooldown: true, remainingMs: expiry - now };
  }

  userMap.set(userId, now + seconds * 1000);
  return { onCooldown: false, remainingMs: 0 };
}

module.exports = { checkAndStart, DEFAULT_COOLDOWN };
