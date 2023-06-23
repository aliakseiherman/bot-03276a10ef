require('dotenv').config()
const express = require('express')
const bodyParser = require('body-parser')
var cors = require('cors')
const { client, xml } = require('@xmpp/client')

const port = process.env.PORT || 3001

let corsOptions = {
    origin: ['http://localhost:3000', process.env['CORS1']],
}

let state = {}
let handshake = {}

let queue = {}

const credentials = [1, 2].map(n => ({
    service: process.env[`SERVICE_${n}`],
    domain: process.env[`DOMAIN_${n}`],
    resource: process.env[`RESOURCE_${n}`],
    username: process.env[`USER_${n}`],
    password: process.env[`PASSWORD_${n}`],
    from: process.env[`FROM_${n}`],
    to: process.env[`TO_${n}`],
}))

const build = ({ service, domain, resource, username, password, from, to }) => {
    state[domain] = false
    handshake[domain] = false
    queue[domain] = []

    const xmpp = client({
        service,
        domain,
        resource,
        username,
        password
    })

    xmpp.on('error', (err) => {
        console.error(err)
    })

    xmpp.on('offline', () => {
        state[domain] = false
        console.log('offline')
    })

    xmpp.on('stanza', async (stanza) => {

    })

    xmpp.on('online', async (address) => {
        state[domain] = true
        handshake[domain] = true

        await xmpp.send(xml('presence'))
    })

    setInterval(async () => {
        if (!handshake[domain]) return

        if (state[domain]) {
            await xmpp.send(xml('presence'))
            await sendSelf('llo')
        }
    }, 60000)

    const sendSelf = async (text) => {
        const message = xml(
            'message',
            { type: 'chat', to: from },
            xml('body', {}, text),
        )
        await xmpp.send(message)
    }

    return {
        xmpp,
        from,
        to,
        domain
    }
}

const clients = credentials.map(server => build(server))
clients.forEach(c => (c.xmpp.start().catch()))


const send_ = async (text, { xmpp, to }) => {
    const message = xml(
        'message',
        { type: 'chat', to: to },
        xml('body', {}, text),
    )

    await xmpp.send(message)
}

const send = async (text) => {
    clients.forEach((async c => {
        if (state[c.domain]) {
            await send_(text, c)
        } else {
            queue[c.domain].push(message)
        }        
    }))
}

setInterval(async () => {
    clients.forEach(async c => {
        if (!handshake[c.domain]) return

        if (queue[c.domain].length > 0 && state[c.domain]) {
            try {
                let message = queue[c.domain].shift()
                await send_(message, c)
            } catch (err) {
                console.error(err)
            }
        }
    })
}, 1000)

const app = express()
app.use(bodyParser.json())
app.use(cors(corsOptions))

app.get('/', async (req, res) => {
    res.status(200).send(`Online :::: ${JSON.stringify(state)} ${JSON.stringify(queue)}`)
})

app.post('/send', async (req, res) => {
    res.sendStatus(200)
    await send(req.body['message'])
})

app.listen(port, () => console.log(`Example app listening on port ${port}!`))