import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { sound } from '../utils/audio';
import { triggerHaptic } from '../utils/telegram';
import {
  Bomb,
  Rocket,
  Spade,
  Sparkles,
  RotateCcw,
  Plus,
  Shield,
  Layers,
} from 'lucide-react';

interface CasinoTabProps {
  balance: number;
  onUpdateBalance: (amountDelta: number) => void;
  onRecordCasinoWin?: (amount: number) => void;
}

type CasinoGameId = 'blackjack' | 'mines' | 'crash';

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

export const CasinoTab: React.FC<CasinoTabProps> = ({
  balance,
  onUpdateBalance,
  onRecordCasinoWin,
}) => {
  const [activeGame, setActiveGame] = useState<CasinoGameId>('blackjack');
  const [betAmount, setBetAmount] = useState<number>(1000);

  // Quick Bet presets
  const BET_PRESETS = [500, 1000, 5000, 10000, 50000];

  // ============================================================================
  // 1. BLACKJACK (21 ОЧКО)
  // ============================================================================
  const [bjState, setBjState] = useState<'idle' | 'playing' | 'dealer_turn' | 'finished'>('idle');
  const [playerCards, setPlayerCards] = useState<PlayingCard[]>([]);
  const [dealerCards, setDealerCards] = useState<PlayingCard[]>([]);
  const [bjResult, setBjResult] = useState<{
    status: 'win' | 'blackjack' | 'lose' | 'push' | 'bust';
    message: string;
    payout: number;
  } | null>(null);
  const [currentBjBet, setCurrentBjBet] = useState<number>(betAmount);

  const playerScore = calculateHandScore(playerCards);
  const dealerScore = calculateHandScore(
    bjState === 'playing' ? dealerCards.slice(0, 1) : dealerCards
  );
  const fullDealerScore = calculateHandScore(dealerCards);

  // Start 21 Game
  const startBlackjack = () => {
    if (balance < betAmount) {
      triggerHaptic('error');
      return;
    }

    onUpdateBalance(-betAmount);
    setCurrentBjBet(betAmount);
    triggerHaptic('medium');
    sound.playClick();

    const pCard1 = drawRandomCard();
    const dCard1 = drawRandomCard();
    const pCard2 = drawRandomCard();
    const dCard2 = drawRandomCard();

    const initialPlayer = [pCard1, pCard2];
    const initialDealer = [dCard1, dCard2];

    setPlayerCards(initialPlayer);
    setDealerCards(initialDealer);
    setBjResult(null);

    const initialPScore = calculateHandScore(initialPlayer);
    const initialDScore = calculateHandScore(initialDealer);

    // Natural 21 check
    if (initialPScore.score === 21) {
      setBjState('finished');
      if (initialDScore.score === 21) {
        // Both have 21 -> Push
        onUpdateBalance(betAmount);
        setBjResult({
          status: 'push',
          message: 'Ничья! У обоих 21 очко. Ставка возвращена.',
          payout: betAmount,
        });
        triggerHaptic('selection');
      } else {
        // Natural Blackjack (pays 3:2 = 2.5x)
        const payout = Math.round(betAmount * 2.5);
        onUpdateBalance(payout);
        if (onRecordCasinoWin) onRecordCasinoWin(payout);
        setBjResult({
          status: 'blackjack',
          message: `🔥 БЛЭКДЖЕК 21! Чистая победа 3:2 (+${payout.toLocaleString('ru-RU')} ₽)`,
          payout,
        });
        triggerHaptic('success');
        sound.playWinLegendary();
        confetti({ particleCount: 70, spread: 70, origin: { y: 0.6 } });
      }
    } else {
      setBjState('playing');
    }
  };

  // Player: Hit (Взять карту)
  const hitCard = () => {
    if (bjState !== 'playing') return;
    triggerHaptic('selection');
    sound.playReelTick(12);

    const newCard = drawRandomCard();
    const nextHand = [...playerCards, newCard];
    setPlayerCards(nextHand);

    const nextScore = calculateHandScore(nextHand);
    if (nextScore.score > 21) {
      // Bust!
      setBjState('finished');
      setBjResult({
        status: 'bust',
        message: `💥 Перебор (${nextScore.score} очков)! Дилер побеждает.`,
        payout: 0,
      });
      triggerHaptic('error');
    } else if (nextScore.score === 21) {
      // Auto stand on 21
      standCards(nextHand);
    }
  };

  // Player: Double Down (Удвоить)
  const doubleDown = () => {
    if (bjState !== 'playing' || playerCards.length !== 2) return;
    if (balance < currentBjBet) {
      triggerHaptic('error');
      return;
    }

    onUpdateBalance(-currentBjBet);
    const doubled = currentBjBet * 2;
    setCurrentBjBet(doubled);
    triggerHaptic('medium');
    sound.playCoin();

    const newCard = drawRandomCard();
    const nextHand = [...playerCards, newCard];
    setPlayerCards(nextHand);

    const nextScore = calculateHandScore(nextHand);
    if (nextScore.score > 21) {
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

  // Player: Stand (Хватит)
  const standCards = (currentPlayerHand = playerCards, activeBet = currentBjBet) => {
    if (bjState !== 'playing' && bjState !== 'idle') return;
    setBjState('dealer_turn');
    triggerHaptic('selection');

    // Dealer turn logic: Dealer must hit until score >= 17
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
      // Dealer busts -> Player wins 2x
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
      confetti({ particleCount: 45, spread: 60, origin: { y: 0.6 } });
    } else if (pScore > finalDScore) {
      // Player score > Dealer score
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
      // Push -> Refund
      onUpdateBalance(activeBet);
      setBjResult({
        status: 'push',
        message: `🤝 Ровно! Ничья (${pScore} : ${finalDScore}). Ставка возвращена.`,
        payout: activeBet,
      });
      triggerHaptic('selection');
    } else {
      // Dealer wins
      setBjResult({
        status: 'lose',
        message: `✕ Дилер набрал больше (${finalDScore} против ваших ${pScore}).`,
        payout: 0,
      });
      triggerHaptic('error');
    }
  };

  // ============================================================================
  // 2. MINES (Сапёр 5x5)
  // ============================================================================
  const [minesCount, setMinesCount] = useState<number>(3);
  const [minesGameState, setMinesGameState] = useState<'idle' | 'playing' | 'cashed_out' | 'busted'>('idle');
  const [minesGrid, setMinesGrid] = useState<{ isMine: boolean; isRevealed: boolean }[]>([]);
  const [minesRevealedCount, setMinesRevealedCount] = useState<number>(0);

  const getMinesMultiplier = (revealed: number, mines: number): number => {
    if (revealed === 0) return 1.0;
    let mult = 1.0;
    for (let i = 0; i < revealed; i++) {
      mult *= (25 - i) / (25 - mines - i);
    }
    return +mult.toFixed(2);
  };

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
    confetti({ particleCount: 40, spread: 60, origin: { y: 0.7 } });

    setMinesGrid(prev => prev.map(t => ({ ...t, isRevealed: true })));
    setMinesGameState('cashed_out');
  };

  // ============================================================================
  // 3. CRASH (Ракета)
  // ============================================================================
  const [crashState, setCrashState] = useState<'idle' | 'flying' | 'crashed' | 'cashed_out'>('idle');
  const [crashMultiplier, setCrashMultiplier] = useState<number>(1.0);
  const crashRef = useRef<number | null>(null);
  const crashPointRef = useRef<number>(1.0);

  const startCrashGame = () => {
    if (balance < betAmount) {
      triggerHaptic('error');
      return;
    }
    onUpdateBalance(-betAmount);
    triggerHaptic('medium');
    sound.playClick();

    const r = Math.random();
    const crashThreshold = r < 0.06 ? 1.0 : +(0.95 / (1 - r)).toFixed(2);
    crashPointRef.current = Math.min(100.0, Math.max(1.0, crashThreshold));

    setCrashMultiplier(1.0);
    setCrashState('flying');

    let current = 1.0;
    const startTime = Date.now();

    if (crashRef.current) clearInterval(crashRef.current);
    crashRef.current = window.setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000;
      current = +(1.0 + Math.pow(elapsed * 0.7, 1.6)).toFixed(2);

      if (current >= crashPointRef.current) {
        if (crashRef.current) clearInterval(crashRef.current);
        setCrashMultiplier(crashPointRef.current);
        setCrashState('crashed');
        triggerHaptic('error');
      } else {
        setCrashMultiplier(current);
        if (Math.random() < 0.2) triggerHaptic('selection');
      }
    }, 60);
  };

  const cashOutCrash = () => {
    if (crashState !== 'flying') return;
    if (crashRef.current) clearInterval(crashRef.current);

    const winAmount = Math.round(betAmount * crashMultiplier);
    onUpdateBalance(winAmount);
    if (onRecordCasinoWin) onRecordCasinoWin(winAmount);

    setCrashState('cashed_out');
    triggerHaptic('success');
    sound.playWinRare();
    confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
  };

  useEffect(() => {
    return () => {
      if (crashRef.current) clearInterval(crashRef.current);
    };
  }, []);

  return (
    <div className="space-y-4 pb-12 max-w-md sm:max-w-xl mx-auto">
      {/* Game Selector Tabs: 21 (Blackjack), Mines, Crash */}
      <div className="grid grid-cols-3 p-1 bg-[#12151c] rounded-2xl border border-slate-800">
        {[
          { id: 'blackjack', label: '21 Очко', icon: Spade },
          { id: 'mines', label: 'Минёр', icon: Bomb },
          { id: 'crash', label: 'Ракета', icon: Rocket },
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
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{g.label}</span>
            </button>
          );
        })}
      </div>

      {/* Global Bet Control Bar */}
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
              setBetAmount(prev => Math.max(100, Math.floor(prev / 2)));
            }}
            className="px-2 py-1 rounded-xl text-[11px] font-bold bg-slate-900 border border-slate-800 text-slate-400 shrink-0"
          >
            ½
          </button>
        </div>
      </div>

      {/* ================================================================== */}
      {/* 1. BLACKJACK (21 ОЧКО) INTERFACE */}
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
            <div className="absolute inset-0 bg-radial-gradient from-emerald-500/5 to-transparent pointer-events-none" />

            {/* Dealer Hand Area */}
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

              <div className="flex gap-2 min-h-[76px] items-center">
                {dealerCards.length === 0 ? (
                  <div className="text-xs text-emerald-600 italic">Нажмите «Раздать карты» для старта</div>
                ) : (
                  dealerCards.map((c, idx) => {
                    const isHidden = bjState === 'playing' && idx === 1;
                    if (isHidden) {
                      return (
                        <div
                          key={idx}
                          className="w-12 h-18 sm:w-14 sm:h-20 bg-gradient-to-br from-amber-900 to-amber-950 border-2 border-amber-500/60 rounded-xl flex items-center justify-center shadow-md animate-in zoom-in-90"
                        >
                          <div className="w-8 h-12 border border-amber-500/30 rounded-lg flex items-center justify-center text-amber-400 text-xs font-mono font-bold">
                            SIM
                          </div>
                        </div>
                      );
                    }
                    return (
                      <div
                        key={idx}
                        className={`w-12 h-18 sm:w-14 sm:h-20 bg-slate-100 rounded-xl p-1.5 flex flex-col justify-between shadow-md border border-slate-300 font-bold transition-transform ${
                          c.isRed ? 'text-rose-600' : 'text-slate-900'
                        }`}
                      >
                        <div className="text-xs sm:text-sm font-black leading-none">{c.value}</div>
                        <div className="text-lg sm:text-xl text-center leading-none">{c.suit}</div>
                        <div className="text-[10px] text-right leading-none opacity-60 font-mono">{c.score}</div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="border-t border-emerald-900/50" />

            {/* Player Hand Area */}
            <div className="space-y-1.5 relative z-10">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-200 font-bold flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5 text-emerald-400" /> Ваши карты:
                </span>
                <span
                  className={`font-mono font-black text-xs px-2 py-0.5 rounded-lg border ${
                    playerScore.score === 21
                      ? 'bg-amber-500 text-slate-950 border-amber-400 font-extrabold animate-pulse'
                      : playerScore.score > 21
                      ? 'bg-rose-950 text-rose-300 border-rose-800'
                      : 'bg-emerald-950/60 text-emerald-300 border-emerald-800'
                  }`}
                >
                  {playerCards.length === 0 ? '-' : `${playerScore.score} очков`}
                </span>
              </div>

              <div className="flex gap-2 min-h-[76px] items-center flex-wrap">
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
      {/* 2. MINES INTERFACE */}
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
      {/* 3. CRASH INTERFACE */}
      {/* ================================================================== */}
      {activeGame === 'crash' && (
        <div className="bg-[#141722] border border-slate-800 rounded-3xl p-4 sm:p-5 shadow-xl space-y-4">
          <div className="flex items-center gap-2">
            <Rocket className="w-5 h-5 text-indigo-400" />
            <span className="font-extrabold text-sm text-slate-100">Ракета (Crash)</span>
          </div>

          <div className="h-44 bg-[#0a0c10] border border-slate-800 rounded-2xl flex flex-col items-center justify-center relative overflow-hidden shadow-inner">
            <div className="absolute inset-0 bg-gradient-to-t from-indigo-950/20 to-transparent pointer-events-none" />

            <div
              className={`text-4xl sm:text-5xl font-black font-mono-numbers tracking-tight transition-transform ${
                crashState === 'crashed'
                  ? 'text-rose-500 scale-95'
                  : crashState === 'flying'
                  ? 'text-emerald-400 scale-105'
                  : 'text-slate-300'
              }`}
            >
              {crashMultiplier.toFixed(2)}x
            </div>

            <div className="text-xs text-slate-400 mt-2 font-medium">
              {crashState === 'flying' && '🚀 Ракета набирает высоту...'}
              {crashState === 'crashed' && '💥 Ракета взорвалась!'}
              {crashState === 'cashed_out' && '✓ Вы успешно катапультировались!'}
              {crashState === 'idle' && 'Нажмите кнопку для запуска ракеты'}
            </div>
          </div>

          {crashState === 'flying' ? (
            <button
              onClick={cashOutCrash}
              className="w-full h-12 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 active:scale-98 transition-all"
            >
              <span>Забрать {Math.round(betAmount * crashMultiplier).toLocaleString('ru-RU')} ₽</span>
              <span className="font-mono text-xs">({crashMultiplier.toFixed(2)}x)</span>
            </button>
          ) : (
            <button
              onClick={startCrashGame}
              disabled={balance < betAmount}
              className="w-full h-12 rounded-2xl bg-indigo-500 hover:bg-indigo-400 text-white font-black text-sm flex items-center justify-center gap-2 active:scale-98 shadow-md transition-all"
            >
              <span>Запустить ракету ({betAmount.toLocaleString('ru-RU')} ₽)</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
