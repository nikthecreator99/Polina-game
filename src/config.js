// Всё, что зависит от неё, собрано здесь, чтобы потом легко поменять.
export const CONFIG = {
  // Две строки заголовка в главном меню: «Приключения» + имя в родительном падеже.
  titleTop: 'Приключения',
  titleName: 'Полины',
  // Что она бросает (подпись и цвет снаряда).
  projectile: { name: 'камень', color: '#9a948c', outline: '#5f5a54' },
  coinName: 'монетки',
  startLives: 5,
};

// Возрастные стадии: меняют рост персонажа.
export const AGES = {
  child: { label: 'Детство', scale: 0.85 },
  teen: { label: 'Подросток', scale: 0.92 },
  adult: { label: 'Взрослая', scale: 1 },
};

// Наряды. Картинки: img/polina/front-<id>.webp (спереди) и side-<id>.png (сбоку, для игры).
// top/shoes — цвета для запасной нарисованной кодом Полины.
export const OUTFITS = {
  sundress: { name: 'Летний сарафан', price: 0, top: '#f2c14e', shoes: '#c0392b', note: 'В нём она бегала по Зелёному' },
  pajamas: { name: 'Пижамка', price: 15, top: '#f4f1ea', shoes: '#ffffff', note: 'Жёлтые штанишки с игрушками' },
  blue: { name: 'Голубое платье', price: 25, top: '#b9cdf0', shoes: '#c0392b', note: 'Атласное, на день рождения' },
  yolochka: { name: 'Новогодняя ёлочка', price: 40, top: '#f7f2ea', shoes: '#f3eee6', note: 'Костюм с утренника' },
};
export const DEFAULT_OUTFIT = 'sundress';
