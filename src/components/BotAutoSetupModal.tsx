import React, { useState } from 'react';
import { Bot, CheckCircle2, AlertCircle, Sparkles, Send, ExternalLink, RefreshCw, Copy, Check, Terminal, BookOpen, Server } from 'lucide-react';
import { triggerHaptic } from '../utils/telegram';
import { sound } from '../utils/audio';
import { BOT_PYTHON_CODE, FASTAPI_BACKEND_CODE, REQUIREMENTS_TXT } from '../data/botCode';

interface BotAutoSetupModalProps {
  onClose: () => void;
  userId?: number;
}

interface StepResult {
  step: string;
  success: boolean;
  message: string;
}

export const BotAutoSetupModal: React.FC<BotAutoSetupModalProps> = ({ onClose, userId }) => {
  const [activeTab, setActiveTab] = useState<'auto_setup' | 'bot_py' | 'server_py' | 'guide'>('auto_setup');
  const [botToken, setBotToken] = useState('8748940272:AAFze_ClMme6PfumQeOad0rIfac-HxNjKWM');
  const [customUrl, setCustomUrl] = useState('https://rettreterreeer.vercel.app/');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [setupResult, setSetupResult] = useState<{
    botName: string;
    botUsername: string;
    botLink: string;
    steps: StepResult[];
  } | null>(null);

  const [testChatId, setTestChatId] = useState(userId ? String(userId) : '');
  const [testSending, setTestSending] = useState(false);
  const [testStatus, setTestStatus] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // 1-Click Auto-Setup handler
  const handleRunAutoSetup = async () => {
    if (!botToken.trim()) {
      triggerHaptic('error');
      setErrorMsg('Пожалуйста, введите токен бота от @BotFather (формат: 123456789:ABCDef...).');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    triggerHaptic('medium');
    sound.playClick();

    try {
      const response = await fetch('/api/telegram/auto-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          botToken: botToken.trim(),
          appUrl: customUrl.trim() || window.location.origin,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Не удалось настроить бота');
      }

      setSetupResult({
        botName: data.bot.first_name,
        botUsername: data.bot.username,
        botLink: data.botLink,
        steps: data.steps,
      });

      triggerHaptic('success');
      sound.playWinRare();
    } catch (err: unknown) {
      triggerHaptic('error');
      setErrorMsg(err instanceof Error ? err.message : 'Ошибка при обращении к серверу');
    } finally {
      setIsLoading(false);
    }
  };

  // Test Message sender
  const handleSendTestMessage = async () => {
    if (!testChatId.trim()) {
      setErrorMsg('Укажите ваш Chat ID в Telegram');
      return;
    }

    setTestSending(true);
    setTestStatus(null);
    triggerHaptic('medium');

    try {
      const res = await fetch('/api/telegram/test-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          botToken: botToken.trim(),
          chatId: testChatId.trim(),
          appUrl: customUrl.trim() || window.location.origin,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Ошибка отправки сообщения');
      }

      triggerHaptic('success');
      setTestStatus('Сообщение с кнопкой WebApp отправлено в ваш Telegram!');
    } catch (err: unknown) {
      triggerHaptic('error');
      setTestStatus(`Ошибка: ${err instanceof Error ? err.message : 'Не удалось отправить'}`);
    } finally {
      setTestSending(false);
    }
  };

  const handleCopyCode = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    triggerHaptic('success');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5">
      <div className="bg-[#11141b] border border-slate-800 rounded-3xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-100 flex items-center gap-1.5">
                <span>Авто-настройка Telegram Бота</span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.2 rounded font-mono">
                  1-Click Setup
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                Автоматическая привязка кнопки «📱 Играть», команд и описания
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-100 flex items-center justify-center text-sm font-bold transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-5 pt-3 pb-2 border-b border-slate-800/80 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab('auto_setup')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap ${
              activeTab === 'auto_setup'
                ? 'bg-emerald-500 text-slate-950 shadow-sm'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Мастер авто-добавления</span>
          </button>

          <button
            onClick={() => setActiveTab('bot_py')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap ${
              activeTab === 'bot_py'
                ? 'bg-emerald-500 text-slate-950 shadow-sm'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>bot.py (aiogram 3)</span>
          </button>

          <button
            onClick={() => setActiveTab('server_py')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap ${
              activeTab === 'server_py'
                ? 'bg-emerald-500 text-slate-950 shadow-sm'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            <span>server.py (FastAPI)</span>
          </button>

          <button
            onClick={() => setActiveTab('guide')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap ${
              activeTab === 'guide'
                ? 'bg-emerald-500 text-slate-950 shadow-sm'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Инструкция</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {activeTab === 'auto_setup' && (
            <div className="space-y-4 text-xs">
              {/* Info banner */}
              <div className="p-3.5 rounded-2xl bg-emerald-950/20 border border-emerald-500/30 text-slate-300 leading-relaxed">
                <p className="font-semibold text-emerald-300 text-xs mb-1">
                  ⚡ Как это работает:
                </p>
                Введите токен вашего бота от <strong>@BotFather</strong>. Приложение само сделает все необходимые вызовы Telegram Bot API:
                установит кнопку меню WebApp, пропишет команды <code>/start</code>, <code>/collection</code>, <code>/shop</code> и обновит карточку бота.
              </div>

              {/* Bot Token Input */}
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-200 flex items-center justify-between">
                  <span>Telegram Bot Token:</span>
                  <a
                    href="https://t.me/BotFather"
                    target="_blank"
                    rel="noreferrer"
                    className="text-emerald-400 hover:underline flex items-center gap-1 font-normal text-[11px]"
                  >
                    Получить в @BotFather
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </label>
                <input
                  type="password"
                  placeholder="Например: 7123456789:AAHk98_2kLxQ..."
                  value={botToken}
                  onChange={e => setBotToken(e.target.value)}
                  className="w-full bg-[#141822] border border-slate-800 focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder:text-slate-500 outline-none font-mono"
                />
              </div>

              {/* WebApp URL Input & 403 Fix Helper */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-slate-200">
                    URL вашего WebApp:
                  </label>
                  <span className="text-[10px] text-slate-400 font-mono">HTTPS обязателен для Telegram</span>
                </div>

                <input
                  type="text"
                  value={customUrl}
                  onChange={e => setCustomUrl(e.target.value)}
                  className="w-full bg-[#141822] border border-slate-800 focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder:text-slate-500 outline-none font-mono select-all"
                />

                {/* 403 Forbidden explanation & Quick Fix Buttons */}
                <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-500/40 text-amber-200 text-[11px] space-y-1.5">
                  <div className="font-bold flex items-center gap-1.5 text-amber-300">
                    <span>⚠️ Из-за чего возникает ошибка 403 в Telegram?</span>
                  </div>
                  <p className="text-slate-300 leading-snug">
                    Адрес с <code>ais-dev-</code> является закрытым адресом для вашей сессии Google. Telegram не может открыть его и получает <strong>403 Forbidden</strong>.
                  </p>
                  <div className="pt-1 flex flex-wrap gap-2">
                    {customUrl.includes('ais-dev-') && (
                      <button
                        type="button"
                        onClick={() => {
                          const publicUrl = customUrl.replace('ais-dev-', 'ais-pre-');
                          setCustomUrl(publicUrl);
                          triggerHaptic('success');
                        }}
                        className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 font-semibold transition-colors flex items-center gap-1"
                      >
                        <span>✓ Заменить на публичный URL (ais-pre-)</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('guide');
                      }}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                    >
                      Как сделать ngrok / Vercel
                    </button>
                  </div>
                </div>
              </div>

              {/* Error message */}
              {errorMsg && (
                <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-300 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span className="leading-snug">{errorMsg}</span>
                </div>
              )}

              {/* Primary 1-Click Action Button */}
              <button
                onClick={handleRunAutoSetup}
                disabled={isLoading}
                className={`w-full py-3.5 rounded-2xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg transition-all active:scale-98 ${
                  isLoading
                    ? 'bg-slate-800 text-slate-400 cursor-not-allowed'
                    : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20 glow-neon'
                }`}
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Выполняется авто-настройка через Bot API...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>🚀 Автодобавить всё в бота в 1 клик</span>
                  </>
                )}
              </button>

              {/* Result card after successful execution */}
              {setupResult && (
                <div className="p-4 rounded-2xl bg-[#141822] border border-emerald-500/40 space-y-3 animate-in fade-in">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span className="font-bold text-slate-100">
                        Бот @{setupResult.botUsername} успешно настроен!
                      </span>
                    </div>

                    <a
                      href={setupResult.botLink}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs flex items-center gap-1 hover:bg-emerald-400 transition-colors"
                    >
                      <span>Открыть бота</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>

                  {/* Step-by-step checkmarks */}
                  <div className="space-y-2">
                    {setupResult.steps.map((st, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-2 text-xs bg-slate-900/60 p-2 rounded-xl border border-slate-800/80"
                      >
                        <span className="text-emerald-400 font-bold">✓</span>
                        <div>
                          <strong className="text-slate-200">{st.step}: </strong>
                          <span className="text-slate-400">{st.message}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Test Send Section */}
                  <div className="pt-2 border-t border-slate-800 space-y-2">
                    <span className="font-semibold text-slate-300 text-xs">
                      Отправить тестовое приветствие в Telegram:
                    </span>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Ваш Chat ID или User ID"
                        value={testChatId}
                        onChange={e => setTestChatId(e.target.value)}
                        className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 font-mono outline-none"
                      />
                      <button
                        onClick={handleSendTestMessage}
                        disabled={testSending}
                        className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs flex items-center gap-1.5 transition-colors shrink-0"
                      >
                        <Send className="w-3.5 h-3.5 text-emerald-400" />
                        <span>{testSending ? 'Отправка...' : 'Отправить'}</span>
                      </button>
                    </div>
                    {testStatus && (
                      <p className="text-[11px] text-emerald-400 mt-1">{testStatus}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'bot_py' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">aiogram 3.x бот для запуска на сервере</span>
                <button
                  onClick={() => handleCopyCode(BOT_PYTHON_CODE)}
                  className="px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center gap-1 transition-colors"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Скопировано!' : 'Копировать код'}</span>
                </button>
              </div>
              <pre className="text-slate-300 bg-[#0c0e13] p-4 rounded-xl border border-slate-800 overflow-x-auto text-xs font-mono select-all">
                <code>{BOT_PYTHON_CODE}</code>
              </pre>
            </div>
          )}

          {activeTab === 'server_py' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">FastAPI бэкенд для синхронизации</span>
                <button
                  onClick={() => handleCopyCode(FASTAPI_BACKEND_CODE)}
                  className="px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center gap-1 transition-colors"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Скопировано!' : 'Копировать код'}</span>
                </button>
              </div>
              <pre className="text-slate-300 bg-[#0c0e13] p-4 rounded-xl border border-slate-800 overflow-x-auto text-xs font-mono select-all">
                <code>{FASTAPI_BACKEND_CODE}</code>
              </pre>
            </div>
          )}

          {activeTab === 'guide' && (
            <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
              <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-1.5">
                <h4 className="font-bold text-emerald-400 text-sm">Как быстро запустить бота:</h4>
                <p>1. Откройте в Telegram официального <strong>@BotFather</strong> и отправьте команду <code>/newbot</code>.</p>
                <p>2. Скопируйте полученный HTTP API Token.</p>
                <p>3. Вставьте его во вкладку <strong>«Мастер авто-добавления»</strong> выше и нажмите кнопку <strong>«Автодобавить всё в бота»</strong>.</p>
                <p>4. Готово! Бот моментально привяжет кнопку запуска WebApp, настроит меню и команды.</p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-1.5">
                <h4 className="font-bold text-emerald-400 text-sm">Зависимости (requirements.txt):</h4>
                <pre className="p-3 bg-[#0c0e13] rounded-xl border border-slate-800 font-mono text-[11px] select-all">
                  <code>{REQUIREMENTS_TXT}</code>
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
