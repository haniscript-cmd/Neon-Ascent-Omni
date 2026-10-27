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
const META_FILE = path.join(DATA_DIR, 'telegram-meta.json');
const DEFAULT_RESET_EPOCH = 2; // Bumped to 2 to automatically wipe farmed pre-fix XP/Orbs/Scores

interface LeaderboardMeta {
  resetEpoch: number;
  lastResetAt: string;
}

function loadMeta(): LeaderboardMeta {
  try {
    if (fs.existsSync(META_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(META_FILE, 'utf8'));
      if (typeof parsed.resetEpoch === 'number' && parsed.resetEpoch >= DEFAULT_RESET_EPOCH) {
        return parsed;
      }
    }
  } catch {
    // ignore
  }
  return {
    resetEpoch: DEFAULT_RESET_EPOCH,
    lastResetAt: new Date().toISOString(),
  };
}

function saveMeta(meta: LeaderboardMeta): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(META_FILE, JSON.stringify(meta, null, 2), 'utf8');
  } catch {
    // ignore
  }
}

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
): Promise<{ ok: boolean; result?: unknown; description?: string }> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return (await res.json()) as { ok: boolean; result?: unknown; description?: string };
  } catch {
    return { ok: false };
  }
}

/**
 * Resets a user's score in Telegram's official message leaderboard using `force: true`.
 * Tries `score: 0` first (which removes/zeros the score in Telegram); if Telegram rejects 0,
 * falls back to `score: 1` with `force: true`.
 */
async function forceResetTelegramUserScore(
  token: string,
  userId: number,
  target: { inlineMessageId?: string; chatId?: string; messageId?: string }
): Promise<boolean> {
  const basePayload: Record<string, unknown> = {
    user_id: userId,
    score: 0,
    force: true,
  };
  if (target.inlineMessageId) {
    basePayload.inline_message_id = target.inlineMessageId;
  } else if (target.chatId && target.messageId) {
    basePayload.chat_id = /^-?\d+$/.test(target.chatId) ? Number(target.chatId) : target.chatId;
    basePayload.message_id = Number(target.messageId);
  } else {
    return false;
  }

  const zeroRes = await callTelegramApi(token, 'setGameScore', basePayload);
  if (zeroRes.ok) return true;

  const oneRes = await callTelegramApi(token, 'setGameScore', {
    ...basePayload,
    score: 1,
  });
  return Boolean(oneRes.ok);
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
    const meta = loadMeta();
    const inlineMessageId = String(
      req.query.imid || req.query.inline_message_id || req.query.inlineMessageId || ''
    ).trim();
    const chatId = String(req.query.cid || req.query.chat_id || req.query.chatId || '').trim();
    const messageId = String(
      req.query.mid || req.query.message_id || req.query.messageId || ''
    ).trim();
    const groupKey =
      inlineMessageId || (chatId && messageId ? `${chatId}:${messageId}` : 'global');

    const stored = loadStoredScores();
    const filtered = stored.filter(
      (s) => groupKey === 'global' || s.groupKey === groupKey || s.groupKey === 'global'
    );

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

    res.json({
      ok: true,
      gameShortName: GAME_SHORT_NAME,
      resetEpoch: meta.resetEpoch,
      leaderboard,
    });
  });

  // 2. POST /api/telegram/score
  // Saves the score and calls ONLY Telegram's outbound `setGameScore` method (no polling / no webhook!)
  app.post('/api/telegram/score', async (req, res) => {
    const meta = loadMeta();
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

    let authoritativeBestScore = cleanScore;

    if (existingIdx >= 0) {
      const prev = stored[existingIdx];
      authoritativeBestScore = Math.max(prev.score, cleanScore);
      stored[existingIdx] = {
        ...prev,
        name: cleanName || prev.name,
        username: cleanUsername || prev.username,
        score: authoritativeBestScore,
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

    // Call ONLY Telegram's outbound `setGameScore` method with `force: true` using the server's
    // authoritative best score so any old pre-reset bugged Telegram score is overwritten!
    let telegramUpdated = false;
    const token = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN || '';
    if (
      token &&
      authoritativeBestScore > 0 &&
      /^\d+$/.test(cleanUid) &&
      (inlineMessageId || (chatId && messageId))
    ) {
      const tgPayload: Record<string, unknown> = {
        user_id: Number(cleanUid),
        score: authoritativeBestScore,
        force: true,
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
      resetEpoch: meta.resetEpoch,
      telegramUpdated,
      leaderboard,
    });
  });

  // 3. GET / POST /api/telegram/reset
  // Resets both the server leaderboard AND Telegram's official message scores (`setGameScore` with `force: true`),
  // and increments `resetEpoch` so all players' farmed local XP/Orbs/HighScore in Telegram are wiped!
  const handleResetLeaderboard = async (req: express.Request, res: express.Response) => {
    const adminKey = process.env.ADMIN_RESET_KEY || '';
    const providedKey = String(req.query.key || req.body?.key || '').trim();
    if (adminKey && providedKey !== adminKey) {
      res.status(403).json({ ok: false, error: 'Invalid ADMIN_RESET_KEY' });
      return;
    }

    const token = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN || '';
    const stored = loadStoredScores();
    let telegramResetCount = 0;

    // Also allow passing specific message identifiers (`imid` or `cid`+`mid`) to reset all high scores on that message
    const queryImid = String(req.query.imid || req.body?.imid || '').trim();
    const queryCid = String(req.query.cid || req.body?.cid || '').trim();
    const queryMid = String(req.query.mid || req.body?.mid || '').trim();

    const targetsToReset: Array<{
      userId: number;
      inlineMessageId?: string;
      chatId?: string;
      messageId?: string;
    }> = [];

    for (const entry of stored) {
      if (!/^\d+$/.test(entry.userId)) continue;
      const uidNum = Number(entry.userId);
      if (entry.groupKey && entry.groupKey !== 'global') {
        if (entry.groupKey.includes(':')) {
          const [cid, mid] = entry.groupKey.split(':');
          targetsToReset.push({ userId: uidNum, chatId: cid, messageId: mid });
        } else {
          targetsToReset.push({ userId: uidNum, inlineMessageId: entry.groupKey });
        }
      }
      if (queryImid) {
        targetsToReset.push({ userId: uidNum, inlineMessageId: queryImid });
      } else if (queryCid && queryMid) {
        targetsToReset.push({ userId: uidNum, chatId: queryCid, messageId: queryMid });
      }
    }

    if (token && targetsToReset.length > 0) {
      // Also query `getGameHighScores` using the first known userId on each message to catch any other users in Telegram
      const firstUid = targetsToReset[0].userId;
      const uniqueGroupTargets = new Map<
        string,
        { inlineMessageId?: string; chatId?: string; messageId?: string }
      >();
      for (const t of targetsToReset) {
        const k = t.inlineMessageId || `${t.chatId}:${t.messageId}`;
        uniqueGroupTargets.set(k, {
          inlineMessageId: t.inlineMessageId,
          chatId: t.chatId,
          messageId: t.messageId,
        });
      }

      for (const [, grp] of uniqueGroupTargets) {
        const hsPayload: Record<string, unknown> = { user_id: firstUid };
        if (grp.inlineMessageId) {
          hsPayload.inline_message_id = grp.inlineMessageId;
        } else if (grp.chatId && grp.messageId) {
          hsPayload.chat_id = /^-?\d+$/.test(grp.chatId) ? Number(grp.chatId) : grp.chatId;
          hsPayload.message_id = Number(grp.messageId);
        }
        const hsRes = await callTelegramApi(token, 'getGameHighScores', hsPayload);
        if (hsRes.ok && Array.isArray(hsRes.result)) {
          for (const row of hsRes.result as Array<{ user: { id: number } }>) {
            if (row.user?.id) {
              targetsToReset.push({
                userId: row.user.id,
                inlineMessageId: grp.inlineMessageId,
                chatId: grp.chatId,
                messageId: grp.messageId,
              });
            }
          }
        }
      }

      const seenKey = new Set<string>();
      for (const item of targetsToReset) {
        const dedup = `${item.userId}_${item.inlineMessageId || ''}_${item.chatId || ''}_${
          item.messageId || ''
        }`;
        if (seenKey.has(dedup)) continue;
        seenKey.add(dedup);
        const ok = await forceResetTelegramUserScore(token, item.userId, item);
        if (ok) telegramResetCount++;
      }
    }

    saveStoredScores([]);
    const prevMeta = loadMeta();
    const nextMeta: LeaderboardMeta = {
      resetEpoch: prevMeta.resetEpoch + 1,
      lastResetAt: new Date().toISOString(),
    };
    saveMeta(nextMeta);

    res.json({
      ok: true,
      message:
        'Leaderboard & player progression epoch reset! All Telegram scores forced to 0/1 and client XP/Orbs will reset on next open.',
      resetEpoch: nextMeta.resetEpoch,
      telegramResetCount,
      clearedServerEntries: stored.length,
    });
  };

  app.get('/api/telegram/reset', handleResetLeaderboard);
  app.post('/api/telegram/reset', handleResetLeaderboard);

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
