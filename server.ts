import express from 'express';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

interface StoredLeaderboardEntry {
  userId: string;
  name: string;
  username?: string;
  score: number;
  maxFlow: number;
  avatarShape: string;
  groupKey: string;
  updatedAt: string;
}

const PORT = Number(process.env.PORT) || 3000;
const GAME_SHORT_NAME = process.env.TELEGRAM_GAME_SHORT_NAME || 'neonascentomni';
const DATA_DIR = path.resolve(process.cwd(), 'data');
const LEADERBOARD_FILE = path.join(DATA_DIR, 'telegram-leaderboard.json');

function loadStoredScores(): StoredLeaderboardEntry[] {
  try {
    if (fs.existsSync(LEADERBOARD_FILE)) {
      const raw = fs.readFileSync(LEADERBOARD_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // ignore
  }
  return [];
}

function saveStoredScores(entries: StoredLeaderboardEntry[]): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(LEADERBOARD_FILE, JSON.stringify(entries, null, 2), 'utf8');
  } catch {
    // ignore
  }
}

async function callTelegramApi(
  token: string,
  method: string,
  payload: Record<string, unknown>
): Promise<{ ok: boolean; result?: unknown }> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return (await res.json()) as { ok: boolean; result?: unknown };
  } catch {
    return { ok: false };
  }
}

async function startServer() {
  const app = express();
  app.use(express.json());

  // CORS headers for cross-origin or WebView requests
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  // 1. GET /api/telegram/leaderboard
  app.get('/api/telegram/leaderboard', async (req, res) => {
    const token = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN || '';
    const inlineMessageId = String(
      req.query.imid || req.query.inline_message_id || req.query.inlineMessageId || ''
    ).trim();
    const chatId = String(req.query.cid || req.query.chat_id || req.query.chatId || '').trim();
    const messageId = String(
      req.query.mid || req.query.message_id || req.query.messageId || ''
    ).trim();
    const userId = String(req.query.uid || req.query.user_id || req.query.userId || '').trim();
    const groupKey =
      inlineMessageId || (chatId && messageId ? `${chatId}:${messageId}` : 'global');

    const stored = loadStoredScores();
    const filtered = stored.filter(
      (s) => groupKey === 'global' || s.groupKey === groupKey || s.groupKey === 'global'
    );

    // Optionally merge official Telegram getGameHighScores if token and message identifiers are present
    if (token && userId && /^\d+$/.test(userId) && (inlineMessageId || (chatId && messageId))) {
      const tgPayload: Record<string, unknown> = { user_id: Number(userId) };
      if (inlineMessageId) {
        tgPayload.inline_message_id = inlineMessageId;
      } else {
        tgPayload.chat_id = /^-?\d+$/.test(chatId) ? Number(chatId) : chatId;
        tgPayload.message_id = Number(messageId);
      }

      const tgRes = await callTelegramApi(token, 'getGameHighScores', tgPayload);
      if (tgRes.ok && Array.isArray(tgRes.result)) {
        for (const row of tgRes.result as Array<{
          position: number;
          score: number;
          user: { id: number; first_name?: string; last_name?: string; username?: string };
        }>) {
          const uid = String(row.user.id);
          const fullName = `${row.user.first_name || 'Player'}${
            row.user.last_name ? ' ' + row.user.last_name : ''
          }`;
          const existing = filtered.find((x) => x.userId === uid);
          if (existing) {
            existing.score = Math.max(existing.score, row.score);
            existing.name = fullName;
            existing.username = row.user.username || existing.username;
          } else {
            filtered.push({
              userId: uid,
              name: fullName,
              username: row.user.username,
              score: row.score,
              maxFlow: 0,
              avatarShape: 'triangle',
              groupKey,
              updatedAt: new Date().toISOString(),
            });
          }
        }
      }
    }

    const leaderboard = filtered
      .sort((a, b) => b.score - a.score)
      .slice(0, 50)
      .map((item, idx) => ({
        position: idx + 1,
        userId: item.userId,
        name: item.name,
        username: item.username,
        score: item.score,
        maxFlow: item.maxFlow,
        avatarShape: item.avatarShape,
        updatedAt: item.updatedAt,
      }));

    res.json({ ok: true, gameShortName: GAME_SHORT_NAME, leaderboard });
  });

  // 2. POST /api/telegram/score
  // Saves the score and calls ONLY Telegram's outbound `setGameScore` method (no polling / no webhook!)
  app.post('/api/telegram/score', async (req, res) => {
    const body = req.body || {};
    const rawUid = body.uid ?? body.user_id ?? body.userId ?? 'anon';
    const rawName = body.name ?? body.first_name ?? 'Neon Pilot';
    const rawUsername = body.username ?? body.user ?? '';
    const rawImid = body.imid ?? body.inline_message_id ?? body.inlineMessageId ?? '';
    const rawCid = body.cid ?? body.chat_id ?? body.chatId ?? '';
    const rawMid = body.mid ?? body.message_id ?? body.messageId ?? '';

    const cleanScore = Math.max(0, Math.round(Number(body.score) || 0));
    const cleanUid = String(rawUid).trim();
    const cleanName = String(rawName).trim() || 'Neon Pilot';
    const cleanUsername = String(rawUsername).trim().replace(/^@/, '');
    const inlineMessageId = String(rawImid).trim();
    const chatId = String(rawCid).trim();
    const messageId = String(rawMid).trim();

    const groupKey =
      inlineMessageId || (chatId && messageId ? `${chatId}:${messageId}` : 'global');

    const stored = loadStoredScores();
    const existingIdx = stored.findIndex(
      (s) => s.userId === cleanUid && s.groupKey === groupKey
    );

    if (existingIdx >= 0) {
      const prev = stored[existingIdx];
      stored[existingIdx] = {
        ...prev,
        name: cleanName || prev.name,
        username: cleanUsername || prev.username,
        score: Math.max(prev.score, cleanScore),
        maxFlow: Math.max(prev.maxFlow || 0, Number(body.maxFlow) || 0),
        avatarShape: body.avatarShape || prev.avatarShape || 'triangle',
        updatedAt: new Date().toISOString(),
      };
    } else if (cleanScore > 0) {
      stored.push({
        userId: cleanUid,
        name: cleanName,
        username: cleanUsername || undefined,
        score: cleanScore,
        maxFlow: Number(body.maxFlow) || 0,
        avatarShape: body.avatarShape || 'triangle',
        groupKey,
        updatedAt: new Date().toISOString(),
      });
    }

    saveStoredScores(stored);

    // Call ONLY Telegram's outbound `setGameScore` method (supports both inline_message_id and chat_id + message_id)
    let telegramUpdated = false;
    const token = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN || '';
    if (
      token &&
      cleanScore > 0 &&
      /^\d+$/.test(cleanUid) &&
      (inlineMessageId || (chatId && messageId))
    ) {
      const tgPayload: Record<string, unknown> = {
        user_id: Number(cleanUid),
        score: cleanScore,
        force: false,
      };
      if (inlineMessageId) {
        tgPayload.inline_message_id = inlineMessageId;
      } else {
        tgPayload.chat_id = /^-?\d+$/.test(chatId) ? Number(chatId) : chatId;
        tgPayload.message_id = Number(messageId);
      }

      const tgRes = await callTelegramApi(token, 'setGameScore', tgPayload);
      telegramUpdated = Boolean(tgRes.ok);
    }

    const leaderboard = stored
      .filter((s) => groupKey === 'global' || s.groupKey === groupKey || s.groupKey === 'global')
      .sort((a, b) => b.score - a.score)
      .slice(0, 50)
      .map((item, idx) => ({
        position: idx + 1,
        userId: item.userId,
        name: item.name,
        username: item.username,
        score: item.score,
        maxFlow: item.maxFlow,
        avatarShape: item.avatarShape,
        updatedAt: item.updatedAt,
      }));

    res.json({
      ok: true,
      telegramUpdated,
      leaderboard,
    });
  });

  const distPath = path.join(process.cwd(), 'dist');
  const distIndexHtml = path.join(distPath, 'index.html');
  const useStaticDist =
    process.env.VITE_DEV_SERVER !== 'true' &&
    (process.env.NODE_ENV === 'production' || fs.existsSync(distIndexHtml));

  if (useStaticDist) {
    const serveTelegramIndexHtml = (_req: express.Request, res: express.Response) => {
      try {
        const rawHtml = fs.readFileSync(distIndexHtml, 'utf8');
        const injectedHtml = rawHtml.replace(
          '<head>',
          '<head><script>window.__OMNI_TELEGRAM_DEPLOY__=true;</script>'
        );
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(injectedHtml);
      } catch {
        res.sendFile(distIndexHtml);
      }
    };
    app.get('/', serveTelegramIndexHtml);
    app.get('/index.html', serveTelegramIndexHtml);
    app.use(express.static(distPath));
    app.get('*all', serveTelegramIndexHtml);
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false, watch: null },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(
      `NEON ASCENT: OMNI Unified Server listening on http://0.0.0.0:${PORT} (mode: ${
        useStaticDist ? 'static-dist' : 'vite-dev'
      })`
    );
  });
}

startServer();
