import { REST, Routes } from 'discord.js';
import { commands } from './commands.js';
import { config, requireConfig } from './config.js';

requireConfig(['discordToken', 'clientId', 'guildId']);

const rest = new REST({ version: '10' }).setToken(config.discordToken);

console.log(`Registering ${commands.length} commands...`);

await rest.put(
  Routes.applicationGuildCommands(config.clientId, config.guildId),
  { body: commands }
);

console.log('Slash commands registered.');
