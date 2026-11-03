// Уровни задаются ASCII-картой. Одна клетка = 48 px.
//   #  земля            =  платформа         B  ящик (ломается броском)
//   o  монетка          ~  лужа (минус жизнь) E  гусь (ходит туда-сюда)
//   C  контрольная точка F  финиш             P  старт
// Пустые строки сверху дают место для прыжков.

export const LEVELS = [
  {
    id: 'zeleny-1',
    age: 'child',
    chapter: 'Глава 1 · Зелёный',
    title: 'Летняя пробежка',
    // Заставка главы: сцена и вывеска (box — где вывеска на сцене: left, top, width в долях).
    splash: { img: 'img/ui/chapter-1.jpg', plaque: 'img/ui/chapter-1-plaque.webp', ratio: 1850 / 850, box: [400 / 1850, 90 / 850, 1050 / 1850] },
    text: 'Лето в Зелёном. Полине шесть, и ей срочно надо добежать до станции. По дороге научимся бегать, прыгать и кидаться камнями.',
    theme: 'zeleny',
    // Таблички-подсказки: col — столбец карты, где стоит табличка.
    signs: [
      { col: 4, text: 'Зажми ◀ ▶ слева, чтобы бежать' },
      { col: 11, text: 'Большая кнопка справа: прыжок' },
      { col: 19, text: 'Овраг! Держи прыжок дольше, чтобы прыгнуть дальше' },
      { col: 27, text: 'Собирай монетки, потом купим на них одежду' },
      { col: 43, text: 'Ящик мешает! Кидай камень кнопкой с камушком' },
      { col: 52, text: 'Гусь! Прыгни на него или кинь камень' },
      { col: 61, text: 'Тут осторожно, два оврага подряд' },
      { col: 75, text: 'Беги к станции!' },
    ],
    map: [
      '                                                                                                            ',
      '                                                                                                            ',
      '                                                                                                            ',
      '                                                                                                            ',
      '                                                                                                            ',
      '                                    ooo                                                                     ',
      '                                   ====        B                                                            ',
      '               oo     ooo      oo              B                ooo   ooo   B                               ',
      '               ##             ====             B                                                            ',
      '  P   o o      ##                   o o o      B  C   o o E o o                o oF                         ',
      '######################   #######################################   ##   ####################################',
      '######################   #######################################   ##   ####################################',
    ],
  },
];

export const TILE = 48;

export function parseLevel(def) {
  const rows = def.map;
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length));
  const tiles = [];
  const coins = [];
  const enemies = [];
  let start = { x: 2, y: h - 3 };
  let finish = null;
  const checkpoints = [];
  for (let y = 0; y < h; y++) {
    const row = rows[y].padEnd(w, ' ');
    const out = [];
    for (let x = 0; x < w; x++) {
      const c = row[x];
      let t = ' ';
      switch (c) {
        case '#': case '=': case 'B': case '~': t = c; break;
        case 'o': coins.push({ x: x * TILE + TILE / 2, y: y * TILE + TILE / 2, taken: false }); break;
        case 'E': enemies.push({ x: x * TILE + 4, y: y * TILE + TILE - 36 }); break;
        case 'P': start = { x, y }; break;
        case 'F': finish = { x: x * TILE, y: y * TILE }; break;
        case 'C': checkpoints.push({ x: x * TILE, y: y * TILE, active: false }); break;
        default: break;
      }
      out.push(t);
    }
    tiles.push(out);
  }
  return { w, h, tiles, coins, enemies, start, finish, checkpoints };
}
