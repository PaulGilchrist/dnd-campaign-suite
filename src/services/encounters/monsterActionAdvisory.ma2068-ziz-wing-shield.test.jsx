// MA-2068 regression: REACTION-category advisory one-field fix on the
// Ziz "Wing Shield" row (name/trigger/description-only, zero affordance
// §60: no attack_bonus/dice/save_dc → every MonsterAction chip lane null; no
// automation.effect → getGatedMonsterReaction null (no ranged-target gate in
// GATED_MONSTER_REACTIONS/RAW_EVENT_GATE_RESOLVERS — §406 no generic
// reactionQueue; grep-zero targeted_by_ranged consumer app-wide, parry is
// melee-only and refuses ranged by design, shield gates targeted_by_spell
// only — no temporary-AC-vs-ranged-trigger consumer exists)). Honest floor
// per MA-2018 Thunderbird Updraft twin + MA-1851 Spell Absorption
// precedent: flat advisory:"wing_shield" + advisory_message carrying the RAW
// trigger + effect verbatim as a record-only popup/log. NO automation
// authored — would be an inert automation with no ranged-target event
// producer.
// Locks disk shape + placement, detector truthiness, AdvisoryLink chip render
// with zero save-shell chip, chip press routing, and the record-only resolver
// contract: popup + ONE ability_use log per press with the RAW text, zero
// rolls, zero spends.
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import monstersData from '../../../public/data/monsters.json';
import { MonsterAction } from '../../components/encounter/MonsterAction.jsx';
import {
  isMonsterActionAdvisoryRow,
  buildMonsterActionAdvisoryPopup,
  buildMonsterActionAdvisoryLog,
  resolveMonsterActionAdvisoryRow,
} from './monsterActionAdvisory.js';

const RAW = readFileSync('public/data/monsters.json', 'utf8');
const ZIZ = monstersData.find((m) => m.index === 'ziz');
const WING_SHIELD = ZIZ.reactions[0];

describe('MA-2068 disk lock: Ziz Wing Shield carries the advisory fix', () => {
  it('reactions[0] name/trigger/description byte-identical to the RAW row', () => {
    expect(WING_SHIELD.name).toBe('Wing Shield');
    expect(WING_SHIELD.trigger).toBe('When the Ziz is targeted by a ranged attack.');
    expect(WING_SHIELD.description).toBe('Ziz folds its wings for armor, adding +5 to AC against the triggering attack.');
  });

  it('row carries advisory:"wing_shield" + advisory_message, NO automation/save_dc/attack_bonus (honest floor — no ranged-target gate or temp-AC consumer claim)', () => {
    expect(WING_SHIELD.advisory).toBe('wing_shield');
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

  it('placement mirrors MA-2018/MA-1851 sibling shape: advisory sits after description, unique on disk', () => {
    const shape = '"trigger": "When the Ziz is targeted by a ranged attack.",\n        "description": "Ziz folds its wings for armor, adding +5 to AC against the triggering attack.",\n        "advisory": "wing_shield"';
    expect(RAW.split(shape).length - 1).toBe(1);
    expect(RAW.split('"advisory": "wing_shield"').length - 1).toBe(1);
  });
});

describe('MA-2068 advisory detection on the Wing Shield reaction', () => {
  it('arms via the pure truthiness detector', () => {
    expect(isMonsterActionAdvisoryRow(WING_SHIELD)).toBe(true);
  });

  it('gated reaction twins stay unarmed (byte-inert §37)', () => {
    const PARRY = monstersData.find((m) => m.index === 'bandit-captain').reactions[0];
    const SHIELD = monstersData.find((m) => m.index === 'mind-flayer-arcanist').reactions[0];
    expect(PARRY.automation.effect).toBe('parry');
    expect(SHIELD.automation.effect).toBe('shield');
    expect(isMonsterActionAdvisoryRow(PARRY)).toBe(false);
    expect(isMonsterActionAdvisoryRow(SHIELD)).toBe(false);
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

describe('MA-2068 MonsterAction render: advisory chip arms on the reaction row', () => {
  it('Wing Shield row renders the labelled advisory chip', () => {
    const { container } = renderRow(WING_SHIELD);
    const chip = container.querySelector('.mc-dice-link-advisory');
    expect(chip).not.toBe(null);
    expect(chip.textContent).toContain('Wing Shield');
    expect(chip.getAttribute('title')).toContain('when targeted by a ranged attack');
  });

  it('NO generic save-shell chip renders (no save_dc authored — §128)', () => {
    const { container } = renderRow(WING_SHIELD);
    expect(container.querySelector('.mc-dice-link-save-clickable')).toBe(null);
  });

  it('chip press routes onAdvisoryRow with the row, never onAttack', () => {
    const { container, onAttack, onAdvisoryRow } = renderRow(WING_SHIELD);
    fireEvent.click(container.querySelector('.mc-dice-link-advisory'));
    expect(onAdvisoryRow).toHaveBeenCalledTimes(1);
    expect(onAdvisoryRow.mock.calls[0][0]).toBe(WING_SHIELD);
    expect(onAttack).not.toHaveBeenCalled();
  });

  it('incapacitated advisory chip is inert (no click route)', () => {
    const { container, onAdvisoryRow } = renderRow(WING_SHIELD, { attackerCannotAct: true });
    fireEvent.click(container.querySelector('.mc-dice-link-advisory'));
    expect(onAdvisoryRow).not.toHaveBeenCalled();
  });
});

describe('MA-2068 builders + resolver on Wing Shield — record-only contract', () => {
  it('popup carries the RAW trigger + effect faithfully (ranged-target, +5 AC fold)', () => {
    const html = buildMonsterActionAdvisoryPopup({ monsterName: 'Ziz 1', action: WING_SHIELD });
    expect(html).toMatch(/^<div class="mc-prerequisite-refusal"><h3>Action — Wing Shield<\/h3>/);
    expect(html).toContain('Ziz 1 when targeted by a ranged attack');
    expect(html).toContain('+5 to AC against the triggering attack');
    expect(html).toContain('GM-enforced');
  });

  it('log is an ability_use record naming Wing Shield, no roll fields', () => {
    const log = buildMonsterActionAdvisoryLog({ monsterName: 'Ziz 1', action: WING_SHIELD });
    expect(log.type).toBe('ability_use');
    expect(log.characterName).toBe('Ziz 1');
    expect(log.abilityName).toBe('Wing Shield');
    expect(log.description).toContain('+5 to AC against the triggering attack');
    expect(log.rollType).toBeUndefined();
    expect(log.roll).toBeUndefined();
  });

  it('one press = popup + exactly ONE ability_use log; no other writes', async () => {
    const addEntry = vi.fn(() => Promise.resolve());
    const setPopupHtml = vi.fn();
    const res = await resolveMonsterActionAdvisoryRow({ action: WING_SHIELD, monsterName: 'Ziz 1', campaignName: 'test-campaign', setPopupHtml, deps: { addEntry } });
    expect(res.resolved).toBe(true);
    expect(setPopupHtml).toHaveBeenCalledTimes(1);
    expect(addEntry).toHaveBeenCalledTimes(1);
    const entry = addEntry.mock.calls[0][1];
    expect(entry.type).toBe('ability_use');
    expect(entry.abilityName).toBe('Wing Shield');
    expect(entry.description).toMatch(/GM-enforced/);
  });

  it('refire press stays record-only: two logs, zero spends (RAW unlimited, no consumer to latch)', async () => {
    const addEntry = vi.fn(() => Promise.resolve());
    const setPopupHtml = vi.fn();
    await resolveMonsterActionAdvisoryRow({ action: WING_SHIELD, monsterName: 'Ziz 1', campaignName: 'test-campaign', setPopupHtml, deps: { addEntry } });
    await resolveMonsterActionAdvisoryRow({ action: WING_SHIELD, monsterName: 'Ziz 1', campaignName: 'test-campaign', setPopupHtml, deps: { addEntry } });
    expect(addEntry).toHaveBeenCalledTimes(2);
    expect(setPopupHtml).toHaveBeenCalledTimes(2);
    expect(addEntry).not.toHaveBeenCalledWith('test-campaign', expect.objectContaining({ automationType: expect.stringMatching(/refused|spend/i) }));
  });
});
