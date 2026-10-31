// @maintained-by-ai
// AI AUDIT ROWS lane (backlog 2026-10-31 ai-audit-log-raw-json) — leaf content +
// registry routing for the ai_designer/ai_refine/ai_world(+_applied) audit sinks.
// Payload shapes are copied from the real producers:
//   ai_designer     → server/services/ai/authoring/designer.js audit() spread
//   ai_refine       → server/services/ai/authoring/refine.js audit()
//   ai_world        → server/services/ai/index.js worldAudit()
//   ai_world_applied→ src/services/ai/applyWorldProposal.js audit()
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

const firstLine = () => q('.log-ai-audit .log-ai-audit-text').textContent;

describe('AI audit rows render labeled one-line summaries', () => {
  beforeEach(beforeEachSetup);

  // ── registry routing ──────────────────────────────────────

  it.each([
    ['ai_designer', designer({ stage: 'plan', scope: {}, entityPlan: [{ kind: 'npc', count: 1 }] })],
    ['ai_refine', refine()],
    ['ai_world', { id: 'w', type: 'ai_world', name: 'AI world keeper', attempts: 1, timestamp: TS, description: 'AI world keeper proposed rumor: the wards flicker', proposal: { kind: 'rumor', text: 'the wards flicker' } }],
    ['ai_world_applied', { id: 'wa', type: 'ai_world_applied', name: 'AI world keeper', timestamp: TS, description: 'AI world keeper applied: rumor — logged.' }],
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
