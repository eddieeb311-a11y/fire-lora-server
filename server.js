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

// ===== Бүртгэлтэй хэрэглэгчид (alarm мэдэгдэл хүлээн авах) =====
let registeredUsers = {};
// Admin chat ID-г автоматаар нэмэх
if (CHAT_ID && CHAT_ID !== 'YOUR_CHAT_ID') {
  registeredUsers[CHAT_ID] = { name: 'Admin', registered: new Date().toISOString() };
}

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
    `📶 RSSI: ${event.rssi} dBm\n` +
    `🕐 Цаг: ${event.time}\n\n` +
    `❗ ЯАРАЛТАЙ АРГА ХЭМЖЭЭ АВНА УУ!`;

  // Бүх бүртгэлтэй хэрэглэгчид рүү илгээх
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
        const welcome =
          `🛡 *Онцгой Байдлын Хяналтын Систем*\n\n` +
          `Сайн байна уу, ${firstName}!\n\n` +
          `📋 *Команд жагсаалт:*\n` +
          `/status — Одоогийн статус харах\n` +
          `/register — Alarm мэдэгдэл хүлээн авах бүртгүүлэх\n` +
          `/unregister — Бүртгэлээс гарах\n` +
          `/test — Тест alarm илгээх\n` +
          `/help — Тусламж\n\n` +
          `🔥 Галын дохио ирэхэд бүртгэлтэй хэрэглэгчид рүү автоматаар мэдэгдэл очно.`;
        await sendTelegramTo(chatId, welcome);
      }

      else if (text === '/status') {
        const s = lastStatus;
        const statusEmoji = s.alarm ? '🔴 ALARM' : (s.status === 'online' ? '🟢 Хэвийн' : '⚫ Офлайн');
        const statusMsg =
          `📊 *Системийн Статус*\n\n` +
          `${statusEmoji}\n` +
          `📍 Төхөөрөмж: ${s.deviceId}\n` +
          `💨 Утааны түвшин: ${s.smoke}\n` +
          `🔋 Батарей: ${s.battery}%\n` +
          `🔔 Нийт дохио: ${s.totalAlarms}\n` +
          `🕐 Сүүлд: ${s.lastSeen || 'Мэдээлэл байхгүй'}\n\n` +
          `👥 Бүртгэлтэй: ${Object.keys(registeredUsers).length} хэрэглэгч`;
        await sendTelegramTo(chatId, statusMsg);
      }

      else if (text === '/register') {
        if (registeredUsers[chatId]) {
          await sendTelegramTo(chatId, `✅ ${firstName}, та аль хэдийн бүртгэлтэй байна!`);
        } else {
          registeredUsers[chatId] = { name: firstName, registered: new Date().toISOString() };
          const count = Object.keys(registeredUsers).length;
          await sendTelegramTo(chatId, `✅ *Амжилттай бүртгэгдлээ!*\n\n${firstName}, та одоо галын дохионы мэдэгдэл хүлээн авна.\n\n👥 Нийт бүртгэлтэй: ${count} хэрэглэгч`);
        }
      }

      else if (text === '/unregister') {
        if (registeredUsers[chatId]) {
          delete registeredUsers[chatId];
          await sendTelegramTo(chatId, `❌ ${firstName}, та бүртгэлээс гарлаа. Цаашид alarm мэдэгдэл ирэхгүй.`);
        } else {
          await sendTelegramTo(chatId, `ℹ️ Та бүртгэлгүй байна. /register гэж бүртгүүлнэ үү.`);
        }
      }

      else if (text === '/test') {
        const now = new Date().toLocaleString('mn-MN', { timeZone: 'Asia/Ulaanbaatar' });
        const event = {
          deviceId: 'fire-node-01', alarm: true, source: 'TELEGRAM-TEST',
          smoke: 750, battery: 85, time: now, rssi: -65, snr: 8.5
        };
        lastStatus.alarm = true;
        lastStatus.source = 'TELEGRAM-TEST';
        lastStatus.smoke = 750;
        lastStatus.lastSeen = now;
        lastStatus.status = 'online';
        lastStatus.totalAlarms++;
        history.unshift(event);
        broadcast({ type: 'update', status: lastStatus, event: event });
        await sendTelegram(event);
      }

      else if (text === '/help') {
        await sendTelegramTo(chatId,
          `🛡 *Тусламж*\n\n` +
          `/status — Системийн статус\n` +
          `/register — Мэдэгдэл авах бүртгүүлэх\n` +
          `/unregister — Бүртгэлээс гарах\n` +
          `/test — Тест alarm\n\n` +
          `Галын дохио ирэхэд бүртгэлтэй бүх хэрэглэгчид рүү мэдэгдэл очно.`);
      }
    }
  } catch (err) {
    // Polling error - silent retry
  }
}

// 3 секунд тутам Telegram шинэчлэлт шалгах
setInterval(pollTelegram, 3000);
pollTelegram();

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
