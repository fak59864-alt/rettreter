import React from 'react';
import { Sparkles, Coins, Clock, ArrowRight } from 'lucide-react';
import { triggerHaptic } from '../utils/telegram';
import { sound } from '../utils/audio';

interface OfflineRewardModalProps {
  secondsOffline: number;
  earnedAmount: number;
  onClaim: () => void;
}

export const OfflineRewardModal: React.FC<OfflineRewardModalProps> = ({
  secondsOffline,
  earnedAmount,
  onClaim,
}) => {
  const hours = Math.floor(secondsOffline / 3600);
  const minutes = Math.floor((secondsOffline % 3600) / 60);

  const formatTime = () => {
    if (hours > 0) {
      return `${hours} ч ${minutes} мин`;
    }
    return `${Math.max(1, minutes)} мин`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-end sm:items-center justify-center p-3 sm:p-4">
      <div className="bg-[#121620] border border-emerald-500/40 rounded-3xl max-w-sm w-full p-6 text-center space-y-4 shadow-2xl animate-in slide-in-from-bottom-5 duration-300">
        {/* Animated Icon */}
        <div className="relative w-20 h-20 mx-auto">
          <div className="absolute inset-0 bg-emerald-500/20 rounded-full blur-xl animate-pulse" />
          <div className="relative w-full h-full rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 p-[2px] shadow-lg">
            <div className="w-full h-full rounded-[22px] bg-[#0f131a] flex items-center justify-center text-emerald-400">
              <Coins className="w-10 h-10 animate-bounce" />
            </div>
          </div>
        </div>

        <div>
          <div className="text-xs uppercase tracking-wider text-emerald-400 font-bold flex items-center justify-center gap-1">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Пассивный доход</span>
          </div>
          <h2 className="text-xl font-extrabold text-slate-100 mt-1">
            Сеть работала в фоне!
          </h2>
          <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400 mt-1">
            <Clock className="w-3.5 h-3.5" />
            <span>Вас не было: {formatTime()}</span>
          </div>
        </div>

        {/* Earned Amount Highlight */}
        <div className="bg-[#0b0e14] border border-slate-800 rounded-2xl p-4 shadow-inner">
          <div className="text-xs text-slate-400 font-medium">Накоплено вышками связи:</div>
          <div className="text-3xl font-black text-emerald-400 font-mono-numbers mt-1 tracking-tight">
            +{earnedAmount.toLocaleString('ru-RU')} ₽
          </div>
        </div>

        {/* Claim CTA Button */}
        <button
          onClick={() => {
            triggerHaptic('success');
            sound.playCoin();
            onClaim();
          }}
          className="w-full h-14 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-base flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 active:scale-95 transition-all glow-neon"
        >
          <span>Забрать доход</span>
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
