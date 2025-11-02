const { scanAndSaveMapping, loadMapping } = require('./mapping');
const fs = require('fs');
const path = require('path');
const { getIncompletePlayers } = require('./clash');

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

  const mapping = loadMapping(); 
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

const { getWarStatus } = require('./clash');

async function handleRappel(message) {
  const today = new Date();
  const day = today.getDay();
  const allowedDays = [0, 1, 5, 6]; // dimanche, lundi, vendredi, samedi

  if (!allowedDays.includes(day)) {
    console.log(`⏳ Rappel ignoré — jour non autorisé (${day})`);
    return;
  }

  const mapping = loadMapping();
  const warStatus = await getWarStatus();

  if (!warStatus || warStatus.length === 0) {
    return message.reply('⚠️ Impossible de récupérer les données de guerre. L’API Clash Royale semble indisponible pour le moment.');
  }

  const incomplete = warStatus.filter(p => p.status === '❌');

  if (incomplete.length === 0) {
    return message.reply('✅ Tous les joueurs ont terminé leurs attaques.');
  }

  const mentions = incomplete.map(p => {
    const mention = mapping[p.name] || p.name;
    return `${mention} (${p.battlesPlayed}/${p.numberOfBattles})`;
  });

  const msg = `📣 Rappel manuel — les joueurs suivants doivent encore attaquer :\n🔸 ${mentions.join('\n🔸 ')}`;
  message.reply(msg);
}

async function handleCheck(message) {
  const today = new Date();
  const day = today.getDay();
  const allowedDays = [0, 1, 5, 6]; // dimanche, lundi, vendredi, samedi

  if (!allowedDays.includes(day)) {
    return message.reply(`⏳ Pas de guerre aujourd’hui (jour ${day}) — vérification désactivée.`);
  }

  const mapping = loadMapping();
  const warStatus = await getWarStatus();

  if (!warStatus || warStatus.length === 0) {
    return message.reply('⚠️ Impossible de récupérer les données de guerre. L’API Clash Royale semble indisponible pour le moment.');
  }

  const table = warStatus.map(p => {
    const discord = mapping[p.name] || p.name;
    return `| ${p.name.padEnd(20)} | ${discord.padEnd(20)} | ${String(p.battlesPlayed).padEnd(2)}/${p.numberOfBattles} | ${p.status} |`;
  }).join('\n');

  const header = `| Nom Clash Royale       | Pseudo Discord         | Attaques | Statut |\n|------------------------|------------------------|----------|--------|`;
  const chunk = `📊 État de guerre actuel :\n\`\`\`\n${header}\n${table}\n\`\`\``;
  message.reply(chunk);
}

module.exports = {
  handleCommands
};