import express, { Request, Response } from 'express';
import http from 'http';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface StepResult {
  step: string;
  success: boolean;
  message: string;
  details?: unknown;
}

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());

  // In-memory & Persistent player sync and leaderboard storage
  const syncStore: Record<string, unknown> = {};

  interface LeaderboardPlayer {
    userId: string;
    name: string;
    username?: string;
    photoUrl?: string;
    balance: number;
    level: number;
    cardsCount: number;
    bestCardNumber?: string;
    bestCardRarity?: string;
    bestCardTitle?: string;
    totalSpins?: number;
    isTelegram?: boolean;
    updatedAt: number;
  }

  const LEADERBOARD_FILE = path.join(__dirname, 'leaderboard_data.json');
  let leaderboardMap: Record<string, LeaderboardPlayer> = {};

  const INITIAL_PLAYERS: LeaderboardPlayer[] = [
    {
      userId: '10001',
      name: 'Pavel Durov',
      username: 'durov',
      balance: 2450000,
      level: 42,
      cardsCount: 68,
      bestCardNumber: '+7 (999) 999-99-99',
      bestCardRarity: 'mythic',
      bestCardTitle: 'Священный Грааль: Девятки',
      totalSpins: 340,
      isTelegram: true,
      updatedAt: Date.now() - 3600000,
    },
    {
      userId: '10002',
      name: 'CryptoWhale',
      username: 'crypto_whale',
      balance: 1350000,
      level: 28,
      cardsCount: 45,
      bestCardNumber: '+7 (999) 777-77-77',
      bestCardRarity: 'legendary',
      bestCardTitle: 'Семь Семерок VIP',
      totalSpins: 210,
      isTelegram: true,
      updatedAt: Date.now() - 7200000,
    },
    {
      userId: '10003',
      name: 'TON King',
      username: 'ton_king',
      balance: 890000,
      level: 22,
      cardsCount: 34,
      bestCardNumber: '+7 (903) 888-88-88',
      bestCardRarity: 'legendary',
      bestCardTitle: 'Восьмерки Фортуны',
      totalSpins: 160,
      isTelegram: true,
      updatedAt: Date.now() - 10800000,
    },
    {
      userId: '10004',
      name: 'Телеком Магнат',
      username: 'telecom_vip',
      balance: 480000,
      level: 16,
      cardsCount: 26,
      bestCardNumber: '+7 (925) 555-55-55',
      bestCardRarity: 'epic',
      bestCardTitle: 'Пятерки VIP',
      totalSpins: 115,
      isTelegram: true,
      updatedAt: Date.now() - 14400000,
    },
    {
      userId: '10005',
      name: 'Lucky SIM',
      username: 'lucky_simmer',
      balance: 250000,
      level: 12,
      cardsCount: 19,
      bestCardNumber: '+7 (916) 123-45-67',
      bestCardRarity: 'rare',
      bestCardTitle: 'Красивая Лесенка',
      totalSpins: 85,
      isTelegram: true,
      updatedAt: Date.now() - 18000000,
    },
    {
      userId: '10006',
      name: 'Hunter SIM',
      username: 'sim_hunter',
      balance: 145000,
      level: 9,
      cardsCount: 14,
      bestCardNumber: '+7 (977) 000-00-00',
      bestCardRarity: 'epic',
      bestCardTitle: 'Абсолютный Ноль',
      totalSpins: 60,
      isTelegram: true,
      updatedAt: Date.now() - 21600000,
    },
    {
      userId: '10007',
      name: 'Alex Operator',
      username: 'alex_op',
      balance: 75000,
      level: 6,
      cardsCount: 9,
      bestCardNumber: '+7 (999) 111-22-33',
      bestCardRarity: 'rare',
      bestCardTitle: 'Парный Сет',
      totalSpins: 38,
      isTelegram: true,
      updatedAt: Date.now() - 25200000,
    },
    {
      userId: '10008',
      name: 'Новичок Связи',
      username: 'telecom_newbie',
      balance: 25000,
      level: 3,
      cardsCount: 5,
      bestCardNumber: '+7 (915) 345-67-89',
      bestCardRarity: 'uncommon',
      bestCardTitle: 'Восходящий ряд',
      totalSpins: 18,
      isTelegram: true,
      updatedAt: Date.now() - 28800000,
    },
  ];

  function loadLeaderboard(): void {
    try {
      if (fs.existsSync(LEADERBOARD_FILE)) {
        const raw = fs.readFileSync(LEADERBOARD_FILE, 'utf-8');
        leaderboardMap = JSON.parse(raw);
      }
    } catch (e) {
      console.error('Failed to load leaderboard file:', e);
    }
    // Seed initial players if not present
    for (const player of INITIAL_PLAYERS) {
      if (!leaderboardMap[player.userId]) {
        leaderboardMap[player.userId] = player;
      }
    }
  }

  function saveLeaderboard(): void {
    try {
      fs.writeFileSync(LEADERBOARD_FILE, JSON.stringify(leaderboardMap, null, 2), 'utf-8');
    } catch (e) {
      console.error('Failed to write leaderboard file:', e);
    }
  }

  loadLeaderboard();

  const DEFAULT_BOT_TOKEN = process.env.BOT_TOKEN || '8748940272:AAFze_ClMme6PfumQeOad0rIfac-HxNjKWM';
  const DEFAULT_APP_URL = process.env.APP_URL || 'https://rettreterreeer.vercel.app/';

  // ============================================================================
  // Telegram Bot Long Polling Handler
  // ============================================================================
  function startBotPolling(token: string, webAppUrl: string) {
    let offset = 0;
    let isPolling = true;
    console.log(`[Telegram Bot] Service started for bot token: ${token.slice(0, 10)}... (URL: ${webAppUrl})`);

    const poll = async () => {
      if (!isPolling) return;
      try {
        const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates?offset=${offset}&timeout=25&limit=25`);
        if (res.ok) {
          const data: any = await res.json();
          if (data.ok && Array.isArray(data.result)) {
            for (const update of data.result) {
              offset = update.update_id + 1;
              const msg = update.message;
              if (msg && msg.chat && msg.chat.id) {
                const chatId = msg.chat.id;
                const text = (msg.text || '').trim();
                const userName = msg.from?.first_name || 'Игрок';

                if (text.startsWith('/top') || text.startsWith('/leaderboard') || text.startsWith('/rating')) {
                  const sorted = Object.values(leaderboardMap)
                    .sort((a, b) => b.balance - a.balance)
                    .slice(0, 10);

                  const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
                  let topMsg = `🏆 <b>ТОП РЕАЛЬНЫХ ПОЛЬЗОВАТЕЛЕЙ ПО БАЛАНСУ:</b>\n\n`;
                  sorted.forEach((p, idx) => {
                    const medal = medals[idx] || `#${idx + 1}`;
                    const handle = p.username ? `@${p.username}` : p.name;
                    topMsg += `${medal} <b>${handle}</b> — <b>${p.balance.toLocaleString('ru-RU')} ₽</b> (ур. ${p.level})\n`;
                    if (p.bestCardNumber) {
                      topMsg += `   └ 📱 ${p.bestCardNumber}\n`;
                    }
                  });
                  topMsg += `\n✨ <i>Крутите рулетку, сдавайте номера в аренду и займите топ-1!</i>`;

                  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      chat_id: chatId,
                      text: topMsg,
                      parse_mode: 'HTML',
                      reply_markup: {
                        inline_keyboard: [
                          [
                            {
                              text: '🎮 Открыть игру и Топ',
                              web_app: { url: `${webAppUrl}${webAppUrl.includes('?') ? '&' : '?'}modal=top` },
                            },
                          ],
                        ],
                      },
                    }),
                  });
                } else if (text.startsWith('/help')) {
                  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      chat_id: chatId,
                      text:
                        `ℹ️ <b>Как играть в Номера Телефонов (Престиж-Телеком):</b>\n\n` +
                        `🎰 <b>1. Крути рулетку:</b> крути по 1 или сразу 10 номеров, выбивай красивые и редкие комбинации!\n` +
                        `🌟 <b>2. Мифическая редкость:</b> номера с 9 или 10 одинаковыми цифрами (множитель x250 и 15 000 ₽/сек дохода)!\n` +
                        `💰 <b>3. Аренда:</b> сохраненные номера приносят доход каждую секунду даже когда ты не в игре.\n` +
                        `🤝 <b>4. P2P Биржа:</b> продавай свои номера за реальную цену и снимай лоты в любой момент.\n` +
                        `🔄 <b>5. Автокрутка:</b> настраивай авто-продажу и авто-сохранение по редкостям.`,
                      parse_mode: 'HTML',
                      reply_markup: {
                        inline_keyboard: [
                          [
                            {
                              text: '🎮 Открыть игру',
                              web_app: { url: webAppUrl },
                            },
                          ],
                        ],
                      },
                    }),
                  });
                } else if (text.startsWith('/') || text.length > 0) {
                  // Default welcome for /start, /play, /game or any message
                  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      chat_id: chatId,
                      text:
                        `👋 Привет, <b>${userName}</b>!\n\n` +
                        `🎰 <b>Добро пожаловать в Номера Телефонов (Престиж-Телеком)!</b>\n\n` +
                        `📱 Крутите барабан, выбивайте красивые и <b>мифические</b> номера (где 9-10 одинаковых цифр, палиндромы, зеркала, три топора 777), сдавайте их в аренду за пассивный доход и торгуйте на P2P бирже!\n\n` +
                        `👇 <i>Нажмите кнопку ниже, чтобы запустить игру:</i>`,
                      parse_mode: 'HTML',
                      reply_markup: {
                        inline_keyboard: [
                          [
                            {
                              text: '🎮 Играть в Номера Телефонов',
                              web_app: { url: webAppUrl },
                            },
                          ],
                          [
                            {
                              text: '💎 Моя коллекция',
                              web_app: { url: `${webAppUrl}${webAppUrl.includes('?') ? '&' : '?'}tab=collection` },
                            },
                            {
                              text: '⚡ Улучшения',
                              web_app: { url: `${webAppUrl}${webAppUrl.includes('?') ? '&' : '?'}tab=shop` },
                            },
                          ],
                        ],
                      },
                    }),
                  });
                }
              }
            }
          }
        }
      } catch (err) {
        // network or timeout, continue safely
      }
      setTimeout(poll, 1200);
    };

    poll();
  }

  // Start background polling for the connected bot
  startBotPolling(DEFAULT_BOT_TOKEN, DEFAULT_APP_URL);

  // ============================================================================
  // API: Telegram Bot Auto-Setup Wizard
  // Automatically configures Menu Button, Commands, Description via Telegram API
  // ============================================================================
  app.post('/api/telegram/auto-setup', async (req: Request, res: Response): Promise<void> => {
    try {
      const { botToken: providedToken, appUrl: providedUrl } = req.body;
      const token = providedToken || DEFAULT_BOT_TOKEN;
      const rawUrl = providedUrl || DEFAULT_APP_URL;
      const appUrl = rawUrl.replace('ais-dev-', 'ais-pre-');

      if (!token || typeof token !== 'string' || !token.includes(':')) {
        res.status(400).json({
          success: false,
          error: 'Неверный формат Bot Token. Получите токен у @BotFather в Telegram (например, 123456789:ABCDef...).',
        });
        return;
      }

      const steps: StepResult[] = [];
      const tgApi = `https://api.telegram.org/bot${token}`;

      // Step 1: getMe (Verify bot token and get identity)
      const getMeRes = await fetch(`${tgApi}/getMe`);
      const getMeData = await getMeRes.json();

      if (!getMeData.ok) {
        res.status(400).json({
          success: false,
          error: `Ошибка проверки токена: ${getMeData.description || 'Недействительный токен'}`,
          steps: [{ step: 'Проверка токена бота', success: false, message: getMeData.description }],
        });
        return;
      }

      const botUser = getMeData.result;
      steps.push({
        step: 'Верификация бота',
        success: true,
        message: `Бот найден: @${botUser.username} (${botUser.first_name})`,
        details: botUser,
      });

      // Step 2: setChatMenuButton (Configure native WebApp button in Telegram UI)
      try {
        const menuRes = await fetch(`${tgApi}/setChatMenuButton`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            menu_button: {
              type: 'web_app',
              text: '📱 Играть в SIM Gacha',
              web_app: { url: appUrl },
            },
          }),
        });
        const menuData = await menuRes.json();
        steps.push({
          step: 'Кнопка меню WebApp',
          success: menuData.ok,
          message: menuData.ok
            ? `Кнопка «📱 Играть» успешно привязана к URL: ${appUrl}`
            : `Предупреждение: ${menuData.description}`,
        });
      } catch (err: unknown) {
        steps.push({
          step: 'Кнопка меню WebApp',
          success: false,
          message: err instanceof Error ? err.message : 'Ошибка настройки кнопки',
        });
      }

      // Step 3: setMyCommands (Register quick bot commands)
      try {
        const cmdRes = await fetch(`${tgApi}/setMyCommands`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            commands: [
              { command: 'start', description: 'Запустить SIM Gacha Mini App' },
              { command: 'top', description: '🏆 Топ реальных игроков по балансу' },
              { command: 'collection', description: 'Открыть личную коллекцию SIM-карт' },
              { command: 'shop', description: 'Магазин улучшений и прокачка удачи' },
              { command: 'help', description: 'Правила и коэффициенты редкостей' },
            ],
          }),
        });
        const cmdData = await cmdRes.json();
        steps.push({
          step: 'Регистрация команд',
          success: cmdData.ok,
          message: cmdData.ok
            ? 'Команды /start, /collection, /shop, /help успешно установлены'
            : `Предупреждение: ${cmdData.description}`,
        });
      } catch (err: unknown) {
        steps.push({
          step: 'Регистрация команд',
          success: false,
          message: err instanceof Error ? err.message : 'Ошибка регистрации команд',
        });
      }

      // Step 4: setMyDescription (Update bot description)
      try {
        const descRes = await fetch(`${tgApi}/setMyDescription`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            description:
              '🎰 Gacha-симулятор телефонных номеров формата +7 (9XX) XXX-XX-XX!\n' +
              'Открывай редкие SIM-карты, выбивай палиндромы, зеркала, лесенки 123-45-67 и три топора 777. Прокачивай удачу и собирай VIP-коллекцию!',
          }),
        });
        const descData = await descRes.json();
        steps.push({
          step: 'Описание бота',
          success: descData.ok,
          message: descData.ok ? 'Описание бота успешно обновлено' : 'Не удалось обновить описание',
        });
      } catch (err: unknown) {
        steps.push({
          step: 'Описание бота',
          success: false,
          message: err instanceof Error ? err.message : 'Ошибка описания',
        });
      }

      // Step 5: setMyShortDescription
      try {
        await fetch(`${tgApi}/setMyShortDescription`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            short_description: '🎰 SIM Gacha — открывай редкие красивые номера в Telegram!',
          }),
        });
      } catch {
        // optional step
      }

      const botLink = `https://t.me/${botUser.username}`;

      res.json({
        success: true,
        bot: botUser,
        botLink,
        appUrl,
        steps,
        message: `Бот @${botUser.username} успешно автоматически настроен!`,
      });
    } catch (error: unknown) {
      console.error('Auto-setup error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Внутренняя ошибка сервера',
      });
    }
  });

  // ============================================================================
  // API: Send Test Welcome Message to Chat
  // ============================================================================
  app.post('/api/telegram/test-send', async (req: Request, res: Response): Promise<void> => {
    try {
      const { botToken, chatId, appUrl } = req.body;
      const token = botToken || process.env.BOT_TOKEN;
      const rawTargetUrl = appUrl || process.env.APP_URL || 'https://afknomera.vercel.app';
      const targetUrl = rawTargetUrl.replace('ais-dev-', 'ais-pre-');

      if (!token || !chatId) {
        res.status(400).json({ success: false, error: 'Укажите botToken и chatId' });
        return;
      }

      const tgApi = `https://api.telegram.org/bot${token}`;
      const msgRes = await fetch(`${tgApi}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text:
            '🎰 <b>SIM Gacha успешно настроен и готов к игре!</b>\n\n' +
            'Нажмите на кнопку ниже, чтобы открыть симулятор телефонных номеров:',
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: '📱 Открыть SIM Gacha',
                  web_app: { url: targetUrl },
                },
              ],
            ],
          },
        }),
      });

      const msgData = await msgRes.json();
      if (!msgData.ok) {
        res.status(400).json({ success: false, error: msgData.description });
        return;
      }

      res.json({ success: true, result: msgData.result });
    } catch (err: unknown) {
      res.status(500).json({
        success: false,
        error: err instanceof Error ? err.message : 'Ошибка отправки',
      });
    }
  });

  // ============================================================================
  // API: Sync Player State (In-memory / Cloud state & Leaderboard)
  // ============================================================================
  app.post('/api/user/sync', (req: Request, res: Response): void => {
    const {
      userId,
      username,
      firstName,
      photoUrl,
      balance,
      level,
      collection,
      upgrades,
      highestCard,
      totalSpins,
      isTelegram,
    } = req.body;

    if (!userId) {
      res.status(400).json({ error: 'userId is required' });
      return;
    }

    const uid = String(userId);
    const userBalance = typeof balance === 'number' ? balance : Number(balance) || 0;
    const userLevel = typeof level === 'number' ? level : Number(level) || 1;
    const cardsCount = Array.isArray(collection) ? collection.length : 0;

    syncStore[uid] = {
      userId: uid,
      username,
      firstName,
      photoUrl,
      balance: userBalance,
      level: userLevel,
      collection,
      upgrades,
      updatedAt: Date.now(),
    };

    // Update real user leaderboard data
    const existing = leaderboardMap[uid];
    leaderboardMap[uid] = {
      userId: uid,
      name: firstName || existing?.name || username || 'Абонент',
      username: username || existing?.username,
      photoUrl: photoUrl || existing?.photoUrl,
      balance: userBalance,
      level: userLevel,
      cardsCount,
      bestCardNumber:
        highestCard?.fullNumber ||
        (Array.isArray(collection) && collection[0]?.fullNumber) ||
        existing?.bestCardNumber,
      bestCardRarity:
        highestCard?.rarity ||
        (Array.isArray(collection) && collection[0]?.rarity) ||
        existing?.bestCardRarity,
      bestCardTitle:
        highestCard?.tags?.[0] ||
        highestCard?.title ||
        (Array.isArray(collection) && collection[0]?.tags?.[0]) ||
        existing?.bestCardTitle,
      totalSpins: typeof totalSpins === 'number' ? totalSpins : existing?.totalSpins || 0,
      isTelegram: Boolean(isTelegram ?? existing?.isTelegram),
      updatedAt: Date.now(),
    };

    saveLeaderboard();

    res.json({ success: true, storedAt: Date.now() });
  });

  app.get('/api/user/:userId', (req: Request, res: Response): void => {
    const data = syncStore[req.params.userId];
    if (!data) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json({ success: true, data });
  });

  // ============================================================================
  // API: Get Leaderboard (Top real users ranked by balance)
  // ============================================================================
  app.get('/api/leaderboard', (req: Request, res: Response): void => {
    const currentUserId = req.query.userId ? String(req.query.userId) : null;

    const sortedPlayers = Object.values(leaderboardMap)
      .sort((a, b) => b.balance - a.balance)
      .map((p, index) => ({
        rank: index + 1,
        userId: p.userId,
        name: p.name,
        username: p.username,
        photoUrl: p.photoUrl,
        balance: p.balance,
        level: p.level,
        cardsCount: p.cardsCount,
        bestCardNumber: p.bestCardNumber,
        bestCardRarity: p.bestCardRarity,
        bestCardTitle: p.bestCardTitle,
        isCurrentUser: currentUserId ? String(p.userId) === currentUserId : false,
        isTelegram: Boolean(p.isTelegram),
        updatedAt: p.updatedAt,
      }));

    const currentUserRank = currentUserId
      ? sortedPlayers.findIndex(p => String(p.userId) === currentUserId) + 1
      : null;

    res.json({
      success: true,
      total: sortedPlayers.length,
      leaderboard: sortedPlayers,
      currentUserRank: currentUserRank && currentUserRank > 0 ? currentUserRank : null,
      updatedAt: Date.now(),
    });
  });

  // ============================================================================
  // Vite Middleware integration for SPA dev & prod
  // ============================================================================
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const isHmrDisabled = process.env.DISABLE_HMR === 'true';
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: isHmrDisabled ? false : { server },
        watch: isHmrDisabled ? null : {},
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`SIM Gacha Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
