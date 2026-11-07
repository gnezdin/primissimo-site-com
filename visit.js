// Счётчик посещений: один маленький запрос на просмотр страницы, без cookie
// и идентификаторов. Посетителя отмечает флаг first — первый просмотр в
// сеансе вкладки. Основной адрес не ответил — пробуем запасной (relay).
// Клик по кнопке загрузки (data-download) — такой же запрос в фоне: переход
// не ждёт ответа, keepalive доносит его и после ухода со страницы.
(function () {
  var me = document.currentScript;
  var urls = [me.dataset.endpoint, me.dataset.fallback].filter(Boolean);
  if (!urls.length || !window.fetch) return;
  var root = document.documentElement;
  var first = true;
  var chosen = false;
  var referrer = '';
  try { first = !sessionStorage.getItem('visited'); sessionStorage.setItem('visited', '1'); } catch (e) {}
  try { chosen = ['light', 'dark'].indexOf(localStorage.getItem('theme')) >= 0; } catch (e) {}
  try { referrer = document.referrer ? new URL(document.referrer).hostname : ''; } catch (e) {}
  var width = window.innerWidth;
  var view = JSON.stringify({
    v: 1,
    host: location.hostname,
    page: me.dataset.page,
    lang: root.lang,
    theme: root.dataset.theme,
    theme_chosen: chosen,
    screen: width < 600 ? 'compact' : width < 840 ? 'medium' : 'expanded',
    referrer: referrer,
    first: first
  });
  // text/plain и no-cors: простой запрос без предварительного OPTIONS.
  function send(body, i) {
    if (i >= urls.length) return;
    var ctrl = window.AbortController ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, 4000) : 0;
    fetch(urls[i], { method: 'POST', mode: 'no-cors', keepalive: true, body: body, signal: ctrl ? ctrl.signal : undefined })
      .then(function () { clearTimeout(timer); }, function () { clearTimeout(timer); send(body, i + 1); });
  }
  send(view, 0);
  document.addEventListener('click', function (event) {
    var link = event.target.closest && event.target.closest('a[data-download]');
    if (!link) return;
    try {
      send(JSON.stringify({
        v: 1,
        event: 'download',
        host: location.hostname,
        page: me.dataset.page,
        lang: root.lang,
        target: link.dataset.download
      }), 0);
    } catch (e) {}
  }, true);
})();
