const axios = require('axios');
const fetch = require('node-fetch');

const channelInfo = {
    forwardingScore: 1, isForwarded: true,
    forwardedNewsletterMessageInfo: {
        newsletterJid: '120363408304719268@newsletter',
        newsletterName: 'ITACHI-XMD', serverMessageId: -1
    }
};

// 5 APIs de fallback pour garantir le fonctionnement
const IMAGE_APIS = [
    q => `https://api.xteam.xyz/img?q=${encodeURIComponent(q)}&apikey=d90a9e986e18778b`,
    q => `https://api.dhamzxploit.my.id/api/image?q=${encodeURIComponent(q)}`,
    q => `https://api.lolhuman.xyz/api/image?apikey=85faf717d0545d14074659ad&q=${encodeURIComponent(q)}`,
    q => `https://api.akuari.my.id/search/image?q=${encodeURIComponent(q)}`,
    q => `https://api.giftedtech.my.id/api/search/image?apikey=gifted&q=${encodeURIComponent(q)}`,
];

function extractUrl(data) {
    if (!data) return null;
    const candidates = [
        data?.result?.url, data?.result, data?.url,
        data?.data?.url, data?.data, data?.image,
        Array.isArray(data?.result) ? data.result[0]?.url : null,
        Array.isArray(data?.data) ? data.data[0]?.url : null,
    ];
    return candidates.find(u => typeof u === 'string' && u.startsWith('http')) || null;
}

async function imageCommand(sock, chatId, args, message) {
    const query = args.join(' ');

    if (!query) {
        return await sock.sendMessage(chatId, {
            image: { url: 'https://i.ibb.co/zTpCpsDD/54c381553462489288313ec73a0bbfe8.jpg' },
            caption: `╔═══════════════════════╗\n║  🥷 *𝗜𝗧𝗔𝗖𝗛𝗜-𝗫𝗠𝗗 v2.0* 🥷  ║\n╠═══════════════════════╣\n║   🖼️ *RECHERCHE IMAGE*    ║\n╚═══════════════════════╝\n\n💡 *Usage :* \`.image <description>\`\n\n📌 *Exemples :*\n┌──────────────────────\n│ ⬡ .image coucher de soleil\n│ ⬡ .image voiture de sport\n│ ⬡ .image chat mignon\n└──────────────────────\n\n> _Propulsé par 🥷 IBSACKO™_`,
            contextInfo: channelInfo
        }, { quoted: message });
    }

    await sock.sendMessage(chatId, {
        text: `🖼️ _Recherche en cours pour :_ *"${query}"*\n⏳ _Patiente..._`
    }, { quoted: message });

    // Essaie chaque API jusqu'à trouver une image valide
    for (const buildUrl of IMAGE_APIS) {
        try {
            const res = await axios.get(buildUrl(query), { timeout: 10000 });
            const imgUrl = extractUrl(res.data);
            if (imgUrl) {
                return await sock.sendMessage(chatId, {
                    image: { url: imgUrl },
                    caption: `╔═══════════════════════╗\n║  🥷 *𝗜𝗧𝗔𝗖𝗛𝗜-𝗫𝗠𝗗 v2.0* 🥷  ║\n╠═══════════════════════╣\n║   🖼️ *IMAGE TROUVÉE*      ║\n╚═══════════════════════╝\n\n🔍 *Recherche :* ${query}\n\n> _Propulsé par 🥷 IBSACKO™_`,
                    contextInfo: channelInfo
                }, { quoted: message });
            }
        } catch { continue; }
    }

    // Dernier recours : Google Images scrape
    try {
        const googleUrl = `https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(query)}&searchType=image&num=1&key=AIzaSyC3LFTqZmRAnXbD5NKtylBEPT9Oe8j-Y5A&cx=017576662512468239146:omuauf10dwe`;
        const res = await axios.get(googleUrl, { timeout: 10000 });
        const imgUrl = res.data?.items?.[0]?.link;
        if (imgUrl) {
            return await sock.sendMessage(chatId, {
                image: { url: imgUrl },
                caption: `🖼️ *${query}*\n> _Propulsé par 🥷 IBSACKO™_`,
                contextInfo: channelInfo
            }, { quoted: message });
        }
    } catch { /* silently fail */ }

    await sock.sendMessage(chatId, {
        text: `╔═══════════════════════╗\n║  🥷 *𝗜𝗧𝗔𝗖𝗛𝗜-𝗫𝗠𝗗 v2.0* 🥷  ║\n╚═══════════════════════╝\n\n❌ *Aucune image trouvée pour :* "${query}"\n\n💡 _Essayez un autre mot-clé._`,
        contextInfo: channelInfo
    }, { quoted: message });
}

module.exports = imageCommand;
