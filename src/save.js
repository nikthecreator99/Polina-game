const KEY = 'ngGame.save.v1';

const DEFAULTS = {
  coins: 0,
  outfit: 'sundress',
  owned: ['sundress'],
  unlocked: 1, // сколько уровней открыто
  best: {}, // levelId -> лучший результат по монеткам
};

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = { ...DEFAULTS, ...JSON.parse(raw) };
      // старое название первого наряда
      s.owned = [...new Set(s.owned.map((o) => (o === 'starter' ? 'sundress' : o)))];
      if (s.outfit === 'starter') s.outfit = 'sundress';
      return s;
    }
  } catch (e) { /* приватный режим и т.п. */ }
  return { ...DEFAULTS };
}

export const save = load();

export function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) { /* ignore */ }
}
