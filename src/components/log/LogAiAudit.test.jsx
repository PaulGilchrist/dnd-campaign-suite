// @maintained-by-ai
// AI AUDIT ROWS lane (backlog 2026-10-31 ai-audit-log-raw-json) — leaf content +
// registry routing for the ai_designer/ai_refine/ai_world(+_applied) and
// ai_authoring/ai_dress (bug-log-ai-authoring-raw-json) audit sinks.
// Payload shapes are copied from the real producers:
//   ai_designer     → server/services/ai/authoring/designer.js audit() spread
//   ai_refine       → server/services/ai/authoring/refine.js audit()
//   ai_world        → server/services/ai/index.js worldAudit()
//   ai_world_applied→ src/services/ai/applyWorldProposal.js audit()
//   ai_authoring    → server/services/ai/authoring/apply.js logSuccess()/failMidBatch()
//   ai_dress        → server/services/ai/authoring/dressMap.js audit() +
//                     src/components/maps-manager/AiDressButton.jsx apply()
// Regression guard included: ai_director(_applied) keep their pre-existing
// GenericEntry labeled rows (LogGeneric.test.jsx owns their bytes).

import { screen, fireEvent, within } from '@testing-library/react';
import { beforeEach, describe, it, expect } from 'vitest';
import { q, setup, note, beforeEachSetup } from './log-test-utils.jsx';

import Log from './Log.jsx';

const TS = 1700000000000; // fixed epoch — deterministic timestamps

const designer = (o = {}) => ({
  id: 'd', type: 'ai_designer', name: 'AI designer', attempts: 1, timestamp: TS, ...o,
});
const refine = (o = {}) => ({
  id: 'rf', type: 'ai_refine', name: 'AI refine', kind: 'npc',
  instruction: 'make Marta grumpier but keep her secrets', attempts: 1, timestamp: TS, ...o,
});
const authoring = (o = {}) => ({
  id: 'au', type: 'ai_authoring', name: 'AI designer', timestamp: TS, ...o,
});
const dress = (o = {}) => ({
  id: 'dr', type: 'ai_dress', name: 'AI dress', map: 'battle-arena',
  instruction: 'add a trapped chest guarding the entrance', ops: 4, attempts: 1, timestamp: TS, ...o,
});

const firstLine = () => q('.log-ai-audit .log-ai-audit-text').textContent;

describe('AI audit rows render labeled one-line summaries', () => {
  beforeEach(beforeEachSetup);

  // ── registry routing ──────────────────────────────────────

  it.each([
    ['ai_designer', designer({ stage: 'plan', scope: {}, entityPlan: [{ kind: 'npc', count: 1 }] })],
    ['ai_refine', refine()],
    ['ai_world', { id: 'w', type: 'ai_world', name: 'AI world keeper', attempts: 1, timestamp: TS, description: 'AI world keeper proposed rumor: the wards flicker', proposal: { kind: 'rumor', text: 'the wards flicker' } }],
    ['ai_world_applied', { id: 'wa', type: 'ai_world_applied', name: 'AI world keeper', timestamp: TS, description: 'AI world keeper applied: rumor — logged.' }],
    ['ai_authoring', authoring({ scope: 'session', created: { encounters: 1 }, snapshot: 's.zip', summary: 'AI drafted 1 entity' })],
    ['ai_dress', dress({ action: 'applied', ops: 4 })],
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

  it('ai_director + ai_director_applied keep their pre-existing generic labeled rows', () => {
    setup(Log, [
      { id: 'g1', type: 'ai_director', name: 'AI director', description: 'AI director proposed attack: Bite → Frodo', timestamp: TS },
      { id: 'g2', type: 'ai_director_applied', name: 'AI director', description: 'AI director confirmed: attack — target set', timestamp: TS },
    ]);
    const rows = document.querySelectorAll('.log-entry.log-generic');
    expect(rows.length).toBe(2);
    expect(document.querySelector('.log-ai-audit')).toBeNull();
    // Newest-first: [0] is the applied row posted second.
    expect(rows[0].textContent).toContain('AI director confirmed: attack — target set');
    expect(rows[1].textContent).toContain('AI director proposed attack: Bite → Frodo');
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

  it('world audit with description: description is the readable line verbatim', () => {
    setup(Log, [{
      id: 'w', type: 'ai_world', name: 'AI world keeper', attempts: 1, timestamp: TS,
      description: 'AI world keeper proposed rumor: the wards flicker over Ironhaven',
      proposal: { kind: 'rumor', text: 'the wards flicker over Ironhaven' },
    }]);
    expect(firstLine()).toBe('AI world keeper proposed rumor: the wards flicker over Ironhaven');
  });

  it('world audit WITHOUT description (needs_human): proposal kind + text, no JSON', () => {
    setup(Log, [{
      id: 'w', type: 'ai_world', name: 'AI world keeper', attempts: 0, timestamp: TS,
      proposal: { kind: 'needs_human', text: 'AI world keeper unavailable — the GM supplies this.' },
    }]);
    const line = firstLine();
    expect(line).toContain('World keeper proposed needs_human');
    expect(line).toContain('the GM supplies this');
    expect(line).not.toMatch(/[{}]/);
  });

  it('world applied row shows its stamped description', () => {
    setup(Log, [{
      id: 'wa', type: 'ai_world_applied', name: 'AI world keeper', timestamp: TS,
      description: "AI world keeper applied: quest_draft — quest 'The Lost Relic' added to the ledger (AI-drafted)",
    }]);
    expect(firstLine()).toContain("quest 'The Lost Relic' added to the ledger");
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

  // ── robustness + sanitization ─────────────────────────────

  it('unknown ai audit shape degrades to a readable key line — no JSON dump, no [object Object]', () => {
    setup(Log, [{
      id: 'x', type: 'ai_world_applied', name: 'AI world keeper', timestamp: TS,
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
