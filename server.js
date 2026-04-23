/**
 * FireBridge — Custom Next.js + Express + WebSocket server
 *
 * Handles:
 *   POST /ttn-webhook       — TTN LoRaWAN uplink
 *   GET  /api/status        — device state
 *   GET  /api/history       — last 100 events
 *   GET  /api/devices       — device list
 *   PUT  /api/device/:id/location — update device location
 *   POST /api/test-alarm    — inject test alarm
 *   POST /api/test-ok       — inject heartbeat
 *   WS   /                  — real-time push to browser
 *   *    everything else    — Next.js pages
 */

const { createServer } = require('http')
const { parse } = require('url')
const next = require('next')
const express = require('express')
const WebSocket = require('ws')
const fetch = require('node-fetch')

const dev = process.env.NODE_ENV !== 'production'
const port = parseInt(process.env.PORT || '3000', 10)

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN || ''
const CHAT_ID = process.env.CHAT_ID || ''

// ──────────────────────────────────────────────
// Location / device tables
// ──────────────────────────────────────────────
const LOCATION_MODE_MAP = {
  1: { building: 'А Блок', floor: '1-р давхар', zone: 'Дэнлүүний танхим',  district: 'Баянгол дүүрэг', lat: 47.9184,  lng: 106.9177  },
  2: { building: 'А Блок', floor: 'Подвал',     zone: 'Цахилгааны өрөө',   district: 'Баянгол дүүрэг', lat: 47.91845, lng: 106.91774 },
  3: { building: 'Б Блок', floor: '1-р давхар', zone: 'Агуулах',            district: 'Баянгол дүүрэг', lat: 47.9186,  lng: 106.9180  },
  4: { building: 'Б Блок', floor: '—',          zone: 'Шатны буланд',       district: 'Баянгол дүүрэг', lat: 47.91855, lng: 106.91785 },
}

// Эхний байршлаар эхлүүлнэ — node-н товч дарахад payload[2] ирж өөрчлөгдөнө
const DEVICE_LOCATIONS = {
  'fire-node-01': { ...LOCATION_MODE_MAP[1] },
  'fire-node-02': { ...LOCATION_MODE_MAP[1] },
  'fire-node-03': { ...LOCATION_MODE_MAP[1] },
  'fire-node-04': { ...LOCATION_MODE_MAP[1] },
}

const DEFAULT_LOCATION = {
  building: 'Тодорхойгүй Барилга', floor: 'Тодорхойгүй', zone: 'Тодорхойгүй',
  district: 'Улаанбаатар', lat: 47.9184, lng: 106.9177,
}

const EVENT_TYPE_MAP = { 0: 'heartbeat', 1: 'alarm', 2: 'test' }
const SOURCE_MAP     = { 0: 'system',    1: 'facp',  2: 'button' }

// ──────────────────────────────────────────────
// State
// ──────────────────────────────────────────────
let history = []
let devices = {}
let telegramOffset = 0

const registeredUsers = {}
if (CHAT_ID) registeredUsers[CHAT_ID] = { name: 'Admin', registered: new Date().toISOString() }

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────
function nowString() {
  return new Date().toLocaleString('mn-MN', {
    timeZone: 'Asia/Ulaanbaatar',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  })
}

function decodeBase64Payload(base64) {
  if (!base64) return null
  const bytes = Buffer.from(base64, 'base64')
  if (bytes.length < 7) return null
  const eventTypeCode = bytes[0]
  const sourceCode    = bytes[1]
  const locationId    = bytes[2]
  const battery       = bytes[3]
  const uptime        = bytes[4]
  const sequence      = (bytes[5] << 8) | bytes[6]
  return {
    payloadVersion: 1, eventTypeCode,
    eventType: EVENT_TYPE_MAP[eventTypeCode] || 'unknown',
    sourceCode, source: SOURCE_MAP[sourceCode] || 'unknown',
    locationId, battery, uptime, sequence,
    smoke: eventTypeCode === 1 ? 100 : 0,
    alarm: eventTypeCode === 1,
    rawBytes: Array.from(bytes),
  }
}

function normalizeDecoded(decoded, frmPayload) {
  if (decoded && typeof decoded === 'object') {
    const eventTypeCode = typeof decoded.eventTypeCode === 'number' ? decoded.eventTypeCode
      : decoded.alarm ? 1 : 0
    const sourceCode  = typeof decoded.sourceCode === 'number' ? decoded.sourceCode : 0
    const locationId  = typeof decoded.locationId === 'number' ? decoded.locationId : 1
    return {
      payloadVersion: Number(decoded.payloadVersion ?? 1),
      eventTypeCode,
      eventType: EVENT_TYPE_MAP[eventTypeCode] || 'heartbeat',
      sourceCode,
      source: typeof decoded.source === 'string' ? decoded.source : SOURCE_MAP[sourceCode] || 'system',
      locationId,
      battery:  Number(decoded.battery  ?? 0),
      uptime:   Number(decoded.uptime   ?? 0),
      sequence: Number(decoded.sequence ?? 0),
      smoke:    Number(decoded.smoke ?? (eventTypeCode === 1 ? 100 : 0)),
      alarm:    Boolean(decoded.alarm ?? (eventTypeCode === 1)),
      rawBytes: frmPayload ? Array.from(Buffer.from(frmPayload, 'base64')) : [],
    }
  }
  return decodeBase64Payload(frmPayload)
}

function getOrCreateDevice(deviceId) {
  if (!devices[deviceId]) {
    devices[deviceId] = {
      deviceId, alarm: false, source: 'system', eventType: 'heartbeat',
      smoke: 0, battery: 100, lastSeen: null, totalAlarms: 0, status: 'offline',
      rssi: 0, snr: 0, sf: 0, dataRate: '', payloadBytes: 0, devAddr: '',
      fPort: 0, fCnt: 0, uptime: 0, frequency: 0, bandwidth: 0,
      gatewayId: '', gatewayEui: '', locationId: 1, sequence: 0,
      location: { ...(DEVICE_LOCATIONS[deviceId] || DEFAULT_LOCATION) },
    }
  }
  return devices[deviceId]
}

function broadcast(data, wss) {
  const msg = JSON.stringify(data)
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) client.send(msg)
  })
}

function applyEvent(event) {
  const d = getOrCreateDevice(event.deviceId)
  Object.assign(d, {
    alarm: event.alarm, eventType: event.eventType, source: event.source,
    smoke: event.smoke, battery: event.battery, lastSeen: event.time,
    status: 'online', rssi: event.rssi, snr: event.snr, sf: event.sf,
    dataRate: event.dataRate, payloadBytes: event.payloadBytes, devAddr: event.devAddr,
    fPort: event.fPort, fCnt: event.fCnt, uptime: event.uptime,
    frequency: event.frequency, bandwidth: event.bandwidth,
    gatewayId: event.gatewayId, gatewayEui: event.gatewayEui,
    locationId: event.locationId, sequence: event.sequence,
    location: { ...event.location },
  })
  if (event.alarm) d.totalAlarms++
  return d
}

function buildEventFromWebhook(payload) {
  const uplink  = payload.uplink_message || {}
  const frm     = uplink.frm_payload || ''
  const decoded = normalizeDecoded(uplink.decoded_payload, frm)
  if (!decoded) return null

  const deviceId  = payload.end_device_ids?.device_id || 'unknown-node'
  const devAddr   = payload.end_device_ids?.dev_addr  || ''
  const rxMeta    = uplink.rx_metadata?.[0] || {}
  const settings  = uplink.settings || {}
  const lora      = settings.data_rate?.lora || {}
  const sf        = lora.spreading_factor || 0
  const bandwidth = lora.bandwidth || 0
  const dataRate  = sf ? `SF${sf}BW${bandwidth / 1000}` : ''
  const frequency = settings.frequency ? (Number(settings.frequency) / 1e6).toFixed(1) : '868.0'
  const payloadBytes = frm ? Math.ceil((frm.length * 3) / 4) : 0

  const baseLoc = DEVICE_LOCATIONS[deviceId] || DEFAULT_LOCATION
  const modeLoc = LOCATION_MODE_MAP[decoded.locationId]
  const location = modeLoc ? { ...baseLoc, ...modeLoc } : baseLoc

  return {
    deviceId, alarm: decoded.alarm, eventType: decoded.eventType,
    eventTypeCode: decoded.eventTypeCode, source: decoded.source,
    sourceCode: decoded.sourceCode, locationId: decoded.locationId,
    locationLabel: `${location.building} | ${location.floor} | ${location.zone}`,
    smoke: decoded.smoke, battery: decoded.battery, uptime: decoded.uptime,
    sequence: decoded.sequence, payloadVersion: decoded.payloadVersion,
    rawBytes: decoded.rawBytes,
    time: nowString(), timestamp: new Date().toISOString(),
    rssi: rxMeta.rssi || 0, snr: rxMeta.snr || 0,
    sf, dataRate, payloadBytes, devAddr,
    fPort: uplink.f_port || 0, fCnt: uplink.f_cnt || 0,
    frequency, bandwidth,
    gatewayId:  rxMeta.gateway_ids?.gateway_id || '',
    gatewayEui: rxMeta.gateway_ids?.eui        || '',
    location,
  }
}

function buildSyntheticEvent({ deviceId, eventType, eventTypeCode, source, sourceCode, locationId, battery, uptime, sequence, alarm }) {
  const baseLoc = DEVICE_LOCATIONS[deviceId] || DEFAULT_LOCATION
  const modeLoc = LOCATION_MODE_MAP[locationId]
  const location = modeLoc ? { ...baseLoc, ...modeLoc } : baseLoc
  return {
    deviceId, alarm, eventType, eventTypeCode, source, sourceCode, locationId,
    locationLabel: `${location.building} | ${location.floor} | ${location.zone}`,
    smoke: alarm ? 100 : 0, battery, uptime, sequence, payloadVersion: 1, rawBytes: [],
    time: nowString(), timestamp: new Date().toISOString(),
    rssi: -48, snr: 11.5, sf: 7, dataRate: 'SF7BW125', payloadBytes: 7,
    devAddr: '260B5723', fPort: 1, fCnt: sequence, frequency: '868.1', bandwidth: 125000,
    gatewayId: 'gw-ub-main', gatewayEui: '', location,
  }
}

// ──────────────────────────────────────────────
// Telegram
// ──────────────────────────────────────────────
async function sendTelegramTo(chatId, text) {
  if (!TELEGRAM_TOKEN) return
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
    })
  } catch (e) { /* silent */ }
}

async function sendTelegram(event) {
  if (!TELEGRAM_TOKEN) return
  const loc = event.location || DEFAULT_LOCATION
  const title = event.eventType === 'alarm' ? '🔥 ГАЛ ТҮЙМРИЙН ДОХИОЛОЛ'
    : event.eventType === 'test' ? '🧪 ТУРШИЛТЫН ДОХИО' : '📡 ТӨХӨӨРӨМЖИЙН МЭДЭГДЭЛ'
  const msg = `*${title}*\n\nТөхөөрөмж: ${event.deviceId}\nЭх үүсвэр: ${event.source}\nБайршил: ${loc.building} / ${loc.floor} / ${loc.zone}\nБатарей: ${event.battery}%\nRSSI: ${event.rssi} dBm | SNR: ${event.snr}\nLoRa: ${event.dataRate} @ ${event.frequency} MHz\nДараалал: ${event.sequence}\nЦаг: ${event.time}`
  const chatIds = Object.keys(registeredUsers)
  if (!chatIds.length && CHAT_ID) chatIds.push(CHAT_ID)
  for (const id of chatIds) await sendTelegramTo(id, msg)
}

async function pollTelegram(wss) {
  if (!TELEGRAM_TOKEN) return
  try {
    const res  = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/getUpdates?offset=${telegramOffset}&timeout=5`)
    const data = await res.json()
    if (!data.ok) return
    for (const update of data.result || []) {
      telegramOffset = update.update_id + 1
      const msg = update.message
      if (!msg?.text) continue
      const chatId = String(msg.chat.id)
      const text   = msg.text.trim()
      const name   = msg.chat.first_name || 'Хэрэглэгч'
      if (text === '/start') {
        await sendTelegramTo(chatId, `*FireBridge — LoRa Мониторинг*\n\nТавтай морил, ${name}.\n\n/status — төхөөрөмжийн байдал\n/register — мэдэгдэл идэвхжүүлэх\n/unregister — мэдэгдэл унтраах\n/test — туршилтын дохио`)
      } else if (text === '/register') {
        registeredUsers[chatId] = { name, registered: new Date().toISOString() }
        await sendTelegramTo(chatId, `*${name}* хэрэглэгчид мэдэгдэл идэвхжүүлсэн.`)
      } else if (text === '/unregister') {
        delete registeredUsers[chatId]
        await sendTelegramTo(chatId, 'Мэдэгдэл унтраагдсан.')
      } else if (text === '/status') {
        const list = Object.values(devices)
        if (!list.length) { await sendTelegramTo(chatId, 'Холбогдсон төхөөрөмж байхгүй.'); continue }
        const body = list.map(d => {
          const s = d.alarm ? 'ДОХИО' : d.status === 'online' ? 'ОНЛАЙН' : 'ОФЛАЙН'
          return `*${d.deviceId}* — ${s}\n${d.location.building} / ${d.location.floor} / ${d.location.zone}\nБатарей ${d.battery}% | RSSI ${d.rssi} | Дараалал ${d.sequence}`
        }).join('\n\n')
        await sendTelegramTo(chatId, body)
      } else if (text === '/test') {
        const event = buildSyntheticEvent({ deviceId: 'fire-node-01', eventType: 'test', eventTypeCode: 2, source: 'button', sourceCode: 2, locationId: 1, battery: 87, uptime: 12, sequence: Date.now() % 65535, alarm: false })
        const device = applyEvent(event)
        history.unshift(event)
        if (history.length > 100) history.pop()
        broadcast({ type: 'update', device, event, devices }, wss)
        await sendTelegram(event)
      }
    }
  } catch { /* silent */ }
}

// ──────────────────────────────────────────────
// Boot
// ──────────────────────────────────────────────
const nextApp = next({ dev })
const handle  = nextApp.getRequestHandler()

nextApp.prepare().then(() => {
  const expressApp = express()
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url, true)
    // Route API + webhook requests through express
    expressApp(req, res, () => handle(req, res, parsedUrl))
  })
  const wss = new WebSocket.Server({ server: httpServer })

  expressApp.use(express.json())
  expressApp.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*')
    res.header('Access-Control-Allow-Headers', 'Content-Type')
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS')
    if (req.method === 'OPTIONS') return res.sendStatus(200)
    next()
  })

  wss.on('connection', (ws) => {
    ws.send(JSON.stringify({ type: 'init', devices, history: history.slice(0, 50) }))
  })

  // TTN Webhook
  expressApp.post('/ttn-webhook', async (req, res) => {
    try {
      const event = buildEventFromWebhook(req.body)
      if (!event) return res.status(200).send('No supported payload')
      const device = applyEvent(event)
      history.unshift(event)
      if (history.length > 100) history.pop()
      broadcast({ type: 'update', device, event, devices }, wss)
      if (event.alarm || event.eventType === 'test') await sendTelegram(event)
      console.log(`[${event.time}] ${event.deviceId} | ${event.eventType.toUpperCase()} | ${event.locationLabel} | bat=${event.battery}% | RSSI=${event.rssi} | seq=${event.sequence}`)
      res.status(200).send('OK')
    } catch (e) { console.error('Webhook error:', e); res.status(500).send('Error') }
  })

  // REST APIs
  expressApp.get('/api/status',  (_, res) => res.json(devices))
  expressApp.get('/api/history', (_, res) => res.json(history))
  expressApp.get('/api/devices', (_, res) => res.json(devices))

  expressApp.get('/api/device/:id/location', (req, res) => {
    res.json(DEVICE_LOCATIONS[req.params.id] || DEFAULT_LOCATION)
  })

  expressApp.put('/api/device/:id/location', (req, res) => {
    const { id } = req.params
    const device = getOrCreateDevice(id)
    const { building, floor, zone, district, street, lat, lng } = req.body
    const updated = {
      building: building || device.location.building,
      floor:    floor    || device.location.floor,
      zone:     zone     || device.location.zone,
      district: district || device.location.district,
      street:   street   || device.location.street || '',
      lat: lat !== undefined ? Number(lat) : device.location.lat,
      lng: lng !== undefined ? Number(lng) : device.location.lng,
    }
    device.location = updated
    DEVICE_LOCATIONS[id] = { ...updated }
    broadcast({ type: 'update', device, devices }, wss)
    res.json({ ok: true, location: updated })
  })

  expressApp.post('/api/test-alarm', async (req, res) => {
    const event = buildSyntheticEvent({ deviceId: 'fire-node-02', eventType: 'alarm', eventTypeCode: 1, source: 'facp', sourceCode: 1, locationId: 2, battery: 84, uptime: 14, sequence: Date.now() % 65535, alarm: true })
    const device = applyEvent(event)
    history.unshift(event); if (history.length > 100) history.pop()
    broadcast({ type: 'update', device, event, devices }, wss)
    await sendTelegram(event)
    res.json({ ok: true, event })
  })

  expressApp.post('/api/test-ok', (req, res) => {
    const event = buildSyntheticEvent({ deviceId: 'fire-node-02', eventType: 'heartbeat', eventTypeCode: 0, source: 'system', sourceCode: 0, locationId: 2, battery: 92, uptime: 15, sequence: Date.now() % 65535, alarm: false })
    const device = applyEvent(event)
    history.unshift(event); if (history.length > 100) history.pop()
    broadcast({ type: 'update', device, event, devices }, wss)
    res.json({ ok: true, event })
  })

  setInterval(() => pollTelegram(wss), 3000)
  pollTelegram(wss)

  httpServer.listen(port, () => {
    console.log('')
    console.log('=== FireBridge Server ===')
    console.log(`Dashboard:  http://localhost:${port}`)
    console.log(`Webhook:    POST /ttn-webhook`)
    console.log(`Status:     GET  /api/status`)
    console.log(`History:    GET  /api/history`)
    console.log(`Test Alarm: POST /api/test-alarm`)
    console.log('')
  })
})
