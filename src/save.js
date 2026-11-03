const KEY = 'ngGame.save.v1';

const DEFAULTS = {
  coins: 0,
  outfit: 'starter',
  owned: ['starter'],
  unlocked: 1, // сколько уровней открыто
  best: {}, // levelId -> лучший результат по монеткам
};

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch (e) { /* приватный режим и т.п. */ }
  return { ...DEFAULTS };
}

export const save = load();

export function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) { /* ignore */ }
}
