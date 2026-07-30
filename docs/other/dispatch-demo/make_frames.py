#!/usr/bin/env python3
from pathlib import Path
OUT = Path("/mnt/d/daji-docs/jj-flow/docs/other/dispatch-demo")
frames = OUT / "frames"
frames.mkdir(parents=True, exist_ok=True)
labels = {
  "control": ("\u63a7\u5236\u4ed3", "dispatch"),
  "keys": ("task_keys", "\u6279\u51c6\u5feb\u7167"),
  "approve": ("\u7528\u6237\u6279\u51c6", "\u51bb\u7ed3\u672c\u8f6e"),
  "cj": ("\u627f\u63a5 cj-web", "D:/a/cj-web"),
  "dj": ("\u5151\u63a5 dj-web", "D:/a/dj-web"),
  "cz": ("\u627f\u8f7d cz-broker-web", "D:/a/cz-broker-web"),
}
titles = [
  "0. \u63a7\u5236\u4ed3 vs \u4e1a\u52a1\u4ed3",
  "1. PREVIEW \u53ea\u5c55\u793a",
  "2. \u7528\u6237\u660e\u786e\u6279\u51c6",
  "3. \u7b2c\u4e00\u6ce2\uff1a\u627f\u63a5 development",
  "4. receipt \u56de\u63a7\u5236\u4ed3",
  "5. \u7b2c\u4e8c\u6ce2\uff1a\u5151\u63a5 + \u627f\u8f7d\u5e76\u884c",
  "6. NEEDS_CHANGES \u8fd4\u5de5",
  "7. \u5168\u90e8 VERIFIED",
]
bodies = [
  "\u63a7\u5236\u4ed3\u53ea\u8c03\u5ea6\uff1b\u4e1a\u52a1\u4ed3\u624d\u6539\u4ee3\u7801",
  "\u751f\u6210 task_keys / \u4f9d\u8d56 / \u89d2\u8272\uff0c\u4e0d\u521b\u5efa task",
  "\u51bb\u7ed3\u672c\u8f6e task_keys\uff1b\u96c6\u5408\u4e00\u53d8\u65e7\u6279\u51c6\u4f5c\u5e9f",
  "\u5148\u6d3e lead\uff1b\u5728 cj-web \u5185\u8dd1\u5b9e\u73b0/\u9a8c\u8bc1/\u5ba1\u67e5\u95ed\u73af",
  "commit + verification + review \u624d\u7b97\u63a8\u8fdb",
  "\u4f9d\u8d56\u6ee1\u8db3\u540e\u5e76\u884c\u6d3e target\uff1b\u8282\u70b9\u5185 same/ralph",
  "\u5347 attempt\uff0c\u91cd\u65b0 PREVIEW -> \u6279\u51c6 -> DISPATCH",
  "\u5404 target Review PASS \u4e14 commit \u4e00\u81f4\u540e\u5b8c\u6210",
]
cmds = [
  "\u6253\u5f00\u63a7\u5236\u9879\u76ee\uff0c\u4e0d\u8981\u5728 cj-web \u91cc\u76f4\u63a5 DISPATCH",
  "$jj-dispatch PREVIEW delivery=DEL-password-expire",
  "$jj-dispatch DISPATCH \u6279\u51c6 delivery=DEL-password-expire \u7684\u5f53\u524d task_keys",
  "task_key=DEL-password-expire/cj-web/development/1",
  "control \u6d88\u8d39 receipt -> \u653e\u884c\u4e0b\u4e00 wave",
  "dj-web/development/1 \u4e0e cz-broker-web/development/1",
  "DEL-password-expire/dj-web/development/2",
  "delivery.status = VERIFIED",
]
steps = [
  {"active": {"control"}, "done": set(), "edges": set()},
  {"active": {"control", "keys"}, "done": set(), "edges": {"c-cj"}},
  {"active": {"control", "approve"}, "done": {"keys"}, "edges": {"c-cj"}},
  {"active": {"cj"}, "done": {"control", "keys", "approve"}, "edges": {"c-cj"}},
  {"active": {"control", "cj"}, "done": {"keys", "approve"}, "edges": {"cj-c"}},
  {"active": {"dj", "cz"}, "done": {"control", "cj", "keys", "approve"}, "edges": {"c-dj", "c-cz"}},
  {"active": {"dj", "control"}, "done": {"cj", "cz", "keys"}, "edges": {"dj-c", "c-dj"}, "blocked": {"dj"}},
  {"active": set(), "done": {"control", "cj", "dj", "cz", "keys", "approve"}, "edges": {"c-cj", "c-dj", "c-cz", "cj-c", "dj-c", "cz-c"}},
]
nodes = {"control": (300, 70, 180, 64), "keys": (40, 70, 170, 64), "approve": (560, 70, 160, 64), "cj": (50, 250, 190, 84), "dj": (285, 250, 190, 84), "cz": (520, 250, 190, 84)}
edge_paths = {
  "c-cj": "M340 134 C 250 170 170 210 145 250",
  "c-dj": "M390 134 C 390 170 390 210 380 250",
  "c-cz": "M440 134 C 520 170 590 210 615 250",
  "cj-c": "M145 250 C 190 210 280 170 340 134",
  "dj-c": "M380 250 C 385 210 388 170 390 134",
  "cz-c": "M615 250 C 560 210 490 170 440 134",
}
W, H = 960, 540
def node_style(nid, step):
    blocked = step.get("blocked", set())
    if nid in blocked and nid in step["active"]:
        return "#3f1d1d", "#f87171", "#fecaca"
    if nid in step["active"]:
        return "#172554", "#60a5fa", "#dbeafe"
    if nid in step["done"]:
        return "#052e1c", "#34d399", "#d1fae5"
    return "#111827", "#6b7280", "#e5e7eb"
def edge_style(eid, step):
    if eid not in step["edges"]:
        return "#374151", 2, 0.35
    if {"control", "cj", "dj", "cz"} <= step["done"]:
        return "#34d399", 3, 1
    return "#60a5fa", 3.5, 1
def esc(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")
for i, step in enumerate(steps):
    parts = []
    parts.append('<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d" viewBox="0 0 %d %d">' % (W, H, W, H))
    parts.append('<rect width="100%" height="100%" fill="#0b1220"/>')
    parts.append('<rect x="24" y="24" width="912" height="120" rx="16" fill="#111827" stroke="#1f2937"/>')
    parts.append('<rect x="24" y="210" width="912" height="150" rx="16" fill="#111827" stroke="#1f2937"/>')
    parts.append('<text x="40" y="200" fill="#9ca3af" font-size="16" font-family="Noto Sans CJK SC, sans-serif">Graph \u5c42\uff08\u8c03\u5ea6\uff09</text>')
    parts.append('<text x="40" y="390" fill="#9ca3af" font-size="16" font-family="Noto Sans CJK SC, sans-serif">Loop \u5c42\uff08\u5404\u4e1a\u52a1\u4ed3\u6267\u884c\uff09</text>')
    parts.append('<defs><marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto"><path d="M0,0 L8,3 L0,6 Z" fill="#60a5fa"/></marker></defs>')
    for eid, d in edge_paths.items():
        color, width, opacity = edge_style(eid, step)
        parts.append('<path d="%s" fill="none" stroke="%s" stroke-width="%s" opacity="%s" marker-end="url(#arrow)"/>' % (d, color, width, opacity))
    for nid, (x, y, w, h) in nodes.items():
        fill, stroke, textc = node_style(nid, step)
        t1, t2 = labels[nid]
        parts.append('<rect x="%s" y="%s" width="%s" height="%s" rx="14" fill="%s" stroke="%s" stroke-width="2.5"/>' % (x, y, w, h, fill, stroke))
        parts.append('<text x="%s" y="%s" fill="%s" font-size="18" font-weight="500" font-family="Noto Sans CJK SC, sans-serif">%s</text>' % (x+14, y+30, textc, esc(t1)))
        parts.append('<text x="%s" y="%s" fill="#9ca3af" font-size="14" font-family="Noto Sans CJK SC, sans-serif">%s</text>' % (x+14, y+54, esc(t2)))
    parts.append('<rect x="24" y="420" width="912" height="96" rx="14" fill="#111827" stroke="#1f2937"/>')
    parts.append('<text x="44" y="455" fill="#f9fafb" font-size="22" font-weight="500" font-family="Noto Sans CJK SC, sans-serif">%s</text>' % esc(titles[i]))
    parts.append('<text x="44" y="485" fill="#d1d5db" font-size="16" font-family="Noto Sans CJK SC, sans-serif">%s</text>' % esc(bodies[i]))
    parts.append('<text x="44" y="512" fill="#93c5fd" font-size="15" font-family="Noto Sans Mono CJK SC, monospace">%s</text>' % esc(cmds[i]))
    parts.append('<text x="860" y="455" fill="#6b7280" font-size="16" font-family="Noto Sans CJK SC, sans-serif">%s/%s</text>' % (i+1, len(steps)))
    parts.append("</svg>")
    path = frames / ("frame-%02d.svg" % i)
    path.write_text("\n".join(parts), encoding="utf-8")
    print("wrote", path)
