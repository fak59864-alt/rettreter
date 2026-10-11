import React from 'react';
import { PlayerStats, PhoneNumberCard, RarityTier } from '../types/game';
import { RARITY_CONFIGS } from '../utils/rarityConfig';
import { SimCardView } from './SimCardView';
import { Trophy, TrendingUp, Sparkles, Award, BarChart3 } from 'lucide-react';

interface StatsModalProps {
  stats: PlayerStats;
  balance: number;
  onClose: () => void;
  onOpenAdminSetup?: () => void;
}

export const StatsModal: React.FC<StatsModalProps> = ({
  stats,
  balance,
  onClose,
  onOpenAdminSetup,
}) => {
  const netProfit = stats.totalEarned - stats.totalSpent;
  const isProfit = netProfit >= 0;
  const roi = stats.totalSpent > 0 ? ((netProfit / stats.totalSpent) * 100).toFixed(1) : '0.0';

  const achievements = [
    {
      id: 'first_spin',
      name: 'Первый звонок',
      desc: 'Совершите первый прокрут SIM-номера',
      unlocked: stats.totalSpins >= 1,
    },
    {
      id: 'spin_10',
      name: 'Азартный абонент',
      desc: 'Сделайте 10 прокрутов',
      unlocked: stats.totalSpins >= 10,
    },
    {
      id: 'afk_earner',
      name: 'Телеком-магнат',
      desc: 'Заработайте 50 000 ₽ на пассивном АФК доходе',
      unlocked: (stats.totalAfkEarned || 0) >= 50000,
    },
    {
      id: 'rare_found',
      name: 'Серебряный блеск',
      desc: 'Выбейте редкий номер с лесенкой',
      unlocked: stats.countsByRarity.rare > 0,
    },
    {
      id: 'epic_found',
      name: 'Три топора',
      desc: 'Выбейте золотой номер или палиндром',
      unlocked: stats.countsByRarity.epic > 0,
    },
    {
      id: 'vip_legendary',
      name: 'Алмазный VIP',
      desc: 'Выбейте легендарный номер x50–x500',
      unlocked: stats.countsByRarity.legendary > 0,
    },
    {
      id: 'millionaire',
      name: 'Связной миллионер',
      desc: 'Заработайте суммарно 1 000 000 ₽',
      unlocked: stats.totalEarned >= 1000000,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5">
      <div className="bg-[#11141b] border border-slate-800 rounded-3xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-emerald-400" />
            <h2 className="text-sm font-bold text-slate-100">Игровая статистика и Зал славы</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-100 flex items-center justify-center text-sm font-bold transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          {/* Main Key Figures */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="bg-[#141720] border border-slate-800 p-3 rounded-2xl">
              <span className="text-slate-400 text-[11px]">Всего прокрутов</span>
              <div className="text-xl font-extrabold text-slate-100 font-mono-numbers mt-1">
                {stats.totalSpins}
              </div>
            </div>

            <div className="bg-[#141720] border border-slate-800 p-3 rounded-2xl">
              <span className="text-slate-400 text-[11px]">Профит / Убыток</span>
              <div
                className={`text-xl font-extrabold font-mono-numbers mt-1 ${
                  isProfit ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {isProfit ? '+' : ''}
                {netProfit.toLocaleString('ru-RU')} ₽
              </div>
            </div>

            <div className="bg-[#141720] border border-slate-800 p-3 rounded-2xl">
              <span className="text-slate-400 text-[11px]">Потрачено на рулетку</span>
              <div className="text-base font-bold text-slate-300 font-mono-numbers mt-1">
                {stats.totalSpent.toLocaleString('ru-RU')} ₽
              </div>
            </div>

            <div className="bg-[#141720] border border-slate-800 p-3 rounded-2xl">
              <span className="text-slate-400 text-[11px]">Выручено с продажи</span>
              <div className="text-base font-bold text-emerald-300 font-mono-numbers mt-1">
                {stats.totalEarned.toLocaleString('ru-RU')} ₽
              </div>
            </div>

            <div className="bg-[#141720] border border-slate-800 p-3 rounded-2xl col-span-2 flex items-center justify-between">
              <div>
                <span className="text-slate-400 text-[11px]">Пассивный АФК-доход вышек</span>
                <div className="text-base font-black text-emerald-400 font-mono-numbers mt-0.5">
                  +{(stats.totalAfkEarned || 0).toLocaleString('ru-RU')} ₽
                </div>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">Автономная сеть</span>
            </div>
          </div>

          {/* Rarity Breakdown */}
          <div className="bg-[#141720] border border-slate-800 p-3.5 rounded-2xl">
            <div className="font-bold text-slate-200 mb-2 flex items-center justify-between">
              <span>Выбито по редкостям:</span>
              <span className="text-slate-400 font-mono">Штук</span>
            </div>
            <div className="space-y-1.5">
              {(['mythic', 'legendary', 'epic', 'rare', 'uncommon', 'common'] as RarityTier[]).map(tier => {
                const cfg = RARITY_CONFIGS[tier];
                const count = stats.countsByRarity[tier] || 0;
                return (
                  <div key={tier} className="flex items-center justify-between py-1 border-b border-slate-800/60 last:border-none">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cfg.color }} />
                      <span className="text-slate-300">{cfg.nameRu}</span>
                    </div>
                    <span className="font-bold font-mono-numbers text-slate-100">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Best Drop Ever */}
          {stats.highestCard && (
            <div>
              <div className="font-bold text-slate-200 mb-2 flex items-center gap-1.5">
                <Trophy className="w-4 h-4 text-amber-400" />
                <span>Самый дорогой выбитый номер:</span>
              </div>
              <SimCardView card={stats.highestCard} isCompact />
            </div>
          )}

          {/* Achievements */}
          <div>
            <div className="font-bold text-slate-200 mb-2 flex items-center gap-1.5">
              <Award className="w-4 h-4 text-emerald-400" />
              <span>Достижения ({achievements.filter(a => a.unlocked).length}/{achievements.length})</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {achievements.map(ach => (
                <div
                  key={ach.id}
                  className={`p-2.5 rounded-xl border transition-all ${
                    ach.unlocked
                      ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-200'
                      : 'bg-slate-900/40 border-slate-800 text-slate-500 opacity-60'
                  }`}
                >
                  <div className="font-bold text-xs flex items-center gap-1">
                    <span>{ach.unlocked ? '✨' : '🔒'}</span>
                    <span>{ach.name}</span>
                  </div>
                  <p className="text-[10px] mt-0.5 leading-tight opacity-90">{ach.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Discreet Admin / Bot setup button */}
          {onOpenAdminSetup && (
            <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
              <span>SIM Gacha TMA v2.0</span>
              <button
                onClick={() => {
                  onClose();
                  onOpenAdminSetup();
                }}
                className="text-slate-400 hover:text-emerald-400 transition-colors underline"
              >
                Настройки бота
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
