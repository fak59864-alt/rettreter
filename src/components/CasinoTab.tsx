import React, { useState, useEffect, useRef, useMemo } from 'react';
import { sound } from '../utils/audio';
import { triggerHaptic } from '../utils/telegram';
import {
  Bomb,
  Spade,
  Sparkles,
  RotateCcw,
  Plus,
  Shield,
  Layers,
  ChevronsUp,
  ArrowRight,
  Check,
  Zap,
  Volume2,
  VolumeX,
  SlidersHorizontal,
} from 'lucide-react';
import { PhoneNumberCard, RarityTier } from '../types/game';
import { RARITY_CONFIGS, getCountryConfig } from '../utils/rarityConfig';
import { rollPhoneNumber } from '../utils/numberGenerator';

interface CasinoTabProps {
  balance: number;
  collection?: PhoneNumberCard[];
  onUpdateBalance: (amountDelta: number) => void;
  onReplaceCard?: (oldCardId: string, newCard: PhoneNumberCard) => void;
  onRemoveCard?: (cardId: string) => void;
  onAddCard?: (card: PhoneNumberCard) => void;
  onRecordCasinoWin?: (amount: number) => void;
}

type CasinoGameId = 'upgrader' | 'blackjack' | 'mines';

// Card interface for 21 (Blackjack)
interface PlayingCard {
  suit: '♠' | '♥' | '♦' | '♣';
  value: string;
  isRed: boolean;
  score: number;
}

const SUITS: ('♠' | '♥' | '♦' | '♣')[] = ['♠', '♥', '♦', '♣'];
const CARD_VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

function drawRandomCard(): PlayingCard {
  const suit = SUITS[Math.floor(Math.random() * SUITS.length)];
  const value = CARD_VALUES[Math.floor(Math.random() * CARD_VALUES.length)];
  const isRed = suit === '♥' || suit === '♦';
  let score = 0;
  if (['J', 'Q', 'K'].includes(value)) score = 10;
  else if (value === 'A') score = 11;
  else score = parseInt(value, 10);

  return { suit, value, isRed, score };
}

function calculateHandScore(cards: PlayingCard[]): { score: number; isSoft: boolean; isBust: boolean } {
  let score = 0;
  let aces = 0;

  for (const c of cards) {
    score += c.score;
    if (c.value === 'A') aces++;
  }

  while (score > 21 && aces > 0) {
    score -= 10;
    aces--;
  }

  return {
    score,
    isSoft: aces > 0,
    isBust: score > 21,
  };
}

// Calculate mines win multiplier based on revealed safe tiles & total mines
function getMinesMultiplier(revealed: number, mines: number): number {
  if (revealed === 0) return 1.0;
  let prob = 1.0;
  const safeCount = 25 - mines;
  for (let i = 0; i < revealed; i++) {
    prob *= (safeCount - i) / (25 - i);
  }
  const houseEdge = 0.96;
  const mult = (houseEdge / prob);
  return Math.max(1.05, +mult.toFixed(2));
}

const BET_PRESETS = [50, 100, 250, 500, 1000, 2500];
const UPGRADE_MULTIPLIERS = [1.5, 2.0, 3.0, 5.0, 10.0, 25.0];

export const CasinoTab: React.FC<CasinoTabProps> = ({
  balance,
  collection = [],
  onUpdateBalance,
  onReplaceCard,
  onRemoveCard,
  onAddCard,
  onRecordCasinoWin,
}) => {
  const [activeGame, setActiveGame] = useState<CasinoGameId>('upgrader');
  const [betAmount, setBetAmount] = useState<number>(100);

  // ============================================================================
  // 1. UPGRADER (ПРОКАЧКА НОМЕРА СО СКРИНШОТА)
  // ============================================================================
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [targetMultiplier, setTargetMultiplier] = useState<number>(2.0);
  const [extraChancePercent, setExtraChancePercent] = useState<number>(0);
  const [isUpgrading, setIsUpgrading] = useState<boolean>(false);
  const [needleAngle, setNeedleAngle] = useState<number>(0);
  const [showCardPickerModal, setShowCardPickerModal] = useState<boolean>(false);
  const [upgradeOutcomeMessage, setUpgradeOutcomeMessage] = useState<{
    type: 'win' | 'loss';
    text: string;
    card?: PhoneNumberCard;
  } | null>(null);
  const [isSoundMuted, setIsSoundMuted] = useState<boolean>(false);

  const animFrameRef = useRef<number | null>(null);

  // Auto-select first available card from collection if none selected
  const selectedCard = useMemo(() => {
    if (selectedCardId) {
      const found = collection.find(c => c.id === selectedCardId);
      if (found) return found;
    }
    return collection.length > 0 ? collection[0] : null;
  }, [collection, selectedCardId]);

  // Base card value
  const inputCardValue = selectedCard ? selectedCard.sellPrice : 100;
  const targetCardValue = Math.round(inputCardValue * targetMultiplier);

  // Target card rarity determination based on multiplier & input
  const targetRarity: RarityTier = useMemo(() => {
    if (targetMultiplier >= 20.0) return 'mythic';
    if (targetMultiplier >= 8.0) return 'legendary';
    if (targetMultiplier >= 3.5) return 'epic';
    if (targetMultiplier >= 2.0) return 'rare';
    return 'uncommon';
  }, [targetMultiplier]);

  // Synthetic preview for Target Card
  const targetCardPreview = useMemo(() => {
    const country = selectedCard ? getCountryConfig(selectedCard.countryId) : getCountryConfig('RU');
    return {
      name: `${country.flag} Целевой номер`,
      rarity: targetRarity,
      value: targetCardValue,
      multiplier: targetMultiplier,
    };
  }, [selectedCard, targetRarity, targetCardValue, targetMultiplier]);

  // Base mathematically sound chance: (InputValue / TargetValue) * 100 * houseEdge (0.95)
  const baseChance = useMemo(() => {
    const raw = (inputCardValue / targetCardValue) * 100 * 0.95;
    return Math.min(85, Math.max(1.5, +raw.toFixed(2)));
  }, [inputCardValue, targetCardValue]);

  // Extra chance cost in rubles: extraPercent * (targetCardValue / 100)
  const extraChanceCost = useMemo(() => {
    if (extraChancePercent <= 0) return 0;
    return Math.round((extraChancePercent / 100) * targetCardValue * 1.05);
  }, [extraChancePercent, targetCardValue]);

  // Total win chance (capped at 88% to preserve tension)
  const totalWinChance = useMemo(() => {
    return Math.min(88, +(baseChance + extraChancePercent).toFixed(2));
  }, [baseChance, extraChancePercent]);

  // Handle Upgrade Spin
  const handlePerformUpgrade = () => {
    if (!selectedCard || isUpgrading) return;
    if (extraChanceCost > balance) {
      triggerHaptic('error');
      return;
    }

    // Deduct extra chance cost if any
    if (extraChanceCost > 0) {
      onUpdateBalance(-extraChanceCost);
    }

    setIsUpgrading(true);
    setUpgradeOutcomeMessage(null);
    triggerHaptic('medium');
    sound.playClick();

    // Determine win or loss
    const roll = Math.random() * 100;
    const isWin = roll < totalWinChance;

    // Angle calculations (360 degrees dial)
    // Winning sector spans from 0° (top) clockwise to totalWinChance * 3.6°
    const winSectorAngle = (totalWinChance / 100) * 360;
    let targetStopAngle = 0;

    if (isWin) {
      // Land strictly inside winning sector with safe padding
      const minA = 3;
      const maxA = Math.max(minA + 1, winSectorAngle - 3);
      targetStopAngle = minA + Math.random() * (maxA - minA);
    } else {
      // Land strictly inside loss sector with safe padding
      const minA = Math.min(357, winSectorAngle + 3);
      const maxA = 357;
      targetStopAngle = minA + Math.random() * (maxA - minA);
    }

    // 6 to 8 full rotations + target degree
    const fullSpins = 6 + Math.floor(Math.random() * 3);
    const startAngle = needleAngle % 360;
    const finalAngle = startAngle + fullSpins * 360 + targetStopAngle;
    const totalDistance = finalAngle - startAngle;

    const startTime = performance.now();
    const duration = 3400; // 3.4 seconds smooth suspense spin
    let lastTickAngle = startAngle;

    const animateNeedle = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);

      // Smooth deceleration curve (quintic ease-out)
      const easeOut = 1 - Math.pow(1 - progress, 4.2);
      const currentAngle = startAngle + totalDistance * easeOut;

      setNeedleAngle(currentAngle);

      // Sound clicks on sector intervals
      if (Math.abs(currentAngle - lastTickAngle) >= 28) {
        lastTickAngle = currentAngle;
        if (!isSoundMuted && Math.random() < 0.8) {
          sound.playReelTick(12);
        }
      }

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(animateNeedle);
      } else {
        // Spin finished!
        setIsUpgrading(false);

        if (isWin) {
          triggerHaptic('success');
          sound.playWinEpic();

          // Generate upgraded card
          const upgradedCard = rollPhoneNumber(
            targetCardValue,
            0,
            0,
            0,
            targetRarity,
            0,
            selectedCard.countryId || 'RU'
          );
          // Override sellPrice to at least targetCardValue
          upgradedCard.sellPrice = Math.max(targetCardValue, upgradedCard.sellPrice);

          if (onReplaceCard) {
            onReplaceCard(selectedCard.id, upgradedCard);
          } else if (onAddCard) {
            onAddCard(upgradedCard);
          }
          if (onRecordCasinoWin) {
            onRecordCasinoWin(upgradedCard.sellPrice);
          }

          setSelectedCardId(upgradedCard.id);
          setUpgradeOutcomeMessage({
            type: 'win',
            text: `🎉 УСПЕХ! Номер прокачан до ${upgradedCard.fullNumber}!`,
            card: upgradedCard,
          });
        } else {
          triggerHaptic('error');
          sound.playClick();

          if (onRemoveCard) {
            onRemoveCard(selectedCard.id);
          }
          setSelectedCardId(null);
          setUpgradeOutcomeMessage({
            type: 'loss',
            text: `💥 НЕУДАЧА! Номер не выдержал апгрейда и сгорел.`,
          });
        }
      }
    };

    animFrameRef.current = requestAnimationFrame(animateNeedle);
  };

  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  // ============================================================================
  // 2. BLACKJACK (21 ОЧКО)
  // ============================================================================
  const [bjState, setBjState] = useState<'idle' | 'playing' | 'dealer_turn' | 'finished'>('idle');
  const [playerCards, setPlayerCards] = useState<PlayingCard[]>([]);
  const [dealerCards, setDealerCards] = useState<PlayingCard[]>([]);
  const [currentBjBet, setCurrentBjBet] = useState<number>(100);
  const [bjResult, setBjResult] = useState<{
    status: 'win' | 'lose' | 'push' | 'blackjack' | 'bust';
    message: string;
    payout: number;
  } | null>(null);

  const startBlackjack = () => {
    if (balance < betAmount) {
      triggerHaptic('error');
      return;
    }
    onUpdateBalance(-betAmount);
    triggerHaptic('medium');
    sound.playClick();

    setCurrentBjBet(betAmount);
    setBjResult(null);

    const p1 = drawRandomCard();
    const p2 = drawRandomCard();
    const d1 = drawRandomCard();
    const d2 = drawRandomCard();

    const initialPlayerCards = [p1, p2];
    const initialDealerCards = [d1, d2];

    setPlayerCards(initialPlayerCards);
    setDealerCards(initialDealerCards);

    const pScore = calculateHandScore(initialPlayerCards);
    const dScore = calculateHandScore(initialDealerCards);

    if (pScore.score === 21) {
      if (dScore.score === 21) {
        onUpdateBalance(betAmount);
        setBjState('finished');
        setBjResult({
          status: 'push',
          message: 'Ничья! У обоих натуральный Блэкджек.',
          payout: betAmount,
        });
        triggerHaptic('selection');
      } else {
        const payout = Math.round(betAmount * 2.5);
        onUpdateBalance(payout);
        if (onRecordCasinoWin) onRecordCasinoWin(payout);
        setBjState('finished');
        setBjResult({
          status: 'blackjack',
          message: `🔥 Натуральный Блэкджек! Выплата 3:2 (+${payout.toLocaleString('ru-RU')} ₽)!`,
          payout,
        });
        triggerHaptic('success');
        sound.playWinEpic();
      }
    } else {
      setBjState('playing');
    }
  };

  const hitCard = () => {
    if (bjState !== 'playing') return;
    const newCard = drawRandomCard();
    const nextHand = [...playerCards, newCard];
    setPlayerCards(nextHand);
    triggerHaptic('selection');
    sound.playClick();

    const score = calculateHandScore(nextHand);
    if (score.isBust) {
      setBjState('finished');
      setBjResult({
        status: 'bust',
        message: `💥 Перебор (${score.score} очков)! Ставка сгорела.`,
        payout: 0,
      });
      triggerHaptic('error');
    } else if (score.score === 21) {
      standCards(nextHand);
    }
  };

  const doubleDown = () => {
    if (bjState !== 'playing' || playerCards.length !== 2) return;
    if (balance < currentBjBet) {
      triggerHaptic('error');
      return;
    }
    onUpdateBalance(-currentBjBet);
    const doubled = currentBjBet * 2;
    setCurrentBjBet(doubled);

    const newCard = drawRandomCard();
    const nextHand = [...playerCards, newCard];
    setPlayerCards(nextHand);
    triggerHaptic('medium');

    const nextScore = calculateHandScore(nextHand);
    if (nextScore.isBust) {
      setBjState('finished');
      setBjResult({
        status: 'bust',
        message: `💥 Перебор при удвоении (${nextScore.score} очков)!`,
        payout: 0,
      });
      triggerHaptic('error');
    } else {
      standCards(nextHand, doubled);
    }
  };

  const standCards = (currentPlayerHand = playerCards, activeBet = currentBjBet) => {
    if (bjState !== 'playing' && bjState !== 'idle') return;
    setBjState('dealer_turn');
    triggerHaptic('selection');

    let currentDealerHand = [...dealerCards];
    let dScore = calculateHandScore(currentDealerHand);

    while (dScore.score < 17) {
      currentDealerHand.push(drawRandomCard());
      dScore = calculateHandScore(currentDealerHand);
    }

    setDealerCards(currentDealerHand);
    setBjState('finished');

    const pScore = calculateHandScore(currentPlayerHand).score;
    const finalDScore = dScore.score;

    if (finalDScore > 21) {
      const payout = activeBet * 2;
      onUpdateBalance(payout);
      if (onRecordCasinoWin) onRecordCasinoWin(payout);
      setBjResult({
        status: 'win',
        message: `🎉 Дилер перебрал (${finalDScore})! Победа (+${payout.toLocaleString('ru-RU')} ₽)!`,
        payout,
      });
      triggerHaptic('success');
      sound.playWinEpic();
    } else if (pScore > finalDScore) {
      const payout = activeBet * 2;
      onUpdateBalance(payout);
      if (onRecordCasinoWin) onRecordCasinoWin(payout);
      setBjResult({
        status: 'win',
        message: `✓ Победа ${pScore} против ${finalDScore} у дилера! (+${payout.toLocaleString('ru-RU')} ₽)`,
        payout,
      });
      triggerHaptic('success');
      sound.playWinRare();
    } else if (pScore === finalDScore) {
      onUpdateBalance(activeBet);
      setBjResult({
        status: 'push',
        message: `Ничья (${pScore} : ${finalDScore})! Ставка возвращена.`,
        payout: activeBet,
      });
      triggerHaptic('selection');
    } else {
      setBjResult({
        status: 'lose',
        message: `Дилер победил (${finalDScore} против ${pScore}).`,
        payout: 0,
      });
      triggerHaptic('error');
    }
  };

  const fullDealerScore = calculateHandScore(dealerCards);
  const playerHandScore = calculateHandScore(playerCards);

  // ============================================================================
  // 3. MINES (МИНЁР)
  // ============================================================================
  const [minesCount, setMinesCount] = useState<number>(3);
  const [minesGrid, setMinesGrid] = useState<{ isMine: boolean; isRevealed: boolean }[]>([]);
  const [minesRevealedCount, setMinesRevealedCount] = useState<number>(0);
  const [minesGameState, setMinesGameState] = useState<'idle' | 'playing' | 'cashed_out' | 'busted'>('idle');

  const currentMinesMult = getMinesMultiplier(minesRevealedCount, minesCount);
  const currentMinesPayout = Math.round(betAmount * currentMinesMult);

  const startMinesGame = () => {
    if (balance < betAmount) {
      triggerHaptic('error');
      return;
    }
    onUpdateBalance(-betAmount);
    triggerHaptic('medium');
    sound.playClick();

    const tiles: { isMine: boolean; isRevealed: boolean }[] = Array.from({ length: 25 }, () => ({
      isMine: false,
      isRevealed: false,
    }));

    let placed = 0;
    while (placed < minesCount) {
      const idx = Math.floor(Math.random() * 25);
      if (!tiles[idx].isMine) {
        tiles[idx].isMine = true;
        placed++;
      }
    }

    setMinesGrid(tiles);
    setMinesRevealedCount(0);
    setMinesGameState('playing');
  };

  const clickMinesTile = (index: number) => {
    if (minesGameState !== 'playing') return;
    const tile = minesGrid[index];
    if (tile.isRevealed) return;

    if (tile.isMine) {
      triggerHaptic('error');
      sound.playReelTick(20);
      setMinesGrid(prev => prev.map(t => ({ ...t, isRevealed: true })));
      setMinesGameState('busted');
    } else {
      const nextRevealed = minesRevealedCount + 1;
      setMinesRevealedCount(nextRevealed);
      triggerHaptic('selection');
      sound.playCoin();

      setMinesGrid(prev =>
        prev.map((t, idx) => (idx === index ? { ...t, isRevealed: true } : t))
      );

      if (nextRevealed === 25 - minesCount) {
        cashOutMines(nextRevealed);
      }
    }
  };

  const cashOutMines = (count = minesRevealedCount) => {
    if (minesGameState !== 'playing' || count === 0) return;
    const mult = getMinesMultiplier(count, minesCount);
    const winAmount = Math.round(betAmount * mult);

    onUpdateBalance(winAmount);
    if (onRecordCasinoWin) onRecordCasinoWin(winAmount);

    triggerHaptic('success');
    sound.playWinEpic();

    setMinesGrid(prev => prev.map(t => ({ ...t, isRevealed: true })));
    setMinesGameState('cashed_out');
  };

  return (
    <div className="space-y-4 pb-12 max-w-md sm:max-w-xl mx-auto">
      {/* Game Selector Tabs: UPGRADER, 21 (Blackjack), Mines */}
      <div className="grid grid-cols-3 p-1 bg-[#12151c] rounded-2xl border border-slate-800">
        {[
          { id: 'upgrader', label: 'Апгрейдер', icon: ChevronsUp, highlight: true },
          { id: 'blackjack', label: '21 Очко', icon: Spade },
          { id: 'mines', label: 'Минёр', icon: Bomb },
        ].map(g => {
          const Icon = g.icon;
          const isActive = activeGame === g.id;
          return (
            <button
              key={g.id}
              onClick={() => {
                triggerHaptic('selection');
                sound.playClick();
                setActiveGame(g.id as CasinoGameId);
              }}
              className={`py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                isActive
                  ? 'bg-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{g.label}</span>
            </button>
          );
        })}
      </div>

      {/* ================================================================== */}
      {/* 1. UPGRADER (ПРОКАЧКА НОМЕРА — В ТОЧНОСТИ КАК НА СКРИНШОТЕ) */}
      {/* ================================================================== */}
      {activeGame === 'upgrader' && (
        <div className="bg-[#12151d] border border-slate-800/90 rounded-3xl p-4 sm:p-5 shadow-2xl space-y-4 relative overflow-hidden">
          {/* Top Bar of Upgrader */}
          <div className="flex items-center justify-between pb-1 border-b border-slate-800/60">
            <div className="flex items-center gap-2">
              <ChevronsUp className="w-5 h-5 text-amber-400 stroke-[3]" />
              <span className="font-black text-sm tracking-widest text-slate-100 uppercase">
                UPGRADER
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsSoundMuted(prev => !prev)}
                className="w-8 h-8 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-200 transition-colors"
                title="Звук колеса"
              >
                {isSoundMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>

              <div className="bg-slate-900/90 border border-slate-800 px-3 py-1.5 rounded-xl text-xs font-medium">
                <span className="text-slate-400 text-[10px] mr-1">БАЛАНС:</span>
                <span className="font-extrabold text-amber-400 font-mono-numbers">
                  {balance.toLocaleString('ru-RU')} ₽
                </span>
              </div>
            </div>
          </div>

          {/* Outcome notification banner */}
          {upgradeOutcomeMessage && (
            <div
              className={`p-3 rounded-2xl border text-xs font-bold text-center animate-in zoom-in-95 duration-200 ${
                upgradeOutcomeMessage.type === 'win'
                  ? 'bg-emerald-950/60 border-emerald-500/80 text-emerald-300 shadow-lg shadow-emerald-500/20'
                  : 'bg-rose-950/60 border-rose-500/80 text-rose-300 shadow-lg shadow-rose-500/20'
              }`}
            >
              {upgradeOutcomeMessage.text}
            </div>
          )}

          {/* THE RADIAL CIRCULAR GAUGE WHEEL (Exact screenshot aesthetic) */}
          <div className="relative flex flex-col items-center justify-center py-2">
            <div className="relative w-56 h-56 sm:w-60 sm:h-60 flex items-center justify-center select-none">
              {/* SVG Radial Roulette */}
              <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 240 240">
                <defs>
                  {/* Glowing orange/gold gradient matching screenshot */}
                  <linearGradient id="upgraderGoldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#f59e0b" />
                    <stop offset="50%" stopColor="#fbbf24" />
                    <stop offset="100%" stopColor="#ea580c" />
                  </linearGradient>
                  <filter id="glowFilter" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#f59e0b" floodOpacity="0.6" />
                  </filter>
                </defs>

                {/* Dark Outer Track Background */}
                <circle
                  cx="120"
                  cy="120"
                  r="85"
                  className="stroke-[#1a1f2c]"
                  strokeWidth="12"
                  fill="none"
                />

                {/* Tick marks on circular ring */}
                {Array.from({ length: 40 }).map((_, i) => {
                  const angle = (i / 40) * 360;
                  const rad = (angle * Math.PI) / 180;
                  const x1 = 120 + 94 * Math.cos(rad);
                  const y1 = 120 + 94 * Math.sin(rad);
                  const x2 = 120 + 99 * Math.cos(rad);
                  const y2 = 120 + 99 * Math.sin(rad);
                  const isMajor = i % 10 === 0;

                  return (
                    <line
                      key={i}
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke={isMajor ? '#64748b' : '#334155'}
                      strokeWidth={isMajor ? 2 : 1}
                    />
                  );
                })}

                {/* Highlighted Winning Sector Arc */}
                <circle
                  cx="120"
                  cy="120"
                  r="85"
                  stroke="url(#upgraderGoldGrad)"
                  strokeWidth="14"
                  strokeLinecap="round"
                  fill="none"
                  strokeDasharray={`${(totalWinChance / 100) * 534.07} 534.07`}
                  filter="url(#glowFilter)"
                  className="transition-all duration-300"
                />

                {/* Inner center dark circle */}
                <circle cx="120" cy="120" r="74" fill="#0b0e14" className="shadow-inner" />
              </svg>

              {/* Center percentage display */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                <div className="text-3xl sm:text-4xl font-black font-mono-numbers text-emerald-400 tracking-tight drop-shadow-md">
                  {totalWinChance.toFixed(2)}%
                </div>
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                  средний шанс
                </div>
                {extraChancePercent > 0 && (
                  <div className="text-[9px] font-bold text-amber-400 bg-amber-950/60 px-1.5 py-0.5 rounded-full mt-1">
                    +{extraChancePercent.toFixed(1)}% куплено
                  </div>
                )}
              </div>

              {/* Rotary Needle Pointer Indicator */}
              <div
                className="absolute inset-0 flex items-center justify-center pointer-events-none"
                style={{
                  transform: `rotate(${needleAngle}deg)`,
                  transition: isUpgrading ? 'none' : 'transform 0.15s ease-out',
                }}
              >
                {/* Needle graphic pointing outward from center */}
                <div className="relative w-full h-full flex items-center justify-center">
                  {/* Needle line with golden arrow tip */}
                  <div className="absolute top-3 w-3 h-7 flex flex-col items-center -translate-y-1">
                    {/* Glowing pointer triangle */}
                    <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[12px] border-b-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.9)]" />
                    <div className="w-1 h-3 bg-amber-400" />
                  </div>
                  {/* Center needle pivot node */}
                  <div className="w-4 h-4 rounded-full bg-gradient-to-tr from-amber-500 to-yellow-300 border border-amber-200 shadow-md shadow-amber-500/50" />
                </div>
              </div>
            </div>
          </div>

          {/* TWO CARDS SIDE BY SIDE: "ВАША СТАВКА" -> "ЦЕЛЬ" (Exact Screenshot Design) */}
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-3">
            {/* 1. LEFT CARD: YOUR BET (Selected Number) */}
            <div
              onClick={() => {
                if (!isUpgrading) {
                  triggerHaptic('light');
                  setShowCardPickerModal(true);
                }
              }}
              className={`p-3 sm:p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between min-h-[135px] relative group active:scale-[0.98] ${
                selectedCard
                  ? `${RARITY_CONFIGS[selectedCard.rarity].borderClass} bg-gradient-to-b from-[#161a25] to-[#10131b] hover:border-slate-500 shadow-lg`
                  : 'border-dashed border-slate-700 bg-[#0f121a] hover:border-amber-500/60'
              }`}
            >
              <div className="flex items-center justify-between text-[10px] uppercase font-bold text-slate-400">
                <span>Ваша ставка</span>
                <span className="text-amber-400 font-mono text-[9px] bg-slate-800/80 px-1 rounded">
                  {selectedCard ? '1 SIM' : '+ Выбрать'}
                </span>
              </div>

              {selectedCard ? (
                <div className="my-1.5 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-slate-200 font-bold truncate">
                    <span>{selectedCard.countryFlag || '🇷🇺'}</span>
                    <span className="truncate">{selectedCard.operatorName}</span>
                  </div>
                  <div
                    className="font-mono-numbers font-black text-xs sm:text-sm truncate select-none"
                    style={{ color: RARITY_CONFIGS[selectedCard.rarity].color }}
                  >
                    {selectedCard.fullNumber}
                  </div>
                  <div className="text-[10px] text-slate-400 capitalize">
                    {RARITY_CONFIGS[selectedCard.rarity].nameRu.split(' · ')[0]}
                  </div>
                </div>
              ) : (
                <div className="my-auto py-2 text-center text-xs text-slate-400 font-bold">
                  + Нажмите для выбора номера
                </div>
              )}

              <div className="pt-1.5 border-t border-slate-800/80 flex items-center justify-between">
                <span className="text-[10px] text-slate-400">Ценность:</span>
                <span className="text-xs font-black font-mono-numbers text-slate-100">
                  {inputCardValue.toLocaleString('ru-RU')} ₽
                </span>
              </div>
            </div>

            {/* Middle Indicator Arrow */}
            <div className="flex flex-col items-center justify-center shrink-0">
              <div className="w-7 h-7 rounded-full bg-slate-900 border border-slate-700/80 flex items-center justify-center text-amber-400 shadow-md">
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
              <span className="text-[10px] font-black font-mono text-amber-400 mt-1">
                ×{targetMultiplier}
              </span>
            </div>

            {/* 2. RIGHT CARD: TARGET (Upgraded Goal) */}
            <div
              className={`p-3 sm:p-3.5 rounded-2xl border transition-all flex flex-col justify-between min-h-[135px] relative shadow-lg ${RARITY_CONFIGS[targetRarity].borderClass} bg-gradient-to-b from-[#181d2a] to-[#12151e]`}
            >
              <div className="flex items-center justify-between text-[10px] uppercase font-bold text-slate-400">
                <span>Цель</span>
                <span
                  className="text-[9px] font-black px-1.5 py-0.2 rounded font-mono uppercase"
                  style={{
                    color: RARITY_CONFIGS[targetRarity].color,
                    backgroundColor: `${RARITY_CONFIGS[targetRarity].color}20`,
                  }}
                >
                  {RARITY_CONFIGS[targetRarity].badgeRu}
                </span>
              </div>

              <div className="my-1.5 space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-slate-200 font-bold truncate">
                  <span>{selectedCard?.countryFlag || '🇷🇺'}</span>
                  <span>Целевой грейд</span>
                </div>
                <div
                  className="font-mono-numbers font-black text-xs sm:text-sm truncate select-none tracking-tight"
                  style={{ color: RARITY_CONFIGS[targetRarity].color }}
                >
                  {targetRarity === 'mythic'
                    ? '999-99-99'
                    : targetRarity === 'legendary'
                    ? '777-77-77'
                    : targetRarity === 'epic'
                    ? '000-XX-00'
                    : '123-45-67'}
                </div>
                <div className="text-[10px] text-slate-400">
                  {RARITY_CONFIGS[targetRarity].nameRu}
                </div>
              </div>

              <div className="pt-1.5 border-t border-slate-800/80 flex items-center justify-between">
                <span className="text-[10px] text-slate-400">Цель:</span>
                <span className="text-xs font-black font-mono-numbers text-emerald-400">
                  {targetCardValue.toLocaleString('ru-RU')} ₽
                </span>
              </div>
            </div>
          </div>

          {/* Target Multiplier Presets */}
          <div className="space-y-1">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">
              Множитель цели (апгрейда):
            </div>
            <div className="grid grid-cols-6 gap-1.5">
              {UPGRADE_MULTIPLIERS.map(m => {
                const isSelected = targetMultiplier === m;
                return (
                  <button
                    key={m}
                    disabled={isUpgrading}
                    onClick={() => {
                      triggerHaptic('selection');
                      sound.playClick();
                      setTargetMultiplier(m);
                    }}
                    className={`py-1.5 rounded-xl text-xs font-black font-mono transition-all active:scale-95 ${
                      isSelected
                        ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                        : 'bg-[#181c26] text-slate-300 border border-slate-800 hover:bg-[#202533]'
                    }`}
                  >
                    ×{m}
                  </button>
                );
              })}
            </div>
          </div>

          {/* "ДОКУПИТЬ ШАНС" (Exact Screenshot Feature) */}
          <div className="bg-[#10131b] border border-slate-800/90 rounded-2xl p-3 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-300 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                <span>Докупить шанс</span>
              </span>

              <span className="font-mono text-xs font-bold text-amber-400">
                +{extraChancePercent.toFixed(1)}%{' '}
                <span className="text-slate-400">
                  (-{extraChanceCost.toLocaleString('ru-RU')} ₽)
                </span>
              </span>
            </div>

            {/* Slider */}
            <input
              type="range"
              min="0"
              max="35"
              step="1"
              disabled={isUpgrading}
              value={extraChancePercent}
              onChange={e => setExtraChancePercent(Number(e.target.value))}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
            />

            <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
              <span>0% (базовый)</span>
              <span>+15%</span>
              <span>+35% (максимум)</span>
            </div>
          </div>

          {/* THE BIG UPGRADE BUTTON ("▲ ПРОКАЧАТЬ") */}
          <button
            onClick={handlePerformUpgrade}
            disabled={!selectedCard || isUpgrading || extraChanceCost > balance}
            className={`w-full h-13 py-3.5 rounded-2xl font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl active:scale-[0.98] transition-all ${
              !selectedCard
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                : isUpgrading
                ? 'bg-amber-500/80 text-slate-950 animate-pulse cursor-wait'
                : extraChanceCost > balance
                ? 'bg-rose-950 border border-rose-500/50 text-rose-300 cursor-not-allowed'
                : 'bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:from-amber-400 hover:to-yellow-300 text-slate-950 shadow-amber-500/25 ring-1 ring-amber-300/40'
            }`}
          >
            <ChevronsUp className="w-4 h-4 stroke-[3]" />
            <span>
              {isUpgrading
                ? 'Прокачка в процессе...'
                : !selectedCard
                ? 'Выберите номер для апгрейда'
                : extraChanceCost > balance
                ? 'Недостаточно ₽ для докупки шанса'
                : `Прокачать (шанс ${totalWinChance.toFixed(1)}%)`}
            </span>
          </button>
        </div>
      )}

      {/* Global Bet Control Bar (for Blackjack & Mines) */}
      {activeGame !== 'upgrader' && (
        <div className="bg-[#141822] border border-slate-800 rounded-2xl p-3 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400 font-medium">Ставка:</span>
            <span className="font-extrabold text-emerald-400 font-mono-numbers">
              {betAmount.toLocaleString('ru-RU')} ₽
            </span>
          </div>

          {/* Quick Bet Buttons */}
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
            {BET_PRESETS.map(p => (
              <button
                key={p}
                onClick={() => {
                  triggerHaptic('selection');
                  setBetAmount(p);
                }}
                className={`px-2.5 py-1 rounded-xl text-[11px] font-bold font-mono-numbers transition-colors shrink-0 ${
                  betAmount === p
                    ? 'bg-emerald-500 text-slate-950'
                    : 'bg-slate-900 border border-slate-800 text-slate-300 hover:text-slate-100'
                }`}
              >
                {p >= 1000 ? `${p / 1000}k` : p} ₽
              </button>
            ))}
            <button
              onClick={() => {
                triggerHaptic('selection');
                setBetAmount(prev => Math.min(balance, prev * 2));
              }}
              className="px-2 py-1 rounded-xl text-[11px] font-bold bg-slate-900 border border-slate-800 text-amber-400 shrink-0"
            >
              2x
            </button>
            <button
              onClick={() => {
                triggerHaptic('selection');
                setBetAmount(prev => Math.max(50, Math.floor(prev / 2)));
              }}
              className="px-2 py-1 rounded-xl text-[11px] font-bold bg-slate-900 border border-slate-800 text-slate-400 shrink-0"
            >
              ½
            </button>
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* 2. BLACKJACK (21 ОЧКО) INTERFACE */}
      {/* ================================================================== */}
      {activeGame === 'blackjack' && (
        <div className="bg-gradient-to-b from-[#141822] to-[#0f1219] border border-slate-800 rounded-3xl p-4 sm:p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Spade className="w-5 h-5 text-amber-400" />
              <span className="font-extrabold text-sm text-slate-100">21 (Блэкджек)</span>
            </div>
            <span className="text-[10px] text-amber-400 font-mono font-bold bg-amber-950/40 border border-amber-500/30 px-2 py-0.5 rounded-full">
              Блэкджек 3:2
            </span>
          </div>

          {/* Table Felt */}
          <div className="bg-[#091811] border border-emerald-900/60 rounded-2xl p-4 space-y-4 shadow-inner relative overflow-hidden">
            <div className="space-y-1.5 relative z-10">
              <div className="flex items-center justify-between text-xs">
                <span className="text-emerald-400/80 font-bold flex items-center gap-1">
                  <Shield className="w-3.5 h-3.5" /> Карты Дилера:
                </span>
                <span className="font-mono font-black text-xs text-emerald-300 bg-emerald-950/60 border border-emerald-800 px-2 py-0.5 rounded-lg">
                  {bjState === 'idle'
                    ? '-'
                    : bjState === 'playing'
                    ? `${dealerCards[0]?.score || 0} + ?`
                    : `${fullDealerScore.score}`}
                </span>
              </div>

              <div className="flex items-center gap-2 min-h-[70px]">
                {dealerCards.map((c, idx) => {
                  const isHidden = bjState === 'playing' && idx === 1;
                  return (
                    <div
                      key={idx}
                      className={`w-12 h-18 sm:w-14 sm:h-20 rounded-xl p-1.5 flex flex-col justify-between shadow-md border font-bold transition-transform ${
                        isHidden
                          ? 'bg-emerald-900 border-emerald-700 items-center justify-center text-emerald-400 text-lg'
                          : `bg-slate-100 border-slate-300 ${c.isRed ? 'text-rose-600' : 'text-slate-900'}`
                      }`}
                    >
                      {isHidden ? (
                        <span>?</span>
                      ) : (
                        <>
                          <div className="text-xs sm:text-sm font-black leading-none">{c.value}</div>
                          <div className="text-lg sm:text-xl text-center leading-none">{c.suit}</div>
                          <div className="text-[10px] text-right leading-none opacity-60 font-mono">{c.score}</div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Player Hand Area */}
            <div className="space-y-1.5 pt-2 border-t border-emerald-900/40 relative z-10">
              <div className="flex items-center justify-between text-xs">
                <span className="text-emerald-400 font-bold">Ваша рука:</span>
                <span className="font-mono font-black text-xs text-emerald-300 bg-emerald-950/60 border border-emerald-800 px-2 py-0.5 rounded-lg">
                  {bjState === 'idle' ? '-' : `${playerHandScore.score}`}
                </span>
              </div>

              <div className="flex items-center gap-2 min-h-[70px] overflow-x-auto scrollbar-none pb-1">
                {playerCards.map((c, idx) => (
                  <div
                    key={idx}
                    className={`w-12 h-18 sm:w-14 sm:h-20 bg-slate-100 rounded-xl p-1.5 flex flex-col justify-between shadow-md border border-slate-300 font-bold transition-transform animate-in zoom-in-95 ${
                      c.isRed ? 'text-rose-600' : 'text-slate-900'
                    }`}
                  >
                    <div className="text-xs sm:text-sm font-black leading-none">{c.value}</div>
                    <div className="text-lg sm:text-xl text-center leading-none">{c.suit}</div>
                    <div className="text-[10px] text-right leading-none opacity-60 font-mono">{c.score}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Outcome Result Message */}
          {bjResult && (
            <div
              className={`text-center text-xs font-bold py-2.5 px-3 rounded-2xl border animate-in fade-in ${
                bjResult.status === 'blackjack'
                  ? 'bg-amber-950/60 border-amber-400 text-amber-300 shadow-lg shadow-amber-500/20'
                  : bjResult.status === 'win'
                  ? 'bg-emerald-950/50 border-emerald-500 text-emerald-300'
                  : bjResult.status === 'push'
                  ? 'bg-sky-950/50 border-sky-500 text-sky-300'
                  : 'bg-rose-950/50 border-rose-500 text-rose-300'
              }`}
            >
              {bjResult.message}
            </div>
          )}

          {/* Action Buttons */}
          {bjState === 'playing' ? (
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={hitCard}
                className="py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs sm:text-sm flex items-center justify-center gap-1 active:scale-95 shadow-md transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>Взять еще</span>
              </button>

              <button
                onClick={() => standCards()}
                className="py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs sm:text-sm flex items-center justify-center gap-1 active:scale-95 shadow-md transition-all"
              >
                <Shield className="w-4 h-4" />
                <span>Хватит</span>
              </button>

              <button
                onClick={doubleDown}
                disabled={playerCards.length !== 2 || balance < currentBjBet}
                className={`py-3 rounded-2xl font-black text-xs sm:text-sm flex flex-col items-center justify-center active:scale-95 transition-all ${
                  playerCards.length === 2 && balance >= currentBjBet
                    ? 'bg-indigo-500 hover:bg-indigo-400 text-white shadow-md'
                    : 'bg-slate-900 border border-slate-800 text-slate-600 cursor-not-allowed'
                }`}
              >
                <span>2x Удвоить</span>
                <span className="text-[9px] opacity-80 font-mono">+{currentBjBet.toLocaleString('ru-RU')} ₽</span>
              </button>
            </div>
          ) : (
            <button
              onClick={startBlackjack}
              disabled={balance < betAmount}
              className="w-full h-12 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm flex items-center justify-center gap-2 active:scale-98 shadow-md transition-all"
            >
              <Spade className="w-4 h-4" />
              <span>
                {bjState === 'finished' ? 'Сыграть ещё' : 'Раздать карты'} ({betAmount.toLocaleString('ru-RU')} ₽)
              </span>
            </button>
          )}
        </div>
      )}

      {/* ================================================================== */}
      {/* 3. MINES (МИНЁР) INTERFACE */}
      {/* ================================================================== */}
      {activeGame === 'mines' && (
        <div className="bg-[#141822] border border-slate-800 rounded-3xl p-4 sm:p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bomb className="w-5 h-5 text-rose-400" />
              <span className="font-extrabold text-sm text-slate-100">Минёр (5x5)</span>
            </div>
            {minesGameState !== 'playing' && (
              <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1 text-[11px]">
                <span className="text-slate-400 px-1">Мин:</span>
                {[1, 3, 5, 10].map(m => (
                  <button
                    key={m}
                    onClick={() => setMinesCount(m)}
                    className={`px-2 py-0.5 rounded-lg font-bold ${
                      minesCount === m ? 'bg-rose-500 text-white' : 'text-slate-400'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-5 gap-1.5 p-2 bg-[#0b0e14] rounded-2xl border border-slate-800/80">
            {Array.from({ length: 25 }).map((_, i) => {
              const tile = minesGrid[i];
              const isRevealed = tile?.isRevealed;
              const isMine = tile?.isMine;

              return (
                <button
                  key={i}
                  disabled={minesGameState !== 'playing' || isRevealed}
                  onClick={() => clickMinesTile(i)}
                  className={`aspect-square rounded-xl border flex items-center justify-center font-bold text-sm transition-all duration-200 active:scale-95 ${
                    isRevealed
                      ? isMine
                        ? 'bg-rose-950/70 border-rose-500 text-rose-400 shadow-lg shadow-rose-500/20'
                        : 'bg-emerald-950/70 border-emerald-500 text-emerald-400 shadow-lg shadow-emerald-500/20'
                      : minesGameState === 'playing'
                      ? 'bg-[#181d28] hover:bg-[#202636] border-slate-700/80 text-slate-300'
                      : 'bg-[#121620] border-slate-800 text-slate-600'
                  }`}
                >
                  {isRevealed ? (
                    isMine ? (
                      <Bomb className="w-5 h-5 animate-bounce" />
                    ) : (
                      <Sparkles className="w-5 h-5 animate-pulse text-emerald-400" />
                    )
                  ) : null}
                </button>
              );
            })}
          </div>

          {minesGameState === 'playing' ? (
            <button
              onClick={() => cashOutMines()}
              disabled={minesRevealedCount === 0}
              className={`w-full h-12 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-all active:scale-98 ${
                minesRevealedCount > 0
                  ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/20'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              <span>Забрать {currentMinesPayout.toLocaleString('ru-RU')} ₽</span>
              <span className="font-mono text-xs opacity-90">(x{currentMinesMult})</span>
            </button>
          ) : (
            <button
              onClick={startMinesGame}
              disabled={balance < betAmount}
              className="w-full h-12 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm flex items-center justify-center gap-2 active:scale-98 shadow-md transition-all"
            >
              <span>Начать игру ({betAmount.toLocaleString('ru-RU')} ₽)</span>
            </button>
          )}

          {minesGameState === 'cashed_out' && (
            <div className="text-center text-xs font-bold text-emerald-400 bg-emerald-950/30 border border-emerald-500/30 py-2 rounded-xl">
              ✓ Выигрыш зачислен: +{currentMinesPayout.toLocaleString('ru-RU')} ₽ (x{currentMinesMult})!
            </div>
          )}
          {minesGameState === 'busted' && (
            <div className="text-center text-xs font-bold text-rose-400 bg-rose-950/30 border border-rose-500/30 py-2 rounded-xl">
              💥 Взрыв! Мина задела ставку.
            </div>
          )}
        </div>
      )}

      {/* ================================================================== */}
      {/* CARD PICKER MODAL (FOR UPGRADER) */}
      {/* ================================================================== */}
      {showCardPickerModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-[#12151d] border-t sm:border border-slate-800 rounded-t-3xl sm:rounded-3xl max-w-md w-full max-h-[85vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom duration-200">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="font-black text-sm text-slate-100">
                  Выберите номер для апгрейда
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  В вашей коллекции: {collection.length} SIM-карт
                </p>
              </div>
              <button
                onClick={() => setShowCardPickerModal(false)}
                className="w-8 h-8 rounded-full bg-slate-900 text-slate-400 hover:text-white flex items-center justify-center text-xs font-bold"
              >
                ✕
              </button>
            </div>

            {/* List of Collection Cards */}
            <div className="p-4 overflow-y-auto space-y-2 max-h-[60vh]">
              {collection.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500 space-y-2">
                  <div>В вашей коллекции пока нет номеров.</div>
                  <div className="text-[11px] text-amber-400">
                    Крутите рулетку в первой вкладке, чтобы получить номера!
                  </div>
                </div>
              ) : (
                collection.map(card => {
                  const isSelected = card.id === selectedCard?.id;
                  const config = RARITY_CONFIGS[card.rarity];

                  return (
                    <button
                      key={card.id}
                      onClick={() => {
                        triggerHaptic('selection');
                        sound.playClick();
                        setSelectedCardId(card.id);
                        setShowCardPickerModal(false);
                      }}
                      className={`w-full p-3 rounded-2xl border flex items-center justify-between gap-3 text-left transition-all active:scale-[0.98] ${
                        isSelected
                          ? 'bg-amber-950/40 border-amber-500 shadow-md ring-1 ring-amber-500/20'
                          : 'bg-[#151923] border-slate-800 hover:bg-[#1a202d]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-xl shrink-0">{card.countryFlag || '🇷🇺'}</span>
                        <div className="min-w-0">
                          <div
                            className="font-mono-numbers font-extrabold text-xs sm:text-sm truncate"
                            style={{ color: config.color }}
                          >
                            {card.fullNumber}
                          </div>
                          <div className="text-[10px] text-slate-400 flex items-center gap-1.5 truncate">
                            <span>{card.operatorName}</span>
                            <span>·</span>
                            <span style={{ color: config.color }}>{config.nameRu.split(' · ')[0]}</span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="font-mono font-black text-xs text-slate-100">
                          {card.sellPrice.toLocaleString('ru-RU')} ₽
                        </div>
                        {isSelected && (
                          <span className="text-[9px] font-bold text-amber-400 uppercase">
                            Выбран
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
