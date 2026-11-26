// @maintained-by-ai 2026-10-31
// AI AUDIT ROWS lane (backlog 2026-10-31 ai-audit-log-raw-json) — leaf content +
// registry routing for the WHOLE ai_* audit family (family unification
// 2026-11-22: director/ruling/draft-review joined the designer/refine/world/
// authoring/dress rows — one attributed .log-ai-audit chrome everywhere).
// Payload shapes are copied from the real producers:
//   ai_designer         → server/services/ai/authoring/designer.js audit() spread
//   ai_refine           → server/services/ai/authoring/refine.js audit()
//   ai_world            → server/services/ai/index.js worldAudit()
//   ai_world_applied    → src/services/ai/applyWorldProposal.js audit()
//   ai_authoring        → server/services/ai/authoring/apply.js logSuccess()/failMidBatch()
//   ai_dress            → server/services/ai/authoring/dressMap.js audit() +
//                         src/components/maps-manager/AiDressButton.jsx apply()
//   ai_director         → server/services/ai/index.js directorAudit()
//   ai_director_applied → src/services/ai/applyDirectorIntent.js audit()
//   ai_ruling           → server/services/ai/index.js auditLog()
//   ai_ruling_applied   → src/services/ai/applyRuling.js audit()
//   ai_draft_approved/rejected → src/services/campaign/draftActions.js auditDraftDecision()
// Regression guard included: unknown types keep their GenericEntry fallback
// (LogGeneric.test.jsx owns those bytes).

import { screen, fireEvent, within } from '@testing-library/react';
import { beforeEach, describe, it, expect } from 'vitest';
import { q, setup, note, beforeEachSetup } from './log-test-utils.jsx';

import Log from './Log.jsx';

const TS = 1700000000000; // fixed epoch — deterministic timestamps

const designer = (o = {}) => ({
  id: 'd', type: 'ai_designer', characterName: 'AI designer', attempts: 1, timestamp: TS, ...o,
});
const refine = (o = {}) => ({
  id: 'rf', type: 'ai_refine', characterName: 'AI refine', kind: 'npc',
  instruction: 'make Marta grumpier but keep her secrets', attempts: 1, timestamp: TS, ...o,
});
const authoring = (o = {}) => ({
  id: 'au', type: 'ai_authoring', characterName: 'AI designer', timestamp: TS, ...o,
});
const dress = (o = {}) => ({
  id: 'dr', type: 'ai_dress', characterName: 'AI dress', map: 'battle-arena',
  instruction: 'add a trapped chest guarding the entrance', ops: 4, attempts: 1, timestamp: TS, ...o,
});

const firstLine = () => q('.log-ai-audit .log-ai-audit-text').textContent;

describe('AI audit rows render labeled one-line summaries', () => {
  beforeEach(beforeEachSetup);

  // ── registry routing ──────────────────────────────────────

  it.each([
    ['ai_designer', designer({ stage: 'plan', scope: {}, entityPlan: [{ kind: 'npc', count: 1 }] })],
    ['ai_refine', refine()],
    ['ai_world', { id: 'w', type: 'ai_world', characterName: 'AI world keeper', attempts: 1, timestamp: TS, description: 'AI world keeper proposed rumor: the wards flicker', proposal: { kind: 'rumor', text: 'the wards flicker' } }],
    ['ai_world_applied', { id: 'wa', type: 'ai_world_applied', characterName: 'AI world keeper', timestamp: TS, description: 'AI world keeper applied: rumor — logged.' }],
    ['ai_authoring', authoring({ scope: 'session', created: { encounters: 1 }, snapshot: 's.zip', summary: 'AI drafted 1 entity' })],
    ['ai_dress', dress({ action: 'applied', ops: 4 })],
    ['ai_director', { id: 'dir', type: 'ai_director', characterName: 'Goblin', attempts: 1, timestamp: TS, intent: { intent: 'attack', actionName: 'Bite', targetName: 'Frodo' }, description: 'AI director proposed attack: Bite → Frodo' }],
    ['ai_director_applied', { id: 'dira', type: 'ai_director_applied', characterName: 'Goblin', timestamp: TS, description: 'AI director confirmed: attack — Bite → Frodo: target set.' }],
    ['ai_ruling', { id: 'rul', type: 'ai_ruling', characterName: 'AasimarTest', attempts: 1, timestamp: TS, ruling: { type: 'dice', expression: '1d20+5' }, description: 'AI referee proposed dice: 1d20+5' }],
    ['ai_ruling_applied', { id: 'rula', type: 'ai_ruling_applied', characterName: 'AI referee', timestamp: TS, ruling: { type: 'dice', expression: '1d20+5' }, description: 'AI ruling applied: dice — 1d20+5 rolled [17] → 22' }],
    ['ai_draft_approved', { id: 'drf-a', type: 'ai_draft_approved', characterName: 'AI draft review', timestamp: TS, description: 'Approved AI draft: npc "Zorvath"' }],
    ['ai_draft_rejected', { id: 'drf-r', type: 'ai_draft_rejected', characterName: 'AI draft review', timestamp: TS, description: 'Rejected AI draft: npc "Zorvath"' }],
  ])('%s routes to the ai-audit row (never the raw-JSON generic fallback)', (type, entry) => {
    setup(Log, [entry]);
    expect(q(`.log-entry.log-ai-audit`)).toBeInTheDocument();
    expect(q('.log-entry.log-generic')).toBeNull();
    expect(q('.log-ai-audit .log-icon i.fa-robot')).toBeInTheDocument();
    expect(q('.log-ai-audit-type').textContent)
      .toBe(type.split('_').map(w => (w === 'ai' ? 'AI' : w[0].toUpperCase() + w.slice(1))).join(' '));
    expect(firstLine()).not.toMatch(/[{}]/);
    expect(q('.log-ai-audit .log-time').textContent).toMatch(/\d{2}:\d{2}:\d{2}/);
  });

  // Backlog 2026-11-22 (two-chrome-styles): the director/ruling/draft-review
  // rows moved from log-generic to the shared ai-audit chrome. Producers stamp
  // a readable description, so formatAiAuditLine renders it VERBATIM — the
  // copy is unchanged, only the chrome unified — with the author still in
  // .log-character and the category label derived from the type key.
  it('director/ruling/draft rows render author + category + verbatim description', () => {
    setup(Log, [
      { id: 'g1', type: 'ai_director', characterName: 'Goblin', description: 'AI director proposed attack: Bite → Frodo', timestamp: TS },
      { id: 'g2', type: 'ai_director_applied', characterName: 'Goblin', description: 'AI director confirmed: attack — target set', timestamp: TS },
      { id: 'g3', type: 'ai_ruling', characterName: 'AasimarTest', description: 'AI referee proposed dice: 1d20+5', timestamp: TS },
      { id: 'g4', type: 'ai_ruling_applied', characterName: 'AI referee', description: 'AI ruling applied: dice — rolled 22', timestamp: TS },
      { id: 'g5', type: 'ai_draft_approved', characterName: 'AI draft review', description: 'Approved AI draft: npc "Zorvath"', timestamp: TS },
      { id: 'g6', type: 'ai_draft_rejected', characterName: 'AI draft review', description: 'Rejected AI draft: npc "Zorvath"', timestamp: TS },
    ]);
    const rows = document.querySelectorAll('.log-entry.log-ai-audit');
    expect(rows.length).toBe(6);
    expect(document.querySelector('.log-entry.log-generic')).toBeNull();
    // Newest-first render order matches the posted array reversed.
    const expected = [
      ['g6', 'AI draft review', 'AI Draft Rejected', 'Rejected AI draft: npc "Zorvath"'],
      ['g5', 'AI draft review', 'AI Draft Approved', 'Approved AI draft: npc "Zorvath"'],
      ['g4', 'AI referee', 'AI Ruling Applied', 'AI ruling applied: dice — rolled 22'],
      ['g3', 'AasimarTest', 'AI Ruling', 'AI referee proposed dice: 1d20+5'],
      ['g2', 'Goblin', 'AI Director Applied', 'AI director confirmed: attack — target set'],
      ['g1', 'Goblin', 'AI Director', 'AI director proposed attack: Bite → Frodo'],
    ];
    expected.forEach(([, author, category, text], i) => {
      const row = rows[i];
      expect(within(row).getByText(author)).toBeInTheDocument();
      expect(row.querySelector('.log-ai-audit-type').textContent).toBe(category);
      expect(row.querySelector('.log-ai-audit-text').textContent).toBe(text);
    });
  });

  // Criterion 6 counterpart: non-family types keep their previous components.
  it('unregistered and non-ai types are unaffected by the family routing', () => {
    setup(Log, [
      { id: 'h1', type: 'gm-note', message: 'GM note still generic', timestamp: TS },
      note({ id: 'n', noteText: 'Composer note' }),
      { id: 'h2', type: 'hp_change', targetName: 'Frodo', delta: -5, currentHp: 25, maxHp: 30, sourceName: 'Goblin', timestamp: TS },
    ]);
    expect(q('.log-entry.log-generic')).toBeInTheDocument();
    expect(q('.log-entry.log-note')).toBeInTheDocument();
    expect(q('.log-entry.log-hp-change')).toBeInTheDocument();
    expect(document.querySelector('.log-ai-audit')).toBeNull();
  });

  // Backlog 2026-11-21 (MMM): the whole AI audit family stamps characterName
  // as its sole author field — designer/refine/authoring/dress rows (whose
  // headers used to render empty) now show their producer label in
  // .log-character, exactly like the world family always did.
  it('designer/refine/authoring/dress rows render their stamped author in .log-character', () => {
    setup(Log, [
      designer({ stage: 'plan', entityPlan: [{ kind: 'npc', count: 1 }] }),
      refine(),
      authoring({ scope: 'bespoke', created: { npcs: 1 }, summary: 'AI drafted 1 entity' }),
      dress({ action: 'applied' }),
    ]);
    const rows = document.querySelectorAll('.log-ai-audit');
    expect(rows.length).toBe(4);
    // Newest-first render order: dress, authoring, refine, designer.
    const authors = [...rows].map(row => row.querySelector('.log-character').textContent);
    expect(authors).toEqual(['AI dress', 'AI designer', 'AI refine', 'AI designer']);
  });

  it('pre-existing row types are unaffected alongside ai rows', () => {
    setup(Log, [
      note({ id: 'n', noteText: 'Composer note' }),
      { id: 'gm', type: 'gm-note', message: 'GM note still generic', timestamp: TS },
      refine(),
    ]);
    expect(document.querySelectorAll('.log-entry').length).toBe(3);
    expect(q('.log-entry.log-note')).toBeInTheDocument();
    expect(q('.log-entry.log-generic')).toBeInTheDocument();
    expect(q('.log-entry.log-ai-audit')).toBeInTheDocument();
  });

  // ── ai_refine outcomes ────────────────────────────────────

  it('refine success: kind + instruction + proposed outcome', () => {
    setup(Log, [refine()]);
    const line = firstLine();
    expect(line).toContain('Refine npc');
    expect(line).toContain('make Marta grumpier');
    expect(line).toContain('proposed a replacement after 1 attempt');
  });

  it('refine failure (attempts 0): refusal outcome, instruction still shown', () => {
    setup(Log, [refine({ attempts: 0 })]);
    const line = firstLine();
    expect(line).toContain('Refine npc');
    expect(line).toContain('refused — the proposed JSON failed validation');
  });

  // Backlog echo-no-op-audit: server marks echoed successes noOp — the row
  // must NOT overstate model productivity with "proposed a replacement".
  it('refine echo (noOp): honest no-change outcome, never "proposed a replacement"', () => {
    setup(Log, [refine({ noOp: true })]);
    const line = firstLine();
    expect(line).toContain('Refine npc');
    expect(line).toContain('make Marta grumpier');
    expect(line).toContain('no change proposed — the model echoed the input (no-op)');
    expect(line).not.toContain('proposed a replacement');
  });

  it('refine survives missing kind/instruction without undefined text', () => {
    setup(Log, [refine({ kind: undefined, instruction: undefined })]);
    const line = firstLine();
    expect(line).toContain('Refine entity');
    expect(line).not.toContain('undefined');
    expect(line).not.toContain('[object Object]');
  });

  // ── ai_designer stages ────────────────────────────────────

  it('designer plan success: stage + entity plan + attempts', () => {
    setup(Log, [designer({
      stage: 'plan',
      scope: { setting: 'drowned coast', tone: 'grim' },
      entityPlan: [{ kind: 'npc', count: 1 }, { kind: 'encounter', count: 1 }, { kind: 'mapPlan', count: 1 }],
    })]);
    const line = firstLine();
    expect(line).toContain('Designer plan');
    expect(line).toContain('npc 1, encounter 1, mapPlan 1');
    expect(line).toContain('after 1 attempt');
    expect(line).not.toContain('[object Object]');
  });

  it('designer plan failure: stop reason from the error field', () => {
    setup(Log, [designer({ stage: 'plan', error: 'AI_UNAVAILABLE: endpoint returned non-JSON', attempts: 0 })]);
    const line = firstLine();
    expect(line).toContain('Designer plan stopped');
    expect(line).toContain('AI_UNAVAILABLE');
    expect(line).toContain('gave up after retries');
  });

  it('designer generate success: created counts + restore point', () => {
    setup(Log, [designer({
      stage: 'generate', attempts: 2,
      created: { npcs: 1, encounters: 1, mapPlans: 0 },
      snapshot: 'test-campaign-2026-10-31T20-15.zip',
    })]);
    const line = firstLine();
    expect(line).toContain('Designer generate');
    expect(line).toContain('created npcs 1, encounters 1, mapPlans 0');
    expect(line).toContain('restore point test-campaign-2026-10-31T20-15.zip');
  });

  // Regression (bug-designer-resume-success-says-gave-up): the per-entity
  // resume success audits attempts: 0 + resumed: true — the verdict line must
  // credit the resume lane, never claim the run gave up.
  it('designer resume success: via per-entity resume, never "gave up"', () => {
    setup(Log, [designer({
      stage: 'generate', attempts: 0, resumed: true,
      created: { factions: 0, settlements: 0, npcs: 0, quests: 0, sessions: 0, encounters: 1, maps: 0 },
      snapshot: 'test-campaign-2026-10-31T22-40-56-044.zip',
    })]);
    const line = firstLine();
    expect(line).toContain('Designer generate');
    expect(line).toContain('created factions 0, settlements 0, npcs 0, quests 0, sessions 0, encounters 1, maps 0');
    expect(line).toContain('restore point test-campaign-2026-10-31T22-40-56-044.zip');
    expect(line).toContain('(via per-entity resume)');
    expect(line).not.toContain('gave up after retries');
    expect(line).not.toMatch(/attempt/);
  });

  it('legacy resume success (attempts 0, un-marked): no contradictory verdict', () => {
    setup(Log, [designer({
      stage: 'generate', attempts: 0,
      created: { encounters: 1 },
      snapshot: 'test-campaign-2026-10-31T22-40-56-044.zip',
    })]);
    const line = firstLine();
    expect(line).toContain('created encounters 1');
    expect(line).not.toContain('gave up after retries');
    expect(line).not.toMatch(/attempt/);
  });

  it('designer resume stop: errors array joined, honest "created nothing"', () => {
    setup(Log, [designer({
      stage: 'generate', fallback: 'per-entity resume', attempts: 0,
      created: {}, errors: ['generation stopped at mapPlan #1/1 — model output kept failing validation'],
    })]);
    const line = firstLine();
    expect(line).toContain('per-entity resume');
    expect(line).toContain('stopped at mapPlan #1/1');
    expect(line).not.toContain('undefined');
  });

  it('designer resume PARTIAL stop: drafted count rides the key line honestly', () => {
    setup(Log, [designer({
      stage: 'generate-resume', attempts: 0,
      errors: ['generation stopped at quest #1/1 — model output kept failing validation'],
      partial: { drafted: 1, planned: 2 },
      created: { factions: 1, maps: 0 },
      snapshot: 'test-campaign-2026-11-01T09-00.zip',
    })]);
    const line = firstLine();
    expect(line).toContain('Designer generate-resume stopped');
    expect(line).toContain('stopped at quest #1/1');
    expect(line).toContain('drafted 1 of 2 before stopping');
    expect(line).not.toContain('undefined');
    expect(line).not.toMatch(/[{}]/);
  });

  // ── ai_world lanes ────────────────────────────────────────

  // Backlog 2026-11-21 LLL: the world producers stamp the author on the ONE
  // canonical author field (characterName) — the header span renders it, and
  // a narrative row alongside still shows its own author.
  it('world + world-applied rows render their stamped author in .log-character', () => {
    setup(Log, [
      { id: 'w', type: 'ai_world', characterName: 'AI world keeper', attempts: 1, timestamp: TS, description: 'AI world keeper proposed rumor: the wards flicker', proposal: { kind: 'rumor', text: 'the wards flicker' } },
      { id: 'wa', type: 'ai_world_applied', characterName: 'AI world keeper', timestamp: TS, description: 'AI world keeper applied: rumor — logged.' },
      { id: 'n', type: 'narrative', characterName: 'GM', description: 'The party rides north.', timestamp: TS },
    ]);
    const aiRows = document.querySelectorAll('.log-ai-audit');
    expect(aiRows.length).toBe(2);
    for (const row of aiRows) {
      expect(within(row).getByText('AI world keeper')).toBeInTheDocument();
    }
    expect(document.querySelector('.log-entry.log-narrative .log-character').textContent).toBe('GM');
  });

  it('world audit with description: description is the readable line verbatim', () => {
    setup(Log, [{
      id: 'w', type: 'ai_world', characterName: 'AI world keeper', attempts: 1, timestamp: TS,
      description: 'AI world keeper proposed rumor: the wards flicker over Ironhaven',
      proposal: { kind: 'rumor', text: 'the wards flicker over Ironhaven' },
    }]);
    expect(firstLine()).toBe('AI world keeper proposed rumor: the wards flicker over Ironhaven');
  });

  it('world audit WITHOUT description (needs_human): proposal kind + text, no JSON', () => {
    setup(Log, [{
      id: 'w', type: 'ai_world', characterName: 'AI world keeper', attempts: 0, timestamp: TS,
      proposal: { kind: 'needs_human', text: 'AI world keeper unavailable — the GM supplies this.' },
    }]);
    const line = firstLine();
    expect(line).toContain('World keeper proposed needs_human');
    expect(line).toContain('the GM supplies this');
    expect(line).not.toMatch(/[{}]/);
  });

  it('world applied row shows its stamped description', () => {
    setup(Log, [{
      id: 'wa', type: 'ai_world_applied', characterName: 'AI world keeper', timestamp: TS,
      description: "AI world keeper applied: quest_draft — quest 'The Lost Relic' added directly to the ledger",
    }]);
    expect(firstLine()).toContain("quest 'The Lost Relic' added directly to the ledger");
  });

  // ── ai_authoring rows (bug-log-ai-authoring-raw-json) ─────

  it('authoring success: summary is the readable line verbatim', () => {
    setup(Log, [authoring({
      scope: 'session',
      created: { factions: 0, settlements: 0, npcs: 0, quests: 0, sessions: 0, encounters: 1, maps: 0 },
      snapshot: 'test-campaign-2026-10-31T22-40-56-044.zip',
      summary: 'AI drafted 1 entity',
    })]);
    expect(firstLine()).toBe('AI drafted 1 entity');
  });

  it('authoring failMidBatch: error + restore point readable, no JSON', () => {
    setup(Log, [authoring({
      error: 'map plan itemIndex 42 out of bounds for 20x20 grid',
      snapshot: 'test-campaign-2026-11-01T09-00-00-000.zip',
    })]);
    const line = firstLine();
    expect(line).toContain('AI authoring stopped');
    expect(line).toContain('itemIndex 42 out of bounds');
    expect(line).toContain('restore point test-campaign-2026-11-01T09-00-00-000.zip');
    expect(line).not.toMatch(/[{}]/);
  });

  it('authoring legacy row without summary: scope + counts collapse readably', () => {
    setup(Log, [authoring({
      scope: 'bespoke',
      created: { npcs: 1, encounters: 1, maps: 0 },
      snapshot: 'test-campaign-2026-11-01T09-00.zip',
    })]);
    const line = firstLine();
    expect(line).toContain('AI authoring — scope bespoke');
    expect(line).toContain('created npcs 1, encounters 1, maps 0');
    expect(line).toContain('restore point test-campaign-2026-11-01T09-00.zip');
    expect(line).not.toMatch(/[{}]/);
  });

  // ── ai_dress rows ─────────────────────────────────────────

  it('dress proposal success: map + instruction + op count + attempts', () => {
    setup(Log, [dress()]);
    const line = firstLine();
    expect(line).toContain('AI dress battle-arena');
    expect(line).toContain('trapped chest');
    expect(line).toContain('proposed 4 ops after 1 attempt');
    expect(line).not.toMatch(/[{}]/);
  });

  it('dress refusal (attempts 0): honest gave-up line, no JSON', () => {
    setup(Log, [dress({ instruction: 'line the gallery with banners', ops: 0, attempts: 0 })]);
    const line = firstLine();
    expect(line).toContain('AI dress battle-arena');
    expect(line).toContain('line the gallery with banners');
    expect(line).toContain('gave up — the model produced no valid ops');
    expect(line).not.toMatch(/[{}]/);
  });

  it('dress applied row (client AiDressButton shape): map + op count', () => {
    setup(Log, [dress({ action: 'applied', instruction: undefined, attempts: undefined })]);
    expect(firstLine()).toBe('AI dress applied to battle-arena — 4 ops');
  });

  it('dress applied row reads "1 op" singular', () => {
    setup(Log, [dress({ action: 'applied', ops: 1, instruction: undefined, attempts: undefined })]);
    expect(firstLine()).toBe('AI dress applied to battle-arena — 1 op');
  });

  it('dress applied row with no ops count: no doubled separator', () => {
    setup(Log, [dress({ action: 'applied', ops: undefined, instruction: undefined, attempts: undefined })]);
    expect(firstLine()).toBe('AI dress applied to battle-arena');
  });

  it('dress singular op count reads "1 op"', () => {
    setup(Log, [dress({ ops: 1 })]);
    expect(firstLine()).toContain('proposed 1 op after 1 attempt');
  });

  // WY backlog (2026-11-12): both producers now author a human `description`
  // on the row (server preview audit + client applied addEntry) —
  // formatAiAuditLine prefers it verbatim, so the row never renders through
  // the derived describer/label fallback.
  it('dress preview row with an authored description renders it verbatim', () => {
    setup(Log, [dress({ description: 'AI dressed "battle-arena" with 4 ops (preview)' })]);
    expect(firstLine()).toBe('AI dressed "battle-arena" with 4 ops (preview)');
  });

  it('dress applied row with an authored description renders it verbatim', () => {
    setup(Log, [dress({
      action: 'applied', instruction: undefined, attempts: undefined,
      description: 'AI dressed "battle-arena" with 4 ops (applied)',
    })]);
    expect(firstLine()).toBe('AI dressed "battle-arena" with 4 ops (applied)');
  });

  // XA backlog (2026-11-13 improve): designer audit rows now stamp a human
  // `description` too (the ai_dress pattern) — it renders verbatim, never
  // through the derived describeDesigner fallback.
  it('designer row with an authored description renders it verbatim', () => {
    setup(Log, [designer({
      stage: 'generate', attempts: 1, created: { npcs: 3 }, snapshot: 's.zip',
      description: 'AI designer drafted 3 entities (restore point s.zip)',
    })]);
    expect(firstLine()).toBe('AI designer drafted 3 entities (restore point s.zip)');
  });

  // ── robustness + sanitization ─────────────────────────────

  it('unknown ai audit shape degrades to a readable key line — no JSON dump, no [object Object]', () => {
    setup(Log, [{
      id: 'x', type: 'ai_world_applied', characterName: 'AI world keeper', timestamp: TS,
      mystery: { deep: { deeper: 1 } }, tags: ['a', 'b', 'c'], note: 'ok',
    }]);
    const line = firstLine();
    expect(line).toContain('note ok');
    expect(line).toContain('tags 3 items');
    expect(line).not.toContain('[object Object]');
    expect(line).not.toContain('undefined');
    expect(line).not.toMatch(/[{}]/);
  });

  it('model-supplied markup renders as inert escaped text (plain-text sink)', () => {
    setup(Log, [refine({ instruction: '<script>alert(1)</script><img src=x onerror=alert(1)>grumpier <b>bold</b>' })]);
    const row = q('.log-ai-audit');
    expect(row.querySelector('script')).toBeNull();
    expect(row.querySelector('img')).toBeNull();
    expect(row.innerHTML).not.toMatch(/<script/);
    expect(row.innerHTML).not.toMatch(/<img/);
    expect(firstLine()).toContain('grumpier <b>bold</b>');
  });

  // ── filters over ai rows (criterion 4) ────────────────────

  it('type and text filters still work over ai audit rows', () => {
    setup(Log, [
      note({ id: 'n', noteText: 'a plain note' }),
      refine({ id: 'rf', instruction: 'make Marta grumpier' }),
      designer({ id: 'd', stage: 'plan', entityPlan: [{ kind: 'npc', count: 1 }] }),
    ]);
    fireEvent.change(screen.getByLabelText('Type'), { target: { value: 'ai_refine' } });
    const rows = document.querySelectorAll('.log-entries .log-entry');
    expect(rows).toHaveLength(1);
    expect(rows[0].className).toContain('log-ai-audit');
    expect(rows[0].textContent).toContain('make Marta grumpier');
  });

  it('text search matches inside the instruction payload', () => {
    setup(Log, [
      note({ id: 'n', noteText: 'a plain note' }),
      refine({ id: 'rf', instruction: 'give her a mechanical parrot' }),
    ]);
    fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'parrot' } });
    const rows = document.querySelectorAll('.log-entries .log-entry');
    expect(rows).toHaveLength(1);
    expect(within(rows[0]).getByText(/mechanical parrot/)).toBeInTheDocument();
  });
});
