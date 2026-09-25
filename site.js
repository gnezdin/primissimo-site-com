// Тема, язык и форма обратной связи. Без зависимостей.
(function () {
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
      var paths = {};
      body.dataset.locales.split(' ').forEach(function (pair) {
        var parts = pair.split('='); // hreflang=path
        paths[parts[0].toLowerCase()] = parts[1];
      });
      var wanted = (navigator.languages || [navigator.language || '']).map(function (l) { return l.toLowerCase(); });
      for (var i = 0; i < wanted.length && chosen === null; i++) {
        var tag = wanted[i];
        if (paths[tag] !== undefined) chosen = paths[tag];
        else if (paths[tag.split('-')[0]] !== undefined) chosen = paths[tag.split('-')[0]];
      }
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
