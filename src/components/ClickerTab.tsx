import React, { useState, useEffect, useRef } from 'react';
import { PlayerUpgrades } from '../types/game';
import { CLICKER_UPGRADES } from '../utils/afkFarm';
import { sound } from '../utils/audio';
import { triggerHaptic } from '../utils/telegram';
import {
  MousePointerClick,
  Sparkles,
  Flame,
  Bot,
  Zap,
  Check,
  TrendingUp,
} from 'lucide-react';

interface ClickerTabProps {
  balance: number;
  upgrades: PlayerUpgrades;
  onUpdateBalance: (amount: number) => void;
  onBuyUpgrade: (key: keyof PlayerUpgrades, cost: number) => void;
  onRecordClick?: (earned: number) => void;
}

interface FloatingText {
  id: number;
  text: string;
  x: number;
  y: number;
  isCrit: boolean;
}

export const ClickerTab: React.FC<ClickerTabProps> = ({
  balance,
  upgrades,
  onUpdateBalance,
  onBuyUpgrade,
  onRecordClick,
}) => {
  // Combo mechanics
  const [combo, setCombo] = useState<number>(1.0);
  const [isPressed, setIsPressed] = useState<boolean>(false);
  const [floatingTexts, setFloatingTexts] = useState<FloatingText[]>([]);
  const comboTimerRef = useRef<number | null>(null);

  // Turbo mode (15s boost, 60s cooldown)
  const [isTurbo, setIsTurbo] = useState<boolean>(false);
  const [turboTimer, setTurboTimer] = useState<number>(0);
  const [turboCooldown, setTurboCooldown] = useState<number>(0);

  // Auto-clicker effect
  useEffect(() => {
    const autoClicksPerSec = upgrades.autoClickerLevel || 0;
    if (autoClicksPerSec <= 0) return;

    const interval = setInterval(() => {
      const basePower = 1 + (upgrades.clickPowerLevel || 0) * 3;
      const turboMult = isTurbo ? 3 : 1;
      const earned = Math.round(basePower * autoClicksPerSec * turboMult);

      onUpdateBalance(earned);
      if (onRecordClick) onRecordClick(earned);
    }, 1000);

    return () => clearInterval(interval);
  }, [upgrades.autoClickerLevel, upgrades.clickPowerLevel, isTurbo]);

  // Turbo countdown timers
  useEffect(() => {
    if (turboTimer > 0) {
      const t = setTimeout(() => setTurboTimer(prev => prev - 1), 1000);
      return () => clearTimeout(t);
    } else if (isTurbo) {
      setIsTurbo(false);
      setTurboCooldown(60);
    }
  }, [turboTimer, isTurbo]);

  useEffect(() => {
    if (turboCooldown > 0) {
      const t = setTimeout(() => setTurboCooldown(prev => prev - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [turboCooldown]);

  // Calculate tap power
  const basePower = 1 + (upgrades.clickPowerLevel || 0) * 3;
  const critChance = Math.min(40, (upgrades.clickCritChanceLevel || 0) * 1.0);
  const critMultiplier = 2 + (upgrades.clickCritMultLevel || 0) * 0.35;

  const handleChipClick = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    setIsPressed(true);
    setTimeout(() => setIsPressed(false), 120);

    // Roll critical hit
    const isCrit = Math.random() * 100 < critChance;
    const turboMult = isTurbo ? 3.0 : 1.0;
    const mult = (isCrit ? critMultiplier : 1.0) * combo * turboMult;
    const earned = Math.max(1, Math.round(basePower * mult));

    onUpdateBalance(earned);
    if (onRecordClick) onRecordClick(earned);

    if (isCrit) {
      triggerHaptic('heavy');
      sound.playCoin();
    } else {
      triggerHaptic('light');
      sound.playClick();
    }

    // Build combo streak up to x2.0
    setCombo(prev => Math.min(2.0, +(prev + 0.05).toFixed(2)));
    if (comboTimerRef.current) clearTimeout(comboTimerRef.current);
    comboTimerRef.current = window.setTimeout(() => {
      setCombo(1.0);
    }, 1200);

    // Floating text coordinates
    const rect = e.currentTarget.getBoundingClientRect();
    let clientX = rect.left + rect.width / 2;
    let clientY = rect.top + rect.height / 3;

    if ('clientX' in e && e.clientX) {
      clientX = e.clientX;
      clientY = e.clientY;
    } else if ('touches' in e && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    }

    const relX = clientX - rect.left;
    const relY = clientY - rect.top;

    const newFloat: FloatingText = {
      id: Date.now() + Math.random(),
      text: isCrit ? `🔥 +${earned} ₽ (КРИТ!)` : `+${earned} ₽`,
      x: relX + (Math.random() * 40 - 20),
      y: relY + (Math.random() * 20 - 10),
      isCrit,
    };

    setFloatingTexts(prev => [...prev.slice(-12), newFloat]);
  };

  // Remove floating texts after animation
  useEffect(() => {
    if (floatingTexts.length === 0) return;
    const timer = setTimeout(() => {
      setFloatingTexts(prev => prev.slice(1));
    }, 800);
    return () => clearTimeout(timer);
  }, [floatingTexts]);

  const activateTurbo = () => {
    if (turboCooldown > 0 || isTurbo) return;
    setIsTurbo(true);
    setTurboTimer(15);
    triggerHaptic('success');
    sound.playWinRare();
  };

  return (
    <div className="space-y-4 pb-12 max-w-md sm:max-w-xl mx-auto">
      {/* Header Info Banner */}
      <div className="bg-gradient-to-br from-[#141822] via-[#10141d] to-[#121622] border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <MousePointerClick className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-100">SIM-Кликер (Тапалка)</h2>
              <span className="text-[11px] text-slate-400">Тапайте по золотому чипу для мгновенной прибыли</span>
            </div>
          </div>

          {/* Turbo button */}
          <button
            onClick={activateTurbo}
            disabled={turboCooldown > 0 || isTurbo}
            className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all active:scale-95 ${
              isTurbo
                ? 'bg-amber-500 text-slate-950 animate-pulse shadow-lg shadow-amber-500/30'
                : turboCooldown > 0
                ? 'bg-slate-900 border border-slate-800 text-slate-500 cursor-not-allowed text-[11px]'
                : 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 shadow-md shadow-amber-500/20'
            }`}
          >
            <Flame className="w-3.5 h-3.5" />
            <span>{isTurbo ? `ТУРБО ${turboTimer}с` : turboCooldown > 0 ? `${turboCooldown}с` : 'ТУРБО 3x'}</span>
          </button>
        </div>

        {/* Stats metrics */}
        <div className="grid grid-cols-4 gap-2 pt-1 text-center">
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2">
            <div className="text-[9px] text-slate-400 uppercase font-semibold">Сила клика</div>
            <div className="text-xs sm:text-sm font-black text-emerald-400 font-mono-numbers mt-0.5">
              +{basePower} ₽
            </div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2">
            <div className="text-[9px] text-slate-400 uppercase font-semibold">Шанс крита</div>
            <div className="text-xs sm:text-sm font-black text-amber-400 font-mono-numbers mt-0.5">
              {critChance.toFixed(0)}%
            </div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2">
            <div className="text-[9px] text-slate-400 uppercase font-semibold">Комбо</div>
            <div className="text-xs sm:text-sm font-black text-sky-400 font-mono-numbers mt-0.5">
              x{combo.toFixed(2)}
            </div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2">
            <div className="text-[9px] text-slate-400 uppercase font-semibold">Авто-кликер</div>
            <div className="text-xs sm:text-sm font-black text-purple-400 font-mono-numbers mt-0.5">
              {upgrades.autoClickerLevel || 0}/с
            </div>
          </div>
        </div>
      </div>

      {/* Central Interactive SIM Chip */}
      <div className="py-6 sm:py-8 flex flex-col items-center justify-center relative select-none">
        <div
          onClick={handleChipClick}
          className={`w-48 h-48 sm:w-56 sm:h-56 rounded-3xl bg-gradient-to-tr from-[#161b26] via-[#1c2230] to-[#161b26] border-4 border-amber-400/50 shadow-2xl relative flex items-center justify-center cursor-pointer transition-transform duration-100 ${
            isPressed ? 'scale-90' : 'hover:scale-105 active:scale-95'
          } ${isTurbo ? 'ring-8 ring-amber-400/30' : ''}`}
          style={{
            boxShadow: isTurbo
              ? '0 0 50px rgba(245, 158, 11, 0.45)'
              : '0 0 35px rgba(245, 158, 11, 0.2)',
          }}
        >
          {/* Gold Metallic SIM Contacts Circuit */}
          <div className="w-36 h-36 sm:w-44 sm:h-44 rounded-2xl bg-gradient-to-br from-amber-400 via-yellow-200 to-amber-600 p-2 shadow-inner relative flex flex-col justify-between">
            <div className="flex justify-between items-center px-1 pt-1">
              <span className="text-[10px] font-black text-slate-900 tracking-widest font-mono">5G CHIP</span>
              <div className="w-3 h-3 rounded-full bg-slate-900/40 border border-slate-900" />
            </div>

            {/* Circuit Geometric Lines */}
            <div className="border-2 border-amber-900/40 rounded-xl p-2.5 flex flex-col items-center justify-center bg-amber-400/30 backdrop-blur-xs">
              <Sparkles className="w-10 h-10 text-amber-900 mb-1 animate-pulse" />
              <span className="text-xs font-black text-amber-950 font-mono uppercase tracking-wider">
                ТАП ПО ЧИПУ
              </span>
              <span className="text-[10px] font-bold text-amber-900 font-mono mt-0.5">
                +{basePower} ₽
              </span>
            </div>

            <div className="flex justify-between items-center px-1 pb-1">
              <div className="w-2.5 h-2.5 rounded-full bg-slate-900/40" />
              <span className="text-[9px] font-bold text-slate-900 font-mono">SIM GACHA</span>
            </div>
          </div>

          {/* Floating Text Particles */}
          {floatingTexts.map(item => (
            <div
              key={item.id}
              className={`absolute pointer-events-none font-black text-sm sm:text-base animate-out fade-out slide-out-to-top duration-700 font-mono-numbers z-30 whitespace-nowrap ${
                item.isCrit
                  ? 'text-amber-300 drop-shadow-[0_2px_8px_rgba(245,158,11,0.8)] scale-110'
                  : 'text-emerald-400 drop-shadow-[0_1px_4px_rgba(16,185,129,0.7)]'
              }`}
              style={{ left: `${item.x}px`, top: `${item.y}px` }}
            >
              {item.text}
            </div>
          ))}
        </div>

        <div className="text-xs text-slate-400 font-medium mt-4 text-center">
          {combo > 1.2 ? `⚡ Серия кликов x${combo.toFixed(2)} активирована!` : 'Быстро кликайте для набора комбо'}
        </div>
      </div>

      {/* Clicker Upgrades Shop Section */}
      <div className="bg-[#141822] border border-slate-800 rounded-3xl p-4 sm:p-5 shadow-xl space-y-3">
        <div className="flex items-center gap-2 pb-1 border-b border-slate-800/80">
          <TrendingUp className="w-4 h-4 text-emerald-400" />
          <h3 className="font-extrabold text-xs sm:text-sm text-slate-100">
            Долгая прокачка кликера (до 80 уровней)
          </h3>
        </div>

        <div className="space-y-2.5">
          {CLICKER_UPGRADES.map(item => {
            const currentLevel = (upgrades[item.id] as number) || 0;
            const isMax = currentLevel >= item.maxLevel;
            const cost = isMax ? 0 : item.costFormula(currentLevel);
            const canAfford = balance >= cost;

            return (
              <div
                key={item.id}
                className="bg-[#0e1118] border border-slate-800/90 rounded-2xl p-3 flex items-center justify-between gap-3 shadow-sm hover:border-slate-700 transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center shrink-0">
                    {item.iconName === 'MousePointerClick' && (
                      <MousePointerClick className="w-4 h-4 text-emerald-400" />
                    )}
                    {item.iconName === 'Sparkles' && (
                      <Sparkles className="w-4 h-4 text-amber-400" />
                    )}
                    {item.iconName === 'Flame' && (
                      <Flame className="w-4 h-4 text-rose-400" />
                    )}
                    {item.iconName === 'Bot' && (
                      <Bot className="w-4 h-4 text-purple-400" />
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-xs text-slate-200 truncate">
                        {item.title}
                      </span>
                      <span className="text-[10px] font-mono font-bold text-slate-400 shrink-0">
                        {currentLevel}/{item.maxLevel}
                      </span>
                    </div>
                    <div className="text-[11px] text-emerald-400 font-mono font-bold mt-0.5">
                      {item.effectDescription(currentLevel)}
                    </div>
                  </div>
                </div>

                <div className="shrink-0">
                  {isMax ? (
                    <div className="px-3 py-1 rounded-xl bg-slate-900 border border-slate-800 text-slate-500 text-xs font-bold flex items-center gap-1">
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span>МАКС</span>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        if (canAfford) {
                          triggerHaptic('success');
                          sound.playUpgrade();
                          onBuyUpgrade(item.id, cost);
                        } else {
                          triggerHaptic('error');
                        }
                      }}
                      disabled={!canAfford}
                      className={`px-3 py-1.5 rounded-xl font-bold text-xs flex flex-col items-center justify-center active:scale-95 transition-all ${
                        canAfford
                          ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-sm'
                          : 'bg-slate-900 border border-slate-800 text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      <span>Улучшить</span>
                      <span className="font-mono-numbers text-[10px] opacity-90">
                        {cost.toLocaleString('ru-RU')} ₽
                      </span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
