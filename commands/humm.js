// Humm → Envoie le média directement (sans vue unique) dans le MP de l'utilisateur
//         + supprime le message original du groupe
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

const channelInfo = {
    forwardingScore: 1, isForwarded: true,
    forwardedNewsletterMessageInfo: {
        newsletterJid: '120363408304719268@newsletter',
        newsletterName: 'ITACHI-XMD', serverMessageId: -1
    }
};

function normalizeJid(jid) {
    if (!jid) return jid;
    // Enlève le :device pour avoir le vrai JID MP
    return jid.replace(/:\d+@/, '@');
}

async function hummCommand(sock, chatId, senderId, replyMessage, message) {
    const userJid = normalizeJid(senderId);

    if (!replyMessage) {
        return await sock.sendMessage(chatId, {
            image: { url: 'https://i.ibb.co/ds0fdYCX/IMG-20260409-WA0249.jpg' },
            caption: `╔═════════════════════╗\n║   🥷 *𝗜𝗧𝗔𝗖𝗛𝗜-𝗫𝗠𝗗-𝐕2* 🥷   ║\n╠═════════════════════╣\n║   👁️ *RÉCUP MÉDIA → MP*    ║\n╚═════════════════════╝\n\n💡 *Usage :* Réponds à un média avec *.humm*\n_Le bot te l'envoie directement dans ton MP._\n\n📌 *Fonctionne avec :*\n┌─────────────────────\n│ ⬡ Images 🖼️\n│ ⬡ Vidéos 🎬\n│ ⬡ Stickers 🎭\n│ ⬡ Audio 🎵\n└─────────────────────\n\n> _Propulsé par 🥷 *IBSACKO™*_`,
            contextInfo: channelInfo
        }, { quoted: message });
    }

    // Clé du message original pour le supprimer
    const ctxInfo = message.message?.extendedTextMessage?.contextInfo;
    const originalKey = ctxInfo ? {
        remoteJid: chatId,
        id: ctxInfo.stanzaId,
        participant: ctxInfo.participant || undefined
    } : null;

    try {

        // ── Image (y compris vue unique) ───────────
        if (replyMessage.imageMessage) {
            const stream = await downloadContentFromMessage(replyMessage.imageMessage, 'image');
            let buf = Buffer.from([]);
            for await (const chunk of stream) buf = Buffer.concat([buf, chunk]);

            await sock.sendMessage(userJid, {
                image: buf,
                caption: `🥷 *ITACHI-XMD* — Média récupéré`
            });

            // Supprimer le message original du groupe
            if (originalKey) {
                try { await sock.sendMessage(chatId, { delete: originalKey }); } catch (e) {}
            }
            return;
        }

        // ── Vidéo (y compris vue unique) ──────────
        if (replyMessage.videoMessage) {
            const stream = await downloadContentFromMessage(replyMessage.videoMessage, 'video');
            let buf = Buffer.from([]);
            for await (const chunk of stream) buf = Buffer.concat([buf, chunk]);

            await sock.sendMessage(userJid, {
                video: buf,
                caption: `🥷 *ITACHI-XMD* — Média récupéré`
            });

            if (originalKey) {
                try { await sock.sendMessage(chatId, { delete: originalKey }); } catch (e) {}
            }
            return;
        }

        // ── Sticker ────────────────────────────────
        if (replyMessage.stickerMessage) {
            const stream = await downloadContentFromMessage(replyMessage.stickerMessage, 'sticker');
            let buf = Buffer.from([]);
            for await (const chunk of stream) buf = Buffer.concat([buf, chunk]);

            // Sticker → image normale dans le MP
            await sock.sendMessage(userJid, {
                image: buf,
                caption: `🥷 *ITACHI-XMD* — Sticker récupéré`
            });

            if (originalKey) {
                try { await sock.sendMessage(chatId, { delete: originalKey }); } catch (e) {}
            }
            return;
        }

        // ── Audio ──────────────────────────────────
        if (replyMessage.audioMessage) {
            const stream = await downloadContentFromMessage(replyMessage.audioMessage, 'audio');
            let buf = Buffer.from([]);
            for await (const chunk of stream) buf = Buffer.concat([buf, chunk]);

            await sock.sendMessage(userJid, {
                audio: buf,
                mimetype: 'audio/mp4',
                ptt: replyMessage.audioMessage.ptt || false
            });

            if (originalKey) {
                try { await sock.sendMessage(chatId, { delete: originalKey }); } catch (e) {}
            }
            return;
        }

        // Type non supporté
        await sock.sendMessage(chatId, {
            text: `❌ *Type non supporté.*\n_Réponds à une image, vidéo, sticker ou audio._`,
            contextInfo: channelInfo
        }, { quoted: message });

    } catch (e) {
        console.error('❌ [humm]', e.message);
        await sock.sendMessage(chatId, {
            text: `❌ *Erreur :* ${e.message}`,
            contextInfo: channelInfo
        }, { quoted: message });
    }
}

module.exports = hummCommand;
