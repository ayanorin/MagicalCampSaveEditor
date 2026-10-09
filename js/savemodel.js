/*
 * SaveFile: a parsed Magical Camp (RPG Maker VX Ace) save + a planner that turns "semantic" edits
 * (set variable 13 to 4, turn switch 95 on, give 3 of item 399 ...) into byte splices on the
 * original file, and a verifier that proves nothing else changed.
 */
(function (global) {
  'use strict';
  var M = global.Marshal;

  function fail(msg) { var e = new Error(msg); e.name = 'SaveError'; return e; }

  function ivar(node, name) {
    return node && node.iv ? node.iv[name] : undefined;
  }

  function SaveFile(bytes, fileName) {
    this.bytes = bytes;
    this.fileName = fileName || '';
    var head, body;
    try {
      head = M.parseDump(bytes, 0);
      body = M.parseDump(bytes, head.end);
    } catch (e) {
      throw fail('This file could not be read as an RPG Maker VX Ace save (' + e.message + ').');
    }
    if (body.end !== bytes.length) {
      throw fail('Unexpected extra data at the end of the file (' + (bytes.length - body.end) + ' bytes). Not editing it, to be safe.');
    }
    this.header = head.root;
    this.root = body.root;
    if (this.header.t !== 'hash' || this.root.t !== 'hash') throw fail('This does not look like a VX Ace save file.');

    var sw = ivar(M.hashGet(this.root, 'switches'), '@data');
    var vr = ivar(M.hashGet(this.root, 'variables'), '@data');
    var party = M.hashGet(this.root, 'party');
    var actors = ivar(M.hashGet(this.root, 'actors'), '@data');
    if (!sw || sw.t !== 'arr' || !vr || vr.t !== 'arr' || !party || party.t !== 'obj') {
      throw fail('This save is missing switches/variables/party data - it does not look like a Magical Camp save.');
    }
    this.sw = sw; this.vr = vr; this.party = party; this.actors = actors;
    this.containers = {
      items: ivar(party, '@items'),
      weapons: ivar(party, '@weapons'),
      armors: ivar(party, '@armors')
    };
    for (var k in this.containers) {
      if (!this.containers[k] || this.containers[k].t !== 'hash') throw fail('Inventory data (' + k + ') not found in this save.');
    }
  }

  /* ---------- reading ---------- */

  SaveFile.prototype.headerInfo = function () {
    var self = this;
    function s(name) {
      var n = M.hashGet(self.header, name);
      return n && n.t === 'str' ? M.strValue(n, self.bytes) : '';
    }
    var chars = M.hashGet(this.header, 'characters');
    return { playtime: s('playtime_s'), mapName: s('map_name'), difficulty: s('difficulty'), partySize: chars && chars.a ? chars.a.length : 0 };
  };

  /** Variable value: {kind:'int'|'nil'|'text'|'other', value} */
  SaveFile.prototype.getVar = function (id) {
    var n = this.vr.a[id];
    if (!n || n.t === 'nil') return { kind: 'nil', value: 0 };
    if (n.t === 'int') return { kind: 'int', value: n.v };
    if (n.t === 'str') return { kind: 'text', value: M.strValue(n, this.bytes), editable: n.enc === 'utf8' || n.enc === 'ascii' };
    if (n.t === 'float') return { kind: 'other', value: n.v };
    return { kind: 'other', value: '(' + n.t + ')' };
  };

  SaveFile.prototype.getSwitch = function (id) {
    var n = this.sw.a[id];
    return !!(n && n.t === 'bool' && n.v);
  };

  /** The game's data version stamp stored in the save (used to warn about saves from other builds). */
  SaveFile.prototype.getVersionId = function () {
    var sys = M.hashGet(this.root, 'system');
    var v = ivar(sys, '@version_id');
    return v && v.t === 'int' ? v.v : null;
  };

  SaveFile.prototype.varCount = function () { return this.vr.a.length; };
  SaveFile.prototype.switchCount = function () { return this.sw.a.length; };

  SaveFile.prototype.getGold = function () {
    var n = ivar(this.party, '@gold');
    return n && n.t === 'int' ? n.v : 0;
  };

  /** Map id -> count for 'items' | 'weapons' | 'armors'. */
  SaveFile.prototype.getInventory = function (kind) {
    var h = this.containers[kind];
    var out = {};
    for (var i = 0; i < h.p.length; i++) {
      var k = h.p[i].k, v = h.p[i].v;
      if (k.t === 'int' && v.t === 'int') out[k.v] = v.v;
    }
    return out;
  };

  SaveFile.prototype.getActors = function () {
    var list = [];
    if (!this.actors || this.actors.t !== 'arr') return list;
    for (var i = 1; i < this.actors.a.length; i++) {
      var a = this.actors.a[i];
      if (!a || a.t !== 'obj') continue;
      var nm = ivar(a, '@name'), nk = ivar(a, '@nickname');
      list.push({
        id: i,
        name: nm && nm.t === 'str' ? M.strValue(nm, this.bytes) : '',
        nickname: nk && nk.t === 'str' ? M.strValue(nk, this.bytes) : '',
        nameEditable: !!nm && nm.t === 'str' && (nm.enc === 'utf8' || nm.enc === 'ascii'),
        nicknameEditable: !!nk && nk.t === 'str' && (nk.enc === 'utf8' || nk.enc === 'ascii')
      });
    }
    return list;
  };

  /* ---------- planning edits ---------- */

  function boolBytes(v) { return [v ? 0x54 : 0x46]; }

  function planArray(arr, sets, edits) {
    var n = arr.a.length;
    var idxs = Object.keys(sets).map(Number).sort(function (a, b) { return a - b; });
    var ext = [];
    idxs.forEach(function (i) {
      if (i < n) edits.push({ s: arr.ofs[i], e: arr.ofs[i + 1], b: sets[i] });
      else ext.push(i);
    });
    if (ext.length) {
      var max = ext[ext.length - 1];
      var bytes = [];
      for (var k = n; k <= max; k++) bytes = bytes.concat(sets[k] || [0x30]);
      edits.push({ s: arr.e, e: arr.e, b: bytes });
      edits.push({ s: arr.cntS, e: arr.cntE, b: M.encInt(max + 1) });
    }
  }

  function planHash(h, sets, edits) {
    // sets: id -> new count (0 or less = remove)
    var removed = 0, added = 0, addBytes = [];
    Object.keys(sets).map(Number).sort(function (a, b) { return a - b; }).forEach(function (id) {
      var cnt = sets[id];
      var idx = M.hashFindInt(h, id);
      if (idx >= 0) {
        var pair = h.p[idx];
        if (pair.v.t !== 'int') throw fail('Inventory entry ' + id + ' has an unexpected format.');
        if (cnt <= 0) { edits.push({ s: pair.k.s, e: pair.v.e, b: [] }); removed++; }
        else edits.push({ s: pair.v.s, e: pair.v.e, b: M.encFixnum(cnt) });
      } else if (cnt > 0) {
        addBytes = addBytes.concat(M.encFixnum(id), M.encFixnum(cnt));
        added++;
      }
    });
    if (added) edits.push({ s: h.endPairs, e: h.endPairs, b: addBytes });
    if (added || removed) edits.push({ s: h.cntS, e: h.cntE, b: M.encInt(h.p.length - removed + added) });
  }

  function planString(node, text, edits) {
    if (!node || node.t !== 'str') throw fail('That text field has an unexpected format.');
    if (node.enc !== 'utf8' && node.enc !== 'ascii') throw fail('That text field uses an encoding the editor does not support.');
    var data = M.utf8enc.encode(text);
    var nonAscii = false;
    for (var i = 0; i < data.length; i++) if (data[i] > 127) { nonAscii = true; break; }
    if (nonAscii && node.enc === 'ascii') {
      // flip the encoding flag from US-ASCII (F) to UTF-8 (T)
      var flag = node.ivars && node.ivars[0];
      if (!flag || flag.k !== 'E' || flag.v.t !== 'bool') throw fail('Cannot store non-ASCII characters in that field.');
      edits.push({ s: flag.v.s, e: flag.v.e, b: [0x54] });
    }
    edits.push({ s: node.lenPos, e: node.dataE, b: M.encInt(data.length).concat(Array.prototype.slice.call(data)) });
  }

  /**
   * changes = {
   *   vars:{id:number}, varText:{id:string}, sw:{id:bool},
   *   items:{id:count}, weapons:{id:count}, armors:{id:count},
   *   gold:number (optional), actorName:{id:string}, actorNickname:{id:string}
   * }
   * Returns a list of byte edits [{s,e,b}] against the current bytes.
   */
  SaveFile.prototype.planEdits = function (ch) {
    var edits = [];
    var self = this;
    var sets;

    if (ch.vars && Object.keys(ch.vars).length) {
      sets = {};
      Object.keys(ch.vars).forEach(function (id) {
        var val = ch.vars[id];
        var cur = self.vr.a[id];
        if (cur && cur.t !== 'int' && cur.t !== 'nil') throw fail('Variable ' + id + ' currently holds text or another special value, so it cannot be set to a number.');
        sets[id] = M.encFixnum(val);
      });
      planArray(this.vr, sets, edits);
    }
    if (ch.sw && Object.keys(ch.sw).length) {
      sets = {};
      Object.keys(ch.sw).forEach(function (id) {
        var cur = self.sw.a[id];
        if (cur && cur.t !== 'bool' && cur.t !== 'nil') throw fail('Switch ' + id + ' has an unexpected format.');
        sets[id] = boolBytes(!!ch.sw[id]);
      });
      planArray(this.sw, sets, edits);
    }
    if (ch.varText) {
      Object.keys(ch.varText).forEach(function (id) { planString(self.vr.a[id], ch.varText[id], edits); });
    }
    ['items', 'weapons', 'armors'].forEach(function (kind) {
      if (ch[kind] && Object.keys(ch[kind]).length) planHash(self.containers[kind], ch[kind], edits);
    });
    if (typeof ch.gold === 'number') {
      var g = ivar(this.party, '@gold');
      if (!g || g.t !== 'int') throw fail('Gold has an unexpected format.');
      edits.push({ s: g.s, e: g.e, b: M.encFixnum(ch.gold) });
    }
    ['actorName', 'actorNickname'].forEach(function (kind) {
      if (!ch[kind]) return;
      Object.keys(ch[kind]).forEach(function (id) {
        var a = self.actors && self.actors.a[id];
        if (!a || a.t !== 'obj') throw fail('Actor ' + id + ' not found.');
        planString(ivar(a, kind === 'actorName' ? '@name' : '@nickname'), ch[kind][id], edits);
      });
    });
    if (typeof ch.difficultyHeader === 'string') {
      var dh = M.hashGet(this.header, 'difficulty');
      if (!dh || dh.t !== 'str') throw fail('This save has no difficulty label to update.');
      planString(dh, ch.difficultyHeader, edits);
    }
    return edits;
  };

  function applyEdits(bytes, edits) {
    var sorted = edits.slice().sort(function (a, b) { return a.s - b.s || a.e - b.e; });
    var total = bytes.length;
    var prevEnd = 0;
    sorted.forEach(function (ed) {
      if (ed.s < prevEnd) throw fail('Internal error: overlapping edits.');
      prevEnd = ed.e;
      total += ed.b.length - (ed.e - ed.s);
    });
    var out = new Uint8Array(total);
    var pos = 0, src = 0;
    sorted.forEach(function (ed) {
      out.set(bytes.subarray(src, ed.s), pos); pos += ed.s - src;
      out.set(ed.b, pos); pos += ed.b.length;
      src = ed.e;
    });
    out.set(bytes.subarray(src), pos);
    return out;
  }

  function flatMap(sf) {
    var list = [];
    M.flatten(sf.header, 'top0', list, sf.bytes);
    M.flatten(sf.root, 'top1', list, sf.bytes);
    var map = new Map();
    for (var i = 0; i < list.length; i++) {
      var s = list[i], eq = s.indexOf('=');
      // path may contain '=' only inside hash keys of strings; the first '=' after the last ']' / '}' / '.@x' is fine in practice
      map.set(s.substring(0, eq), s.substring(eq + 1));
    }
    return map;
  }

  /** Allowed (expected) differing paths for a change set. */
  function allowedPaths(ch) {
    var set = new Set();
    function add(p) { set.add(p); }
    if (ch.vars) { add('top1{variables}.@data'); Object.keys(ch.vars).forEach(function (i) { add('top1{variables}.@data[' + i + ']'); }); }
    if (ch.varText) Object.keys(ch.varText).forEach(function (i) { add('top1{variables}.@data[' + i + ']'); });
    if (ch.sw) { add('top1{switches}.@data'); Object.keys(ch.sw).forEach(function (i) { add('top1{switches}.@data[' + i + ']'); }); }
    ['items', 'weapons', 'armors'].forEach(function (k) {
      if (ch[k]) { add('top1{party}.@' + k); Object.keys(ch[k]).forEach(function (i) { add('top1{party}.@' + k + '{' + i + '}'); }); }
    });
    if (typeof ch.gold === 'number') add('top1{party}.@gold');
    if (ch.actorName) Object.keys(ch.actorName).forEach(function (i) { add('top1{actors}.@data[' + i + '].@name'); });
    if (ch.actorNickname) Object.keys(ch.actorNickname).forEach(function (i) { add('top1{actors}.@data[' + i + '].@nickname'); });
    if (typeof ch.difficultyHeader === 'string') add('top0{difficulty}');
    return set;
  }

  /**
   * Applies `ch` and returns {bytes, file} after verifying the result:
   *  - the new bytes parse cleanly
   *  - only the intended fields differ from the original (full structural comparison)
   *  - every intended value reads back correctly
   * Throws a SaveError if anything is off - callers must then NOT write anything.
   */
  SaveFile.prototype.applyChanges = function (ch) {
    var edits = this.planEdits(ch);
    if (!edits.length) throw fail('Nothing to change.');
    var nb = applyEdits(this.bytes, edits);
    var nf;
    try { nf = new SaveFile(nb, this.fileName); }
    catch (e) { throw fail('Verification failed: the edited save could not be re-read (' + e.message + ').'); }

    var a = flatMap(this), b = flatMap(nf), allowed = allowedPaths(ch);
    var bad = [];
    a.forEach(function (v, k) { if (!allowed.has(k) && b.get(k) !== v) bad.push(k); });
    var oldLens = { variables: this.vr.a.length, switches: this.sw.a.length };
    b.forEach(function (v, k) {
      if (allowed.has(k) || a.has(k)) return;
      var m = /^top1\{(variables|switches)\}\.@data\[(\d+)\]$/.exec(k); // slots created by growing the array
      if (m && +m[2] >= oldLens[m[1]]) return;
      bad.push(k);
    });
    if (bad.length) throw fail('Verification failed: unintended differences found (' + bad.slice(0, 3).join(', ') + ').');

    var errs = [];
    if (ch.vars) Object.keys(ch.vars).forEach(function (i) { var g = nf.getVar(+i); if (g.kind !== 'int' || g.value !== ch.vars[i]) errs.push('variable ' + i); });
    if (ch.varText) Object.keys(ch.varText).forEach(function (i) { var g = nf.getVar(+i); if (g.kind !== 'text' || g.value !== ch.varText[i]) errs.push('text variable ' + i); });
    if (ch.sw) Object.keys(ch.sw).forEach(function (i) { if (nf.getSwitch(+i) !== !!ch.sw[i]) errs.push('switch ' + i); });
    ['items', 'weapons', 'armors'].forEach(function (k) {
      if (!ch[k]) return;
      var inv = nf.getInventory(k);
      Object.keys(ch[k]).forEach(function (i) { if ((inv[i] || 0) !== Math.max(0, ch[k][i])) errs.push(k + ' ' + i); });
    });
    if (typeof ch.gold === 'number' && nf.getGold() !== ch.gold) errs.push('gold');
    if (typeof ch.difficultyHeader === 'string' && nf.headerInfo().difficulty !== ch.difficultyHeader) errs.push('difficulty label');
    var acts = nf.getActors();
    ['actorName', 'actorNickname'].forEach(function (kind) {
      if (!ch[kind]) return;
      Object.keys(ch[kind]).forEach(function (i) {
        var act = acts.filter(function (x) { return x.id === +i; })[0];
        var val = act ? (kind === 'actorName' ? act.name : act.nickname) : null;
        if (val !== ch[kind][i]) errs.push(kind + ' ' + i);
      });
    });
    if (errs.length) throw fail('Verification failed: values did not read back correctly (' + errs.join(', ') + ').');
    return { bytes: nb, file: nf };
  };

  /** Cheap header-only read for the save-slot list. Returns null if the file is not a VX Ace save. */
  SaveFile.peek = function (bytes) {
    try {
      var head = M.parseDump(bytes, 0);
      if (head.root.t !== 'hash') return null;
      return SaveFile.prototype.headerInfo.call({ header: head.root, bytes: bytes });
    } catch (e) { return null; }
  };

  global.SaveFile = SaveFile;
  global.SaveError = fail;
})(window);
