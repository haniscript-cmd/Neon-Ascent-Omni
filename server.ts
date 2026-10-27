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
const PROFILES_FILE = path.join(DATA_DIR, 'telegram-profiles.json');

export interface StoredPlayerProgress {
  userId: string;
  highScore: number;
  maxCombo: number;
  totalOrbs: number;
  runsPlayed: number;
  playerXp: number;
  playerLevel: number;
  playerShape: string;
  unlockedAvatars: string[];
  powerUpLevels: Record<string, number>;
  equippedPowerUps: string[];
  updatedAtMs: number;
}

function loadStoredProfiles(): Record<string, StoredPlayerProgress> {
  try {
    if (fs.existsSync(PROFILES_FILE)) {
      const raw = fs.readFileSync(PROFILES_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, StoredPlayerProgress>;
      }
    }
  } catch {
    // ignore
  }
  return {};
}

function saveStoredProfiles(profiles: Record<string, StoredPlayerProgress>): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(PROFILES_FILE, JSON.stringify(profiles, null, 2), 'utf8');
  } catch {
    // ignore
  }
}

function upsertPlayerProgress(
  uid: string,
  incoming: Partial<StoredPlayerProgress>
): StoredPlayerProgress | null {
  const cleanUid = String(uid || '').trim();
  if (!cleanUid || cleanUid === 'anon' || cleanUid.startsWith('pilot_')) {
    return null;
  }
  const profiles = loadStoredProfiles();
  const prev = profiles[cleanUid];

  const mergedUnlockedAvatars = Array.from(
    new Set([
      ...(prev?.unlockedAvatars || ['triangle', 'circle', 'square']),
      ...(Array.isArray(incoming.unlockedAvatars) ? incoming.unlockedAvatars : []),
    ])
  );

  const mergedPowerUpLevels: Record<string, number> = {
    ...(prev?.powerUpLevels || {}),
  };
  if (incoming.powerUpLevels && typeof incoming.powerUpLevels === 'object') {
    for (const [k, v] of Object.entries(incoming.powerUpLevels)) {
      mergedPowerUpLevels[k] = Math.max(Number(mergedPowerUpLevels[k] || 0), Number(v || 0));
    }
  }

  const next: StoredPlayerProgress = {
    userId: cleanUid,
    highScore: Math.max(prev?.highScore || 0, Math.round(Number(incoming.highScore) || 0)),
    maxCombo: Math.max(prev?.maxCombo || 0, Math.round(Number(incoming.maxCombo) || 0)),
    totalOrbs:
      typeof incoming.totalOrbs === 'number' && incoming.totalOrbs >= 0
        ? Math.round(incoming.totalOrbs)
        : prev?.totalOrbs ?? 60,
    runsPlayed: Math.max(prev?.runsPlayed || 0, Math.round(Number(incoming.runsPlayed) || 0)),
    playerXp: Math.max(prev?.playerXp || 0, Math.round(Number(incoming.playerXp) || 0)),
    playerLevel: Math.max(prev?.playerLevel || 0, Math.round(Number(incoming.playerLevel) || 0)),
    playerShape: incoming.playerShape || prev?.playerShape || 'triangle',
    unlockedAvatars: mergedUnlockedAvatars,
    powerUpLevels: mergedPowerUpLevels,
    equippedPowerUps:
      Array.isArray(incoming.equippedPowerUps) && incoming.equippedPowerUps.length > 0
        ? incoming.equippedPowerUps
        : prev?.equippedPowerUps || ['combo_shield'],
    updatedAtMs: Date.now(),
  };

  profiles[cleanUid] = next;
  saveStoredProfiles(profiles);
  return next;
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

  async function mergeTelegramOfficialHighScores(
    stored: StoredLeaderboardEntry[],
    uid: string,
    inlineMessageId: string,
    chatId: string,
    messageId: string,
    groupKey: string
  ): Promise<StoredLeaderboardEntry[]> {
    const token = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN || '';
    if (!token || !/^\d+$/.test(uid) || (!inlineMessageId && !(chatId && messageId))) {
      return stored;
    }

    const hsPayload: Record<string, unknown> = { user_id: Number(uid) };
    if (inlineMessageId) {
      hsPayload.inline_message_id = inlineMessageId;
    } else {
      hsPayload.chat_id = /^-?\d+$/.test(chatId) ? Number(chatId) : chatId;
      hsPayload.message_id = Number(messageId);
    }

    const hsRes = await callTelegramApi(token, 'getGameHighScores', hsPayload);
    if (!hsRes.ok || !Array.isArray(hsRes.result)) {
      return stored;
    }

    let changed = false;
    for (const row of hsRes.result as Array<{
      score: number;
      user: { id: number; first_name?: string; last_name?: string; username?: string };
    }>) {
      if (!row?.user?.id || !(row.score > 0)) continue;
      const rowUid = String(row.user.id);
      const rowName =
        `${row.user.first_name || ''}${row.user.last_name ? ' ' + row.user.last_name : ''}`.trim() ||
        'Neon Pilot';
      const rowUsername = row.user.username || undefined;
      const existingIdx = stored.findIndex((s) => s.userId === rowUid);
      if (existingIdx >= 0) {
        if (row.score > stored[existingIdx].score) {
          stored[existingIdx].score = row.score;
          changed = true;
        }
        if (rowName && stored[existingIdx].name === 'Neon Pilot') {
          stored[existingIdx].name = rowName;
          changed = true;
        }
      } else {
        stored.push({
          userId: rowUid,
          name: rowName,
          username: rowUsername,
          score: row.score,
          maxFlow: 0,
          avatarShape: 'triangle',
          groupKey,
          updatedAt: new Date().toISOString(),
        });
        changed = true;
      }
    }

    if (changed) {
      saveStoredScores(stored);
    }
    return stored;
  }

  function buildDeduplicatedLeaderboard(stored: StoredLeaderboardEntry[]) {
    const byUser = new Map<string, StoredLeaderboardEntry>();
    for (const item of stored) {
      if (!item.userId || !(item.score > 0)) continue;
      const prev = byUser.get(item.userId);
      if (!prev) {
        byUser.set(item.userId, { ...item });
      } else {
        byUser.set(item.userId, {
          ...prev,
          name: item.name && item.name !== 'Neon Pilot' ? item.name : prev.name,
          username: item.username || prev.username,
          score: Math.max(prev.score, item.score),
          maxFlow: Math.max(prev.maxFlow || 0, item.maxFlow || 0),
          avatarShape: item.avatarShape || prev.avatarShape,
          updatedAt: item.updatedAt > prev.updatedAt ? item.updatedAt : prev.updatedAt,
        });
      }
    }
    return Array.from(byUser.values())
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
  }

  // 1. GET /api/telegram/leaderboard
  app.get('/api/telegram/leaderboard', async (req, res) => {
    const reqUid = String(req.query.uid || req.query.user_id || req.query.userId || '').trim();
    const inlineMessageId = String(
      req.query.imid || req.query.inline_message_id || req.query.inlineMessageId || ''
    ).trim();
    const chatId = String(req.query.cid || req.query.chat_id || req.query.chatId || '').trim();
    const messageId = String(
      req.query.mid || req.query.message_id || req.query.messageId || ''
    ).trim();
    const groupKey =
      inlineMessageId || (chatId && messageId ? `${chatId}:${messageId}` : 'global');

    let stored = loadStoredScores();
    stored = await mergeTelegramOfficialHighScores(
      stored,
      reqUid,
      inlineMessageId,
      chatId,
      messageId,
      groupKey
    );

    const leaderboard = buildDeduplicatedLeaderboard(stored);

    const profiles = loadStoredProfiles();
    const playerProfile = reqUid && profiles[reqUid] ? profiles[reqUid] : null;

    res.json({
      ok: true,
      gameShortName: GAME_SHORT_NAME,
      leaderboard,
      playerProfile,
    });
  });

  // 1b. POST /api/telegram/profile (Syncs player coins/orbs, XP, high score, and shop unlocks by uid)
  app.post('/api/telegram/profile', (req, res) => {
    const body = req.body || {};
    const rawUid = body.uid ?? body.user_id ?? body.userId ?? '';
    const savedProfile = upsertPlayerProgress(String(rawUid), body);
    res.json({
      ok: true,
      playerProfile: savedProfile,
    });
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

    let savedProfile: StoredPlayerProgress | null = null;
    if (body.profile && typeof body.profile === 'object') {
      savedProfile = upsertPlayerProgress(cleanUid, {
        ...body.profile,
        highScore: Math.max(cleanScore, Number(body.profile.highScore) || 0),
        maxCombo: Math.max(Number(body.maxFlow) || 0, Number(body.profile.maxCombo) || 0),
      });
    } else if (cleanScore > 0) {
      savedProfile = upsertPlayerProgress(cleanUid, {
        highScore: cleanScore,
        maxCombo: Number(body.maxFlow) || 0,
        avatarShape: body.avatarShape,
      } as Partial<StoredPlayerProgress>);
    }

    const groupKey =
      inlineMessageId || (chatId && messageId ? `${chatId}:${messageId}` : 'global');

    let stored = loadStoredScores();
    stored = await mergeTelegramOfficialHighScores(
      stored,
      cleanUid,
      inlineMessageId,
      chatId,
      messageId,
      groupKey
    );

    const existingIdx = stored.findIndex((s) => s.userId === cleanUid);

    let authoritativeBestScore = Math.max(cleanScore, savedProfile?.highScore || 0);

    if (existingIdx >= 0) {
      const prev = stored[existingIdx];
      authoritativeBestScore = Math.max(prev.score, authoritativeBestScore);
      stored[existingIdx] = {
        ...prev,
        name: cleanName || prev.name,
        username: cleanUsername || prev.username,
        score: authoritativeBestScore,
        maxFlow: Math.max(prev.maxFlow || 0, Number(body.maxFlow) || 0),
        avatarShape: body.avatarShape || prev.avatarShape || 'triangle',
        groupKey: groupKey !== 'global' ? groupKey : prev.groupKey,
        updatedAt: new Date().toISOString(),
      };
    } else if (authoritativeBestScore > 0) {
      stored.push({
        userId: cleanUid,
        name: cleanName,
        username: cleanUsername || undefined,
        score: authoritativeBestScore,
        maxFlow: Number(body.maxFlow) || 0,
        avatarShape: body.avatarShape || 'triangle',
        groupKey,
        updatedAt: new Date().toISOString(),
      });
    }

    saveStoredScores(stored);

    // Call ONLY Telegram's outbound `setGameScore` method WITHOUT `force: true` so Telegram
    // strictly increases high scores and NEVER lowers or resets a user's score!
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

    const leaderboard = buildDeduplicatedLeaderboard(stored);

    res.json({
      ok: true,
      telegramUpdated,
      leaderboard,
    });
  });

  // 3. GET / POST /api/telegram/reset
  // Protected against accidental GET reloads or TelegramBot link-preview crawlers!
  const handleResetLeaderboard = async (req: express.Request, res: express.Response) => {
    const ua = String(req.headers['user-agent'] || '').toLowerCase();
    if (ua.includes('telegrambot') || ua.includes('twitterbot') || ua.includes('bot')) {
      res.status(200).send('Ignored crawler request.');
      return;
    }

    const adminKey = process.env.ADMIN_RESET_KEY || '';
    const providedKey = String(req.query.key || req.body?.key || '').trim();
    if (adminKey && providedKey !== adminKey) {
      res.status(403).json({ ok: false, error: 'Invalid ADMIN_RESET_KEY' });
      return;
    }

    // Require explicit confirmation on GET requests so reloading an open browser tab doesn't auto-reset
    const confirmed =
      req.method === 'POST' ||
      req.query.confirm === '1' ||
      req.query.confirm === 'yes';

    if (!confirmed) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Reset Leaderboard</title></head>
<body style="background:#04050a;color:#e2e8f0;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
  <form method="POST" action="/api/telegram/reset" style="border:1px solid #334155;padding:24px;text-align:center;max-width:400px">
    <h3 style="color:#00ff88;margin-top:0">Reset Telegram Leaderboard</h3>
    <p style="font-size:14px;color:#94a3b8">This will clear the server leaderboard scores without deleting players' coins or shop items.</p>
    <input type="hidden" name="key" value="${providedKey}" />
    <button type="submit" style="background:#f43f5e;color:#fff;border:none;padding:10px 20px;cursor:pointer;font-weight:bold">CONFIRM RESET LEADERBOARD</button>
  </form>
</body></html>`);
      return;
    }

    const token = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN || '';
    const stored = loadStoredScores();
    let telegramResetCount = 0;

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

    res.json({
      ok: true,
      message: 'Server leaderboard cleared (player coins & items preserved).',
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
