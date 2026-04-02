const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const fetch = require('node-fetch');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// ===== ТОХИРГОО =====
const PORT = process.env.PORT || 3000;
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN || 'YOUR_BOT_TOKEN';
const CHAT_ID = process.env.CHAT_ID || 'YOUR_CHAT_ID';

// ===== Бүртгэлтэй хэрэглэгчид =====
let registeredUsers = {};
if (CHAT_ID && CHAT_ID !== 'YOUR_CHAT_ID') {
  registeredUsers[CHAT_ID] = { name: 'Admin', registered: new Date().toISOString() };
}

// ===== Төхөөрөмжийн байршлын тохиргоо =====
// Шинэ device нэмэхдээ энд бүртгэнэ
const DEVICE_LOCATIONS = {
  'fire-node-01': {
    building: 'ШУТИС, Мэдээлэл технологийн сургууль',
    floor: '1-р давхар, Лаборатори 101',
    district: 'Баянгол дүүрэг, 8-р хороо',
    street: 'Бага тойруу-14, Улаанбаатар',
    lat: 47.9184,
    lng: 106.9177
  },
  'fire-node-02': {
    building: 'ШУТИС, Мэдээлэл технологийн сургууль',
    floor: '2-р давхар, Серверийн өрөө 205',
    district: 'Баянгол дүүрэг, 8-р хороо',
    street: 'Бага тойруу-14, Улаанбаатар',
    lat: 47.9185,
    lng: 106.9178
  },
  'fire-node-03': {
    building: 'ШУТИС, Мэдээлэл технологийн сургууль',
    floor: '3-р давхар, Лекцийн танхим 302',
    district: 'Баянгол дүүрэг, 8-р хороо',
    street: 'Бага тойруу-14, Улаанбаатар',
    lat: 47.9186,
    lng: 106.9179
  },
  'fire-node-04': {
    building: 'ШУТИС, Мэдээлэл технологийн сургууль',
    floor: '2-р давхар, 204 тоот',
    district: 'Баянгол дүүрэг, 8-р хороо',
    street: 'Бага тойруу-14, Улаанбаатар',
    lat: 47.9184,
    lng: 106.9177
  }
};

// Шинэ device-д default байршил
const DEFAULT_LOCATION = {
  building: 'Тодорхойгүй барилга',
  floor: 'Тодорхойгүй давхар',
  district: 'Тодорхойгүй дүүрэг',
  street: 'Тодорхойгүй хаяг',
  lat: 47.9184,
  lng: 106.9177
};

// ===== Өгөгдөл хадгалах =====
let history = [];
let devices = {};

function getOrCreateDevice(deviceId) {
  if (!devices[deviceId]) {
    const loc = DEVICE_LOCATIONS[deviceId] || DEFAULT_LOCATION;
    devices[deviceId] = {
      deviceId: deviceId,
      alarm: false,
      source: 'N/A',
      smoke: 0,
      battery: 100,
      lastSeen: null,
      totalAlarms: 0,
      status: 'offline',
      rssi: 0,
      snr: 0,
      sf: 0,
      dataRate: '',
      payloadBytes: 0,
      devAddr: '',
      fPort: 0,
      fCnt: 0,
      uptime: 0,
      frequency: 0,
      bandwidth: 0,
      gatewayId: '',
      gatewayEui: '',
      // Байршлын мэдээлэл
      location: {
        building: loc.building,
        floor: loc.floor,
        district: loc.district,
        street: loc.street,
        lat: loc.lat,
        lng: loc.lng
      }
    };
  }
  return devices[deviceId];
}

// ===== WebSocket =====
function broadcast(data) {
  const msg = JSON.stringify(data);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  });
}

wss.on('connection', (ws) => {
  console.log('WebSocket client connected');
  // Шинэ холболтонд одоогийн бүх devices мэдээлэл илгээх
  ws.send(JSON.stringify({ type: 'init', devices: devices, history: history.slice(0, 50) }));
});

// ===== TTN Webhook =====
app.post('/ttn-webhook', async (req, res) => {
  try {
    const payload = req.body;
    const decoded = payload.uplink_message?.decoded_payload;
    const uplinkMsg = payload.uplink_message;

    if (!decoded && !uplinkMsg) {
      res.status(200).send('No payload');
      return;
    }

    const now = new Date().toLocaleString('mn-MN', {
      timeZone: 'Asia/Ulaanbaatar'
    });

    const deviceId = payload.end_device_ids?.device_id || 'unknown';
    const devAddr = payload.end_device_ids?.dev_addr || '';
    const rxMeta = uplinkMsg?.rx_metadata?.[0] || {};
    const settings = uplinkMsg?.settings || {};

    // Data rate parsing (e.g., "SF7BW125" -> sf=7, bw=125)
    const dataRateStr = settings?.data_rate?.lora
      ? `SF${settings.data_rate.lora.spreading_factor}BW${settings.data_rate.lora.bandwidth / 1000}`
      : (uplinkMsg?.settings?.data_rate_index !== undefined ? `DR${uplinkMsg.settings.data_rate_index}` : '');
    const sf = settings?.data_rate?.lora?.spreading_factor || 0;
    const bandwidth = settings?.data_rate?.lora?.bandwidth || 0;
    const frequency = settings?.frequency ? (parseInt(settings.frequency) / 1000000).toFixed(1) : '868.0';

    // Payload хэмжээ
    const frmPayload = uplinkMsg?.frm_payload || '';
    const payloadBytes = frmPayload ? Math.ceil(frmPayload.length * 3 / 4) : 0;

    const event = {
      deviceId: deviceId,
      alarm: decoded?.alarm || false,
      source: decoded?.source || 'heartbeat',
      smoke: decoded?.smoke || 0,
      battery: decoded?.battery || 0,
      uptime: decoded?.uptime || 0,
      time: now,
      timestamp: new Date().toISOString(),
      rssi: rxMeta.rssi || 0,
      snr: rxMeta.snr || 0,
      sf: sf,
      dataRate: dataRateStr,
      payloadBytes: payloadBytes,
      devAddr: devAddr,
      fPort: uplinkMsg?.f_port || 0,
      fCnt: uplinkMsg?.f_cnt || 0,
      frequency: frequency,
      bandwidth: bandwidth,
      gatewayId: rxMeta.gateway_ids?.gateway_id || '',
      gatewayEui: rxMeta.gateway_ids?.eui || ''
    };

    // Device state шинэчлэх
    const device = getOrCreateDevice(deviceId);
    device.alarm = event.alarm;
    device.source = event.source;
    device.smoke = event.smoke;
    device.battery = event.battery;
    device.lastSeen = now;
    device.status = 'online';
    device.rssi = event.rssi;
    device.snr = event.snr;
    device.sf = event.sf;
    device.dataRate = event.dataRate;
    device.payloadBytes = event.payloadBytes;
    device.devAddr = event.devAddr;
    device.fPort = event.fPort;
    device.fCnt = event.fCnt;
    device.uptime = event.uptime;
    device.frequency = event.frequency;
    device.bandwidth = event.bandwidth;
    device.gatewayId = event.gatewayId;
    device.gatewayEui = event.gatewayEui;
    if (event.alarm) device.totalAlarms++;

    history.unshift(event);
    if (history.length > 100) history.pop();

    broadcast({ type: 'update', device: device, event: event, devices: devices });

    if (event.alarm) {
      await sendTelegram(event);
    }

    console.log(`[${now}] ${deviceId} | ${event.alarm ? 'ALARM!' : 'OK'} | smoke=${event.smoke} bat=${event.battery}% | RSSI=${event.rssi} SNR=${event.snr} ${event.dataRate} | ${event.payloadBytes}B`);
    res.status(200).send('OK');
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(500).send('Error');
  }
});

// ===== Telegram =====
async function sendTelegramTo(chatId, message, parseMode = 'Markdown') {
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: parseMode })
    });
  } catch (err) {
    console.error('Telegram send error:', err);
  }
}

async function sendTelegram(event) {
  if (!TELEGRAM_TOKEN || TELEGRAM_TOKEN === 'YOUR_BOT_TOKEN') return;

  const message =
    `🔥 *ГАЛЫН АЮУЛ!*\n\n` +
    `📍 Төхөөрөмж: ${event.deviceId}\n` +
    `⚠️ Эх үүсвэр: ${event.source}\n` +
    `💨 Утаа: ${event.smoke}\n` +
    `🔋 Батарей: ${event.battery}%\n` +
    `📶 RSSI: ${event.rssi} dBm | SNR: ${event.snr}\n` +
    `📡 ${event.dataRate} | ${event.frequency} MHz\n` +
    `🕐 Цаг: ${event.time}\n\n` +
    `❗ ЯАРАЛТАЙ АРГА ХЭМЖЭЭ АВНА УУ!`;

  const chatIds = Object.keys(registeredUsers);
  if (chatIds.length === 0 && CHAT_ID && CHAT_ID !== 'YOUR_CHAT_ID') {
    chatIds.push(CHAT_ID);
  }
  for (const cid of chatIds) {
    await sendTelegramTo(cid, message);
  }
}

// ===== Telegram Bot Polling =====
let telegramOffset = 0;

async function pollTelegram() {
  if (!TELEGRAM_TOKEN || TELEGRAM_TOKEN === 'YOUR_BOT_TOKEN') return;

  try {
    const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/getUpdates?offset=${telegramOffset}&timeout=5`);
    const data = await res.json();
    if (!data.ok || !data.result) return;

    for (const update of data.result) {
      telegramOffset = update.update_id + 1;
      const msg = update.message;
      if (!msg || !msg.text) continue;

      const chatId = msg.chat.id.toString();
      const text = msg.text.trim();
      const firstName = msg.chat.first_name || 'Хэрэглэгч';

      if (text === '/start') {
        await sendTelegramTo(chatId,
          `🛡 *Онцгой Байдлын Хяналтын Систем*\n\n` +
          `Сайн байна уу, ${firstName}!\n\n` +
          `📋 *Команд:*\n` +
          `/status — Статус\n` +
          `/register — Бүртгүүлэх\n` +
          `/unregister — Бүртгэлээс гарах\n` +
          `/test — Тест alarm\n` +
          `/help — Тусламж`);
      }
      else if (text === '/status') {
        const deviceList = Object.values(devices);
        let statusMsg = `📊 *Системийн Статус*\n\n`;
        if (deviceList.length === 0) {
          statusMsg += `⚫ Төхөөрөмж байхгүй`;
        } else {
          for (const d of deviceList) {
            const emoji = d.alarm ? '🔴' : (d.status === 'online' ? '🟢' : '⚫');
            statusMsg += `${emoji} *${d.deviceId}*\n` +
              `  💨 Утаа: ${d.smoke} | 🔋 ${d.battery}%\n` +
              `  📶 RSSI: ${d.rssi} | SNR: ${d.snr}\n` +
              `  📡 ${d.dataRate} | 🕐 ${d.lastSeen || 'N/A'}\n\n`;
          }
        }
        statusMsg += `👥 Бүртгэлтэй: ${Object.keys(registeredUsers).length}`;
        await sendTelegramTo(chatId, statusMsg);
      }
      else if (text === '/register') {
        if (!registeredUsers[chatId]) {
          registeredUsers[chatId] = { name: firstName, registered: new Date().toISOString() };
        }
        await sendTelegramTo(chatId, `✅ *${firstName}*, бүртгэгдлээ! Alarm мэдэгдэл хүлээн авна.`);
      }
      else if (text === '/unregister') {
        delete registeredUsers[chatId];
        await sendTelegramTo(chatId, `❌ Бүртгэлээс гарлаа.`);
      }
      else if (text === '/test') {
        const now = new Date().toLocaleString('mn-MN', { timeZone: 'Asia/Ulaanbaatar' });
        const event = {
          deviceId: 'test-node', alarm: true, source: 'TELEGRAM-TEST',
          smoke: 0, battery: 85, time: now, rssi: -45, snr: 12,
          sf: 9, dataRate: 'SF9BW125', payloadBytes: 6, frequency: '868.1'
        };
        const device = getOrCreateDevice('test-node');
        Object.assign(device, { alarm: true, source: 'TELEGRAM-TEST', smoke: 0, battery: 85, lastSeen: now, status: 'online', totalAlarms: device.totalAlarms + 1, rssi: -45, snr: 12, sf: 9, dataRate: 'SF9BW125' });
        history.unshift(event);
        broadcast({ type: 'update', device, event, devices });
        await sendTelegram(event);
      }
      else if (text === '/help') {
        await sendTelegramTo(chatId,
          `🛡 *Тусламж*\n\n/status — Статус\n/register — Бүртгүүлэх\n/unregister — Гарах\n/test — Тест alarm`);
      }
    }
  } catch (err) { /* silent */ }
}

setInterval(pollTelegram, 3000);
pollTelegram();

// ===== API =====
app.get('/api/status', (req, res) => res.json(devices));
app.get('/api/history', (req, res) => res.json(history));
app.get('/api/devices', (req, res) => res.json(devices));

app.post('/api/test-alarm', (req, res) => {
  const now = new Date().toLocaleString('mn-MN', { timeZone: 'Asia/Ulaanbaatar' });
  const event = {
    deviceId: 'fire-node-04', alarm: true, source: 'test', smoke: 0, battery: 85,
    time: now, timestamp: new Date().toISOString(), rssi: -45, snr: 12.5,
    sf: 9, dataRate: 'SF9BW125', payloadBytes: 6, fPort: 1, fCnt: 42,
    frequency: '868.1', devAddr: '260B5723'
  };
  const device = getOrCreateDevice('fire-node-04');
  Object.assign(device, { alarm: true, source: 'test', smoke: 0, battery: 85, lastSeen: now, status: 'online', totalAlarms: device.totalAlarms + 1, rssi: -45, snr: 12.5, sf: 9, dataRate: 'SF9BW125', payloadBytes: 6, fPort: 1, fCnt: 42 });
  history.unshift(event);
  broadcast({ type: 'update', device, event, devices });
  sendTelegram(event);
  res.json({ ok: true });
});

app.post('/api/test-ok', (req, res) => {
  const now = new Date().toLocaleString('mn-MN', { timeZone: 'Asia/Ulaanbaatar' });
  const event = {
    deviceId: 'fire-node-04', alarm: false, source: 'heartbeat', smoke: 0, battery: 92,
    time: now, timestamp: new Date().toISOString(), rssi: -42, snr: 13.0,
    sf: 9, dataRate: 'SF9BW125', payloadBytes: 6, fPort: 1, fCnt: 43,
    frequency: '868.1', devAddr: '260B5723'
  };
  const device = getOrCreateDevice('fire-node-04');
  Object.assign(device, { alarm: false, smoke: 0, battery: 92, lastSeen: now, status: 'online', rssi: -42, snr: 13, sf: 9, dataRate: 'SF9BW125', payloadBytes: 6, fPort: 1, fCnt: 43 });
  history.unshift(event);
  broadcast({ type: 'update', device, event, devices });
  res.json({ ok: true });
});

server.listen(PORT, () => {
  console.log('');
  console.log('=== Fire LoRa Dashboard Server ===');
  console.log(`Dashboard:    http://localhost:${PORT}`);
  console.log(`TTN Webhook:  POST /ttn-webhook`);
  console.log(`API Status:   GET /api/status`);
  console.log(`API History:  GET /api/history`);
  console.log(`Test Alarm:   POST /api/test-alarm`);
  console.log(`Test OK:      POST /api/test-ok`);
  console.log('');
});
