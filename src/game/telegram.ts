/**
 * Telegram HTML5 Gaming Platform (https://core.telegram.org/bots/games) &
 * Inline Group Ranked Leaderboard Integration for NEON ASCENT: OMNI.
 *
 * Reads URL Query Parameters passed by the external Python Telegram Bot (`answerCallbackQuery`):
 * - uid / user_id
 * - name / first_name
 * - username
 * - cid / chat_id
 * - mid / message_id
 * - imid / inline_message_id
 * - api (optional external API base URL; defaults to same-origin Render server)
 */

export const TELEGRAM_GAME_SHORT_NAME = 'neonascentomni';

export interface TelegramGameSession {
  isTelegramEnv: boolean;
  gameShortName: string;
  userId: string;
  firstName: string;
  username: string;
  inlineMessageId?: string;
  chatId?: string;
  messageId?: string;
  groupTitle?: string;
  apiBaseUrl: string;
}

export interface RankedLeaderboardEntry {
  position: number;
  userId: string;
  name: string;
  username?: string;
  score: number;
  maxFlow?: number;
  avatarShape?: string;
  updatedAt?: string;
  isCurrentUser?: boolean;
}

declare global {
  interface Window {
    __OMNI_TELEGRAM_DEPLOY__?: boolean;
    TelegramGameProxy?: {
      initParams?: Record<string, string>;
      shareScore: () => void;
    };
    Telegram?: {
      WebApp?: {
        initData?: string;
        initDataUnsafe?: {
          user?: {
            id?: number;
            first_name?: string;
            last_name?: string;
            username?: string;
          };
          chat?: {
            id?: number;
            title?: string;
          };
          start_param?: string;
        };
        ready?: () => void;
        expand?: () => void;
        disableVerticalSwipes?: () => void;
        setHeaderColor?: (color: string) => void;
        setBackgroundColor?: (color: string) => void;
      };
    };
  }
}

const LOCAL_LEADERBOARD_KEY = 'omni_tg_ranked_leaderboard_v1';
const LOCAL_PLAYER_PROFILE_KEY = 'omni_tg_player_profile_v1';
const SESSION_PARAMS_CACHE_KEY = 'omni_tg_url_session_v1';

export function getSavedPlayerProfile(): {
  userId: string;
  firstName: string;
  username: string;
  customBotApiUrl: string;
} {
  try {
    const raw = localStorage.getItem(LOCAL_PLAYER_PROFILE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        userId: parsed.userId || `pilot_${Math.floor(1000 + Math.random() * 9000)}`,
        firstName: parsed.firstName || 'Neon Pilot',
        username: parsed.username || '',
        customBotApiUrl: parsed.customBotApiUrl || '',
      };
    }
  } catch {
    // ignore
  }
  const fallback = {
    userId: `pilot_${Math.floor(1000 + Math.random() * 9000)}`,
    firstName: 'Neon Pilot',
    username: '',
    customBotApiUrl: '',
  };
  try {
    localStorage.setItem(LOCAL_PLAYER_PROFILE_KEY, JSON.stringify(fallback));
  } catch {
    // ignore
  }
  return fallback;
}

export function savePlayerProfile(profile: {
  firstName?: string;
  username?: string;
  customBotApiUrl?: string;
}): void {
  const current = getSavedPlayerProfile();
  const updated = {
    ...current,
    ...(profile.firstName !== undefined
      ? { firstName: profile.firstName.trim() || 'Neon Pilot' }
      : {}),
    ...(profile.username !== undefined
      ? { username: profile.username.trim().replace(/^@/, '') }
      : {}),
    ...(profile.customBotApiUrl !== undefined
      ? { customBotApiUrl: profile.customBotApiUrl.trim().replace(/\/+$/, '') }
      : {}),
  };
  try {
    localStorage.setItem(LOCAL_PLAYER_PROFILE_KEY, JSON.stringify(updated));
  } catch {
    // ignore
  }
}

/**
 * Parses URL query parameters (`uid`, `user_id`, `name`, `username`, `cid`, `chat_id`,
 * `mid`, `message_id`, `imid`, `inline_message_id`, `api`) passed when the Python bot
 * opens the game via `answerCallbackQuery`.
 */
export function parseTelegramGameSession(): TelegramGameSession {
  const saved = getSavedPlayerProfile();
  if (typeof window === 'undefined') {
    return {
      isTelegramEnv: false,
      gameShortName: TELEGRAM_GAME_SHORT_NAME,
      userId: saved.userId,
      firstName: saved.firstName,
      username: saved.username,
      apiBaseUrl: saved.customBotApiUrl || '',
    };
  }

  const params = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const proxyParams = window.TelegramGameProxy?.initParams || {};
  const webAppUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
  const webAppChat = window.Telegram?.WebApp?.initDataUnsafe?.chat;

  let cachedSession: Partial<TelegramGameSession> = {};
  try {
    const rawCached = sessionStorage.getItem(SESSION_PARAMS_CACHE_KEY);
    if (rawCached) {
      cachedSession = JSON.parse(rawCached);
    }
  } catch {
    // ignore
  }

  const getParam = (keys: string[]): string | undefined => {
    for (const k of keys) {
      const v = params.get(k) || hashParams.get(k) || proxyParams[k];
      if (v !== null && v !== undefined && String(v).trim() !== '') {
        return String(v).trim();
      }
    }
    return undefined;
  };

  const gameShortName =
    getParam(['game', 'game_short_name', 'short_name']) ||
    cachedSession.gameShortName ||
    TELEGRAM_GAME_SHORT_NAME;

  const uid =
    getParam(['uid', 'user_id', 'id']) ||
    (webAppUser?.id ? String(webAppUser.id) : undefined) ||
    cachedSession.userId ||
    saved.userId;

  const firstName =
    getParam(['name', 'first_name', 'player']) ||
    (webAppUser?.first_name
      ? `${webAppUser.first_name}${webAppUser.last_name ? ' ' + webAppUser.last_name : ''}`
      : undefined) ||
    cachedSession.firstName ||
    saved.firstName;

  const username =
    getParam(['username', 'user']) ||
    webAppUser?.username ||
    cachedSession.username ||
    saved.username ||
    '';

  const inlineMessageId =
    getParam(['imid', 'inline_message_id']) || cachedSession.inlineMessageId;
  const chatId =
    getParam(['cid', 'chat_id']) ||
    (webAppChat?.id ? String(webAppChat.id) : undefined) ||
    cachedSession.chatId;
  const messageId = getParam(['mid', 'message_id']) || cachedSession.messageId;
  const groupTitle =
    getParam(['group', 'chat_title']) ||
    webAppChat?.title ||
    cachedSession.groupTitle ||
    'TELEGRAM GROUP';
  const rawApiParam = getParam(['api', 'bot_api']);
  const apiBaseUrl = (
    rawApiParam !== undefined ? rawApiParam : cachedSession.apiBaseUrl ?? saved.customBotApiUrl ?? ''
  ).replace(/\/+$/, '');

  const isRenderOrTelegramDeploy =
    Boolean(window.__OMNI_TELEGRAM_DEPLOY__) ||
    window.location.hostname.endsWith('.onrender.com') ||
    (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_TELEGRAM_DEPLOY ===
      'true';

  const isTelegramEnv = Boolean(
    isRenderOrTelegramDeploy ||
      inlineMessageId ||
      (chatId && messageId) ||
      window.TelegramGameProxy ||
      window.Telegram?.WebApp?.initData ||
      params.has('uid') ||
      params.has('user_id') ||
      params.has('imid') ||
      params.has('inline_message_id') ||
      params.has('cid') ||
      params.has('chat_id') ||
      params.has('mid') ||
      params.has('message_id') ||
      params.get('tg') === '1' ||
      cachedSession.isTelegramEnv
  );

  const sessionObj: TelegramGameSession = {
    isTelegramEnv,
    gameShortName,
    userId: uid,
    firstName,
    username,
    inlineMessageId,
    chatId,
    messageId,
    groupTitle,
    apiBaseUrl,
  };

  try {
    sessionStorage.setItem(SESSION_PARAMS_CACHE_KEY, JSON.stringify(sessionObj));
    localStorage.setItem(
      LOCAL_PLAYER_PROFILE_KEY,
      JSON.stringify({
        userId: uid,
        firstName,
        username,
        customBotApiUrl: apiBaseUrl,
      })
    );
  } catch {
    // ignore
  }

  return sessionObj;
}

/**
 * Optimizes Telegram's in-app WebView for full-screen 60fps touch drag & tap gameplay.
 */
export function initTelegramWebViewOptimizations(): void {
  if (typeof window === 'undefined') return;
  try {
    const wa = window.Telegram?.WebApp;
    if (wa) {
      wa.ready?.();
      wa.expand?.();
      wa.disableVerticalSwipes?.();
      wa.setHeaderColor?.('#04050a');
      wa.setBackgroundColor?.('#04050a');
    }
  } catch {
    // ignore
  }
}

export function getLocalLeaderboard(currentUserId?: string): RankedLeaderboardEntry[] {
  try {
    const raw = localStorage.getItem(LOCAL_LEADERBOARD_KEY);
    const parsed: RankedLeaderboardEntry[] = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed
        .sort((a, b) => b.score - a.score)
        .map((item, idx) => ({
          ...item,
          position: idx + 1,
          isCurrentUser: currentUserId ? item.userId === currentUserId : item.isCurrentUser,
        }));
    }
  } catch {
    // ignore
  }
  return [];
}

function updateLocalLeaderboard(entry: {
  userId: string;
  name: string;
  username?: string;
  score: number;
  maxFlow?: number;
  avatarShape?: string;
}): RankedLeaderboardEntry[] {
  const list = getLocalLeaderboard(entry.userId);
  const existingIdx = list.findIndex((x) => x.userId === entry.userId);
  const cleanScore = Math.max(0, Math.round(entry.score));

  if (existingIdx >= 0) {
    const prev = list[existingIdx];
    list[existingIdx] = {
      ...prev,
      name: entry.name || prev.name,
      username: entry.username || prev.username,
      score: Math.max(prev.score, cleanScore),
      maxFlow: Math.max(prev.maxFlow || 0, entry.maxFlow || 0),
      avatarShape: entry.avatarShape || prev.avatarShape,
      updatedAt: new Date().toISOString(),
    };
  } else if (cleanScore > 0) {
    list.push({
      position: list.length + 1,
      userId: entry.userId,
      name: entry.name,
      username: entry.username,
      score: cleanScore,
      maxFlow: entry.maxFlow || 0,
      avatarShape: entry.avatarShape || 'triangle',
      updatedAt: new Date().toISOString(),
    });
  }

  const sorted = list
    .sort((a, b) => b.score - a.score)
    .slice(0, 50)
    .map((item, idx) => ({
      ...item,
      position: idx + 1,
      isCurrentUser: item.userId === entry.userId,
    }));

  try {
    localStorage.setItem(LOCAL_LEADERBOARD_KEY, JSON.stringify(sorted));
  } catch {
    // ignore
  }
  return sorted;
}

/**
 * Submits the player's score to `/api/telegram/score`, sending all URL parameters
 * (`uid`/`user_id`, `name`, `username`, `cid`/`chat_id`, `mid`/`message_id`, `imid`/`inline_message_id`)
 * so the server saves the score and invokes Telegram's `setGameScore` method.
 */
export async function submitTelegramRankedScore(params: {
  score: number;
  maxFlow: number;
  avatarShape: string;
}): Promise<{
  syncedToTelegram: boolean;
  leaderboard: RankedLeaderboardEntry[];
}> {
  const session = parseTelegramGameSession();
  const cleanScore = Math.max(0, Math.round(params.score));

  const localUpdated = updateLocalLeaderboard({
    userId: session.userId,
    name: session.firstName,
    username: session.username,
    score: cleanScore,
    maxFlow: params.maxFlow,
    avatarShape: params.avatarShape,
  });

  if (cleanScore <= 0) {
    return { syncedToTelegram: false, leaderboard: localUpdated };
  }

  const endpoint = `${session.apiBaseUrl}/api/telegram/score`;
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        // Send both short and full parameter names for 100% compatibility
        uid: session.userId,
        user_id: session.userId,
        userId: session.userId,
        name: session.firstName,
        username: session.username,
        score: cleanScore,
        maxFlow: params.maxFlow,
        avatarShape: params.avatarShape,
        imid: session.inlineMessageId,
        inline_message_id: session.inlineMessageId,
        inlineMessageId: session.inlineMessageId,
        cid: session.chatId,
        chat_id: session.chatId,
        chatId: session.chatId,
        mid: session.messageId,
        message_id: session.messageId,
        messageId: session.messageId,
        groupTitle: session.groupTitle,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.leaderboard)) {
        const merged: RankedLeaderboardEntry[] = data.leaderboard.map(
          (row: RankedLeaderboardEntry, idx: number) => ({
            ...row,
            position: idx + 1,
            isCurrentUser: String(row.userId) === String(session.userId),
          })
        );
        try {
          localStorage.setItem(LOCAL_LEADERBOARD_KEY, JSON.stringify(merged));
        } catch {
          // ignore
        }
        return {
          syncedToTelegram: Boolean(data.telegramUpdated),
          leaderboard: merged,
        };
      }
    }
  } catch {
    // Offline fallback
  }

  return { syncedToTelegram: false, leaderboard: localUpdated };
}

/**
 * Fetches the Group Ranked Leaderboard from `/api/telegram/leaderboard`.
 */
export async function fetchTelegramLeaderboard(): Promise<RankedLeaderboardEntry[]> {
  const session = parseTelegramGameSession();
  const query = new URLSearchParams();
  if (session.userId) {
    query.set('uid', session.userId);
    query.set('user_id', session.userId);
    query.set('userId', session.userId);
  }
  if (session.inlineMessageId) {
    query.set('imid', session.inlineMessageId);
    query.set('inline_message_id', session.inlineMessageId);
    query.set('inlineMessageId', session.inlineMessageId);
  }
  if (session.chatId) {
    query.set('cid', session.chatId);
    query.set('chat_id', session.chatId);
    query.set('chatId', session.chatId);
  }
  if (session.messageId) {
    query.set('mid', session.messageId);
    query.set('message_id', session.messageId);
    query.set('messageId', session.messageId);
  }

  const endpoint = `${session.apiBaseUrl}/api/telegram/leaderboard?${query.toString()}`;
  try {
    const res = await fetch(endpoint);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.leaderboard) && data.leaderboard.length > 0) {
        const mapped: RankedLeaderboardEntry[] = data.leaderboard.map(
          (row: RankedLeaderboardEntry, idx: number) => ({
            ...row,
            position: idx + 1,
            isCurrentUser: String(row.userId) === String(session.userId),
          })
        );
        try {
          localStorage.setItem(LOCAL_LEADERBOARD_KEY, JSON.stringify(mapped));
        } catch {
          // ignore
        }
        return mapped;
      }
    }
  } catch {
    // fallback to local
  }
  return getLocalLeaderboard(session.userId);
}

/**
 * Triggers Telegram's native `TelegramGameProxy.shareScore()` dialog in the group chat.
 */
export function shareScoreToTelegramChat(score: number, maxFlow: number): boolean {
  if (typeof window === 'undefined') return false;
  if (window.TelegramGameProxy && typeof window.TelegramGameProxy.shareScore === 'function') {
    try {
      window.TelegramGameProxy.shareScore();
      return true;
    } catch {
      // fallback below
    }
  }
  return false;
}
