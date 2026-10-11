import React from 'react';
import { PhoneNumberCard } from '../types/game';
import { RARITY_CONFIGS } from '../utils/rarityConfig';
import { BASE_NUMBER_INCOME } from '../utils/afkFarm';
import { Wifi, Signal, Star, Lock, Unlock, Zap } from 'lucide-react';

interface SimCardViewProps {
  card: PhoneNumberCard;
  isCompact?: boolean;
  onToggleFavorite?: (id: string) => void;
  onSell?: (card: PhoneNumberCard) => void;
  isActionable?: boolean;
}

export const SimCardView: React.FC<SimCardViewProps> = ({
  card,
  isCompact = false,
  onToggleFavorite,
  onSell,
  isActionable = false,
}) => {
  const config = RARITY_CONFIGS[card.rarity];
  const isMythic = card.rarity === 'mythic';
  const isLegendary = card.rarity === 'legendary';
  const isEpic = card.rarity === 'epic';

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border transition-all duration-300 ${config.borderClass} ${
        isMythic
          ? 'shadow-[0_0_35px_rgba(255,0,85,0.6)] ring-2 ring-rose-500/80 animate-pulse'
          : isLegendary
          ? 'glow-legendary'
          : isEpic
          ? 'glow-neon'
          : ''
      } bg-gradient-to-br ${config.bgGradient} ${
        isCompact ? 'p-3.5 sm:p-4' : 'p-5 sm:p-6'
      } shadow-xl text-slate-100 flex flex-col justify-between`}
    >
      {/* SIM Card Angled Notch (top right corner simulation) */}
      <div className="absolute top-0 right-0 w-8 h-8 pointer-events-none">
        <div className="absolute top-0 right-0 w-0 h-0 border-t-[28px] border-t-[#0d0f12] border-l-[28px] border-l-transparent" />
      </div>

      {/* Top Bar of SIM Card */}
      <div className="flex items-center justify-between gap-2 mb-3">
        {/* Operator & Network */}
        <div className="flex items-center gap-1.5">
          {card.countryFlag && <span className="text-sm select-none">{card.countryFlag}</span>}
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: config.color }} />
          <span className="font-bold text-xs sm:text-sm tracking-wide uppercase text-slate-200">
            {card.operatorName}
          </span>
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800/80 font-mono text-slate-400">
            5G
          </span>
        </div>

        {/* Favorite Lock / Rarity Badge */}
        <div className="flex items-center gap-1.5 pr-4">
          {onToggleFavorite && (
            <button
              onClick={e => {
                e.stopPropagation();
                onToggleFavorite(card.id);
              }}
              className="p-1 text-slate-400 hover:text-amber-400 transition-colors"
              title={card.isFavorite ? 'Снять защиту от продажи' : 'Защитить от продажи'}
            >
              {card.isFavorite ? (
                <Lock className="w-3.5 h-3.5 text-amber-400" />
              ) : (
                <Unlock className="w-3.5 h-3.5 text-slate-500" />
              )}
            </button>
          )}
          <span
            className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md"
            style={{ color: config.color, backgroundColor: `${config.color}15` }}
          >
            {config.nameRu.split(' · ')[0]}
          </span>
        </div>
      </div>

      {/* Middle Zone: Gold Microchip & Phone Number */}
      <div className="my-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Contact Chip Graphic */}
        <div className="w-12 h-9 rounded-md bg-gradient-to-tr from-amber-400 via-yellow-300 to-amber-500 p-[1px] shadow-sm shrink-0">
          <div className="w-full h-full rounded-[5px] bg-[#d4af37] relative overflow-hidden flex items-center justify-center">
            {/* Chip Circuit lines */}
            <div className="absolute inset-0 opacity-40 bg-[linear-gradient(to_right,#805b10_1px,transparent_1px),linear-gradient(to_bottom,#805b10_1px,transparent_1px)] bg-[size:4px_4px]" />
            <div className="w-6 h-4 border border-[#8a6815]/70 rounded-[3px] z-10" />
            <div className="absolute w-full h-[1px] bg-[#8a6815]/70" />
            <div className="absolute h-full w-[1px] bg-[#8a6815]/70" />
          </div>
        </div>

        {/* Main Phone Number */}
        <div className="text-left sm:text-right">
          <div className="text-[11px] text-slate-400 tracking-wider">MSISDN</div>
          <div
            className={`font-mono-numbers font-extrabold tracking-tight select-all ${
              isCompact ? 'text-lg sm:text-xl' : 'text-xl sm:text-2xl md:text-3xl'
            }`}
            style={{ color: config.color }}
          >
            {card.fullNumber}
          </div>
        </div>
      </div>

      {/* Bottom Zone: Metadata Tags (Unboxed inline text with separators) & Value */}
      <div className="mt-3 pt-3 border-t border-slate-700/50 flex flex-wrap items-center justify-between gap-2">
        {/* Clean unboxed tags */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-300">
          {card.tags.map((tag, idx) => (
            <React.Fragment key={idx}>
              <span>{tag}</span>
              {idx < card.tags.length - 1 && <span className="text-slate-500" aria-hidden="true">·</span>}
            </React.Fragment>
          ))}
        </div>

        {/* Valuation, Income & Multiplier */}
        <div className="flex items-center gap-2">
          {/* Steady income per second */}
          <span className="text-[11px] font-bold text-emerald-300 font-mono-numbers bg-emerald-950/60 border border-emerald-500/30 px-1.5 py-0.5 rounded-md flex items-center gap-1">
            <Zap className="w-2.5 h-2.5 text-emerald-400 fill-emerald-400" />
            <span>
              +{(() => {
                const inc = (BASE_NUMBER_INCOME[card.rarity] || 0.2) * (card.countryIncomeMultiplier || 1);
                return inc >= 10 ? Math.round(inc) : inc.toFixed(1);
              })()} ₽/с
            </span>
          </span>

          <span className="text-xs font-mono font-bold text-slate-300">
            x{card.multiplier.toFixed(1)}
          </span>
          <span className="text-sm font-bold text-emerald-400 font-mono-numbers">
            {card.sellPrice.toLocaleString('ru-RU')} ₽
          </span>
        </div>
      </div>

      {/* Optional action buttons inside card */}
      {isActionable && onSell && (
        <div className="mt-3 pt-2 flex items-center justify-end gap-2">
          <button
            onClick={() => onSell(card)}
            disabled={card.isFavorite}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              card.isFavorite
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                : 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 active:scale-95'
            }`}
          >
            {card.isFavorite ? 'Защищено от продажи' : `Продать за ${card.sellPrice.toLocaleString('ru-RU')} ₽`}
          </button>
        </div>
      )}
    </div>
  );
};
