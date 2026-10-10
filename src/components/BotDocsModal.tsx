import React, { useState } from 'react';
import { BOT_PYTHON_CODE, FASTAPI_BACKEND_CODE, REQUIREMENTS_TXT } from '../data/botCode';
import { Copy, Check, Terminal, ExternalLink, Bot, Server, BookOpen } from 'lucide-react';
import { triggerHaptic } from '../utils/telegram';

interface BotDocsModalProps {
  onClose: () => void;
}

export const BotDocsModal: React.FC<BotDocsModalProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<'bot' | 'server' | 'req' | 'guide'>('bot');
  const [copied, setCopied] = useState(false);

  const getCurrentCode = () => {
    if (activeTab === 'bot') return BOT_PYTHON_CODE;
    if (activeTab === 'server') return FASTAPI_BACKEND_CODE;
    if (activeTab === 'req') return REQUIREMENTS_TXT;
    return '';
  };

  const handleCopy = () => {
    const text = getCurrentCode();
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(true);
    triggerHaptic('success');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5">
      <div className="bg-[#11141b] border border-slate-800 rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Bot className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100">Telegram Bot & Backend (Python)</h2>
              <p className="text-[11px] text-slate-400">Готовые исходники для запуска на aiogram 3.x</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-100 flex items-center justify-center text-sm font-bold transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Tab switcher */}
        <div className="px-5 pt-3 pb-2 border-b border-slate-800/80 flex items-center justify-between gap-2 overflow-x-auto">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setActiveTab('bot')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                activeTab === 'bot'
                  ? 'bg-emerald-500 text-slate-950'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Bot className="w-3.5 h-3.5" />
              <span>bot.py</span>
            </button>

            <button
              onClick={() => setActiveTab('server')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                activeTab === 'server'
                  ? 'bg-emerald-500 text-slate-950'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Server className="w-3.5 h-3.5" />
              <span>server.py (FastAPI)</span>
            </button>

            <button
              onClick={() => setActiveTab('req')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                activeTab === 'req'
                  ? 'bg-emerald-500 text-slate-950'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>requirements.txt</span>
            </button>

            <button
              onClick={() => setActiveTab('guide')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                activeTab === 'guide'
                  ? 'bg-emerald-500 text-slate-950'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Инструкция</span>
            </button>
          </div>

          {activeTab !== 'guide' && (
            <button
              onClick={handleCopy}
              className="px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center gap-1 shrink-0 transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Скопировано!' : 'Копировать'}</span>
            </button>
          )}
        </div>

        {/* Content Box */}
        <div className="p-5 overflow-y-auto flex-1 font-mono text-xs">
          {activeTab === 'guide' ? (
            <div className="font-sans text-xs text-slate-300 space-y-4 leading-relaxed">
              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
                <h4 className="font-bold text-sm text-emerald-400 mb-1">Шаг 1. Создание Telegram-бота</h4>
                <p>1. Откройте в Telegram официального бота <strong>@BotFather</strong>.</p>
                <p>2. Отправьте команду <code>/newbot</code> и укажите название и username бота.</p>
                <p>3. Скопируйте полученный <strong>BOT_TOKEN</strong> (например, <code>7123456789:AA...</code>).</p>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
                <h4 className="font-bold text-sm text-emerald-400 mb-1">Шаг 2. Развертывание Mini App (Frontend)</h4>
                <p>1. Загрузите фронтенд на Vercel, Cloud Run или GitHub Pages.</p>
                <p>2. Для локального тестирования запустите <code>npm run dev</code> и используйте <strong>ngrok</strong>:</p>
                <div className="bg-[#0b0d11] p-2.5 rounded-lg text-emerald-300 font-mono mt-1 select-all">
                  ngrok http 3000
                </div>
                <p className="mt-1 text-slate-400 text-[11px]">
                  ngrok предоставит HTTPS-ссылку вроде <code>https://abc-123.ngrok-free.app</code>.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
                <h4 className="font-bold text-sm text-emerald-400 mb-1">Шаг 3. Привязка Mini App в BotFather</h4>
                <p>1. В @BotFather введите <code>/mybots</code> ➔ выберите вашего бота.</p>
                <p>2. Нажмите <strong>Bot Settings</strong> ➔ <strong>Menu Button</strong> ➔ <strong>Configure menu button</strong>.</p>
                <p>3. Вставьте URL вашего Mini App и укажите надпись кнопки (например: <strong>«📱 Играть»</strong>).</p>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
                <h4 className="font-bold text-sm text-emerald-400 mb-1">Шаг 4. Запуск Python-скрипта бота</h4>
                <div className="bg-[#0b0d11] p-2.5 rounded-lg text-emerald-300 font-mono space-y-1">
                  <div>pip install -r requirements.txt</div>
                  <div>export BOT_TOKEN="ваш_токен"</div>
                  <div>export WEBAPP_URL="https://ваш_url_приложения"</div>
                  <div>python bot.py</div>
                </div>
              </div>
            </div>
          ) : (
            <pre className="text-slate-300 bg-[#0c0e13] p-4 rounded-xl border border-slate-800/80 overflow-x-auto leading-relaxed select-all">
              <code>{getCurrentCode()}</code>
            </pre>
          )}
        </div>
      </div>
    </div>
  );
};
