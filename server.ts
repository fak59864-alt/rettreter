import express, { Request, Response } from 'express';
import http from 'http';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
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

  // In-memory player sync storage
  const syncStore: Record<string, unknown> = {};

  const DEFAULT_BOT_TOKEN = process.env.BOT_TOKEN || '8748940272:AAFze_ClMme6PfumQeOad0rIfac-HxNjKWM';
  const DEFAULT_APP_URL = 'https://rettreterreeer.vercel.app/';

  // Global protection against unexpected unhandled socket/network crashes
  process.on('unhandledRejection', (reason) => {
    console.error('[Process] Unhandled Rejection intercepted:', reason);
  });
  process.on('uncaughtException', (err) => {
    console.error('[Process] Uncaught Exception intercepted:', err);
  });

  // ============================================================================
  // Telegram Bot Continuous Service (Permanent Polling & Auto-Config)
  // Ensures the bot is ALWAYS connected to the WebApp URL and never stops
  // ============================================================================
  async function configureTelegramBot(token: string, webAppUrl: string) {
    const tgApi = `https://api.telegram.org/bot${token}`;
    try {
      // 1. Delete any webhook to ensure getUpdates never encounters 409 Conflict
      await fetch(`${tgApi}/deleteWebhook?drop_pending_updates=false`)
        .then(r => r.json())
        .catch(() => null);

      // 2. Set native Telegram WebApp Chat Menu Button (bottom-left corner)
      await fetch(`${tgApi}/setChatMenuButton`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          menu_button: {
            type: 'web_app',
            text: '📱 Играть',
            web_app: { url: webAppUrl },
          },
        }),
      }).then(r => r.json()).catch(() => null);

      // 3. Set bot commands menu
      await fetch(`${tgApi}/setMyCommands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          commands: [
            { command: 'start', description: '🎮 Запустить игру Номера Телефонов' },
            { command: 'play', description: '📱 Играть в Mini App' },
            { command: 'collection', description: '💎 Моя коллекция SIM-карт' },
            { command: 'shop', description: '⚡ Улучшения и прокачка' },
            { command: 'help', description: 'ℹ️ Правила и руководство' },
          ],
        }),
      }).then(r => r.json()).catch(() => null);

      // 4. Set bot descriptions
      await fetch(`${tgApi}/setMyDescription`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: '🎰 Официальный бот игры «Номера Телефонов (Престиж-Телеком)»! Крутите рулетку, выбивайте легендарные и мифические номера, получайте пассивный доход и торгуйте на P2P бирже!',
        }),
      }).then(r => r.json()).catch(() => null);

      await fetch(`${tgApi}/setMyShortDescription`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          short_description: '🎮 Симулятор номеров: рулетка, мифические 9x номера, пассивная аренда и P2P рынок!',
        }),
      }).then(r => r.json()).catch(() => null);

      console.log(`[Telegram Bot] Successfully configured Menu Button & Commands for ${webAppUrl}`);
    } catch (e) {
      console.error('[Telegram Bot] Error during bot auto-config:', e);
    }
  }

  async function handleTelegramMessage(token: string, webAppUrl: string, msg: any) {
    if (!msg || !msg.chat || !msg.chat.id) return;
    const chatId = msg.chat.id;
    const text = (msg.text || '').trim();
    const userName = msg.from?.first_name || 'Игрок';
    const tgApi = `https://api.telegram.org/bot${token}`;

    if (text.startsWith('/help')) {
      await fetch(`${tgApi}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text:
            `ℹ️ <b>Как играть в Номера Телефонов (Престиж-Телеком):</b>\n\n` +
            `🎰 <b>1. Крути рулетку:</b> крути по 1 или сразу 10 номеров, выбивай красивые и редкие комбинации!\n` +
            `🌟 <b>2. Мифическая редкость:</b> номера с 9 или 10 одинаковыми цифрами (множитель до x500 и 750 ₽/сек дохода)!\n` +
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
      }).catch(() => null);
    } else {
      // Default welcome response for /start, /play, /game or any user message
      await fetch(`${tgApi}/sendMessage`, {
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
      }).catch(() => null);
    }
  }

  function startBotPolling(token: string, webAppUrl: string) {
    let offset = 0;
    console.log(`[Telegram Bot] Starting permanent background polling loop... (URL: ${webAppUrl})`);

    // Initial setup
    configureTelegramBot(token, webAppUrl);

    // Refresh menu button every 15 minutes to prevent Telegram from dropping it
    setInterval(() => {
      configureTelegramBot(token, webAppUrl);
    }, 15 * 60 * 1000);

    const poll = async () => {
      try {
        const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates?offset=${offset}&timeout=20&limit=50`);
        if (res.ok) {
          const data: any = await res.json();
          if (data.ok && Array.isArray(data.result)) {
            for (const update of data.result) {
              offset = update.update_id + 1;
              if (update.message) {
                await handleTelegramMessage(token, webAppUrl, update.message);
              }
            }
          }
        } else if (res.status === 409) {
          // Conflict: webhook was active, delete it and retry
          console.warn('[Telegram Bot] 409 Conflict in getUpdates. Clearing webhook...');
          await fetch(`https://api.telegram.org/bot${token}/deleteWebhook?drop_pending_updates=false`).catch(() => null);
        }
      } catch (err) {
        // Network blip or timeout; will retry automatically
      }
      setTimeout(poll, 1000);
    };

    poll();
  }

  // Start permanent background polling for the connected bot
  startBotPolling(DEFAULT_BOT_TOKEN, DEFAULT_APP_URL);

  // Optional Webhook endpoint in case Telegram webhook is ever called directly
  app.post('/api/telegram/webhook', async (req: Request, res: Response): Promise<void> => {
    try {
      const update = req.body;
      if (update && update.message) {
        await handleTelegramMessage(DEFAULT_BOT_TOKEN, DEFAULT_APP_URL, update.message);
      }
      res.json({ ok: true });
    } catch {
      res.json({ ok: true });
    }
  });

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
      const rawTargetUrl = appUrl || DEFAULT_APP_URL;
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
  // API: Sync Player State (In-memory / Cloud state)
  // ============================================================================
  app.post('/api/user/sync', (req: Request, res: Response): void => {
    const { userId, balance, collection, upgrades } = req.body;
    if (!userId) {
      res.status(400).json({ error: 'userId is required' });
      return;
    }
    syncStore[String(userId)] = {
      userId,
      balance,
      collection,
      upgrades,
      updatedAt: Date.now(),
    };
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
