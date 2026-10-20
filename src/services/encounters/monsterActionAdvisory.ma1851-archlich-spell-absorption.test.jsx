// @maintained-by-ai
// MA-1851 regression: REACTION-category advisory one-field fix on the Archlich
// "Spell Absorption" row (name/trigger/description-only §60; zero affordance →
// every MonsterAction chip lane null; no automation.effect → GatedReactionSlot
// null). Option A advisory floor: advisory:"spell_absorption" +
// advisory_message carrying the DC 20 Intelligence (Arcana) CHECK and the
// +10 HP regain in prose — NO bare numeric save_dc authored (§128: would arm
// a misleading generic INT saving-throw chip; this RAW is an ability check +
// spell-negation + heal). Mirrors MA-1285/1290/1309 reaction advisory twins.
//
// Lane (applied-rec #1084/#1085 verdicts): ticket-distinct disk bytes +
// render-faces KEPT here, all bytes derived programmatically from the parsed
// disk row (#993/#977/#1086 — never transcribed); generic resolver/chip
// machinery cut-to-cite, not re-machined.
// Family/cite map:
// - monsterActionAdvisory.test.js = family base (#976): detector truthiness
//   shape :51-59, popup/log builder chrome :61-85, one-press resolver
//   mechanism :87-98, refire mechanism :100-108 — not re-machined here.
// - MonsterAction.ma1223-nalfeshnee-teleport-advisory-chip.test.jsx owns the
//   row-independent press pattern :54-70 and both inert lanes (attackerCannotAct
//   / no resolver) :72-79 per #467 — the press + incapacitated re-runs here
//   are deleted citing those lanes (ma1285 .jsx :124-130 keeps the twin
//   single press).
// - ma1285-uncanny-dodge.test.jsx :152-158 owns the reaction-category refire
//   fold — this file's refire test was the 4th copy of base :100-108: deleted.
// Ticket-distinct core KEPT (#829 exact-once, #948 co-located near-miss
// decoys, #1035 guard reaches branch): Archlich row verbatim block, spell-
// targeting trigger + shield/parry te-channel decoys, ONE advisory chip with
// the DC 20 prose title and zero save-shell sibling (§128), and the record-
// only resolver press with exact popup/log bytes faithful to the RAW
// numerics — zero rolls, zero spends.
import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import monstersData from '../../../public/data/monsters.json';
import { MonsterAction } from '../../components/encounter/MonsterAction.jsx';
import {
  isMonsterActionAdvisoryRow,
  resolveMonsterActionAdvisoryRow,
} from './monsterActionAdvisory.js';

const RAW = readFileSync('public/data/monsters.json', 'utf8');
const ARCHLICH = monstersData.find((m) => m.index === 'archlich');
const SA = ARCHLICH.reactions[0];

describe('MA-1851 disk lock: Archlich Spell Absorption carries the Option A advisory fix', () => {
  it('reactions[0]: RAW block byte-verbatim from parsed row fields, advisory key unique on disk, §128 no save_dc/zero affordance', () => {
    const block = ['name', 'trigger', 'description', 'advisory', 'advisory_message']
      .map((f) => `"${f}": ${JSON.stringify(SA[f])}`)
      .join(',\n        ');
    expect(RAW.split(block).length - 1).toBe(1);
    expect(RAW.split('"advisory": "spell_absorption"').length - 1).toBe(1);
    expect(SA.advisory).toBe('spell_absorption');
    expect(SA.trigger).toContain('targeted by a spell requiring concentration');
    expect(SA.advisory_message).toContain('DC 20 Intelligence (Arcana) check');
    expect(SA.advisory_message).toContain('concentration spell fails');
    expect(SA.advisory_message).toContain('regains 10 Hit Points');
    expect(SA.advisory_message).toContain('GM-enforced');
    expect(SA.automation).toBeUndefined();
    expect(SA.attack_bonus).toBeUndefined();
    expect(SA.save_dc).toBeUndefined(); // §128: ability check ≠ saving throw — no DC chip
    expect(SA.save_type).toBeUndefined();
    expect(SA.zone).toBeUndefined();
    expect(SA.usage).toBeUndefined();
    expect(Object.keys(SA).sort()).toEqual(['advisory', 'advisory_message', 'description', 'name', 'trigger']);
  });
});

describe('MA-1851 detection: Spell Absorption arms, spell-targeting te-channel twins stay inert', () => {
  it('real archlich reaction arms via the pure truthiness detector; shield/parry reaction twins byte-inert (§37/#948)', () => {
    expect(isMonsterActionAdvisoryRow(SA)).toBe(true);
    const PARRY = monstersData.find((m) => m.index === 'bandit-captain').reactions[0];
    const SHIELD = monstersData.find((m) => m.index === 'mind-flayer-arcanist').reactions[0];
    expect(PARRY.automation.effect).toBe('parry');
    expect(SHIELD.automation.effect).toBe('shield');
    expect(isMonsterActionAdvisoryRow(PARRY)).toBe(false);
    expect(isMonsterActionAdvisoryRow(SHIELD)).toBe(false);
  });
});

describe('MA-1851 render lane: exactly ONE advisory chip with the DC 20 prose title, zero save-shell', () => {
  it('Spell Absorption reaction row renders exactly ONE chip — name label, title carries advisory_message verbatim, no save_dc chip (§128)', () => {
    const { container } = render(
      <MonsterAction
        action={SA}
        index={0}
        attackerCannotAct={false}
        onAttack={vi.fn()}
        onDamage={vi.fn()}
        onSaveRoll={vi.fn()}
        onSpellCast={vi.fn()}
        reactionUsesUsed={{}}
        onGatedReaction={vi.fn()}
        onAdvisoryRow={vi.fn()}
      />
    );
    const chip = container.querySelector('.mc-dice-link-advisory');
    expect(chip).not.toBe(null);
    expect(chip.textContent).toContain(SA.name);
    expect(chip.getAttribute('title')).toBe(`Advisory — ${SA.name}: ${SA.advisory_message}`);
    expect(container.querySelectorAll('.mc-dice-link')).toHaveLength(1);
    expect(container.querySelector('.mc-dice-link-save-clickable')).toBe(null);
  });
});

describe('MA-1851 resolver press — record-only contract with RAW numerics intact', () => {
  it('one press = exact popup + exactly ONE ability_use log to test-campaign; zero rolls, zero spends/refusals', async () => {
    const addEntry = vi.fn(() => Promise.resolve());
    const setPopupHtml = vi.fn();
    const res = await resolveMonsterActionAdvisoryRow({ action: SA, monsterName: 'Archlich 1', campaignName: 'test-campaign', setPopupHtml, deps: { addEntry } });
    expect(res.resolved).toBe(true);
    expect(setPopupHtml).toHaveBeenCalledTimes(1);
    expect(setPopupHtml.mock.calls[0][0]).toBe(`<div class="mc-prerequisite-refusal"><h3>Action — ${SA.name}</h3><p>Archlich 1 ${SA.advisory_message}</p></div>`);
    expect(addEntry).toHaveBeenCalledTimes(1);
    expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({ type: 'ability_use' }));
    const entry = addEntry.mock.calls[0][1];
    expect(entry.characterName).toBe('Archlich 1');
    expect(entry.abilityName).toBe(SA.name);
    expect(entry.description).toBe(`Archlich 1 uses ${SA.name}: Archlich 1 ${SA.advisory_message}`);
    expect(entry.rollType).toBeUndefined();
    expect(entry.roll).toBeUndefined();
    expect(addEntry).not.toHaveBeenCalledWith('test-campaign', expect.objectContaining({ automationType: expect.stringMatching(/refused|spend/i) }));
  });
});
