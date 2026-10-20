// @maintained-by-ai
// MA-2018 regression: REACTION-category advisory one-field fix on the
// Thunderbird "Updraft" row (name/trigger/description-only §60; zero
// affordance → every MonsterAction chip lane null; no automation.effect →
// GatedReactionSlot null; no flying-stop consumer in
// GATED_MONSTER_REACTIONS/RAW_EVENT_GATE_RESOLVERS — §406). Option A
// advisory floor: advisory:"updraft" + advisory_message carrying the RAW
// flight-stop trigger and 60 ft. rise in prose — NO automation{trigger}
// authored, NO movement-distance engine claim (§398 honest floor).
//
// Lane (applied-rec #1084/#1085/#1087 verdicts): ticket-distinct disk bytes +
// render-faces KEPT here, all bytes derived programmatically from the parsed
// disk row (#993/#977/#1086 — never transcribed); generic resolver/chip
// machinery cut-to-cite, not re-machined.
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
// Ticket-distinct core KEPT (#829 exact-once, #948 co-located decoys,
// #1035 guard reaches branch): thunderbird reactions[0] verbatim block,
// same-card attack/save-lane near-miss decoys (Wing attack_bonus:15,
// Thunderstrike save_dc:24 — §128 genuine save chip lives there, never on an
// advisory row), spectator Spell Reflection reaction-category te-channel
// decoy (distinct from archlich shield/parry #1087), ONE advisory chip with
// the exact em-dash title bytes, and the record-only resolver press with
// exact popup/log bytes faithful to the RAW 60 ft. prose — zero rolls,
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
const THUNDERBIRD = monstersData.find((m) => m.index === 'thunderbird');
const UPDRAFT = THUNDERBIRD.reactions[0];

describe('MA-2018 disk lock: Thunderbird Updraft carries the Option A advisory fix', () => {
  it('reactions[0]: RAW block byte-verbatim from parsed row fields, advisory key + advisory_message unique on disk, zero mechanical fields (§398 honest floor — no movement engine claim)', () => {
    const block = ['name', 'trigger', 'description', 'advisory', 'advisory_message']
      .map((f) => `"${f}": ${JSON.stringify(UPDRAFT[f])}`)
      .join(',\n        ');
    expect(RAW.split(block).length - 1).toBe(1);
    expect(RAW.split('"advisory": "updraft"').length - 1).toBe(1);
    expect(RAW.split(JSON.stringify(UPDRAFT.advisory_message)).length - 1).toBe(1);
    expect(UPDRAFT.advisory).toBe('updraft');
    expect(UPDRAFT.trigger).toBe('When the Thunderbird is forced to stop flying.');
    expect(UPDRAFT.advisory_message).toContain('when forced to stop flying');
    expect(UPDRAFT.advisory_message).toContain('immediately rises 60 ft. vertically');
    expect(UPDRAFT.advisory_message).toContain('without provoking Opportunity Attacks');
    expect(UPDRAFT.advisory_message).toContain('GM-enforced');
    expect(UPDRAFT.automation).toBeUndefined();
    expect(UPDRAFT.attack_bonus).toBeUndefined();
    expect(UPDRAFT.save_dc).toBeUndefined();
    expect(UPDRAFT.save_type).toBeUndefined();
    expect(UPDRAFT.zone).toBeUndefined();
    expect(UPDRAFT.usage).toBeUndefined();
    expect(Object.keys(UPDRAFT).sort()).toEqual(['advisory', 'advisory_message', 'description', 'name', 'trigger']);
  });
});

describe('MA-2018 detection: Updraft arms, same-card attack/save lanes and reaction te-channel twins stay inert', () => {
  it('real thunderbird reaction arms via the pure truthiness detector; attack_bonus:15 / save_dc:24 / spell_reflection automation twins byte-inert (§37/#948/#128)', () => {
    expect(isMonsterActionAdvisoryRow(UPDRAFT)).toBe(true);
    const WING = THUNDERBIRD.actions.find((a) => a.name === 'Wing');
    const THUNDERSTRIKE = THUNDERBIRD.actions.find((a) => a.name.startsWith('Thunderstrike'));
    const REFLECTION = monstersData.find((m) => m.index === 'spectator').reactions[0];
    expect(WING.attack_bonus).toBe(15);
    expect(THUNDERSTRIKE.save_dc).toBe(24);
    expect(REFLECTION.automation.effect).toBe('spell_reflection');
    expect(isMonsterActionAdvisoryRow(WING)).toBe(false);
    expect(isMonsterActionAdvisoryRow(THUNDERSTRIKE)).toBe(false);
    expect(isMonsterActionAdvisoryRow(REFLECTION)).toBe(false);
  });
});

describe('MA-2018 render lane: exactly ONE advisory chip with the exact em-dash title, zero save-shell', () => {
  it('Updraft reaction row renders exactly ONE chip — name label, title carries advisory_message verbatim, no save_dc chip (§128)', () => {
    const { container } = render(
      <MonsterAction
        action={UPDRAFT}
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
    expect(chip.textContent).toContain(UPDRAFT.name);
    expect(chip.getAttribute('title')).toBe(`Advisory — ${UPDRAFT.name}: ${UPDRAFT.advisory_message}`);
    expect(container.querySelectorAll('.mc-dice-link')).toHaveLength(1);
    expect(container.querySelector('.mc-dice-link-save-clickable')).toBe(null);
  });
});

describe('MA-2018 resolver press — record-only contract with RAW flight-stop prose intact', () => {
  it('one press = exact popup + exactly ONE ability_use log to test-campaign; zero rolls, zero spends/refusals', async () => {
    const addEntry = vi.fn(() => Promise.resolve());
    const setPopupHtml = vi.fn();
    const res = await resolveMonsterActionAdvisoryRow({ action: UPDRAFT, monsterName: 'Thunderbird 1', campaignName: 'test-campaign', setPopupHtml, deps: { addEntry } });
    expect(res.resolved).toBe(true);
    expect(setPopupHtml).toHaveBeenCalledTimes(1);
    expect(setPopupHtml.mock.calls[0][0]).toBe(`<div class="mc-prerequisite-refusal"><h3>Action — ${UPDRAFT.name}</h3><p>Thunderbird 1 ${UPDRAFT.advisory_message}</p></div>`);
    expect(addEntry).toHaveBeenCalledTimes(1);
    expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({ type: 'ability_use' }));
    const entry = addEntry.mock.calls[0][1];
    expect(entry.characterName).toBe('Thunderbird 1');
    expect(entry.abilityName).toBe(UPDRAFT.name);
    expect(entry.description).toBe(`Thunderbird 1 uses ${UPDRAFT.name}: Thunderbird 1 ${UPDRAFT.advisory_message}`);
    expect(entry.rollType).toBeUndefined();
    expect(entry.roll).toBeUndefined();
    expect(addEntry).not.toHaveBeenCalledWith('test-campaign', expect.objectContaining({ automationType: expect.stringMatching(/refused|spend/i) }));
  });
});
