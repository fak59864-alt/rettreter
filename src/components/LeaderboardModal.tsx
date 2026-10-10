import React, { useState, useEffect } from 'react';
import { LeaderboardUser, LeaderboardResponse, TelegramUserData } from '../types/game';
import { RARITY_CONFIGS } from '../utils/rarityConfig';
import { triggerHaptic } from '../utils/telegram';
import { sound } from '../utils/audio';
import {
  Trophy,
  Crown,
  Medal,
  RefreshCw,
  Sparkles,
  Zap,
  TrendingUp,
  Search,
  CheckCircle2,
  Phone,
  Flame,
} from 'lucide-react';

interface LeaderboardModalProps {
  currentUser: TelegramUserData;
  currentBalance: number;
  currentLevel: number;
  onClose: () => void;
  onNavigateToSpin?: () => void;
}

export const LeaderboardModal: React.FC<LeaderboardModalProps> = ({
  currentUser,
  currentBalance,
  currentLevel,
  onClose,
  onNavigateToSpin,
}) => {
  const [players, setPlayers] = useState<LeaderboardUser[]>([]);
  const [userRank, setUserRank] = useState<number | null>(null);
  const [totalPlayers, setTotalPlayers] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterMode, setFilterMode] = useState<'all' | 'top10' | 'rareHolders'>('all');

  const fetchLeaderboard = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const res = await fetch(`/api/leaderboard?userId=${currentUser.id}`);
      if (res.ok) {
        const data: LeaderboardResponse = await res.json();
        if (data.success && Array.isArray(data.leaderboard)) {
          setPlayers(data.leaderboard);
          setUserRank(data.currentUserRank ?? null);
          setTotalPlayers(data.total);
        }
      }
    } catch (err) {
      console.error('Failed to load leaderboard:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
  }, [currentUser.id]);

  const handleManualRefresh = () => {
    triggerHaptic('light');
    sound.playClick();
    fetchLeaderboard(true);
  };

  // Filter players
  const filteredPlayers = players.filter(p => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchName = p.name.toLowerCase().includes(q);
      const matchUser = (p.username || '').toLowerCase().includes(q);
      const matchPhone = (p.bestCardNumber || '').toLowerCase().includes(q);
      if (!matchName && !matchUser && !matchPhone) return false;
    }
    if (filterMode === 'top10') return p.rank <= 10;
    if (filterMode === 'rareHolders') {
      return p.bestCardRarity === 'mythic' || p.bestCardRarity === 'legendary';
    }
    return true;
  });

  // Top 3 Podium
  const top1 = players[0];
  const top2 = players[1];
  const top3 = players[2];

  // Current user item in players list or synthesized
  const currentUserEntry = players.find(p => p.isCurrentUser || String(p.userId) === String(currentUser.id));
  const effectiveRank = userRank || currentUserEntry?.rank || null;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-[#0f1218] border border-slate-800/90 rounded-3xl max-w-xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden relative">
        {/* Header Bar */}
        <div className="px-4 sm:px-6 py-3.5 border-b border-slate-800/80 flex items-center justify-between bg-[#131720]/90 backdrop-blur-sm shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 via-yellow-400 to-amber-600 p-[1.5px] shadow-lg shadow-amber-500/20">
              <div className="w-full h-full rounded-[10px] bg-[#12151d] flex items-center justify-center">
                <Trophy className="w-4 h-4 text-amber-400 fill-amber-400/20" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-black text-slate-100 tracking-tight">
                  Топ реальных пользователей
                </h2>
                <span className="flex items-center gap-1 text-[9px] font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-1.5 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Рейтинг абонентов по балансу в реальном времени</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={handleManualRefresh}
              disabled={refreshing}
              className="w-8 h-8 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-100 flex items-center justify-center text-xs transition-colors active:scale-95 disabled:opacity-50"
              title="Обновить таблицу лидеров"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-amber-400' : ''}`} />
            </button>
            <button
              onClick={() => {
                triggerHaptic('light');
                onClose();
              }}
              className="w-8 h-8 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-100 flex items-center justify-center text-xs font-bold transition-colors active:scale-95"
            >
              ✕
            </button>
          </div>
        </div>

        {/* User's Position Banner */}
        <div className="bg-gradient-to-r from-emerald-950/40 via-[#141b24] to-slate-900/60 border-b border-slate-800/80 px-4 py-2.5 flex items-center justify-between text-xs shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center font-black text-[11px] text-emerald-400 font-mono-numbers">
              {effectiveRank ? `#${effectiveRank}` : '—'}
            </div>
            <div>
              <span className="text-slate-400 text-[10px]">Ваш ранг: </span>
              <span className="font-bold text-emerald-300">
                {effectiveRank
                  ? effectiveRank === 1
                    ? '🥇 1 место (Лидер сети!)'
                    : effectiveRank === 2
                    ? '🥈 2 место (Вице-чемпион)'
                    : effectiveRank === 3
                    ? '🥉 3 место (Бронза)'
                    : `#${effectiveRank} из ${totalPlayers}`
                  : 'Синхронизация...'}
              </span>
            </div>
          </div>
          <div className="text-right">
            <span className="text-slate-400 text-[10px] block">Ваш баланс:</span>
            <span className="font-extrabold text-emerald-400 font-mono-numbers text-xs sm:text-sm">
              {currentBalance.toLocaleString('ru-RU')} ₽
            </span>
          </div>
        </div>

        {/* Scrollable Container */}
        <div className="p-3 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {/* Top 3 Podium Cards */}
          {players.length >= 3 && !searchQuery && filterMode === 'all' && (
            <div className="grid grid-cols-3 gap-2 sm:gap-3 pt-2 pb-1 items-end">
              {/* 2nd Place */}
              {top2 && (
                <div className="bg-gradient-to-b from-slate-800/60 to-slate-900/90 border border-slate-700/60 rounded-2xl p-2.5 sm:p-3 flex flex-col items-center text-center relative shadow-lg">
                  <div className="absolute -top-3 w-6 h-6 rounded-full bg-slate-700 border-2 border-slate-500 flex items-center justify-center text-xs shadow">
                    🥈
                  </div>
                  <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-slate-800 border-2 border-slate-500/70 overflow-hidden flex items-center justify-center mt-1 text-slate-200 font-black text-sm">
                    {top2.photoUrl ? (
                      <img src={top2.photoUrl} alt={top2.name} className="w-full h-full object-cover" />
                    ) : (
                      top2.name.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="mt-1.5 font-bold text-[11px] sm:text-xs text-slate-200 truncate max-w-full">
                    {top2.name}
                  </div>
                  {top2.username && (
                    <div className="text-[9px] text-slate-400 truncate max-w-full font-mono">
                      @{top2.username}
                    </div>
                  )}
                  <div className="mt-1 text-[11px] sm:text-xs font-black text-slate-200 font-mono-numbers">
                    {top2.balance.toLocaleString('ru-RU')} ₽
                  </div>
                  <span className="text-[9px] text-slate-400 font-mono mt-0.5">Ур. {top2.level}</span>
                </div>
              )}

              {/* 1st Place (Crown Champion) */}
              {top1 && (
                <div className="bg-gradient-to-b from-amber-950/40 via-[#181d28] to-slate-900/95 border-2 border-amber-500/60 rounded-2xl p-2.5 sm:p-3.5 flex flex-col items-center text-center relative shadow-xl shadow-amber-500/10 scale-105 z-10">
                  <div className="absolute -top-4 w-8 h-8 rounded-full bg-gradient-to-tr from-amber-500 to-yellow-300 border-2 border-yellow-200 flex items-center justify-center text-sm shadow-md shadow-amber-500/40">
                    <Crown className="w-4 h-4 text-slate-950 fill-slate-950" />
                  </div>
                  <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-amber-950/80 border-2 border-amber-400 overflow-hidden flex items-center justify-center mt-1 text-amber-300 font-black text-base shadow-inner">
                    {top1.photoUrl ? (
                      <img src={top1.photoUrl} alt={top1.name} className="w-full h-full object-cover" />
                    ) : (
                      top1.name.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="mt-1.5 font-black text-xs sm:text-sm text-amber-300 truncate max-w-full">
                    {top1.name}
                  </div>
                  {top1.username && (
                    <div className="text-[10px] text-amber-400/80 truncate max-w-full font-mono font-bold">
                      @{top1.username}
                    </div>
                  )}
                  <div className="mt-1 text-xs sm:text-sm font-black text-amber-400 font-mono-numbers drop-shadow-sm">
                    {top1.balance.toLocaleString('ru-RU')} ₽
                  </div>
                  <span className="text-[9px] text-amber-300/80 font-mono font-bold mt-0.5">
                    Ур. {top1.level} • 👑 Чемпион
                  </span>
                </div>
              )}

              {/* 3rd Place */}
              {top3 && (
                <div className="bg-gradient-to-b from-amber-950/30 to-slate-900/90 border border-amber-800/50 rounded-2xl p-2.5 sm:p-3 flex flex-col items-center text-center relative shadow-lg">
                  <div className="absolute -top-3 w-6 h-6 rounded-full bg-amber-800 border-2 border-amber-600 flex items-center justify-center text-xs shadow">
                    🥉
                  </div>
                  <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-slate-800 border-2 border-amber-700/70 overflow-hidden flex items-center justify-center mt-1 text-amber-200 font-black text-sm">
                    {top3.photoUrl ? (
                      <img src={top3.photoUrl} alt={top3.name} className="w-full h-full object-cover" />
                    ) : (
                      top3.name.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="mt-1.5 font-bold text-[11px] sm:text-xs text-slate-200 truncate max-w-full">
                    {top3.name}
                  </div>
                  {top3.username && (
                    <div className="text-[9px] text-slate-400 truncate max-w-full font-mono">
                      @{top3.username}
                    </div>
                  )}
                  <div className="mt-1 text-[11px] sm:text-xs font-black text-amber-200 font-mono-numbers">
                    {top3.balance.toLocaleString('ru-RU')} ₽
                  </div>
                  <span className="text-[9px] text-slate-400 font-mono mt-0.5">Ур. {top3.level}</span>
                </div>
              )}
            </div>
          )}

          {/* Filter Bar & Search */}
          <div className="flex flex-col sm:flex-row gap-2 items-center justify-between">
            {/* Filter buttons */}
            <div className="flex items-center gap-1 bg-[#131722] p-1 rounded-xl border border-slate-800 w-full sm:w-auto">
              <button
                onClick={() => {
                  triggerHaptic('selection');
                  setFilterMode('all');
                }}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all flex-1 sm:flex-initial ${
                  filterMode === 'all'
                    ? 'bg-emerald-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Все ({players.length})
              </button>
              <button
                onClick={() => {
                  triggerHaptic('selection');
                  setFilterMode('top10');
                }}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all flex-1 sm:flex-initial ${
                  filterMode === 'top10'
                    ? 'bg-emerald-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Топ 10
              </button>
              <button
                onClick={() => {
                  triggerHaptic('selection');
                  setFilterMode('rareHolders');
                }}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all flex-1 sm:flex-initial ${
                  filterMode === 'rareHolders'
                    ? 'bg-emerald-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                💎 С редкими номерами
              </button>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-48">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Поиск по нику или номеру..."
                className="w-full bg-[#131722] border border-slate-800 rounded-xl pl-8 pr-2.5 py-1 text-[11px] text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500/60"
              />
            </div>
          </div>

          {/* Leaderboard Table / Cards */}
          <div className="space-y-1.5">
            {loading ? (
              <div className="text-center py-10 space-y-2">
                <RefreshCw className="w-6 h-6 animate-spin text-emerald-400 mx-auto" />
                <p className="text-xs text-slate-400">Загрузка рейтинга игроков...</p>
              </div>
            ) : filteredPlayers.length === 0 ? (
              <div className="text-center py-10 bg-[#12151d] rounded-2xl border border-slate-800 p-6">
                <p className="text-xs text-slate-400">Игроки по запросу не найдены.</p>
              </div>
            ) : (
              filteredPlayers.map(player => {
                const isCurrent =
                  player.isCurrentUser || String(player.userId) === String(currentUser.id);
                const rarityCfg = player.bestCardRarity
                  ? RARITY_CONFIGS[player.bestCardRarity]
                  : null;

                return (
                  <div
                    key={player.userId}
                    className={`flex items-center justify-between p-2.5 sm:p-3 rounded-2xl border transition-all ${
                      isCurrent
                        ? 'bg-emerald-950/30 border-emerald-500/60 shadow-lg shadow-emerald-500/5 ring-1 ring-emerald-500/40'
                        : player.rank === 1
                        ? 'bg-[#181d28] border-amber-500/40'
                        : player.rank === 2
                        ? 'bg-[#141822] border-slate-700/60'
                        : player.rank === 3
                        ? 'bg-[#141720] border-amber-800/40'
                        : 'bg-[#12151e]/80 border-slate-800/60 hover:border-slate-700/80'
                    }`}
                  >
                    {/* Left: Rank & Avatar & User Info */}
                    <div className="flex items-center gap-2.5 min-w-0">
                      {/* Rank badge */}
                      <div className="w-7 text-center shrink-0">
                        {player.rank === 1 ? (
                          <span className="text-base">🥇</span>
                        ) : player.rank === 2 ? (
                          <span className="text-base">🥈</span>
                        ) : player.rank === 3 ? (
                          <span className="text-base">🥉</span>
                        ) : (
                          <span className="font-mono-numbers text-xs font-bold text-slate-400">
                            #{player.rank}
                          </span>
                        )}
                      </div>

                      {/* Avatar */}
                      <div className="relative shrink-0">
                        <div
                          className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl overflow-hidden flex items-center justify-center font-bold text-xs sm:text-sm ${
                            isCurrent
                              ? 'bg-emerald-900 border border-emerald-400 text-emerald-200'
                              : player.rank <= 3
                              ? 'bg-slate-800 border border-amber-500/50 text-amber-200'
                              : 'bg-slate-800/80 border border-slate-700 text-slate-300'
                          }`}
                        >
                          {player.photoUrl ? (
                            <img
                              src={player.photoUrl}
                              alt={player.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            player.name.charAt(0).toUpperCase()
                          )}
                        </div>
                        {isCurrent && (
                          <span className="absolute -bottom-1 -right-1 bg-emerald-500 text-slate-950 font-black text-[8px] px-1 rounded-full uppercase">
                            Вы
                          </span>
                        )}
                      </div>

                      {/* Info */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs sm:text-sm font-bold text-slate-100 truncate">
                            {player.name}
                          </span>
                          {player.isTelegram && (
                            <span
                              className="text-[9px] bg-sky-950/80 border border-sky-500/30 text-sky-400 px-1 rounded"
                              title="Подтвержденный Telegram игрок"
                            >
                              TG
                            </span>
                          )}
                          <span className="text-[9px] bg-slate-800 text-slate-400 px-1 rounded font-mono">
                            ур. {player.level}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-400 truncate">
                          {player.username && (
                            <span className="font-mono text-slate-400">@{player.username}</span>
                          )}
                          {player.cardsCount > 0 && (
                            <span className="hidden xs:inline text-slate-500">
                              • {player.cardsCount} SIM
                            </span>
                          )}
                          {player.bestCardNumber && (
                            <span
                              className={`truncate font-mono font-semibold ${
                                rarityCfg ? rarityCfg.textColor : 'text-slate-400'
                              }`}
                            >
                              • {player.bestCardNumber}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: Balance */}
                    <div className="text-right shrink-0 pl-2">
                      <div
                        className={`text-xs sm:text-sm font-black font-mono-numbers ${
                          isCurrent
                            ? 'text-emerald-400'
                            : player.rank === 1
                            ? 'text-amber-400'
                            : player.rank <= 3
                            ? 'text-amber-200'
                            : 'text-slate-200'
                        }`}
                      >
                        {player.balance.toLocaleString('ru-RU')} ₽
                      </div>
                      {player.bestCardTitle && (
                        <div className="text-[9px] text-slate-500 truncate max-w-[110px] sm:max-w-[140px]">
                          {player.bestCardTitle}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Footer info & Play Call To Action */}
        <div className="px-4 py-3 bg-[#11141c] border-t border-slate-800/80 flex items-center justify-between gap-3 shrink-0">
          <div className="text-[11px] text-slate-400">
            <span className="text-slate-300 font-bold">Как подняться в топе?</span> Крутите рулетку,
            накапливайте редкие SIM-карты с высокой рентой и торгуйте на P2P бирже!
          </div>
          {onNavigateToSpin && (
            <button
              onClick={() => {
                triggerHaptic('light');
                sound.playClick();
                onClose();
                onNavigateToSpin();
              }}
              className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 active:scale-95 text-slate-950 font-black px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-md shadow-emerald-500/20 shrink-0"
            >
              <Zap className="w-3.5 h-3.5 fill-slate-950" />
              <span>Играть</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
