/**
 * R4 — Git rollback suggestion package (never executes git).
 *
 * Pure recommendation from probe facts + G-menu rules (v2).
 * Agent/CLI may pass probes collected from git; fixtures pass static probes.
 */

export const GIT_ROLLBACK_ACTIONS = Object.freeze(['keep', 'reset', 'revert', 'fix_forward', 'cancel']);

/**
 * @typedef {object} RepoProbe
 * @property {string} project_id
 * @property {string} [path]
 * @property {string} [branch]
 * @property {string[]} [task_shas] produced commits for this task (newest last or any order)
 * @property {number} [ahead] commits ahead of upstream (0 = not ahead)
 * @property {boolean} [pushed] tip already on origin (or ahead===0 and origin has tip)
 * @property {boolean} [tip_is_task_only] HEAD is exactly the task tip commit(s) with no foreign commits
 * @property {boolean} [on_integration] any task_sha is ancestor of dev/develop/main
 * @property {boolean} [dirty]
 * @property {string} [head] current HEAD sha
 */

/**
 * Recommend one strategy for a single repo probe (G-menu rules).
 * @param {RepoProbe} probe
 * @returns {{ recommended: string, options: string[], commands: string[], warnings: string[], reason: string }}
 */
export function recommendGitStrategy(probe = {}) {
  const projectId = probe.project_id || '(unknown)';
  const path = probe.path || `<path:${projectId}>`;
  const shas = uniqueShas(probe.task_shas);
  const dirty = Boolean(probe.dirty);
  const onIntegration = Boolean(probe.on_integration);
  const ahead = Number.isFinite(probe.ahead) ? Number(probe.ahead) : null;
  const pushed = probe.pushed === true || (ahead === 0 && probe.pushed !== false && probe.pushed !== null
    ? false
    : Boolean(probe.pushed));
  // If ahead is null and pushed not set, treat as unknown (conservative: offer revert + keep)
  const tipOnly = probe.tip_is_task_only === true;
  const localOnlyClean = !dirty && !onIntegration && tipOnly && (
    probe.pushed === false || (ahead !== null && ahead >= 1 && probe.pushed !== true)
  );

  const warnings = [];
  if (dirty) warnings.push('working tree dirty — resolve before reset/revert');
  if (onIntegration) {
    warnings.push('task commits appear on integration (dev/develop/main) — never reset/force-push integration');
  }
  if (pushed && !onIntegration) {
    warnings.push('feature tip may be on remote — reset requires force-push risk confirmation');
  }

  if (dirty) {
    return {
      recommended: 'cancel',
      options: ['cancel', 'keep'],
      commands: [],
      warnings,
      reason: 'dirty worktree; clean or stash before git rollback'
    };
  }

  if (onIntegration) {
    const commands = shas.length
      ? reverseShas(shas).map((sha) => `git -C ${shellPath(path)} revert ${sha} --no-edit`)
      : [`git -C ${shellPath(path)} revert <task-sha…> --no-edit`];
    commands.push('# fix-forward alternative: new commit restoring prior behavior (no history rewrite)');
    return {
      recommended: 'revert',
      options: ['revert', 'fix_forward', 'keep', 'cancel'],
      commands,
      warnings,
      reason: 'on integration: append-only revert or fix-forward only'
    };
  }

  if (localOnlyClean && shas.length) {
    const n = Math.max(1, shas.length);
    return {
      recommended: 'reset',
      options: ['reset', 'revert', 'keep', 'cancel'],
      commands: [
        `git -C ${shellPath(path)} reset --hard HEAD~${n}`,
        `# equivalent if tip is single task commit: git -C ${shellPath(path)} reset --hard ${shas[shas.length - 1]}^`
      ],
      warnings,
      reason: 'local-only clean tip of task commit(s): reset is cleaner than revert (Recommended)'
    };
  }

  if (pushed || (ahead !== null && ahead >= 1 && !tipOnly)) {
    const commands = shas.length
      ? reverseShas(shas).map((sha) => `git -C ${shellPath(path)} revert ${sha} --no-edit`)
      : [`git -C ${shellPath(path)} revert <task-sha…> --no-edit`];
    return {
      recommended: 'revert',
      options: ['revert', 'keep', 'cancel'],
      commands,
      warnings,
      reason: pushed
        ? 'feature may be shared/pushed: prefer append revert (no default force-push)'
        : 'tip is not task-only: use task-scoped revert'
    };
  }

  // Unknown probe — conservative menu
  const commands = shas.length
    ? reverseShas(shas).map((sha) => `git -C ${shellPath(path)} revert ${sha} --no-edit`)
    : [];
  return {
    recommended: shas.length ? 'revert' : 'keep',
    options: shas.length ? ['revert', 'keep', 'cancel'] : ['keep', 'cancel'],
    commands,
    warnings: warnings.concat(['probe incomplete — confirm ahead/pushed/tip before reset']),
    reason: 'insufficient probe; default keep or explicit revert after user confirm'
  };
}

/**
 * Build full R4 rollback-prep package for multiple repos.
 * Never executes git.
 *
 * @param {object} input
 * @param {RepoProbe[]} input.repos
 * @param {string} [input.delivery_id]
 * @param {string} [input.reason]
 * @returns {object}
 */
export function buildRollbackPrep({
  repos = [],
  delivery_id = null,
  reason = null
} = {}) {
  if (!Array.isArray(repos) || repos.length === 0) {
    throw new Error('buildRollbackPrep requires non-empty repos[] probes');
  }
  const items = repos.map((probe) => {
    const rec = recommendGitStrategy(probe);
    return {
      project_id: probe.project_id,
      path: probe.path || null,
      branch: probe.branch || null,
      head: probe.head || null,
      task_shas: uniqueShas(probe.task_shas),
      probe: {
        ahead: probe.ahead ?? null,
        pushed: probe.pushed ?? null,
        tip_is_task_only: probe.tip_is_task_only ?? null,
        on_integration: probe.on_integration ?? null,
        dirty: probe.dirty ?? null
      },
      recommended: rec.recommended,
      options: rec.options,
      commands: rec.commands,
      warnings: rec.warnings,
      reason: rec.reason
    };
  });

  return {
    schema_version: 'jj-flow/rollback-prep/1.0',
    delivery_id,
    reason,
    executes_git: false,
    user_confirmation_required: true,
    jj_end_boundary: {
      message: 'After land on integration, only task-scoped revert/fix-forward; never reset/force-push shared integration.',
      prefer: 'task-scoped cherry-pick on land; avoid whole-tip merge when feature contains unrelated Reverts'
    },
    g_menu: {
      '1': 'keep — control-plane only',
      '2': 'reset — local clean tip (Recommended when localOnlyClean)',
      '3': 'revert — append undo (pushed / audit / on integration)',
      '4': 'cancel'
    },
    repos: items,
    summary: {
      recommended_actions: items.map((i) => `${i.project_id}:${i.recommended}`),
      any_on_integration: items.some((i) => i.probe.on_integration),
      any_reset_recommended: items.some((i) => i.recommended === 'reset')
    }
  };
}

/**
 * Build prep from a control plane delivery's known produced commits (static; no git).
 * Useful for fixtures and Agent dry-run when probes are attached on targets/intents.
 */
export function buildRollbackPrepFromPlane(plane, {
  deliveryId,
  projectPaths = {},
  probes = {},
  reason = null
} = {}) {
  const delivery = (plane?.deliveries || []).find((d) => d.delivery_id === deliveryId);
  if (!delivery) throw new Error(`Unknown delivery: ${deliveryId}`);
  const repos = [];
  for (const target of delivery.targets || []) {
    const pid = target.project_id;
    const intents = (delivery.dispatch_intents || []).filter((i) => i.project_id === pid);
    const shas = intents
      .filter((i) => i.access === 'write' || i.responsibility === 'development')
      .map((i) => i.result?.produced_commit || i.result?.commit || target.commit || target.checkpoint?.commit)
      .filter(Boolean);
    const override = probes[pid] || {};
    repos.push({
      project_id: pid,
      path: projectPaths[pid] || plane.projects?.find((p) => p.id === pid)?.path || null,
      branch: target.intended_branch || override.branch || null,
      task_shas: uniqueShas([...(override.task_shas || []), ...shas]),
      head: override.head || target.commit || null,
      ahead: override.ahead,
      pushed: override.pushed,
      tip_is_task_only: override.tip_is_task_only,
      on_integration: override.on_integration,
      dirty: override.dirty
    });
  }
  // lead outside targets
  if (delivery.lead_project && !(delivery.targets || []).some((t) => t.project_id === delivery.lead_project)) {
    const lead = delivery.lead_project;
    const override = probes[lead] || {};
    const sha = delivery.reference_implementation?.commit
      || delivery.distribution_prompt?.source_head
      || null;
    repos.unshift({
      project_id: lead,
      path: projectPaths[lead] || plane.projects?.find((p) => p.id === lead)?.path || null,
      branch: override.branch || null,
      task_shas: uniqueShas([...(override.task_shas || []), sha].filter(Boolean)),
      head: override.head || sha,
      ahead: override.ahead,
      pushed: override.pushed,
      tip_is_task_only: override.tip_is_task_only,
      on_integration: override.on_integration,
      dirty: override.dirty
    });
  }
  return buildRollbackPrep({
    repos,
    delivery_id: deliveryId,
    reason
  });
}

function uniqueShas(list) {
  const out = [];
  const seen = new Set();
  for (const item of list || []) {
    if (!item || typeof item !== 'string') continue;
    const s = item.trim();
    if (s.length < 7) continue;
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

function reverseShas(shas) {
  return [...shas].reverse();
}

function shellPath(p) {
  return String(p).replace(/\\/g, '/');
}
