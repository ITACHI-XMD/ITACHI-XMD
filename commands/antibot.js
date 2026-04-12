// Antibot → Bloque les autres bots dans le groupe
const fs = require('fs');
const path = require('path');
const isAdmin = require('../lib/isAdmin');

const ANTIBOT_FILE = path.join(__dirname, '../data/antibot.json');
const channelInfo = {
    forwardingScore: 1, isForwarded: true,
    forwardedNewsletterMessageInfo: {
        newsletterJid: '120363408304719268@newsletter',
        newsletterName: 'ITACHI-XMD', serverMessageId: -1
    }
};

function readState() { try { return JSON.parse(fs.readFileSync(ANTIBOT_FILE)); } catch { return {}; } }
function saveState(s) { fs.writeFileSync(ANTIBOT_FILE, JSON.stringify(s, null, 2)); }
function isAntibotEnabled(chatId) { return readState()[chatId] === true; }

async function antibotCommand(sock, chatId, senderId, message, args) {
    if (!chatId.endsWith('@g.us')) {
        return await sock.sendMessage(chatId, { text: '❌ *Uniquement dans les groupes !*', contextInfo: channelInfo }, { quoted: message });
    }

    const { isSenderAdmin, isBotAdmin } = await isAdmin(sock, chatId, senderId);
    if (!isSenderAdmin) {
        return await sock.sendMessage(chatId, {
            text: `╔══════════════════════╗\n║   🥷 *𝗜𝗧𝗔𝗖𝗛𝗜-𝗫𝗠𝗗* 🥷   ║\n╚══════════════════════╝\n\n❌ *Réservé aux admins !*`,
            contextInfo: channelInfo
        }, { quoted: message });
    }

    const state = readState();
    const action = args[0]?.toLowerCase();
    const current = state[chatId] ? '🟢 Activé' : '🔴 Désactivé';

    if (!action) {
        return await sock.sendMessage(chatId, {
            image: { url: 'https://i.ibb.co/zTpCpsDD/54c381553462489288313ec73a0bbfe8.jpg' },
            caption: `╔═══════════════════════╗\n║  🥷 *𝗜𝗧𝗔𝗖𝗛𝗜-𝗫𝗠𝗗 v2.0* 🥷  ║\n╠═══════════════════════╣\n║   🤖 *ANTI-BOT*           ║\n╚═══════════════════════╝\n\n📊 *Statut :* ${current}\n\n📌 *Commandes :*\n┌──────────────────────\n│ ⬡ .antibot on\n│ ⬡ .antibot off\n└──────────────────────\n\n🛡️ *Fonctionnement :*\n┌──────────────────────\n│ Quand activé, tous les messages\n│ envoyés par d'autres bots\n│ (messages automatiques/commandes)\n│ seront supprimés.\n└──────────────────────\n\n> _Propulsé par 🥷 IBSACKO™_`,
            contextInfo: channelInfo
        }, { quoted: message });
    }

    if (action === 'on') {
        if (!isBotAdmin) return await sock.sendMessage(chatId, { text: '❌ *Le bot doit être admin !*', contextInfo: channelInfo }, { quoted: message });
        state[chatId] = true;
        saveState(state);
        return await sock.sendMessage(chatId, {
            text: `╔═══════════════════════╗\n║  🥷 *𝗜𝗧𝗔𝗖𝗛𝗜-𝗫𝗠𝗗 v2.0* 🥷  ║\n╚═══════════════════════╝\n\n🤖 *Anti-Bot :* 🟢 Activé\n\n🛡️ _Aucun autre bot ne pourra interagir ici._`,
            contextInfo: channelInfo
        }, { quoted: message });
    }

    if (action === 'off') {
        state[chatId] = false;
        saveState(state);
        return await sock.sendMessage(chatId, {
            text: `╔═══════════════════════╗\n║  🥷 *𝗜𝗧𝗔𝗖𝗛𝗜-𝗫𝗠𝗗 v2.0* 🥷  ║\n╚═══════════════════════╝\n\n🤖 *Anti-Bot :* 🔴 Désactivé`,
            contextInfo: channelInfo
        }, { quoted: message });
    }
}

module.exports = { antibotCommand, isAntibotEnabled };
