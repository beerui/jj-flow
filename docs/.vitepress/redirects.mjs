// 旧站点（scripts/build-docs.mjs 时代）URL → VitePress 路径。config.mjs buildEnd 据此写跳转页。
const JJ_COMMANDS = [
  'jj', 'jj-init', 'jj-ralph', 'jj-same', 'jj-dispatch', 'jj-review', 'jj-end',
  'jj-evaluated', 'jj-team-coordinate', 'jj-team-lifecycle', 'jj-team-swarm'
];

export const redirects = {
  ...Object.fromEntries(JJ_COMMANDS.map((name) => [`command-${name}.html`, `commands/${name}.html`])),
  'command-cli.html': 'commands/cli.html',
  'adr-0001-external-tool-boundary.html': 'adr/0001-external-tool-boundary.html',
  'adr-0002-project-family-control-plane.html': 'adr/0002-project-family-control-plane.html',
  // 交互演示已删除：旧地址落到对应命令页
  'ralph-demo.html': 'commands/jj-ralph.html',
  'milestones/ralph-demo.html': 'commands/jj-ralph.html',
  'dispatch-demo.html': 'commands/jj-dispatch.html',
  'milestones/dispatch-demo.html': 'commands/jj-dispatch.html',
  'end-demo.html': 'commands/jj-end.html',
  'milestones/end-demo.html': 'commands/jj-end.html'
};
