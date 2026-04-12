const axios = require('axios');
const fetch = require('node-fetch');

const channelInfo = {
    forwardingScore: 1, isForwarded: true,
    forwardedNewsletterMessageInfo: {
        newsletterJid: '120363408304719268@newsletter',
        newsletterName: 'ITACHI-XMD', serverMessageId: -1
    }
};

// Système prompt spécialisé en code
const CODE_PROMPT = "Tu es un expert en programmation. Réponds TOUJOURS en français. Sois clair et structuré. Si tu donnes du code, utilise des blocs de code avec le langage. Sois direct et concis.";

// 6 APIs de fallback
const CODE_APIS = [
    async q => {
        const r = await fetch(`https://zellapi.autos/ai/chatbot?text=${encodeURIComponent(CODE_PROMPT + '\n\n' + q)}`, { timeout: 20000 });
        const d = await r.json(); return d?.result;
    },
    async q => {
        const r = await axios.get(`https://api.xteam.xyz/ai?text=${encodeURIComponent(CODE_PROMPT + '\n\n' + q)}&apikey=d90a9e986e18778b`, { timeout: 20000 });
        return r.data?.result || r.data?.response;
    },
    async q => {
        const r = await fetch(`https://api.siputzx.my.id/api/ai/gemini-pro?content=${encodeURIComponent(CODE_PROMPT + '\n\n' + q)}`, { timeout: 20000 });
        const d = await r.json(); return d?.message || d?.data;
    },
    async q => {
        const r = await fetch(`https://vapis.my.id/api/gemini?q=${encodeURIComponent(CODE_PROMPT + '\n\n' + q)}`, { timeout: 20000 });
        const d = await r.json(); return d?.message || d?.result || d?.data;
    },
    async q => {
        const r = await fetch(`https://api.ryzendesu.vip/api/ai/gemini?text=${encodeURIComponent(CODE_PROMPT + '\n\n' + q)}`, { timeout: 20000 });
        const d = await r.json(); return d?.message || d?.answer;
    },
    async q => {
        const r = await fetch(`https://api.giftedtech.my.id/api/ai/geminiai?apikey=gifted&q=${encodeURIComponent(CODE_PROMPT + '\n\n' + q)}`, { timeout: 20000 });
        const d = await r.json(); return d?.result || d?.answer;
    },
];

async function codeaiCommand(sock, chatId, senderId, args, message) {
    const query = args.join(' ');

    if (!query) {
        return await sock.sendMessage(chatId, {
            image: { url: 'https://i.ibb.co/zTpCpsDD/54c381553462489288313ec73a0bbfe8.jpg' },
            caption: `╔═══════════════════════╗\n║  🥷 *𝗜𝗧𝗔𝗖𝗛𝗜-𝗫𝗠𝗗 v2.0* 🥷  ║\n╠═══════════════════════╣\n║   💻 *CODE AI*            ║\n╚═══════════════════════╝\n\n🤖 *IA spécialisée en programmation !*\n\n💡 *Usage :* \`.codeai <ta question>\`\n\n📌 *Exemples :*\n┌──────────────────────\n│ ⬡ .codeai Créer un serveur Node.js\n│ ⬡ .codeai Expliquer async/await\n│ ⬡ .codeai Corriger ce bug Python\n│ ⬡ .codeai Différence entre == et ===\n└──────────────────────\n\n> _Propulsé par 🥷 IBSACKO™_`,
            contextInfo: channelInfo
        }, { quoted: message });
    }

    await sock.sendMessage(chatId, {
        text: `💻 _Analyse en cours..._\n🤖 _L'IA prépare la réponse..._`
    }, { quoted: message });

    let answer = null;

    for (const callApi of CODE_APIS) {
        try {
            const result = await callApi(query);
            if (result && typeof result === 'string' && result.length > 5) {
                answer = result;
                break;
            }
        } catch { continue; }
    }

    if (!answer) {
        return await sock.sendMessage(chatId, {
            text: `╔═══════════════════════╗\n║  🥷 *𝗜𝗧𝗔𝗖𝗛𝗜-𝗫𝗠𝗗 v2.0* 🥷  ║\n╚═══════════════════════╝\n\n❌ *L'IA Code est temporairement indisponible.*\n_Toutes les APIs ont échoué. Réessayez dans quelques instants._`,
            contextInfo: channelInfo
        }, { quoted: message });
    }

    await sock.sendMessage(chatId, {
        text: `╔═══════════════════════╗\n║  🥷 *𝗜𝗧𝗔𝗖𝗛𝗜-𝗫𝗠𝗗 v2.0* 🥷  ║\n╠═══════════════════════╣\n║   💻 *CODE AI — RÉPONSE*  ║\n╚═══════════════════════╝\n\n❓ *Question :*\n${query}\n\n━━━━━━━━━━━━━━━━━━━━━━\n\n💡 *Réponse :*\n${answer}\n\n━━━━━━━━━━━━━━━━━━━━━━\n> _Propulsé par 🥷 IBSACKO™_`,
        contextInfo: channelInfo
    }, { quoted: message });
}

module.exports = codeaiCommand;
