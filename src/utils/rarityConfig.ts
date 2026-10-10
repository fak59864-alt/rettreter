import { RarityConfig, RarityTier } from '../types/game';

// Hardcore economy & ultra-low jackpot drop rates:
// Common: ~85.5%
// Uncommon: 11.0%
// Rare: 2.80%
// Epic: 0.65%
// Legendary VIP: 0.02% (1 in 5,000 spins baseline!)
// Mythic 9x: 0.001% (1 in 100,000 spins baseline!)
export const RARITY_CONFIGS: Record<RarityTier, RarityConfig> = {
  common: {
    id: 'common',
    nameRu: 'Обычный',
    badgeRu: 'Common',
    color: '#94a3b8',
    borderClass: 'border-slate-700/80',
    bgGradient: 'from-slate-900/90 via-slate-800/80 to-slate-900/95',
    glowClass: 'shadow-slate-900/50',
    textColor: 'text-slate-400',
    minMultiplier: 0.05,
    maxMultiplier: 0.18,
    baseChance: 85.529,
  },
  uncommon: {
    id: 'uncommon',
    nameRu: 'Бронзовый · Пара',
    badgeRu: 'Uncommon',
    color: '#f59e0b',
    borderClass: 'border-amber-600/70',
    bgGradient: 'from-amber-950/60 via-stone-900/90 to-amber-950/40',
    glowClass: 'shadow-amber-500/20',
    textColor: 'text-amber-400',
    minMultiplier: 0.35,
    maxMultiplier: 0.65,
    baseChance: 11.00,
  },
  rare: {
    id: 'rare',
    nameRu: 'Серебряный · Лесенка',
    badgeRu: 'Rare',
    color: '#38bdf8',
    borderClass: 'border-sky-500/70',
    bgGradient: 'from-sky-950/70 via-slate-900/90 to-blue-950/50',
    glowClass: 'shadow-sky-500/30',
    textColor: 'text-sky-400',
    minMultiplier: 1.20,
    maxMultiplier: 2.40,
    baseChance: 2.80,
  },
  epic: {
    id: 'epic',
    nameRu: 'Золотой · Палиндром',
    badgeRu: 'Epic',
    color: '#eab308',
    borderClass: 'border-yellow-400/80 shadow-[0_0_20px_rgba(234,179,8,0.25)]',
    bgGradient: 'from-yellow-950/80 via-neutral-900/90 to-amber-950/60',
    glowClass: 'shadow-yellow-500/40',
    textColor: 'text-yellow-400',
    minMultiplier: 4.0,
    maxMultiplier: 10.0,
    baseChance: 0.65,
  },
  legendary: {
    id: 'legendary',
    nameRu: 'Бриллиантовый · VIP',
    badgeRu: 'Legendary VIP',
    color: '#ec4899',
    borderClass: 'border-fuchsia-500/90 shadow-[0_0_28px_rgba(236,72,153,0.35)]',
    bgGradient: 'from-fuchsia-950/80 via-purple-950/90 to-indigo-950/80',
    glowClass: 'shadow-fuchsia-500/50',
    textColor: 'text-fuchsia-400',
    minMultiplier: 20.0,
    maxMultiplier: 60.0,
    baseChance: 0.02,
  },
  mythic: {
    id: 'mythic',
    nameRu: 'Мифический · 9 Одинаковых',
    badgeRu: 'Mythic 9x',
    color: '#ff0055',
    borderClass: 'border-rose-500 shadow-[0_0_35px_rgba(255,0,85,0.6)] ring-1 ring-rose-400',
    bgGradient: 'from-rose-950/90 via-purple-950/90 to-red-950/95',
    glowClass: 'shadow-rose-500/60',
    textColor: 'text-rose-400',
    minMultiplier: 150.0,
    maxMultiplier: 500.0,
    baseChance: 0.001,
  },
};

export const OPERATORS = [
  { code: '999', name: 'Т-Мобайл', color: '#ffdd2d', logo: 'T-Mobile' },
  { code: '777', name: 'ГосСвязь VIP', color: '#ec4899', logo: 'VIP777' },
  { code: '916', name: 'МТС', color: '#e30611', logo: 'MTS' },
  { code: '926', name: 'МегаФон', color: '#00b956', logo: 'MegaFon' },
  { code: '903', name: 'Билайн', color: '#ffc800', logo: 'Beeline' },
  { code: '977', name: 'Tele2 / t2', color: '#1f2229', logo: 'Tele2' },
  { code: '995', name: 'СберМобайл', color: '#21a038', logo: 'Sber' },
  { code: '991', name: 'Yota', color: '#00b0d8', logo: 'Yota' },
];
