/* Музграмота — режим «⏱ На время» (блиц).
   Общий модуль для разделов с викторинами. Ученик выбирает время (или «без времени»),
   отвечает как обычно, сверху идут таймер и счёт; в конце — результат и рекорд.

   Подключение в разделе:
     var bz = BLITZ.mount({
       mod: 'keys',                         // id раздела (как в hw.js)
       id: 'keys-quiz',                     // id упражнения (строка или функция) — рекорды хранятся по нему
       parent: el, ref: refNode,            // куда вставить кнопку (перед refNode внутри parent)
       isActive: function () { return true; }, // ответы засчитываются, только пока это true (вкладка)
       start: function () { ... },          // подготовить викторину (включить режим теста, новый вопрос)
       next: function () { ... },           // следующий вопрос (вызывается модулем после ответа)
       auto: function () { return true; },  // необязательно: false — раздел сам ведёт вопросы (например, «Сопоставь»)
       minSec: 30                           // самое короткое время в списке (по умолчанию 30)
     });
   Ответы приходят сами из hw.js (MHW.answer / MHW.tracker) или напрямую: BLITZ.hit(mod, ok).
   Пока идёт блиц, раздел не должен сам переходить к следующему вопросу:
     if (!BLITZ.on('keys')) setTimeout(nextQuiz, 1400);
   Рекорды и выбор времени — в localStorage (musicapp_blitz). */
(function () {
  'use strict';

  var KEY = 'musicapp_blitz';
  var PENALTY = 3; // секунд за ошибку, если включён штраф
  var TIMES = [30, 60, 120, 300];

  var TXT = {
    ru: {
      btn: '⏱ На время', title: 'На время', sub: 'Ответь верно на как можно больше вопросов.',
      noTime: 'Без времени', own: 'Своё', ownPh: 'Секунд (10–1800)', penalty: 'Ошибка: −3 сек',
      start: 'Старт', cancel: 'Отмена', stop: 'Стоп', finish: 'Завершить',
      result: 'Результат', right: 'Верно', wrong: 'Ошибки', best: 'Рекорд', streak: 'Серия',
      newBest: '🏆 Новый рекорд!', again: 'Ещё раз', close: 'Закрыть', time: 'Время', acc: 'Точность',
      timeUp: 'Время вышло!', done: 'Готово!', sec: 'сек', min: 'мин', bestFor: 'Рекорд на'
    },
    en: {
      btn: '⏱ Timed', title: 'Timed mode', sub: 'Answer as many questions correctly as you can.',
      noTime: 'No timer', own: 'Custom', ownPh: 'Seconds (10–1800)', penalty: 'Mistake: −3 s',
      start: 'Start', cancel: 'Cancel', stop: 'Stop', finish: 'Finish',
      result: 'Result', right: 'Correct', wrong: 'Mistakes', best: 'Best', streak: 'Streak',
      newBest: '🏆 New record!', again: 'Again', close: 'Close', time: 'Time', acc: 'Accuracy',
      timeUp: 'Time is up!', done: 'Done!', sec: 's', min: 'min', bestFor: 'Best for'
    }
  };
  function lang() { return (localStorage.getItem('musicapp_lang') || 'ru') === 'en' ? 'en' : 'ru'; }
  function tr(k) { return TXT[lang()][k]; }
  function load() { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { return {}; } }
  function save(d) { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) {} }
  function fmt(sec, up) { sec = Math.max(0, up ? Math.floor(sec) : Math.ceil(sec)); var m = Math.floor(sec / 60), s = sec % 60; return m + ':' + (s < 10 ? '0' : '') + s; }
  function fmtLen(sec) { return sec % 60 === 0 ? (sec / 60) + ' ' + tr('min') : sec + ' ' + tr('sec'); }

  // ── Стили ──
  function css() {
    if (document.getElementById('blitz-css')) return;
    var st = document.createElement('style');
    st.id = 'blitz-css';
    st.textContent = '' +
      '.bz-row{display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap;margin:0 0 12px;}' +
      '.mhw-addrow + .bz-row,.bz-row + .mhw-addrow{margin-top:-4px;}' +
      '.bz-btn{border:1.5px solid rgba(245,158,11,.45);background:rgba(245,158,11,.12);color:#b45309;border-radius:10px;' +
      'padding:9px 14px;font-size:12px;font-weight:800;cursor:pointer;font-family:inherit;}' +
      'html[data-theme="dark"] .bz-btn{background:rgba(245,158,11,.22);color:#fcd34d;}' +
      '.bz-bar{position:fixed;top:8px;left:50%;transform:translateX(-50%);z-index:10040;display:flex;align-items:center;gap:12px;' +
      'background:#111827;color:#fff;border-radius:16px;padding:8px 10px 8px 16px;box-shadow:0 8px 24px rgba(0,0,0,.3);' +
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-weight:900;font-size:15px;white-space:nowrap;}' +
      'html[data-theme="dark"] .bz-bar{background:#f1f5f9;color:#0f172a;}' +
      '.bz-time{font-variant-numeric:tabular-nums;min-width:44px;}' +
      '.bz-time.low{color:#ef4444;}' +
      '.bz-ok{color:#10b981;}.bz-bad{color:#ef4444;}.bz-str{color:#f59e0b;}' +
      '.bz-bar button{border:none;border-radius:10px;padding:6px 10px;font-weight:800;font-size:12px;cursor:pointer;' +
      'background:#374151;color:#fff;font-family:inherit;}' +
      'html[data-theme="dark"] .bz-bar button{background:#cbd5e1;color:#0f172a;}' +
      '.bz-flash{animation:bzf .35s;}@keyframes bzf{0%{transform:translateX(-50%) scale(1.08);}100%{transform:translateX(-50%) scale(1);}}' +
      '.bz-ov{position:fixed;inset:0;z-index:10050;background:rgba(15,23,42,.55);display:flex;align-items:center;justify-content:center;' +
      'padding:16px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;}' +
      '.bz-modal{background:#fff;color:#0f172a;border-radius:20px;padding:20px;width:100%;max-width:400px;max-height:88vh;overflow:auto;' +
      'box-shadow:0 16px 40px rgba(0,0,0,.3);}' +
      'html[data-theme="dark"] .bz-modal{background:#1e293b;color:#f1f5f9;}' +
      '.bz-modal h3{font-size:17px;font-weight:900;margin:0 0 4px;}' +
      '.bz-modal p{font-size:12.5px;line-height:1.5;margin:0 0 14px;opacity:.8;}' +
      '.bz-opts{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px;}' +
      '.bz-opt{padding:11px 4px;border-radius:12px;border:1.5px solid #cbd5e1;background:transparent;color:inherit;font-size:14px;' +
      'font-weight:900;cursor:pointer;font-family:inherit;}' +
      '.bz-opt.sel{border-color:#f59e0b;background:rgba(245,158,11,.15);}' +
      '.bz-inp{width:100%;box-sizing:border-box;padding:10px 12px;border-radius:10px;border:1.5px solid #cbd5e1;background:transparent;' +
      'color:inherit;font-size:14px;margin:0 0 12px;font-family:inherit;}' +
      '.bz-chk{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:700;margin:0 0 14px;cursor:pointer;}' +
      '.bz-acts{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;}' +
      '.bz-act{border:none;border-radius:10px;padding:10px 16px;font-size:13px;font-weight:800;cursor:pointer;font-family:inherit;' +
      'background:#e2e8f0;color:#0f172a;}' +
      'html[data-theme="dark"] .bz-act{background:#334155;color:#f1f5f9;}' +
      '.bz-act.go{background:#f59e0b;color:#fff;}' +
      '.bz-big{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin:12px 0 14px;}' +
      '.bz-cell{border-radius:14px;padding:10px;text-align:center;background:rgba(148,163,184,.14);}' +
      '.bz-cell b{display:block;font-size:26px;font-weight:900;line-height:1.1;}' +
      '.bz-cell span{font-size:11px;font-weight:700;opacity:.7;}' +
      '.bz-rec{text-align:center;font-size:14px;font-weight:900;margin:0 0 14px;}' +
      'body.hw-lock .bz-row{display:none !important;}'; // в задании учителя — без «На время»
    document.head.appendChild(st);
  }

  function modal(html) {
    css();
    var ov = document.createElement('div');
    ov.className = 'bz-ov';
    ov.innerHTML = '<div class="bz-modal" role="dialog" aria-modal="true">' + html + '</div>';
    document.body.appendChild(ov);
    return { el: ov.firstChild, ov: ov, close: function () { if (ov.parentNode) ov.parentNode.removeChild(ov); } };
  }

  // ── Сессия ──
  var S = null;          // текущая игра
  var handles = [];

  function idOf(h) { return typeof h.id === 'function' ? h.id() : h.id; }
  function on(mod) { return !!(S && S.running && (!mod || S.h.mod === mod)); }

  function hit(mod, ok) {
    if (!on(mod)) return false;
    var h = S.h;
    try { if (h.isActive && !h.isActive()) return false; } catch (e) { return false; }
    if (S.lock) return false; // ответ на уже засчитанный вопрос (до перехода к следующему)
    S.lock = true;
    if (ok) { S.ok++; S.streak++; S.maxStreak = Math.max(S.maxStreak, S.streak); }
    else { S.bad++; S.streak = 0; if (S.penalty && S.limit) S.end -= PENALTY * 1000; }
    render(true);
    var auto = true;
    try { auto = !h.auto || h.auto(); } catch (e) {}
    if (h.next && auto) {
      var sess = S;
      setTimeout(function () {
        if (S !== sess || !S.running) return;
        S.lock = false;
        try { h.next(); } catch (e) {}
      }, ok ? 450 : 1300);
    } else {
      S.lock = false;
    }
    return true;
  }

  function tick() {
    if (!S || !S.running) return;
    if (S.limit && Date.now() >= S.end) { finish(true); return; }
    render(false);
    S.raf = setTimeout(tick, 200);
  }

  function render(flash) {
    if (!S || !S.bar) return;
    var t = S.limit ? (S.end - Date.now()) / 1000 : (Date.now() - S.t0) / 1000;
    var tm = S.bar.querySelector('.bz-time');
    tm.textContent = '⏱ ' + fmt(t, !S.limit);
    tm.classList.toggle('low', !!S.limit && t <= 5);
    S.bar.querySelector('.bz-ok').textContent = '✓ ' + S.ok;
    S.bar.querySelector('.bz-bad').textContent = '✗ ' + S.bad;
    S.bar.querySelector('.bz-str').textContent = S.streak >= 3 ? '🔥 ' + S.streak : '';
    if (flash) { S.bar.classList.remove('bz-flash'); void S.bar.offsetWidth; S.bar.classList.add('bz-flash'); }
  }

  function begin(h, limit, penalty) {
    stop(true);
    css();
    var bar = document.createElement('div');
    bar.className = 'bz-bar';
    bar.innerHTML = '<span class="bz-time"></span><span class="bz-ok"></span><span class="bz-bad"></span><span class="bz-str"></span>' +
      '<button type="button">' + (limit ? tr('stop') : tr('finish')) + '</button>';
    document.body.appendChild(bar);
    S = { h: h, id: idOf(h), limit: limit, penalty: penalty, ok: 0, bad: 0, streak: 0, maxStreak: 0, t0: Date.now(), end: Date.now() + limit * 1000,
          running: true, lock: false, bar: bar, raf: null };
    bar.querySelector('button').addEventListener('click', function () { finish(!limit ? true : false); });
    try { if (h.start) h.start(); } catch (e) {}
    render(false);
    tick();
  }

  function stop(silent) {
    if (!S) return;
    S.running = false;
    if (S.raf) clearTimeout(S.raf);
    if (S.bar && S.bar.parentNode) S.bar.parentNode.removeChild(S.bar);
    if (silent) S = null;
  }

  // completed=false — остановили кнопкой «Стоп» до конца времени: рекорд не пишем.
  function finish(completed) {
    if (!S || !S.running) return;
    var s = S, h = s.h;
    var spent = Math.round((Date.now() - s.t0) / 1000);
    stop(false);
    S = null;
    var d = load(), rec = d.rec || (d.rec = {}), key = s.id + '|' + s.limit + (s.penalty ? 'p' : '');
    var prev = rec[key] || 0, isNew = false;
    if (s.limit && completed && s.ok > prev) { rec[key] = s.ok; isNew = prev > 0 || s.ok > 0; save(d); }
    var total = s.ok + s.bad, acc = total ? Math.round(s.ok * 100 / total) : 0;
    var head = s.limit ? (completed ? tr('timeUp') : tr('result')) : tr('done');
    var html = '<h3>' + head + '</h3>' +
      '<div class="bz-big">' +
      '<div class="bz-cell"><b class="bz-ok">' + s.ok + '</b><span>' + tr('right') + '</span></div>' +
      '<div class="bz-cell"><b class="bz-bad">' + s.bad + '</b><span>' + tr('wrong') + '</span></div>' +
      '<div class="bz-cell"><b>' + acc + '%</b><span>' + tr('acc') + '</span></div>' +
      '<div class="bz-cell"><b>' + (s.limit ? s.maxStreak : fmt(spent, true)) + '</b><span>' + (s.limit ? tr('streak') : tr('time')) + '</span></div>' +
      '</div>';
    // Рекорд пишется, только если игра дошла до конца времени; после «Стоп» показываем прежний.
    var best = completed ? Math.max(prev, s.ok) : prev;
    if (s.limit && (best > 0 || completed)) {
      html += '<div class="bz-rec">' + (isNew && s.ok > 0 ? tr('newBest') + ' ' : '') +
        tr('bestFor') + ' ' + fmtLen(s.limit) + (s.penalty ? ' (−3)' : '') + ': ' + best + '</div>';
    }
    html += '<div class="bz-acts"><button type="button" class="bz-act" data-a="close">' + tr('close') + '</button>' +
      '<button type="button" class="bz-act go" data-a="again">' + tr('again') + '</button></div>';
    var m = modal(html);
    m.el.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      m.close();
      if (b.dataset.a === 'again') begin(h, s.limit, s.penalty);
    });
  }

  // ── Окно выбора времени ──
  function choose(h) {
    var d = load(), sel = d.last != null ? d.last : 60, pen = !!d.pen;
    var min = h.minSec || 30;
    var list = TIMES.filter(function (t) { return t >= min; });
    if (list.indexOf(sel) < 0 && sel !== 0 && sel !== -1) sel = list[0];
    var bestTxt = function (t) { var r = (d.rec || {})[idOf(h) + '|' + t + (pen ? 'p' : '')]; return r ? ' · ' + r : ''; };
    var m = modal(
      '<h3>⏱ ' + tr('title') + '</h3><p>' + tr('sub') + '</p>' +
      '<div class="bz-opts"></div>' +
      '<input class="bz-inp" type="number" min="10" max="1800" step="5" inputmode="numeric" placeholder="' + tr('ownPh') + '" style="display:none">' +
      '<label class="bz-chk"><input type="checkbox"' + (pen ? ' checked' : '') + '> ' + tr('penalty') + '</label>' +
      '<div class="bz-acts"><button type="button" class="bz-act" data-a="cancel">' + tr('cancel') + '</button>' +
      '<button type="button" class="bz-act go" data-a="go">' + tr('start') + '</button></div>'
    );
    var opts = m.el.querySelector('.bz-opts'), inp = m.el.querySelector('.bz-inp'), chk = m.el.querySelector('input[type=checkbox]');
    var chkRow = m.el.querySelector('.bz-chk');
    if (sel === -1) { inp.style.display = ''; inp.value = d.own || 90; }
    function draw() {
      opts.innerHTML = list.map(function (t) {
        return '<button type="button" class="bz-opt' + (sel === t ? ' sel' : '') + '" data-t="' + t + '">' + fmtLen(t) + bestTxt(t) + '</button>';
      }).join('') +
        '<button type="button" class="bz-opt' + (sel === -1 ? ' sel' : '') + '" data-t="-1">' + tr('own') + '</button>' +
        '<button type="button" class="bz-opt' + (sel === 0 ? ' sel' : '') + '" data-t="0">' + tr('noTime') + '</button>';
      chkRow.style.display = sel === 0 ? 'none' : '';
    }
    draw();
    chk.addEventListener('change', function () { pen = chk.checked; draw(); });
    m.ov.addEventListener('click', function (e) { if (e.target === m.ov) m.close(); });
    m.el.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.t != null) {
        sel = parseInt(b.dataset.t, 10);
        inp.style.display = sel === -1 ? '' : 'none';
        if (sel === -1) { if (!inp.value) inp.value = d.own || 90; inp.focus(); }
        draw();
        return;
      }
      if (b.dataset.a === 'cancel') { m.close(); return; }
      if (b.dataset.a === 'go') {
        var limit = sel;
        if (sel === -1) {
          limit = Math.round(parseFloat(inp.value));
          if (!(limit >= 10 && limit <= 1800)) { inp.focus(); inp.style.borderColor = '#ef4444'; return; }
          d.own = limit;
        }
        d.last = sel; d.pen = pen ? 1 : 0; save(d);
        m.close();
        begin(h, limit, limit ? pen : false);
      }
    });
  }

  // ── Кнопка в разделе ──
  function mount(o) {
    css();
    var row = document.createElement('div');
    row.className = 'bz-row';
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'bz-btn';
    b.textContent = tr('btn');
    b.addEventListener('click', function () { choose(o); });
    row.appendChild(b);
    if (o.parent) o.parent.insertBefore(row, o.ref || null);
    var h = { row: row, btn: b, relabel: function () { b.textContent = tr('btn'); } };
    for (var k in o) if (!(k in h)) h[k] = o[k];
    handles.push(h);
    return h;
  }

  // Смена языка: разделы переключают musicapp_lang и перерисовывают страницу.
  window.addEventListener('storage', function (e) { if (e.key === 'musicapp_lang') handles.forEach(function (h) { h.relabel(); }); });
  document.addEventListener('click', function (e) {
    if (e.target && e.target.closest && e.target.closest('#langBtn,.lang-btn,[data-lang]')) setTimeout(function () { handles.forEach(function (h) { h.relabel(); }); }, 0);
  }, true);

  window.BLITZ = { mount: mount, hit: hit, on: on, stop: function () { stop(true); }, _state: function () { return S; } };
})();
