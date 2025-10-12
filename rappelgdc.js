require('dotenv').config();
const axios = require('axios');
const { Client, GatewayIntentBits } = require('discord.js');
const cron = require('node-cron');

const API_KEY = process.env.CLASH_API_KEY;
const CLAN_TAG = process.env.CLAN_TAG;
const token = process.env.DISCORD_TOKEN;

async function getIncompletePlayers() {
  try {
    const response = await axios.get(`https://api.royaleapi.com/clan/${CLAN_TAG}/warlog`, {
      headers: { Authorization: `Bearer ${API_KEY}` }
    });

    const warData = response.data?.[0];
    if (!warData || !warData.participants) return [];
    const incomplete = warData.participants.filter(p => p.battlesPlayed < p.battlesRequired);
    return incomplete.map(p => p.name);
  } catch (error) {
    console.error('Erreur API Clash Royale:', error.message);
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
let reminderTime = '15:06'; // Heure par défaut
const channelId = '1281916311252893750'; // Remplace par l’ID du salon Discord

function scheduleReminder(time) {
  if (scheduledTask) scheduledTask.stop();

  const [hour, minute] = time.split(':');
  const cronExpression = `${minute} ${hour} * * *`;
  console.log(`🕒 Rappel programmé à ${time} (${cronExpression})`);

  scheduledTask = cron.schedule(cronExpression, async () => {
    console.log(`📤 Envoi du rappel automatique à ${time}`);
    const channel = client.channels.cache.get(channelId);
    if (!channel) return console.error('❌ Salon introuvable');

    const players = await getIncompletePlayers();
    const message = players.length > 0
      ? `📣 Rappel automatique à ${time} — les joueurs suivants doivent encore attaquer :\n🔸 ${players.join('\n🔸 ')}`
      : `✅ Tous les joueurs ont terminé leurs attaques. GG !`;

    channel.send(message);
  });
}

client.once('ready', () => {
  console.log(`✅ Connecté en tant que ${client.user.tag}`);
  scheduleReminder(reminderTime);
});

client.on('messageCreate', message => {
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

  if (message.content === '!check') {
    getIncompletePlayers().then(players => {
      if (players.length > 0) {
        message.reply(`🔍 Joueurs en retard :\n🔸 ${players.join('\n🔸 ')}`);
      } else {
        message.reply('✅ Tous les joueurs ont attaqué. Rien à signaler.');
      }
    });
  }
});

console.log('🔐 Token lu :', token ? '✅ présent' : '❌ absent');
client.login(token);
