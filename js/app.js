/*
 * Magical Camp Save Editor - UI.
 * Everything runs locally in the browser. See README.txt.
 */
(function () {
  'use strict';

  var D = window.MC_DATA, C = window.MC_CURATED, Store = window.Store;
  var FIX_MIN = -1073741824, FIX_MAX = 1073741823;

  /* ------------------------------------------------------------------ helpers */

  function h(tag, attrs) {
    var el = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v === undefined || v === null || v === false) return;
        if (k === 'class') el.className = v;
        else if (k === 'text') el.textContent = v;
        else if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2), v);
        else if (k === 'value' || k === 'checked' || k === 'disabled' || k === 'open') el[k] = v;
        else el.setAttribute(k, v === true ? '' : v);
      });
    }
    for (var i = 2; i < arguments.length; i++) add(el, arguments[i]);
    return el;
  }
  function add(el, c) {
    if (c === null || c === undefined || c === false) return;
    if (Array.isArray(c)) { c.forEach(function (x) { add(el, x); }); return; }
    el.appendChild(typeof c === 'object' ? c : document.createTextNode(String(c)));
  }
  function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }
  function $(id) { return document.getElementById(id); }
  function keys(o) { return Object.keys(o); }
  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
  function fmt(n) { return Number(n).toLocaleString(); }

  function toast(msg, kind, ms) {
    var t = h('div', { class: 'toast' + (kind === 'err' ? ' err' : kind === 'warn' ? ' warn' : '') }, msg);
    $('toasts').appendChild(t);
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, ms || (kind === 'err' ? 9000 : 4500));
  }

  function modal(opts) {
    var bg = h('div', { class: 'modal-bg', role: 'dialog', 'aria-modal': 'true' });
    var box = h('div', { class: 'modal' }, h('h3', { text: opts.title || '' }), opts.body);
    var actions = h('div', { class: 'actions' });
    function close() { if (bg.parentNode) bg.parentNode.removeChild(bg); }
    (opts.actions || [{ label: 'OK', kind: 'primary' }]).forEach(function (a) {
      actions.appendChild(h('button', {
        class: 'btn ' + (a.kind || ''), type: 'button',
        onclick: function () { close(); if (a.onClick) a.onClick(); }
      }, a.label));
    });
    box.appendChild(actions);
    bg.appendChild(box);
    document.body.appendChild(bg);
    var first = actions.querySelector('.primary') || actions.lastChild;
    if (first) first.focus();
    return close;
  }
  function confirmBox(title, body, okLabel, danger) {
    return new Promise(function (resolve) {
      modal({
        title: title, body: typeof body === 'string' ? h('p', { text: body }) : body,
        actions: [
          { label: 'Cancel', kind: 'ghost', onClick: function () { resolve(false); } },
          { label: okLabel || 'Continue', kind: danger ? 'danger' : 'primary', onClick: function () { resolve(true); } }
        ]
      });
    });
  }
  function errorBox(title, msg) {
    modal({ title: title, body: h('p', { text: msg }), actions: [{ label: 'OK', kind: 'primary' }] });
  }
  var busyEl = null;
  function busy(msg) {
    if (busyEl && busyEl.parentNode) busyEl.parentNode.removeChild(busyEl);
    busyEl = null;
    if (msg) {
      busyEl = h('div', { class: 'modal-bg' }, h('div', { class: 'modal' }, h('h3', { text: msg }), h('p', { class: 'muted', text: 'Please wait...' })));
      document.body.appendChild(busyEl);
    }
  }

  function cleanDesc(s) {
    if (!s) return '';
    return s
      .replace(/\\N\[(\d+)\]/gi, function (m, i) { return D.actors[i] || ''; })
      .replace(/\\[A-Za-z]+\[\d+\]/g, '')
      .replace(/\\[{}$.|!><^]/g, '')
      .replace(/\r/g, '')
      .trim();
  }

  /* ------------------------------------------------------------------ data lookups */

  var DB = { items: {}, weapons: {}, armors: {} };
  D.items.forEach(function (x) { DB.items[x.id] = x; });
  D.weapons.forEach(function (x) { DB.weapons[x.id] = x; });
  D.armors.forEach(function (x) { DB.armors[x.id] = x; });
  function isDivider(n) { return /^\s*[-=_*~]{2,}.*[-=_*~]{2,}\s*$/.test(n); }
  function dbName(kind, id) { var x = DB[kind][id]; return x ? x.n : 'Unknown #' + id; }
  function varName(id) { var u = D.vars[id]; return u && u.n ? u.n : ''; }
  function swName(id) { var u = D.switches[id]; return u && u.n ? u.n : ''; }

  /* ------------------------------------------------------------------ state */

  function newPend() {
    return { vars: {}, varText: {}, sw: {}, items: {}, weapons: {}, armors: {}, gold: undefined, actorName: {}, actorNickname: {}, skills: {} };
  }
  var S = {
    screen: 'welcome', mode: 'easy', tab: 'overview',
    sf: null, saveName: '', saveHandle: null, dirHandle: null, slots: [], backup: true,
    review: false, lastBackup: null, ack: false,
    gi: { cat: 'items', q: '', limit: 48, type: '' },
    man: { vars: { q: '', filter: 'named', hideInternal: true, limit: 80, usage: false }, switches: { q: '', filter: 'named', hideInternal: true, limit: 80, usage: false } }
  };
  var P = newPend();
  try { S.ack = localStorage.getItem('mcse_ack') === '1'; } catch (e) { /* ignore */ }

  function pendCount() {
    var n = 0;
    ['vars', 'varText', 'sw', 'items', 'weapons', 'armors', 'actorName', 'actorNickname'].forEach(function (k) { n += keys(P[k]).length; });
    keys(P.skills).forEach(function (a) { n += keys(P.skills[a]).length; });
    if (P.gold !== undefined) n++;
    return n;
  }
  function buildChanges() {
    var ch = {};
    ['vars', 'varText', 'sw', 'items', 'weapons', 'armors', 'actorName', 'actorNickname'].forEach(function (k) {
      if (keys(P[k]).length) ch[k] = P[k];
    });
    if (P.gold !== undefined) ch.gold = P.gold;
    var sk = {}, anySk = false;
    keys(P.skills).forEach(function (a) { if (keys(P.skills[a]).length) { sk[a] = P.skills[a]; anySk = true; } });
    if (anySk) ch.skills = sk;
    var dh = pendingDifficultyHeader();
    if (dh) ch.difficultyHeader = dh;
    return ch;
  }

  /** Load-screen name the game would write for the queued difficulty, or '' if none. */
  function pendingDifficultyHeader() {
    if (!(301 in P.vars)) return '';
    var name = '';
    C.difficulties.forEach(function (d) { if (d.v === P.vars[301]) name = d.name; });
    if (!name) return '';
    var node = window.Marshal.hashGet(S.sf.header, 'difficulty');
    if (!node || node.t !== 'str' || (node.enc !== 'utf8' && node.enc !== 'ascii')) return '';
    if (S.sf.headerInfo().difficulty === name) return '';
    return name;
  }

  function effVar(id) { return id in P.vars ? P.vars[id] : S.sf.getVar(id).value; }
  function effSw(id) { return id in P.sw ? P.sw[id] : S.sf.getSwitch(id); }
  function effCount(kind, id) { return id in P[kind] ? P[kind][id] : (S.sf.getInventory(kind)[id] || 0); }
  function effGold() { return P.gold !== undefined ? P.gold : S.sf.getGold(); }

  function setVar(id, v) {
    var o = S.sf.getVar(id);
    if (v === o.value) delete P.vars[id]; else P.vars[id] = v;
    chrome();
  }
  function setSw(id, v) {
    if (v === S.sf.getSwitch(id)) delete P.sw[id]; else P.sw[id] = v;
    chrome();
  }
  function setCount(kind, id, n) {
    if (n === (S.sf.getInventory(kind)[id] || 0)) delete P[kind][id]; else P[kind][id] = n;
    chrome();
  }
  function setGold(n) {
    P.gold = n === S.sf.getGold() ? undefined : n;
    chrome();
  }
  function setActorText(kind, id, text) {
    var a = S.sf.getActors().filter(function (x) { return x.id === id; })[0];
    var orig = a ? (kind === 'actorName' ? a.name : a.nickname) : '';
    if (text === orig) delete P[kind][id]; else P[kind][id] = text;
    chrome();
  }
  function setVarText(id, text) {
    if (text === S.sf.getVar(id).value) delete P.varText[id]; else P.varText[id] = text;
    chrome();
  }

  /* ------------------------------------------------------------------ reusable controls */

  function numInput(value, opts, onCommit) {
    opts = opts || {};
    var min = opts.min != null ? opts.min : FIX_MIN, max = opts.max != null ? opts.max : FIX_MAX;
    var cur = value;
    var inp = h('input', { type: 'number', value: String(value), step: '1', min: String(min), max: String(max), 'aria-label': opts.label || 'value' });
    function commit(v) {
      if (v === '' || v === null) { inp.value = String(cur); return; }
      v = Math.round(Number(v));
      if (!isFinite(v)) { inp.value = String(cur); return; }
      v = clamp(v, min, max);
      cur = v; inp.value = String(v);
      onCommit(v);
    }
    inp.addEventListener('change', function () { commit(inp.value); });
    var wrap = h('span', { class: 'stepper' },
      h('button', { type: 'button', title: 'minus 1', onclick: function () { commit(cur - 1); } }, '\u2212'),
      inp,
      h('button', { type: 'button', title: 'plus 1', onclick: function () { commit(cur + 1); } }, '+'));
    wrap.set = function (v) { cur = v; inp.value = String(v); };
    return wrap;
  }

  /* Named steps instead of a raw number. An unknown save value stays in the list until the user picks a named one. */
  function choiceSelect(value, choices, label, onCommit) {
    var sel = h('select', { class: 'choice', 'aria-label': label });
    var list = choices.slice();
    var known = false;
    for (var i = 0; i < list.length; i++) if (list[i].v === value) known = true;
    if (!known) list.unshift({ v: value, label: 'Current value (' + value + ')' });
    list.forEach(function (c) {
      sel.appendChild(h('option', { value: String(c.v), selected: c.v === value ? 'selected' : null }, c.label));
    });
    sel.addEventListener('change', function () { onCommit(Number(sel.value)); });
    sel.set = function (v) { sel.value = String(v); };
    return sel;
  }

  function rowChoices(spec) {
    if (!spec.choices) return null;
    if (typeof spec.choices === 'string') return C.choiceSets[spec.choices] || null;
    return spec.choices;
  }

  function toggle(checked, label, onChange) {
    var inp = h('input', { type: 'checkbox', checked: !!checked, 'aria-label': label });
    inp.addEventListener('change', function () { onChange(inp.checked); });
    var el = h('label', { class: 'toggle' }, inp, h('span', { class: 'track' }));
    el.input = inp;
    return el;
  }

  function seenText(id) {
    var u = D.vars[id];
    if (!u || (!u.c && !u.s)) return 'No fixed values found in the game\'s events.';
    var all = {};
    (u.c || []).concat(u.s || []).forEach(function (v) { all[v] = 1; });
    var list = keys(all).map(Number).sort(function (a, b) { return a - b; });
    return 'Values the game uses: ' + list.join(', ') + (u.mx != null && list.indexOf(u.mx) < 0 ? ' \u2026 up to ' + u.mx : '');
  }

  /* One easy-mode row for a numeric variable. */
  function varRow(spec) {
    var id = spec.v, info = D.vars[id] || { n: '' }, o = S.sf.getVar(id);
    var row = h('div', { class: 'row' });
    var hint = h('div', { class: 'hint' });
    var ctl = h('div', { class: 'ctl' });
    var ni = null;
    function upd() {
      var v = effVar(id);
      row.classList.toggle('changed', id in P.vars);
      var extra = '';
      var named = false;
      if (choices) for (var ci = 0; ci < choices.length; ci++) if (choices[ci].v === v) named = true;
      if (!named && info.mx != null && v > info.mx) extra = ' (yours is above the highest one the game checks, which is normal if the number keeps growing)';
      else if (!named && info.mn != null && v < info.mn) extra = ' (yours is below the lowest one the game checks)';
      hint.textContent = seenText(id) + extra;
      if (maxBtn) maxBtn.disabled = v >= info.mx;
    }
    var maxBtn = null;
    var choices = rowChoices(spec);
    if ((o.kind === 'int' || o.kind === 'nil') && choices) {
      ni = choiceSelect(effVar(id), choices, spec.title || spec.who, function (v) { setVar(id, v); upd(); });
      ctl.appendChild(ni);
    } else if (o.kind === 'int' || o.kind === 'nil') {
      ni = numInput(effVar(id), { label: spec.title || spec.who }, function (v) { setVar(id, v); upd(); });
      ctl.appendChild(ni);
      if (info.mx != null) {
        maxBtn = h('button', {
          class: 'btn tiny', type: 'button', title: 'Raise to the highest value the game ever checks for',
          onclick: function () { ni.set(info.mx); setVar(id, info.mx); upd(); }
        }, 'Raise to ' + info.mx);
        ctl.appendChild(maxBtn);
      }
    } else {
      ctl.appendChild(h('span', { class: 'pill warn' }, 'Not a plain number in this save'));
    }
    row.appendChild(h('div', {},
      h('div', { class: 'name' }, spec.title || spec.who),
      spec.note ? h('div', { class: 'desc' }, spec.note) : null,
      h('div', { class: 'hint' }, 'Game name: ' + (info.n || '?') + '  \u00b7  variable ' + id)));
    row.appendChild(hint);
    row.appendChild(ctl);
    upd();
    return row;
  }

  /* ------------------------------------------------------------------ color scheme */

  var THEMES = [
    { id: 'night', name: 'Night', blurb: 'Dark. Easier on the eyes. This is the default.' },
    { id: 'eric', name: 'Eric', blurb: 'Blue, like the menu early in the game.' },
    { id: 'erica', name: 'Erica', blurb: 'Pink, like the menu at the end of the game.' }
  ];
  function currentTheme() {
    var t = document.documentElement.getAttribute('data-theme');
    for (var i = 0; i < THEMES.length; i++) if (THEMES[i].id === t) return t;
    return 'night';
  }
  function applyTheme(id) {
    var ok = false;
    for (var i = 0; i < THEMES.length; i++) if (THEMES[i].id === id) ok = true;
    if (!ok) id = 'night';
    document.documentElement.setAttribute('data-theme', id);
    try { localStorage.setItem('mcse_theme', id); } catch (e) { /* ignore */ }
    return id;
  }
  function chooseTheme(id) {
    applyTheme(id);
    if (S.screen === 'welcome') renderWelcome();
    else if (S.screen === 'slots') renderSlots();
  }
  function themeControl() {
    var sel = h('select', {
      'aria-label': 'Color scheme',
      onchange: function (e) { applyTheme(e.target.value); }
    });
    THEMES.forEach(function (t) { sel.appendChild(h('option', { value: t.id, text: t.name })); });
    sel.value = currentTheme();
    return h('label', { class: 'theme-label' }, 'Colors ', sel);
  }
  function themeCard() {
    var cur = currentTheme();
    var row = h('div', { class: 'themes' });
    THEMES.forEach(function (t) {
      row.appendChild(h('button', {
        type: 'button',
        class: 'theme-pick' + (t.id === cur ? ' on' : ''),
        'aria-pressed': t.id === cur ? 'true' : 'false',
        onclick: function () { chooseTheme(t.id); }
      },
        h('span', { class: 'swatch ' + t.id, 'aria-hidden': 'true' }, h('span'), h('span'), h('span')),
        h('b', { text: t.name }),
        h('span', { class: 'blurb', text: t.blurb })));
    });
    return h('div', { class: 'card' }, h('h3', { text: 'Color scheme' }), row);
  }

  /* ------------------------------------------------------------------ welcome / slots */

  function warningCard() {
    return h('div', { class: 'card warning-box' },
      h('h3', { text: 'Please read before you start' }),
      h('ul', { class: 'steps' },
        h('li', {}, 'You edit your saves at your own discretion and risk. Wrong values can make scenes behave oddly, softlock a quest, or make a save unloadable.'),
        h('li', {}, 'This tool is unofficial, made for one build only: Magical Camp 0.5 Fin (bugfix 8c). The game is discontinued, so nobody can help you if something breaks.'),
        h('li', {}, 'An automatic backup of your save is made before every write (you can turn this off, but please don\'t). Keep your own copy of important saves too.'),
        h('li', {}, 'Close the game before saving here. If the game is running it may overwrite your edit or your edit may be overwritten by its autosave.'),
        h('li', {}, 'Many of the options in here have not actually been tested.')),
      h('label', { class: 'check', style: 'margin-top:12px' },
        h('input', {
          type: 'checkbox', checked: S.ack, id: 'ack',
          onchange: function (e) {
            S.ack = e.target.checked;
            try { localStorage.setItem('mcse_ack', S.ack ? '1' : '0'); } catch (x) { /* ignore */ }
            var b = document.querySelectorAll('[data-needs-ack]');
            for (var i = 0; i < b.length; i++) b[i].disabled = !S.ack;
          }
        }),
        h('span', {}, 'I understand. I am editing my saves at my own discretion.')));
  }

  function renderWelcome() {
    S.screen = 'welcome';
    var folderBtn = Store.hasFolderAccess ? h('button', { class: 'btn primary', 'data-needs-ack': '1', disabled: !S.ack, type: 'button', onclick: openFolder }, 'Open my game folder') : null;
    var fileInput = h('input', { type: 'file', accept: '.rvdata2', class: 'hidden', id: 'filepick' });
    fileInput.addEventListener('change', function () {
      var f = fileInput.files[0];
      if (!f) return;
      f.arrayBuffer().then(function (buf) { openBytes({ name: f.name, bytes: new Uint8Array(buf), handle: null }); });
    });
    var fileBtn = h('button', {
      class: 'btn ' + (folderBtn ? '' : 'primary'), 'data-needs-ack': '1', disabled: !S.ack, type: 'button',
      onclick: function () { fileInput.click(); }
    }, folderBtn ? 'Open a single save file (no folder access)' : 'Open a save file');

    mount(h('div', { class: 'welcome' },
      h('h1', { text: 'Magical Camp Save Editor' }),
      h('p', { class: 'muted' }, 'Edit your Magical Camp (v0.5 Fin, bugfix 8c) saves: relationships, Eric(a)\'s stats, items, gold, story switches - or any switch and variable by hand. Everything happens in this browser tab; nothing is uploaded.'),
      themeCard(),
      warningCard(),
      h('div', { class: 'card' },
        h('h3', { text: 'Open a save' }),
        folderBtn ? h('p', {}, 'Pick the game folder (the one containing ', h('code', { text: 'Game.exe' }), ' and ', h('code', { text: 'Save01.rvdata2' }), '). The editor can then save in place and keep backups next to your saves.') :
          h('p', { class: 'warn hint' }, 'This browser cannot access folders, so saves are opened with a normal file picker and the edited save plus a backup of the original are sent to your Downloads folder. Use Chrome or Edge for in-place saving and automatic backup folders.'),
        h('div', { style: 'display:flex;gap:10px;flex-wrap:wrap' }, folderBtn, fileBtn, fileInput)),
      h('div', { class: 'card' },
        h('h3', { text: 'How the safety net works' }),
        h('ul', { class: 'steps' },
          h('li', {}, 'Your changes are only queued until you press Save. Nothing touches the file before that.'),
          h('li', {}, 'On Save, the original is copied to ', h('code', { text: 'SaveEditorBackups' }), ' (inside your game folder) as ', h('code', { text: 'Save01_2026-10-08_22-33-00.rvdata2' }), '. Restore any copy from the Backups page.'),
          h('li', {}, 'The editor changes only the bytes it needs to. Afterwards it re-reads the result and compares the whole save to the original - if anything unexpected differs, it refuses to write.'),
          h('li', {}, 'After writing, the file on disk is read back and checked. If that fails, your original is put back automatically.')))));
  }

  async function openFolder() {
    try {
      var dir = await Store.pickFolder();
      busy('Reading saves...');
      var slots = await Store.listSaves(dir);
      busy(null);
      if (!slots.length) {
        errorBox('No saves found', 'That folder has no Save*.rvdata2 files. Pick the game folder (where Game.exe and Save01.rvdata2 are).');
        return;
      }
      S.dirHandle = dir; S.slots = slots;
      renderSlots();
    } catch (e) {
      busy(null);
      if (e && e.name === 'AbortError') return;
      errorBox('Could not open the folder', (e && e.message) || String(e));
    }
  }

  async function refreshSlots() {
    S.slots = await Store.listSaves(S.dirHandle);
  }

  function renderSlots() {
    S.screen = 'slots';
    var grid = h('div', { class: 'slots' });
    S.slots.forEach(function (sl) {
      var info = SaveFile.peek(sl.bytes);
      grid.appendChild(h('button', { class: 'slot', type: 'button', disabled: !info, onclick: function () { openBytes(sl); } },
        h('b', {}, Store.baseName(sl.name)),
        h('div', { class: 'meta' }, info ? 'Play time ' + (info.playtime || '?') + (info.difficulty ? ' \u00b7 ' + info.difficulty : '') : 'Not a readable VX Ace save'),
        h('div', { class: 'meta' }, new Date(sl.modified).toLocaleString() + ' \u00b7 ' + Math.round(sl.size / 1024) + ' KB')));
    });
    mount(h('div', { class: 'welcome' },
      h('h1', { text: 'Choose a save' }),
      h('p', { class: 'muted' }, 'Folder: ' + S.dirHandle.name + '. Only the file you open is ever changed.'),
      h('div', { class: 'card' }, grid),
      h('p', { style: 'display:flex;gap:12px;align-items:center;flex-wrap:wrap' },
        h('button', { class: 'btn ghost', type: 'button', onclick: function () { renderWelcome(); } }, 'Back'),
        themeControl())));
  }

  function openBytes(slot) {
    try {
      busy('Reading save...');
      setTimeout(function () {
        try {
          var sf = new SaveFile(slot.bytes, slot.name);
          S.sf = sf; S.saveName = slot.name; S.saveHandle = slot.handle || null;
          P = newPend();
          S.tab = S.mode === 'easy' ? 'overview' : 'mvars';
          busy(null);
          renderShell();
          if (sf.getVersionId() !== null && D.versionId && sf.getVersionId() !== D.versionId) {
            toast('This save looks like it was made with a different build of the game. Editing still works, but variable meanings may differ.', 'warn', 12000);
          }
        } catch (e) {
          busy(null);
          errorBox('Could not open this save', e.message);
        }
      }, 30);
    } catch (e) { busy(null); errorBox('Could not open this save', e.message); }
  }

  /* ------------------------------------------------------------------ shell */

  function mount(node) { var a = $('app'); clear(a); a.appendChild(node); }

  var EASY_TABS = [
    ['overview', 'Overview'], ['relations', 'Relationships'], ['eric', 'Eric(a)'],
    ['give', 'Give items'], ['inventory', 'Inventory & gold'], ['toggles', 'Quick toggles'],
    ['hidden', 'Hidden content']
  ];
  var MANUAL_TABS = [['mvars', 'Variables'], ['mswitches', 'Switches']];

  var refs = {};

  function renderShell() {
    S.screen = 'editor';
    refs = {};
    refs.nav = h('nav', { class: 'nav', 'aria-label': 'Sections' });
    refs.content = h('main', { class: 'content', id: 'content' });
    refs.count = h('span', { class: 'count' });
    refs.save = h('button', { class: 'btn primary', type: 'button', onclick: doSave }, 'Save changes');
    refs.review = h('button', { class: 'btn', type: 'button', onclick: function () { S.review = !S.review; chrome(); } }, 'Review changes');
    refs.discard = h('button', { class: 'btn ghost', type: 'button', onclick: discardAll }, 'Discard all');
    refs.backupCheck = h('input', { type: 'checkbox', checked: S.backup, id: 'bk' });
    refs.backupCheck.addEventListener('change', function () { S.backup = refs.backupCheck.checked; chrome(); });
    refs.backupNote = h('span', { class: 'hint' });
    refs.drawer = h('div', { class: 'drawer hidden' });
    refs.modeSeg = h('div', { class: 'seg', role: 'tablist' },
      h('button', { type: 'button', 'data-mode': 'easy', onclick: function () { setMode('easy'); } }, 'Easy mode'),
      h('button', { type: 'button', 'data-mode': 'manual', onclick: function () { setMode('manual'); } }, 'Manual mode'));

    var shell = h('div', { class: 'shell' },
      h('header', { class: 'topbar' },
        h('span', { class: 'brand' }, 'Magical Camp Save Editor'),
        refs.modeSeg,
        h('span', { class: 'spacer' }),
        themeControl(),
        h('span', { class: 'pill acc', title: 'Currently open save' }, S.saveName),
        h('button', { class: 'btn ghost tiny', type: 'button', onclick: switchSave }, 'Switch save')),
      refs.nav, refs.content,
      h('footer', { class: 'bar' },
        refs.count, refs.review, refs.discard,
        h('span', { class: 'spacer' }),
        h('label', { class: 'check', for: 'bk' }, refs.backupCheck, h('span', {}, 'Back up the original before saving')),
        refs.backupNote,
        refs.save),
      refs.drawer);
    mount(shell);
    renderTab();
    chrome();
  }

  function setMode(m) {
    S.mode = m;
    var easyIds = EASY_TABS.map(function (t) { return t[0]; });
    if (m === 'easy' && easyIds.indexOf(S.tab) < 0 && S.tab !== 'backups') S.tab = 'overview';
    if (m === 'manual' && (easyIds.indexOf(S.tab) >= 0)) S.tab = 'mvars';
    renderTab(); chrome();
  }
  function goTab(t) { S.tab = t; renderTab(); chrome(); if (refs.content) refs.content.scrollTop = 0; }

  async function switchSave() {
    if (pendCount() && !(await confirmBox('Discard unsaved changes?', 'You have ' + pendCount() + ' queued change(s) that have not been saved.', 'Discard and switch', true))) return;
    P = newPend();
    if (S.dirHandle) { try { await refreshSlots(); } catch (e) { /* ignore */ } renderSlots(); } else renderWelcome();
  }
  async function discardAll() {
    if (!pendCount()) return;
    if (!(await confirmBox('Discard all queued changes?', 'Nothing has been written yet, so this just resets the queue.', 'Discard', true))) return;
    P = newPend(); S.review = false; renderTab(); chrome();
  }

  /* Updates the parts of the UI that depend on the pending changes (cheap; no page rebuild). */
  function chrome() {
    if (S.screen !== 'editor' || !refs.nav) return;
    var n = pendCount();
    refs.count.textContent = n ? n + ' queued change' + (n > 1 ? 's' : '') : 'No changes queued';
    refs.count.classList.toggle('zero', !n);
    refs.save.disabled = !n; refs.discard.disabled = !n; refs.review.disabled = !n;
    Array.prototype.forEach.call(refs.modeSeg.children, function (b) { b.classList.toggle('on', b.getAttribute('data-mode') === S.mode); });
    refs.backupNote.textContent = S.backup
      ? (S.dirHandle ? '\u2192 ' + S.dirHandle.name + '\\' + Store.BACKUP_DIR + '\\' : '\u2192 your Downloads folder (browser limitation)')
      : 'No backup will be made!';
    refs.backupNote.classList.toggle('warn', !S.backup);

    // nav
    clear(refs.nav);
    function navBtn(t, badge) {
      var b = h('button', { type: 'button', class: S.tab === t[0] ? 'on' : '', onclick: function () { goTab(t[0]); } }, t[1]);
      if (badge) b.appendChild(h('span', { class: 'badge' }, String(badge)));
      refs.nav.appendChild(b);
    }
    if (S.mode === 'easy') {
      refs.nav.appendChild(h('h4', {}, 'Easy mode'));
      EASY_TABS.forEach(function (t) { navBtn(t, tabBadge(t[0])); });
    } else {
      refs.nav.appendChild(h('h4', {}, 'Manual mode'));
      MANUAL_TABS.forEach(function (t) { navBtn(t, tabBadge(t[0])); });
    }
    refs.nav.appendChild(h('h4', {}, 'Safety'));
    navBtn(['backups', 'Backups']);

    // drawer
    refs.drawer.classList.toggle('hidden', !(S.review && n));
    if (S.review && n) fillDrawer();
  }

  function tabBadge(t) {
    var n = 0;
    if (t === 'relations') C.relationships.forEach(function (r) { if (r.v in P.vars) n++; });
    else if (t === 'eric') {
      C.progress.concat(C.body, C.mind).forEach(function (r) { if (r.v in P.vars) n++; });
      if (P.skills[C.spellActor]) n += keys(P.skills[C.spellActor]).length;
    }
    else if (t === 'give' || t === 'inventory') n = keys(P.items).length + keys(P.weapons).length + keys(P.armors).length + (t === 'inventory' && P.gold !== undefined ? 1 : 0);
    else if (t === 'toggles') C.toggles.forEach(function (x) { if (x.sw in P.sw) n++; });
    else if (t === 'hidden') {
      if (301 in P.vars) n++;
      C.hiddenGrants.forEach(function (g) { if (g.id in P[g.kind]) n++; });
    }
    else if (t === 'mvars') n = keys(P.vars).length + keys(P.varText).length;
    else if (t === 'mswitches') n = keys(P.sw).length;
    else if (t === 'overview') n = keys(P.actorName).length + keys(P.actorNickname).length;
    return n;
  }

  function pendList() {
    var out = [];
    keys(P.vars).forEach(function (id) {
      var label = (varName(id) || 'Variable') + '  (variable ' + id + ')';
      if (+id === 301 && pendingDifficultyHeader()) label += '  ·  load screen will say ' + pendingDifficultyHeader();
      out.push({ label: label, from: S.sf.getVar(+id).value, to: P.vars[id], revert: function () { delete P.vars[id]; } });
    });
    keys(P.varText).forEach(function (id) {
      out.push({ label: (varName(id) || 'Text variable') + '  (variable ' + id + ')', from: '"' + S.sf.getVar(+id).value + '"', to: '"' + P.varText[id] + '"', revert: function () { delete P.varText[id]; } });
    });
    keys(P.sw).forEach(function (id) {
      out.push({ label: (swName(id) || 'Switch') + '  (switch ' + id + ')', from: S.sf.getSwitch(+id) ? 'ON' : 'OFF', to: P.sw[id] ? 'ON' : 'OFF', revert: function () { delete P.sw[id]; } });
    });
    [['items', 'Item'], ['weapons', 'Weapon'], ['armors', 'Armor']].forEach(function (k) {
      keys(P[k[0]]).forEach(function (id) {
        out.push({ label: k[1] + ': ' + dbName(k[0], id), from: S.sf.getInventory(k[0])[id] || 0, to: P[k[0]][id], revert: function () { delete P[k[0]][id]; } });
      });
    });
    if (P.gold !== undefined) out.push({ label: 'Gold', from: fmt(S.sf.getGold()), to: fmt(P.gold), revert: function () { P.gold = undefined; } });
    var acts = S.sf.getActors();
    function actor(id) { return acts.filter(function (a) { return a.id === +id; })[0] || {}; }
    keys(P.actorName).forEach(function (id) { out.push({ label: 'Name of actor ' + id, from: '"' + actor(id).name + '"', to: '"' + P.actorName[id] + '"', revert: function () { delete P.actorName[id]; } }); });
    keys(P.actorNickname).forEach(function (id) { out.push({ label: 'Nickname of ' + (actor(id).name || 'actor ' + id), from: '"' + actor(id).nickname + '"', to: '"' + P.actorNickname[id] + '"', revert: function () { delete P.actorNickname[id]; } }); });
    keys(P.skills).forEach(function (actorId) {
      keys(P.skills[actorId]).forEach(function (id) {
        var sp = null;
        C.spells.forEach(function (s) { if (s.id === +id) sp = s; });
        var who = actor(+actorId).name || ('actor ' + actorId);
        out.push({
          label: (sp ? sp.name : ('Spell ' + id)) + '  (' + who + ')',
          from: S.sf.getSkills(+actorId).indexOf(+id) >= 0 ? 'Known' : 'Not known',
          to: P.skills[actorId][id] ? 'Known' : 'Not known',
          revert: function () { delete P.skills[actorId][id]; }
        });
      });
    });
    return out;
  }

  function fillDrawer() {
    clear(refs.drawer);
    refs.drawer.appendChild(h('h3', {}, 'Queued changes (not saved yet)'));
    pendList().forEach(function (c) {
      refs.drawer.appendChild(h('div', { class: 'line' },
        h('span', { class: 'what' }, c.label),
        h('span', { class: 'muted' }, String(c.from)), h('span', { class: 'arrow' }, '\u2192'), h('b', {}, String(c.to)),
        h('button', { class: 'btn tiny ghost', type: 'button', title: 'Undo this change', onclick: function () { c.revert(); renderTab(); chrome(); } }, 'Undo')));
    });
  }

  function renderTab() {
    if (!refs.content) return;
    clear(refs.content);
    var page;
    switch (S.tab) {
      case 'overview': page = pageOverview(); break;
      case 'relations': page = pageRelations(); break;
      case 'eric': page = pageEric(); break;
      case 'give': page = pageGive(); break;
      case 'inventory': page = pageInventory(); break;
      case 'toggles': page = pageToggles(); break;
      case 'hidden': page = pageHidden(); break;
      case 'mvars': page = pageManual('vars'); break;
      case 'mswitches': page = pageManual('switches'); break;
      case 'backups': page = pageBackups(); break;
      default: page = h('div', {}, 'Unknown page');
    }
    refs.content.appendChild(h('div', { class: 'page' }, page));
  }

  function pagehead(title, text) { return h('div', { class: 'pagehead' }, h('h2', { text: title }), text ? h('p', { text: text }) : null); }

  /* ------------------------------------------------------------------ pages: easy */

  function textRow(title, desc, value, editable, onCommit, extra) {
    var inp = h('input', { type: 'text', value: value, disabled: !editable, 'aria-label': title, style: 'min-width:14em' });
    var row = h('div', { class: 'row' },
      h('div', {}, h('div', { class: 'name' }, title)),
      extra || h('div', { class: 'desc' }, desc),
      h('div', { class: 'ctl' }, inp));
    inp.addEventListener('input', function () { onCommit(inp.value, row); });
    return row;
  }

  function pageOverview() {
    var sf = S.sf, info = sf.headerInfo(), acts = sf.getActors();
    var eric = acts.filter(function (a) { return a.id === 1; })[0], erica = acts.filter(function (a) { return a.id === 2; })[0];
    var page = h('div', {});
    page.appendChild(pagehead('Overview', 'A summary of the save you opened, plus the places most people want to go.'));
    if (sf.getVersionId() !== null && D.versionId && sf.getVersionId() !== D.versionId) {
      page.appendChild(h('div', { class: 'card warning-box', style: 'margin-bottom:14px' },
        h('b', {}, 'Different game build detected. '),
        'This save was made with a different build of Magical Camp than the one this editor was made for. Variable and switch meanings may not match.'));
    }
    page.appendChild(h('div', { class: 'grid2' },
      stat('File', S.saveName), stat('Play time', info.playtime || '?'), stat('Difficulty (slot label)', info.difficulty || '?'),
      stat('Gold', fmt(sf.getGold())), stat('Switches / variables in save', sf.switchCount() + ' / ' + sf.varCount()),
      stat('Items owned', keys(sf.getInventory('items')).length + ' kinds')));

    var names = h('div', { class: 'listcard', style: 'margin-top:18px' }, h('h3', {}, 'Names & title'));
    if (eric) {
      names.appendChild(textRow('Eric - current title (nickname)', 'The title shown under Eric(a)\'s name, e.g. "Girly Girl". The game recomputes it at certain story events, so it may change back later.', eric.nickname, eric.nicknameEditable,
        function (v, row) { setActorText('actorNickname', 1, v); row.classList.toggle('changed', 1 in P.actorNickname); }));
      names.appendChild(textRow('Eric - name', 'Name used for the main character.', eric.name, eric.nameEditable,
        function (v, row) { setActorText('actorName', 1, v); row.classList.toggle('changed', 1 in P.actorName); }));
    }
    if (erica) {
      names.appendChild(textRow('Erica - name', 'Name used once Eric is female. The game also keeps some names in text variables (e.g. variable 1 and 4909-4920) - edit those in Manual mode if needed.', erica.name, erica.nameEditable,
        function (v, row) { setActorText('actorName', 2, v); row.classList.toggle('changed', 2 in P.actorName); }));
    }
    page.appendChild(names);

    page.appendChild(h('div', { class: 'card', style: 'margin-top:18px' },
      h('h3', {}, 'Where to next?'),
      h('div', { style: 'display:flex;gap:8px;flex-wrap:wrap' },
        goBtn('Relationships', 'relations'), goBtn('Eric(a)\'s stats', 'eric'), goBtn('Give items', 'give'), goBtn('Inventory & gold', 'inventory'), goBtn('Quick toggles', 'toggles'), goBtn('Hidden content', 'hidden')),
      h('p', { class: 'hint', style: 'margin-top:10px' }, 'Everything you change is queued first. Use "Review changes" at the bottom to see exactly what will be written.')));
    return page;
  }
  function stat(k, v) { return h('div', { class: 'stat' }, h('div', { class: 'k' }, k), h('div', { class: 'v' }, v)); }
  function goBtn(label, tab) { return h('button', { class: 'btn', type: 'button', onclick: function () { goTab(tab); } }, label); }

  function pageRelations() {
    var page = h('div', {});
    page.appendChild(pagehead('Relationships', 'Affection values for the girls. The game tracks these as plain numbers and unlocks scenes at specific thresholds - the hint under each row lists the numbers the game actually checks for.'));
    var card = h('div', { class: 'listcard' });
    C.relationships.forEach(function (r) { card.appendChild(varRow({ v: r.v, title: r.who, note: r.note })); });
    page.appendChild(card);
    page.appendChild(h('div', { class: 'card explain' }, h('b', {}, 'Tip: '), 'Raising a number does not replay the scenes leading up to it. If a scene looks like it is "skipped", the girl may still need the usual trigger (talk to her, a day passing, or a specific event) before it plays. Setting a value higher than the game ever checks for does nothing useful, so the "Raise to ..." buttons give you the highest value that matters.'));
    return page;
  }

  function pageEric() {
    var page = h('div', {});
    page.appendChild(pagehead('Eric(a)', 'Transformation progress and body values. Where the mirror names a step, that row is a list of those names. The hint under each row still shows the numbers the game\'s events actually use.'));
    [['Progress', C.progress], ['Body', C.body], ['Mind & behaviour', C.mind]].forEach(function (sec) {
      var card = h('div', { class: 'listcard' }, h('h3', {}, sec[0]));
      sec[1].forEach(function (r) { card.appendChild(varRow(r)); });
      page.appendChild(card);
    });
    page.appendChild(spellCard());
    page.appendChild(h('div', { class: 'card explain' }, h('b', {}, 'Note: '), 'Many of these values are only turned into sprites, outfits and dialogue when the matching story event runs (for example a transformation scene or the mirror). If nothing visibly changes right away, that is why. Unsure about a value? Look it up in Manual mode, where each entry lists the events that read and write it.'));
    return page;
  }

  function knownSkill(id) {
    var list = S.sf.getSkills(C.spellActor);
    var orig = !!(list && list.indexOf(id) >= 0);
    var pend = P.skills[C.spellActor];
    if (pend && (id in pend)) return !!pend[id];
    return orig;
  }
  function setSkill(id, on) {
    var actorId = C.spellActor;
    var list = S.sf.getSkills(actorId) || [];
    var orig = list.indexOf(id) >= 0;
    if (!P.skills[actorId]) P.skills[actorId] = {};
    if (!!on === orig) delete P.skills[actorId][id];
    else P.skills[actorId][id] = !!on;
  }
  function spellCard() {
    var card = h('div', { class: 'listcard' }, h('h3', {}, 'Spells'));
    var known = S.sf.getSkills(C.spellActor);
    if (!known) {
      card.appendChild(h('p', { class: 'desc' }, 'This save does not keep Erica\'s spells as a simple list, so they were left unchanged.'));
      return card;
    }
    card.appendChild(h('p', { class: 'desc', style: 'padding:0 12px' }, 'These are spells the story teaches to Erica, the character who is in your party and casts them. Turning one on adds it to her spell list. It does not play the scene that normally teaches it.'));
    C.spells.forEach(function (sp) {
      var row = h('div', { class: 'row' });
      function upd() { row.classList.toggle('changed', !!(P.skills[C.spellActor] && sp.id in P.skills[C.spellActor])); }
      var tg = toggle(knownSkill(sp.id), sp.name, function (v) { setSkill(sp.id, v); upd(); chrome(); });
      row.appendChild(h('div', {}, h('div', { class: 'name' }, sp.name), h('div', { class: 'hint' }, 'Spell ' + sp.id)));
      row.appendChild(h('div', { class: 'desc' }, sp.note));
      row.appendChild(h('div', { class: 'ctl' }, tg));
      upd();
      card.appendChild(row);
    });
    return card;
  }

  /* ---- give items ---- */

  var GIVE_CATS = [['items', 'Items'], ['key', 'Key items'], ['weapons', 'Weapons'], ['armors', 'Armor & accessories']];

  function giveList() {
    var st = S.gi, q = st.q.trim().toLowerCase(), list, kind;
    if (st.cat === 'items') { kind = 'items'; list = D.items.filter(function (x) { return x.k !== 2; }); }
    else if (st.cat === 'key') { kind = 'items'; list = D.items.filter(function (x) { return x.k === 2; }); }
    else if (st.cat === 'weapons') { kind = 'weapons'; list = D.weapons; }
    else { kind = 'armors'; list = D.armors; }
    if (st.cat === 'armors' && st.type) list = list.filter(function (x) { return String(x.t) === st.type; });
    list = list.filter(function (x) { return !isDivider(x.n); });
    if (q) list = list.filter(function (x) { return x.n.toLowerCase().indexOf(q) >= 0 || cleanDesc(x.d).toLowerCase().indexOf(q) >= 0 || String(x.id) === q; });
    return { kind: kind, list: list };
  }

  function itemCard(kind, it) {
    var owned = effCount(kind, it.id), orig = S.sf.getInventory(kind)[it.id] || 0;
    var qty = h('input', { type: 'number', value: '1', min: '1', max: String(C.itemCap), 'aria-label': 'quantity' });
    var tip = kind === 'items' && C.itemTips[it.id];
    var meta = [];
    if (kind === 'weapons') meta.push(D.wtypes[it.t] || '');
    if (kind === 'armors') { meta.push(D.atypes[it.t] || ''); if (C.armorSlots[it.e]) meta.push(C.armorSlots[it.e]); }
    var card = h('div', { class: 'item' + (owned !== orig ? ' queued' : '') },
      h('div', { class: 't' }, h('b', {}, it.n), h('span', { class: 'pill ' + (owned ? 'good' : '') }, 'You have ' + owned + (owned !== orig ? ' (was ' + orig + ')' : ''))),
      meta.length ? h('div', { class: 'hint' }, meta.filter(Boolean).join(' \u00b7 ') + '  \u00b7  id ' + it.id) : h('div', { class: 'hint' }, 'id ' + it.id),
      h('div', { class: 'd' }, cleanDesc(it.d) || 'No description.'),
      tip ? h('div', { class: 'tip' }, tip) : null,
      h('div', { class: 'act' }, qty,
        h('button', {
          class: 'btn tiny primary', type: 'button', disabled: owned >= C.itemCap,
          onclick: function () {
            var q = clamp(Math.round(Number(qty.value) || 1), 1, C.itemCap);
            var cur = effCount(kind, it.id), nv = Math.min(C.itemCap, cur + q);
            if (nv === cur) { toast('Already at the maximum stack (' + C.itemCap + ').', 'warn'); return; }
            setCount(kind, it.id, nv);
            card.replaceWith(itemCard(kind, it));
            toast('Queued: ' + it.n + ' \u00d7' + (nv - cur) + ' (you will have ' + nv + ')');
          }
        }, owned >= C.itemCap ? 'Max' : 'Add to save'),
        owned !== orig ? h('button', { class: 'btn tiny ghost', type: 'button', onclick: function () { setCount(kind, it.id, orig); card.replaceWith(itemCard(kind, it)); } }, 'Undo') : null));
    return card;
  }

  function pageGive() {
    var st = S.gi, page = h('div', {});
    page.appendChild(pagehead('Give items', 'Add things to your inventory. Pick a category, search, set an amount and press "Add to save". The game caps each stack at ' + C.itemCap + '. Items are queued until you press Save.'));
    var search = h('input', { type: 'search', placeholder: 'Search by name or description...', value: st.q, 'aria-label': 'Search items' });
    var typeSel = h('select', { 'aria-label': 'Armor type' }, h('option', { value: '' }, 'All armor types'));
    var usedTypes = {};
    D.armors.forEach(function (a) { usedTypes[a.t] = 1; });
    keys(usedTypes).map(Number).sort(function (a, b) { return a - b; }).forEach(function (t) { typeSel.appendChild(h('option', { value: String(t), selected: String(t) === st.type ? 'selected' : null }, D.atypes[t] || ('Type ' + t))); });
    typeSel.addEventListener('change', function () { st.type = typeSel.value; st.limit = 48; fill(); });
    var tabs = h('div', { class: 'tabs' });
    var grid = h('div', { class: 'items' });
    var more = h('div', { class: 'more' });
    function fill() {
      Array.prototype.forEach.call(tabs.children, function (b) { b.classList.toggle('on', b.getAttribute('data-cat') === st.cat); });
      typeSel.classList.toggle('hidden', st.cat !== 'armors');
      var r = giveList();
      clear(grid); clear(more);
      r.list.slice(0, st.limit).forEach(function (it) { grid.appendChild(itemCard(r.kind, it)); });
      if (!r.list.length) grid.appendChild(h('p', { class: 'muted' }, 'Nothing matches.'));
      if (r.list.length > st.limit) {
        more.appendChild(h('button', { class: 'btn', type: 'button', onclick: function () { st.limit += 48; fill(); } }, 'Show more (' + (r.list.length - st.limit) + ' left)'));
      }
      more.appendChild(h('div', { class: 'hint' }, r.list.length + ' result' + (r.list.length === 1 ? '' : 's')));
    }
    GIVE_CATS.forEach(function (c) {
      tabs.appendChild(h('button', { type: 'button', 'data-cat': c[0], onclick: function () { st.cat = c[0]; st.limit = 48; fill(); } }, c[1]));
    });
    var timer;
    search.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(function () { st.q = search.value; st.limit = 48; fill(); }, 120); });
    page.appendChild(h('div', { class: 'toolbar' }, tabs));
    page.appendChild(h('div', { class: 'toolbar' }, search, typeSel));
    page.appendChild(grid); page.appendChild(more);
    fill();
    page.appendChild(h('div', { class: 'card explain', style: 'margin-top:14px' }, h('b', {}, 'About key items: '),
      'Key items are quest objects the game checks for directly (for example the Cursed Wig). Adding one gives you the object but not the story progress that normally comes with it. Some quests also need a switch - see Quick toggles.'));
    return page;
  }

  function pageInventory() {
    var page = h('div', {});
    page.appendChild(pagehead('Inventory & gold', 'Everything you currently own. Set a quantity to 0 to remove an entry. Use "Give items" to add new things.'));
    var goldInput = numInput(effGold(), { min: 0, max: C.goldCap, label: 'Gold' }, function (v) { setGold(v); goldRow.classList.toggle('changed', P.gold !== undefined); });
    var goldRow = h('div', { class: 'row' + (P.gold !== undefined ? ' changed' : '') },
      h('div', {}, h('div', { class: 'name' }, 'Gold'), h('div', { class: 'desc' }, 'The game caps gold at ' + fmt(C.goldCap) + '.')),
      h('div', { class: 'hint' }, 'Currently ' + fmt(S.sf.getGold()) + ' in the save.'),
      h('div', { class: 'ctl' }, goldInput,
        [1000, 10000, 100000].map(function (n) { return h('button', { class: 'btn tiny', type: 'button', onclick: function () { var v = Math.min(C.goldCap, effGold() + n); goldInput.set(v); setGold(v); goldRow.classList.toggle('changed', P.gold !== undefined); } }, '+' + fmt(n)); }),
        h('button', { class: 'btn tiny', type: 'button', onclick: function () { goldInput.set(C.goldCap); setGold(C.goldCap); goldRow.classList.toggle('changed', P.gold !== undefined); } }, 'Max')));
    page.appendChild(h('div', { class: 'listcard' }, goldRow));

    [['items', 'Items & key items'], ['weapons', 'Weapons'], ['armors', 'Armor & accessories']].forEach(function (k) {
      var kind = k[0], ids = {};
      keys(S.sf.getInventory(kind)).forEach(function (id) { ids[id] = 1; });
      keys(P[kind]).forEach(function (id) { ids[id] = 1; });
      var list = keys(ids).map(Number).sort(function (a, b) { return a - b; });
      var card = h('div', { class: 'listcard' }, h('h3', {}, k[1] + ' (' + list.length + ')'));
      if (!list.length) card.appendChild(h('p', { class: 'muted', style: 'padding:6px 12px' }, 'Nothing here.'));
      list.forEach(function (id) {
        var it = DB[kind][id];
        var orig = S.sf.getInventory(kind)[id] || 0;
        var row = h('div', { class: 'row' + (id in P[kind] ? ' changed' : '') });
        var ni = numInput(effCount(kind, id), { min: 0, max: C.itemCap, label: dbName(kind, id) }, function (v) { setCount(kind, id, v); row.classList.toggle('changed', id in P[kind]); });
        row.appendChild(h('div', {}, h('div', { class: 'name' }, dbName(kind, id)), h('div', { class: 'hint' }, (kind === 'items' && it && it.k === 2 ? 'Key item \u00b7 ' : '') + 'id ' + id)));
        row.appendChild(h('div', { class: 'desc' }, it ? cleanDesc(it.d).split('\n').slice(-1)[0] : 'Not in the game database.'));
        row.appendChild(h('div', { class: 'ctl' }, ni,
          h('button', { class: 'btn tiny danger', type: 'button', onclick: function () { ni.set(0); setCount(kind, id, 0); row.classList.toggle('changed', id in P[kind]); } }, 'Remove')));
        card.appendChild(row);
      });
      page.appendChild(card);
    });
    return page;
  }

  function pageToggles() {
    var page = h('div', {});
    page.appendChild(pagehead('Quick toggles', 'On/off story flags.'));
    var groups = [];
    C.toggles.forEach(function (t) {
      var g = t.group || 'Other';
      if (!groups.length || groups[groups.length - 1].name !== g) groups.push({ name: g, items: [] });
      groups[groups.length - 1].items.push(t);
    });
    groups.forEach(function (g) {
      var card = h('div', { class: 'listcard' });
      card.appendChild(h('h3', { class: 'toggle-group' }, g.name));
      g.items.forEach(function (t) {
        var row = h('div', { class: 'row' + (t.sw in P.sw ? ' changed' : '') });
        var note = h('div', { class: 'hint' });
        var tg = toggle(effSw(t.sw), t.title, function (v) { setSw(t.sw, v); upd(); });
        function upd() { var on = effSw(t.sw); note.textContent = on ? t.onNote : t.offNote; row.classList.toggle('changed', t.sw in P.sw); }
        row.appendChild(h('div', {}, h('div', { class: 'name' }, t.title), h('div', { class: 'desc' }, t.blurb), h('div', { class: 'hint' }, 'Game name: ' + (swName(t.sw) || '?') + '  \u00b7  switch ' + t.sw)));
        row.appendChild(h('div', {}, h('div', { class: 'desc' }, t.detail), note));
        row.appendChild(h('div', { class: 'ctl' }, tg));
        upd();
        card.appendChild(row);
      });
      page.appendChild(card);
    });
    return page;
  }

  /* ------------------------------------------------------------------ hidden content */

  function difficultyNote(v) {
    var row = null;
    C.difficulties.forEach(function (d) { if (d.v === v) row = d; });
    if (row) return row.note;
    if (v === 0) return '0 means no difficulty state is applied.';
    return 'This number is outside the seven difficulties the game knows.';
  }

  function pageHidden() {
    var page = h('div', {});
    page.appendChild(pagehead('Hidden content', 'Things that are in this build but not offered in normal play. Difficulty and items are queued into this save until you press Save. The Gallery is a different file and is written as soon as you press its button.'));

    var curDiff = effVar(301);
    var noteEl = h('div', { class: 'desc', 'data-role': 'difficulty-note' }, difficultyNote(curDiff));
    var sel = h('select', { 'data-role': 'difficulty', 'aria-label': 'Difficulty' });
    var known = false;
    C.difficulties.forEach(function (d) { if (d.v === curDiff) known = true; });
    if (!known) sel.appendChild(h('option', { value: String(curDiff) }, 'Current value (' + curDiff + ')'));
    C.difficulties.forEach(function (d) {
      sel.appendChild(h('option', { value: String(d.v) }, d.v + '  ' + d.name));
    });
    sel.value = String(curDiff);
    var diffRow = h('div', { class: 'row' + (301 in P.vars ? ' changed' : '') },
      h('div', {}, h('div', { class: 'name' }, 'Difficulty'), h('div', { class: 'hint' }, 'Variable 301. The World Improver hides Hard, Lunatic and Nope.')),
      noteEl,
      h('div', { class: 'ctl' }, sel));
    sel.addEventListener('change', function () {
      var v = Math.round(Number(sel.value));
      setVar(301, v);
      noteEl.textContent = difficultyNote(v);
      diffRow.classList.toggle('changed', 301 in P.vars);
    });
    var diffCard = h('div', { class: 'listcard' }, h('h3', {}, 'Difficulty'), diffRow);
    diffCard.appendChild(h('p', { class: 'hint', style: 'padding:4px 12px 10px' }, 'Battles read this number. If the save has a load-screen label, saving updates that label to the matching name (Redacted, Casual, Easy, Normal, Hard, Lunatic, Nope).'));
    page.appendChild(diffCard);

    var gear = h('div', { class: 'listcard' }, h('h3', {}, 'Unreleased gear'));
    C.hiddenGrants.forEach(function (g) {
      var owned = effCount(g.kind, g.id), orig = S.sf.getInventory(g.kind)[g.id] || 0;
      var it = DB[g.kind][g.id];
      var row = h('div', { class: 'row' + (owned !== orig ? ' changed' : '') });
      var queued = owned !== orig;
      var have = orig > 0 && !queued;
      row.appendChild(h('div', {},
        h('div', { class: 'name' }, it ? it.n : ('#' + g.id)),
        h('div', { class: 'hint' }, (g.kind === 'items' ? 'Item' : g.kind === 'weapons' ? 'Weapon' : 'Armor') + ' ' + g.id + (owned ? '  ·  you have ' + owned : ''))));
      row.appendChild(h('div', { class: 'desc' }, g.note));
      row.appendChild(h('div', { class: 'ctl' },
        h('button', {
          class: 'btn tiny primary', type: 'button', 'data-grant': g.kind + '-' + g.id,
          disabled: have || owned >= C.itemCap,
          onclick: function () {
            var now = effCount(g.kind, g.id);
            if (now >= C.itemCap) return;
            setCount(g.kind, g.id, now > 0 ? now : 1);
            toast('Queued: ' + (it ? it.n : g.id) + '. Press Save changes to write the save.');
            renderTab();
          }
        }, queued ? 'Queued' : have ? 'Already owned' : 'Add to save'),
        queued ? h('button', { class: 'btn tiny ghost', type: 'button', onclick: function () { setCount(g.kind, g.id, orig); renderTab(); } }, 'Undo') : null));
      gear.appendChild(row);
    });
    page.appendChild(gear);

    var status = h('p', { class: 'hint', 'data-role': 'gallery-status' }, 'Checking the gallery file...');
    var optButton = h('input', { type: 'checkbox', checked: true, 'data-role': 'gallery-button' });
    var optScenes = h('input', { type: 'checkbox', checked: true, 'data-role': 'gallery-scenes' });
    var writeBtn = h('button', {
      class: 'btn primary', type: 'button', 'data-role': 'gallery-write', disabled: !S.dirHandle,
      onclick: function () { applyGallery(optButton.checked, optScenes.checked); }
    }, 'Write gallery file');
    page.appendChild(h('div', { class: 'card' },
      h('h3', {}, 'Gallery'),
      h('p', {}, 'The Gallery was never finished. It does not actually work, and there is very little in it.'),
      h('p', {}, 'The title-screen button is stored in ', h('code', { text: C.gallery.file }), ', next to Game.exe, outside the save slot. Choosing Gallery on the title starts a new game in that room.'),
      h('label', { class: 'check' }, optButton, h('span', {}, 'Show the Gallery button on the title screen')),
      h('label', { class: 'check', style: 'margin-top:8px' }, optScenes, h('span', {}, 'Mark every gallery scene as seen')),
      status,
      h('div', { style: 'margin-top:12px' }, writeBtn)));
    fillGalleryStatus(status, writeBtn);
    return page;
  }

  function galleryStatusText(cur) {
    if (cur.mode === 'nofolder') {
      return 'This needs the game folder (Chrome or Edge, "Open my game folder"). A single opened save cannot update the gallery file without wiping your other title-screen settings. Difficulty and the gear above still save with the slot.';
    }
    if (cur.mode === 'missing') {
      return 'No ' + C.gallery.file + ' in this folder yet. Writing will create one. Close the game first, or its next save can overwrite the file.';
    }
    if (cur.mode === 'bad') return cur.message;
    var g = C.gallery, seen = 0, total = g.sceneTo - g.sceneFrom + 1;
    for (var i = g.sceneFrom; i <= g.sceneTo; i++) if (cur.data.sw[String(i)] === 'true') seen++;
    return 'Right now — title button: ' + (cur.data.sw[String(g.unlock)] === 'true' ? 'unlocked' : 'hidden') +
      '. Scenes marked seen: ' + seen + ' of ' + total +
      '. Full-gallery flag: ' + (cur.data.sw[String(g.full)] === 'true' ? 'on' : 'off') + '.';
  }

  async function loadPublic() {
    if (!S.dirHandle) return { mode: 'nofolder' };
    var fh;
    try { fh = await S.dirHandle.getFileHandle(C.gallery.file); }
    catch (e) {
      if (e && e.name === 'NotFoundError') return { mode: 'missing' };
      throw e;
    }
    var r = await Store.readHandle(fh);
    try {
      return { mode: 'ok', handle: fh, bytes: r.bytes, data: Store.parsePublic(new TextDecoder('utf-8').decode(r.bytes)) };
    } catch (e) {
      return { mode: 'bad', message: e.message, handle: fh, bytes: r.bytes };
    }
  }

  function fillGalleryStatus(el, writeBtn) {
    loadPublic().then(function (cur) {
      el.textContent = galleryStatusText(cur);
      if (writeBtn) writeBtn.disabled = cur.mode === 'nofolder' || cur.mode === 'bad';
    }).catch(function (e) {
      el.textContent = e.message || String(e);
      if (writeBtn) writeBtn.disabled = true;
    });
  }

  async function applyGallery(unlockBtn, unlockScenes) {
    if (!S.dirHandle) {
      errorBox('Needs the game folder', 'Reopen the editor with "Open my game folder" so the gallery file can be updated without replacing your other title-screen settings.');
      return;
    }
    if (!unlockBtn && !unlockScenes) { toast('Tick at least one gallery option.', 'warn'); return; }
    var ok = await confirmBox('Write the gallery file now?', h('div', {},
      h('p', {}, 'This updates ', h('code', { text: C.gallery.file }), ' in your game folder immediately. It is not part of the save slot', S.backup ? ', and the current file is copied to SaveEditorBackups first.' : '. The backup checkbox is off, so the current file will not be copied first.'),
      h('p', {}, 'Close the game first. If it is still running, its next save can overwrite this file. Then restart: Gallery appears on the title screen and starts a new game in the gallery room.')),
      'Write gallery file');
    if (!ok) return;
    busy('Writing gallery file...');
    try {
      var cur = await loadPublic();
      if (cur.mode === 'bad') throw new Error(cur.message);
      var data = { sw: {}, vars: {} };
      if (cur.mode === 'ok') {
        keys(cur.data.sw).forEach(function (k) { data.sw[k] = cur.data.sw[k]; });
        keys(cur.data.vars).forEach(function (k) { data.vars[k] = cur.data.vars[k]; });
      }
      var g = C.gallery;
      if (unlockBtn) data.sw[String(g.unlock)] = 'true';
      if (unlockScenes) {
        data.sw[String(g.full)] = 'true';
        for (var i = g.sceneFrom; i <= g.sceneTo; i++) data.sw[String(i)] = 'true';
      }
      var text = Store.formatPublic(data);
      if (Store.formatPublic(Store.parsePublic(text)) !== text) throw new Error('Internal check failed before writing.');
      var bytes = new TextEncoder().encode(text);
      var fh = cur.handle || await S.dirHandle.getFileHandle(g.file, { create: true });
      var bname = null;
      if (cur.bytes && cur.bytes.length && S.backup) bname = (await Store.makeBackup(S.dirHandle, g.file, cur.bytes)).name;
      var good = false, err = null;
      try { good = await Store.writeSave(fh, bytes); } catch (e) { err = e; }
      if (!good) {
        if (cur.bytes) { try { await Store.writeSave(fh, cur.bytes); } catch (e2) { /* best effort */ } }
        throw new Error((err ? err.message : 'The written file did not match.') + (cur.bytes ? ' The original file was put back.' : ''));
      }
      busy(null);
      toast('Wrote ' + g.file + (bname ? '. Backup: ' + bname + '.' : '.') + ' Restart the game, then choose Gallery on the title screen.', null, 9000);
      renderTab();
    } catch (e) {
      busy(null);
      errorBox('Gallery file was not updated', e.message || String(e));
    }
  }

  /* ------------------------------------------------------------------ pages: manual */

  var manualCache = {};
  function manualIds(kind) {
    if (manualCache[kind]) return manualCache[kind];
    var src = kind === 'vars' ? D.vars : D.switches;
    var arr = keys(src).map(Number).sort(function (a, b) { return a - b; }).map(function (id) {
      var u = src[id];
      return { id: id, n: u.n, lower: u.n.toLowerCase(), hay: ((u.w || []).concat(u.r || [])).join(' ').toLowerCase(), used: (u.wc || 0) + (u.rc || 0) };
    });
    manualCache[kind] = arr;
    return arr;
  }

  function manualFilter(kind) {
    var st = S.man[kind], q = st.q.trim().toLowerCase(), src = kind === 'vars' ? D.vars : D.switches;
    var exact = /^\d+$/.test(q) ? q : null;
    var list = manualIds(kind).filter(function (e) {
      if (exact && String(e.id) === exact) return true; // typing an exact id always finds it
      if (st.hideInternal && (e.n === '' || C.internalName.test(e.n))) return false;
      if (st.filter === 'named' && e.n === '') return false;
      if (st.filter === 'used' && !e.used) return false;
      if (st.filter === 'changed' && !((kind === 'vars' ? (e.id in P.vars || e.id in P.varText) : e.id in P.sw))) return false;
      if (st.filter === 'on') {
        if (kind === 'vars') { if (!effVar(e.id)) return false; } else if (!effSw(e.id)) return false;
      }
      if (q) {
        if (/^\d+$/.test(q)) return String(e.id) === q || String(e.id).indexOf(q) === 0;
        return e.lower.indexOf(q) >= 0 || (st.usage && e.hay.indexOf(q) >= 0);
      }
      return true;
    });
    // Jump straight to an id the game doesn't name/use
    if (/^\d+$/.test(q)) {
      var id = +q, max = kind === 'vars' ? S.sf.varCount() : S.sf.switchCount();
      if (id >= 1 && id <= 5000 && !list.some(function (e) { return e.id === id; })) list.unshift({ id: id, n: (src[id] && src[id].n) || '', lower: '', hay: '', used: 0, synthetic: true });
      void max;
    }
    return list;
  }

  function usageBlock(kind, id) {
    var u = (kind === 'vars' ? D.vars : D.switches)[id];
    var box = h('div', { class: 'info' });
    if (!u || (!u.wc && !u.rc)) {
      box.appendChild(h('div', {}, 'No game event reads or writes this directly. It may be unused, or handled by scripts.'));
      return box;
    }
    if (u.w) box.appendChild(h('div', {}, h('b', {}, 'Changed by: '), u.w.join('; ') + (u.wc > u.w.length ? '  \u2026 (' + u.wc + ' places in total)' : '')));
    if (u.r) box.appendChild(h('div', {}, h('b', {}, 'Checked by: '), u.r.join('; ') + (u.rc > u.r.length ? '  \u2026 (' + u.rc + ' places in total)' : '')));
    if (kind === 'vars' && (u.c || u.s)) box.appendChild(h('div', {}, h('b', {}, 'Values used: '), seenText(id).replace('Values the game uses: ', '')));
    return box;
  }

  function manualRow(kind, e) {
    var id = e.id, isVar = kind === 'vars';
    var changed = isVar ? (id in P.vars || id in P.varText) : id in P.sw;
    var row = h('div', { class: 'mrow' + (changed ? ' changed' : '') });
    var head = h('div', { class: 'head' }, h('span', { class: 'id' }, '#' + id), h('span', { class: 'nm' }, e.n || '(unnamed)'));
    var ctl = h('span', { class: 'ctl' });
    function mark() { row.classList.toggle('changed', isVar ? (id in P.vars || id in P.varText) : id in P.sw); }
    if (isVar) {
      var o = S.sf.getVar(id);
      if (o.kind === 'int' || o.kind === 'nil') {
        ctl.appendChild(numInput(effVar(id), { label: e.n || 'variable ' + id }, function (v) { setVar(id, v); mark(); }));
      } else if (o.kind === 'text') {
        var ti = h('input', { type: 'text', value: id in P.varText ? P.varText[id] : o.value, disabled: !o.editable, 'aria-label': e.n || 'variable ' + id });
        ti.addEventListener('input', function () { setVarText(id, ti.value); mark(); });
        ctl.appendChild(ti);
      } else ctl.appendChild(h('span', { class: 'pill' }, String(o.value)));
    } else {
      var lab = h('span', { class: 'hint', style: 'min-width:2.4em;text-align:right' }, effSw(id) ? 'ON' : 'OFF');
      ctl.appendChild(lab);
      ctl.appendChild(toggle(effSw(id), e.n || 'switch ' + id, function (v) { setSw(id, v); lab.textContent = v ? 'ON' : 'OFF'; mark(); }));
    }
    head.appendChild(ctl);
    var flags = h('span', {});
    if (e.n === '') flags.appendChild(h('span', { class: 'pill warn' }, 'unnamed'));
    else if (C.internalName.test(e.n)) flags.appendChild(h('span', { class: 'pill warn', title: 'Looks like temporary bookkeeping used by the game while it runs' }, 'internal'));
    head.appendChild(flags);
    row.appendChild(head);
    var det = h('details', {}, h('summary', {}, 'Where is it used?'), usageBlock(kind, id));
    row.appendChild(det);
    return row;
  }

  function pageManual(kind) {
    var st = S.man[kind], isVar = kind === 'vars', page = h('div', {});
    page.appendChild(pagehead(isVar ? 'Variables (manual)' : 'Switches (manual)', isVar ?
      'Variables are numbers the game uses to remember things: affection levels, progress counters, body measurements. Search by name or number, change the value, and the change is queued until you save.' :
      'Switches are on/off flags the game uses to remember what has happened ("met Rania", "door unlocked"). Search by name or number and flip them. Changes are queued until you save.'));
    if (!S.manualHelpClosed) {
      page.appendChild(h('details', { class: 'card explain', open: true, style: 'margin-bottom:14px' },
        h('summary', {}, h('b', {}, 'How to use this safely')),
        h('ul', {},
          h('li', {}, 'Names come straight from the game\'s own database (they are the developer\'s labels - some are cryptic).'),
          h('li', {}, 'Click "Where is it used?" on any row to see which events change or read it, and the values the game compares it with. If you can\'t find any, the value is probably not meant to be edited.'),
          h('li', {}, 'Rows marked "internal" or "unnamed" are usually temporary bookkeeping (counters, saved positions, shop state). Editing them rarely helps and can break the current scene.'),
          h('li', {}, 'Change one thing at a time, save, and test. You can always restore from the Backups page.'),
          h('li', {}, 'Type a number in the search box to jump to that exact id, even if the game gives it no name.'))));
    }
    var q = h('input', { type: 'search', placeholder: 'Search by name or ' + (isVar ? 'variable' : 'switch') + ' number...', value: st.q, 'aria-label': 'Search' });
    var filter = h('select', { 'aria-label': 'Filter' },
      [['named', 'All named'], ['used', 'Used by game events'], ['changed', 'Changed by me'], ['on', isVar ? 'Non-zero only' : 'ON only']].map(function (o) { return h('option', { value: o[0], selected: st.filter === o[0] ? 'selected' : null }, o[1]); }));
    var hide = h('input', { type: 'checkbox', checked: st.hideInternal });
    var usage = h('input', { type: 'checkbox', checked: st.usage });
    var list = h('div', { class: 'listcard' });
    var more = h('div', { class: 'more' });
    function fill() {
      var all = manualFilter(kind);
      clear(list); clear(more);
      all.slice(0, st.limit).forEach(function (e) { list.appendChild(manualRow(kind, e)); });
      if (!all.length) list.appendChild(h('p', { class: 'muted', style: 'padding:10px 14px' }, 'Nothing matches.'));
      if (all.length > st.limit) more.appendChild(h('button', { class: 'btn', type: 'button', onclick: function () { st.limit += 120; fill(); } }, 'Show more (' + (all.length - st.limit) + ' left)'));
      more.appendChild(h('div', { class: 'hint' }, all.length + ' entr' + (all.length === 1 ? 'y' : 'ies')));
    }
    var timer;
    q.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(function () { st.q = q.value; st.limit = 80; fill(); }, 150); });
    filter.addEventListener('change', function () { st.filter = filter.value; st.limit = 80; fill(); });
    hide.addEventListener('change', function () { st.hideInternal = hide.checked; st.limit = 80; fill(); });
    usage.addEventListener('change', function () { st.usage = usage.checked; fill(); });
    page.appendChild(h('div', { class: 'toolbar' }, q, filter));
    page.appendChild(h('div', { class: 'toolbar' },
      h('label', { class: 'check' }, hide, h('span', {}, 'Hide internal / unnamed entries')),
      h('label', { class: 'check' }, usage, h('span', {}, 'Search inside "where used" text too'))));
    page.appendChild(list); page.appendChild(more);
    fill();
    return page;
  }

  /* ------------------------------------------------------------------ backups */

  function pageBackups() {
    var page = h('div', {});
    page.appendChild(pagehead('Backups', 'A copy of your save is made right before the editor writes to it. Restoring is one click.'));
    page.appendChild(h('div', { class: 'card' },
      h('h3', {}, 'How it works'),
      h('ul', { class: 'steps' },
        S.dirHandle ?
          h('li', {}, 'Copies are written to ', h('code', {}, S.dirHandle.name + '\\' + Store.BACKUP_DIR + '\\'), ' - a folder the editor creates inside your game folder.') :
          h('li', {}, 'Because this browser can\'t access folders, the backup copy is downloaded to your browser\'s Downloads folder instead, with the edited save next to it. Copy the edited file over your original save yourself.'),
        h('li', {}, 'Names look like ', h('code', {}, 'Save01_2026-10-08_22-33-00.rvdata2'), ' (save name + date and time). They are normal save files: you can also copy one back into the game folder by hand.'),
        h('li', {}, 'The backup is written and verified before your save is touched. If the backup fails, nothing is changed.'),
        h('li', {}, 'The editor never deletes backups. Delete old ones yourself whenever you like.'))));
    if (!S.dirHandle) return page;

    var listBox = h('div', { class: 'listcard', style: 'margin-top:16px' }, h('h3', {}, 'Your backups'), h('p', { class: 'muted', style: 'padding:4px 12px' }, 'Loading...'));
    page.appendChild(listBox);
    var nowBtn = h('button', { class: 'btn', type: 'button', onclick: async function () {
      try { var b = await Store.makeBackup(S.dirHandle, S.saveName, S.sf.bytes); toast('Backup created: ' + b.name); renderTab(); } catch (e) { errorBox('Backup failed', e.message); }
    } }, 'Back up "' + S.saveName + '" now');
    page.appendChild(h('p', { style: 'margin-top:12px' }, nowBtn));

    Store.listBackups(S.dirHandle).then(function (list) {
      clear(listBox);
      listBox.appendChild(h('h3', {}, 'Your backups (' + list.length + ')'));
      if (!list.length) listBox.appendChild(h('p', { class: 'muted', style: 'padding:4px 12px' }, 'No backups yet. One is created the first time you save.'));
      list.forEach(function (b) {
        listBox.appendChild(h('div', { class: 'row' },
          h('div', {}, h('div', { class: 'name' }, b.save || b.name), h('div', { class: 'hint' }, b.when.toLocaleString() + ' \u00b7 ' + Math.round(b.size / 1024) + ' KB')),
          h('div', { class: 'hint mono' }, b.name),
          h('div', { class: 'ctl' }, h('button', { class: 'btn tiny', type: 'button', disabled: !b.save, onclick: function () { restoreBackup(b); } }, 'Restore'))));
      });
    }).catch(function (e) { clear(listBox); listBox.appendChild(h('p', { class: 'muted' }, 'Could not list backups: ' + e.message)); });
    return page;
  }

  async function restoreBackup(b) {
    var ok = await confirmBox('Restore this backup?', h('div', {},
      h('p', {}, 'This will replace ', h('b', {}, b.save), ' in your game folder with the copy from ' + b.when.toLocaleString() + '.'),
      h('p', { class: 'hint' }, 'The file as it is right now is backed up first, so you can undo this. Queued changes in the editor (if any) will be discarded.')), 'Restore');
    if (!ok) return;
    try {
      busy('Restoring...');
      var target = await S.dirHandle.getFileHandle(b.save, { create: true });
      var cur = null;
      try { cur = await Store.readHandle(target); } catch (e) { /* new file */ }
      if (cur && cur.size) await Store.makeBackup(S.dirHandle, b.save, cur.bytes);
      var src = await Store.readHandle(b.handle);
      new SaveFile(src.bytes, b.save); // must still parse
      var good = await Store.writeSave(target, src.bytes);
      if (!good) throw new Error('The restored file did not verify.');
      await refreshSlots();
      if (b.save === S.saveName) {
        S.sf = new SaveFile(src.bytes, b.save); P = newPend();
      }
      busy(null);
      toast('Restored ' + b.save + '.');
      renderShell();
    } catch (e) {
      busy(null);
      errorBox('Restore failed', e.message);
    }
  }

  /* ------------------------------------------------------------------ saving */

  async function doSave() {
    if (!pendCount()) return;
    var result;
    try { result = S.sf.applyChanges(buildChanges()); }
    catch (e) { errorBox('Not saved', e.message + ' Nothing was written.'); return; }

    if (!S.backup) {
      var ok = await confirmBox('Save without a backup?', 'You turned the backup off. If the edit is wrong you will have no copy of the original save to go back to.', 'Save without backup', true);
      if (!ok) return;
    }
    busy('Saving...');
    try {
      if (S.dirHandle && S.saveHandle) {
        var disk = await Store.readHandle(S.saveHandle);
        if (!Store.same(disk.bytes, S.sf.bytes)) {
          busy(null);
          errorBox('The save changed on disk', 'The file ' + S.saveName + ' is different from the version you opened (the game may have saved over it). To avoid overwriting newer progress nothing was written. Reopen the save and redo your edits.');
          return;
        }
        var bname = null;
        if (S.backup) { bname = (await Store.makeBackup(S.dirHandle, S.saveName, S.sf.bytes)).name; S.lastBackup = bname; }
        var good = false, err = null;
        try { good = await Store.writeSave(S.saveHandle, result.bytes); } catch (e) { err = e; }
        if (!good) {
          try { await Store.writeSave(S.saveHandle, S.sf.bytes); } catch (e2) { /* best effort */ }
          throw new Error((err ? err.message : 'The written file did not match what was expected') + '. The original save was put back.');
        }
        var slot = S.slots.filter(function (s) { return s.name === S.saveName; })[0];
        if (slot) { slot.bytes = result.bytes; slot.size = result.bytes.length; slot.modified = Date.now(); }
        S.sf = result.file; P = newPend(); S.review = false;
        busy(null);
        toast('Saved ' + S.saveName + (bname ? '. Original backed up as ' + bname : '.'), null, 9000);
      } else {
        // Fallback: downloads
        if (S.backup) Store.download(Store.baseName(S.saveName) + '_' + Store.stamp() + '.rvdata2', S.sf.bytes);
        setTimeout(function () { Store.download(S.saveName, result.bytes); }, 400);
        S.sf = result.file; P = newPend(); S.review = false;
        busy(null);
        errorBox('Edited save downloaded', 'The edited save was sent to your Downloads folder as ' + S.saveName + (S.backup ? ', together with a dated backup of the original' : '') + '. Copy it over the original in your game folder (close the game first).');
      }
      renderTab(); chrome();
    } catch (e) {
      busy(null);
      errorBox('Saving failed', e.message);
    }
  }

  window.addEventListener('beforeunload', function (e) {
    if (S.screen === 'editor' && pendCount()) { e.preventDefault(); e.returnValue = ''; }
  });

  /* ------------------------------------------------------------------ start */

  window.__mcse = { S: function () { return S; }, P: function () { return P; }, openBytes: openBytes };   // for testing
  try { applyTheme(localStorage.getItem('mcse_theme') || 'night'); } catch (e) { applyTheme('night'); }
  renderWelcome();
})();
