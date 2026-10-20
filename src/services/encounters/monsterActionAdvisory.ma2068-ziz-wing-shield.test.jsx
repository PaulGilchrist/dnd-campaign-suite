// @maintained-by-ai
// MA-2068 regression: REACTION-category advisory one-field fix on the Ziz
// "Wing Shield" row (name/trigger/description-only §60; zero affordance →
// every MonsterAction chip lane null; no automation.effect → GatedReactionSlot
// null; no ranged-target reaction gate in GATED_MONSTER_REACTIONS/
// RAW_EVENT_GATE_RESOLVERS and no temporary-AC-vs-trigger consumer app-wide
// — §406, parry is melee-only, shield gates targeted_by_spell only).
// Option A advisory floor: advisory:"wing_shield" + advisory_message carrying
// the RAW ranged-target trigger and +5 AC fold in prose — NO automation
// authored (would be inert with no ranged-target event producer; §398 honest
// floor per MA-2018 Thunderbird Updraft twin + MA-1851 Spell Absorption).
//
// Lane (applied-rec #1084/#1085/#1087/#1088 verdicts): ticket-distinct disk
// bytes + render-faces KEPT here, all bytes derived programmatically from the
// parsed disk row (#993/#977/#1086 — never transcribed prose/em-dashes);
// generic resolver/chip machinery cut-to-cite, not re-machined.
// Family/cite map:
// - monsterActionAdvisory.test.js = family base (#976): detector truthiness
//   :51-59, popup/log builder chrome :61-85, one-press resolver mechanism
//   :87-98, refire mechanism :100-108 — not re-machined here.
// - MonsterAction.ma1223-nalfeshnee-teleport-advisory-chip.test.jsx owns the
//   row-independent press pattern :54-70 and both inert lanes
//   (attackerCannotAct / no resolver) :72-79 per #467 — this file's chip-press
//   and incapacitated-inertness re-runs deleted citing those lanes.
// - ma1285-uncanny-dodge.test.jsx :152-158 owns the reaction-category refire
//   fold — this file's refire test deleted (base :100-108 copy).
// - archlich twin deleted its parry/shield te-channel decoys' exclusivity
//   here (#1087 owns that set): ziz's ticket-distinct decoys are the
//   quetzalcoatl "Wing Defense" cross-card near-miss (ranged-WEAPON-targeted
//   wing reaction, zero advisory/automation bytes — the closest confusion to
//   ziz's wing + ranged-target row) and ziz's own Beak melee-reach attack
//   lane (reach "15 ft." vs the ranged trigger, §1035 guard reaches branch).
// Ticket-distinct core KEPT (#829 exact-once, #948 co-located decoys): ziz
// reactions[0] verbatim block, ONE advisory chip with the exact em-dash title
// bytes and zero save-shell sibling (§128), and the record-only resolver press
// with exact popup/log bytes faithful to the RAW +5 AC prose — zero rolls,
// zero spends.
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
const ZIZ = monstersData.find((m) => m.index === 'ziz');
const WING_SHIELD = ZIZ.reactions[0];

describe('MA-2068 disk lock: Ziz Wing Shield carries the Option A advisory fix', () => {
  it('reactions[0]: RAW block byte-verbatim from parsed row fields, advisory key + advisory_message unique on disk, zero mechanical fields (§398 honest floor — no ranged-target gate or temp-AC consumer claim)', () => {
    const block = ['name', 'trigger', 'description', 'advisory', 'advisory_message']
      .map((f) => `"${f}": ${JSON.stringify(WING_SHIELD[f])}`)
      .join(',\n        ');
    expect(RAW.split(block).length - 1).toBe(1);
    expect(RAW.split('"advisory": "wing_shield"').length - 1).toBe(1);
    expect(RAW.split(JSON.stringify(WING_SHIELD.advisory_message)).length - 1).toBe(1);
    expect(WING_SHIELD.advisory).toBe('wing_shield');
    expect(WING_SHIELD.trigger).toBe('When the Ziz is targeted by a ranged attack.');
    expect(WING_SHIELD.advisory_message).toContain('when targeted by a ranged attack');
    expect(WING_SHIELD.advisory_message).toContain('+5 to AC against the triggering attack');
    expect(WING_SHIELD.advisory_message).toContain('no ranged-target reaction gate');
    expect(WING_SHIELD.advisory_message).toContain('temporary-AC-vs-trigger consumer');
    expect(WING_SHIELD.advisory_message).toContain('GM-enforced');
    expect(WING_SHIELD.automation).toBeUndefined();
    expect(WING_SHIELD.attack_bonus).toBeUndefined();
    expect(WING_SHIELD.save_dc).toBeUndefined();
    expect(WING_SHIELD.save_type).toBeUndefined();
    expect(WING_SHIELD.zone).toBeUndefined();
    expect(WING_SHIELD.usage).toBeUndefined();
    expect(Object.keys(WING_SHIELD).sort()).toEqual(['advisory', 'advisory_message', 'description', 'name', 'trigger']);
  });
});

describe('MA-2068 detection: Wing Shield arms, wing/ranged near-miss twins stay inert', () => {
  it('real ziz reaction arms via the pure truthiness detector; quetzalcoatl Wing Defense ranged-weapon twin and ziz Beak melee-reach lane byte-inert (§37/#948/#1035)', () => {
    expect(isMonsterActionAdvisoryRow(WING_SHIELD)).toBe(true);
    const WING_DEFENSE = monstersData.find((m) => m.index === 'quetzalcoatl').reactions.find((a) => a.name === 'Wing Defense');
    const BEAK = ZIZ.actions.find((a) => a.name === 'Beak');
    expect(WING_DEFENSE.trigger).toContain('targeted by a ranged weapon attack');
    expect(WING_DEFENSE.advisory).toBeUndefined();
    expect(WING_DEFENSE.automation).toBeUndefined();
    expect(BEAK.attack_bonus).toBe(15);
    expect(BEAK.reach).toBe('15 ft.');
    expect(BEAK.advisory).toBeUndefined();
    expect(isMonsterActionAdvisoryRow(WING_DEFENSE)).toBe(false);
    expect(isMonsterActionAdvisoryRow(BEAK)).toBe(false);
  });
});

describe('MA-2068 render lane: exactly ONE advisory chip with the exact em-dash title, zero save-shell', () => {
  it('Wing Shield reaction row renders exactly ONE chip — name label, title carries advisory_message verbatim, no save_dc chip (§128)', () => {
    const { container } = render(
      <MonsterAction
        action={WING_SHIELD}
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
    expect(chip.textContent).toContain(WING_SHIELD.name);
    expect(chip.getAttribute('title')).toBe(`Advisory — ${WING_SHIELD.name}: ${WING_SHIELD.advisory_message}`);
    expect(container.querySelectorAll('.mc-dice-link')).toHaveLength(1);
    expect(container.querySelector('.mc-dice-link-save-clickable')).toBe(null);
  });
});

describe('MA-2068 resolver press — record-only contract with RAW +5 AC prose intact', () => {
  it('one press = exact popup + exactly ONE ability_use log to test-campaign; zero rolls, zero spends/refusals', async () => {
    const addEntry = vi.fn(() => Promise.resolve());
    const setPopupHtml = vi.fn();
    const res = await resolveMonsterActionAdvisoryRow({ action: WING_SHIELD, monsterName: 'Ziz 1', campaignName: 'test-campaign', setPopupHtml, deps: { addEntry } });
    expect(res.resolved).toBe(true);
    expect(setPopupHtml).toHaveBeenCalledTimes(1);
    expect(setPopupHtml.mock.calls[0][0]).toBe(`<div class="mc-prerequisite-refusal"><h3>Action — ${WING_SHIELD.name}</h3><p>Ziz 1 ${WING_SHIELD.advisory_message}</p></div>`);
    expect(addEntry).toHaveBeenCalledTimes(1);
    expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({ type: 'ability_use' }));
    const entry = addEntry.mock.calls[0][1];
    expect(entry.characterName).toBe('Ziz 1');
    expect(entry.abilityName).toBe(WING_SHIELD.name);
    expect(entry.description).toBe(`Ziz 1 uses ${WING_SHIELD.name}: Ziz 1 ${WING_SHIELD.advisory_message}`);
    expect(entry.rollType).toBeUndefined();
    expect(entry.roll).toBeUndefined();
    expect(addEntry).not.toHaveBeenCalledWith('test-campaign', expect.objectContaining({ automationType: expect.stringMatching(/refused|spend/i) }));
  });
});
