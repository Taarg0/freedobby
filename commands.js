const { scanAndSaveMapping, loadMapping } = require('./mapping');
const { getClanMembers } = require('./clash');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

function handleCommands(message) {
  const content = message.content.trim();

  // !scanmapping
  if (content === '!scanmapping') {
    return handleScanMapping(message);
  }

  // !link Nom1,Nom2,@DiscordUser
  if (content.startsWith('!link ')) {
    return handleLink(message);
  }

   // !rappel
  if (content === '!rappel') {
    return handleRappel(message);
  }

  // !check
  if (content === '!check') {
    return handleCheck(message);
  }
}

async function handleScanMapping(message) {
  const results = await scanAndSaveMapping(message.guild);
  if (!results) return message.reply('❌ Échec lors de la mise à jour du mapping.');

  loadMapping();
  const { found, notFound } = results;

  if (found.length > 0) {
    const table = found.map(r => `| ${r.player.padEnd(20)} | ${r.discord.padEnd(20)} |`).join('\n');
    const header = `| Nom Clash Royale       | Pseudo Discord         |\n|------------------------|------------------------|`;
    const chunk = `🔍 Mapping mis à jour automatiquement.\n\n\`\`\`\n${header}\n${table}\n\`\`\``;
    await message.reply(chunk);
  } else {
    await message.reply('⚠️ Aucun lien trouvé entre les noms Clash Royale et les pseudos Discord.');
  }

  if (notFound.length > 0) {
    const list = notFound.map(name => `🔸 ${name}`).join('\n');
    const suggestions = notFound.map(name => `// !link ${name} @DiscordUser`).join('\n');
    const chunk = `⚠️ Joueurs non trouvés sur Discord :\n${list}\n\n💡 Suggestions pour les lier manuellement :\n\`\`\`\n${suggestions}\n\`\`\``;
    await message.reply(chunk);
  }
}

function handleLink(message) {
  const raw = message.content.slice(6).trim();
  const lastComma = raw.lastIndexOf(',');
  if (lastComma === -1) return message.reply('❌ Format invalide. Utilise `!link Nom1,Nom2,@DiscordUser`');

  const namesPart = raw.slice(0, lastComma);
  const mentionPart = raw.slice(lastComma + 1).trim();

  if (!mentionPart.startsWith('<@') || !mentionPart.endsWith('>')) {
    return message.reply('❌ Format invalide. Le dernier élément doit être une mention Discord (`@DiscordUser`)');
  }

  const playerNames = namesPart.split(',').map(n => n.trim()).filter(n => n.length > 0);
  if (playerNames.length === 0) return message.reply('❌ Aucun nom de joueur fourni.');

  const filePath = path.join(__dirname, 'mapping.json');
  let mapping = {};
  try {
    const raw = fs.readFileSync(filePath);
    mapping = JSON.parse(raw);
  } catch (err) {
    console.warn('⚠️ Aucun mapping existant, un nouveau sera créé.');
  }

  for (const name of playerNames) {
    mapping[name] = mentionPart;
  }

  try {
    fs.writeFileSync(filePath, JSON.stringify(mapping, null, 2));
    loadMapping();
    message.reply(`✅ Liens ajoutés : ${playerNames.join(', ')} → ${mentionPart}`);
  } catch (err) {
    message.reply('❌ Erreur lors de la mise à jour du mapping.');
  }
}

// Placeholder pour !rappel et !check
function handleRappel(message) {
  message.reply('📣 Rappel envoyé (fonction à compléter).');
}

function handleCheck(message) {
  message.reply('📊 État de guerre affiché (fonction à compléter).');
}

module.exports = {
  handleCommands
};