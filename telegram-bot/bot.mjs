/**
 * Standalone Telegram Score & Leaderboard Microservice (No Polling / No Webhook!)
 *
 * All `getUpdates` (pollUpdates) and `setWebhook` calls are completely removed
 * so this service NEVER conflicts (409 Conflict) with your main Python cPanel bot.
 * It only handles:
 *   - GET  /api/telegram/leaderboard
 *   - POST /api/telegram/score (saves score & calls outbound `setGameScore` only)
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN || '';
const PORT = Number(process.env.PORT || 8787);

const DB_FILE = path.resolve(process.cwd(), 'telegram-leaderboard-db.json');

function readDb() {
  try {
    if (fs.existsSync(DB_FILE)) {
      return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    }
  } catch {
    // ignore
  }
  return [];
}

function writeDb(list) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(list, null, 2), 'utf8');
  } catch {
    // ignore
  }
}

async function tgApi(method, payload) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return await res.json();
  } catch {
    return { ok: false };
  }
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const urlObj = new URL(req.url || '/', `http://localhost:${PORT}`);

  if (req.method === 'GET' && urlObj.pathname === '/api/telegram/leaderboard') {
    const list = readDb()
      .sort((a, b) => b.score - a.score)
      .slice(0, 50)
      .map((item, idx) => ({ ...item, position: idx + 1 }));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, leaderboard: list }));
    return;
  }

  if (req.method === 'POST' && urlObj.pathname === '/api/telegram/score') {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const cleanScore = Math.max(0, Math.round(Number(payload.score) || 0));
        const uid = String(payload.uid ?? payload.user_id ?? payload.userId ?? 'anon').trim();
        const name = String(payload.name ?? payload.first_name ?? 'Neon Pilot').trim();
        const username = String(payload.username ?? '').trim().replace(/^@/, '');
        const inlineMessageId = String(
          payload.imid ?? payload.inline_message_id ?? payload.inlineMessageId ?? ''
        ).trim();
        const chatId = String(payload.cid ?? payload.chat_id ?? payload.chatId ?? '').trim();
        const messageId = String(
          payload.mid ?? payload.message_id ?? payload.messageId ?? ''
        ).trim();

        const list = readDb();
        const idx = list.findIndex((x) => String(x.userId) === uid);
        if (idx >= 0) {
          list[idx].score = Math.max(list[idx].score, cleanScore);
          list[idx].maxFlow = Math.max(list[idx].maxFlow || 0, Number(payload.maxFlow) || 0);
          list[idx].name = name || list[idx].name;
          list[idx].username = username || list[idx].username;
        } else if (cleanScore > 0) {
          list.push({
            userId: uid,
            name,
            username,
            score: cleanScore,
            maxFlow: Number(payload.maxFlow) || 0,
            avatarShape: payload.avatarShape || 'triangle',
            updatedAt: new Date().toISOString(),
          });
        }
        writeDb(list);

        let telegramUpdated = false;
        if (
          BOT_TOKEN &&
          /^\d+$/.test(uid) &&
          cleanScore > 0 &&
          (inlineMessageId || (chatId && messageId))
        ) {
          const tgParams = { user_id: Number(uid), score: cleanScore, force: false };
          if (inlineMessageId) {
            tgParams.inline_message_id = inlineMessageId;
          } else {
            tgParams.chat_id = /^-?\d+$/.test(chatId) ? Number(chatId) : chatId;
            tgParams.message_id = Number(messageId);
          }
          const tgRes = await tgApi('setGameScore', tgParams);
          telegramUpdated = Boolean(tgRes.ok);
        }

        const sorted = list
          .sort((a, b) => b.score - a.score)
          .slice(0, 50)
          .map((item, i) => ({ ...item, position: i + 1 }));

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, telegramUpdated, leaderboard: sorted }));
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false }));
      }
    });
    return;
  }

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'NEON ASCENT SCORE SERVER ACTIVE (NO POLLING)' }));
});

server.listen(PORT, () => {
  console.log(`[Neon Ascent Score Server] Listening on port ${PORT} (No Polling / No Webhook)`);
});
