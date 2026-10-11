import React, { useState, useMemo } from 'react';
import { PhoneNumberCard, RarityTier } from '../types/game';
import { RARITY_CONFIGS } from '../utils/rarityConfig';
import { BASE_NUMBER_INCOME } from '../utils/afkFarm';
import { SimCardView } from './SimCardView';
import { Search, Trash2, ArrowUpDown, ShieldAlert, Sparkles, Filter, Zap } from 'lucide-react';
import { triggerHaptic } from '../utils/telegram';
import { sound } from '../utils/audio';

interface CollectionTabProps {
  collection: PhoneNumberCard[];
  maxInventory: number;
  onSellCard: (card: PhoneNumberCard) => void;
  onSellAllCommons: () => void;
  onToggleFavorite: (id: string) => void;
  onGoToSpin: () => void;
}

export const CollectionTab: React.FC<CollectionTabProps> = ({
  collection,
  maxInventory,
  onSellCard,
  onSellAllCommons,
  onToggleFavorite,
  onGoToSpin,
}) => {
  const [selectedRarity, setSelectedRarity] = useState<RarityTier | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'price_desc' | 'rarity_desc'>('newest');

  // Filtered & sorted collection
  const filteredList = useMemo(() => {
    return collection
      .filter(card => {
        if (selectedRarity !== 'all' && card.rarity !== selectedRarity) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchNumber = card.fullNumber.toLowerCase().includes(q) || card.rawTail.includes(q);
          const matchOperator = card.operatorName.toLowerCase().includes(q);
          const matchTags = card.tags.some(t => t.toLowerCase().includes(q));
          return matchNumber || matchOperator || matchTags;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'newest') return b.createdAt - a.createdAt;
        if (sortBy === 'price_desc') return b.sellPrice - a.sellPrice;
        if (sortBy === 'rarity_desc') {
          const rarityRank: Record<RarityTier, number> = {
            mythic: 6,
            legendary: 5,
            epic: 4,
            rare: 3,
            uncommon: 2,
            common: 1,
          };
          return rarityRank[b.rarity] - rarityRank[a.rarity];
        }
        return 0;
      });
  }, [collection, selectedRarity, searchQuery, sortBy]);

  // Aggregate stats
  const totalValue = useMemo(() => {
    return collection.reduce((acc, c) => acc + c.sellPrice, 0);
  }, [collection]);

  const collectionIncome = useMemo(() => {
    return collection.reduce((acc, c) => {
      const base = BASE_NUMBER_INCOME[c.rarity] || 0.2;
      const countryMult = c.countryIncomeMultiplier || 1.0;
      return acc + (c.isFavorite ? base * countryMult * 1.25 : base * countryMult);
    }, 0);
  }, [collection]);

  const commonCount = useMemo(() => {
    return collection.filter(c => c.rarity === 'common' && !c.isFavorite).length;
  }, [collection]);

  const rarityTabs: { id: RarityTier | 'all'; label: string }[] = [
    { id: 'all', label: 'Все' },
    { id: 'mythic', label: 'Миф' },
    { id: 'legendary', label: 'VIP' },
    { id: 'epic', label: 'Золото' },
    { id: 'rare', label: 'Серебро' },
    { id: 'uncommon', label: 'Бронза' },
    { id: 'common', label: 'Обычные' },
  ];

  return (
    <div className="space-y-4 pb-12">
      {/* Top Banner: Inventory Stats, Income & Total Worth */}
      <div className="bg-[#14171f] border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
        <div>
          <div className="text-xs text-slate-400 font-medium">Суммарная оценка коллекции</div>
          <div className="text-xl sm:text-2xl font-extrabold text-emerald-400 font-mono-numbers">
            {totalValue.toLocaleString('ru-RU')} ₽
          </div>
          {collection.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-300 mt-1">
              <Zap className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400 animate-pulse" />
              <span>Доход номеров: +{collectionIncome >= 10 ? Math.round(collectionIncome) : collectionIncome.toFixed(1)} ₽/сек</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl text-xs">
            <span className="text-slate-400">Слоты: </span>
            <span className="font-bold text-slate-200 font-mono-numbers">
              {collection.length} / {maxInventory}
            </span>
          </div>

          {commonCount > 0 && (
            <button
              onClick={() => {
                triggerHaptic('medium');
                sound.playCoin();
                onSellAllCommons();
              }}
              className="px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-xs font-semibold flex items-center gap-1.5 active:scale-95 transition-all"
              title="Продать все обычные незаблокированные номера"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Продать Common ({commonCount})</span>
            </button>
          )}
        </div>
      </div>

      {/* Search and Sort Toolbar */}
      <div className="flex flex-col sm:flex-row gap-2">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Поиск по цифрам, оператору или тегам..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-[#12151c] border border-slate-800 focus:border-emerald-500/60 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 outline-none transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs"
            >
              ✕
            </button>
          )}
        </div>

        {/* Sort Selector */}
        <div className="flex items-center gap-1 bg-[#12151c] border border-slate-800 rounded-xl px-2 py-1 shrink-0">
          <ArrowUpDown className="w-3.5 h-3.5 text-slate-500 ml-1" />
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as 'newest' | 'price_desc' | 'rarity_desc')}
            className="bg-transparent text-xs text-slate-300 outline-none pr-1 cursor-pointer font-medium"
          >
            <option value="newest" className="bg-[#14171f]">Сначала новые</option>
            <option value="price_desc" className="bg-[#14171f]">Сначала дорогие</option>
            <option value="rarity_desc" className="bg-[#14171f]">По редкости</option>
          </select>
        </div>
      </div>

      {/* Rarity Filter Tabs (Interactive segmented buttons) */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {rarityTabs.map(tab => {
          const isActive = selectedRarity === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                triggerHaptic('selection');
                sound.playClick();
                setSelectedRarity(tab.id);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition-all ${
                isActive
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'bg-[#12151c] border border-slate-800/80 text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Collection Grid or Empty State */}
      {filteredList.length === 0 ? (
        <div className="bg-[#14171e] border border-slate-800/80 rounded-2xl p-8 text-center space-y-3 my-4">
          <div className="w-12 h-12 rounded-2xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-center mx-auto text-emerald-400">
            <Sparkles className="w-6 h-6" />
          </div>
          <div className="text-sm font-bold text-slate-200">
            {collection.length === 0 ? 'Коллекция пуста' : 'Ничего не найдено'}
          </div>
          <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
            {collection.length === 0
              ? 'Вы ещё не сохранили ни одного красивого номера. Крутите барабан в разделе «Номера» и добавляйте ценные SIM-карты в коллекцию!'
              : 'Попробуйте изменить поисковый запрос или фильтр по редкости.'}
          </p>
          {collection.length === 0 && (
            <button
              onClick={() => {
                triggerHaptic('medium');
                sound.playClick();
                onGoToSpin();
              }}
              className="mt-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-md transition-all active:scale-95"
            >
              Перейти к рулетке
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {filteredList.map(card => (
            <SimCardView
              key={card.id}
              card={card}
              isCompact
              isActionable
              onToggleFavorite={onToggleFavorite}
              onSell={onSellCard}
            />
          ))}
        </div>
      )}
    </div>
  );
};
