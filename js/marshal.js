/*
 * Ruby Marshal (format 4.8) reader that remembers the byte offsets of everything it reads,
 * plus the small encoders the save editor needs.
 *
 * RPG Maker VX Ace save files are two Marshal dumps written back to back:
 *   1) the save header (a Hash), 2) the save contents (a Hash with Game_* objects).
 *
 * The editor never re-serialises the whole file. It parses it, finds the exact byte range
 * of the value it wants to change, and splices new bytes into the ORIGINAL file.
 * Everything else stays byte-for-byte identical, which is what makes this safe.
 */
(function (global) {
  'use strict';

  var utf8dec = new TextDecoder('utf-8');
  var utf8enc = new TextEncoder();

  function MarshalError(msg, pos) {
    var e = new Error(msg + (pos != null ? ' (at byte ' + pos + ')' : ''));
    e.name = 'MarshalError';
    return e;
  }

  /** Encode a Marshal "packed int" (the body of a Fixnum / length / count). */
  function encInt(v) {
    if (v === 0) return [0];
    if (v > 0 && v < 123) return [v + 5];
    if (v < 0 && v > -124) return [(v - 5) & 0xff];
    var buf = [0];
    for (var i = 1; i < 5; i++) {
      buf.push(v & 0xff);
      v >>= 8;
      if (v === 0) { buf[0] = i; return buf; }
      if (v === -1) { buf[0] = (-i) & 0xff; return buf; }
    }
    throw MarshalError('Integer out of Marshal fixnum range');
  }

  /** Full encoding of a Fixnum value ('i' + packed int). Range: -2^30 .. 2^30-1. */
  function encFixnum(v) {
    if (!(v >= -1073741824 && v <= 1073741823) || Math.floor(v) !== v) {
      throw MarshalError('Value ' + v + ' does not fit in a Ruby Fixnum (-1073741824 .. 1073741823)');
    }
    return [0x69].concat(encInt(v));
  }

  function Reader(bytes, start) {
    this.d = bytes;
    this.p = start || 0;
    this.syms = [];
    this.objs = [];
  }

  Reader.prototype.readInt = function () {
    var d = this.d;
    var c = d[this.p++];
    if (c > 127) c -= 256;
    if (c === 0) return 0;
    var i, x;
    if (c > 4) return c - 5;
    if (c > 0) {
      x = 0;
      for (i = 0; i < c; i++) x += d[this.p++] * Math.pow(2, 8 * i);
      return x > 2147483647 ? x - 4294967296 : x;
    }
    if (c < -4) return c + 5;
    c = -c;
    x = -1;
    for (i = 0; i < c; i++) {
      x = x & ~(0xff << (8 * i));
      x = x | (d[this.p++] << (8 * i));
    }
    return x;
  };

  Reader.prototype.readSymbolBody = function () {
    var n = this.readInt();
    var s = utf8dec.decode(this.d.subarray(this.p, this.p + n));
    this.p += n;
    return s;
  };

  Reader.prototype.readSymbol = function () {
    var s = this.p;
    var t = this.d[this.p++];
    var name;
    if (t === 0x3a) { // ':'
      name = this.readSymbolBody();
      this.syms.push(name);
    } else if (t === 0x3b) { // ';'
      name = this.syms[this.readInt()];
    } else {
      throw MarshalError('Expected symbol', s);
    }
    return name;
  };

  /** Reads one value. Returns a node object (see types below). */
  Reader.prototype.read = function () {
    var d = this.d;
    var s = this.p;
    var t = String.fromCharCode(d[this.p++]);
    var i, n, node;
    switch (t) {
      case '0': return { t: 'nil', s: s, e: this.p };
      case 'T': return { t: 'bool', v: true, s: s, e: this.p };
      case 'F': return { t: 'bool', v: false, s: s, e: this.p };
      case 'i': { var v = this.readInt(); return { t: 'int', v: v, s: s, e: this.p }; }
      case ':': { this.p = s; var nm = this.readSymbol(); return { t: 'sym', v: nm, s: s, e: this.p }; }
      case ';': { this.p = s; var nm2 = this.readSymbol(); return { t: 'sym', v: nm2, s: s, e: this.p }; }
      case '@': {
        var idx = this.readInt();
        return { t: 'link', idx: idx, target: this.objs[idx], s: s, e: this.p };
      }
      case '"': {
        node = { t: 'str', s: s, enc: 'bin' };
        this.objs.push(node);
        node.lenPos = this.p;
        n = this.readInt();
        node.dataS = this.p;
        node.dataE = this.p + n;
        this.p += n;
        node.e = this.p;
        return node;
      }
      case 'f': {
        node = { t: 'float', s: s };
        this.objs.push(node);
        n = this.readInt();
        var txt = utf8dec.decode(d.subarray(this.p, this.p + n));
        this.p += n;
        node.v = txt === 'inf' ? Infinity : txt === '-inf' ? -Infinity : txt === 'nan' ? NaN : parseFloat(txt);
        node.e = this.p;
        return node;
      }
      case 'l': {
        node = { t: 'big', s: s };
        this.objs.push(node);
        var sign = d[this.p++];
        n = this.readInt() * 2;
        var val = 0;
        var mul = 1;
        for (i = 0; i < n; i++) { val += d[this.p++] * mul; mul *= 256; }
        node.v = sign === 0x2d ? -val : val;
        node.e = this.p;
        return node;
      }
      case 'I': {
        var inner = this.read();
        var cnt = this.readInt();
        var ivs = [];
        for (i = 0; i < cnt; i++) {
          var k = this.readSymbol();
          var val2 = this.read();
          ivs.push({ k: k, v: val2 });
          if (inner.t === 'str') {
            if (k === 'E') inner.enc = val2.v === true ? 'utf8' : 'ascii';
            else if (k === 'encoding') inner.enc = 'other';
          }
        }
        inner.wrapS = s;
        inner.s = s;
        inner.e = this.p;
        inner.ivars = ivs;
        return inner;
      }
      case '[': {
        node = { t: 'arr', s: s, a: [], ofs: [] };
        this.objs.push(node);
        node.cntS = this.p;
        n = this.readInt();
        node.cntE = this.p;
        for (i = 0; i < n; i++) {
          node.ofs.push(this.p);
          node.a.push(this.read());
        }
        node.ofs.push(this.p); // offset just after the last element
        node.e = this.p;
        return node;
      }
      case '{':
      case '}': {
        node = { t: 'hash', s: s, p: [] };
        this.objs.push(node);
        node.cntS = this.p;
        n = this.readInt();
        node.cntE = this.p;
        for (i = 0; i < n; i++) {
          var key = this.read();
          var value = this.read();
          node.p.push({ k: key, v: value });
        }
        node.endPairs = this.p;
        if (t === '}') node.def = this.read();
        node.e = this.p;
        return node;
      }
      case 'o': {
        node = { t: 'obj', s: s, iv: {}, ivList: [] };
        this.objs.push(node);
        node.cls = this.readSymbol();
        n = this.readInt();
        for (i = 0; i < n; i++) {
          var k2 = this.readSymbol();
          var v2 = this.read();
          node.iv[k2] = v2;
          node.ivList.push({ k: k2, v: v2 });
        }
        node.e = this.p;
        return node;
      }
      case 'S': {
        node = { t: 'struct', s: s, iv: {}, ivList: [] };
        this.objs.push(node);
        node.cls = this.readSymbol();
        n = this.readInt();
        for (i = 0; i < n; i++) {
          var k3 = this.readSymbol();
          var v3 = this.read();
          node.iv[k3] = v3;
          node.ivList.push({ k: k3, v: v3 });
        }
        node.e = this.p;
        return node;
      }
      case 'u': {
        node = { t: 'user', s: s };
        node.cls = this.readSymbol();
        n = this.readInt();
        node.rawS = this.p;
        this.p += n;
        node.rawE = this.p;
        node.e = this.p;
        this.objs.push(node);
        return node;
      }
      case 'U': {
        node = { t: 'udump', s: s };
        this.objs.push(node);
        node.cls = this.readSymbol();
        node.data = this.read();
        node.e = this.p;
        return node;
      }
      case 'e': { this.readSymbol(); var ex = this.read(); return ex; }
      case 'C': { this.readSymbol(); var cc = this.read(); return cc; }
      case 'c':
      case 'm':
      case 'M': {
        node = { t: 'classref', s: s };
        this.objs.push(node);
        n = this.readInt();
        this.p += n;
        node.e = this.p;
        return node;
      }
      default:
        throw MarshalError('Unsupported Marshal type "' + t + '"', s);
    }
  };

  /** Parse one top-level dump starting at `start`. Returns {root, end}. */
  function parseDump(bytes, start) {
    if (bytes[start] !== 4 || bytes[start + 1] !== 8) {
      throw MarshalError('Not a Ruby Marshal 4.8 stream', start);
    }
    var r = new Reader(bytes, start + 2);
    var root = r.read();
    return { root: root, end: r.p, objCount: r.objs.length, symCount: r.syms.length };
  }

  /** Decode a 'str' node to a JS string. */
  function strValue(node, bytes) {
    var raw = bytes.subarray(node.dataS, node.dataE);
    if (node.enc === 'utf8' || node.enc === 'ascii') return utf8dec.decode(raw);
    var out = '';
    for (var i = 0; i < raw.length; i++) out += String.fromCharCode(raw[i]);
    return out;
  }

  /** Get hash entry node value by symbol key name (hash with symbol keys). */
  function hashGet(h, name) {
    if (!h || h.t !== 'hash') return undefined;
    for (var i = 0; i < h.p.length; i++) {
      if (h.p[i].k.t === 'sym' && h.p[i].k.v === name) return h.p[i].v;
    }
    return undefined;
  }

  /** Find a hash pair by integer key. */
  function hashFindInt(h, id) {
    for (var i = 0; i < h.p.length; i++) {
      if (h.p[i].k.t === 'int' && h.p[i].k.v === id) return i;
    }
    return -1;
  }

  /**
   * Produces a flat list of "path = value" strings for every node, used to prove that an edit
   * changed only what was intended. Links are rendered as @index (indexes stay stable because the
   * editor never adds or removes objects).
   */
  function flatten(node, path, out, bytes) {
    switch (node.t) {
      case 'nil': out.push(path + '=nil'); break;
      case 'bool': out.push(path + '=' + node.v); break;
      case 'int': out.push(path + '=' + node.v); break;
      case 'sym': out.push(path + '=:' + node.v); break;
      case 'link': out.push(path + '=@' + node.idx); break;
      case 'str': out.push(path + '=S"' + hexOf(bytes, node.dataS, node.dataE) + '"'); break;
      case 'float': out.push(path + '=F' + node.v); break;
      case 'big': out.push(path + '=B' + node.v); break;
      case 'user': out.push(path + '=U' + node.cls + ':' + hexOf(bytes, node.rawS, node.rawE)); break;
      case 'arr':
        out.push(path + '=ARR' + node.a.length);
        for (var i = 0; i < node.a.length; i++) flatten(node.a[i], path + '[' + i + ']', out, bytes);
        break;
      case 'hash':
        out.push(path + '=HASH' + node.p.length);
        for (var j = 0; j < node.p.length; j++) {
          var kn = node.p[j].k;
          var kstr = kn.t === 'sym' ? kn.v : kn.t === 'int' ? String(kn.v) : kn.t === 'str' ? strValue(kn, bytes) : '?' + kn.t;
          flatten(node.p[j].v, path + '{' + kstr + '}', out, bytes);
        }
        if (node.def) flatten(node.def, path + '{default}', out, bytes);
        break;
      case 'obj':
      case 'struct':
        out.push(path + '=OBJ ' + node.cls);
        for (var m = 0; m < node.ivList.length; m++) flatten(node.ivList[m].v, path + '.' + node.ivList[m].k, out, bytes);
        break;
      case 'udump':
        out.push(path + '=UDUMP ' + node.cls);
        flatten(node.data, path + '.dump', out, bytes);
        break;
      default: out.push(path + '=' + node.t);
    }
  }

  function hexOf(bytes, s, e) {
    var h = '';
    for (var i = s; i < e; i++) h += (bytes[i] < 16 ? '0' : '') + bytes[i].toString(16);
    return h;
  }

  global.Marshal = {
    parseDump: parseDump,
    encInt: encInt,
    encFixnum: encFixnum,
    strValue: strValue,
    hashGet: hashGet,
    hashFindInt: hashFindInt,
    flatten: flatten,
    utf8enc: utf8enc,
    utf8dec: utf8dec
  };
})(window);
