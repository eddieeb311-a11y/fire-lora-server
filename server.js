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

// ===== ТОХИРГОО =====
const PORT = process.env.PORT || 3000;
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN || 'YOUR_BOT_TOKEN';
const CHAT_ID = process.env.CHAT_ID || 'YOUR_CHAT_ID';

// ===== Өгөгдөл хадгалах =====
let history = [];
let lastStatus = {
  deviceId: 'fire-node-01',
  alarm: false,
  source: 'N/A',
  smoke: 0,
  battery: 100,
  lastSeen: null,
  totalAlarms: 0,
  status: 'offline'
};

// ===== WebSocket =====
function broadcast(data) {
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
}

// ===== TTN Webhook =====
app.post('/ttn-webhook', async (req, res) => {
  try {
    const payload = req.body;
    const decoded = payload.uplink_message?.decoded_payload;

    if (!decoded) {
      res.status(200).send('No payload');
      return;
    }

    const now = new Date().toLocaleString('mn-MN', {
      timeZone: 'Asia/Ulaanbaatar'
    });

    const event = {
      deviceId: payload.end_device_ids?.device_id || 'fire-node-01',
      alarm: decoded.alarm || false,
      source: decoded.source || 'N/A',
      smoke: decoded.smoke || 0,
      battery: decoded.battery || 0,
      time: now,
      rssi: payload.uplink_message?.rx_metadata?.[0]?.rssi || 0,
      snr: payload.uplink_message?.rx_metadata?.[0]?.snr || 0
    };

    lastStatus.alarm = event.alarm;
    lastStatus.source = event.source;
    lastStatus.smoke = event.smoke;
    lastStatus.battery = event.battery;
    lastStatus.lastSeen = now;
    lastStatus.status = 'online';
    if (event.alarm) lastStatus.totalAlarms++;

    history.unshift(event);
    if (history.length > 100) history.pop();

    broadcast({ type: 'update', status: lastStatus, event: event });

    if (event.alarm) {
      await sendTelegram(event);
    }

    console.log(`[${now}] ${event.alarm ? 'ALARM!' : 'OK'} smoke=${event.smoke} bat=${event.battery}%`);
    res.status(200).send('OK');
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(500).send('Error');
  }
});

// ===== Telegram =====
async function sendTelegram(event) {
  if (!TELEGRAM_TOKEN || TELEGRAM_TOKEN === 'YOUR_BOT_TOKEN') return;

  const message =
    `🔥 *ГАЛЫН АЮУЛ!*\n\n` +
    `📍 Төхөөрөмж: ${event.deviceId}\n` +
    `⚠️ Эх үүсвэр: ${event.source}\n` +
    `💨 Утаа: ${event.smoke}\n` +
    `🔋 Батарей: ${event.battery}%\n` +
    `📶 RSSI: ${event.rssi} dBm\n` +
    `🕐 Цаг: ${event.time}\n\n` +
    `❗ ЯАРАЛТАЙ АРГА ХЭМЖЭЭ АВНА УУ!`;

  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: message,
        parse_mode: 'Markdown'
      })
    });
  } catch (err) {
    console.error('Telegram error:', err);
  }
}

// ===== API =====
app.get('/api/status', (req, res) => {
  res.json(lastStatus);
});

app.get('/api/history', (req, res) => {
  res.json(history);
});

// ===== Test endpoints =====
app.post('/api/test-alarm', (req, res) => {
  const now = new Date().toLocaleString('mn-MN', { timeZone: 'Asia/Ulaanbaatar' });
  const event = {
    deviceId: 'fire-node-01',
    alarm: true,
    source: 'TEST',
    smoke: 750,
    battery: 85,
    time: now,
    rssi: -65,
    snr: 8.5
  };
  lastStatus.alarm = true;
  lastStatus.source = 'TEST';
  lastStatus.smoke = 750;
  lastStatus.lastSeen = now;
  lastStatus.status = 'online';
  lastStatus.totalAlarms++;
  history.unshift(event);
  broadcast({ type: 'update', status: lastStatus, event: event });
  sendTelegram(event);
  res.json({ ok: true });
});

app.post('/api/test-ok', (req, res) => {
  const now = new Date().toLocaleString('mn-MN', { timeZone: 'Asia/Ulaanbaatar' });
  const event = {
    deviceId: 'fire-node-01',
    alarm: false,
    source: 'heartbeat',
    smoke: 120,
    battery: 92,
    time: now,
    rssi: -72,
    snr: 7.2
  };
  lastStatus.alarm = false;
  lastStatus.smoke = 120;
  lastStatus.battery = 92;
  lastStatus.lastSeen = now;
  lastStatus.status = 'online';
  history.unshift(event);
  broadcast({ type: 'update', status: lastStatus, event: event });
  res.json({ ok: true });
});

server.listen(PORT, () => {
  console.log('');
  console.log('Fire LoRa Dashboard: http://localhost:' + PORT);
  console.log('TTN Webhook URL:     http://YOUR_IP:' + PORT + '/ttn-webhook');
  console.log('Test alarm:          POST http://localhost:' + PORT + '/api/test-alarm');
  console.log('Test OK:             POST http://localhost:' + PORT + '/api/test-ok');
  console.log('');
});
