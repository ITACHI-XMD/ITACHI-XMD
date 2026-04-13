/**
 * ITACHI-XMD - Bot WhatsApp Multifonctions
 * Développé par IBSACKO™
 * MIT License
 */
require('dotenv').config();
require('./settings')
const { Boom } = require('@hapi/boom')
const fs = require('fs')
const chalk = require('chalk')
const FileType = require('file-type')
const path = require('path')
const axios = require('axios')
const http = require('http')
const { handleMessages, handleGroupParticipantUpdate, handleStatus } = require('./main');
const PhoneNumber = require('awesome-phonenumber')
const { imageToWebp, videoToWebp, writeExifImg, writeExifVid } = require('./lib/exif')
const { smsg, isUrl, generateMessageTag, getBuffer, getSizeMedia, fetch, sleep, reSize } = require('./lib/myfunc')
const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    generateForwardMessageContent,
    prepareWAMessageMedia,
    generateWAMessageFromContent,
    generateMessageID,
    downloadContentFromMessage,
    jidDecode,
    proto,
    jidNormalizedUser,
    makeCacheableSignalKeyStore,
    Browsers,
    delay
} = require("@whiskeysockets/baileys")
const NodeCache = require("node-cache")
const pino = require("pino")
const readline = require("readline")
const { parsePhoneNumber } = require("libphonenumber-js")
const { rmSync, existsSync } = require('fs')
const { join } = require('path')

const store = require('./lib/lightweight_store')
store.readFromFile()
const settings = require('./settings')
setInterval(() => store.writeToFile(), settings.storeWriteInterval || 10000)

setInterval(() => { if (global.gc) global.gc() }, 60_000)
setInterval(() => {
    const used = process.memoryUsage().rss / 1024 / 1024
    if (used > 400) { console.log('RAM too high, restarting...'); process.exit(1) }
}, 30_000)

// ═══════════════════════════════════════════════════════════
// 🌐 MULTI-USER SESSION GENERATOR API
// Chaque utilisateur crée sa propre session indépendante
// ═══════════════════════════════════════════════════════════

const activeSessions = new Map() // phone → sessionInfo
const PORT = process.env.PORT || 3000

function sendJSON(res, status, data) {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Content-Type', 'application/json')
    res.writeHead(status)
    res.end(JSON.stringify(data))
}

async function createUserSession(phone, type = 'short') {
    const sessionDir = path.join('./tmp_sessions', phone)

    // Clean existing
    if (fs.existsSync(sessionDir)) rmSync(sessionDir, { recursive: true, force: true })
    fs.mkdirSync(sessionDir, { recursive: true })

    const { state, saveCreds } = await useMultiFileAuthState(sessionDir)
    const { version } = await fetchLatestBaileysVersion()

    const sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        browser: Browsers.ubuntu('Chrome'),
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })),
        },
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 60000,
        keepAliveIntervalMs: 10000,
        syncFullHistory: false,
    })

    sock.ev.on('creds.update', saveCreds)

    const info = {
        sock, sessionDir, type,
        pairCode: null, qr: null, sessionId: null,
        status: 'connecting',
        resolvePair: null, resolveQR: null, resolveSession: null,
    }

    activeSessions.set(phone, info)

    // Auto-cleanup after 5 min
    setTimeout(() => cleanupSession(phone), 5 * 60 * 1000)

    // Request pairing code after 3s
    setTimeout(async () => {
        try {
            if (!sock.authState.creds.registered) {
                let code = await sock.requestPairingCode(phone)
                code = code?.match(/.{1,4}/g)?.join('-') || code
                info.pairCode = code
                info.status = 'paired'
                console.log(chalk.cyan(`🔑 [${phone}] Code: ${code}`))
                if (info.resolvePair) { info.resolvePair(code); info.resolvePair = null }
            }
        } catch (err) {
            console.error(`❌ [${phone}] Pair error:`, err.message)
            info.status = 'error'
        }
    }, 3000)

    sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
        if (qr) {
            info.qr = qr
            info.status = 'qr_ready'
            if (info.resolveQR) { info.resolveQR(qr); info.resolveQR = null }
        }

        if (connection === 'open') {
            console.log(chalk.green(`✅ [${phone}] WhatsApp connected!`))
            info.status = 'connected'
            try {
                const files = fs.readdirSync(sessionDir)
                const sessionObj = {}
                for (const file of files) {
                    sessionObj[file] = fs.readFileSync(path.join(sessionDir, file), 'utf-8')
                }
                const encoded = type === 'long'
                    ? Buffer.from(JSON.stringify(sessionObj)).toString('base64')
                    : 'ITACHI_' + Buffer.from(sessionObj['creds.json'] || '').toString('base64')

                info.sessionId = encoded
                info.status = 'ready'
                console.log(chalk.green(`📦 [${phone}] Session ID ready`))
                if (info.resolveSession) { info.resolveSession(encoded); info.resolveSession = null }
            } catch (e) {
                console.error(`❌ [${phone}] Session gen error:`, e)
                info.status = 'error'
            }
            // Keep for 30s then cleanup
            setTimeout(() => cleanupSession(phone), 30000)
        }
    })

    return info
}

function cleanupSession(phone) {
    const info = activeSessions.get(phone)
    if (!info) return
    try { info.sock?.end?.() } catch {}
    try { if (fs.existsSync(info.sessionDir)) rmSync(info.sessionDir, { recursive: true, force: true }) } catch {}
    activeSessions.delete(phone)
    console.log(chalk.gray(`🧹 [${phone}] Cleaned up`))
}

// ── HTTP Server ──────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost`)
    const p = url.pathname

    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }

    // /pair?phone=224621963059&type=short
    if (p === '/pair') {
        const phone = url.searchParams.get('phone')?.replace(/\D/g, '')
        const type = url.searchParams.get('type') || 'short'
        if (!phone || phone.length < 7) { sendJSON(res, 400, { error: 'Numéro invalide' }); return }

        try {
            let info = activeSessions.get(phone)

            // Already has code
            if (info?.pairCode) { sendJSON(res, 200, { code: info.pairCode }); return }

            // Create new session
            if (!info) info = await createUserSession(phone, type)

            // Wait up to 20s
            const code = await new Promise((resolve, reject) => {
                if (info.pairCode) { resolve(info.pairCode); return }
                info.resolvePair = resolve
                setTimeout(() => reject(new Error('Timeout — réessaie')), 20000)
            })
            sendJSON(res, 200, { code })
        } catch (err) {
            sendJSON(res, 500, { error: err.message })
        }
        return
    }

    // /qr?phone=xxx&type=short  (optional phone for tracking)
    if (p === '/qr') {
        const phone = url.searchParams.get('phone')?.replace(/\D/g, '') || `qr_${Date.now()}`
        const type = url.searchParams.get('type') || 'short'

        try {
            let info = activeSessions.get(phone)
            if (info?.qr) { sendJSON(res, 200, { qr: info.qr }); return }
            if (!info) info = await createUserSession(phone, type)

            const qr = await new Promise((resolve, reject) => {
                if (info.qr) { resolve(info.qr); return }
                info.resolveQR = resolve
                setTimeout(() => reject(new Error('Timeout — réessaie')), 20000)
            })
            sendJSON(res, 200, { qr })
        } catch (err) {
            sendJSON(res, 500, { error: err.message })
        }
        return
    }

    // /session?phone=224621963059  — poll until session is ready
    if (p === '/session') {
        const phone = url.searchParams.get('phone')?.replace(/\D/g, '')
        if (!phone) { sendJSON(res, 400, { error: 'phone requis' }); return }

        const info = activeSessions.get(phone)
        if (!info) { sendJSON(res, 404, { session: null, status: 'not_found' }); return }
        if (info.status === 'ready') { sendJSON(res, 200, { session: info.sessionId, status: 'ready' }); return }
        sendJSON(res, 202, { session: null, status: info.status })
        return
    }

    // / — health
    if (p === '/') {
        sendJSON(res, 200, { status: 'online', bot: 'ITACHI-XMD', active_sessions: activeSessions.size })
        return
    }

    sendJSON(res, 404, { error: 'Not found' })
})

server.listen(PORT, () => {
    console.log(chalk.green(`🌐 API Session Generator — port ${PORT}`))
    console.log(chalk.cyan(`   /pair  /qr  /session`))
})

// ═══════════════════════════════════════════════════════════
// 🤖 MAIN BOT (connexion propriétaire)
// ═══════════════════════════════════════════════════════════
let owner = JSON.parse(fs.readFileSync('./data/owner.json'))
global.botname = "ITACHI-XMD"
global.themeemoji = "•"
const pairingCode = !!(settings.ownerNumber) || process.argv.includes("--pairing-code")
const useMobile = process.argv.includes("--mobile")

const rl = process.stdin.isTTY ? readline.createInterface({ input: process.stdin, output: process.stdout }) : null
const question = (text) => {
    if (rl) return new Promise((resolve) => rl.question(text, resolve))
    return Promise.resolve(settings.ownerNumber)
}

async function startXeonBotInc() {
    try {
        let { version } = await fetchLatestBaileysVersion()
        const { state, saveCreds } = await useMultiFileAuthState(`./session`)
        const msgRetryCounterCache = new NodeCache()

        const XeonBotInc = makeWASocket({
            version, logger: pino({ level: 'silent' }),
            printQRInTerminal: !pairingCode,
            browser: Browsers.ubuntu('Chrome'),
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
            },
            markOnlineOnConnect: true, generateHighQualityLinkPreview: true,
            syncFullHistory: false,
            getMessage: async (key) => {
                let msg = await store.loadMessage(jidNormalizedUser(key.remoteJid), key.id)
                return msg?.message || ""
            },
            msgRetryCounterCache, defaultQueryTimeoutMs: 60000,
            connectTimeoutMs: 60000, keepAliveIntervalMs: 10000,
        })

        XeonBotInc.ev.on('creds.update', saveCreds)
        store.bind(XeonBotInc.ev)

        XeonBotInc.ev.on('messages.upsert', async chatUpdate => {
            try {
                const mek = chatUpdate.messages[0]
                if (!mek.message) return
                mek.message = (Object.keys(mek.message)[0] === 'ephemeralMessage') ? mek.message.ephemeralMessage.message : mek.message
                if (mek.key?.remoteJid === 'status@broadcast') { await handleStatus(XeonBotInc, chatUpdate); return }
                if (!XeonBotInc.public && !mek.key.fromMe && chatUpdate.type === 'notify') {
                    if (!mek.key?.remoteJid?.endsWith('@g.us')) return
                }
                if (mek.key.id.startsWith('BAE5') && mek.key.id.length === 16) return
                if (mek.key?.remoteJid?.endsWith('@newsletter')) mek.key.fromMe = true
                if (XeonBotInc?.msgRetryCounterCache) XeonBotInc.msgRetryCounterCache.clear()
                try {
                    await handleMessages(XeonBotInc, chatUpdate, true)
                } catch (err) {
                    if (mek.key?.remoteJid) await XeonBotInc.sendMessage(mek.key.remoteJid, { text: '❌ Error.' }).catch(() => {})
                }
            } catch (err) { console.error(err) }
        })

        XeonBotInc.decodeJid = (jid) => {
            if (!jid) return jid
            if (/:\d+@/gi.test(jid)) { let d = jidDecode(jid) || {}; return d.user && d.server ? d.user + '@' + d.server : jid }
            return jid
        }

        XeonBotInc.ev.on('contacts.update', update => {
            for (let c of update) {
                let id = XeonBotInc.decodeJid(c.id)
                if (store?.contacts) store.contacts[id] = { id, name: c.notify }
            }
        })

        XeonBotInc.getName = (jid, withoutContact = false) => {
            id = XeonBotInc.decodeJid(jid)
            if (id.endsWith("@g.us")) return new Promise(async resolve => {
                let v = store.contacts[id] || {}
                if (!(v.name || v.subject)) v = XeonBotInc.groupMetadata(id) || {}
                resolve(v.name || v.subject || PhoneNumber('+' + id.replace('@s.whatsapp.net', '')).getNumber('international'))
            })
            let v = id === '0@s.whatsapp.net' ? { id, name: 'WhatsApp' } :
                id === XeonBotInc.decodeJid(XeonBotInc.user.id) ? XeonBotInc.user : (store.contacts[id] || {})
            return (withoutContact ? '' : v.name) || v.subject || v.verifiedName || PhoneNumber('+' + jid.replace('@s.whatsapp.net', '')).getNumber('international')
        }

        XeonBotInc.public = true
        XeonBotInc.serializeM = (m) => smsg(XeonBotInc, m, store)

        if (pairingCode && !XeonBotInc.authState.creds.registered) {
            if (useMobile) throw new Error('Cannot use pairing code with mobile api')
            let phoneNum = await question('METTEZ VOTRE NUMERO (SANS +) : ')
            phoneNum = phoneNum.replace(/[^0-9]/g, '')
            const pn = require('awesome-phonenumber')
            if (!pn('+' + phoneNum).isValid()) { console.log('Numéro invalide.'); process.exit(1) }
            setTimeout(async () => {
                try {
                    let code = await XeonBotInc.requestPairingCode(phoneNum)
                    code = code?.match(/.{1,4}/g)?.join("-") || code
                    console.log(chalk.bgGreen('Your Pairing Code :'), chalk.white(code))
                    console.log(chalk.yellow('\nWhatsApp → Appareils liés → Lier un appareil → entre le code'))
                } catch (e) { console.error('Pair error:', e) }
            }, 3000)
        }

        XeonBotInc.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
            if (qr) console.log(chalk.yellow('📱 QR généré.'))
            if (connection === 'connecting') console.log(chalk.yellow('🔄 Connexion...'))
            if (connection === 'open') {
                console.log(chalk.green('✅ Bot connecté!'))
                try {
                    const botJid = XeonBotInc.user.id.split(':')[0] + '@s.whatsapp.net'
                    await XeonBotInc.sendMessage(botJid, {
                        text: `🤖 Bot Connected Successfully!\n\n⏰ Time: ${new Date().toLocaleString()}\n✅ Status: Online and Ready!\n\n✅Make sure to join below channel`,
                        contextInfo: { forwardingScore: 1, isForwarded: true, forwardedNewsletterMessageInfo: { newsletterJid: '120363408304719268@newsletter', newsletterName: 'ITACHI-XMD', serverMessageId: -1 } }
                    })
                } catch (e) {}
                await delay(1999)
                console.log(chalk.green(`✅ ITACHI-XMD V${settings.version || '2.0'} Online!`))
            }
            if (connection === 'close') {
                const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut
                const code = lastDisconnect?.error?.output?.statusCode
                if (code === DisconnectReason.loggedOut || code === 401) {
                    try { rmSync('./session', { recursive: true, force: true }) } catch {}
                }
                if (shouldReconnect) { await delay(5000); startXeonBotInc() }
            }
        })

        const antiCallNotified = new Set()
        XeonBotInc.ev.on('call', async (calls) => {
            try {
                const { readState } = require('./commands/anticall')
                if (!readState().enabled) return
                for (const call of calls) {
                    const jid = call.from || call.peerJid || call.chatId
                    if (!jid) continue
                    if (!antiCallNotified.has(jid)) {
                        antiCallNotified.add(jid)
                        setTimeout(() => antiCallNotified.delete(jid), 60000)
                        await XeonBotInc.sendMessage(jid, { text: '📵 Anticall enabled.' }).catch(() => {})
                    }
                    setTimeout(async () => { try { await XeonBotInc.updateBlockStatus(jid, 'block') } catch {} }, 800)
                }
            } catch {}
        })

        XeonBotInc.ev.on('group-participants.update', async u => await handleGroupParticipantUpdate(XeonBotInc, u))
        XeonBotInc.ev.on('status.update', async s => await handleStatus(XeonBotInc, s))
        XeonBotInc.ev.on('messages.reaction', async s => await handleStatus(XeonBotInc, s))
        XeonBotInc.ev.on('messages.upsert', async m => {
            if (m.messages[0]?.key?.remoteJid === 'status@broadcast') await handleStatus(XeonBotInc, m)
        })

        return XeonBotInc
    } catch (error) {
        console.error('Error:', error)
        await delay(5000)
        startXeonBotInc()
    }
}

startXeonBotInc().catch(e => { console.error(e); process.exit(1) })
process.on('uncaughtException', err => console.error('Uncaught:', err))
process.on('unhandledRejection', err => console.error('Unhandled:', err))

let file = require.resolve(__filename)
fs.watchFile(file, () => {
    fs.unwatchFile(file)
    delete require.cache[file]
    require(file)
})
