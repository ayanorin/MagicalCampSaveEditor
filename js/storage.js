/*
 * File access + automatic backups.
 *
 * Chrome / Edge / other Chromium browsers: the editor asks for the game folder once
 * (File System Access API). It can then read the saves, write the edited save in place and keep
 * dated copies in  <game folder>\SaveEditorBackups\  .
 *
 * Firefox / Safari (no folder access): the save is opened through a normal file picker and the
 * result (plus the backup copy of the original) is handed to the browser's download folder.
 */
(function (global) {
  'use strict';

  var BACKUP_DIR = 'SaveEditorBackups';
  var hasFolderAccess = !!(global.showDirectoryPicker && global.isSecureContext !== false);

  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function stamp(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + '_' +
      pad(d.getHours()) + '-' + pad(d.getMinutes()) + '-' + pad(d.getSeconds());
  }
  function baseName(name) { return name.replace(/\.rvdata2$/i, ''); }

  function same(a, b) {
    if (a.length !== b.length) return false;
    for (var i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  }

  async function readHandle(fh) {
    var f = await fh.getFile();
    return { bytes: new Uint8Array(await f.arrayBuffer()), modified: f.lastModified, size: f.size };
  }

  async function writeHandle(fh, bytes) {
    var w = await fh.createWritable();
    try { await w.write(bytes); } catch (e) { try { await w.abort(); } catch (x) { /* ignore */ } throw e; }
    await w.close();
  }

  async function pickFolder() {
    return await global.showDirectoryPicker({ id: 'magical-camp-saves', mode: 'readwrite' });
  }

  async function listSaves(dir) {
    var out = [];
    for await (var entry of dir.entries()) {
      var name = entry[0], h = entry[1];
      if (h.kind === 'file' && /^save.*\.rvdata2$/i.test(name)) {
        var r = await readHandle(h);
        out.push({ name: name, handle: h, bytes: r.bytes, size: r.size, modified: r.modified });
      }
    }
    out.sort(function (a, b) { return a.name.localeCompare(b.name, undefined, { numeric: true }); });
    return out;
  }

  /** Writes a dated copy of `bytes` into SaveEditorBackups and verifies it. */
  async function makeBackup(dir, saveName, bytes) {
    var bd = await dir.getDirectoryHandle(BACKUP_DIR, { create: true });
    var base = baseName(saveName) + '_' + stamp();
    var name = base + '.rvdata2', n = 1;
    for (;;) {
      try { await bd.getFileHandle(name); n++; name = base + '_' + n + '.rvdata2'; }
      catch (e) { break; }
    }
    var fh = await bd.getFileHandle(name, { create: true });
    await writeHandle(fh, bytes);
    var back = await readHandle(fh);
    if (!same(back.bytes, bytes)) throw new Error('The backup copy did not verify.');
    return { name: name };
  }

  async function listBackups(dir) {
    var bd;
    try { bd = await dir.getDirectoryHandle(BACKUP_DIR); } catch (e) { return []; }
    var out = [];
    for await (var entry of bd.entries()) {
      var name = entry[0], h = entry[1];
      if (h.kind !== 'file' || !/\.rvdata2$/i.test(name)) continue;
      var m = /^(.*)_(\d{4})-(\d\d)-(\d\d)_(\d\d)-(\d\d)-(\d\d)(?:_\d+)?\.rvdata2$/i.exec(name);
      var f = await h.getFile();
      out.push({
        name: name, handle: h, size: f.size,
        save: m ? m[1] + '.rvdata2' : null,
        when: m ? new Date(+m[2], +m[3] - 1, +m[4], +m[5], +m[6], +m[7]) : new Date(f.lastModified)
      });
    }
    out.sort(function (a, b) { return b.when - a.when; });
    return out;
  }

  /** Writes edited bytes into a save file and checks the file on disk matches. */
  async function writeSave(fileHandle, bytes) {
    await writeHandle(fileHandle, bytes);
    var back = await readHandle(fileHandle);
    return same(back.bytes, bytes);
  }

  /**
   * SavingDataLocal.rvdata2 is not a Marshal dump. The game writes Ruby's inspect
   * of [{switch_id => bool}, {variable_id => int}], and reads it back by splitting
   * on "}, {". Values are kept as their original text so a rewrite cannot drop
   * title-screen variables or switch 88.
   */
  function parsePublic(text) {
    var s = String(text).replace(/^\uFEFF/, '').trim();
    if (!s) return { sw: {}, vars: {} };
    var cut = s.split('}, {');
    if (cut.length !== 2 || s.charAt(0) !== '[') {
      throw new Error('SavingDataLocal.rvdata2 is not in the format the game writes, so it was left unchanged.');
    }
    return { sw: parsePublicSide(cut[0]), vars: parsePublicSide(cut[1]) };
  }
  function parsePublicSide(chunk) {
    var body = chunk.replace(/^\s*\[?\s*\{/, '').replace(/\}\s*\]?\s*$/, '').trim();
    var out = {};
    if (!body) return out;
    var parts = body.split(', ');
    for (var i = 0; i < parts.length; i++) {
      var m = /^(\d+)=>(true|false|-?\d+(?:\.\d+)?|"[^"]*")$/.exec(parts[i]);
      if (!m) {
        throw new Error('SavingDataLocal.rvdata2 has an entry the editor cannot keep safely, so it was left unchanged.');
      }
      out[m[1]] = m[2];
    }
    return out;
  }
  function formatPublic(data) {
    function body(map) {
      return Object.keys(map).map(Number).sort(function (a, b) { return a - b; }).map(function (k) {
        return k + '=>' + map[String(k)];
      }).join(', ');
    }
    return '[{' + body(data.sw || {}) + '}, {' + body(data.vars || {}) + '}]';
  }

  function download(name, bytes) {
    var blob = new Blob([bytes], { type: 'application/octet-stream' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 2000);
  }

  global.Store = {
    BACKUP_DIR: BACKUP_DIR,
    hasFolderAccess: hasFolderAccess,
    stamp: stamp,
    baseName: baseName,
    same: same,
    readHandle: readHandle,
    pickFolder: pickFolder,
    listSaves: listSaves,
    makeBackup: makeBackup,
    listBackups: listBackups,
    writeSave: writeSave,
    download: download,
    parsePublic: parsePublic,
    formatPublic: formatPublic
  };
})(window);
