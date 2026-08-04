#!/usr/bin/env node
/**
 * Лёгкий smoke-тест для модулей «Музграмота».
 *
 * Каждый модуль — самостоятельный index.html с inline-скриптами (без сборки,
 * без внешних зависимостей). Полноценный запуск в браузере для CI избыточен,
 * но самую частую регрессию — синтаксическую ошибку в JS (пропущенная скобка,
 * лишняя запятая, битый шаблонный литерал и т.п.) — можно поймать быстро и
 * без браузера: достаточно распарсить содержимое каждого <script> тега как
 * функцию, не выполняя её.
 *
 * Это НЕ полноценный тест логики модулей — только проверка, что JS вообще
 * валиден. Он не поймает опечатки в именах переменных, которые всплывают
 * только в runtime, недостижимый код, дублирующиеся id и т.п.
 *
 * Запуск:  node tools/smoke-test.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SKIP_DIRS = new Set(['node_modules', '.git', 'tools', 'Новая папка']);

function findIndexFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      out.push(...findIndexFiles(path.join(dir, entry.name)));
    } else if (entry.isFile() && entry.name === 'index.html') {
      out.push(path.join(dir, entry.name));
    }
  }
  return out;
}

function extractInlineScripts(html) {
  const scripts = [];
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    const attrs = m[1] || '';
    if (/\bsrc\s*=/.test(attrs)) continue; // внешний скрипт — нечего проверять
    if (/type\s*=\s*["'](?!text\/javascript|module)/i.test(attrs) && !/type\s*=\s*["']?$/.test(attrs)) {
      // Пропускаем не-JS скрипты (application/ld+json и т.п.), но обычный
      // <script> без type или с type="text/javascript" проверяем.
      if (/application\/(ld\+json|json)/i.test(attrs)) continue;
    }
    scripts.push(m[2]);
  }
  return scripts;
}

function checkFile(file) {
  const html = fs.readFileSync(file, 'utf8');
  const scripts = extractInlineScripts(html);
  const errors = [];
  scripts.forEach((code, i) => {
    try {
      // eslint-disable-next-line no-new-func
      new Function(code);
    } catch (e) {
      errors.push({ scriptIndex: i, message: e.message });
    }
  });
  return { file, scriptCount: scripts.length, errors };
}

function main() {
  const files = findIndexFiles(ROOT);
  let totalErrors = 0;
  console.log(`Проверяю ${files.length} файлов index.html...\n`);
  for (const file of files) {
    const rel = path.relative(ROOT, file);
    const { scriptCount, errors } = checkFile(file);
    if (errors.length) {
      totalErrors += errors.length;
      console.log(`✗ ${rel} — ${errors.length} ошибка(ок) из ${scriptCount} скриптов:`);
      for (const err of errors) {
        console.log(`    [script #${err.scriptIndex}] ${err.message}`);
      }
    } else {
      console.log(`✓ ${rel} (${scriptCount} inline-скриптов, ок)`);
    }
  }
  console.log('');
  if (totalErrors) {
    console.log(`Итог: найдено ${totalErrors} синтаксических ошибок.`);
    process.exit(1);
  } else {
    console.log('Итог: синтаксических ошибок не найдено.');
    process.exit(0);
  }
}

main();
