// Картинки из нейросети (вырезанные из фона). Грузим заранее, а пока не загрузились,
// игра рисует запасные фигуры кодом.

const LIST = {
  sky: 'img/bg/sky.jpg',
  village: 'img/bg/village.webp',
  station: 'img/bg/station.webp',
  gooseWalk: 'img/obj/goose-walk.png',
  gooseAngry: 'img/obj/goose-angry.png',
  crate: 'img/obj/crate.png',
  coin: 'img/obj/coin.png',
  stone: 'img/obj/stone.png',
  sign: 'img/obj/sign.png',
  trainHead: 'img/obj/train-head.png',
  trainCar: 'img/obj/train-car.png',
  'body-sundress': 'img/polina/body-sundress.png',
  'arm-sundress': 'img/polina/arm-sundress.png',
  'body-yolochka': 'img/polina/body-yolochka.png',
  'arm-yolochka': 'img/polina/arm-yolochka.png',
  'body-blue': 'img/polina/body-blue.png',
  'arm-blue': 'img/polina/arm-blue.png',
  'body-pajamas': 'img/polina/body-pajamas.png',
  'arm-pajamas': 'img/polina/arm-pajamas.png',
  'front-sundress': 'img/polina/front-sundress.webp',
  'front-yolochka': 'img/polina/front-yolochka.webp',
  'front-blue': 'img/polina/front-blue.webp',
  'front-pajamas': 'img/polina/front-pajamas.webp',
};

export const IMG = {};

export function loadAssets(onProgress) {
  const keys = Object.keys(LIST);
  let done = 0;
  return Promise.all(keys.map((k) => new Promise((resolve) => {
    const im = new Image();
    im.decoding = 'async';
    im.onload = () => { IMG[k] = im; done++; onProgress?.(done / keys.length); resolve(); };
    im.onerror = () => { done++; onProgress?.(done / keys.length); resolve(); };
    im.src = LIST[k];
  })));
}


// Как резать Полину сбоку на части (доли от высоты/ширины картинки тела):
// cut — где кончается платье/кофта и начинаются ноги; knee — где колени (нет — ноги под платьем);
// swing — насколько широко шагает; split — подол ниже cut отделять от ног по цвету;
// apart — ноги на картинке расставлены, режем на заднюю и переднюю.
// arm — где плечо на теле (shoulderX/Y) и где плечевой шарнир на картинке руки (pivotX/Y).
// Шарниры бедра, колена и стоп находятся сами по картинке.
export const RIG = {
  sundress: { cut: 0.683, knee: 0.79, swing: 0.42, split: true, apart: true,
    arm: { shoulderX: 0.519, shoulderY: 0.27, pivotX: 0.085, pivotY: 0.538 } },
  pajamas: { cut: 0.522, knee: 0.78, swing: 0.36, apart: true,
    arm: { shoulderX: 0.552, shoulderY: 0.274, pivotX: 0.103, pivotY: 0.536 } },
  blue: { cut: 0.769, knee: 0.825, swing: 0.45, split: true,
    arm: { shoulderX: 0.579, shoulderY: 0.273, pivotX: 0.085, pivotY: 0.538 } },
  yolochka: { cut: 0.918, swing: 0.16, overlap: 0, shuffle: 0.16,
    arm: { shoulderX: 0.567, shoulderY: 0.264, pivotX: 0.084, pivotY: 0.5 } },
};
