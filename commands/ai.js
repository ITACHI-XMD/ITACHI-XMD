const axios = require('axios');
const fetch = require('node-fetch');

const channelInfo = {
    forwardingScore: 1, isForwarded: true,
    forwardedNewsletterMessageInfo: {
        newsletterJid: '120363408304719268@newsletter',
        newsletterName: 'ITACHI-XMD', serverMessageId: -1
    }
};

function getPrompt() {
    try {
        const fs = require('fs');
        const path = require('path');
        const p = path.join(__dirname, '../data/prompt.json');
        return JSON.parse(fs.readFileSync(p)).prompt ||
            "Tu es ITACHI-XMD, un assistant WhatsApp intelligent. Tu réponds en français de façon claire et concise.";
    } catch {
        return "Tu es ITACHI-XMD, un assistant WhatsApp intelligent. Tu réponds en français de façon claire et concise.";
    }
}

async function aiCommand(sock, chatId, message) {
    try {
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const parts = text.split(' ');
        const command = parts[0].toLowerCase();
        const query = parts.slice(1).join(' ').trim();

        if (!query) {
            return await sock.sendMessage(chatId, {
                image: { url: 'https://i.ibb.co/zTpCpsDD/54c381553462489288313ec73a0bbfe8.jpg' },
                caption: `╔═══════════════════════╗\n║  🥷 *𝗜𝗧𝗔𝗖𝗛𝗜-𝗫𝗠𝗗 v2.0* 🥷  ║\n╠═══════════════════════╣\n║   🤖 *INTELLIGENCE IA*    ║\n╚═══════════════════════╝\n\n💡 *Usage :*\n┌──────────────────────\n│ ⬡ .ai <question>\n│ ⬡ .gpt <question>\n│ ⬡ .gemini <question>\n└──────────────────────\n\n📌 *Exemples :*\n┌──────────────────────\n│ .ai C'est quoi l'IA ?\n│ .gpt Écris un poème\n│ .gemini Explique Python\n└──────────────────────\n\n🤖 *Comportement actuel :*\n_${getPrompt().slice(0, 80)}..._\n\n> _Propulsé par 🥷 IBSACKO™_`,
                contextInfo: channelInfo
            }, { quoted: message });
        }

        await sock.sendMessage(chatId, { react: { text: '🤖', key: message.key } });

        // Système prompt personnalisé via .prompt
        const systemPrompt = getPrompt();
        const fullQuery = `${systemPrompt}\n\nQuestion: ${query}`;

        // Liste d'APIs avec fallback
        const apis = [
            { url: `https://zellapi.autos/ai/chatbot?text=${encodeURIComponent(fullQuery)}`, extract: d => d?.result },
            { url: `https://api.xteam.xyz/ai?text=${encodeURIComponent(fullQuery)}&apikey=d90a9e986e18778b`, extract: d => d?.result || d?.response },
            { url: `https://vapis.my.id/api/gemini?q=${encodeURIComponent(fullQuery)}`, extract: d => d?.message || d?.data || d?.answer || d?.result },
            { url: `https://api.siputzx.my.id/api/ai/gemini-pro?content=${encodeURIComponent(fullQuery)}`, extract: d => d?.message || d?.data },
            { url: `https://api.ryzendesu.vip/api/ai/gemini?text=${encodeURIComponent(fullQuery)}`, extract: d => d?.message || d?.answer },
            { url: `https://api.giftedtech.my.id/api/ai/geminiai?apikey=gifted&q=${encodeURIComponent(fullQuery)}`, extract: d => d?.result || d?.answer },
        ];

        let answer = null;
        for (const api of apis) {
            try {
                const res = await fetch(api.url, { timeout: 15000 });
                const data = await res.json();
                const extracted = api.extract(data);
                if (extracted && typeof extracted === 'string' && extracted.length > 2) {
                    answer = extracted;
                    break;
                }
            } catch { continue; }
        }

        if (!answer) throw new Error('Toutes les APIs ont échoué');

        await sock.sendMessage(chatId, {
            text: `╔═══════════════════════╗\n║  🥷 *𝗜𝗧𝗔𝗖𝗛𝗜-𝗫𝗠𝗗 v2.0* 🥷  ║\n╠═══════════════════════╣\n║   🤖 *RÉPONSE IA*         ║\n╚═══════════════════════╝\n\n❓ *Question :* ${query}\n\n💡 *Réponse :*\n${answer}\n\n> _Propulsé par 🥷 IBSACKO™_`,
            contextInfo: channelInfo
        }, { quoted: message });

    } catch (e) {
        console.error('❌ [ai]', e.message);
        await sock.sendMessage(chatId, {
            text: `❌ *L'IA est temporairement indisponible.*\n_Réessayez dans quelques instants._`,
            contextInfo: channelInfo
        }, { quoted: message });
    }
}

module.exports = aiCommand;
