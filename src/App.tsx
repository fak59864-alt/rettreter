import React, { useState, useEffect } from 'react';
import {
  PhoneNumberCard,
  PlayerUpgrades,
  PlayerStats,
  TelegramUserData,
} from './types/game';
import { initTelegramWebApp, triggerHaptic } from './utils/telegram';
import { sound } from './utils/audio';
import { calculateCoinsPerSec, calculateOfflineEarnings } from './utils/afkFarm';
import { Header } from './components/Header';
import { GachaWheel } from './components/GachaWheel';
import { CollectionTab } from './components/CollectionTab';
import { ClickerTab } from './components/ClickerTab';
import { UpgradesTab } from './components/UpgradesTab';
import { CasinoTab } from './components/CasinoTab';
import { TradeTab } from './components/TradeTab';
import { OfflineRewardModal } from './components/OfflineRewardModal';
import { BotAutoSetupModal } from './components/BotAutoSetupModal';
import { StatsModal } from './components/StatsModal';
import {
  Sparkles,
  MousePointerClick,
  Dices,
  BookmarkPlus,
  Gift,
  TrendingUp,
} from 'lucide-react';

const INITIAL_BALANCE = 2500; // 2 500 ₽ (сбалансированный хардкорный старт)

const INITIAL_UPGRADES: PlayerUpgrades = {
  // Gacha Upgrades
  luckLevel: 0,
  discountLevel: 0,
  cashbackLevel: 0,
  inventoryCapLevel: 0,
  pityGuaranteedLevel: 0,

  // Phone Numbers Passive Rent Upgrades
  numberRentMultiplierLevel: 0,
  roamingLevel: 0,
  simPoolLevel: 0,
  jackpotRadarLevel: 0,

  // Clicker Tap Upgrades
  clickPowerLevel: 0,
  clickCritChanceLevel: 0,
  clickCritMultLevel: 0,
  autoClickerLevel: 0,

  // Prestige
  prestigeLevel: 0,
};

const INITIAL_STATS: PlayerStats = {
  totalSpins: 0,
  totalSpent: 0,
  totalEarned: 0,
  totalAfkEarned: 0,
  totalCasinoEarned: 0,
  totalClickerEarned: 0,
  totalClicks: 0,
  totalTrades: 0,
  highestPayout: 0,
  highestCard: null,
  countsByRarity: {
    common: 0,
    uncommon: 0,
    rare: 0,
    epic: 0,
    legendary: 0,
    mythic: 0,
  },
  lastActiveTimestamp: Date.now(),
};

type ActiveTab = 'spin' | 'clicker' | 'casino' | 'collection' | 'trade' | 'shop';

export default function App() {
  const [userData, setUserData] = useState<TelegramUserData>({
    id: 7770001,
    first_name: 'Игрок',
    username: 'lucky_sim',
    isLinkedToTelegram: false,
  });

  const [activeTab, setActiveTab] = useState<ActiveTab>('spin');
  const [balance, setBalance] = useState<number>(INITIAL_BALANCE);
  const [collection, setCollection] = useState<PhoneNumberCard[]>([]);
  const [upgrades, setUpgrades] = useState<PlayerUpgrades>(INITIAL_UPGRADES);
  const [stats, setStats] = useState<PlayerStats>(INITIAL_STATS);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  // Offline earnings modal state
  const [offlineReward, setOfflineReward] = useState<{ secondsOffline: number; earned: number } | null>(null);

  // Modals
  const [showDocsModal, setShowDocsModal] = useState<boolean>(false);
  const [showStatsModal, setShowStatsModal] = useState<boolean>(false);

  // Calculate coins per second from collection and rent upgrades
  const coinsPerSec = calculateCoinsPerSec(collection, upgrades);

  // Initialize Telegram WebApp & Load user-scoped data
  useEffect(() => {
    const user = initTelegramWebApp();
    setUserData(user);
    setIsMuted(sound.getMuted());

    // Check query params if opened with deep-link
    const urlParams = new URLSearchParams(window.location.search);
    const rawTabParam = urlParams.get('tab');
    if (rawTabParam && ['spin', 'clicker', 'casino', 'collection', 'trade', 'shop'].includes(rawTabParam)) {
      setActiveTab(rawTabParam as ActiveTab);
    }
    if (urlParams.get('trade') || urlParams.get('gift')) {
      setActiveTab('trade');
    }

    try {
      // Load user-scoped state
      const savedBalance = localStorage.getItem(`sim_gacha_${user.id}_balance`);
      if (savedBalance !== null) setBalance(Number(savedBalance));

      let loadedCollection: PhoneNumberCard[] = [];
      const savedCollection = localStorage.getItem(`sim_gacha_${user.id}_collection`);
      if (savedCollection) {
        loadedCollection = JSON.parse(savedCollection);
        setCollection(loadedCollection);
      }

      let loadedUpgrades = INITIAL_UPGRADES;
      const savedUpgrades = localStorage.getItem(`sim_gacha_${user.id}_upgrades`);
      if (savedUpgrades) {
        loadedUpgrades = { ...INITIAL_UPGRADES, ...JSON.parse(savedUpgrades) };
        setUpgrades(loadedUpgrades);
      }

      const savedStats = localStorage.getItem(`sim_gacha_${user.id}_stats`);
      if (savedStats) setStats(prev => ({ ...prev, ...JSON.parse(savedStats) }));

      // Check Offline Passive Earnings from Phone Numbers Collection
      const lastActive = localStorage.getItem(`sim_gacha_${user.id}_last_active`);
      if (lastActive) {
        const secPerSec = calculateCoinsPerSec(loadedCollection, loadedUpgrades);
        const offline = calculateOfflineEarnings(Number(lastActive), secPerSec);
        if (offline.earned >= 25) {
          setOfflineReward(offline);
        }
      }
    } catch {
      // Ignored
    }
  }, []);

  // Dynamic values
  const maxInventory = 20 + upgrades.inventoryCapLevel * 10;
  const playerXP =
    stats.totalSpins * 15 +
    collection.length * 10 +
    Math.floor((stats.totalAfkEarned || 0) / 200) +
    Math.floor((stats.totalClickerEarned || 0) / 300) +
    (stats.totalCasinoEarned ? Math.floor(stats.totalCasinoEarned / 500) : 0);
  const playerLevel = Math.max(1, Math.floor(playerXP / 100) + 1);
  const xpProgress = playerXP % 100;

  // Sync to server for Telegram user and Live Leaderboard
  const syncWithServer = (
    currentBalance: number,
    currentCollection: PhoneNumberCard[],
    currentUpgrades: PlayerUpgrades,
    customStats?: PlayerStats
  ) => {
    if (!userData.id) return;
    const st = customStats || stats;
    try {
      fetch('/api/user/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userData.id,
          username: userData.username,
          firstName: userData.first_name,
          photoUrl: userData.photo_url,
          balance: currentBalance,
          level: playerLevel,
          collection: currentCollection,
          upgrades: currentUpgrades,
          highestCard: st.highestCard,
          totalSpins: st.totalSpins,
          isTelegram: Boolean(userData.isLinkedToTelegram),
        }),
      }).catch(() => {});
    } catch {
      // ignore
    }
  };

  // Live phone numbers passive income interval (every second)
  useEffect(() => {
    if (coinsPerSec <= 0) return;
    const interval = setInterval(() => {
      setBalance(prev => {
        const next = prev + coinsPerSec;
        localStorage.setItem(`sim_gacha_${userData.id}_balance`, String(next));
        return next;
      });
      setStats(prev => ({
        ...prev,
        totalAfkEarned: (prev.totalAfkEarned || 0) + coinsPerSec,
      }));
    }, 1000);
    return () => clearInterval(interval);
  }, [coinsPerSec, userData.id]);

  // Keep lastActive timestamp updated in localStorage
  useEffect(() => {
    const saveActiveTimer = setInterval(() => {
      localStorage.setItem(`sim_gacha_${userData.id}_last_active`, String(Date.now()));
    }, 3000);
    return () => clearInterval(saveActiveTimer);
  }, [userData.id]);

  // Periodic Leaderboard sync (every 8 seconds) so balance updates live in the top
  useEffect(() => {
    const syncTimer = setInterval(() => {
      syncWithServer(balance, collection, upgrades, stats);
    }, 8000);
    return () => clearInterval(syncTimer);
  }, [balance, collection, upgrades, stats, userData.id]);

  // Save changes to Telegram user scoped localStorage
  useEffect(() => {
    localStorage.setItem(`sim_gacha_${userData.id}_balance`, String(balance));
  }, [balance, userData.id]);

  useEffect(() => {
    localStorage.setItem(`sim_gacha_${userData.id}_collection`, JSON.stringify(collection));
    syncWithServer(balance, collection, upgrades, stats);
  }, [collection, userData.id]);

  useEffect(() => {
    localStorage.setItem(`sim_gacha_${userData.id}_upgrades`, JSON.stringify(upgrades));
  }, [upgrades, userData.id]);

  useEffect(() => {
    localStorage.setItem(`sim_gacha_${userData.id}_stats`, JSON.stringify(stats));
  }, [stats, userData.id]);

  // Handlers
  const handleSpinSuccess = (cards: PhoneNumberCard[], cost: number) => {
    setBalance(prev => Math.max(0, prev - cost));

    setStats(prev => {
      let maxPayout = prev.highestPayout;
      let highestCard = prev.highestCard;
      const counts = { ...prev.countsByRarity };

      cards.forEach(c => {
        counts[c.rarity] = (counts[c.rarity] || 0) + 1;
        if (c.sellPrice > maxPayout) {
          maxPayout = c.sellPrice;
          highestCard = c;
        }
      });

      return {
        ...prev,
        totalSpins: prev.totalSpins + cards.length,
        totalSpent: prev.totalSpent + cost,
        highestPayout: maxPayout,
        highestCard,
        countsByRarity: counts,
      };
    });
  };

  const handleSellCard = (card: PhoneNumberCard) => {
    setBalance(prev => prev + card.sellPrice);
    setCollection(prev => prev.filter(c => c.id !== card.id));
    setStats(prev => ({
      ...prev,
      totalEarned: prev.totalEarned + card.sellPrice,
    }));
  };

  const handleSellMultipleCards = (cards: PhoneNumberCard[]) => {
    const sum = cards.reduce((acc, c) => acc + c.sellPrice, 0);
    const idsToRemove = new Set(cards.map(c => c.id));
    setBalance(prev => prev + sum);
    setCollection(prev => prev.filter(c => !idsToRemove.has(c.id)));
    setStats(prev => ({
      ...prev,
      totalEarned: prev.totalEarned + sum,
    }));
  };

  const handleAddToCollection = (card: PhoneNumberCard) => {
    if (collection.length >= maxInventory) return;
    setCollection(prev => [card, ...prev]);
  };

  const handleAddMultipleToCollection = (cards: PhoneNumberCard[]) => {
    const available = maxInventory - collection.length;
    if (available <= 0) return;
    const toAdd = cards.slice(0, available);
    setCollection(prev => [...toAdd, ...prev]);
  };

  const handleSellAllCommons = () => {
    const commons = collection.filter(c => c.rarity === 'common' && !c.isFavorite);
    if (commons.length === 0) return;
    const earned = commons.reduce((sum, c) => sum + c.sellPrice, 0);
    setBalance(prev => prev + earned);
    setCollection(prev => prev.filter(c => c.rarity !== 'common' || c.isFavorite));
    setStats(prev => ({
      ...prev,
      totalEarned: prev.totalEarned + earned,
    }));
  };

  const handleToggleFavorite = (id: string) => {
    triggerHaptic('light');
    setCollection(prev =>
      prev.map(c => (c.id === id ? { ...c, isFavorite: !c.isFavorite } : c))
    );
  };

  const handleBuyUpgrade = (key: keyof PlayerUpgrades, cost: number) => {
    if (balance < cost) return;
    setBalance(prev => prev - cost);
    setUpgrades(prev => ({
      ...prev,
      [key]: (prev[key] || 0) + 1,
    }));
  };

  const handleClaimBonus = (amount: number) => {
    setBalance(prev => prev + amount);
    setStats(prev => ({
      ...prev,
      claimedDailyBonusAt: Date.now(),
      totalEarned: prev.totalEarned + amount,
    }));
  };

  const handlePrestigeReset = () => {
    const nextPrestige = (upgrades.prestigeLevel || 0) + 1;
    const cleanUpgrades: PlayerUpgrades = {
      ...INITIAL_UPGRADES,
      prestigeLevel: nextPrestige,
    };

    // 1. Reset all upgrades back to initial state, keeping only new prestige rank
    setUpgrades(cleanUpgrades);

    // 2. Reset balance back to initial starting balance (2,500 ₽)
    setBalance(INITIAL_BALANCE);

    // 3. Reset entire SIM card collection to empty
    setCollection([]);

    // 4. Force save the reset immediately to user storage
    if (userData.id) {
      localStorage.setItem(`sim_gacha_${userData.id}_balance`, String(INITIAL_BALANCE));
      localStorage.setItem(`sim_gacha_${userData.id}_collection`, JSON.stringify([]));
      localStorage.setItem(`sim_gacha_${userData.id}_upgrades`, JSON.stringify(cleanUpgrades));
      localStorage.setItem(`sim_gacha_${userData.id}_last_active`, String(Date.now()));
    }

    triggerHaptic('success');
    sound.playWinLegendary();
  };

  const handleUpdateBalance = (delta: number) => {
    setBalance(prev => Math.max(0, prev + delta));
  };

  const handleRecordCasinoWin = (amount: number) => {
    setStats(prev => ({
      ...prev,
      totalCasinoEarned: (prev.totalCasinoEarned || 0) + amount,
    }));
  };

  const handleRecordClick = (earned: number) => {
    setStats(prev => ({
      ...prev,
      totalClickerEarned: (prev.totalClickerEarned || 0) + earned,
      totalClicks: (prev.totalClicks || 0) + 1,
    }));
  };

  const handleClaimOffline = () => {
    if (!offlineReward) return;
    setBalance(prev => prev + offlineReward.earned);
    setStats(prev => ({
      ...prev,
      totalAfkEarned: (prev.totalAfkEarned || 0) + offlineReward.earned,
    }));
    setOfflineReward(null);
  };

  const handleToggleMute = () => {
    const nextMuted = sound.toggleMute();
    setIsMuted(nextMuted);
  };

  return (
    <div className="min-h-screen bg-[#0d0f12] text-slate-100 flex flex-col justify-between selection:bg-emerald-500/30 selection:text-emerald-300">
      {/* Mobile-First Header Bar */}
      <Header
        user={userData}
        balance={balance}
        luckLevel={upgrades.luckLevel}
        level={playerLevel}
        xpProgress={xpProgress}
        coinsPerSec={coinsPerSec}
        isMuted={isMuted}
        onToggleMute={handleToggleMute}
        onOpenStats={() => setShowStatsModal(true)}
        onOpenShop={() => setActiveTab('shop')}
      />

      {/* Main Content Viewport */}
      <main className="flex-1 max-w-md sm:max-w-xl w-full mx-auto px-3.5 pt-3 pb-24">
        {/* Requirement: Keep GachaWheel mounted so its state (spin results, reel, settings) is preserved across tab switching */}
        <div className={activeTab === 'spin' ? 'block' : 'hidden'}>
          <GachaWheel
            balance={balance}
            luckLevel={upgrades.luckLevel}
            discountLevel={upgrades.discountLevel}
            cashbackLevel={upgrades.cashbackLevel}
            prestigeLevel={upgrades.prestigeLevel}
            jackpotRadarLevel={upgrades.jackpotRadarLevel}
            inventoryCount={collection.length}
            maxInventory={maxInventory}
            onSpinSuccess={handleSpinSuccess}
            onSellCard={handleSellCard}
            onSellMultipleCards={handleSellMultipleCards}
            onAddToCollection={handleAddToCollection}
            onAddMultipleToCollection={handleAddMultipleToCollection}
          />
        </div>

        {activeTab === 'clicker' && (
          <ClickerTab
            balance={balance}
            upgrades={upgrades}
            onUpdateBalance={handleUpdateBalance}
            onBuyUpgrade={handleBuyUpgrade}
            onRecordClick={handleRecordClick}
          />
        )}

        {activeTab === 'casino' && (
          <CasinoTab
            balance={balance}
            onUpdateBalance={handleUpdateBalance}
            onRecordCasinoWin={handleRecordCasinoWin}
          />
        )}

        {activeTab === 'collection' && (
          <CollectionTab
            collection={collection}
            maxInventory={maxInventory}
            onSellCard={handleSellCard}
            onSellAllCommons={handleSellAllCommons}
            onToggleFavorite={handleToggleFavorite}
            onGoToSpin={() => setActiveTab('spin')}
          />
        )}

        {activeTab === 'trade' && (
          <TradeTab
            balance={balance}
            collection={collection}
            userId={userData.id}
            userName={userData.first_name}
            maxInventory={maxInventory}
            onUpdateBalance={handleUpdateBalance}
            onAddCardToCollection={handleAddToCollection}
            onRemoveCardFromCollection={(cardId: string) =>
              setCollection(prev => prev.filter(c => c.id !== cardId))
            }
          />
        )}

        {activeTab === 'shop' && (
          <UpgradesTab
            balance={balance}
            collection={collection}
            upgrades={upgrades}
            lastClaimedBonusAt={stats.claimedDailyBonusAt}
            onBuyUpgrade={handleBuyUpgrade}
            onClaimBonus={handleClaimBonus}
            onPrestigeReset={handlePrestigeReset}
          />
        )}
      </main>

      {/* Fixed Bottom Mobile Tab Bar (6 Tabs) */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#0d0f12]/95 backdrop-blur-md border-t border-slate-800/90 pb-safe">
        <div className="max-w-md mx-auto grid grid-cols-6 h-16 items-center px-1">
          {/* Tab 1: Spin (Номера) */}
          <button
            onClick={() => {
              triggerHaptic('selection');
              sound.playClick();
              setActiveTab('spin');
            }}
            className={`flex flex-col items-center justify-center h-full transition-colors active:scale-95 ${
              activeTab === 'spin' ? 'text-emerald-400 font-extrabold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-4 h-4 mb-1" />
            <span className="text-[9px] tracking-tight">Номера</span>
          </button>

          {/* Tab 2: Clicker (Кликер) */}
          <button
            onClick={() => {
              triggerHaptic('selection');
              sound.playClick();
              setActiveTab('clicker');
            }}
            className={`flex flex-col items-center justify-center h-full transition-colors active:scale-95 ${
              activeTab === 'clicker' ? 'text-emerald-400 font-extrabold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <MousePointerClick className="w-4 h-4 mb-1 text-emerald-400" />
            <span className="text-[9px] tracking-tight">Кликер</span>
          </button>

          {/* Tab 3: Casino (Казино с 21) */}
          <button
            onClick={() => {
              triggerHaptic('selection');
              sound.playClick();
              setActiveTab('casino');
            }}
            className={`flex flex-col items-center justify-center h-full transition-colors active:scale-95 ${
              activeTab === 'casino' ? 'text-emerald-400 font-extrabold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Dices className="w-4 h-4 mb-1 text-amber-400" />
            <span className="text-[9px] tracking-tight">Казино</span>
          </button>

          {/* Tab 4: Collection (Коллекция) */}
          <button
            onClick={() => {
              triggerHaptic('selection');
              sound.playClick();
              setActiveTab('collection');
            }}
            className={`flex flex-col items-center justify-center h-full relative transition-colors active:scale-95 ${
              activeTab === 'collection' ? 'text-emerald-400 font-extrabold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className="relative">
              <BookmarkPlus className="w-4 h-4 mb-1 text-sky-400" />
              {collection.length > 0 && (
                <span className="absolute -top-1 -right-2 bg-emerald-500 text-slate-950 text-[8px] font-black px-1 rounded-full font-mono-numbers">
                  {collection.length}
                </span>
              )}
            </div>
            <span className="text-[9px] tracking-tight">Коллекция</span>
          </button>

          {/* Tab 5: Trade (Подарить / Принять) */}
          <button
            onClick={() => {
              triggerHaptic('selection');
              sound.playClick();
              setActiveTab('trade');
            }}
            className={`flex flex-col items-center justify-center h-full transition-colors active:scale-95 ${
              activeTab === 'trade' ? 'text-emerald-400 font-extrabold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Gift className="w-4 h-4 mb-1 text-rose-400" />
            <span className="text-[9px] tracking-tight">Подарить</span>
          </button>

          {/* Tab 6: Upgrades (Прокачка) */}
          <button
            onClick={() => {
              triggerHaptic('selection');
              sound.playClick();
              setActiveTab('shop');
            }}
            className={`flex flex-col items-center justify-center h-full transition-colors active:scale-95 ${
              activeTab === 'shop' ? 'text-emerald-400 font-extrabold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className="relative">
              <TrendingUp className="w-4 h-4 mb-1 text-purple-400" />
              {coinsPerSec > 0 && (
                <div className="absolute -top-0.5 -right-1 w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              )}
            </div>
            <span className="text-[9px] tracking-tight">Прокачка</span>
          </button>
        </div>
      </nav>

      {/* Offline Earnings Reward Modal */}
      {offlineReward && (
        <OfflineRewardModal
          secondsOffline={offlineReward.secondsOffline}
          earnedAmount={offlineReward.earned}
          onClaim={handleClaimOffline}
        />
      )}

      {/* Stats & Profile Modal */}
      {showStatsModal && (
        <StatsModal
          stats={stats}
          balance={balance}
          onClose={() => setShowStatsModal(false)}
          onOpenAdminSetup={() => setShowDocsModal(true)}
        />
      )}

      {/* Admin Bot Config Modal */}
      {showDocsModal && (
        <BotAutoSetupModal onClose={() => setShowDocsModal(false)} userId={userData.id} />
      )}
    </div>
  );
}
