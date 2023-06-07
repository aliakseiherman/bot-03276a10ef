require('dotenv').config()
const express = require('express')
const bodyParser = require('body-parser')
var cors = require('cors')
const { client, xml } = require('@xmpp/client')

const port = process.env.PORT || 3001

let corsOptions = {
    origin: ['http://localhost:3000', process.env['CORS1']],
}

let isOnline = false
let handshake = false

let queue = []

const xmpp = client({
    service: process.env['SERVICE'],
    domain: process.env['DOMAIN'],
    resource: process.env['RESOURCE'],
    username: process.env['USER'],
    password: process.env['PASSWORD'],
})

xmpp.on('error', (err) => {
    console.error(err)
})

xmpp.on('offline', () => {
    isOnline = false
    console.log('offline')
})

xmpp.on('stanza', async (stanza) => {

})

xmpp.on('online', async (address) => {
    isOnline = true
    handshake = true

    await xmpp.send(xml('presence'))
})

xmpp.start().catch()

const send = async (text) => {
    const message = xml(
        'message',
        { type: 'chat', to: process.env['TO'] },
        xml('body', {}, text),
    )
    await xmpp.send(message)
}

const sendSelf = async (text) => {
    const message = xml(
        'message',
        { type: 'chat', to: process.env['FROM'] },
        xml('body', {}, text),
    )
    await xmpp.send(message)
}

setInterval(async () => {
    if (!handshake) return

    if (queue.length > 0 && isOnline) {
        try {
            let message = queue.shift()
            await send(message)
        } catch (err) {
            console.error(err)
        }
    }
}, 1000)

setInterval(async () => {
    if (!handshake) return

    if (isOnline) {
        await xmpp.send(xml('presence'))
        await sendSelf('llo')
    }
}, 60000)


const app = express()
app.use(bodyParser.json())
app.use(cors(corsOptions))

app.get('/', async (req, res) => {
    res.status(200).send(`Online :::: ${isOnline} ${JSON.stringify(queue)}`)
})

app.post('/send', async (req, res) => {
    res.sendStatus(200)

    if (isOnline) {
        await send(req.body['message'])
    } else {
        queue.push(message)
    }
})

app.listen(port, () => console.log(`Example app listening on port ${port}!`))