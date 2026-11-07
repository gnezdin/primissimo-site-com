// Тема, язык и форма обратной связи. Без зависимостей.

// --- подбор страницы по языку браузера. Вынесен отдельно, потому что
// покрыт проверками: `node --test marketing/site/static/site.test.cjs`.
// Соответствие строится по набору страниц сайта (`data-locales`), а не по
// жёсткому списку: появится новый перевод — подбор учтёт его сам.
var PrimissimoLocale = (function () {
  'use strict';

  // Устаревшие коды, которые системы и браузеры всё ещё присылают.
  var ALIAS = { iw: 'he', in: 'id', ji: 'yi', nb: 'no', nn: 'no', mo: 'ro' };

  // Языки, у которых на сайте несколько страниц: решает регион или письменность.
  // Для испанского Испания стоит отдельно, остальной мир — к мексиканскому
  // варианту, как это принято в App Store.
  var VARIANTS = {
    zh: function (script, region) {
      var traditional = script === 'hant' || region === 'tw' || region === 'hk' || region === 'mo';
      return traditional ? 'zh-hant' : 'zh-hans';
    },
    es: function (script, region) { return region === '' || region === 'es' ? 'es-es' : 'es-mx'; },
    pt: function (script, region) { return region === 'br' ? 'pt-br' : 'pt-pt'; },
    fr: function (script, region) { return region === 'ca' ? 'fr-ca' : 'fr-fr'; },
    en: function (script, region) {
      var own = region === 'gb' || region === 'au' || region === 'ca';
      return own ? 'en-' + region : 'en';
    },
  };

  /** Язык, письменность и регион из тега: `zh-Hant-HK` → zh, hant, hk. */
  function parse(tag) {
    var bits = tag.split('-');
    var out = { lang: ALIAS[bits[0]] || bits[0], script: '', region: '' };
    for (var i = 1; i < bits.length; i++) {
      if (bits[i].length === 4 && out.script === '') out.script = bits[i];
      else if (bits[i].length <= 3 && out.region === '') out.region = bits[i];
    }
    return out;
  }

  /**
   * Путь страницы для списка языков браузера или null, если своей нет.
   * Порядок для каждого языка: точное совпадение тега → вариант по региону →
   * страница без региона → единственная страница этого языка (`de-de`, `nl-nl`).
   */
  function pick(languages, paths) {
    var wanted = (languages || []).map(function (l) { return String(l).toLowerCase(); });
    for (var i = 0; i < wanted.length; i++) {
      var tag = wanted[i];
      if (paths[tag] !== undefined) return paths[tag];
      var it = parse(tag);
      var variant = VARIANTS[it.lang] ? VARIANTS[it.lang](it.script, it.region) : null;
      if (variant !== null && paths[variant] !== undefined) return paths[variant];
      if (paths[it.lang] !== undefined) return paths[it.lang];
      for (var key in paths) {
        if (Object.prototype.hasOwnProperty.call(paths, key) && parse(key).lang === it.lang) {
          return paths[key];
        }
      }
    }
    return null;
  }

  /** `en=/ de-de=/de/ …` из атрибута страницы — в таблицу путей. */
  function table(attribute) {
    var paths = {};
    String(attribute || '').split(' ').forEach(function (pair) {
      var parts = pair.split('='); // hreflang=path
      if (parts.length === 2) paths[parts[0].toLowerCase()] = parts[1];
    });
    return paths;
  }

  return { pick: pick, table: table };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = PrimissimoLocale;

if (typeof document !== 'undefined') (function () {
  'use strict';
  var root = document.documentElement;
  var body = document.body;

  // --- тема: солнце/луна в углу, выбор помнится в localStorage
  var toggle = document.getElementById('theme');
  toggle.addEventListener('click', function () {
    var next = root.dataset.theme === 'light' ? 'dark' : 'light';
    root.dataset.theme = next;
    try { localStorage.setItem('theme', next); } catch (e) {}
  });

  // --- язык: подсказать страницу на языке браузера, если зашли на корень
  var select = document.getElementById('lang');
  select.addEventListener('change', function () {
    try { localStorage.setItem('lang', select.value); } catch (e) {}
    location.href = select.value;
  });
  if (body.dataset.root === 'yes' && !location.hash) {
    var chosen = null;
    try { chosen = localStorage.getItem('lang'); } catch (e) {}
    if (chosen === null) {
      chosen = PrimissimoLocale.pick(
        navigator.languages || [navigator.language || ''],
        PrimissimoLocale.table(body.dataset.locales)
      );
    }
    if (chosen && chosen !== '/' && chosen !== location.pathname) location.replace(chosen);
  }

  // --- ролик: локальный <video> уже на странице; если YouTube отвечает
  // за 3 с, ставим вместо него iframe (data-embed). Где YouTube закрыт,
  // fetch падает или не успевает — остаётся локальный файл.
  var player = document.getElementById('player');
  if (player && player.dataset.embed && window.AbortController) {
    var probe = new AbortController();
    var timer = setTimeout(function () { probe.abort(); }, 3000);
    fetch('https://www.youtube.com/favicon.ico', { mode: 'no-cors', cache: 'no-store', signal: probe.signal })
      .then(function () {
        clearTimeout(timer);
        var local = player.querySelector('video');
        if (local && !local.paused) return; // уже смотрят — не дёргать
        if (player.dataset.local === 'yes') return; // выбрали ролик сайта
        var frame = document.createElement('iframe');
        frame.src = player.dataset.embed;
        frame.title = player.closest('section').querySelector('h2').textContent;
        frame.loading = 'lazy';
        frame.allow = 'fullscreen; picture-in-picture';
        frame.allowFullscreen = true;
        player.replaceChildren(frame);
      })
      .catch(function () { clearTimeout(timer); });
  }
  // «Смотреть на этом сайте»: где заставка YouTube видна, а сам ролик не играет
  // (например, в России), — вернуть копию с сайта и запустить её.
  var localLink = document.getElementById('video-local');
  if (player && localLink) {
    var original = player.querySelector('video');
    localLink.addEventListener('click', function (event) {
      if (!original) return; // без копии — ссылка откроет файл
      event.preventDefault();
      player.dataset.local = 'yes';
      if (!player.contains(original)) player.replaceChildren(original);
      player.scrollIntoView({ behavior: 'smooth', block: 'center' });
      var played = original.play();
      if (played && played.catch) played.catch(function () {});
    });
  }

  // --- обратная связь
  function hex8() {
    var bytes = new Uint8Array(4);
    (window.crypto || window.msCrypto).getRandomValues(bytes);
    return Array.prototype.map.call(bytes, function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
  }
  function postJson(url, payload, ms) {
    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, ms);
    return fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: payload, signal: ctrl.signal })
      .finally(function () { clearTimeout(timer); });
  }
  // Ответ любого адреса — результат; молчание — следующий адрес.
  function postFirstAnswering(urls, payload) {
    return postJson(urls[0], payload, 4000).catch(function (error) {
      if (urls.length < 2) throw error;
      return postFirstAnswering(urls.slice(1), payload);
    });
  }

  var form = document.getElementById('form');
  var status = document.getElementById('status');
  form.addEventListener('submit', function (event) {
    event.preventDefault();
    var data = new FormData(form);
    var message = String(data.get('message') || '').trim();
    status.className = 'status';
    if (message.length < 10) {
      status.textContent = status.dataset.short;
      status.className = 'status err';
      return;
    }
    var button = form.querySelector('button');
    button.disabled = true;
    var payload = JSON.stringify({
      id: hex8(),
      kind: data.get('kind'),
      message: message,
      email: String(data.get('email') || '').trim(),
      website: String(data.get('website') || ''),
      createdAt: new Date().toISOString(),
      diagnostics: { platform: 'web', locale: body.dataset.lang, app: 'site' }
    });
    // Основной адрес, при его молчании (4 с) — запасной вне Cloudflare;
    // одно и то же id, чтобы сервер не завёл обращение дважды.
    var endpoints = [body.dataset.endpoint, body.dataset.endpointFallback].filter(Boolean);
    postFirstAnswering(endpoints, payload).then(function (response) {
      if (!response.ok) throw new Error(String(response.status));
      form.reset();
      status.textContent = status.dataset.sent;
    }).catch(function () {
      status.textContent = status.dataset.error;
      status.className = 'status err';
    }).finally(function () {
      button.disabled = false;
    });
  });
})();
