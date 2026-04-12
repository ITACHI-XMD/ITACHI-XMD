const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, '../data/antistatusmention.json');
const channelInfo = {
    forwardingScore: 1, isForwarded: true,
    forwardedNewsletterMessageInfo: {
        newsletterJid: '120363408304719268@newsletter',
        newsletterName: 'ITACHI-XMD', serverMessageId: -1
    }
};

if (!fs.existsSync(configPath)) fs.writeFileSync(configPath, JSON.stringify({ enabled: false }));
function getConfig() { try { return JSON.parse(fs.readFileSync(configPath)); } catch { return { enabled: false }; } }
function saveConfig(d) { fs.writeFileSync(configPath, JSON.stringify(d, null, 2)); }

async function antistatusmention(sock, chatId, senderId, args, message) {
    const action = args[0]?.toLowerCase();
    const config = getConfig();
    const current = config.enabled ? '🟢 Activé' : '🔴 Désactivé';

    if (!action) {
        return await sock.sendMessage(chatId, {
            image: { url: 'https://i.ibb.co/ds0fdYCX/IMG-20260409-WA0249.jpg' },
            caption: `╔═════════════════════╗\n║   🥷 *𝗜𝗧𝗔𝗖𝗛𝗜-𝗫𝗠𝗗-𝐕2* 🥷   ║\n╠═════════════════════╣\n║ ⚠️ *ANTI-STATUT MENTION*  ║\n╚═════════════════════╝\n\n📊 *Statut :* ${current}\n\n📌 *Commandes :*\n┌─────────────────────\n│ ⬡ .antistatusmention on\n│ ⬡ .antistatusmention off\n└─────────────────────\n\n🛡️ *Supprime toute mention du groupe*\n*via les statuts WhatsApp.*\n\n> _Propulsé par 🥷 *IBSACKO™*_`,
            contextInfo: channelInfo
        }, { quoted: message });
    }

    config.enabled = action === 'on';
    saveConfig(config);
    return await sock.sendMessage(chatId, {
        text: `⚠️ *Anti-Statut Mention :* ${config.enabled ? '🟢 Activé' : '🔴 Désactivé'}\n${config.enabled ? '> _Les mentions via statut seront supprimées._' : '> _Protection désactivée._'}`,
        contextInfo: channelInfo
    }, { quoted: message });
}

// Détecte TOUTES les variantes de mention groupe via statut dans Baileys
function isStatusMentionMsg(message) {
    try {
        const msg = message?.message;
        if (!msg) return false;

        // Cas 1 : groupMentionedMessage (type direct de mention groupe via statut)
        if (msg.groupMentionedMessage) return true;

        // Cas 2 : Chercher dans TOUS les types de messages un contextInfo pointant vers status@broadcast
        const allContexts = [
            msg.extendedTextMessage?.contextInfo,
            msg.imageMessage?.contextInfo,
            msg.videoMessage?.contextInfo,
            msg.stickerMessage?.contextInfo,
            msg.audioMessage?.contextInfo,
            msg.documentMessage?.contextInfo,
            msg.reactionMessage?.contextInfo,
        ].filter(Boolean);

        for (const ctx of allContexts) {
            if (ctx.remoteJid === 'status@broadcast') return true;
        }

        // Cas 3 : Le message a un participant dans contextInfo qui vient d'un statut
        // (quand quelqu'un répond à son propre statut pour notifier le groupe)
        const ctx = msg.extendedTextMessage?.contextInfo;
        if (ctx && ctx.stanzaId) {
            // Les IDs de statuts ont souvent une longueur spécifique et pas de participant
            const hasNoParticipant = !ctx.participant;
            const isInGroup = message?.key?.remoteJid?.endsWith('@g.us');
            const stanzaLen = ctx.stanzaId.length;
            if (hasNoParticipant && isInGroup && (stanzaLen === 22 || stanzaLen === 20)) return true;
        }

        return false;
    } catch { return false; }
}

// Handler principal — appelé sur CHAQUE message de groupe
async function handleAntistatus(sock, chatId, senderId, message) {
    try {
        const config = getConfig();
        if (!config.enabled) return false;
        if (!chatId?.endsWith('@g.us')) return false;

        const msg = message?.message;
        if (!msg) return false;

        let shouldDelete = false;

        // Vérification 1 : type groupMentionedMessage
        if (msg.groupMentionedMessage) shouldDelete = true;

        // Vérification 2 : contextInfo avec remoteJid = status@broadcast
        if (!shouldDelete) {
            const ctxList = [
                msg.extendedTextMessage?.contextInfo,
                msg.imageMessage?.contextInfo,
                msg.videoMessage?.contextInfo,
                msg.stickerMessage?.contextInfo,
                msg.audioMessage?.contextInfo,
            ].filter(Boolean);

            for (const ctx of ctxList) {
                if (ctx?.remoteJid === 'status@broadcast') {
                    shouldDelete = true;
                    break;
                }
            }
        }

        if (!shouldDelete) return false;

        // Supprimer le message
        try {
            await sock.sendMessage(chatId, { delete: message.key });
            console.log(`🛡️ [antistatusmention] Supprimé — @${senderId?.split('@')[0]}`);
            return true;
        } catch (deleteErr) {
            // Essai alternatif avec la clé complète
            try {
                await sock.sendMessage(chatId, {
                    delete: {
                        remoteJid: chatId,
                        id: message.key.id,
                        participant: message.key.participant || senderId,
                        fromMe: false
                    }
                });
                return true;
            } catch (e2) {
                console.error('❌ [antistatusmention] Suppression échouée:', e2.message);
                return false;
            }
        }
    } catch (e) {
        console.error('❌ [antistatusmention]', e.message);
        return false;
    }
}

module.exports = antistatusmention;
module.exports.isStatusMention = isStatusMentionMsg;
module.exports.isEnabled = () => getConfig().enabled;
module.exports.handleAntistatus = handleAntistatus;
