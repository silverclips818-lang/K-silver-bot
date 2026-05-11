const axios = require('axios')

const wcgGames = new Map()

function getRandomLetter() {
    const letters = 'abcdefghijklmnopqrstuvwxyz'
    return letters[Math.floor(Math.random() * letters.length)]
}

function getRequiredLength(round) {
    return Math.min(3 + round, 10)
}

async function validateWord(word) {
    try {
        const res = await axios.get(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`)
        return res.data && Array.isArray(res.data)
    } catch {
        return false
    }
}

function createWCGGame(chatId, starter) {
    wcgGames.set(chatId, {
        starter,
        players: [],
        phase: 'JOINING',
        round: 1,
        usedWords: [],
        currentPlayer: null,
        currentLetter: null,
        minLength: 3,
        timeout: null
    })
}

async function startWCGJoinPhase(sock, chatId) {

    const game = wcgGames.get(chatId)

    await sock.sendMessage(chatId, {
        text:
`🎮 *WORD CHAIN GAME*

Type *join* to participate.

Game starts in 60 seconds.`
    })

    setTimeout(async () => {

        const updatedGame = wcgGames.get(chatId)

        if (!updatedGame) return

        if (updatedGame.players.length < 2) {
            await sock.sendMessage(chatId, {
                text: '❌ Not enough players joined.'
            })

            wcgGames.delete(chatId)
            return
        }

        updatedGame.phase = 'PLAYING'

        startRound(sock, chatId)

    }, 60000)
}

async function startRound(sock, chatId) {

    const game = wcgGames.get(chatId)

    if (!game) return

    if (game.players.length === 1) {

        await sock.sendMessage(chatId, {
            text: `🏆 @${game.players[0].jid.split('@')[0]} wins the WCG game!`,
            mentions: [game.players[0].jid]
        })

        wcgGames.delete(chatId)
        return
    }

    if (!game.currentPlayer) {
        game.currentPlayer = 0
    }

    const player = game.players[game.currentPlayer]

    game.currentLetter = getRandomLetter()
    game.minLength = getRequiredLength(game.round)

    await sock.sendMessage(chatId, {
        text:
`🎯 *WCG ROUND ${game.round}*

👤 Player: @${player.jid.split('@')[0]}
🔠 Starts With: *${game.currentLetter.toUpperCase()}*
📏 Minimum Length: *${game.minLength}*

⏰ 20 seconds remaining.`,
        mentions: [player.jid]
    })

    game.timeout = setTimeout(async () => {

        await sock.sendMessage(chatId, {
            text: `❌ @${player.jid.split('@')[0]} ran out of time and was eliminated.`,
            mentions: [player.jid]
        })

        game.players.splice(game.currentPlayer, 1)

        if (game.currentPlayer >= game.players.length) {
            game.currentPlayer = 0
        }

        startRound(sock, chatId)

    }, 20000)
}

async function handleWCGWord(sock, chatId, sender, word) {

    const game = wcgGames.get(chatId)

    if (!game || game.phase !== 'PLAYING') return false

    const player = game.players[game.currentPlayer]

    if (!player || player.jid !== sender) return false

    word = word.toLowerCase().trim()

    if (!word.startsWith(game.currentLetter)) {
        await sock.sendMessage(chatId, {
            text: `❌ Word must start with *${game.currentLetter.toUpperCase()}*`
        })
        return true
    }

    if (word.length < game.minLength) {
        await sock.sendMessage(chatId, {
            text: `❌ Word must contain at least *${game.minLength}* letters`
        })
        return true
    }

    if (game.usedWords.includes(word)) {
        await sock.sendMessage(chatId, {
            text: '❌ Word already used'
        })
        return true
    }

    const valid = await validateWord(word)

    if (!valid) {
        await sock.sendMessage(chatId, {
            text: '❌ Invalid English word'
        })
        return true
    }

    clearTimeout(game.timeout)

    game.usedWords.push(word)

    await sock.sendMessage(chatId, {
        text: `✅ Accepted: *${word}*`
    })

    game.currentPlayer++

    if (game.currentPlayer >= game.players.length) {
        game.currentPlayer = 0
        game.round++
    }

    startRound(sock, chatId)

    return true
}

module.exports = {
    wcgGames,
    createWCGGame,
    startWCGJoinPhase,
    handleWCGWord
          }
