const fs = require('fs');
const path = require('path');
const { getClanMembers } = require('./clash'); // si tu veux séparer l’API plus tard

async function scanAndSaveMapping(guild) {
  const players = await getClanMembers();
  const members = await guild.members.fetch();

  const filePath = path.join(__dirname, 'mapping.json');
  let existingMapping = {};
  try {
    const raw = fs.readFileSync(filePath);
    existingMapping = JSON.parse(raw);
  } catch (err) {
    console.warn('⚠️ Aucun mapping existant trouvé, un nouveau sera créé.');
  }

  const found = [];
  const notFound = [];

  for (const playerName of players) {
    const match = members.find(member => {
      const discordName = member.displayName.toLowerCase();
      const username = member.user.username.toLowerCase();
      const player = playerName.toLowerCase();
      return discordName.includes(player) || username.includes(player);
    });

    console.log(`🔍 ${playerName} → ${match ? match.displayName : '❌ Aucun match'}`);

    if (match) {
      existingMapping[playerName] = `<@${match.id}>`;
      found.push({ player: playerName, discord: match.displayName });
    } else {
      notFound.push(playerName);
    }
  }

  try {
    fs.writeFileSync(filePath, JSON.stringify(existingMapping, null, 2));
    console.log('✅ mapping.json mis à jour (fusionné)');
    return { found, notFound };
  } catch (err) {
    console.error('❌ Erreur écriture mapping.json:', err.message);
    return null;
  }
}

function loadMapping() {
  const filePath = path.join(__dirname, 'mapping.json');
  try {
    const raw = fs.readFileSync(filePath);
    return JSON.parse(raw);
  } catch (err) {
    console.warn('⚠️ mapping.json introuvable ou invalide.');
    return {};
  }
}

module.exports = {
  scanAndSaveMapping,
  loadMapping
};