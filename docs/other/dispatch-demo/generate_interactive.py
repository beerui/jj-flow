# -*- coding: utf-8 -*-
"""Legacy generator. SSOT for the live demo is interactive.fragment.html (edit that file).
This script is kept only for historical/offline regeneration experiments.
"""
from pathlib import Path
import json
OUT = Path(__file__).resolve().parent
print("SSOT is interactive.fragment.html — not regenerating stale steps.")
raise SystemExit(0)
steps = [
  {"title": "0. \u63a7\u5236\u4ed3 vs \u4e1a\u52a1\u4ed3", "body": "\u591a\u9879\u76ee\u8c03\u5ea6\u4e0d\u5728\u4e1a\u52a1\u4ed3\u91cc\u558a\u547d\u4ee4\u3002\u63a7\u5236\u4ed3\u53ea\u8d1f\u8d23 Graph\uff1a\u89d2\u8272\u3001\u6279\u51c6\u3001\u6d3e\u53d1\u3001\u5bf9\u8d26\uff1b\u627f\u63a5/\u5151\u63a5/\u627f\u8f7d\u624d\u6539\u4ee3\u7801\u3002", "cmd": "\u5728\u63a7\u5236\u9879\u76ee\u6253\u5f00\u5bf9\u8bdd\uff08\u4e0d\u8981\u5728 D:\\a\\cj-web \u91cc\u76f4\u63a5 DISPATCH\uff09", "facts": ["\u63a7\u5236\u4ed3\uff1a\u8c03\u5ea6\u4e0e receipt", "\u4e1a\u52a1\u4ed3\uff1aralph / same / review \u95ed\u73af", "D:\\a \u4f8b\uff1acj-web / dj-web / cz-broker-web"], "active": {"control": True}, "done": {}, "edges": []},
  {"title": "1. PREVIEW \u53ea\u5c55\u793a", "body": "\u5148\u751f\u6210\u5b8c\u6574 task_keys\u3001depends_on\u3001\u963b\u585e\u9879\u3002\u8fd9\u4e00\u6b65\u4e0d\u521b\u5efa Codex task\u3002", "cmd": "$jj-dispatch PREVIEW\ndelivery=DEL-password-expire\ntargets=\u627f\u63a5,\u5151\u63a5,\u627f\u8f7d", "facts": ["\u4ea7\u51fa\u9884\u89c8\u8868\u4e0e task_key \u5217\u8868", "\u53ef\u53cd\u590d PREVIEW", "\u4fe1\u606f\u4e0d\u5168\u65f6\u5148 INTAKE_REQUIRED"], "active": {"control": True, "keys": True}, "done": {}, "edges": ["c-cj"]},
  {"title": "2. \u7528\u6237\u660e\u786e\u6279\u51c6", "body": "\u4f60\u6838\u5bf9\u540d\u5355\u540e\u660e\u786e\u6279\u51c6\uff0c\u51bb\u7ed3\u672c\u8f6e task_keys\u3002\u76ee\u6807/\u8d23\u4efb/attempt \u4e00\u53d8\uff0c\u65e7\u6279\u51c6\u4f5c\u5e9f\u3002", "cmd": "$jj-dispatch DISPATCH \u6279\u51c6 delivery=DEL-password-expire \u7684\u5f53\u524d task_keys", "facts": ["\u6279\u51c6\u662f\u786c\u95e8\u69db", "DISPATCH \u5148\u5199 intent \u518d\u5efa thread", "worker \u4e0d\u80fd\u81ea\u6279"], "active": {"control": True, "approve": True}, "done": {"keys": True}, "edges": ["c-cj"]},
  {"title": "3. \u7b2c\u4e00\u6ce2\uff1a\u627f\u63a5 development", "body": "\u5148\u6d3e lead\u3002\u627f\u63a5\u4ed3\u5185\u505a\u4f60\u719f\u6089\u7684 Loop\uff1a\u5b9e\u73b0 -> \u9a8c\u8bc1 -> \u5ba1\u67e5\u3002", "cmd": "task_key=DEL-password-expire/cj-web/development/1\n\u8def\u5f84=D:\\a\\cj-web", "facts": ["\u540c\u4e00 key \u5e42\u7b49", "\u72ec\u5360 worktree \u5199\u5165", "\u672a\u5b8c\u6210\u4e0d\u653e\u884c\u4e0b\u6e38"], "active": {"cj": True}, "done": {"control": True, "keys": True, "approve": True}, "edges": ["c-cj"]},
  {"title": "4. receipt \u56de\u63a7\u5236\u4ed3", "body": "\u53ea\u6709 commit / verification / review \u5f15\u7528\u5199\u56de\u540e\u624d\u7b97\u63a8\u8fdb\u3002\u804a\u5929\u7ed3\u8bba\u4e0d\u7b97\u72b6\u6001\u3002", "cmd": "control \u6d88\u8d39 receipt -> \u653e\u884c\u4e0b\u4e00 wave", "facts": ["attempt \u5fc5\u987b\u5339\u914d task_key", "\u7f3a\u8bc1\u636e\u4fdd\u6301 PENDING/BLOCKED", "\u53ef RECONCILE \u5bf9\u8d26"], "active": {"control": True, "cj": True}, "done": {"keys": True, "approve": True}, "edges": ["cj-c"]},
  {"title": "5. \u7b2c\u4e8c\u6ce2\uff1a\u5151\u63a5 + \u627f\u8f7d\u5e76\u884c", "body": "\u4f9d\u8d56\u6ee1\u8db3\u540e\u5e76\u884c\u6d3e target\u3002\u8282\u70b9\u5185\u53ef\u7528 same/ralph \u505a\u8fc1\u79fb\u6216\u9002\u914d\u3002", "cmd": "DEL-.../dj-web/development/1\nDEL-.../cz-broker-web/development/1", "facts": ["D:\\a\\dj-web \u4e0e D:\\a\\cz-broker-web", "\u53ef DIRECT / ADAPT / BLOCKED", "\u5355 target \u5931\u8d25\u4e0d\u66ff\u5168\u5c40\u5b8c\u6210"], "active": {"dj": True, "cz": True}, "done": {"control": True, "cj": True, "keys": True, "approve": True}, "edges": ["c-dj", "c-cz"]},
  {"title": "6. NEEDS_CHANGES \u8fd4\u5de5", "body": "\u4e0d\u8981\u5728\u65e7 key \u4e0a\u5077\u5077\u7eed\u5199\u3002\u5347 attempt\uff0c\u91cd\u65b0 PREVIEW -> \u6279\u51c6 -> DISPATCH\u3002", "cmd": "DEL-password-expire/dj-web/development/2", "facts": ["\u5148\u6536\u53e3\u65e7\u4e0b\u6e38", "findings \u5fc5\u987b\u53ef\u8ffd\u8e2a", "\u65b0 key \u624d\u662f\u5408\u6cd5\u91cd\u8bd5\u8eab\u4efd"], "active": {"dj": True, "control": True}, "done": {"cj": True, "cz": True, "keys": True}, "edges": ["dj-c", "c-dj"], "blocked": {"dj": True}},
  {"title": "7. \u5168\u90e8 VERIFIED", "body": "\u6bcf\u4e2a target \u7684 terminal writer commit \u4e0e Review PASS \u4e00\u81f4\u540e\uff0cdelivery \u624d\u5b8c\u6210\u3002", "cmd": "delivery.status = VERIFIED", "facts": ["\u6210\u529f\u7ec8\u6001\uff1aVERIFIED / NO_CHANGE_REQUIRED", "\u53ef\u5bfc\u51fa handoff / \u5f52\u6863", "\u6062\u590d\u53ea\u8ba4 artifact\uff0c\u4e0d\u8ba4\u804a\u5929"], "active": {}, "done": {"control": True, "cj": True, "dj": True, "cz": True, "keys": True, "approve": True}, "edges": ["c-cj", "c-dj", "c-cz", "cj-c", "dj-c", "cz-c"]},
]
labels = {"control": ["\u63a7\u5236\u4ed3", "dispatch only"], "keys": ["task_keys", "\u6279\u51c6\u5feb\u7167"], "approve": ["\u7528\u6237\u6279\u51c6", "\u51bb\u7ed3\u672c\u8f6e"], "cj": ["\u627f\u63a5 cj-web", "D:/a/cj-web"], "dj": ["\u5151\u63a5 dj-web", "D:/a/dj-web"], "cz": ["\u627f\u8f7d cz-broker-web", "D:/a/cz-broker-web"]}
css = (
  ".dispatch-demo{margin:1.25rem 0 1.75rem;padding:1rem;border:1px solid var(--line,#e5e7eb);border-radius:14px;background:var(--surface,#fff)}\n" +
  ".dispatch-demo__toolbar{display:flex;flex-wrap:wrap;gap:.75rem;justify-content:space-between;align-items:center}\n" +
  ".dispatch-demo__steps{display:flex;flex-wrap:wrap;gap:.4rem}\n" +
  ".dispatch-demo__step{border:1px solid var(--line,#e5e7eb);background:var(--panel,#f3f4f6);color:var(--text,#111827);border-radius:999px;padding:.25rem .65rem;font-size:.85rem;cursor:pointer}\n" +
  ".dispatch-demo__step[aria-selected=\"true\"]{background:var(--accent-soft,#e0e7ff);border-color:color-mix(in srgb,var(--accent,#4f46e5) 45%,var(--line,#e5e7eb));font-weight:500}\n" +
  ".dispatch-demo__nav{display:flex;gap:.5rem}\n" +
  ".dispatch-demo__btn{border:1px solid var(--line,#e5e7eb);background:var(--panel,#f3f4f6);color:var(--text,#111827);border-radius:10px;padding:.4rem .8rem;cursor:pointer}\n" +
  ".dispatch-demo__btn--primary{background:var(--text,#111827);color:#fff;border-color:transparent}\n" +
  ".dispatch-demo__btn:disabled{opacity:.45;cursor:not-allowed}\n" +
  ".dispatch-demo__progress{margin:.75rem 0 .25rem;color:var(--muted,#6b7280);font-size:.9rem}\n" +
  ".dispatch-demo__stage{display:block;margin-top:.5rem;border-radius:12px;background:#0b1220}\n" +
  ".dispatch-demo__panel{margin-top:.9rem;padding:.9rem 1rem;border-radius:12px;background:var(--panel,#f3f4f6)}\n" +
  ".dispatch-demo__panel h3{margin:0 0 .4rem;font-size:1.05rem}\n" +
  ".dispatch-demo__panel p{margin:0 0 .7rem}\n" +
  ".dispatch-demo__cmd{display:flex;flex-wrap:wrap;gap:.6rem;align-items:center;margin-bottom:.7rem}\n" +
  ".dispatch-demo__cmd code{flex:1 1 16rem;display:block;padding:.55rem .7rem;border-radius:8px;background:#111827;color:#dbeafe;white-space:pre-wrap;word-break:break-word}\n" +
  ".dispatch-demo__panel ul{margin:0;padding-left:1.15rem}\n" +
  ".dispatch-demo__panel li{margin:.2rem 0;color:var(--muted,#4b5563)}\n" +
  ".dispatch-demo .lane{fill:#111827;stroke:#1f2937}\n" +
  ".dispatch-demo .node{fill:#1f2937;stroke:#6b7280;stroke-width:1.5}\n" +
  ".dispatch-demo .node.active{fill:#172554;stroke:#60a5fa;stroke-width:2.2}\n" +
  ".dispatch-demo .node.done{fill:#052e1c;stroke:#34d399}\n" +
  ".dispatch-demo .node.blocked{fill:#3f1d1d;stroke:#f87171}\n" +
  ".dispatch-demo .edge{fill:none;stroke:#374151;stroke-width:2;opacity:.35}\n" +
  ".dispatch-demo .edge.active{stroke:#60a5fa;stroke-width:2.8;opacity:1}\n" +
  ".dispatch-demo .edge.done{stroke:#34d399;opacity:1}\n" +
  ".dispatch-demo .label{fill:#e5e7eb;font-size:13px;font-family:ui-sans-serif,system-ui,sans-serif}\n" +
  ".dispatch-demo .sub,.dispatch-demo .zone{fill:#9ca3af;font-size:12px;font-family:ui-sans-serif,system-ui,sans-serif}\n")
steps_json = json.dumps(steps, ensure_ascii=False)
labels_json = json.dumps(labels, ensure_ascii=False)
js_parts = []
js_parts.append("(() => {")
js_parts.append("  const root = document.getElementById(\"dispatch-demo-app\");")
js_parts.append("  if (!root || root.dataset.ready === \"1\") return;")
js_parts.append("  root.dataset.ready = \"1\";")
js_parts.append("  const steps = __STEPS__;")
js_parts.append("  const labels = __LABELS__;")
js_parts.append("  const nodes = { control:{x:360,y:34,w:170,h:54}, keys:{x:40,y:34,w:150,h:54}, approve:{x:700,y:34,w:150,h:54}, cj:{x:50,y:190,w:200,h:72}, dj:{x:350,y:190,w:200,h:72}, cz:{x:650,y:190,w:210,h:72} };")
js_parts.append("  const edgePaths = { \"c-cj\":\"M400 88 C 300 120, 180 150, 150 190\", \"c-dj\":\"M445 88 C 445 120, 445 150, 450 190\", \"c-cz\":\"M490 88 C 590 120, 700 150, 755 190\", \"cj-c\":\"M150 190 C 210 150, 320 120, 400 88\", \"dj-c\":\"M450 190 C 450 150, 448 120, 445 88\", \"cz-c\":\"M755 190 C 690 150, 560 120, 490 88\" };")
js_parts.append("  const stage = root.querySelector(\".dispatch-demo__stage\");")
js_parts.append("  const stepsEl = root.querySelector(\".dispatch-demo__steps\");")
js_parts.append("  const progress = root.querySelector(\"[data-progress]\");")
js_parts.append("  const titleEl = root.querySelector(\"[data-title]\");")
js_parts.append("  const bodyEl = root.querySelector(\"[data-body]\");")
js_parts.append("  const cmdEl = root.querySelector(\"[data-cmd]\");")
js_parts.append("  const factsEl = root.querySelector(\"[data-facts]\");")
js_parts.append("  const prevBtn = root.querySelector('[data-action=\"prev\"]');")
js_parts.append("  const nextBtn = root.querySelector('[data-action=\"next\"]');")
js_parts.append("  const copyBtn = root.querySelector('[data-action=\"copy\"]');")
js_parts.append("  let index = 0;")
js_parts.append("  steps.forEach((_, i) => { const btn = document.createElement(\"button\"); btn.type = \"button\"; btn.className = \"dispatch-demo__step\"; btn.setAttribute(\"role\", \"tab\"); btn.textContent = String(i); btn.addEventListener(\"click\", () => { index = i; render(); }); stepsEl.appendChild(btn); });")
js_parts.append("  function nodeClass(id, step) { if (step.blocked && step.blocked[id]) return \"node blocked\"; if (step.active[id]) return \"node active\"; if (step.done[id]) return \"node done\"; return \"node\"; }")
js_parts.append("  function edgeClass(id, step) { if (!step.edges.includes(id)) return \"edge\"; if (step.done.control && step.done.cj && step.done.dj && step.done.cz) return \"edge done\"; return \"edge active\"; }")
js_parts.append("  function renderStage(step) {")
js_parts.append("    let svg = '<defs><marker id=\"dd-arrow\" markerWidth=\"8\" markerHeight=\"8\" refX=\"6\" refY=\"3\" orient=\"auto\"><path d=\"M0,0 L6,3 L0,6 Z\" fill=\"#60a5fa\"></path></marker></defs>';")
js_parts.append("    svg += '<rect class=\"lane\" x=\"20\" y=\"16\" width=\"880\" height=\"90\" rx=\"12\"></rect>';")
js_parts.append("    svg += '<rect class=\"lane\" x=\"20\" y=\"160\" width=\"880\" height=\"120\" rx=\"12\"></rect>';")
js_parts.append("    svg += '<text class=\"zone\" x=\"32\" y=\"148\">Graph \\u5c42\\uff08\\u8c03\\u5ea6\\uff09</text>';")
js_parts.append("    svg += '<text class=\"zone\" x=\"32\" y=\"308\">Loop \\u5c42\\uff08\\u5404\\u4e1a\\u52a1\\u4ed3\\u6267\\u884c\\uff09</text>';")
js_parts.append("    Object.entries(edgePaths).forEach(([id, d]) => { svg += '<path class=\"' + edgeClass(id, step) + '\" d=\"' + d + '\" marker-end=\"url(#dd-arrow)\"></path>'; });")
js_parts.append("    Object.entries(nodes).forEach(([id, n]) => { const [t1, t2] = labels[id]; svg += '<rect class=\"' + nodeClass(id, step) + '\" x=\"' + n.x + '\" y=\"' + n.y + '\" width=\"' + n.w + '\" height=\"' + n.h + '\" rx=\"12\"></rect>'; svg += '<text class=\"label\" x=\"' + (n.x + 12) + '\" y=\"' + (n.y + 24) + '\">' + t1 + '</text>'; svg += '<text class=\"sub\" x=\"' + (n.x + 12) + '\" y=\"' + (n.y + 44) + '\">' + t2 + '</text>'; });")
js_parts.append("    stage.innerHTML = svg;")
js_parts.append("  }")
js_parts.append("  function render() {")
js_parts.append("    const step = steps[index];")
js_parts.append("    [...stepsEl.children].forEach((btn, i) => btn.setAttribute(\"aria-selected\", i === index ? \"true\" : \"false\"));")
js_parts.append("    progress.textContent = (index + 1) + \" / \" + steps.length + \" \\u00b7 \\u7528\\u6309\\u94ae\\u6216\\u5de6\\u53f3\\u65b9\\u5411\\u952e\\u5207\\u6362\";")
js_parts.append("    titleEl.textContent = step.title; bodyEl.textContent = step.body; cmdEl.textContent = step.cmd;")
js_parts.append("    factsEl.innerHTML = step.facts.map((f) => \"<li>\" + f + \"</li>\").join(\"\");")
js_parts.append("    prevBtn.disabled = index === 0; nextBtn.disabled = index === steps.length - 1; renderStage(step);")
js_parts.append("  }")
js_parts.append("  prevBtn.addEventListener(\"click\", () => { if (index > 0) { index -= 1; render(); } });")
js_parts.append("  nextBtn.addEventListener(\"click\", () => { if (index < steps.length - 1) { index += 1; render(); } });")
js_parts.append("  copyBtn.addEventListener(\"click\", async () => { try { await navigator.clipboard.writeText(steps[index].cmd); copyBtn.textContent = \"\\u5df2\\u590d\\u5236\"; setTimeout(() => { copyBtn.textContent = \"\\u590d\\u5236\\u547d\\u4ee4\"; }, 1200); } catch (e) { copyBtn.textContent = \"\\u590d\\u5236\\u5931\\u8d25\"; setTimeout(() => { copyBtn.textContent = \"\\u590d\\u5236\\u547d\\u4ee4\"; }, 1200); } });")
js_parts.append("  root.tabIndex = 0;")
js_parts.append("  root.addEventListener(\"keydown\", (e) => { if (e.key === \"ArrowLeft\" && index > 0) { index -= 1; render(); } if (e.key === \"ArrowRight\" && index < steps.length - 1) { index += 1; render(); } });")
js_parts.append("  render();")
js_parts.append("})();")
js = "\n".join(js_parts).replace("__STEPS__", steps_json).replace("__LABELS__", labels_json)
parts = []
parts.append('<div id="dispatch-demo-app" class="dispatch-demo">')
parts.append('  <div class="dispatch-demo__toolbar"><div class="dispatch-demo__steps" role="tablist" aria-label="steps"></div><div class="dispatch-demo__nav"><button type="button" class="dispatch-demo__btn" data-action="prev">\u4e0a\u4e00\u6b65</button><button type="button" class="dispatch-demo__btn dispatch-demo__btn--primary" data-action="next">\u4e0b\u4e00\u6b65</button></div></div>')
parts.append('  <p class="dispatch-demo__progress" data-progress aria-live="polite"></p>')
parts.append('  <svg class="dispatch-demo__stage" viewBox="0 0 920 360" width="100%" height="auto" role="img" aria-label="dispatch demo"></svg>')
parts.append('  <div class="dispatch-demo__panel"><h3 data-title></h3><p data-body></p><div class="dispatch-demo__cmd"><code data-cmd></code><button type="button" class="dispatch-demo__btn" data-action="copy">\u590d\u5236\u547d\u4ee4</button></div><ul data-facts></ul></div>')
parts.append('</div>')
parts.append("<style>\n" + css + "</style>")
parts.append("<script>\n" + js + "\n</script>\n")
html = "\n".join(parts)
(OUT / "interactive.fragment.html").write_text(html, encoding="utf-8")
print("bytes", len(html.encode("utf-8")))