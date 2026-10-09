// Minimal Ruby Marshal reader + RGSS3A archive reader.
// Dev-only tool: used once to generate data/gamedata.js from the game's files.
// Compiled by tools/build-data.ps1 (Windows PowerShell 5, C# 5 compatible).
using System;
using System.Collections.Generic;
using System.IO;
using System.Runtime.CompilerServices;
using System.Text;

public class RSym { public string N; public override string ToString() { return N; } }
public class RObj
{
    public string Cls;
    public List<KeyValuePair<string, object>> Iv = new List<KeyValuePair<string, object>>();
    public byte[] Raw;
    public object Get(string n) { foreach (var kv in Iv) if (kv.Key == n) return kv.Value; return null; }
}
public class RHash { public List<KeyValuePair<object, object>> Items = new List<KeyValuePair<object, object>>(); }
public class RefCmp : IEqualityComparer<object>
{
    public new bool Equals(object a, object b) { return object.ReferenceEquals(a, b); }
    public int GetHashCode(object o) { return RuntimeHelpers.GetHashCode(o); }
}

public class MP
{
    byte[] d; public int p;
    List<RSym> syms = new List<RSym>();
    List<object> objs = new List<object>();
    public MP(byte[] data, int start) { d = data; p = start; }
    public object ReadTop() { p += 2; return Read(); }
    public int ReadInt()
    {
        int c = (sbyte)d[p++];
        if (c == 0) return 0;
        if (c > 4) return c - 5;
        if (c > 0) { int x = 0; for (int i = 0; i < c; i++) x |= d[p++] << (8 * i); return x; }
        if (c < -4) return c + 5;
        c = -c; int y = -1;
        for (int i = 0; i < c; i++) { y &= ~(0xff << (8 * i)); y |= d[p++] << (8 * i); }
        return y;
    }
    string ReadStr() { int n = ReadInt(); string s = Encoding.GetEncoding(28591).GetString(d, p, n); p += n; return s; }
    public object Read()
    {
        char t = (char)d[p++];
        switch (t)
        {
            case '0': return null;
            case 'T': return true;
            case 'F': return false;
            case 'i': return (long)ReadInt();
            case ':': { var s = new RSym(); s.N = ReadStr(); syms.Add(s); return s; }
            case ';': return syms[ReadInt()];
            case '@': return objs[ReadInt()];
            case '"': { string s = ReadStr(); objs.Add(s); return s; }
            case 'f': { string s = ReadStr(); objs.Add(s); return s; }
            case 'l':
                {
                    int sign = d[p++]; int n = ReadInt() * 2; double v = 0; double m = 1;
                    for (int i = 0; i < n; i++) { v += d[p++] * m; m *= 256; }
                    if (sign == 45) v = -v; object r = (long)v; objs.Add(r); return r;
                }
            case 'I':
                {
                    object o = Read(); int n = ReadInt();
                    for (int i = 0; i < n; i++) { Read(); Read(); }
                    return o;
                }
            case '[':
                {
                    var l = new List<object>(); objs.Add(l); int n = ReadInt();
                    for (int i = 0; i < n; i++) l.Add(Read());
                    return l;
                }
            case '{':
            case '}':
                {
                    var h = new RHash(); objs.Add(h); int n = ReadInt();
                    for (int i = 0; i < n; i++) { object k = Read(); object v = Read(); h.Items.Add(new KeyValuePair<object, object>(k, v)); }
                    if (t == '}') Read();
                    return h;
                }
            case 'o':
            case 'S':
                {
                    var o = new RObj(); objs.Add(o); o.Cls = ((RSym)Read()).N; int n = ReadInt();
                    for (int i = 0; i < n; i++) { string k = ((RSym)Read()).N; object v = Read(); o.Iv.Add(new KeyValuePair<string, object>(k, v)); }
                    return o;
                }
            case 'u':
                {
                    var o = new RObj(); o.Cls = ((RSym)Read()).N; int n = ReadInt(); o.Raw = new byte[n]; Array.Copy(d, p, o.Raw, 0, n); p += n; objs.Add(o); return o;
                }
            case 'U':
                {
                    var o = new RObj(); objs.Add(o); o.Cls = ((RSym)Read()).N; o.Iv.Add(new KeyValuePair<string, object>("_u", Read())); return o;
                }
            case 'e': Read(); return Read();
            case 'C': Read(); return Read();
            case 'c':
            case 'm': { string s = ReadStr(); objs.Add(s); return s; }
            default: throw new Exception("Unknown marshal type " + t + " at " + (p - 1));
        }
    }
}

public class Entry { public string Name; public uint Off, Size, Key; }

public static class Archive
{
    public static List<Entry> Read(byte[] arc)
    {
        var list = new List<Entry>();
        unchecked
        {
            uint key = BitConverter.ToUInt32(arc, 8) * 9 + 3;
            int pos = 12;
            while (true)
            {
                uint off = BitConverter.ToUInt32(arc, pos) ^ key; pos += 4;
                if (off == 0) break;
                uint size = BitConverter.ToUInt32(arc, pos) ^ key; pos += 4;
                uint fk = BitConverter.ToUInt32(arc, pos) ^ key; pos += 4;
                uint nl = BitConverter.ToUInt32(arc, pos) ^ key; pos += 4;
                byte[] nb = new byte[nl];
                for (int i = 0; i < nl; i++) nb[i] = (byte)(arc[pos + i] ^ (byte)(key >> (8 * (i % 4))));
                pos += (int)nl;
                var e = new Entry(); e.Name = Encoding.UTF8.GetString(nb); e.Off = off; e.Size = size; e.Key = fk;
                list.Add(e);
            }
        }
        return list;
    }

    public static byte[] Extract(byte[] arc, Entry e)
    {
        byte[] o = new byte[e.Size];
        unchecked
        {
            uint k = e.Key;
            for (int i = 0; i < e.Size; i++)
            {
                if (i > 0 && i % 4 == 0) k = k * 7 + 3;
                o[i] = (byte)(arc[e.Off + i] ^ (byte)(k >> (8 * (i % 4))));
            }
        }
        return o;
    }
}
