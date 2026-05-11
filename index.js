/**
 * Knight Bot - A WhatsApp Bot
 * Copyright (c) 2024 Professor
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 * 
 * Credits:
 * - Baileys Library by @adiwajshing
 * - Pair Code implementation inspired by TechGod143 & DGXEON
 */
require('./settings') const { Boom } = require('@hapi/boom') const fs = require('fs') const chalk = require('chalk') const FileType = require('file-type') const path = require('path') const axios = require('axios') const { handleMessages, handleGroupParticipantUpdate, handleStatus } = require('./main') const PhoneNumber = require('awesome-phonenumber') const { imageToWebp, videoToWebp, writeExifImg, writeExifVid } = require('./lib/exif') const { smsg, isUrl, generateMessageTag, getBuffer, getSizeMedia, fetch, sleep, reSize } = require('./lib/myfunc')

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, generateForwardMessageContent, prepareWAMessageMedia, generateWAMessageFromContent, generateMessageID, downloadContentFromMessage, jidDecode, proto, jidNormalizedUser, makeCacheableSignalKeyStore, delay } = require("@whiskeysockets/baileys")

const NodeCache = require("node-cache") const pino = require("pino") const readline = require("readline") const { rmSync } = require('fs')

const store = require('./lib/lightweight_store') const settings = require('./settings')

store.readFromFile() setInterval(() => store.writeToFile(), settings.storeWriteInterval || 10000)

let phoneNumber = "2348063725454" let owner = JSON.parse(fs.readFileSync('./data/owner.json'))

global.botname = "Silver-bot" global.themeemoji = "•"

const rl = process.stdin.isTTY ? readline.createInterface({ input: process.stdin, output: process.stdout }) : null const question = (text) => rl ? new Promise(resolve => rl.question(text, resolve)) : Promise.resolve(phoneNumber)

async function startXeonBotInc() { try { let { version } = await fetchLatestBaileysVersion() const { state, saveCreds } = await useMultiFileAuthState('./session') const msgRetryCounterCache = new NodeCache()

const XeonBotInc = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: true,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }))
        },
        markOnlineOnConnect: true,
        getMessage: async (key) => {
            let jid = jidNormalizedUser(key.remoteJid)
            let msg = await store.loadMessage(jid, key.id)
            return msg?.message || ""
        },
        msgRetryCounterCache
    })

    XeonBotInc.ev.on('creds.update', saveCreds)
    store.bind(XeonBotInc.ev)

    // ================= MESSAGE HANDLER =================
    XeonBotInc.ev.on('messages.upsert', async (chatUpdate) => {
        try {
            const mek = chatUpdate.messages[0]
            if (!mek?.message) return

            const from = mek.key?.remoteJid
            if (!from) return

            let msg = mek.message

            if (msg?.ephemeralMessage) msg = msg.ephemeralMessage.message
            if (msg?.viewOnceMessage) msg = msg.viewOnceMessage.message
            if (msg?.viewOnceMessageV2) msg = msg.viewOnceMessageV2.message

            const isGroup = from.endsWith('@g.us')

            const normalMedia = msg?.imageMessage || msg?.videoMessage
            const viewOnce = mek.message?.viewOnceMessage || mek.message?.viewOnceMessageV2

            if (isGroup && normalMedia && !viewOnce) {
                await XeonBotInc.sendMessage(from, { delete: mek.key })
                await XeonBotInc.sendMessage(from, {
                    text: "⚠️ Only view-once media allowed"
                })
                return
            }

            // ✅ FIXED POSITION (this was your crash)
            if (mek.key.id?.startsWith('BAE5') && mek.key.id.length === 16) return

            await handleMessages(XeonBotInc, chatUpdate, true)

        } catch (err) {
            console.log("messages.upsert error:", err)
        }
    })

    // ================= STATUS =================
    XeonBotInc.ev.on('messages.upsert', async (m) => {
        if (m.messages[0]?.key?.remoteJid === 'status@broadcast') {
            await handleStatus(XeonBotInc, m)
        }
    })

    XeonBotInc.ev.on('group-participants.update', async (update) => {
        await handleGroupParticipantUpdate(XeonBotInc, update)
    })

    XeonBotInc.ev.on('connection.update', async (s) => {
        const { connection, lastDisconnect } = s

        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut
            if (shouldReconnect) startXeonBotInc()
        }
    })

    XeonBotInc.public = true
    XeonBotInc.serializeM = (m) => smsg(XeonBotInc, m, store)

    return XeonBotInc

} catch (err) {
    console.error("Fatal error:", err)
    setTimeout(startXeonBotInc, 5000)
}

}

startXeonBotInc()

process.on('uncaughtException', console.error) process.on('unhandledRejection', console.error)
