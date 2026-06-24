import { EmbedBuilder } from 'discord.js';
import { config } from './config.js';

function optionValueToString(option) {
  if (option.user) return `${option.user.tag ?? option.user.username} (${option.user.id})`;
  if (option.member) return `<@${option.value}>`;
  if (option.value === undefined || option.value === null) return 'None';
  return String(option.value);
}

export function formatCommandOptions(interaction) {
  const options = interaction.options?.data ?? [];
  if (!options.length) return 'None';

  return options
    .map((option) => `${option.name}: ${optionValueToString(option)}`)
    .join('\n')
    .slice(0, 1000);
}

export async function sendAuditLog(client, { title, description, fields = [], color = 0x2f80ed }) {
  if (!config.auditLogChannelId) return;

  try {
    const channel = await client.channels.fetch(config.auditLogChannelId).catch(() => null);
    if (!channel?.isTextBased()) return;

    const embed = new EmbedBuilder()
      .setTitle(title)
      .setColor(color)
      .setTimestamp();

    if (description?.trim()) embed.setDescription(description.slice(0, 4000));

    const cleanFields = fields
      .filter((field) => field?.name && field?.value !== undefined && field?.value !== null)
      .map((field) => ({
        name: String(field.name).slice(0, 256),
        value: String(field.value).slice(0, 1024) || 'None',
        inline: Boolean(field.inline)
      }))
      .slice(0, 25);

    if (cleanFields.length) embed.addFields(cleanFields);

    await channel.send({ embeds: [embed] });
  } catch (error) {
    console.error('Failed to send audit log:', error);
  }
}
