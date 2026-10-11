export type RarityTier = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';

export interface RarityConfig {
  id: RarityTier;
  nameRu: string;
  badgeRu: string;
  color: string;
  borderClass: string;
  bgGradient: string;
  glowClass: string;
  textColor: string;
  minMultiplier: number;
  maxMultiplier: number;
  baseChance: number; // in percent (lowered for true prestige)
}

export type CountryId =
  | 'RU'
  | 'BY'
  | 'KZ'
  | 'AE'
  | 'ABH'
  | 'UA'
  | 'DE'
  | 'AZ'
  | 'AM'
  | 'GE'
  | 'US'
  | 'UZ';

export type BetTierId = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export interface CountryInfo {
  id: CountryId;
  name: string;
  flag: string;
  dialCode: string;
  currency: string;
  costMultiplier: number;
  incomeMultiplier: number;
  tierLabel: string;
}

export interface BetTierInfo {
  id: BetTierId;
  title: string;
  sub: string;
  multiplier: number; // cost multiplier: 1x, 8x, 35x, 110x, 820x
  minRarity: RarityTier;
  color: string;
}

export interface PhoneNumberCard {
  id: string;
  fullNumber: string; // e.g. +7 (999) 777-77-77
  tailFormatted: string; // 777-77-77
  rawTail: string; // 7777777
  operatorCode: string; // e.g. 999
  operatorName: string; // e.g. Т-Мобайл
  rarity: RarityTier;
  multiplier: number;
  sellPrice: number;
  spinCost: number;
  tags: string[];
  createdAt: number;
  isFavorite?: boolean;
  countryId?: CountryId;
  countryFlag?: string;
  countryIncomeMultiplier?: number;
}

// Auto-spin filter rule
export type AutoAction = 'sell' | 'keep' | 'stop';

export interface AutoSpinFilterSettings {
  common: AutoAction;
  uncommon: AutoAction;
  rare: AutoAction;
  epic: AutoAction;
  legendary: AutoAction;
  mythic: AutoAction;
  stopOnInventoryFull: boolean;
  maxSpins: number; // 0 = infinite until balance/stop
}

export interface PlayerUpgrades {
  // Gacha Upgrades (Expanded long progression: 40-50 levels)
  luckLevel: number; // 0 to 50
  discountLevel: number; // 0 to 40
  cashbackLevel: number; // 0 to 50
  inventoryCapLevel: number; // 0 to 50
  pityGuaranteedLevel: number; // 0 to 25

  // Phone Numbers Passive Rent Upgrades (Long progression: 40-50 levels)
  numberRentMultiplierLevel: number; // 0 to 50 (+5% к доходу с каждого номера за ур.)
  roamingLevel: number; // 0 to 50 (+8% к общему пассивному доходу за ур.)
  simPoolLevel: number; // 0 to 40 (+50 ₽/сек базового пула за ур.)
  jackpotRadarLevel: number; // 0 to 30 (+шанс Epic/Legendary)

  // Clicker Tap Upgrades (Long progression: 50-100 levels)
  clickPowerLevel: number; // 0 to 80 (Сила клика: +1, +3, +8... ₽ за тап)
  clickCritChanceLevel: number; // 0 to 40 (Шанс крита до 40%)
  clickCritMultLevel: number; // 0 to 40 (Крит множитель до x15)
  autoClickerLevel: number; // 0 to 40 (Авто-кликер тапов в сек)

  // Prestige system
  prestigeLevel: number; // Престиж (+50% дохода с номеров и +1% базовой удачи за ранг)
}

export interface PlayerStats {
  totalSpins: number;
  totalSpent: number;
  totalEarned: number;
  totalAfkEarned: number;
  totalCasinoEarned: number;
  totalClickerEarned: number;
  totalClicks: number;
  totalTrades: number;
  highestPayout: number;
  highestCard: PhoneNumberCard | null;
  countsByRarity: Record<RarityTier, number>;
  claimedDailyBonusAt?: number;
  lastActiveTimestamp: number;
}

export interface TelegramUserData {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date?: number;
  isLinkedToTelegram?: boolean;
}

export interface LeaderboardUser {
  rank: number;
  userId: number | string;
  name: string;
  username?: string;
  photoUrl?: string;
  balance: number;
  level: number;
  cardsCount: number;
  bestCardNumber?: string;
  bestCardRarity?: RarityTier;
  bestCardTitle?: string;
  isCurrentUser?: boolean;
  isTelegram?: boolean;
  updatedAt?: number;
}

export interface LeaderboardResponse {
  success: boolean;
  total: number;
  leaderboard: LeaderboardUser[];
  currentUserRank?: number | null;
  updatedAt?: number;
}
