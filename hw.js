/* Музграмота — домашние задания.
   Общий модуль для главной страницы и разделов. Сервер не нужен: задание целиком
   упаковывается в ссылку (?hw=...), прогресс ученика хранится в localStorage.

   Формат задания (компактный, чтобы ссылка и QR были короткими):
   { v:1, id:'k3j2x9', t:'Название', c:<ms создания>,
     i:[ { m:'notation', k:'notes'|'reading', g:<цель>, n:'Описание', p:{...параметры раздела} } ] }

   Всё, что приходит из ссылки, считается чужими данными: текст выводится только
   через esc()/textContent, параметры проверяет сам раздел перед применением. */
(function () {
  'use strict';

  var KEY_DRAFT = 'musicapp_hw_draft';
  var KEY_ACTIVE = 'musicapp_hw_active';
  var KEY_NAME = 'musicapp_hw_student_name';

  // Разделы, которые умеют работать с заданиями. href — относительно главной.
  var MODULES = {
    notation: { href: 'Нотная грамота/index.html', ico: '🎼', ru: 'Нотная грамота', en: 'Music notation' },
    solfege: { href: 'сольфеджио/index.html', ico: '🎤', ru: 'Сольфеджио', en: 'Solfege' },
    rhythm: { href: 'ритмический тренажер/index.html', ico: '🥁', ru: 'Ритмический тренажёр', en: 'Rhythm trainer' },
    ear: { href: 'слуховой анализ/index.html', ico: '👂', ru: 'Слуховой анализ', en: 'Ear training' },
    dictation: { href: 'музыкальные диктанты/index.html', ico: '🎵', ru: 'Муз. диктанты', en: 'Dictations' },
    keys: { href: 'тональности/index.html', ico: '🔑', ru: 'Тональности', en: 'Keys' },
    transpose: { href: 'транспозиция/index.html', ico: '🎹', ru: 'Транспозиция', en: 'Transposition' },
    figured: { href: 'цифровка/index.html', ico: '🔢', ru: 'Цифровка', en: 'Figured bass' },
    jazz: { href: 'джазовая-гармония/index.html', ico: '🎷', ru: 'Джазовая гармония', en: 'Jazz harmony' }
  };

  // Единицы цели упражнения: [одна, две-четыре, пять+] по-русски и [одна, много] по-английски.
  var UNITS = {
    notes: { ru: ['нота', 'ноты', 'нот'], en: ['note', 'notes'] },
    times: { ru: ['раз', 'раза', 'раз'], en: ['time', 'times'] },
    ex: { ru: ['упражнение', 'упражнения', 'упражнений'], en: ['exercise', 'exercises'] },
    ans: { ru: ['ответ', 'ответа', 'ответов'], en: ['answer', 'answers'] },
    dict: { ru: ['диктант', 'диктанта', 'диктантов'], en: ['dictation', 'dictations'] }
  };
  function unitOf(item) {
    if (item.u && UNITS[item.u]) return item.u;
    return item.k === 'reading' ? 'times' : 'notes'; // задания первой версии (только Нотная грамота)
  }
  function goalText(item, n) {
    var g = n == null ? item.g : n, u = UNITS[unitOf(item)];
    if (lang() === 'en') return g + ' ' + (g === 1 ? u.en[0] : u.en[1]);
    var a = g % 10, b = g % 100;
    var f = (a === 1 && b !== 11) ? 0 : (a >= 2 && a <= 4 && (b < 12 || b > 14)) ? 1 : 2;
    return g + ' ' + u.ru[f];
  }

  var TXT = {
    ru: {
      hwTitle: 'Домашнее задание',
      toTask: '← К заданию',
      done: 'Готово',
      of: 'из',
      correct: 'верно',
      exDone: 'Упражнение выполнено!',
      exDoneSub: 'Можно вернуться к заданию или ещё потренироваться — результат уже сохранён.',
      keepTraining: 'Потренироваться ещё',
      cancel: 'Отмена',
      added: 'Добавлено в задание',
      openDraft: 'Открыть',
      exercises: 'упр.',
      reportTitle: 'Отчёт по домашнему заданию',
      student: 'Ученик',
      date: 'Дата',
      progress: 'Сделано',
      accuracy: 'Верно',
      time: 'Время',
      min: 'мин',
      sec: 'сек',
      attempts: 'Попытки',
      mistakes: 'Ошибки',
      noMistakes: 'Ошибок нет',
      notStarted: 'Не начато',
      finishedAll: 'Все упражнения выполнены',
      finishedPart: 'Выполнено упражнений',
      downloaded: 'Картинка отчёта сохранена, текст скопирован — отправьте их учителю.',
      addBtn: '➕ В задание',
      appName: 'Музграмота'
    },
    en: {
      hwTitle: 'Homework',
      toTask: '← Back to homework',
      done: 'Done',
      of: 'of',
      correct: 'correct',
      exDone: 'Exercise complete!',
      exDoneSub: 'You can go back to the homework or keep practising — your result is already saved.',
      keepTraining: 'Keep practising',
      cancel: 'Cancel',
      added: 'Added to homework',
      openDraft: 'Open',
      exercises: 'ex.',
      reportTitle: 'Homework report',
      student: 'Student',
      date: 'Date',
      progress: 'Done',
      accuracy: 'Correct',
      time: 'Time',
      min: 'min',
      sec: 'sec',
      attempts: 'Attempts',
      mistakes: 'Mistakes',
      noMistakes: 'No mistakes',
      notStarted: 'Not started',
      finishedAll: 'All exercises complete',
      finishedPart: 'Exercises complete',
      downloaded: 'Report image saved and text copied — send them to your teacher.',
      addBtn: '➕ Add to homework',
      appName: 'Muzgramota'
    }
  };

  function lang() { return (localStorage.getItem('musicapp_lang') || 'ru') === 'en' ? 'en' : 'ru'; }
  function tr(k) { return TXT[lang()][k] || k; }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function readJSON(key, fallback) {
    try { var v = JSON.parse(localStorage.getItem(key) || 'null'); return v == null ? fallback : v; }
    catch (e) { return fallback; }
  }
  function writeJSON(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {} }

  // ── Кодирование в ссылку (base64url поверх UTF-8, кириллица в названиях работает) ──
  function b64e(str) {
    var bytes = new TextEncoder().encode(str), bin = '';
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function b64d(s) {
    s = String(s).replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    var bin = atob(s), bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }
  function newId() { return Date.now().toString(36).slice(-5) + Math.random().toString(36).slice(2, 5); }

  function clampInt(v, lo, hi, def) {
    v = parseInt(v, 10);
    if (!isFinite(v)) return def;
    return Math.max(lo, Math.min(hi, v));
  }
  function cleanStr(s, max) { return String(s == null ? '' : s).slice(0, max); }

  // Проверка и нормализация задания из ссылки. Неизвестные разделы отбрасываются.
  function sanitize(hw) {
    if (!hw || typeof hw !== 'object' || !Array.isArray(hw.i)) return null;
    var items = hw.i.filter(function (it) {
      return it && typeof it === 'object' && MODULES[it.m] && typeof it.k === 'string' && it.p && typeof it.p === 'object';
    }).slice(0, 20).map(function (it) {
      var o = { m: it.m, k: cleanStr(it.k, 20), g: clampInt(it.g, 1, 500, 10), n: cleanStr(it.n, 160), p: it.p };
      if (UNITS[it.u]) o.u = it.u;
      return o;
    });
    if (!items.length) return null;
    return {
      v: 1,
      id: cleanStr(hw.id || newId(), 16),
      t: cleanStr(hw.t, 80),
      c: clampInt(hw.c, 0, 9e15, Date.now()),
      i: items
    };
  }

  function encode(hw) { return b64e(JSON.stringify(hw)); }
  function parse(code) {
    try { return sanitize(JSON.parse(b64d(code))); } catch (e) { return null; }
  }

  // ── Черновик учителя ──
  function draft() {
    var d = readJSON(KEY_DRAFT, null);
    if (!d || !Array.isArray(d.i)) d = { t: '', i: [] };
    return d;
  }
  function saveDraft(d) { writeJSON(KEY_DRAFT, d); }
  function addToDraft(item) {
    var d = draft();
    var o = { m: item.m, k: item.k, g: item.g, n: item.n, p: item.p };
    if (item.u) o.u = item.u;
    d.i.push(o);
    saveDraft(d);
    return d.i.length;
  }
  function removeFromDraft(idx) {
    var d = draft();
    d.i.splice(idx, 1);
    saveDraft(d);
  }
  function clearDraft() { saveDraft({ t: '', i: [] }); }

  // base — адрес главной (например, https://.../musicapp/). Возвращает ссылку для ученика.
  function makeLink(d, base) {
    var hw = { v: 1, id: newId(), t: cleanStr(d.t, 80), c: Date.now(), i: d.i };
    return base + '?hw=' + encode(hw);
  }

  // ── Задание ученика ──
  function emptyProg() { return { done: 0, ok: 0, bad: 0, mis: {}, ms: 0, runs: [], fin: 0 }; }
  function active() {
    var s = readJSON(KEY_ACTIVE, null);
    if (!s || !s.hw || !Array.isArray(s.hw.i) || !Array.isArray(s.prog)) return null;
    while (s.prog.length < s.hw.i.length) s.prog.push(emptyProg());
    return s;
  }
  function setActive(hw) {
    var s = { hw: hw, prog: hw.i.map(emptyProg), recv: Date.now() };
    writeJSON(KEY_ACTIVE, s);
    return s;
  }
  function saveActive(s) { writeJSON(KEY_ACTIVE, s); }
  function clearActive() { try { localStorage.removeItem(KEY_ACTIVE); } catch (e) {} }
  function isStarted(s) { return s.prog.some(function (p) { return p.done > 0 || p.ok > 0 || p.bad > 0; }); }
  function finishedCount(s) { return s.prog.filter(function (p) { return p.fin; }).length; }

  // ── Работа внутри раздела ──
  var current = null; // {idx, item, lastTs}

  // Какое упражнение выполняется на этой странице: ?hwx=<номер> и раздел совпадает.
  function task(mod) {
    var m = /[?&]hwx=(\d+)/.exec(location.search);
    if (!m) return null;
    var s = active();
    if (!s) return null;
    var idx = parseInt(m[1], 10);
    var item = s.hw.i[idx];
    if (!item || item.m !== mod) return null;
    current = { idx: idx, item: item, lastTs: Date.now() };
    return { idx: idx, item: item, prog: s.prog[idx] };
  }

  // Изменить прогресс упражнения: delta = {ok, bad, done, mis:[подписи], run:{...}}.
  // Время копится по промежуткам между событиями (не больше минуты за раз, чтобы
  // брошенный на полчаса телефон не записался как полчаса занятий).
  // Возвращает {prog, justFinished}. После завершения упражнения прогресс больше не меняется.
  function update(delta) {
    if (!current) return null;
    var s = active();
    if (!s) return null;
    var p = s.prog[current.idx];
    if (!p) return null;
    if (p.fin) return { prog: p, justFinished: false };
    var now = Date.now();
    p.ms += Math.min(now - current.lastTs, 60000);
    current.lastTs = now;
    p.ok += delta.ok || 0;
    p.bad += delta.bad || 0;
    p.done += delta.done || 0;
    (delta.mis || []).forEach(function (lbl) {
      lbl = cleanStr(lbl, 90);
      p.mis[lbl] = (p.mis[lbl] || 0) + 1;
    });
    if (delta.run) { p.runs.push(delta.run); if (p.runs.length > 30) p.runs.shift(); }
    var justFinished = false;
    if (p.done >= current.item.g) { p.fin = now; justFinished = true; }
    saveActive(s);
    refreshBar();
    if (justFinished) showFinished();
    return { prog: p, justFinished: justFinished };
  }

  // ── Стили (одни на главной и в разделах; свои цвета, тёмная тема по data-theme) ──
  function injectCSS() {
    if (document.getElementById('mhw-css')) return;
    var css = '' +
      '.mhw-bar{position:sticky;top:0;z-index:900;display:flex;align-items:center;gap:10px;flex-wrap:wrap;' +
      'background:#eff6ff;border:1.5px solid #2563eb;border-radius:14px;padding:10px 12px;margin:0 0 12px;' +
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#0f172a;box-shadow:0 2px 8px rgba(0,0,0,.08);}' +
      'html[data-theme="dark"] .mhw-bar{background:#172554;color:#f1f5f9;}' +
      '.mhw-bar-main{flex:1;min-width:150px;}' +
      '.mhw-bar-title{font-size:12px;font-weight:900;line-height:1.3;}' +
      '.mhw-bar-sub{font-size:11px;font-weight:700;opacity:.75;margin-top:2px;}' +
      '.mhw-track{height:6px;border-radius:4px;background:rgba(37,99,235,.18);overflow:hidden;margin-top:6px;}' +
      '.mhw-fill{height:100%;background:#2563eb;border-radius:4px;transition:width .3s;}' +
      '.mhw-bar.fin{border-color:#10b981;background:#ecfdf5;}' +
      'html[data-theme="dark"] .mhw-bar.fin{background:#064e3b;}' +
      '.mhw-bar.fin .mhw-fill{background:#10b981;}' +
      '.mhw-btn{border:none;border-radius:10px;padding:9px 14px;font-size:12px;font-weight:800;cursor:pointer;' +
      'background:#e2e8f0;color:#0f172a;text-decoration:none;display:inline-flex;align-items:center;gap:6px;font-family:inherit;}' +
      'html[data-theme="dark"] .mhw-btn{background:#334155;color:#f1f5f9;}' +
      '.mhw-btn.primary{background:#2563eb;color:#fff;}' +
      '.mhw-btn.success{background:#10b981;color:#fff;}' +
      '.mhw-btn.danger{background:transparent;color:#ef4444;}' +
      '.mhw-btn:disabled{opacity:.5;cursor:default;}' +
      '.mhw-overlay{position:fixed;inset:0;z-index:10050;background:rgba(15,23,42,.55);display:flex;align-items:center;' +
      'justify-content:center;padding:16px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;}' +
      '.mhw-modal{background:#fff;color:#0f172a;border-radius:20px;padding:20px;width:100%;max-width:420px;' +
      'max-height:88vh;overflow:auto;box-shadow:0 16px 40px rgba(0,0,0,.3);}' +
      'html[data-theme="dark"] .mhw-modal{background:#1e293b;color:#f1f5f9;}' +
      '.mhw-modal h3{font-size:16px;font-weight:900;margin:0 0 6px;}' +
      '.mhw-modal p{font-size:12.5px;line-height:1.5;margin:0 0 14px;opacity:.85;}' +
      '.mhw-opts{display:grid;grid-template-columns:repeat(auto-fill,minmax(70px,1fr));gap:8px;margin-bottom:14px;}' +
      '.mhw-opt{padding:12px 6px;border-radius:12px;border:1.5px solid #cbd5e1;background:transparent;color:inherit;' +
      'font-size:15px;font-weight:900;cursor:pointer;font-family:inherit;}' +
      '.mhw-opt:hover{border-color:#2563eb;}' +
      '.mhw-row{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;}' +
      '.mhw-input{width:100%;padding:10px 12px;border-radius:10px;border:1.5px solid #cbd5e1;background:transparent;' +
      'color:inherit;font-size:14px;margin-bottom:12px;font-family:inherit;}' +
      '.mhw-toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:10060;background:#111827;color:#fff;' +
      'padding:10px 14px;border-radius:14px;font-size:13px;font-weight:800;box-shadow:0 8px 24px rgba(0,0,0,.25);' +
      'display:flex;align-items:center;gap:10px;max-width:92vw;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;}' +
      'html[data-theme="dark"] .mhw-toast{background:#f1f5f9;color:#0f172a;}' +
      '.mhw-toast a{color:#60a5fa;font-weight:900;text-decoration:none;white-space:nowrap;}' +
      '.mhw-addrow{display:flex;justify-content:flex-end;margin:0 0 12px;}' +
      '.mhw-add{background:rgba(37,99,235,.12);color:#2563eb;border:1.5px solid rgba(37,99,235,.35);}' +
      'html[data-theme="dark"] .mhw-add{background:rgba(37,99,235,.25);color:#93c5fd;}' +
      'html[data-theme="dark"] .mhw-toast a{color:#2563eb;}';
    var st = document.createElement('style');
    st.id = 'mhw-css';
    st.textContent = css;
    document.head.appendChild(st);
  }

  // ── Мелкие UI-помощники ──
  function modal(html) {
    injectCSS();
    var ov = document.createElement('div');
    ov.className = 'mhw-overlay';
    ov.innerHTML = '<div class="mhw-modal" role="dialog" aria-modal="true">' + html + '</div>';
    document.body.appendChild(ov);
    function close() { if (ov.parentNode) ov.parentNode.removeChild(ov); }
    ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
    return { el: ov.firstChild, close: close };
  }

  var toastTimer = null;
  function toast(text, linkText, href) {
    injectCSS();
    var old = document.querySelector('.mhw-toast');
    if (old) old.parentNode.removeChild(old);
    var el = document.createElement('div');
    el.className = 'mhw-toast';
    var span = document.createElement('span');
    span.textContent = text;
    el.appendChild(span);
    if (linkText && href) {
      var a = document.createElement('a');
      a.textContent = linkText;
      a.href = href;
      el.appendChild(a);
    }
    document.body.appendChild(el);
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 3500);
  }

  // Выбор цели упражнения (сколько нот / сколько раз). Promise<число|null>.
  function askGoal(opts) {
    return new Promise(function (resolve) {
      var m = modal(
        '<h3>' + esc(opts.title) + '</h3>' +
        (opts.text ? '<p>' + esc(opts.text) + '</p>' : '') +
        '<div class="mhw-opts">' + opts.options.map(function (v) {
          return '<button type="button" class="mhw-opt" data-v="' + v + '">' + v + '</button>';
        }).join('') + '</div>' +
        '<div class="mhw-row"><button type="button" class="mhw-btn" data-cancel="1">' + esc(tr('cancel')) + '</button></div>'
      );
      m.el.addEventListener('click', function (e) {
        var b = e.target.closest('button');
        if (!b) return;
        if (b.dataset.cancel) { m.close(); resolve(null); return; }
        if (b.dataset.v) { m.close(); resolve(parseInt(b.dataset.v, 10)); }
      });
    });
  }

  // Добавить упражнение в черновик и показать тост со ссылкой на главную.
  function addFromModule(item, homeHref) {
    var n = addToDraft(item);
    toast('✓ ' + tr('added') + ' (' + n + ' ' + tr('exercises') + ')', tr('openDraft') + ' →', homeHref + '?hwbuild=1');
    return n;
  }

  // Кнопка «➕ В задание» для раздела. Вставляется строкой перед refNode внутри parent.
  function addButton(parent, refNode, onClick) {
    injectCSS();
    var row = document.createElement('div');
    row.className = 'mhw-addrow';
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'mhw-btn mhw-add';
    b.textContent = tr('addBtn');
    b.addEventListener('click', onClick);
    row.appendChild(b);
    parent.insertBefore(row, refNode || null);
    return { row: row, btn: b, relabel: function () { b.textContent = tr('addBtn'); } };
  }

  // Прячет элементы, которыми ученик мог бы поменять условия упражнения.
  function lock(selectors) {
    var st = document.createElement('style');
    st.textContent = selectors.join(',') + '{display:none !important;}';
    document.head.appendChild(st);
    document.body.classList.add('hw-lock');
  }

  // Счёт «с первой попытки»: ok — верно без единой ошибки, bad — была ошибка (одна на
  // вопрос, сколько бы раз ни промахнулись). done растёт на каждом решённом вопросе.
  // key — любой объект/число, различающий вопросы (номер вопроса и т.п.).
  function tracker() {
    var q = {}, missed = false;
    function sync(k) { if (k !== q) { q = k; missed = false; } }
    return {
      wrong: function (k, label) {
        sync(k);
        if (missed) return;
        missed = true;
        update({ bad: 1, mis: label ? [label] : [] });
      },
      right: function (k) {
        sync(k);
        update({ done: 1, ok: missed ? 0 : 1 });
        q = {}; missed = false;
      }
    };
  }

  // Название октавы для подписей ошибок: 4 → «1 окт.», 3 → «малая».
  function octName(o) {
    var ru = { 1: 'контроктава', 2: 'большая', 3: 'малая', 4: '1 окт.', 5: '2 окт.', 6: '3 окт.', 7: '4 окт.' };
    var en = { 1: 'contra oct.', 2: 'great oct.', 3: 'small oct.', 4: '1st oct.', 5: '2nd oct.', 6: '3rd oct.', 7: '4th oct.' };
    return (lang() === 'en' ? en : ru)[o] || String(o);
  }

  // ── Полоска прогресса упражнения в разделе ──
  var barEl = null, barHome = '../index.html';
  function mountBar(container, homeHref) {
    if (!current) return;
    injectCSS();
    barHome = homeHref || barHome;
    barEl = document.createElement('div');
    barEl.className = 'mhw-bar';
    barEl.innerHTML =
      '<div class="mhw-bar-main"><div class="mhw-bar-title"></div><div class="mhw-bar-sub"></div>' +
      '<div class="mhw-track"><div class="mhw-fill"></div></div></div>' +
      '<a class="mhw-btn primary" href="' + esc(barHome + '?hwopen=1') + '">' + esc(tr('toTask')) + '</a>';
    container.insertBefore(barEl, container.firstChild);
    refreshBar();
  }
  function refreshBar() {
    if (!barEl || !current) return;
    var s = active();
    if (!s) return;
    var p = s.prog[current.idx], g = current.item.g;
    var total = p.ok + p.bad;
    var pct = total ? Math.round(p.ok / total * 100) : null;
    barEl.querySelector('.mhw-bar-title').textContent = '📝 ' + current.item.n;
    barEl.querySelector('.mhw-bar-sub').textContent =
      (p.fin ? '✓ ' + tr('done') + ' · ' : '') + Math.min(p.done, g) + ' ' + tr('of') + ' ' + goalText(current.item) +
      (pct !== null ? ' · ' + tr('correct') + ' ' + pct + '%' : '');
    barEl.querySelector('.mhw-fill').style.width = Math.min(100, p.done / g * 100) + '%';
    barEl.classList.toggle('fin', !!p.fin);
  }
  function showFinished() {
    var m = modal(
      '<div style="font-size:42px;text-align:center;margin-bottom:6px;">🎉</div>' +
      '<h3 style="text-align:center;">' + esc(tr('exDone')) + '</h3>' +
      '<p style="text-align:center;">' + esc(tr('exDoneSub')) + '</p>' +
      '<div class="mhw-row" style="justify-content:center;">' +
      '<button type="button" class="mhw-btn" data-keep="1">' + esc(tr('keepTraining')) + '</button>' +
      '<a class="mhw-btn primary" href="' + esc(barHome + '?hwopen=1') + '">' + esc(tr('toTask')) + '</a></div>'
    );
    m.el.querySelector('[data-keep]').addEventListener('click', m.close);
  }

  // ── Отчёт ──
  function fmtTime(ms) {
    var sec = Math.round(ms / 1000);
    if (sec < 60) return sec + ' ' + tr('sec');
    return Math.round(sec / 60) + ' ' + tr('min');
  }
  function fmtDate(ts) {
    var d = new Date(ts);
    function z(n) { return (n < 10 ? '0' : '') + n; }
    return z(d.getDate()) + '.' + z(d.getMonth() + 1) + '.' + d.getFullYear() + ' ' + z(d.getHours()) + ':' + z(d.getMinutes());
  }
  function topMistakes(p, n) {
    return Object.keys(p.mis).map(function (k) { return [k, p.mis[k]]; })
      .sort(function (a, b) { return b[1] - a[1]; }).slice(0, n || 6);
  }
  // Строки отчёта по одному упражнению (общие для текста и картинки).
  function itemLines(item, p) {
    var lines = [];
    if (!p.done && !p.ok && !p.bad) { lines.push(tr('notStarted')); return lines; }
    var total = p.ok + p.bad;
    var l1 = tr('progress') + ': ' + Math.min(p.done, item.g) + ' ' + tr('of') + ' ' + goalText(item);
    if (total) l1 += ' · ' + tr('accuracy') + ': ' + p.ok + '/' + total + ' (' + Math.round(p.ok / total * 100) + '%)';
    l1 += ' · ' + tr('time') + ': ' + fmtTime(p.ms);
    lines.push(l1);
    if (p.runs.length) {
      lines.push(tr('attempts') + ': ' + p.runs.map(function (r) {
        if (r.pct != null) return r.pct + '%';
        return r.total ? (r.ok + '/' + r.total) : fmtTime(r.ms || 0);
      }).join(', '));
    }
    var mis = topMistakes(p, 6);
    lines.push(mis.length
      ? tr('mistakes') + ': ' + mis.map(function (x) { return x[0] + (x[1] > 1 ? ' ×' + x[1] : ''); }).join(', ')
      : tr('noMistakes'));
    return lines;
  }
  function reportText(s, name) {
    var out = [];
    out.push('📝 ' + tr('reportTitle') + (s.hw.t ? ': ' + s.hw.t : ''));
    if (name) out.push(tr('student') + ': ' + name);
    out.push(tr('date') + ': ' + fmtDate(Date.now()));
    var fc = finishedCount(s);
    out.push(fc === s.hw.i.length ? '✅ ' + tr('finishedAll') : tr('finishedPart') + ': ' + fc + ' ' + tr('of') + ' ' + s.hw.i.length);
    s.hw.i.forEach(function (item, i) {
      var p = s.prog[i];
      out.push('');
      out.push((p.fin ? '✅ ' : '⬜ ') + (i + 1) + '. ' + item.n);
      itemLines(item, p).forEach(function (l) { out.push('   ' + l); });
    });
    out.push('');
    out.push('— ' + tr('appName'));
    return out.join('\n');
  }

  // Картинка-отчёт (PNG через canvas). Сначала считаем высоту, потом рисуем.
  function reportCanvas(s, name) {
    var W = 1080, P = 64, CW = W - P * 2;
    var cv = document.createElement('canvas');
    var ctx = cv.getContext('2d');
    if (!ctx) return null;
    var FONT = '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif';
    function wrap(text, font, maxW) {
      ctx.font = font;
      var words = String(text).split(' '), lines = [], cur = '';
      words.forEach(function (w) {
        var test = cur ? cur + ' ' + w : w;
        if (ctx.measureText(test).width > maxW && cur) { lines.push(cur); cur = w; }
        else cur = test;
      });
      if (cur) lines.push(cur);
      return lines;
    }
    var blocks = [];
    s.hw.i.forEach(function (item, i) {
      var p = s.prog[i];
      var title = wrap((i + 1) + '. ' + item.n, 'bold 34px ' + FONT, CW - 116);
      var body = [];
      itemLines(item, p).forEach(function (l) { body = body.concat(wrap(l, '28px ' + FONT, CW - 116)); });
      blocks.push({ fin: !!p.fin, title: title, body: body, h: 36 + title.length * 44 + body.length * 38 + 24 });
    });
    var headH = 250 + (s.hw.t ? 56 : 0);
    var H = headH + blocks.reduce(function (a, b) { return a + b.h + 20; }, 0) + 90;
    cv.width = W; cv.height = H;

    ctx.fillStyle = '#f8fafc'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#2563eb'; ctx.fillRect(0, 0, W, headH - 40);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 46px ' + FONT;
    ctx.fillText('📝 ' + tr('reportTitle'), P, 86);
    var y = 86;
    if (s.hw.t) { y += 56; ctx.font = 'bold 36px ' + FONT; ctx.fillText(wrap(s.hw.t, 'bold 36px ' + FONT, CW)[0], P, y); }
    ctx.font = '30px ' + FONT;
    y += 52; ctx.fillText((name ? tr('student') + ': ' + name + '   ·   ' : '') + fmtDate(Date.now()), P, y);
    var fc = finishedCount(s);
    y += 46; ctx.font = 'bold 30px ' + FONT;
    ctx.fillText(fc === s.hw.i.length ? '✅ ' + tr('finishedAll') : tr('finishedPart') + ': ' + fc + ' ' + tr('of') + ' ' + s.hw.i.length, P, y);

    y = headH;
    blocks.forEach(function (b) {
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = b.fin ? '#10b981' : '#e2e8f0';
      ctx.lineWidth = 4;
      roundRect(ctx, P, y, CW, b.h, 24);
      ctx.fill(); ctx.stroke();
      ctx.font = 'bold 40px ' + FONT;
      ctx.fillStyle = b.fin ? '#10b981' : '#94a3b8';
      ctx.fillText(b.fin ? '✓' : '○', P + 28, y + 64);
      var ty = y + 60;
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 34px ' + FONT;
      b.title.forEach(function (l) { ctx.fillText(l, P + 84, ty); ty += 44; });
      ctx.fillStyle = '#475569';
      ctx.font = '28px ' + FONT;
      b.body.forEach(function (l) { ctx.fillText(l, P + 84, ty); ty += 38; });
      y += b.h + 20;
    });
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 26px ' + FONT;
    ctx.fillText('🎵 ' + tr('appName'), P, H - 40);
    return cv;
  }
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // Отправить отчёт: картинка + текст через системное «Поделиться»; если его нет —
  // скачиваем картинку и копируем текст в буфер обмена.
  function shareReport(s, name) {
    var text = reportText(s, name);
    var cv = reportCanvas(s, name);
    var title = tr('reportTitle');
    function blobP() {
      return new Promise(function (res) {
        if (!cv || !cv.toBlob) { res(null); return; }
        try { cv.toBlob(function (b) { res(b); }, 'image/png'); } catch (e) { res(null); }
      });
    }
    return blobP().then(function (blob) {
      var file = null;
      try { if (blob) file = new File([blob], 'otchet.png', { type: 'image/png' }); } catch (e) { file = null; }
      var tryFiles = (file && navigator.canShare && navigator.canShare({ files: [file] }))
        ? navigator.share({ files: [file], title: title, text: text }) : Promise.reject({ name: 'NoFiles' });
      return tryFiles.then(function () { return 'shared'; }, function (e) {
        if (e && e.name === 'AbortError') return 'cancel';
        var tryText = navigator.share ? navigator.share({ title: title, text: text }) : Promise.reject({ name: 'NoShare' });
        return tryText.then(function () { return 'shared'; }, function (e2) {
          if (e2 && e2.name === 'AbortError') return 'cancel';
          if (blob) {
            var a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = 'otchet.png';
            document.body.appendChild(a); a.click(); document.body.removeChild(a);
          }
          var cp = (navigator.clipboard && navigator.clipboard.writeText) ? navigator.clipboard.writeText(text) : Promise.resolve();
          return cp.then(function () { toast(tr('downloaded')); return 'downloaded'; }, function () { toast(tr('downloaded')); return 'downloaded'; });
        });
      });
    });
  }

  window.MHW = {
    MODULES: MODULES,
    tr: tr, esc: esc, lang: lang, goalText: goalText, octName: octName,
    addButton: addButton, lock: lock, tracker: tracker,
    encode: encode, parse: parse,
    draft: draft, saveDraft: saveDraft, addToDraft: addToDraft, removeFromDraft: removeFromDraft, clearDraft: clearDraft,
    makeLink: makeLink,
    active: active, setActive: setActive, clearActive: clearActive, isStarted: isStarted, finishedCount: finishedCount,
    task: task, update: update,
    mountBar: mountBar, refreshBar: refreshBar,
    modal: modal, toast: toast, askGoal: askGoal, addFromModule: addFromModule,
    reportText: reportText, reportCanvas: reportCanvas, shareReport: shareReport,
    studentName: function () { return localStorage.getItem(KEY_NAME) || ''; },
    setStudentName: function (n) { try { localStorage.setItem(KEY_NAME, cleanStr(n, 40)); } catch (e) {} },
    injectCSS: injectCSS
  };
})();
