import React, { useState, useEffect } from 'react';
import { PhoneNumberCard, MarketListing, DirectTradeOffer } from '../types/game';
import { SimCardView } from './SimCardView';
import { sound } from '../utils/audio';
import { triggerHaptic } from '../utils/telegram';
import {
  ArrowLeftRight,
  ShoppingBag,
  PlusCircle,
  Copy,
  Check,
  Tag,
  Search,
  KeyRound,
  ShieldCheck,
  Trash2,
  Gift,
} from 'lucide-react';

interface TradeTabProps {
  balance: number;
  collection: PhoneNumberCard[];
  userId: number;
  userName: string;
  maxInventory: number;
  onUpdateBalance: (delta: number) => void;
  onAddCardToCollection: (card: PhoneNumberCard) => void;
  onRemoveCardFromCollection: (cardId: string) => void;
}

// Initial community market listings for realistic P2P trading environment
const DEFAULT_MARKET_LISTINGS: MarketListing[] = [
  {
    id: 'mkt_1',
    sellerId: 10001,
    sellerName: 'CryptoWhale',
    price: 55000,
    createdAt: Date.now() - 3600000,
    card: {
      id: 'sim_mkt_1',
      fullNumber: '+7 (999) 777-77-77',
      tailFormatted: '777-77-77',
      rawTail: '7777777',
      operatorCode: '999',
      operatorName: 'Т-Мобайл',
      rarity: 'legendary',
      multiplier: 60,
      sellPrice: 60000,
      spinCost: 1000,
      tags: ['VIP: Три топора 777-77-77', 'Абсолютная удача'],
      createdAt: Date.now() - 7200000,
      isFavorite: true,
    },
  },
  {
    id: 'mkt_2',
    sellerId: 10002,
    sellerName: 'SimTrader_Pro',
    price: 26000,
    createdAt: Date.now() - 1800000,
    card: {
      id: 'sim_mkt_2',
      fullNumber: '+7 (916) 123-45-67',
      tailFormatted: '123-45-67',
      rawTail: '1234567',
      operatorCode: '916',
      operatorName: 'МТС',
      rarity: 'legendary',
      multiplier: 30,
      sellPrice: 30000,
      spinCost: 1000,
      tags: ['Лесенка 7 цифр (123-45-67)', 'Королевский флеш'],
      createdAt: Date.now() - 3600000,
    },
  },
  {
    id: 'mkt_3',
    sellerId: 10003,
    sellerName: 'GoldHunter',
    price: 8500,
    createdAt: Date.now() - 900000,
    card: {
      id: 'sim_mkt_3',
      fullNumber: '+7 (926) 712-42-17',
      tailFormatted: '712-42-17',
      rawTail: '7124217',
      operatorCode: '926',
      operatorName: 'МегаФон',
      rarity: 'epic',
      multiplier: 10,
      sellPrice: 10000,
      spinCost: 1000,
      tags: ['Палиндром 7 цифр (Зеркало)', 'Золотой номер'],
      createdAt: Date.now() - 1800000,
    },
  },
];

export const TradeTab: React.FC<TradeTabProps> = ({
  balance,
  collection,
  userId,
  userName,
  maxInventory,
  onUpdateBalance,
  onAddCardToCollection,
  onRemoveCardFromCollection,
}) => {
  const [subTab, setSubTab] = useState<'market' | 'direct'>('market');
  const [marketListings, setMarketListings] = useState<MarketListing[]>(DEFAULT_MARKET_LISTINGS);
  const [marketViewFilter, setMarketViewFilter] = useState<'all' | 'my'>('all');
  const [searchFilter, setSearchFilter] = useState('');

  // Sell modal state
  const [showSellModal, setShowSellModal] = useState(false);
  const [selectedCardForSale, setSelectedCardForSale] = useState<PhoneNumberCard | null>(null);
  const [customPrice, setCustomPrice] = useState<string>('5000');

  // Direct trade state
  const [inputTradeCode, setInputTradeCode] = useState('');
  const [activeDirectOffers, setActiveDirectOffers] = useState<Record<string, DirectTradeOffer>>({});
  const [createdOfferCode, setCreatedOfferCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [tradeMessage, setTradeMessage] = useState<string | null>(null);

  // Load market & trade offers from localStorage
  useEffect(() => {
    try {
      const savedMkt = localStorage.getItem('sim_gacha_p2p_market');
      if (savedMkt) {
        setMarketListings(JSON.parse(savedMkt));
      }
      const savedDirect = localStorage.getItem('sim_gacha_direct_offers');
      if (savedDirect) {
        setActiveDirectOffers(JSON.parse(savedDirect));
      }
    } catch {
      // ignore
    }
  }, []);

  const saveMarket = (newList: MarketListing[]) => {
    setMarketListings(newList);
    localStorage.setItem('sim_gacha_p2p_market', JSON.stringify(newList));
  };

  const saveDirectOffers = (newOffers: Record<string, DirectTradeOffer>) => {
    setActiveDirectOffers(newOffers);
    localStorage.setItem('sim_gacha_direct_offers', JSON.stringify(newOffers));
  };

  // 1. Buy from market
  const handleBuyFromMarket = (listing: MarketListing) => {
    if (balance < listing.price) {
      triggerHaptic('error');
      setTradeMessage('Недостаточно средств для покупки!');
      setTimeout(() => setTradeMessage(null), 2500);
      return;
    }
    if (collection.length >= maxInventory) {
      triggerHaptic('error');
      setTradeMessage('Инвентарь переполнен! Улучшите слоты.');
      setTimeout(() => setTradeMessage(null), 2500);
      return;
    }

    onUpdateBalance(-listing.price);
    onAddCardToCollection(listing.card);

    const updated = marketListings.filter(l => l.id !== listing.id);
    saveMarket(updated);

    triggerHaptic('success');
    sound.playCoin();
    setTradeMessage(`Вы приобрели номер ${listing.card.fullNumber}!`);
    setTimeout(() => setTradeMessage(null), 3000);
  };

  // 2. Post SIM to market
  const handleListOnMarket = () => {
    if (!selectedCardForSale) return;
    const priceNum = Math.max(100, Number(customPrice) || 100);

    const newListing: MarketListing = {
      id: `mkt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      sellerId: userId,
      sellerName: userName || 'Коллекционер',
      price: priceNum,
      createdAt: Date.now(),
      card: selectedCardForSale,
    };

    onRemoveCardFromCollection(selectedCardForSale.id);
    saveMarket([newListing, ...marketListings]);

    setShowSellModal(false);
    setSelectedCardForSale(null);
    triggerHaptic('success');
    sound.playClick();
    setTradeMessage('Номер выставлен на P2P-биржу!');
    setTimeout(() => setTradeMessage(null), 2500);
  };

  // Cancel own listing from market
  const handleCancelListing = (listing: MarketListing) => {
    if (collection.length >= maxInventory) {
      triggerHaptic('warning');
      setTradeMessage('Инвентарь переполнен! Невозможно вернуть SIM в коллекцию.');
      setTimeout(() => setTradeMessage(null), 3000);
      return;
    }

    const updated = marketListings.filter(l => l.id !== listing.id);
    saveMarket(updated);
    onAddCardToCollection(listing.card);

    triggerHaptic('success');
    sound.playClick();
    setTradeMessage(`Объявление снято! Номер ${listing.card.fullNumber} возвращён в коллекцию.`);
    setTimeout(() => setTradeMessage(null), 3500);
  };

  // 3. Create Direct Trade Code
  const handleCreateDirectTrade = (card: PhoneNumberCard) => {
    const code = `SIM-${Math.floor(100 + Math.random() * 900)}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;

    const offer: DirectTradeOffer = {
      code,
      senderId: userId,
      senderName: userName || 'Игрок',
      offeredCards: [card],
      requestedPrice: 0, // gift or exchange
      createdAt: Date.now(),
      expiresAt: Date.now() + 86400000, // 24 hours
    };

    const newOffers = { ...activeDirectOffers, [code]: offer };
    saveDirectOffers(newOffers);

    onRemoveCardFromCollection(card.id);
    setCreatedOfferCode(code);
    triggerHaptic('success');
    sound.playClick();
  };

  // 4. Accept Direct Trade by Code
  const handleAcceptDirectTrade = () => {
    const cleanCode = inputTradeCode.trim().toUpperCase();
    const offer = activeDirectOffers[cleanCode];

    if (!offer) {
      triggerHaptic('error');
      setTradeMessage('Предложение с таким кодом не найдено или истекло!');
      setTimeout(() => setTradeMessage(null), 3000);
      return;
    }

    if (collection.length >= maxInventory) {
      triggerHaptic('error');
      setTradeMessage('Ваш инвентарь переполнен!');
      setTimeout(() => setTradeMessage(null), 2500);
      return;
    }

    // Add cards to collection
    offer.offeredCards.forEach(c => onAddCardToCollection(c));

    // Remove trade offer
    const updated = { ...activeDirectOffers };
    delete updated[cleanCode];
    saveDirectOffers(updated);

    setInputTradeCode('');
    triggerHaptic('success');
    sound.playWinRare();
    setTradeMessage(`Успешный обмен! Получен номер ${offer.offeredCards[0]?.fullNumber}!`);
    setTimeout(() => setTradeMessage(null), 3500);
  };

  const myListingsCount = marketListings.filter(l => l.sellerId === userId).length;

  const filteredMarket = marketListings.filter(l => {
    if (marketViewFilter === 'my' && l.sellerId !== userId) return false;
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase();
    return (
      l.card.fullNumber.includes(q) ||
      l.card.operatorName.toLowerCase().includes(q) ||
      l.sellerName.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4 pb-12 max-w-md sm:max-w-xl mx-auto">
      {/* Tab Switcher */}
      <div className="grid grid-cols-2 p-1 bg-[#12151c] rounded-2xl border border-slate-800">
        <button
          onClick={() => {
            triggerHaptic('selection');
            sound.playClick();
            setSubTab('direct');
          }}
          className={`py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
            subTab === 'direct'
              ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Gift className="w-3.5 h-3.5" />
          <span>Принять / Подарить</span>
        </button>

        <button
          onClick={() => {
            triggerHaptic('selection');
            sound.playClick();
            setSubTab('market');
          }}
          className={`py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
            subTab === 'market'
              ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <ShoppingBag className="w-3.5 h-3.5" />
          <span>P2P Биржа ({marketListings.length})</span>
        </button>
      </div>

      {/* Status Alert Toast */}
      {tradeMessage && (
        <div className="text-center text-xs font-bold text-emerald-300 bg-emerald-950/40 border border-emerald-500/30 py-2.5 px-3 rounded-xl animate-in fade-in">
          {tradeMessage}
        </div>
      )}

      {/* ================================================================== */}
      {/* 1. MARKETPLACE */}
      {/* ================================================================== */}
      {subTab === 'market' && (
        <div className="space-y-3">
          {/* Header Action: Sell SIM button & Search */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Поиск по цифрам или оператору..."
                value={searchFilter}
                onChange={e => setSearchFilter(e.target.value)}
                className="w-full bg-[#141822] border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 outline-none"
              />
            </div>

            <button
              onClick={() => {
                if (collection.length === 0) {
                  setTradeMessage('У вас нет SIM-карт в коллекции для продажи!');
                  setTimeout(() => setTradeMessage(null), 2500);
                  return;
                }
                setShowSellModal(true);
              }}
              className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-sm active:scale-95 transition-all shrink-0"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Продать SIM</span>
            </button>
          </div>

          {/* Market View Filter */}
          <div className="flex items-center justify-between gap-2 pt-0.5">
            <div className="flex p-1 bg-[#10131b] rounded-xl border border-slate-800 text-[11px] font-bold">
              <button
                onClick={() => {
                  triggerHaptic('selection');
                  setMarketViewFilter('all');
                }}
                className={`px-3 py-1 rounded-lg transition-all ${
                  marketViewFilter === 'all'
                    ? 'bg-slate-800 text-emerald-400 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Все лоты ({marketListings.length})
              </button>
              <button
                onClick={() => {
                  triggerHaptic('selection');
                  setMarketViewFilter('my');
                }}
                className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1 ${
                  marketViewFilter === 'my'
                    ? 'bg-slate-800 text-amber-300 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>Мои объявления</span>
                {myListingsCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300 text-[9px] font-mono">
                    {myListingsCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Listings */}
          {filteredMarket.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500 bg-[#141822] border border-slate-800 rounded-2xl">
              {marketViewFilter === 'my'
                ? 'У вас пока нет активных объявлений на бирже.'
                : 'На бирже пока нет подходящих предложений.'}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredMarket.map(item => (
                <div
                  key={item.id}
                  className="bg-[#141822] border border-slate-800/90 rounded-2xl p-3.5 space-y-2.5 shadow-sm"
                >
                  <div className="flex items-center justify-between text-xs text-slate-400 pb-1 border-b border-slate-800/60">
                    <div className="flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="font-semibold text-slate-300">{item.sellerName}</span>
                    </div>
                    <span className="font-mono text-[10px]">P2P Offer</span>
                  </div>

                  <SimCardView card={item.card} isCompact />

                  <div className="flex items-center justify-between pt-1">
                    <div>
                      <div className="text-[10px] text-slate-400">Цена продавца:</div>
                      <div className="text-sm font-black text-emerald-400 font-mono-numbers">
                        {item.price.toLocaleString('ru-RU')} ₽
                      </div>
                    </div>

                    {item.sellerId === userId ? (
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-amber-300 font-bold bg-amber-500/15 border border-amber-500/30 px-2 py-1 rounded-lg">
                          Ваш лот
                        </span>
                        <button
                          onClick={() => handleCancelListing(item)}
                          className="px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 font-bold text-xs flex items-center gap-1 active:scale-95 transition-all shadow-sm"
                          title="Снять это объявление с биржи и вернуть SIM в коллекцию"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Снять объявление</span>
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleBuyFromMarket(item)}
                        disabled={balance < item.price}
                        className={`px-4 py-2 rounded-xl font-bold text-xs active:scale-95 transition-all ${
                          balance >= item.price
                            ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-sm'
                            : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                        }`}
                      >
                        Купить номер
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ================================================================== */}
      {/* 2. DIRECT TRADE BY CODE */}
      {/* ================================================================== */}
      {subTab === 'direct' && (
        <div className="space-y-4">
          {/* Enter Code Box */}
          <div className="bg-[#141822] border border-slate-800 rounded-2xl p-4 space-y-3 shadow-sm">
            <div className="flex items-center gap-2">
              <Gift className="w-4 h-4 text-emerald-400" />
              <span className="font-bold text-xs text-slate-200">Принять подарок от друга:</span>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Введите код (например: SIM-777-XYZ)"
                value={inputTradeCode}
                onChange={e => setInputTradeCode(e.target.value)}
                className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 font-mono uppercase outline-none"
              />
              <button
                onClick={handleAcceptDirectTrade}
                disabled={!inputTradeCode.trim()}
                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs active:scale-95 transition-all shrink-0 flex items-center gap-1.5"
              >
                <Gift className="w-3.5 h-3.5" />
                <span>Принять</span>
              </button>
            </div>
          </div>

          {/* Create Direct Offer */}
          <div className="bg-[#141822] border border-slate-800 rounded-2xl p-4 space-y-3 shadow-sm">
            <div className="font-bold text-xs text-slate-200 flex items-center justify-between">
              <span>Подарить SIM-карту другу:</span>
              <span className="text-[10px] text-slate-400">Выберите номер из коллекции</span>
            </div>

            {createdOfferCode && (
              <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/40 space-y-2 animate-in fade-in">
                <div className="text-[11px] text-emerald-300 font-semibold flex items-center gap-1.5">
                  <Gift className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Подарочный код сгенерирован:</span>
                </div>
                <div className="flex items-center justify-between bg-[#0b0e14] p-2 rounded-lg font-mono text-xs text-emerald-400 font-bold">
                  <span>{createdOfferCode}</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(createdOfferCode);
                      setCopied(true);
                      triggerHaptic('success');
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className="p-1 text-slate-300 hover:text-emerald-400"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[10px] text-slate-400">
                  Отправьте этот код другу в Telegram, чтобы подарить ему эту SIM-карту!
                </p>
              </div>
            )}

            {collection.length === 0 ? (
              <p className="text-xs text-slate-500 py-3 text-center">
                В вашей коллекции пока нет номеров для подарка.
              </p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {collection.map(c => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs"
                  >
                    <div>
                      <div className="font-bold text-slate-200 font-mono-numbers">{c.fullNumber}</div>
                      <div className="text-[10px] text-slate-400">{c.operatorName} · {c.rarity}</div>
                    </div>
                    <button
                      onClick={() => handleCreateDirectTrade(c)}
                      className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 font-bold text-[11px] active:scale-95 transition-all flex items-center gap-1"
                    >
                      <Gift className="w-3 h-3" />
                      <span>Подарить</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal: Post SIM on Market */}
      {showSellModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#141722] border border-slate-800 rounded-3xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="font-bold text-sm text-slate-100">Выставить SIM на биржу</span>
              <button
                onClick={() => setShowSellModal(false)}
                className="text-slate-400 hover:text-slate-100 text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 font-medium block mb-1">
                  1. Выберите номер из коллекции:
                </label>
                <select
                  onChange={e => {
                    const found = collection.find(c => c.id === e.target.value);
                    if (found) {
                      setSelectedCardForSale(found);
                      setCustomPrice(String(found.sellPrice));
                    }
                  }}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none"
                >
                  <option value="">-- Выбрать SIM-карту --</option>
                  {collection.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.fullNumber} ({c.rarity})
                    </option>
                  ))}
                </select>
              </div>

              {selectedCardForSale && (
                <div>
                  <label className="text-xs text-slate-400 font-medium block mb-1">
                    2. Ваша цена продажи (₽):
                  </label>
                  <input
                    type="number"
                    min="100"
                    value={customPrice}
                    onChange={e => setCustomPrice(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 font-mono-numbers outline-none font-bold"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">
                    Базовая цена выкупа: {selectedCardForSale.sellPrice.toLocaleString()} ₽
                  </span>
                </div>
              )}

              <button
                onClick={handleListOnMarket}
                disabled={!selectedCardForSale}
                className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs disabled:bg-slate-800 disabled:text-slate-500 active:scale-95 transition-all shadow-md"
              >
                Опубликовать на бирже
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
