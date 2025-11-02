const axios = require('axios');
require('dotenv').config();

function selectCurrentWar(warlog) {
  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setHours(11, 0, 0, 0);
  return now < cutoff ? warlog[1] : warlog[0];
}

async function getClanMembers() {
  const url = `https://api.clashroyale.com/v1/clans/${encodeURIComponent(process.env.CLAN_TAG)}`;
  try {
    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${process.env.CLASH_API_KEY}`
      }
    });
    const members = response.data?.memberList || [];
    return members.map(m => m.name);
  } catch (err) {
    console.error('❌ Erreur API Clash Royale:', err.response?.data || err.message);
    return [];
  }
}

async function getWarStatus() {
  console.log('📡 Appel API Clash Royale lancé (warlog)...');
  try {
    const url = `https://api.clashroyale.com/v1/clans/${encodeURIComponent(process.env.CLAN_TAG)}/warlog`;
    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${process.env.CLASH_API_KEY}`
      }
    });

    const warlog = response.data?.items;
    if (!warlog || warlog.length === 0) return [];

    const warData = selectCurrentWar(warlog);
    if (!warData || !warData.participants) return [];

    return warData.participants.map(p => ({
      name: p.name,
      battlesPlayed: p.battlesPlayed,
      numberOfBattles: p.numberOfBattles,
      remaining: p.numberOfBattles - p.battlesPlayed,
      status: p.battlesPlayed >= p.numberOfBattles ? '✅' : '❌'
    }));
  } catch (error) {
    console.error('❌ Erreur API Clash Royale (warlog):', error.response?.data || error.message);
    return [];
  }
}

async function getIncompletePlayers() {
  console.log('📡 Appel API Clash Royale lancé (warlog)...');
  try {
    const url = `https://api.clashroyale.com/v1/clans/${encodeURIComponent(process.env.CLAN_TAG)}/warlog`;
    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${process.env.CLASH_API_KEY}`
      }
    });

    const warlog = response.data?.items;
    if (!warlog || warlog.length === 0) return [];

    const warData = selectCurrentWar(warlog);
    if (!warData || !warData.participants) return [];

    const incomplete = warData.participants.filter(p => p.battlesPlayed < p.numberOfBattles);
    return incomplete.map(p => p.name);
  } catch (error) {
    console.error('❌ Erreur API Clash Royale (warlog):', error.response?.data || error.message);
    return [];
  }
}

module.exports = {
  getClanMembers,
  getIncompletePlayers,
  getWarStatus
};