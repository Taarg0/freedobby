require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits } = require('discord.js');
const cron = require('node-cron');

const API_KEY = process.env.CLASH_API_KEY;
const CLAN_TAG = process.env.CLAN_TAG;
const token = process.env.DISCORD_TOKEN;

let playerToDiscord = {};

function loadMapping() {
  const filePath = path.join(__dirname, 'mapping.json');
  try {
    const raw = fs.readFileSync(filePath);
    playerToDiscord = JSON.parse(raw);
    console.log('🔄 Mapping chargé depuis mapping.json');
  } catch (err) {
    console.error('❌ Erreur chargement mapping.json:', err.message);
    playerToDiscord = {};
  }
}

async function getClanMembers() {
  console.log('📡 Appel API Clash Royale lancé...');
  try {
    console.log('CLAN_TAG brut:', CLAN_TAG);
    console.log('URL encodée:', `https://api.clashroyale.com/v1/clans/${encodeURIComponent(CLAN_TAG)}`);
    const url = `https://api.clashroyale.com/v1/clans/${encodeURIComponent(CLAN_TAG)}`;
    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${API_KEY}`
      }
    });

    const members = response.data?.memberList || [];
    return members.map(m => m.name);
  } catch (error) {
    console.error('❌ Erreur API Clash Royale:', error.response?.data || error.message);
    return [];
  }
}


async function scanAndSaveMapping(guild) {
  const players = await getClanMembers();
  const members = await guild.members.fetch();

  // Charger l'ancien mapping
  const filePath = path.join(__dirname, 'mapping.json');
  let existingMapping = {};
  try {
    const raw = fs.readFileSync(filePath);
    existingMapping = JSON.parse(raw);
  } catch (err) {
    console.warn('⚠️ Aucun mapping existant trouvé, un nouveau sera créé.');
  }

  const found = [];

  for (const playerName of players) {
    const match = members.find(member =>
      member.displayName.toLowerCase().includes(playerName.toLowerCase()) ||
      member.user.username.toLowerCase().includes(playerName.toLowerCase())
    );

    if (match) {
      existingMapping[playerName] = `<@${match.id}>`;
      found.push(`🔸 ${playerName} → ${match.displayName}`);
    }
  }

  try {
    fs.writeFileSync(filePath, JSON.stringify(existingMapping, null, 2));
    console.log('✅ mapping.json mis à jour (fusionné)');
    return found;
  } catch (err) {
    console.error('❌ Erreur écriture mapping.json:', err.message);
    return null;
  }
}


async function getIncompletePlayers() {
  console.log('📡 Appel API Clash Royale lancé...');
  try {
    const url = `https://api.clashroyale.com/v1/clans/${encodeURIComponent(CLAN_TAG)}/warlog`;
    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${API_KEY}`
      }
    });

    const warData = response.data?.items?.[0];
    if (!warData || !warData.participants) return [];

    const incomplete = warData.participants.filter(p => p.battlesPlayed < p.numberOfBattles);
    return incomplete.map(p => p.name);
  } catch (error) {
    console.error('❌ Erreur API Clash Royale:', error.response?.data || error.message);
    return [];
  }
}


const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

let scheduledTask = null;
let reminderTime = '10:00'; // Heure par défaut
const channelId = '1281916311252893750'; // ID du salon Discord

function scheduleReminder(time) {
  if (scheduledTask) scheduledTask.stop();

  const [hour, minute] = time.split(':');
  const cronExpression = `${minute} ${hour} * * *`;
  console.log(`🕒 Rappel programmé à ${time} (${cronExpression})`);

  scheduledTask = cron.schedule(cronExpression, async () => {
    const today = new Date();
    const day = today.getDay(); // 0 = dimanche, 1 = lundi, ..., 6 = samedi
    const allowedDays = {
      0: 'dimanche',
      1: 'lundi',
      5: 'vendredi',
      6: 'samedi'
    };

    if (!(day in allowedDays)) {
      console.log(`⏳ Rappel ignoré — jour non autorisé (${day})`);
      return;
    }

    console.log(`📤 Rappel autorisé — aujourd’hui c’est ${allowedDays[day]} (${day})`);
    const channel = client.channels.cache.get(channelId);
    if (!channel) return console.error('❌ Salon introuvable');

    const players = await getIncompletePlayers();
    const mentions = players.map(name => playerToDiscord[name] || name);
    const message = mentions.length > 0
      ? `📣 Rappel automatique — les joueurs suivants doivent encore attaquer :\n🔸 ${mentions.join('\n🔸 ')}`
      : `✅ Tous les joueurs ont terminé leurs attaques. GG !`;

    channel.send(message);
  });
}

client.once('clientReady', () => {
  reminderTime = '10:00'; // Réinitialisation explicite
  getClanMembers().then(names => {
    console.log('👥 Membres du clan :', names);
  });

  loadMapping(); // Chargement du mapping
  const now = new Date().toLocaleString('fr-FR');
  console.log(`✅ Connecté(e) en tant que ${client.user.tag} — ${now}`);
  scheduleReminder(reminderTime);
});

client.on('messageCreate', async message => {
  if (message.content.startsWith('!rappel')) {
    const args = message.content.split(' ');
    const isValidTime = /^\d{2}:\d{2}$/.test(args[1]) &&
                        Number(args[1].split(':')[0]) < 24 &&
                        Number(args[1].split(':')[1]) < 60;

    if (args.length === 2 && isValidTime) {
      reminderTime = args[1];
      scheduleReminder(reminderTime);
      message.reply(`⏰ Rappel mis à jour pour ${reminderTime} chaque jour.`);
    } else {
      message.reply('❌ Format invalide. Utilise `!rappel HH:MM` (ex: `!rappel 19:30`)');
    }
  }

  if (message.content === '!scanmapping') {
    const results = await scanAndSaveMapping(message.guild);
    if (results) {
      loadMapping();
      const preview = results.length > 0
        ? results.join('\n')
        : '⚠️ Aucun lien trouvé entre les noms Clash Royale et les pseudos Discord.';
      message.reply(`🔍 Mapping mis à jour automatiquement.\n\n${preview}`);
    } else {
      message.reply('❌ Échec lors de la mise à jour du mapping.');
    }
  }

  if (message.content === '!check') {
    getIncompletePlayers().then(players => {
      if (players.length > 0) {
        const mentions = players.map(name => playerToDiscord[name] || name);
        message.reply(`🔍 Joueurs en retard :\n🔸 ${mentions.join('\n🔸 ')}`);
      } else {
        message.reply('✅ Tous les joueurs ont attaqué. Rien à signaler.');
      }
    });
  }

  if (message.content.startsWith('!mapping ')) {
    const args = message.content.split(' ');
    const playerName = args[1];
    if (!playerName) {
      message.reply('❌ Utilise `!mapping NomClashRoyale`');
      return;
    }

    const mention = playerToDiscord[playerName];
    if (mention) {
      message.reply(`🔗 ${playerName} est lié à ${mention}`);
    } else {
      message.reply(`❌ Aucun lien trouvé pour **${playerName}** dans le mapping.`);
    }
  }

  if (message.content.startsWith('!link ')) {
    const args = message.content.split(' ');
    if (args.length !== 3 || !args[2].startsWith('<@') || !args[2].endsWith('>')) {
      message.reply('❌ Format invalide. Utilise `!link NomClashRoyale @DiscordUser`');
      return;
    }

    const playerName = args[1];
    const discordMention = args[2];

    const filePath = path.join(__dirname, 'mapping.json');
    let mapping = {};
    try {
      const raw = fs.readFileSync(filePath);
      mapping = JSON.parse(raw);
    } catch (err) {
      console.warn('⚠️ Aucun mapping existant, un nouveau sera créé.');
    }

    mapping[playerName] = discordMention;

    try {
      fs.writeFileSync(filePath, JSON.stringify(mapping, null, 2));
      loadMapping(); // recharge en mémoire
      message.reply(`✅ Lien ajouté : ${playerName} → ${discordMention}`);
    } catch (err) {
      message.reply('❌ Erreur lors de la mise à jour du mapping.');
    }
  }


  if (message.content === '!testapi') {
    try {
      const url = `https://api.clashroyale.com/v1/clans/${encodeURIComponent(CLAN_TAG)}/warlog`;
      const response = await axios.get(url, { headers: { Authorization: `Bearer ${API_KEY}` } });
      message.reply('✅ Endpoint warlog actif.');
    } catch (err) {
      message.reply(`❌ Endpoint warlog désactivé : ${err.response?.data?.message || err.message}`);
    }
  }

});

console.log('🔐 Token lu :', token ? '✅ présent' : '❌ absent');
client.login(token);
