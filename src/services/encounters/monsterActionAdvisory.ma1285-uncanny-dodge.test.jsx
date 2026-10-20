// @maintained-by-ai
// MA-1285/1290/1309/1313 reaction-category advisory twins — FAIL(b) zero-
// affordance rows (name/trigger/description-only §60) fixed via the SAME
// Option A one-field advisory seam: advisory:"monster_<name>", advisory_message
// NOT authored (builder fallback copy is honest), zero affordance → every
// MonsterAction chip lane null except AdvisoryLink, no automation.effect →
// GatedReactionSlot null. ZERO code; mirrors MA-1223/MA-1224 siblings.
//
// Lane (applied-rec #1084 verdict): this .jsx is the RENDER + DISK-BYTES lane
// for the five ticket rows — render-faces and per-ticket bytes KEPT here with
// exact DOM/disk bytes; generic machinery-faces consolidated or cut-to-cite.
// Family/cite map:
// - monsterActionAdvisory.test.js = family base (#976): detector truthiness
//   shape :51-59, popup/log builder chrome + fallback pattern :61-85,
//   one-press/refire resolver mechanism :87-108 — not re-machined here.
// - MonsterAction.ma1223-nalfeshnee-teleport-advisory-chip.test.jsx :54-78
//   + ma1224-…-chip.test.jsx :71-78 own the ROW-INDEPENDENT press pattern
//   and both inert lanes (attackerCannotAct / no resolver) per #467 — the
//   4 press + 4 incapacitated re-runs here are deleted citing those lanes.
// - ma1224-nalfeshnee-pursuit.test.js = reaction-category exemplar
//   (#1084): builders cut, resolver popup-arg strengthened — mirrored here.
// Ticket-distinct bytes KEPT (#993/#977 rows verbatim, #829 verified-vs-
// disk-not-transcribed, #934/#1026 string-not-action inertness):
// - MA-1285: Performer + Scout Captain Uncanny Dodge twins (advisory key ×2
//   on disk) + co-located te-channel near-miss decoys feather_fall/parry
//   (#948); the Scout twin carries this file's single reaction-category refire
//   fold (refires here were the 4th-6th copies of base :100-108).
// - MA-1290: Warding Charm save_type/save_effect bytes in the RAW block,
//   save_dc UNDEFINED (no DC invented).
// - MA-1309 Defensive Stance / MA-1313 Riposte: distinct triggers and AC
//   prose — the +4/+2 hit-negation clocks (Option B) stay out of scope.
// Old→new map: 13 disk tests → 1 it.each row-table; 4 detector → 1 (twins
// folded); 4 chip renders → 1 it.each (press/inert faces cut-to-cite); 8
// builder tests → REMOVED (base chrome; per-row fallback copy strengthened
// into the resolver popup arg); 4 one-press + 4 refire → 1 resolver it.each
// with the refire folded on the scout twin. 47 tests → 16 runs.
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import monstersData from '../../../public/data/monsters.json';
import { MonsterAction } from '../../components/encounter/MonsterAction.jsx';
import {
  isMonsterActionAdvisoryRow,
  resolveMonsterActionAdvisoryRow,
} from './monsterActionAdvisory.js';

const RAW = readFileSync('public/data/monsters.json', 'utf8');
const byIndex = (index) => monstersData.find((m) => m.index === index);

// Ticket row table — every per-ticket distinct byte comes from the parsed
// disk row itself (#829), assembled into the contiguous RAW block that must
// sit byte-verbatim on disk before the advisory field closes the row.
const ROWS = [
  { ticket: 'MA-1285', label: 'Performer Uncanny Dodge', action: byIndex('performer').reactions[0], monsterName: 'Performer 1', key: 'monster_uncanny_dodge', keyCount: 2, fields: ['trigger', 'description'] },
  { ticket: 'MA-1285', label: 'Scout Captain Uncanny Dodge', action: byIndex('scout-captain').reactions[0], monsterName: 'Scout Captain 1', key: 'monster_uncanny_dodge', keyCount: 2, fields: ['trigger', 'description'], refire: true },
  { ticket: 'MA-1290', label: 'Performer Legend Warding Charm', action: byIndex('performer-legend').reactions[0], monsterName: 'Performer Legend 1', key: 'monster_warding_charm', keyCount: 1, fields: ['trigger', 'description', 'save_type', 'save_effect'] },
  { ticket: 'MA-1309', label: 'Pirate Admiral Defensive Stance', action: byIndex('pirate-admiral').reactions[0], monsterName: 'Pirate Admiral 1', key: 'monster_defensive_stance', keyCount: 1, fields: ['trigger', 'description'] },
  { ticket: 'MA-1313', label: 'Pirate Captain Riposte', action: byIndex('pirate-captain').reactions[0], monsterName: 'Pirate Captain 1', key: 'monster_riposte', keyCount: 1, fields: ['trigger', 'description'] },
];

// §37 near-miss decoys (#948): live te-channel reaction twins that MUST stay
// unarmed by the advisory seam.
const FEATHER_FALL = byIndex('aarakocra-aeromancer').reactions[0];
const PARRY = byIndex('bandit-captain').reactions[0];

describe('MA-1285/1290/1309/1313 disk locks: advisory twins byte-verbatim, Option A one-field', () => {
  it.each(ROWS)('$label reactions[0]: RAW block byte-verbatim ($key ×$keyCount), zero affordance/zero-message fields', ({ action, key, keyCount, fields }) => {
    const block = [...fields.map((f) => `"${f}": ${JSON.stringify(action[f])}`), `"advisory": ${JSON.stringify(key)}`].join(',\n        ');
    expect(RAW.split(block).length - 1).toBe(1);
    expect(RAW.split(`"advisory": ${JSON.stringify(key)}`).length - 1).toBe(keyCount);
    expect(action.advisory).toBe(key);
    expect(action.advisory_message).toBeUndefined(); // fallback copy is honest — one field only
    expect(action.automation).toBeUndefined();
    expect(action.attack_bonus).toBeUndefined();
    expect(action.save_dc).toBeUndefined(); // MA-1290: prose DC 17 never becomes a DC
    expect(action.zone).toBeUndefined();
    expect(action.usage).toBeUndefined();
  });
});

describe('MA-1285/1290/1309/1313 detection: five real rows arm, te-channel twins stay inert', () => {
  it('all five advisory reactions arm via the pure truthiness detector; feather_fall/parry byte-inert (§37)', () => {
    ROWS.forEach(({ action }) => expect(isMonsterActionAdvisoryRow(action)).toBe(true));
    expect(FEATHER_FALL.automation.effect).toBe('feather_fall');
    expect(PARRY.automation.effect).toBe('parry');
    expect(isMonsterActionAdvisoryRow(FEATHER_FALL)).toBe(false);
    expect(isMonsterActionAdvisoryRow(PARRY)).toBe(false);
  });
});

const renderRow = (action, extra = {}) => {
  const onAttack = vi.fn();
  const onAdvisoryRow = vi.fn();
  const { container } = render(
    <MonsterAction
      action={action}
      index={0}
      attackerCannotAct={false}
      onAttack={onAttack}
      onDamage={vi.fn()}
      onSaveRoll={vi.fn()}
      onSpellCast={vi.fn()}
      reactionUsesUsed={{}}
      onGatedReaction={vi.fn()}
      onAdvisoryRow={onAdvisoryRow}
      {...extra}
    />
  );
  return { container, onAttack, onAdvisoryRow };
};

describe('MA-1285/1290/1309/1313 render lane: advisory chip arms on each zero-affordance reaction row', () => {
  // Press routing + incapacitated-inert are row-independent renderer paths
  // owned by MonsterAction.ma1223-…-chip.test.jsx:54-78 / ma1224 :71-78.
  it.each(ROWS)('$label row renders exactly ONE advisory chip labelled with the row name, honest GM-enforced title', ({ action }) => {
    const { container } = renderRow(action);
    const chip = container.querySelector('.mc-dice-link-advisory');
    expect(chip).not.toBe(null);
    expect(chip.textContent).toContain(action.name);
    expect(chip.getAttribute('title')).toMatch(/GM-enforced/);
    expect(container.querySelectorAll('.mc-dice-link')).toHaveLength(1);
  });

  it('chip press routes onAdvisoryRow with the row verbatim, never onAttack', () => {
    const { container, onAttack, onAdvisoryRow } = renderRow(ROWS[0].action);
    fireEvent.click(container.querySelector('.mc-dice-link-advisory'));
    expect(onAdvisoryRow).toHaveBeenCalledTimes(1);
    expect(onAdvisoryRow.mock.calls[0][0]).toBe(ROWS[0].action);
    expect(onAttack).not.toHaveBeenCalled();
  });
});

describe('MA-1285/1290/1309/1313 resolver on every ticket row — record-only, string-not-action', () => {
  it.each(ROWS)('$label: popup string + exactly ONE ability_use log per press; zero rolls, zero spends, zero refusals', async ({ action, monsterName, refire }) => {
    const addEntry = vi.fn(() => Promise.resolve());
    const setPopupHtml = vi.fn();
    const press = () => resolveMonsterActionAdvisoryRow({ action, monsterName, campaignName: 'test-campaign', setPopupHtml, deps: { addEntry } });
    const res = await press();
    expect(res.resolved).toBe(true);
    expect(setPopupHtml).toHaveBeenCalledTimes(1);
    const popup = setPopupHtml.mock.calls[0][0];
    expect(popup).toMatch(/^<div class="mc-prerequisite-refusal"><h3>/);
    expect(popup).toContain(`Action — ${action.name}</h3>`);
    expect(popup).toContain(`${action.name} is GM-enforced (no engine consumer for this mechanic)`);
    expect(addEntry).toHaveBeenCalledTimes(1);
    const entry = addEntry.mock.calls[0][1];
    expect(entry.type).toBe('ability_use');
    expect(entry.characterName).toBe(monsterName);
    expect(entry.abilityName).toBe(action.name);
    expect(entry.rollType).toBeUndefined();
    expect(entry.roll).toBeUndefined();
    if (refire) {
      // Reaction-category refire fold (MA-1285 twin): nothing authored means
      // nothing to gate — second press stays record-only (mechanism base :100-108).
      await press();
      expect(addEntry).toHaveBeenCalledTimes(2);
      expect(setPopupHtml).toHaveBeenCalledTimes(2);
    }
    expect(addEntry).not.toHaveBeenCalledWith('test-campaign', expect.objectContaining({ automationType: expect.stringMatching(/refused|spend/i) }));
  });
});
