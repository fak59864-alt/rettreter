import { PhoneNumberCard, RarityTier } from '../types/game';
import { OPERATORS, RARITY_CONFIGS } from './rarityConfig';

interface AnalysisResult {
  rarity: RarityTier;
  multiplier: number;
  tags: string[];
}

// Analyze any 7-digit tail string (e.g. "7777777") or 10-digit number with operatorCode
export function analyzeTail(tail: string, operatorCode?: string): AnalysisResult {
  const tags: string[] = [];
  
  // 0. Mythic check: 9 or 10 identical digits in the entire number (+7 (XXX) XXX-XX-XX)
  const fullSeq = (operatorCode || '') + tail;
  if (fullSeq.length >= 7) {
    const fullCounts: Record<string, number> = {};
    for (const ch of fullSeq) {
      if (ch >= '0' && ch <= '9') {
        fullCounts[ch] = (fullCounts[ch] || 0) + 1;
      }
    }
    const maxIdenticalInFull = Math.max(...Object.values(fullCounts), 0);
    if (maxIdenticalInFull >= 9) {
      const dominant = Object.entries(fullCounts).find(([_, c]) => c >= 9)?.[0] || '9';
      const isAll10 = maxIdenticalInFull >= 10;
      tags.push(
        isAll10
          ? `Священный Грааль: Все 10 цифр (${dominant})`
          : `Мифический: 9 одинаковых цифр (${dominant})`,
        'Абсолютный раритет (Mythic)'
      );
      return {
        rarity: 'mythic',
        multiplier: isAll10 ? 500 : 250,
        tags,
      };
    }
  }

  const digits = tail.split('').map(Number);
  
  // 1. Check identical digits count
  const digitCounts: Record<string, number> = {};
  for (const d of digits) {
    digitCounts[d] = (digitCounts[d] || 0) + 1;
  }
  const maxIdentical = Math.max(...Object.values(digitCounts));
  const countsArr = Object.values(digitCounts).sort((a, b) => b - a);

  // Check 7 identical (e.g., 777-77-77)
  if (maxIdentical === 7) {
    const d = digits[0];
    if (d === 7) {
      tags.push('VIP: Три топора 777-77-77', 'Абсолютная удача');
      return { rarity: 'legendary', multiplier: 60, tags };
    }
    tags.push(`Супер-VIP: Все ${d}`, 'Абсолют');
    return { rarity: 'legendary', multiplier: 50, tags };
  }

  // Check 6 identical
  if (maxIdentical === 6) {
    tags.push('Шесть одинаковых цифр', 'VIP Эксклюзив');
    return { rarity: 'legendary', multiplier: 38, tags };
  }

  // Check 5 identical
  if (maxIdentical === 5) {
    tags.push('Пять одинаковых цифр', 'VIP Премиум');
    return { rarity: 'legendary', multiplier: 25, tags };
  }

  // Check round hundreds/thousands (000-00-XX, XX0-00-00, 000-XX-00)
  const isRoundHundreds =
    tail.startsWith('00000') ||
    tail.endsWith('00000') ||
    (tail.startsWith('000') && tail.endsWith('00')) ||
    (tail.slice(0, 3) === '000' && tail.slice(5) === '00');
  if (isRoundHundreds) {
    tags.push('Круглые сотни', 'VIP Нули');
    return { rarity: 'legendary', multiplier: 22, tags };
  }

  // Check 7-digit ladder ascending (e.g. 1234567, 2345678, 3456789)
  const isAscending7 = digits.every((d, i) => i === 0 || d === (digits[i - 1] + 1) % 10);
  if (isAscending7) {
    tags.push('Лесенка 7 цифр (123-45-67)', 'Королевский флеш');
    return { rarity: 'legendary', multiplier: 30, tags };
  }

  // Check 7-digit ladder descending (e.g. 7654321, 9876543)
  const isDescending7 = digits.every((d, i) => i === 0 || d === (digits[i - 1] - 1 + 10) % 10);
  if (isDescending7) {
    tags.push('Обратная лесенка 7 цифр', 'Королевский флеш');
    return { rarity: 'legendary', multiplier: 28, tags };
  }

  // Check 7-digit Palindrome (e.g. 1234321)
  const isPalindrome7 = tail === tail.split('').reverse().join('');
  if (isPalindrome7) {
    tags.push('Палиндром 7 цифр (Зеркало)', 'Золотой номер');
    return { rarity: 'epic', multiplier: 10, tags };
  }

  // Check consecutive 4 or 3 identical in a row
  let maxConsecutive = 1;
  let currentConsecutive = 1;
  let consecutiveDigit = digits[0];
  for (let i = 1; i < digits.length; i++) {
    if (digits[i] === digits[i - 1]) {
      currentConsecutive++;
      if (currentConsecutive > maxConsecutive) {
        maxConsecutive = currentConsecutive;
        consecutiveDigit = digits[i];
      }
    } else {
      currentConsecutive = 1;
    }
  }

  if (maxConsecutive === 4) {
    tags.push(`Каре: четыре ${consecutiveDigit} подряд`, 'Золотой триплет');
    return { rarity: 'epic', multiplier: 8.5, tags };
  }

  if (maxConsecutive === 3) {
    if (consecutiveDigit === 7) {
      tags.push('Три топора (777)', 'Счастливый триплет');
      return { rarity: 'epic', multiplier: 7.5, tags };
    }
    if (consecutiveDigit === 0) {
      tags.push('Три нуля (000)', 'Чистый номер');
      return { rarity: 'epic', multiplier: 6.5, tags };
    }
    tags.push(`Триплет: три ${consecutiveDigit}`, 'Счастливый триплет');
    return { rarity: 'epic', multiplier: 5.5, tags };
  }

  // Check 5 or 6 digit ladder sub-sequences
  const tailHasLadder5 =
    tail.includes('12345') ||
    tail.includes('23456') ||
    tail.includes('34567') ||
    tail.includes('45678') ||
    tail.includes('56789') ||
    tail.includes('54321') ||
    tail.includes('65432') ||
    tail.includes('76543') ||
    tail.includes('87654') ||
    tail.includes('98765');
  if (tailHasLadder5) {
    tags.push('Лесенка из 5 цифр', 'Серебряный');
    return { rarity: 'rare', multiplier: 2.2, tags };
  }

  // Check 5-digit palindrome in tail (e.g. 12321, 78987)
  const isPalindrome5 =
    tail.slice(0, 5) === tail.slice(0, 5).split('').reverse().join('') ||
    tail.slice(1, 6) === tail.slice(1, 6).split('').reverse().join('') ||
    tail.slice(2, 7) === tail.slice(2, 7).split('').reverse().join('');
  if (isPalindrome5) {
    tags.push('Палиндром x5', 'Серебряное зеркало');
    return { rarity: 'rare', multiplier: 1.9, tags };
  }

  // Check repetitive blocks e.g. AB-AB-AB (e.g. 12-12-12-X or X-12-12-12)
  const p1 = tail.slice(0, 2);
  const p2 = tail.slice(2, 4);
  const p3 = tail.slice(4, 6);
  if ((p1 === p2 && p2 === p3) || (tail.slice(1, 3) === tail.slice(3, 5) && tail.slice(3, 5) === tail.slice(5, 7))) {
    tags.push('Тройной повтор пар (AB-AB-AB)', 'Ритмичный');
    return { rarity: 'rare', multiplier: 2.0, tags };
  }

  // 4-digit ladder
  const tailHasLadder4 =
    tail.includes('1234') ||
    tail.includes('2345') ||
    tail.includes('3456') ||
    tail.includes('4567') ||
    tail.includes('5678') ||
    tail.includes('6789') ||
    tail.includes('4321') ||
    tail.includes('5432') ||
    tail.includes('6543') ||
    tail.includes('7654') ||
    tail.includes('8765') ||
    tail.includes('9876');
  if (tailHasLadder4) {
    tags.push('Лесенка x4 (12-34)', 'Серебряный');
    return { rarity: 'rare', multiplier: 1.4, tags };
  }

  // Check two pairs (e.g., 12-33-44 or 11-22-XX)
  const pairCounts = countsArr.filter(c => c >= 2).length;
  if (pairCounts >= 2) {
    tags.push('Две пары цифр', 'Бронзовый');
    return { rarity: 'uncommon', multiplier: 0.60, tags };
  }

  // Check mirror ending (e.g., 12-34-43)
  if (tail[3] === tail[6] && tail[4] === tail[5]) {
    tags.push('Зеркальное окончание', 'Бронзовый');
    return { rarity: 'uncommon', multiplier: 0.50, tags };
  }

  if (tail[5] === tail[6]) {
    tags.push('Пара в конце (XX)', 'Бронзовый');
    return { rarity: 'uncommon', multiplier: 0.40, tags };
  }

  // Common: standard random (selling yields heavy loss)
  const randomMult = +(0.05 + Math.random() * 0.12).toFixed(2);
  tags.push('Обычный набор', 'Без выраженного паттерна');
  return { rarity: 'common', multiplier: randomMult, tags };
}

// Generate tail matching target rarity
function generateTailForRarity(rarity: RarityTier, operatorCode?: string): string {
  const randDigit = () => Math.floor(Math.random() * 10);

  if (rarity === 'mythic') {
    // 9 or 10 identical digits in the full number
    // Determine dominant digit based on operator if available
    let d = 9;
    if (operatorCode === '777' || operatorCode === '977') {
      d = 7;
    } else if (operatorCode === '999' || operatorCode === '995') {
      d = 9;
    } else {
      d = Math.random() < 0.5 ? 9 : 7;
    }

    const roll = Math.random();
    if (roll < 0.35) {
      // 10 identical digits if operator matches (or 7 identical in tail)
      return `${d}${d}${d}${d}${d}${d}${d}`;
    } else {
      // Exactly 9 identical digits across operator + tail
      const diffDigit = (d + 1 + Math.floor(Math.random() * 8)) % 10;
      const pos = Math.floor(Math.random() * 7);
      const arr = [d, d, d, d, d, d, d];
      arr[pos] = diffDigit;
      return arr.join('');
    }
  }

  if (rarity === 'legendary') {
    const roll = Math.random();
    if (roll < 0.25) {
      const d = Math.random() < 0.4 ? 7 : randDigit();
      return `${d}${d}${d}${d}${d}${d}${d}`;
    } else if (roll < 0.5) {
      const d = Math.random() < 0.4 ? 7 : randDigit();
      const other = (d + 1 + Math.floor(Math.random() * 8)) % 10;
      return Math.random() < 0.5 ? `${other}${d}${d}${d}${d}${d}${d}` : `${d}${d}${d}${d}${d}${d}${other}`;
    } else if (roll < 0.75) {
      const r1 = randDigit();
      const r2 = randDigit();
      return `00000${r1}${r2}`;
    } else {
      return Math.random() < 0.5 ? '1234567' : '9876543';
    }
  }

  if (rarity === 'epic') {
    const roll = Math.random();
    if (roll < 0.35) {
      const a = randDigit();
      const b = randDigit();
      const c = randDigit();
      const d = randDigit();
      return `${a}${b}${c}${d}${c}${b}${a}`;
    } else if (roll < 0.7) {
      const d = Math.random() < 0.4 ? 7 : randDigit();
      const p1 = `${randDigit()}${randDigit()}`;
      const p2 = `${randDigit()}`;
      return `${d}${d}${d}${d}${p1}${p2}`;
    } else {
      const d = 7;
      return Math.random() < 0.5 ? `${d}${d}${d}${randDigit()}${randDigit()}${randDigit()}${randDigit()}` : `${randDigit()}${randDigit()}${randDigit()}${randDigit()}${d}${d}${d}`;
    }
  }

  if (rarity === 'rare') {
    const roll = Math.random();
    if (roll < 0.5) {
      const ladders = ['12345', '23456', '34567', '45678', '56789', '98765', '76543'];
      const chosen = ladders[Math.floor(Math.random() * ladders.length)];
      return Math.random() < 0.5 ? `${chosen}${randDigit()}${randDigit()}` : `${randDigit()}${randDigit()}${chosen}`;
    } else {
      const a = randDigit();
      const b = randDigit();
      return `${a}${b}${a}${b}${a}${b}${randDigit()}`;
    }
  }

  if (rarity === 'uncommon') {
    const a = randDigit();
    const b = randDigit();
    const c = randDigit();
    const d = (c + 1) % 10;
    return `${a}${b}${c}${c}${d}${d}${randDigit()}`;
  }

  // Common: purely random digits avoiding obvious patterns
  let res = '';
  for (let i = 0; i < 7; i++) {
    res += randDigit();
  }
  return res;
}

export function formatTail(tail: string): string {
  const clean = tail.replace(/\D/g, '').padEnd(7, '0').slice(0, 7);
  return `${clean.slice(0, 3)}-${clean.slice(3, 5)}-${clean.slice(5, 7)}`;
}

export function formatFullPhoneNumber(operatorCode: string, tail: string): string {
  return `+7 (${operatorCode}) ${formatTail(tail)}`;
}

// Roll a single phone number with balanced base chances and potent luck scaling
export function rollPhoneNumber(
  baseSpinCost: number,
  luckLevel: number = 0,
  cashbackLevel: number = 0,
  prestigeLevel: number = 0,
  forceRarity?: RarityTier,
  jackpotRadarLevel: number = 0
): PhoneNumberCard {
  let targetRarity: RarityTier = 'common';
  if (forceRarity) {
    targetRarity = forceRarity;
  } else {
    // Powerful, noticeable luck scaling per user request
    const effectiveLuck = luckLevel + jackpotRadarLevel * 0.75;
    const mythicChance = 0.002 + effectiveLuck * 0.006 + prestigeLevel * 0.012;
    const legendaryChance = 0.05 + effectiveLuck * 0.07 + prestigeLevel * 0.12;
    const epicChance = 0.85 + effectiveLuck * 0.38 + prestigeLevel * 0.60;
    const rareChance = 3.50 + effectiveLuck * 0.80 + prestigeLevel * 1.20;
    const uncommonChance = 12.00 + effectiveLuck * 1.40 + prestigeLevel * 1.50;

    const roll = Math.random() * 100;
    if (roll < mythicChance) {
      targetRarity = 'mythic';
    } else if (roll < mythicChance + legendaryChance) {
      targetRarity = 'legendary';
    } else if (roll < mythicChance + legendaryChance + epicChance) {
      targetRarity = 'epic';
    } else if (roll < mythicChance + legendaryChance + epicChance + rareChance) {
      targetRarity = 'rare';
    } else if (roll < mythicChance + legendaryChance + epicChance + rareChance + uncommonChance) {
      targetRarity = 'uncommon';
    } else {
      targetRarity = 'common';
    }
  }

  let operator = OPERATORS[Math.floor(Math.random() * OPERATORS.length)];
  if (targetRarity === 'mythic') {
    const mythicOps = OPERATORS.filter(o => o.code === '999' || o.code === '777' || o.code === '977');
    operator = mythicOps[Math.floor(Math.random() * mythicOps.length)] || OPERATORS[0];
  }

  const rawTail = generateTailForRarity(targetRarity, operator.code);
  const analysis = analyzeTail(rawTail, operator.code);

  const finalRarity = analysis.rarity;
  const config = RARITY_CONFIGS[finalRarity];

  let multiplier = analysis.multiplier;
  if (!multiplier) {
    const range = config.maxMultiplier - config.minMultiplier;
    multiplier = +(config.minMultiplier + Math.random() * range).toFixed(2);
  }

  const cashbackBonus = cashbackLevel * 0.02; // +2% per level (rebalanced)
  const baseSell = Math.round(baseSpinCost * multiplier);
  const finalSellPrice = Math.round(baseSell * (1 + cashbackBonus));

  const tailFormatted = formatTail(rawTail);
  const fullNumber = formatFullPhoneNumber(operator.code, rawTail);

  return {
    id: `sim_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    fullNumber,
    tailFormatted,
    rawTail,
    operatorCode: operator.code,
    operatorName: operator.name,
    rarity: finalRarity,
    multiplier,
    sellPrice: finalSellPrice,
    spinCost: baseSpinCost,
    tags: analysis.tags,
    createdAt: Date.now(),
  };
}

// Roll multiple phone numbers simultaneously
export function rollMultiplePhoneNumbers(
  count: number,
  costPerCard: number,
  luckLevel: number = 0,
  cashbackLevel: number = 0,
  prestigeLevel: number = 0,
  jackpotRadarLevel: number = 0
): PhoneNumberCard[] {
  const cards: PhoneNumberCard[] = [];
  for (let i = 0; i < count; i++) {
    cards.push(rollPhoneNumber(costPerCard, luckLevel, cashbackLevel, prestigeLevel, undefined, jackpotRadarLevel));
  }
  return cards;
}
