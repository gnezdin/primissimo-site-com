// Подбор страницы по языку браузера: node --test marketing/site/static/site.test.cjs
// Сети и состояния браузера не трогает — проверяется чистая функция из site.js.
const test = require('node:test');
const assert = require('node:assert/strict');
const { pick, table } = require('./site.js');

// Набор страниц сайта на 16 октября 2026 года (атрибут `data-locales`
// опубликованной главной; его строит tool/store/site_build.py).
const PAGES = table(
  'en=/ en-gb=/en-gb/ en-au=/en-au/ en-ca=/en-ca/ ru=/ru/ uk=/uk/ de-de=/de/ fr-fr=/fr/ ' +
    'fr-ca=/fr-ca/ es-es=/es/ es-mx=/es-mx/ it=/it/ pt-br=/pt-br/ pt-pt=/pt/ nl-nl=/nl/ ' +
    'sv=/sv/ da=/da/ no=/no/ fi=/fi/ pl=/pl/ cs=/cs/ sk=/sk/ sl-si=/sl/ hu=/hu/ ro=/ro/ ' +
    'hr=/hr/ el=/el/ tr=/tr/ ca=/ca/ he=/he/ ar-sa=/ar/ hi=/hi/ id=/id/ ms=/ms/ vi=/vi/ ' +
    'th=/th/ ja=/ja/ ko=/ko/ zh-hans=/zh-hans/ zh-hant=/zh-hant/'
);

// Входы — как их присылает браузер: сначала точный тег, следом голый язык.
const CASES = [
  // Региональные настройки языков, у которых на сайте одна страница.
  [['de-DE', 'de'], '/de/'],
  [['de-AT', 'de'], '/de/'],
  [['de-CH'], '/de/'],
  [['nl-BE', 'nl'], '/nl/'],
  [['sl-SI'], '/sl/'],
  [['ar-EG'], '/ar/'],
  [['ru-RU', 'ru'], '/ru/'],
  [['ko-KR'], '/ko/'],
  // Китайский: письменность или регион решают, какая из двух страниц.
  [['zh-CN', 'zh'], '/zh-hans/'],
  [['zh-SG'], '/zh-hans/'],
  [['zh'], '/zh-hans/'],
  [['zh-TW', 'zh'], '/zh-hant/'],
  [['zh-HK'], '/zh-hant/'],
  [['zh-Hant-MO'], '/zh-hant/'],
  [['zh-Hans-CN'], '/zh-hans/'],
  // Языки с двумя страницами: Испания и остальной мир, Бразилия и Португалия,
  // Канада и остальной французский.
  [['es-ES'], '/es/'],
  [['es'], '/es/'],
  [['es-AR', 'es'], '/es-mx/'],
  [['es-419'], '/es-mx/'],
  [['pt-BR'], '/pt-br/'],
  [['pt-PT', 'pt'], '/pt/'],
  [['pt'], '/pt/'],
  [['fr-CA'], '/fr-ca/'],
  [['fr-CH', 'fr'], '/fr/'],
  [['fr'], '/fr/'],
  // Английский: свои страницы у трёх регионов, прочие остаются на корне.
  [['en-GB'], '/en-gb/'],
  [['en-AU'], '/en-au/'],
  [['en-IN', 'en'], '/'],
  [['en-US'], '/'],
  // Устаревшие коды, которые всё ещё встречаются.
  [['nb-NO'], '/no/'],
  [['nn-NO'], '/no/'],
  [['iw-IL'], '/he/'],
  [['in-ID'], '/id/'],
];

test('язык браузера ведёт на свою страницу', () => {
  for (const [languages, expected] of CASES) {
    assert.equal(pick(languages, PAGES), expected, languages.join(','));
  }
});

test('первый язык списка важнее следующих', () => {
  assert.equal(pick(['fr-CH', 'de-DE'], PAGES), '/fr/');
  assert.equal(pick(['de-AT', 'fr-FR'], PAGES), '/de/');
});

test('языка нет на сайте — перехода нет', () => {
  assert.equal(pick(['is-IS'], PAGES), null);
  assert.equal(pick([], PAGES), null);
  assert.equal(pick(['sw-KE', 'am-ET'], PAGES), null);
});

test('неизвестный язык пропускается ради следующего', () => {
  assert.equal(pick(['is-IS', 'da-DK'], PAGES), '/da/');
});
