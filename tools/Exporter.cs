// Generates data/gamedata.js from Game.rgss3a:
//  - item / weapon / armor names + descriptions
//  - switch / variable names
//  - a "where is it used" index built from every map, common event and troop
using System;
using System.Collections.Generic;
using System.IO;
using System.Text;
using System.Text.RegularExpressions;

public class Usage
{
    public List<string> W = new List<string>();
    public List<string> R = new List<string>();
    public int WC, RC;
    public SortedSet<long> Cmp = new SortedSet<long>();
    public SortedSet<long> Set = new SortedSet<long>();
}

public static class Exporter
{
    static Dictionary<int, Usage> V = new Dictionary<int, Usage>();
    static Dictionary<int, Usage> S = new Dictionary<int, Usage>();
    static Dictionary<int, string> mapNames = new Dictionary<int, string>();
    static string label = "?";
    static string mapLabel = "?";
    static HashSet<object> seen;
    static readonly Encoding Latin1 = Encoding.GetEncoding(28591);
    const int MaxLabels = 8;

    static string U(object s)
    {
        string x = s as string; if (x == null) return s == null ? "" : s.ToString();
        return Encoding.UTF8.GetString(Latin1.GetBytes(x));
    }

    static string J(string s)
    {
        var sb = new StringBuilder("\"");
        foreach (char c in s)
        {
            switch (c)
            {
                case '\\': sb.Append("\\\\"); break;
                case '"': sb.Append("\\\""); break;
                case '\n': sb.Append("\\n"); break;
                case '\r': sb.Append("\\r"); break;
                case '\t': sb.Append("\\t"); break;
                default:
                    if (c < 0x20) sb.Append("\\u" + ((int)c).ToString("x4")); else sb.Append(c);
                    break;
            }
        }
        return sb.Append('"').ToString();
    }

    static long L(object o) { return o is long ? (long)o : 0; }
    static int Code(RObj c) { return (int)L(c.Get("@code")); }

    static void Touch(Dictionary<int, Usage> d, int id, bool write)
    {
        if (id <= 0) return;
        Usage u;
        if (!d.TryGetValue(id, out u)) { u = new Usage(); d[id] = u; }
        if (write) { u.WC++; if (u.W.Count < MaxLabels && !u.W.Contains(label)) u.W.Add(label); }
        else { u.RC++; if (u.R.Count < MaxLabels && !u.R.Contains(label)) u.R.Add(label); }
    }
    static Usage Get(Dictionary<int, Usage> d, int id)
    {
        Usage u; if (!d.TryGetValue(id, out u)) { u = new Usage(); d[id] = u; } return u;
    }

    static readonly Regex ScriptRef = new Regex(@"\$game_(switches|variables)\[(\d+)\](\s*[-+*/%|&]?=(?!=))?", RegexOptions.Compiled);
    static void ScanScript(string code)
    {
        foreach (Match m in ScriptRef.Matches(code))
        {
            int id = int.Parse(m.Groups[2].Value);
            bool write = m.Groups[3].Success;
            Touch(m.Groups[1].Value == "switches" ? S : V, id, write);
        }
    }

    static void ProcList(List<object> list)
    {
        for (int i = 0; i < list.Count; i++)
        {
            var c = list[i] as RObj; if (c == null) continue;
            int code = Code(c);
            var p = c.Get("@parameters") as List<object>; if (p == null) continue;
            if (code == 121 && p.Count >= 3)
            {
                long a = L(p[0]), b = L(p[1]);
                if (b - a <= 20) for (long k = a; k <= b; k++) Touch(S, (int)k, true);
            }
            else if (code == 122 && p.Count >= 5)
            {
                long a = L(p[0]), b = L(p[1]);
                long op = L(p[3]);
                if (b - a <= 20) for (long k = a; k <= b; k++)
                    {
                        Touch(V, (int)k, true);
                        if (L(p[2]) == 0) { var u = Get(V, (int)k); if (op == 0) u.Set.Add(L(p[4])); }
                    }
                if (L(p[2]) == 1) Touch(V, (int)L(p[3]), false);
            }
            else if (code == 111 && p.Count >= 2)
            {
                long type = L(p[0]);
                if (type == 0) Touch(S, (int)L(p[1]), false);
                else if (type == 1 && p.Count >= 5)
                {
                    Touch(V, (int)L(p[1]), false);
                    if (L(p[2]) == 0) Get(V, (int)L(p[1])).Cmp.Add(L(p[3]));
                    else Touch(V, (int)L(p[3]), false);
                }
                else if (type == 12 && p.Count >= 2 && p[1] is string) ScanScript(U(p[1]));
            }
            else if ((code == 355 || code == 655) && p.Count >= 1 && p[0] is string) ScanScript(U(p[0]));
        }
    }

    static void PageCond(RObj page)
    {
        var cond = page.Get("@condition") as RObj; if (cond == null) return;
        if (cond.Get("@switch1_valid") is bool && (bool)cond.Get("@switch1_valid")) Touch(S, (int)L(cond.Get("@switch1_id")), false);
        if (cond.Get("@switch2_valid") is bool && (bool)cond.Get("@switch2_valid")) Touch(S, (int)L(cond.Get("@switch2_id")), false);
        if (cond.Get("@variable_valid") is bool && (bool)cond.Get("@variable_valid"))
        {
            int id = (int)L(cond.Get("@variable_id"));
            Touch(V, id, false); Get(V, id).Cmp.Add(L(cond.Get("@variable_value")));
        }
    }

    static string StripNum(string n) { return Regex.Replace(n, @"^\d+:\s*", ""); }

    static void Walk(object o)
    {
        if (o == null || o is string || o is long || o is bool || o is RSym) return;
        if (!seen.Add(o)) return;
        var list = o as List<object>;
        if (list != null)
        {
            foreach (var e in list)
            {
                if (e != null)
                {
                    var ro = e as RObj;
                    if (ro != null && ro.Cls == "RPG::EventCommand") { ProcList(list); return; }
                    break;
                }
            }
            foreach (var e in list) Walk(e);
            return;
        }
        var h = o as RHash;
        if (h != null) { foreach (var kv in h.Items) Walk(kv.Value); return; }
        var r = o as RObj;
        if (r != null)
        {
            string saved = label;
            if (r.Cls == "RPG::CommonEvent") label = "CE" + L(r.Get("@id")) + " " + StripNum(U(r.Get("@name")));
            else if (r.Cls == "RPG::Event")
            {
                string nm = U(r.Get("@name"));
                label = mapLabel + " / " + (Regex.IsMatch(nm, @"^EV\d+$") ? "Event " + L(r.Get("@id")) : nm + " #" + L(r.Get("@id")));
            }
            else if (r.Cls == "RPG::Troop") label = "Troop" + L(r.Get("@id")) + " " + U(r.Get("@name"));
            else if (r.Cls == "RPG::Event::Page") PageCond(r);
            else if (r.Cls == "RPG::Troop::Page")
            {
                var cond = r.Get("@condition") as RObj;
                if (cond != null && cond.Get("@switch_valid") is bool && (bool)cond.Get("@switch_valid")) Touch(S, (int)L(cond.Get("@switch_id")), false);
            }
            foreach (var kv in r.Iv) Walk(kv.Value);
            label = saved;
        }
    }

    static void AppendUsage(StringBuilder sb, Dictionary<int, Usage> d, List<object> names)
    {
        sb.Append("{");
        bool first = true;
        int max = Math.Max(names == null ? 0 : names.Count, 1);
        foreach (var id in new SortedSet<int>(d.Keys)) max = Math.Max(max, id + 1);
        for (int id = 1; id < max; id++)
        {
            string name = (names != null && id < names.Count) ? U(names[id]) : "";
            Usage u; d.TryGetValue(id, out u);
            if (name.Length == 0 && u == null) continue;
            if (!first) sb.Append(",\n"); first = false;
            sb.Append(id).Append(":{n:").Append(J(name));
            if (u != null)
            {
                if (u.WC > 0) { sb.Append(",wc:").Append(u.WC).Append(",w:["); AppendList(sb, u.W); sb.Append("]"); }
                if (u.RC > 0) { sb.Append(",rc:").Append(u.RC).Append(",r:["); AppendList(sb, u.R); sb.Append("]"); }
                if (u.Cmp.Count > 0) { sb.Append(",c:["); AppendNums(sb, u.Cmp, 14); sb.Append("]"); }
                if (u.Set.Count > 0) { sb.Append(",s:["); AppendNums(sb, u.Set, 14); sb.Append("]"); }
                if (u.Cmp.Count + u.Set.Count > 0)
                {
                    long mn = long.MaxValue, mx = long.MinValue;
                    foreach (long v in u.Cmp) { if (v < mn) mn = v; if (v > mx) mx = v; }
                    foreach (long v in u.Set) { if (v < mn) mn = v; if (v > mx) mx = v; }
                    sb.Append(",mn:").Append(mn).Append(",mx:").Append(mx);
                }
            }
            sb.Append("}");
        }
        sb.Append("}");
    }
    static void AppendList(StringBuilder sb, List<string> l)
    {
        for (int i = 0; i < l.Count; i++) { if (i > 0) sb.Append(","); sb.Append(J(l[i])); }
    }
    static void AppendNums(StringBuilder sb, SortedSet<long> s, int limit)
    {
        int n = 0;
        foreach (long v in s) { if (n >= limit) break; if (n > 0) sb.Append(","); sb.Append(v); n++; }
    }

    static void AppendDb(StringBuilder sb, List<object> l, string kind)
    {
        sb.Append("[");
        bool first = true;
        for (int i = 1; i < l.Count; i++)
        {
            var r = l[i] as RObj; if (r == null) continue;
            string name = U(r.Get("@name")); if (name.Length == 0) continue;
            if (!first) sb.Append(",\n"); first = false;
            sb.Append("{id:").Append(i).Append(",n:").Append(J(name)).Append(",d:").Append(J(U(r.Get("@description"))))
              .Append(",p:").Append(L(r.Get("@price")));
            if (kind == "item") sb.Append(",k:").Append(L(r.Get("@itype_id")));
            if (kind == "weapon") sb.Append(",t:").Append(L(r.Get("@wtype_id")));
            if (kind == "armor") sb.Append(",t:").Append(L(r.Get("@atype_id"))).Append(",e:").Append(L(r.Get("@etype_id")));
            sb.Append("}");
        }
        sb.Append("]");
    }

    public static void Run(string arcPath, string outPath)
    {
        byte[] arc = File.ReadAllBytes(arcPath);
        var entries = Archive.Read(arc);
        var byName = new Dictionary<string, Entry>();
        foreach (var e in entries) byName[e.Name] = e;

        Func<string, object> load = delegate (string name) { return new MP(Archive.Extract(arc, byName[name]), 0).ReadTop(); };

        // map names first (used in usage labels)
        var infos = (RHash)load("Data\\MapInfos.rvdata2");
        foreach (var kv in infos.Items) { var ro = kv.Value as RObj; if (ro != null) mapNames[(int)(long)kv.Key] = U(ro.Get("@name")); }

        // usage scan
        foreach (var e in entries)
        {
            Match m = Regex.Match(e.Name, @"^Data\\Map(\d+)\.rvdata2$");
            if (m.Success)
            {
                int id = int.Parse(m.Groups[1].Value);
                string nm; mapNames.TryGetValue(id, out nm);
                mapLabel = (nm ?? "Map") + " (Map" + id.ToString("000") + ")";
                label = mapLabel;
            }
            else if (e.Name == "Data\\CommonEvents.rvdata2" || e.Name == "Data\\Troops.rvdata2") { mapLabel = e.Name; label = e.Name; }
            else continue;
            seen = new HashSet<object>(new RefCmp());
            try { Walk(new MP(Archive.Extract(arc, e), 0).ReadTop()); }
            catch (Exception ex) { Console.WriteLine("scan error " + e.Name + ": " + ex.Message); }
        }

        var sys = (RObj)load("Data\\System.rvdata2");
        var vn = (List<object>)sys.Get("@variables");
        var sn = (List<object>)sys.Get("@switches");

        var sb = new StringBuilder();
        sb.Append("// Generated by tools/build-data.ps1 from Game.rgss3a - names, descriptions and usage index only.\n");
        sb.Append("window.MC_DATA = {\n");
        sb.Append("game: \"Magical Camp 0.5 Fin Bugfix 8c\",\n");
        sb.Append("versionId: ").Append(L(sys.Get("@version_id"))).Append(",\n");
        sb.Append("items: "); AppendDb(sb, (List<object>)load("Data\\Items.rvdata2"), "item"); sb.Append(",\n");
        sb.Append("weapons: "); AppendDb(sb, (List<object>)load("Data\\Weapons.rvdata2"), "weapon"); sb.Append(",\n");
        sb.Append("armors: "); AppendDb(sb, (List<object>)load("Data\\Armors.rvdata2"), "armor"); sb.Append(",\n");

        foreach (string tn in new string[] { "weapon_types", "armor_types" })
        {
            var tl = (List<object>)sys.Get("@" + tn);
            sb.Append(tn == "weapon_types" ? "wtypes: [" : "atypes: [");
            for (int i = 0; i < tl.Count; i++) { if (i > 0) sb.Append(","); sb.Append(J(U(tl[i]))); }
            sb.Append("],\n");
        }

        sb.Append("actors: {");
        var actors = (List<object>)load("Data\\Actors.rvdata2");
        bool first = true;
        for (int i = 1; i < actors.Count && i <= 40; i++)
        {
            var r = actors[i] as RObj; if (r == null) continue;
            string n = U(r.Get("@name")); if (n.Length == 0) continue;
            if (!first) sb.Append(","); first = false;
            sb.Append(i).Append(":").Append(J(n));
        }
        sb.Append("},\n");

        sb.Append("maps: {");
        first = true;
        foreach (var kv in mapNames) { if (!first) sb.Append(","); first = false; sb.Append(kv.Key).Append(":").Append(J(kv.Value)); }
        sb.Append("},\n");

        sb.Append("vars: "); AppendUsage(sb, V, vn); sb.Append(",\n");
        sb.Append("switches: "); AppendUsage(sb, S, sn); sb.Append("\n};\n");
        File.WriteAllText(outPath, sb.ToString(), new UTF8Encoding(false));
        Console.WriteLine("wrote " + outPath + " (" + sb.Length + " chars)");
    }
}
