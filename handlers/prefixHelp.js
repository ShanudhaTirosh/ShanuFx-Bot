/**
 * handlers/prefixHelp.js
 * Turns a command's SlashCommandBuilder schema into a plain-text usage
 * string for prefix-command error messages and .help output, e.g.
 * "ban <user> [reason] [days]" or "warnsettings <set|status|disable> ...".
 */

function formatOptionList(options = []) {
  return options
    .map((opt) => (opt.required ? `<${opt.name}>` : `[${opt.name}]`))
    .join(' ');
}

/**
 * @param {{ data: import('discord.js').SlashCommandBuilder }} command
 * @param {string} prefix
 * @returns {string}
 */
function formatUsage(command, prefix = '.') {
  const json = command.data.toJSON();
  const subcommands = (json.options ?? []).filter((o) => o.type === 1 || o.type === 2);

  if (subcommands.length > 0) {
    const names = subcommands.map((s) => s.name).join('|');
    return `${prefix}${json.name} <${names}> ...`;
  }

  const argStr = formatOptionList(json.options ?? []);
  return `${prefix}${json.name}${argStr ? ` ${argStr}` : ''}`;
}

module.exports = { formatUsage };
