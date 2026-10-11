import React, { useState, useEffect, useRef } from 'react';
import {
  PhoneNumberCard,
  RarityTier,
  AutoSpinFilterSettings,
  AutoAction,
  CountryId,
  BetTierId,
} from '../types/game';
import { rollMultiplePhoneNumbers } from '../utils/numberGenerator';
import {
  RARITY_CONFIGS,
  COUNTRIES,
  OPERATORS_BY_COUNTRY,
  BET_TIERS,
  OPERATORS,
} from '../utils/rarityConfig';
import { SimCardView } from './SimCardView';
import { BASE_NUMBER_INCOME } from '../utils/afkFarm';
import { sound } from '../utils/audio';
import { triggerHaptic } from '../utils/telegram';
import {
  Sparkles,
  RefreshCw,
  BookmarkPlus,
  DollarSign,
  HelpCircle,
  SlidersHorizontal,
  Flame,
  Layers,
  StopCircle,
  Check,
  Trash2,
  Zap,
  ChevronDown,
  Globe,
  Target,
} from 'lucide-react';

interface GachaWheelProps {
  balance: number;
  luckLevel: number;
  discountLevel: number;
  cashbackLevel: number;
  prestigeLevel: number;
  jackpotRadarLevel?: number;
  inventoryCount: number;
  maxInventory: number;
  onSpinSuccess: (cards: PhoneNumberCard[], cost: number) => void;
  onSellCard: (card: PhoneNumberCard) => void;
  onSellMultipleCards: (cards: PhoneNumberCard[]) => void;
  onAddToCollection: (card: PhoneNumberCard) => void;
  onAddMultipleToCollection: (cards: PhoneNumberCard[]) => void;
}

const DEFAULT_FILTER_SETTINGS: AutoSpinFilterSettings = {
  common: 'sell',
  uncommon: 'sell',
  rare: 'keep',
  epic: 'keep',
  legendary: 'stop',
  mythic: 'stop',
  stopOnInventoryFull: true,
  maxSpins: 0,
};

export const GachaWheel: React.FC<GachaWheelProps> = ({
  balance,
  luckLevel,
  discountLevel,
  cashbackLevel,
  prestigeLevel,
  jackpotRadarLevel = 0,
  inventoryCount,
  maxInventory,
  onSpinSuccess,
  onSellCard,
  onSellMultipleCards,
  onAddToCollection,
  onAddMultipleToCollection,
}) => {
  // Number of cards to spin simultaneously: 1, 3, 5, 10
  const [simCount, setSimCount] = useState<1 | 3 | 5 | 10>(1);
  const [isSpinning, setIsSpinning] = useState(false);
  const [droppedCards, setDroppedCards] = useState<PhoneNumberCard[]>([]);

  // Country and Bet Tier states
  const [selectedCountry, setSelectedCountry] = useState<CountryId>('RU');
  const [selectedBetTier, setSelectedBetTier] = useState<BetTierId>('common');
  const [showCountryModal, setShowCountryModal] = useState<boolean>(false);
  const [showBetModal, setShowBetModal] = useState<boolean>(false);

  // Auto-spin state & smart filter
  const [isAutoSpinning, setIsAutoSpinning] = useState<boolean>(false);
  const [filterSettings, setFilterSettings] = useState<AutoSpinFilterSettings>(DEFAULT_FILTER_SETTINGS);
  const [showFilterModal, setShowFilterModal] = useState<boolean>(false);
  const [showOddsModal, setShowOddsModal] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Animated reel display for the primary card
  const [displayDigits, setDisplayDigits] = useState<string[]>(['7', '7', '7', '1', '2', '3', '4']);
  const [displayOperator, setDisplayOperator] = useState<string>('999');

  const currentCountry = COUNTRIES.find(c => c.id === selectedCountry) || COUNTRIES[0];
  const currentBetConfig = BET_TIERS.find(b => b.id === selectedBetTier) || BET_TIERS[0];

  useEffect(() => {
    const ops = OPERATORS_BY_COUNTRY[selectedCountry];
    if (ops && ops.length > 0) {
      setDisplayOperator(ops[0].code);
    }
  }, [selectedCountry]);

  // Single card spin cost with discount, country economic multiplier & bet tier multiplier
  const baseCost = 100;
  const discountRate = (discountLevel || 0) * 0.0125; // 1.25% discount per level (up to 50%)
  const discountedBaseSpinCost = Math.max(50, Math.round(baseCost * (1 - discountRate)));
  const singleSpinCost = Math.round(
    discountedBaseSpinCost * currentCountry.costMultiplier * currentBetConfig.multiplier
  );
  const totalCost = singleSpinCost * simCount;

  const canAfford = balance >= totalCost;
  const isInventoryFull = inventoryCount >= maxInventory;

  // Refs to prevent any stale closure issues during asynchronous auto-spinning
  const isAutoSpinningRef = useRef<boolean>(false);
  const autoSpinTimeoutRef = useRef<number | null>(null);
  const intervalRef = useRef<number | null>(null);

  const balanceRef = useRef(balance);
  balanceRef.current = balance;

  const inventoryCountRef = useRef(inventoryCount);
  inventoryCountRef.current = inventoryCount;

  const maxInventoryRef = useRef(maxInventory);
  maxInventoryRef.current = maxInventory;

  const filterSettingsRef = useRef(filterSettings);
  filterSettingsRef.current = filterSettings;

  const simCountRef = useRef(simCount);
  simCountRef.current = simCount;

  const singleSpinCostRef = useRef(singleSpinCost);
  singleSpinCostRef.current = singleSpinCost;

  const totalCostRef = useRef(totalCost);
  totalCostRef.current = totalCost;

  const isSpinningRef = useRef(isSpinning);
  isSpinningRef.current = isSpinning;

  const droppedCardsRef = useRef(droppedCards);
  droppedCardsRef.current = droppedCards;

  const selectedCountryRef = useRef(selectedCountry);
  selectedCountryRef.current = selectedCountry;

  const selectedBetTierRef = useRef(selectedBetTier);
  selectedBetTierRef.current = selectedBetTier;

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (autoSpinTimeoutRef.current) clearTimeout(autoSpinTimeoutRef.current);
    };
  }, []);

  const stopAutoSpin = (reason?: string) => {
    isAutoSpinningRef.current = false;
    setIsAutoSpinning(false);
    if (autoSpinTimeoutRef.current) {
      clearTimeout(autoSpinTimeoutRef.current);
      autoSpinTimeoutRef.current = null;
    }
    if (reason) {
      setStatusMessage(reason);
      setTimeout(() => setStatusMessage(null), 3000);
    }
  };

  const startAutoSpin = () => {
    if (balanceRef.current < totalCostRef.current) {
      triggerHaptic('error');
      setStatusMessage('Недостаточно средств для авто-крутки!');
      setTimeout(() => setStatusMessage(null), 2500);
      return;
    }

    isAutoSpinningRef.current = true;
    setIsAutoSpinning(true);
    setStatusMessage('Авто-крутка запущена...');
    setTimeout(() => setStatusMessage(null), 1500);

    if (!isSpinningRef.current) {
      runSpinCycle(true);
    }
  };

  // Main Spin Cycle (Used for both manual and automated spins)
  const runSpinCycle = (isAutoTrigger = false) => {
    if (isSpinningRef.current) return;

    const currentTotalCost = totalCostRef.current;
    const currentSimCount = simCountRef.current;
    const currentCostPerCard = singleSpinCostRef.current;

    // Requirement: "если человек нажимает крутить после того как ему выпал номер то этот номер автоматически переходит в коллекцию"
    if (!isAutoTrigger && droppedCardsRef.current.length > 0) {
      const availableSpace = maxInventoryRef.current - inventoryCountRef.current;
      if (availableSpace > 0) {
        const toSave = droppedCardsRef.current.slice(0, availableSpace);
        onAddMultipleToCollection(toSave);
        setStatusMessage(`Предыдущие SIM (${toSave.length}) перемещены в коллекцию!`);
      } else {
        setStatusMessage('Инвентарь полон, предыдущие номера не поместились!');
      }
      setDroppedCards([]);
    }

    if (balanceRef.current < currentTotalCost) {
      triggerHaptic('error');
      if (isAutoSpinningRef.current) {
        stopAutoSpin('Недостаточно средств на балансе.');
      } else {
        setStatusMessage('Недостаточно средств на балансе!');
        setTimeout(() => setStatusMessage(null), 2500);
      }
      return;
    }

    setIsSpinning(true);
    isSpinningRef.current = true;
    triggerHaptic('medium');
    sound.playClick();

    // Roll new batch of phone numbers
    const activeBet = BET_TIERS.find(b => b.id === selectedBetTierRef.current) || BET_TIERS[0];
    const newCards = rollMultiplePhoneNumbers(
      currentSimCount,
      currentCostPerCard,
      luckLevel,
      cashbackLevel,
      prestigeLevel,
      jackpotRadarLevel,
      selectedCountryRef.current,
      activeBet.minRarity
    );

    const isAuto = isAutoSpinningRef.current || isAutoTrigger;
    let counter = 0;
    const totalFrames = isAuto ? 10 : 14;
    const frameDelay = isAuto ? 40 : 55;
    const targetDigits = newCards[0].rawTail.split('');
    const countryOps = (OPERATORS_BY_COUNTRY[selectedCountryRef.current] || OPERATORS).map(o => o.code);

    if (intervalRef.current) clearInterval(intervalRef.current);

    intervalRef.current = window.setInterval(() => {
      counter++;
      sound.playReelTick(counter);
      if (!isAuto) triggerHaptic('selection');

      // Randomize operator during spin
      if (countryOps.length > 0) {
        setDisplayOperator(countryOps[Math.floor(Math.random() * countryOps.length)]);
      }

      setDisplayDigits(prev =>
        prev.map((_, idx) => {
          if (counter > totalFrames - 7 + idx) return targetDigits[idx];
          return Math.floor(Math.random() * 10).toString();
        })
      );
      if (countryOps.length > 0) {
        setDisplayOperator(countryOps[Math.floor(Math.random() * countryOps.length)]);
      }

      if (counter >= totalFrames) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        intervalRef.current = null;
        setDisplayDigits(targetDigits);
        setDisplayOperator(newCards[0].operatorCode);
        handleSpinDone(newCards, currentTotalCost);
      }
    }, frameDelay);
  };

  const handleSpinDone = (cards: PhoneNumberCard[], cost: number) => {
    setIsSpinning(false);
    isSpinningRef.current = false;
    onSpinSuccess(cards, cost);

    const hasMythic = cards.some(c => c.rarity === 'mythic');
    const hasLegendary = cards.some(c => c.rarity === 'legendary');
    const hasEpic = cards.some(c => c.rarity === 'epic');
    const hasRare = cards.some(c => c.rarity === 'rare');

    if (hasMythic) {
      sound.playWinLegendary();
      triggerHaptic('success');
    } else if (hasLegendary) {
      sound.playWinLegendary();
      triggerHaptic('success');
    } else if (hasEpic) {
      sound.playWinEpic();
      triggerHaptic('success');
    } else if (hasRare) {
      sound.playWinRare();
      triggerHaptic('medium');
    } else {
      sound.playCoin();
      triggerHaptic('light');
    }

    // Process Auto-Spin Filter Rules if active
    if (isAutoSpinningRef.current) {
      const settings = filterSettingsRef.current;
      let shouldStop = false;
      let stopReason = '';
      const cardsToSell: PhoneNumberCard[] = [];
      const cardsToKeep: PhoneNumberCard[] = [];

      for (const card of cards) {
        const action = settings[card.rarity];
        if (action === 'stop') {
          shouldStop = true;
          const cfg = RARITY_CONFIGS[card.rarity];
          stopReason = `Выпал номер [${cfg.nameRu.split(' · ')[0]}]! Авто-крутка остановлена по фильтру.`;
          cardsToKeep.push(card);
        } else if (action === 'sell') {
          cardsToSell.push(card);
        } else if (action === 'keep') {
          cardsToKeep.push(card);
        }
      }

      // Check full inventory
      const availableSpace = maxInventoryRef.current - inventoryCountRef.current;
      if (settings.stopOnInventoryFull && cardsToKeep.length > availableSpace) {
        shouldStop = true;
        stopReason = 'Инвентарь заполнен! Авто-крутка остановлена.';
      }

      if (cardsToSell.length > 0) {
        onSellMultipleCards(cardsToSell);
      }
      if (cardsToKeep.length > 0) {
        onAddMultipleToCollection(cardsToKeep);
      }

      setDroppedCards([]);

      if (shouldStop) {
        triggerHaptic('warning');
        stopAutoSpin(stopReason);
      } else {
        autoSpinTimeoutRef.current = window.setTimeout(() => {
          if (isAutoSpinningRef.current) {
            runSpinCycle(true);
          }
        }, 500);
      }
    } else {
      setDroppedCards(cards);
    }
  };

  const handleStartSpin = () => {
    runSpinCycle(false);
  };

  const totalDroppedValuation = droppedCards.reduce((acc, c) => acc + c.sellPrice, 0);

  return (
    <div className="space-y-4 pb-8 max-w-md sm:max-w-xl mx-auto">
      {/* Central Interactive SIM Reel Display */}
      <div className="bg-[#14171e] border border-slate-800 rounded-3xl p-4 sm:p-6 shadow-2xl relative overflow-hidden">
        {/* Glow backdrop */}
        <div className="absolute -top-24 -left-24 w-60 h-60 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-60 h-60 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10">
          {/* Header Bar */}
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-1.5">
              <span className="text-xs uppercase tracking-wider text-slate-300 font-bold">
                SIM Gacha
              </span>
              <button
                onClick={() => setShowOddsModal(true)}
                className="text-slate-400 hover:text-emerald-400 transition-colors p-1"
                title="Шансы выпадения"
              >
                <HelpCircle className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Auto-Spin Filter Control */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowFilterModal(true)}
                className="px-2 py-1 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-emerald-400 text-[11px] font-semibold flex items-center gap-1 transition-colors"
                title="Фильтр авто-крутки (что продавать, что сохранять)"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Фильтр</span>
              </button>

              <button
                onClick={() => {
                  triggerHaptic('medium');
                  sound.playClick();
                  if (isAutoSpinning) {
                    stopAutoSpin('Авто-крутка остановлена пользователем');
                  } else {
                    startAutoSpin();
                  }
                }}
                className={`px-3 py-1 rounded-xl text-[11px] font-bold flex items-center gap-1.5 transition-all ${
                  isAutoSpinning
                    ? 'bg-rose-500 text-white animate-pulse'
                    : 'bg-amber-500/20 border border-amber-500/40 text-amber-300'
                }`}
              >
                {isAutoSpinning ? (
                  <>
                    <StopCircle className="w-3.5 h-3.5" />
                    <span>Стоп</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Авто-крутка</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Country & Bet Tier Quick Selectors */}
          <div className="grid grid-cols-2 gap-2 my-2.5">
            {/* Country Selector Button */}
            <button
              onClick={() => {
                triggerHaptic('light');
                sound.playClick();
                setShowCountryModal(true);
              }}
              className="bg-[#0e1117] hover:bg-[#161a24] border border-slate-800 hover:border-slate-700/80 rounded-2xl p-2 sm:p-2.5 flex items-center justify-between text-left transition-all active:scale-[0.98] shadow-sm group"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xl sm:text-2xl shrink-0 leading-none">{currentCountry.flag}</span>
                <div className="min-w-0">
                  <div className="text-xs font-black text-slate-100 truncate flex items-center gap-1">
                    <span>{currentCountry.name}</span>
                    <span className="text-[10px] text-slate-400 font-mono font-normal">({currentCountry.dialCode})</span>
                  </div>
                  <div className="text-[10px] font-bold text-amber-400 truncate flex items-center gap-1">
                    <span>{currentCountry.tierLabel}</span>
                  </div>
                </div>
              </div>
              <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-slate-200 shrink-0 ml-1" />
            </button>

            {/* Bet Tier Selector Button */}
            <button
              onClick={() => {
                triggerHaptic('light');
                sound.playClick();
                setShowBetModal(true);
              }}
              className="bg-[#0e1117] hover:bg-[#161a24] border border-slate-800 hover:border-slate-700/80 rounded-2xl p-2 sm:p-2.5 flex items-center justify-between text-left transition-all active:scale-[0.98] shadow-sm group"
            >
              <div className="min-w-0">
                <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                  <span>Ставка</span>
                  {currentBetConfig.multiplier > 1 && (
                    <span className="bg-amber-500/20 text-amber-300 px-1 rounded text-[9px] font-black">
                      ×{currentBetConfig.multiplier}
                    </span>
                  )}
                </div>
                <div className="text-xs font-black truncate text-slate-100" style={{ color: currentBetConfig.color }}>
                  {currentBetConfig.title}
                </div>
              </div>
              <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-slate-200 shrink-0 ml-1" />
            </button>
          </div>

          {/* SIM Mechanical Reel Drums */}
          <div className="bg-[#0b0d11] border border-slate-800 rounded-2xl p-2.5 sm:p-4 my-2.5 shadow-inner">
            <div className="flex items-center justify-center gap-1 sm:gap-2 select-none">
              {/* Prefix with Flag & Code */}
              <div className="bg-[#12161f] border border-slate-700/80 rounded-xl px-1.5 sm:px-3 py-1.5 sm:py-3 text-xs sm:text-base font-bold font-mono text-emerald-400 shrink-0 flex items-center gap-1">
                <span>{currentCountry.flag}</span>
                <span>{currentCountry.dialCode} ({displayOperator})</span>
              </div>

              {/* 7 Digits */}
              <div className="flex items-center gap-0.5 sm:gap-1">
                {displayDigits.slice(0, 3).map((d, i) => (
                  <div
                    key={`d1-${i}`}
                    className={`w-7 sm:w-10 h-10 sm:h-14 rounded-lg sm:rounded-xl border flex items-center justify-center font-mono-numbers font-black text-base sm:text-2xl transition-all duration-100 ${
                      isSpinning
                        ? 'border-emerald-500/60 bg-emerald-950/20 text-emerald-300 scale-95'
                        : 'border-slate-700 bg-[#161a24] text-slate-100 shadow-sm'
                    }`}
                  >
                    {d}
                  </div>
                ))}
              </div>

              <span className="text-slate-600 font-bold text-sm sm:text-lg">-</span>

              <div className="flex items-center gap-0.5 sm:gap-1">
                {displayDigits.slice(3, 5).map((d, i) => (
                  <div
                    key={`d2-${i}`}
                    className={`w-7 sm:w-10 h-10 sm:h-14 rounded-lg sm:rounded-xl border flex items-center justify-center font-mono-numbers font-black text-base sm:text-2xl transition-all duration-100 ${
                      isSpinning
                        ? 'border-emerald-500/60 bg-emerald-950/20 text-emerald-300 scale-95'
                        : 'border-slate-700 bg-[#161a24] text-slate-100 shadow-sm'
                    }`}
                  >
                    {d}
                  </div>
                ))}
              </div>

              <span className="text-slate-600 font-bold text-sm sm:text-lg">-</span>

              <div className="flex items-center gap-0.5 sm:gap-1">
                {displayDigits.slice(5, 7).map((d, i) => (
                  <div
                    key={`d3-${i}`}
                    className={`w-7 sm:w-10 h-10 sm:h-14 rounded-lg sm:rounded-xl border flex items-center justify-center font-mono-numbers font-black text-base sm:text-2xl transition-all duration-100 ${
                      isSpinning
                        ? 'border-emerald-500/60 bg-emerald-950/20 text-emerald-300 scale-95'
                        : 'border-slate-700 bg-[#161a24] text-slate-100 shadow-sm'
                    }`}
                  >
                    {d}
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-2 text-center text-xs text-slate-400 font-medium">
              {isSpinning ? (
                <span className="text-emerald-400 animate-pulse font-mono">
                  Генерация {simCount} SIM-карт...
                </span>
              ) : droppedCards.length > 0 ? (
                <span>
                  Выпало {droppedCards.length} SIM на сумму{' '}
                  <strong className="text-emerald-400 font-mono-numbers">
                    +{totalDroppedValuation.toLocaleString('ru-RU')} ₽
                  </strong>
                </span>
              ) : (
                <span>Выберите количество SIM и нажмите «Крутить»</span>
              )}
            </div>
          </div>

          {/* Dropped Cards Results */}
          {droppedCards.length > 0 && !isSpinning && (
            <div className="mt-3 space-y-2.5 animate-in fade-in duration-200">
              <div className="flex items-center justify-between text-xs text-slate-300 font-bold px-1">
                <span>
                  {droppedCards.length === 1 ? 'Выпавший номер:' : `Выпало номеров (${droppedCards.length}):`}
                </span>
                <span className="text-[11px] font-mono-numbers text-emerald-400">
                  Всего: +{totalDroppedValuation.toLocaleString('ru-RU')} ₽
                </span>
              </div>

              {/* Single or Multi-drop list */}
              {droppedCards.length === 1 ? (
                <div className="space-y-2">
                  <SimCardView card={droppedCards[0]} />
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      onClick={() => {
                        triggerHaptic('medium');
                        sound.playCoin();
                        onSellCard(droppedCards[0]);
                        setDroppedCards([]);
                      }}
                      className="h-11 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all"
                    >
                      <DollarSign className="w-4 h-4" />
                      <span>Продать (+{droppedCards[0].sellPrice.toLocaleString('ru-RU')} ₽)</span>
                    </button>

                    <button
                      onClick={() => {
                        if (inventoryCount >= maxInventory) {
                          triggerHaptic('warning');
                          setStatusMessage('Недостаточно места в коллекции!');
                          setTimeout(() => setStatusMessage(null), 2500);
                          return;
                        }
                        triggerHaptic('success');
                        sound.playClick();
                        onAddToCollection(droppedCards[0]);
                        setDroppedCards([]);
                        setStatusMessage('Номер сохранён в коллекцию!');
                        setTimeout(() => setStatusMessage(null), 2000);
                      }}
                      className="h-11 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all"
                    >
                      <BookmarkPlus className="w-4 h-4" />
                      <span>Оставить ({inventoryCount}/{maxInventory})</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* Compact Mini-Cards Grid for 10 or multi-spins with individual sell/keep buttons */
                <div className="space-y-2">
                  <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                    {droppedCards.map(c => {
                      const cfg = RARITY_CONFIGS[c.rarity];
                      const income = BASE_NUMBER_INCOME[c.rarity] || 3;

                      return (
                        <div
                          key={c.id}
                          className="bg-[#12151d] border border-slate-800 hover:border-slate-700/80 rounded-xl p-2 sm:p-2.5 flex items-center justify-between gap-2 transition-all shadow-sm"
                        >
                          {/* Mini Card Metadata */}
                          <div className="min-w-0 flex items-center gap-2">
                            {/* Rarity Pill Indicator */}
                            <div
                              className="w-2 h-7 rounded-full shrink-0"
                              style={{ backgroundColor: cfg.color }}
                              title={cfg.nameRu}
                            />

                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono-numbers font-black text-xs sm:text-sm text-slate-100 truncate">
                                  {c.fullNumber}
                                </span>
                                <span
                                  className="text-[9px] font-bold px-1 py-0.2 rounded shrink-0 uppercase"
                                  style={{
                                    backgroundColor: `${cfg.color}25`,
                                    color: cfg.color,
                                    border: `1px solid ${cfg.color}40`,
                                  }}
                                >
                                  {cfg.badgeRu}
                                </span>
                              </div>

                              <div className="flex items-center gap-2 text-[10px] mt-0.5 font-mono">
                                <span className="text-emerald-400 font-bold">
                                  +{c.sellPrice.toLocaleString('ru-RU')} ₽
                                </span>
                                <span className="text-slate-400 flex items-center gap-0.5">
                                  <Zap className="w-2.5 h-2.5 text-amber-400" />
                                  +{income} ₽/с
                                </span>
                                {c.tags && c.tags.length > 0 && (
                                  <span className="text-amber-300 font-medium truncate hidden xs:inline">
                                    • {c.tags[0]}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Individual Choice: Sell vs Keep */}
                          <div className="flex items-center gap-1 shrink-0">
                            {/* Sell button */}
                            <button
                              onClick={() => {
                                triggerHaptic('medium');
                                sound.playCoin();
                                onSellCard(c);
                                setDroppedCards(prev => prev.filter(x => x.id !== c.id));
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 font-bold text-[10px] sm:text-xs flex items-center gap-1 active:scale-95 transition-all"
                              title="Продать этот номер"
                            >
                              <DollarSign className="w-3 h-3" />
                              <span>Продать</span>
                            </button>

                            {/* Keep button */}
                            <button
                              onClick={() => {
                                if (inventoryCount >= maxInventory) {
                                  triggerHaptic('warning');
                                  setStatusMessage('Недостаточно места в коллекции!');
                                  setTimeout(() => setStatusMessage(null), 2500);
                                  return;
                                }
                                triggerHaptic('success');
                                sound.playClick();
                                onAddToCollection(c);
                                setDroppedCards(prev => prev.filter(x => x.id !== c.id));
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 font-bold text-[10px] sm:text-xs flex items-center gap-1 active:scale-95 transition-all"
                              title="Оставить этот номер в коллекции"
                            >
                              <BookmarkPlus className="w-3 h-3" />
                              <span>Оставить</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Bulk Quick Actions for all remaining cards */}
                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800/80">
                    <button
                      onClick={() => {
                        triggerHaptic('medium');
                        sound.playCoin();
                        onSellMultipleCards(droppedCards);
                        setDroppedCards([]);
                      }}
                      className="h-10 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all"
                    >
                      <DollarSign className="w-3.5 h-3.5" />
                      <span>Продать все ({totalDroppedValuation.toLocaleString('ru-RU')} ₽)</span>
                    </button>

                    <button
                      onClick={() => {
                        if (inventoryCount + droppedCards.length > maxInventory) {
                          triggerHaptic('warning');
                          setStatusMessage('Недостаточно места в коллекции!');
                          setTimeout(() => setStatusMessage(null), 2500);
                          return;
                        }
                        triggerHaptic('success');
                        sound.playClick();
                        onAddMultipleToCollection(droppedCards);
                        setDroppedCards([]);
                        setStatusMessage('Все номера сохранены в коллекцию!');
                        setTimeout(() => setStatusMessage(null), 2000);
                      }}
                      className="h-10 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all"
                    >
                      <BookmarkPlus className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Оставить все ({droppedCards.length} SIM)</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Toast Message */}
          {statusMessage && (
            <div className="mt-2 text-center text-xs font-medium text-emerald-300 bg-emerald-950/40 border border-emerald-500/30 py-2 px-3 rounded-lg animate-in fade-in">
              {statusMessage}
            </div>
          )}

          {/* Controls: Multi-spin selector & Main Spin CTA */}
          <div className="mt-4 space-y-3 pt-3 border-t border-slate-800/80">
            {/* Multi-spin Selector (1, 3, 5, 10 SIM одновременно) */}
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-slate-400 font-medium">Номеров за раз:</span>
              <div className="flex items-center gap-1.5 p-1 bg-[#0b0d11] rounded-xl border border-slate-800">
                {([1, 3, 5, 10] as const).map(count => (
                  <button
                    key={count}
                    onClick={() => {
                      triggerHaptic('selection');
                      sound.playClick();
                      setSimCount(count);
                    }}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                      simCount === count
                        ? 'bg-emerald-500 text-slate-950 shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {count} SIM
                  </button>
                ))}
              </div>
            </div>

            {/* Big Spin Button */}
            <button
              onClick={handleStartSpin}
              disabled={isSpinning || isAutoSpinning}
              className={`w-full h-14 rounded-2xl font-black text-sm sm:text-base flex items-center justify-center gap-2 shadow-lg transition-all active:scale-[0.98] ${
                isSpinning
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                  : canAfford
                  ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20 glow-neon'
                  : 'bg-red-950/40 border border-red-500/40 text-red-300'
              }`}
            >
              <RefreshCw className={`w-5 h-5 ${isSpinning ? 'animate-spin' : ''}`} />
              <span>
                {isSpinning
                  ? 'Крутится барабан...'
                  : canAfford
                  ? `Крутить ${simCount} SIM (${totalCost.toLocaleString('ru-RU')} ₽)`
                  : `Недостаточно средств (${totalCost.toLocaleString('ru-RU')} ₽)`}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Auto-Spin Smart Filter Settings Modal */}
      {showFilterModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#141722] border border-slate-800 rounded-3xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="font-bold text-sm text-slate-100 flex items-center gap-1.5">
                <SlidersHorizontal className="w-4 h-4 text-emerald-400" />
                Фильтр авто-крутки
              </span>
              <button
                onClick={() => setShowFilterModal(false)}
                className="text-slate-400 hover:text-slate-100 text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Настройте автоматические действия для каждой редкости при авто-прокрутке:
            </p>

            <div className="space-y-2 text-xs">
              {(['mythic', 'legendary', 'epic', 'rare', 'uncommon', 'common'] as RarityTier[]).map(tier => {
                const cfg = RARITY_CONFIGS[tier];
                const currentAction = filterSettings[tier];

                return (
                  <div
                    key={tier}
                    className="p-2 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cfg.color }} />
                      <span className="font-bold text-slate-200">{cfg.nameRu.split(' · ')[0]}</span>
                    </div>

                    <div className="flex items-center gap-1 bg-[#0b0e14] p-0.5 rounded-lg border border-slate-800">
                      {(['sell', 'keep', 'stop'] as AutoAction[]).map(act => (
                        <button
                          key={act}
                          onClick={() => {
                            setFilterSettings(prev => ({ ...prev, [tier]: act }));
                            triggerHaptic('selection');
                          }}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            currentAction === act
                              ? act === 'sell'
                                ? 'bg-amber-500 text-slate-950'
                                : act === 'keep'
                                ? 'bg-emerald-500 text-slate-950'
                                : 'bg-rose-500 text-white'
                              : 'text-slate-400'
                          }`}
                        >
                          {act === 'sell' ? 'Продать' : act === 'keep' ? 'В архив' : 'Стоп'}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Presets */}
            <div className="pt-2 border-t border-slate-800 flex gap-2">
              <button
                onClick={() => {
                  setFilterSettings(DEFAULT_FILTER_SETTINGS);
                  triggerHaptic('success');
                }}
                className="flex-1 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-[11px] font-bold"
              >
                По умолчанию
              </button>
              <button
                onClick={() => {
                  setFilterSettings({
                    common: 'sell',
                    uncommon: 'sell',
                    rare: 'sell',
                    epic: 'keep',
                    legendary: 'stop',
                    mythic: 'stop',
                    stopOnInventoryFull: true,
                    maxSpins: 0,
                  });
                  triggerHaptic('success');
                }}
                className="flex-1 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-[11px] font-bold"
              >
                Только Epic+
              </button>
            </div>

            <button
              onClick={() => setShowFilterModal(false)}
              className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-md"
            >
              Сохранить настройки
            </button>
          </div>
        </div>
      )}

      {/* Probability Odds Modal */}
      {showOddsModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#141722] border border-slate-800 rounded-3xl max-w-sm w-full p-5 space-y-3 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="font-bold text-sm text-slate-100 flex items-center gap-1.5">
                <Flame className="w-4 h-4 text-amber-400" />
                Шансы редкостей (Hardcore Gacha)
              </span>
              <button
                onClick={() => setShowOddsModal(false)}
                className="text-slate-400 hover:text-slate-100 text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 text-xs">
              {Object.values(RARITY_CONFIGS).map(cfg => {
                let currentChance = cfg.baseChance;
                if (cfg.id === 'mythic') currentChance += (luckLevel || 0) * 0.0003 + (prestigeLevel || 0) * 0.0005;
                if (cfg.id === 'legendary') currentChance += (luckLevel || 0) * 0.004 + (prestigeLevel || 0) * 0.006;
                if (cfg.id === 'epic') currentChance += (luckLevel || 0) * 0.04 + (prestigeLevel || 0) * 0.05;
                if (cfg.id === 'rare') currentChance += (luckLevel || 0) * 0.12 + (prestigeLevel || 0) * 0.10;
                if (cfg.id === 'uncommon') currentChance += (luckLevel || 0) * 0.20;
                if (cfg.id === 'common') currentChance = Math.max(20, 100 - (0.001 + 0.02 + 0.65 + 2.80 + 11.0 + (luckLevel || 0) * 0.364));

                return (
                  <div
                    key={cfg.id}
                    className="p-2 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cfg.color }} />
                      <span className="font-bold text-slate-200">{cfg.nameRu}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 font-mono text-[11px]">x{cfg.minMultiplier}–{cfg.maxMultiplier}</span>
                      <span className="font-bold text-emerald-400 font-mono-numbers">
                        {cfg.id === 'mythic' ? currentChance.toFixed(3) : currentChance.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <p className="text-[11px] text-slate-400 leading-snug">
              Шансы на VIP и Epic сбалансированы для ценности номеров! Прокачивайте Четырёхлистник удачи и Престиж оператора.
            </p>

            <button
              onClick={() => setShowOddsModal(false)}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs"
            >
              Понятно
            </button>
          </div>
        </div>
      )}

      {/* Country Selection Bottom Sheet Modal */}
      {showCountryModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-[#12151d] border-t sm:border border-slate-800 rounded-t-3xl sm:rounded-3xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom duration-200">
            {/* Drag handle */}
            <div className="pt-3 pb-1 flex justify-center shrink-0">
              <div className="w-10 h-1 bg-slate-700 rounded-full" />
            </div>

            {/* Modal Header */}
            <div className="px-5 pt-1 pb-3 text-center border-b border-slate-800/80 shrink-0 relative">
              <h3 className="font-black text-base text-slate-100 flex items-center justify-center gap-2">
                <Globe className="w-4 h-4 text-emerald-400" />
                <span>Выберите страну номеров</span>
              </h3>
              <p className="text-[11px] text-slate-400 mt-1 max-w-sm mx-auto leading-tight">
                Иностранные номера стоят дороже в крутке, но приносят в десятки раз больше дохода и дороже продаются!
              </p>
              <button
                onClick={() => setShowCountryModal(false)}
                className="absolute top-2 right-4 text-slate-400 hover:text-slate-100 text-sm font-bold p-1"
              >
                ✕
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {COUNTRIES.map(c => {
                  const isSelected = selectedCountry === c.id;
                  const spinCostForCountry = Math.round(discountedBaseSpinCost * c.costMultiplier);

                  return (
                    <button
                      key={c.id}
                      onClick={() => {
                        triggerHaptic('selection');
                        sound.playClick();
                        setSelectedCountry(c.id);
                      }}
                      className={`p-2.5 sm:p-3 rounded-2xl border flex items-center justify-between gap-2.5 transition-all active:scale-[0.98] text-left ${
                        isSelected
                          ? 'bg-slate-800/90 text-white font-black border-emerald-500 shadow-md ring-1 ring-emerald-500/30'
                          : 'bg-[#181c26] text-slate-300 border-slate-800/80 hover:bg-[#202533]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-2xl leading-none shrink-0">{c.flag}</span>
                        <div className="min-w-0">
                          <div className="font-bold text-xs truncate flex items-center gap-1.5">
                            <span>{c.name}</span>
                            <span className="text-[10px] text-slate-400 font-mono font-normal">
                              ({c.dialCode})
                            </span>
                          </div>
                          <div className="text-[10px] font-semibold truncate mt-0.5 text-emerald-400">
                            {c.incomeMultiplier > 1
                              ? `Доход: ×${c.incomeMultiplier} · Крутка: ×${c.costMultiplier}`
                              : 'Базовый тариф (1.0x)'}
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        {isSelected ? (
                          <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center shrink-0 shadow-sm ml-auto">
                            <Check className="w-3.5 h-3.5 text-slate-950 stroke-[3]" />
                          </div>
                        ) : (
                          <div className="text-[11px] font-mono font-bold text-slate-400">
                            {spinCostForCountry.toLocaleString('ru-RU')} ₽
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Confirm / Close Button */}
              <button
                onClick={() => {
                  triggerHaptic('medium');
                  sound.playClick();
                  setShowCountryModal(false);
                }}
                className="w-full h-12 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs shadow-lg shadow-emerald-500/20 active:scale-95 transition-all mt-2"
              >
                Выбрать {currentCountry.name} ({currentCountry.dialCode})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bet Tier Selection Bottom Sheet Modal (Screenshots 1) */}
      {showBetModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-[#12151d] border-t sm:border border-slate-800 rounded-t-3xl sm:rounded-3xl max-w-md w-full max-h-[90vh] flex flex-col p-5 space-y-3.5 shadow-2xl animate-in slide-in-from-bottom duration-200">
            {/* Drag handle */}
            <div className="pb-1 flex justify-center shrink-0 -mt-2">
              <div className="w-10 h-1 bg-slate-700 rounded-full" />
            </div>

            {/* Header */}
            <div className="text-center space-y-1 relative shrink-0">
              <h3 className="font-black text-base text-slate-100">
                Ставка
              </h3>
              <p className="text-[11px] text-slate-400 px-2 leading-relaxed">
                Дороже крутка — выше гарантированная редкость. Цена примерно равна средней стоимости такого номера, так что это не бесплатные деньги, а быстрый путь к редким номерам.
              </p>
              <button
                onClick={() => setShowBetModal(false)}
                className="absolute top-0 right-0 text-slate-400 hover:text-slate-100 text-sm font-bold p-1"
              >
                ✕
              </button>
            </div>

            {/* Bet Tiers List (Exactly matching Screenshot 1) */}
            <div className="space-y-2 overflow-y-auto pr-0.5">
              {BET_TIERS.map(tier => {
                const isSelected = selectedBetTier === tier.id;
                const tierPrice = Math.round(discountedBaseSpinCost * tier.multiplier);

                return (
                  <div
                    key={tier.id}
                    onClick={() => {
                      triggerHaptic('selection');
                      sound.playClick();
                      setSelectedBetTier(tier.id);
                      setShowBetModal(false);
                    }}
                    className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 cursor-pointer transition-all active:scale-[0.99] ${
                      isSelected
                        ? 'bg-[#181d29] border-emerald-500/50 shadow-md ring-1 ring-emerald-500/20'
                        : 'bg-[#13161f] border-slate-800/80 hover:bg-[#181c26]'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="font-black text-sm text-slate-100 flex items-center gap-1.5" style={{ color: tier.color }}>
                        <span>{tier.title}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {tier.sub}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-black text-sm font-mono-numbers text-slate-100">
                        {tierPrice.toLocaleString('ru-RU')} ₽
                      </span>

                      {isSelected ? (
                        <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center shrink-0 shadow-sm">
                          <Check className="w-4 h-4 text-slate-950 stroke-[3]" />
                        </div>
                      ) : (
                        <div className="w-6 h-6 rounded-full border border-slate-700 shrink-0" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer notes */}
            <div className="text-[11px] text-slate-400 text-center space-y-1 pt-1 border-t border-slate-800/80">
              <div className="text-slate-300 font-medium">
                {currentCountry.name} ({currentCountry.dialCode}) · кошелёк{' '}
                <span className="font-mono-numbers font-bold text-emerald-400">
                  {balance.toLocaleString('ru-RU')} ₽
                </span>
              </div>
              <div className="text-slate-400 leading-tight">
                Бесплатные попытки тратятся только на обычную крутку.
              </div>
              {simCount > 1 && (
                <div className="text-amber-300/90 leading-tight flex items-center justify-center gap-1 font-medium">
                  <span>🎰 Включён ×{simCount}: цена выше — за {simCount} {simCount === 1 ? 'бросок' : 'бросков'} сразу, все с гарантией выбранной редкости.</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
