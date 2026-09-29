/* Музграмота — ввод звука и нот: микрофон (высота тона, хлопки) и MIDI-клавиатура.
   Общий модуль для разделов (подключается как ../audio-in.js). Всё работает прямо на
   устройстве — звук никуда не отправляется.

   AIN.mic.start({ onPitch(freq|null, rms), onOnset(timeMs) }) → Promise<boolean>
   AIN.mic.stop()
   AIN.midi.enable(onNote) → Promise<boolean>   onNote({midi, note:'C#', octave:4, velocity})
   AIN.midi.button(parent, refNode, onNote)      кнопка «🎹 MIDI» с запоминанием выбора
   AIN.freqToMidi(f), AIN.midiToFreq(m), AIN.midiName(m) */
(function () {
  'use strict';
  var NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  function lang() { return (localStorage.getItem('musicapp_lang') || 'ru') === 'en' ? 'en' : 'ru'; }
  function midiToFreq(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  function freqToMidi(f) { return 69 + 12 * Math.log2(f / 440); } // дробное — для центов
  function midiName(m) { m = Math.round(m); return { note: NOTES[((m % 12) + 12) % 12], octave: Math.floor(m / 12) - 1 }; }

  // YIN (как в Нотной грамоте и Сольфеджио): устойчив к октавным ошибкам на голосе.
  function yin(buffer, sampleRate) {
    var SIZE = buffer.length, half = SIZE >> 1, rms = 0, i;
    for (i = 0; i < SIZE; i++) rms += buffer[i] * buffer[i];
    if (Math.sqrt(rms / SIZE) < 0.012) return -1;
    var d = new Float32Array(half), tau, j;
    for (tau = 1; tau < half; tau++) { for (j = 0; j < half; j++) { var x = buffer[j] - buffer[j + tau]; d[tau] += x * x; } }
    var cmnd = new Float32Array(half); cmnd[0] = 1;
    var run = 0;
    for (tau = 1; tau < half; tau++) { run += d[tau]; cmnd[tau] = run > 0 ? d[tau] * tau / run : 0; }
    tau = 2;
    while (tau < half - 1) { if (cmnd[tau] < 0.15) { while (tau + 1 < half - 1 && cmnd[tau + 1] < cmnd[tau]) tau++; break; } tau++; }
    if (tau >= half - 1) return -1;
    var s0 = cmnd[tau - 1], s1 = cmnd[tau], s2 = cmnd[tau + 1], den = 2 * s1 - s0 - s2;
    var t = den > 0 ? tau + 0.5 * (s2 - s0) / den : tau;
    return sampleRate / t;
  }

  // ── Микрофон ──
  var mic = { ctx: null, stream: null, src: null, an: null, raf: null, on: false, opts: null,
    noise: 0.01, prevEnergy: 0, lastOnset: -1e9 };
  function micLoop() {
    if (!mic.on || !mic.an) return;
    var buf = new Float32Array(mic.an.fftSize);
    mic.an.getFloatTimeDomainData(buf);
    var rms = 0, peak = 0, i;
    for (i = 0; i < buf.length; i++) { var v = buf[i]; rms += v * v; if (v > peak) peak = v; else if (-v > peak) peak = -v; }
    rms = Math.sqrt(rms / buf.length);
    var o = mic.opts || {};
    if (o.onOnset) {
      // Хлопок — резкий скачок энергии над фоновым шумом; «мёртвое время» 110 мс, чтобы
      // эхо одного хлопка не засчитывалось вторым.
      var now = performance.now();
      var thr = Math.max(0.06, mic.noise * 5);
      if (peak > thr && peak > mic.prevEnergy * 1.8 && now - mic.lastOnset > 110) {
        mic.lastOnset = now;
        try { o.onOnset(now); } catch (e) {}
      }
      mic.prevEnergy = peak;
      if (peak < thr) mic.noise = mic.noise * 0.97 + peak * 0.03; // медленно подстраиваемся к шуму комнаты
    }
    if (o.onPitch) {
      var f = yin(buf, mic.an.context.sampleRate);
      try { o.onPitch(f > 0 ? f : null, rms); } catch (e) {}
    }
    mic.raf = requestAnimationFrame(micLoop);
  }
  function micStart(opts) {
    mic.opts = opts || {};
    if (mic.on) return Promise.resolve(true);
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return Promise.resolve(false);
    // Для хлопков отключаем шумоподавление/автоусиление — они «съедают» резкие атаки.
    var constraints = { audio: mic.opts.onOnset ? { echoCancellation: false, noiseSuppression: false, autoGainControl: false } : true, video: false };
    return navigator.mediaDevices.getUserMedia(constraints).then(function (stream) {
      mic.ctx = mic.ctx || new (window.AudioContext || window.webkitAudioContext)();
      if (mic.ctx.state === 'suspended' && mic.ctx.resume) mic.ctx.resume();
      mic.stream = stream;
      mic.src = mic.ctx.createMediaStreamSource(stream);
      mic.an = mic.ctx.createAnalyser();
      mic.an.fftSize = 2048;
      mic.src.connect(mic.an);
      mic.on = true; mic.noise = 0.01; mic.prevEnergy = 0; mic.lastOnset = -1e9;
      mic.raf = requestAnimationFrame(micLoop);
      return true;
    }, function () { return false; });
  }
  function micStop() {
    mic.on = false;
    if (mic.raf) { cancelAnimationFrame(mic.raf); mic.raf = null; }
    if (mic.src) { try { mic.src.disconnect(); } catch (e) {} mic.src = null; }
    if (mic.stream) { mic.stream.getTracks().forEach(function (t) { t.stop(); }); mic.stream = null; }
    mic.an = null;
  }

  // ── MIDI ──
  var KEY_MIDI = 'musicapp_midi_on';
  var midi = { access: null, handlers: [], names: [] };
  function midiMsg(e) {
    var d = e.data; if (!d || d.length < 3) return;
    var cmd = d[0] & 0xf0;
    if (cmd === 0x90 && d[2] > 0) {
      var nm = midiName(d[1]);
      var ev = { midi: d[1], note: nm.note, octave: nm.octave, velocity: d[2] };
      midi.handlers.forEach(function (h) { try { h(ev); } catch (err) {} });
    }
  }
  function bindInputs() {
    midi.names = [];
    if (!midi.access) return;
    midi.access.inputs.forEach(function (inp) { inp.onmidimessage = midiMsg; midi.names.push(inp.name || 'MIDI'); });
  }
  function midiSupported() { return typeof navigator.requestMIDIAccess === 'function'; }
  function midiEnable(onNote) {
    if (onNote && midi.handlers.indexOf(onNote) < 0) midi.handlers.push(onNote);
    if (midi.access) { bindInputs(); return Promise.resolve(true); }
    if (!midiSupported()) return Promise.resolve(false);
    return navigator.requestMIDIAccess({ sysex: false }).then(function (acc) {
      midi.access = acc;
      bindInputs();
      acc.onstatechange = function () { bindInputs(); if (midi.onchange) midi.onchange(); };
      return true;
    }, function () { return false; });
  }
  var TXT = {
    ru: { on: 'MIDI', none: 'MIDI: подключите клавиатуру', no: 'MIDI не поддерживается на этом устройстве', denied: 'Нет доступа к MIDI' },
    en: { on: 'MIDI', none: 'MIDI: connect a keyboard', no: 'MIDI is not supported on this device', denied: 'No MIDI access' }
  };
  // Кнопка «🎹 MIDI»: включает ввод с клавиатуры и запоминает выбор (на следующих
  // страницах подключается сама — разрешение браузер уже помнит).
  function midiButton(parent, refNode, onNote) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'ain-midi-btn';
    b.style.cssText = 'border:1.5px solid rgba(124,58,237,.35);background:rgba(124,58,237,.1);color:#7c3aed;border-radius:10px;' +
      'padding:7px 12px;font-size:11px;font-weight:800;cursor:pointer;font-family:inherit;margin:0 6px 10px 0;';
    function render(state) {
      var t = TXT[lang()];
      var on = localStorage.getItem(KEY_MIDI) === '1';
      if (state === 'no') { b.textContent = '🎹 ' + t.no; b.disabled = true; return; }
      if (state === 'denied') { b.textContent = '🎹 ' + t.denied; return; }
      if (!on) { b.textContent = '🎹 ' + t.on; b.style.opacity = '.75'; return; }
      b.style.opacity = '1';
      b.textContent = midi.names.length ? '🎹 ' + midi.names[0] + ' ✓' : '🎹 ' + t.none;
    }
    function turnOn() {
      return midiEnable(onNote).then(function (ok) {
        if (ok) localStorage.setItem(KEY_MIDI, '1');
        render(ok ? null : 'denied');
      });
    }
    b.addEventListener('click', function () {
      if (localStorage.getItem(KEY_MIDI) === '1' && midi.access) {
        localStorage.setItem(KEY_MIDI, '0');
        var i = midi.handlers.indexOf(onNote); if (i >= 0) midi.handlers.splice(i, 1);
        render();
      } else turnOn();
    });
    midi.onchange = function () { render(); };
    parent.insertBefore(b, refNode || null);
    if (!midiSupported()) { b.style.display = 'none'; return b; } // на устройствах без Web MIDI кнопку не показываем
    if (localStorage.getItem(KEY_MIDI) === '1') turnOn(); else render();
    return b;
  }

  window.AIN = {
    mic: { start: micStart, stop: micStop, isOn: function () { return mic.on; } },
    midi: { enable: midiEnable, button: midiButton, supported: midiSupported, handlers: midi.handlers, _msg: midiMsg },
    yin: yin, freqToMidi: freqToMidi, midiToFreq: midiToFreq, midiName: midiName, NOTES: NOTES
  };
})();
