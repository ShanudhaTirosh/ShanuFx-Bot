/**
 * handlers/messageCommandAdapter.js
 *
 * Lets every existing slash command (commands/**\/*.js, written only against
 * ChatInputCommandInteraction) also run as a text-prefix command (default
 * "."), e.g. ".ban @user spamming" alongside "/ban user:@user reason:spamming",
 * without touching a single command file.
 *
 * How: each command already declares its full option schema via
 * SlashCommandBuilder (command.data.toJSON()). This module tokenizes the
 * text after the prefix, walks that same schema to parse tokens into typed
 * values (users/roles/channels get resolved from mentions/IDs/names,
 * strings/integers/numbers/booleans get parsed, subcommands get matched),
 * then builds a small object that mimics the handful of
 * ChatInputCommandInteraction methods/properties this codebase actually
 * uses (verified against every command + handler file — see the
 * interaction.* property list in docs/PREFIX_COMMANDS.md). Command files
 * call interaction.reply/editReply/deferReply/options.getX exactly as
 * before; they have no idea whether they were invoked via / or ..
 *
 * Not attempted: autocomplete, attachments-as-options beyond "first
 * attachment on the message", and true ephemeral replies (Discord has no
 * ephemeral concept for normal messages — those replies just post
 * normally, which is the correct behavior for a text command anyway).
 */

const {
  PermissionsBitField,
  ChannelType,
  EmbedBuilder,
} = require('discord.js');

// Slash command option type IDs (discord-api-types ApplicationCommandOptionType)
const T = {
  SUB_COMMAND: 1,
  SUB_COMMAND_GROUP: 2,
  STRING: 3,
  INTEGER: 4,
  BOOLEAN: 5,
  USER: 6,
  CHANNEL: 7,
  ROLE: 8,
  MENTIONABLE: 9,
  NUMBER: 10,
  ATTACHMENT: 11,
};

class UsageError extends Error {}

// ─── Tokenizer ──────────────────────────────────────────────────────────────
// Supports "quoted phrases" / 'quoted phrases' as single tokens, otherwise
// splits on whitespace.
function tokenize(str) {
  const tokens = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let m;
  while ((m = re.exec(str)) !== null) {
    tokens.push(m[1] ?? m[2] ?? m[3]);
  }
  return tokens;
}

// ─── Entity resolvers ───────────────────────────────────────────────────────
async function resolveUser(message, token) {
  if (!token) return null;
  const idMatch = token.match(/^<@!?(\d+)>$/) || token.match(/^(\d{15,25})$/);
  if (idMatch) {
    const id = idMatch[1];
    const cached = message.client.users.cache.get(id);
    if (cached) return cached;
    try { return await message.client.users.fetch(id); } catch { return null; }
  }
  if (!message.guild) return null;
  await message.guild.members.fetch().catch(() => {}); // best-effort warm cache for name lookups
  const lower = token.toLowerCase().replace(/^@/, '');
  const found = message.guild.members.cache.find(
    (mem) =>
      mem.user.username.toLowerCase() === lower ||
      mem.user.tag.toLowerCase() === lower ||
      mem.displayName.toLowerCase() === lower,
  );
  return found?.user ?? null;
}

function resolveChannel(message, token) {
  if (!token || !message.guild) return null;
  const idMatch = token.match(/^<#(\d+)>$/) || token.match(/^(\d{15,25})$/);
  const id = idMatch ? idMatch[1] : null;
  if (id) return message.guild.channels.cache.get(id) ?? null;
  const lower = token.toLowerCase().replace(/^#/, '');
  return message.guild.channels.cache.find((c) => c.name?.toLowerCase() === lower) ?? null;
}

function resolveRole(message, token) {
  if (!token || !message.guild) return null;
  const idMatch = token.match(/^<@&(\d+)>$/) || token.match(/^(\d{15,25})$/);
  const id = idMatch ? idMatch[1] : null;
  if (id) return message.guild.roles.cache.get(id) ?? null;
  const lower = token.toLowerCase();
  return message.guild.roles.cache.find((r) => r.name.toLowerCase() === lower) ?? null;
}

// Tries to parse a single token as the given option def's type. Returns
// `undefined` (not `null`) if the token does NOT match, so callers can
// distinguish "matched, and the value is falsy" from "didn't match at all".
async function tryParseToken(message, def, token) {
  if (token === undefined) return undefined;
  switch (def.type) {
    case T.INTEGER: {
      const n = parseInt(token, 10);
      return Number.isNaN(n) ? undefined : { value: n };
    }
    case T.NUMBER: {
      const n = parseFloat(token);
      return Number.isNaN(n) ? undefined : { value: n };
    }
    case T.BOOLEAN: {
      const t = token.toLowerCase();
      if (['true', 'yes', 'on', 'y', '1'].includes(t)) return { value: true };
      if (['false', 'no', 'off', 'n', '0'].includes(t)) return { value: false };
      return undefined;
    }
    case T.USER:
    case T.MENTIONABLE: {
      const user = await resolveUser(message, token);
      return user ? { value: user, member: message.guild?.members.cache.get(user.id) ?? null } : undefined;
    }
    case T.CHANNEL: {
      const channel = resolveChannel(message, token);
      return channel ? { value: channel } : undefined;
    }
    case T.ROLE: {
      const role = resolveRole(message, token);
      return role ? { value: role } : undefined;
    }
    default:
      return undefined;
  }
}

// ─── Option-schema walker ───────────────────────────────────────────────────
/**
 * @returns {Promise<{ values: object, members: object, subcommand: string|null, subcommandGroup: string|null }>}
 */
async function parseArgs(message, tokens, optionDefs = []) {
  let idx = 0;
  let defs = optionDefs;
  let subcommand = null;
  let subcommandGroup = null;

  while (defs.length && (defs[0].type === T.SUB_COMMAND_GROUP || defs[0].type === T.SUB_COMMAND)) {
    if (idx >= tokens.length) {
      const names = defs.map((d) => d.name).join(' | ');
      throw new UsageError(`Missing subcommand — choose one of: ${names}`);
    }
    const name = tokens[idx].toLowerCase();
    const match = defs.find((d) => d.name === name);
    if (!match) {
      const names = defs.map((d) => d.name).join(' | ');
      throw new UsageError(`Unknown subcommand "${tokens[idx]}" — choose one of: ${names}`);
    }
    idx++;
    if (match.type === T.SUB_COMMAND_GROUP) {
      subcommandGroup = match.name;
      defs = match.options || [];
    } else {
      subcommand = match.name;
      defs = match.options || [];
      break;
    }
  }

  const values = {};
  const members = {};
  // Work on a mutable window [cursor, end) over the remaining tokens.
  let remaining = tokens.slice(idx);
  let cursor = 0;
  let end = remaining.length;

  const lastStringDefIndex = (() => {
    for (let i = defs.length - 1; i >= 0; i--) if (defs[i].type === T.STRING) return i;
    return -1;
  })();

  for (let i = 0; i < defs.length; i++) {
    const def = defs[i];

    if (def.type === T.ATTACHMENT) {
      const att = message.attachments.first() ?? null;
      if (!att && def.required) throw new UsageError('This command needs a file attached.');
      values[def.name] = att;
      continue;
    }

    if (def.type === T.STRING && i === lastStringDefIndex) {
      // Greedy: this string claims everything to the end of the window —
      // but first peel off trailing tokens (right-to-left) for any *later*
      // options in the schema that actually parse as their type, so a
      // pattern like "user reason days" (e.g. .ban) still finds a trailing
      // number for `days` even though `reason` comes before it.
      for (let j = defs.length - 1; j > i; j--) {
        if (end <= cursor) break;
        const laterDef = defs[j];
        if (laterDef.type === T.ATTACHMENT) continue; // handled separately, not positional
        // eslint-disable-next-line no-await-in-loop
        const parsed = await tryParseToken(message, laterDef, remaining[end - 1]);
        if (parsed === undefined) break; // doesn't match — stop peeling from the end
        values[laterDef.name] = parsed.value;
        if (parsed.member !== undefined) members[laterDef.name] = parsed.member;
        end--;
      }

      const strTokens = remaining.slice(cursor, end);
      if (strTokens.length > 0) {
        values[def.name] = strTokens.join(' ');
      } else if (def.required) {
        throw new UsageError(`Missing required option: \`${def.name}\``);
      }
      cursor = end;
      continue;
    }

    if (cursor >= end) {
      if (def.required) throw new UsageError(`Missing required option: \`${def.name}\``);
      continue;
    }

    const token = remaining[cursor];
    if (def.type === T.STRING) {
      values[def.name] = token;
      cursor++;
      continue;
    }

    // eslint-disable-next-line no-await-in-loop
    const parsed = await tryParseToken(message, def, token);
    if (parsed === undefined) {
      if (def.required) {
        const label = def.type === T.USER || def.type === T.MENTIONABLE ? 'a user matching'
          : def.type === T.CHANNEL ? 'a channel matching'
          : def.type === T.ROLE ? 'a role matching'
          : def.type === T.INTEGER || def.type === T.NUMBER ? 'a number, got'
          : def.type === T.BOOLEAN ? 'true/false, got'
          : 'a valid value for';
        throw new UsageError(`\`${def.name}\` expects ${label} \`${token}\`.`);
      }
      // Optional and didn't match this token — leave unset, don't consume
      // the token (it might belong to a later option), matching how a
      // human would expect "skip an optional arg" to work only when it's
      // unambiguous; for simplicity here we still consume it, since
      // positional prefix-command parsing without named flags can't fully
      // disambiguate "skipped" vs "wrong" anyway.
      cursor++;
      continue;
    }
    values[def.name] = parsed.value;
    if (parsed.member !== undefined) members[def.name] = parsed.member;
    cursor++;
  }

  return { values, members, subcommand, subcommandGroup };
}

// ─── Fake ChatInputCommandInteraction ───────────────────────────────────────
function buildAdapter(message, command, parsed) {
  const { values, members, subcommand, subcommandGroup } = parsed;

  let repliedMessage = null;
  let deferred = false;
  let replied = false;

  const options = {
    getString: (name) => (name in values ? values[name] : null),
    getInteger: (name) => (name in values ? values[name] : null),
    getNumber: (name) => (name in values ? values[name] : null),
    getBoolean: (name) => (name in values ? values[name] : null),
    getUser: (name) => (name in values ? values[name] : null),
    getMember: (name) => members[name] ?? null,
    getChannel: (name) => (name in values ? values[name] : null),
    getRole: (name) => (name in values ? values[name] : null),
    getMentionable: (name) => (name in values ? values[name] : null),
    getAttachment: (name) => (name in values ? values[name] : null),
    getSubcommand: (required = true) => {
      if (!subcommand && required) throw new UsageError('This command needs a subcommand.');
      return subcommand;
    },
    getSubcommandGroup: () => subcommandGroup,
  };

  function normalizePayload(payload) {
    // Slash replies use `ephemeral`; plain messages have no such concept —
    // just drop the flag and send normally. Everything else (embeds,
    // content, components, files) maps 1:1 onto Message#reply / #edit.
    if (typeof payload === 'string') return { content: payload };
    const { ephemeral, flags, ...rest } = payload || {};
    return rest;
  }

  const adapter = {
    isChatInputCommand: () => true,
    isCommand: () => true,
    commandName: command.data.name,
    options,
    client: message.client,
    guild: message.guild,
    guildId: message.guild?.id ?? null,
    channel: message.channel,
    channelId: message.channel.id,
    user: message.author,
    member: message.member,
    memberPermissions: message.member?.permissions ?? new PermissionsBitField(),

    async reply(payload) {
      const sent = await message.reply({ ...normalizePayload(payload), allowedMentions: { repliedUser: false } });
      repliedMessage = sent;
      replied = true;
      return sent;
    },
    async deferReply(payload) {
      const sent = await message.reply({
        ...(payload?.content || payload?.embeds ? normalizePayload(payload) : { content: '⏳ Working on it…' }),
        allowedMentions: { repliedUser: false },
      });
      repliedMessage = sent;
      deferred = true;
      return sent;
    },
    async editReply(payload) {
      if (repliedMessage) {
        try {
          return await repliedMessage.edit(normalizePayload(payload));
        } catch {
          // Original reply got deleted — fall back to a fresh message.
        }
      }
      const sent = await message.channel.send(normalizePayload(payload));
      repliedMessage = sent;
      replied = true;
      return sent;
    },
    async followUp(payload) {
      const sent = await message.channel.send(normalizePayload(payload));
      return sent;
    },
    async fetchReply() {
      return repliedMessage;
    },
    async deleteReply() {
      if (repliedMessage) await repliedMessage.delete().catch(() => {});
    },
    get replied() { return replied; },
    get deferred() { return deferred; },
  };

  return adapter;
}

module.exports = { tokenize, parseArgs, buildAdapter, UsageError, resolveChannel, resolveRole };
