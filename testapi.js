const axios = require('axios');

// 🔐 Ta clé API officielle Clash Royale (générée sur https://developer.clashroyale.com)
const API_KEY = process.env.CLASH_API_KEY;

const url = `https://api.clashroyale.com/v1/clans/${CLAN_TAG}/warlog`;

axios.get(url, {
  headers: {
    Authorization: `Bearer ${API_KEY}`
  }
})
.then(response => {
  console.log('✅ Réponse API :', response.data);
})
.catch(error => {
  console.error('❌ Erreur API :', error.response?.status, error.response?.data || error.message);
});