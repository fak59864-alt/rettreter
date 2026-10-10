import React from 'react';
import { TelegramUserData } from '../types/game';
import { Volume2, VolumeX, Clover, Zap, Trophy } from 'lucide-react';
import { triggerHaptic } from '../utils/telegram';

interface HeaderProps {
  user: TelegramUserData;
  balance: number;
  luckLevel: number;
  level: number;
  xpProgress: number;
  coinsPerSec: number;
  isMuted: boolean;
  onToggleMute: () => void;
  onOpenStats: () => void;
  onOpenShop: () => void;
  onOpenLeaderboard: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  balance,
  luckLevel,
  level,
  xpProgress,
  coinsPerSec,
  isMuted,
  onToggleMute,
  onOpenStats,
  onOpenShop,
  onOpenLeaderboard,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-[#0d0f12]/95 backdrop-blur-md border-b border-slate-800/80 px-3.5 py-2.5">
      <div className="max-w-md sm:max-w-4xl mx-auto flex items-center justify-between gap-2.5">
        {/* Left Zone: Player Profile & Level */}
        <button
          onClick={() => {
            triggerHaptic('light');
            onOpenStats();
          }}
          className="flex items-center gap-2 text-left group p-0.5 -m-0.5 rounded-xl transition-transform active:scale-95 shrink-0"
          title="Открыть профиль и статистику"
        >
          <div className="relative">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-emerald-600 via-teal-500 to-emerald-400 p-[1.5px] shadow-sm">
              <div className="w-full h-full rounded-[10px] bg-[#12151b] flex items-center justify-center overflow-hidden">
                {user.photo_url ? (
                  <img src={user.photo_url} alt={user.first_name} className="w-full h-full object-cover" />
                ) : (
                  <span className="font-black text-xs sm:text-sm text-emerald-400">
                    {user.first_name.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
            </div>
            <div className="absolute -bottom-1 -right-1 bg-slate-900 border border-emerald-500/60 rounded-full px-1.5 py-[0.5px] text-[9px] font-bold text-emerald-400 font-mono-numbers">
              {level}
            </div>
          </div>

          <div className="min-w-0">
            <div className="text-xs font-bold text-slate-100 truncate max-w-[85px] sm:max-w-[140px] leading-tight">
              {user.first_name}
            </div>
            {/* XP Bar */}
            <div className="w-16 sm:w-20 h-1.5 bg-slate-800 rounded-full overflow-hidden mt-1">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-300 rounded-full"
                style={{ width: `${Math.min(100, Math.max(5, xpProgress))}%` }}
              />
            </div>
          </div>
        </button>

        {/* Center / Right Zone: AFK Passive Income & Balance */}
        <div className="flex items-center gap-1.5 sm:gap-2.5">
          {/* AFK Passive income badge */}
          <button
            onClick={() => {
              triggerHaptic('light');
              onOpenShop();
            }}
            className={`flex items-center gap-1 px-2 py-1 rounded-xl border text-[11px] font-bold transition-transform active:scale-95 ${
              coinsPerSec > 0
                ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300 shadow-sm'
                : 'bg-slate-900/60 border-slate-800 text-slate-400'
            }`}
            title="Пассивный АФК доход в секунду. Нажмите, чтобы улучшить."
          >
            <Zap className={`w-3 h-3 ${coinsPerSec > 0 ? 'text-emerald-400 fill-emerald-400 animate-pulse' : 'text-slate-500'}`} />
            <span className="font-mono-numbers">+{coinsPerSec}/с</span>
          </button>

          {/* Luck indicator */}
          <div
            className={`hidden xs:flex items-center gap-1 px-2 py-1 rounded-xl border text-[11px] font-bold ${
              luckLevel > 0
                ? 'bg-amber-950/30 border-amber-500/30 text-amber-300'
                : 'bg-slate-900/60 border-slate-800 text-slate-400'
            }`}
            title={`Уровень удачи: ${luckLevel}. Повышает шанс редких номеров.`}
          >
            <Clover className={`w-3 h-3 ${luckLevel > 0 ? 'text-amber-400' : 'text-slate-500'}`} />
            <span className="font-mono-numbers">+{luckLevel * 12}%</span>
          </div>

          {/* Leaderboard Top Players Button */}
          <button
            onClick={() => {
              triggerHaptic('light');
              onOpenLeaderboard();
            }}
            className="flex items-center gap-1 px-2 py-1 rounded-xl border bg-gradient-to-r from-amber-950/40 via-yellow-950/30 to-amber-950/20 border-amber-500/40 text-amber-300 hover:border-amber-400 active:scale-95 transition-all shadow-sm"
            title="Открыть топ реальных игроков по балансу"
          >
            <Trophy className="w-3.5 h-3.5 text-amber-400 fill-amber-400/20" />
            <span className="text-[11px] font-black tracking-tight">Топ</span>
          </button>

          {/* Sound Mute Toggle */}
          <button
            onClick={() => {
              triggerHaptic('light');
              onToggleMute();
            }}
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-200 active:scale-95 transition-colors shrink-0"
            title={isMuted ? 'Включить звук' : 'Выключить звук'}
            aria-label="Звук"
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5 text-slate-500" /> : <Volume2 className="w-3.5 h-3.5 text-emerald-400" />}
          </button>

          {/* Primary Balance Display */}
          <div className="bg-[#141822] border border-slate-800 rounded-xl px-2.5 sm:px-3 py-1 flex flex-col items-end shadow-inner shrink-0">
            <span className="text-[9px] text-slate-400 uppercase tracking-wider font-semibold">Баланс</span>
            <span className="text-xs sm:text-sm font-black text-emerald-400 font-mono-numbers tracking-tight">
              {balance.toLocaleString('ru-RU')} ₽
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};
