require('dotenv').config();
console.log('🔍 CLAN_TAG chargé depuis .env :', process.env.CLAN_TAG);
const { handleCommands } = require('./commands');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits } = require('discord.js');
const cron = require('node-cron');

const API_KEY = process.env.CLASH_API_KEY;
const CLAN_TAG = process.env.CLAN_TAG;
const token = process.env.DISCORD_TOKEN;

if (!API_KEY || !CLAN_TAG || !token) {
  console.error('❌ Variables d’environnement manquantes. Vérifie ton fichier .env');
  process.exit(1);
}

let playerToDiscord = {};


const { scanAndSaveMapping, loadMapping } = require('./mapping');
const { getClanMembers, getIncompletePlayers } = require('./clash');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
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
    const day = today.getDay();
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
    if (mentions.length > 0) {
      const message = `📣 Rappel automatique — les joueurs suivants doivent encore attaquer :\n🔸 ${mentions.join('\n🔸 ')}`;
      channel.send(message);
    } else {
      console.log('✅ Tous les joueurs ont terminé leurs attaques. Aucun message envoyé.');
    }
  });
}

client.once('ready', () => {
  reminderTime = '10:00';
  getClanMembers().then(names => {
    console.log('👥 Membres du clan :', names);
  });

  playerToDiscord = loadMapping();
  const now = new Date().toLocaleString('fr-FR');
  console.log(`✅ Connecté(e) en tant que ${client.user.tag} — ${now}`);
  scheduleReminder(reminderTime);
});

client.on('messageCreate', async message => {
  if (message.author.bot) return;
  handleCommands(message);
});

console.log('🔐 Token lu :', token ? '✅ présent' : '❌ absent');
client.login(token);
