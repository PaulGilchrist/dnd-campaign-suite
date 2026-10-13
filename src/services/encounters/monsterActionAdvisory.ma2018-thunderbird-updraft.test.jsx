// MA-2018 regression: REACTION-category advisory one-field fix on the
// Thunderbird "Updraft" row (name/trigger/description-only, zero affordance
// §60: no attack_bonus/dice/save_dc → every MonsterAction chip lane null; no
// automation.effect → getGatedMonsterReaction null (no flying-stop gate in
// GATED_MONSTER_REACTIONS/RAW_EVENT_GATE_RESOLVERS — §406 no generic
// reactionQueue); grep-zero updraft consumer app-wide). Honest floor per
// MA-1851 Spell Absorption precedent + MA-2012 Somersault Leap movement twin
// (§398 no movement-distance subsystem, no flying-state machine): flat
// advisory:"updraft" + advisory_message carrying the RAW trigger + effect
// verbatim as a record-only popup/log. NO automation{trigger} authored —
// would be an inert automation with no flying-stop event consumer.
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
const THUNDERBIRD = monstersData.find((m) => m.index === 'thunderbird');
const UPDRAFT = THUNDERBIRD.reactions[0];

describe('MA-2018 disk lock: Thunderbird Updraft carries the advisory fix', () => {
  it('reactions[0] name/trigger/description byte-identical to the RAW row', () => {
    expect(UPDRAFT.name).toBe('Updraft');
    expect(UPDRAFT.trigger).toBe('When the Thunderbird is forced to stop flying.');
    expect(UPDRAFT.description).toBe('The Thunderbird immediately rises 60 ft. vertically without provoking Opportunity Attacks.');
  });

  it('row carries advisory:"updraft" + advisory_message, NO automation/save_dc/attack_bonus (§398 honest floor — no movement engine claim)', () => {
    expect(UPDRAFT.advisory).toBe('updraft');
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

  it('placement mirrors MA-1851 sibling shape: advisory sits after description, unique on disk', () => {
    const shape = '"trigger": "When the Thunderbird is forced to stop flying.",\n        "description": "The Thunderbird immediately rises 60 ft. vertically without provoking Opportunity Attacks.",\n        "advisory": "updraft"';
    expect(RAW.split(shape).length - 1).toBe(1);
    expect(RAW.split('"advisory": "updraft"').length - 1).toBe(1);
  });
});

describe('MA-2018 advisory detection on the Updraft reaction', () => {
  it('arms via the pure truthiness detector', () => {
    expect(isMonsterActionAdvisoryRow(UPDRAFT)).toBe(true);
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

describe('MA-2018 MonsterAction render: advisory chip arms on the reaction row', () => {
  it('Updraft row renders the labelled advisory chip', () => {
    const { container } = renderRow(UPDRAFT);
    const chip = container.querySelector('.mc-dice-link-advisory');
    expect(chip).not.toBe(null);
    expect(chip.textContent).toContain('Updraft');
    expect(chip.getAttribute('title')).toContain('when forced to stop flying');
  });

  it('NO generic save-shell chip renders (no save_dc authored — §128)', () => {
    const { container } = renderRow(UPDRAFT);
    expect(container.querySelector('.mc-dice-link-save-clickable')).toBe(null);
  });

  it('chip press routes onAdvisoryRow with the row, never onAttack', () => {
    const { container, onAttack, onAdvisoryRow } = renderRow(UPDRAFT);
    fireEvent.click(container.querySelector('.mc-dice-link-advisory'));
    expect(onAdvisoryRow).toHaveBeenCalledTimes(1);
    expect(onAdvisoryRow.mock.calls[0][0]).toBe(UPDRAFT);
    expect(onAttack).not.toHaveBeenCalled();
  });

  it('incapacitated advisory chip is inert (no click route)', () => {
    const { container, onAdvisoryRow } = renderRow(UPDRAFT, { attackerCannotAct: true });
    fireEvent.click(container.querySelector('.mc-dice-link-advisory'));
    expect(onAdvisoryRow).not.toHaveBeenCalled();
  });
});

describe('MA-2018 builders + resolver on Updraft — record-only contract', () => {
  it('popup carries the RAW trigger + effect faithfully (flying-stop, 60 ft. rise, no OA)', () => {
    const html = buildMonsterActionAdvisoryPopup({ monsterName: 'Thunderbird 1', action: UPDRAFT });
    expect(html).toMatch(/^<div class="mc-prerequisite-refusal"><h3>Action — Updraft<\/h3>/);
    expect(html).toContain('Thunderbird 1 when forced to stop flying');
    expect(html).toContain('immediately rises 60 ft. vertically');
    expect(html).toContain('without provoking Opportunity Attacks');
    expect(html).toContain('GM-enforced');
  });

  it('log is an ability_use record naming Updraft, no roll fields', () => {
    const log = buildMonsterActionAdvisoryLog({ monsterName: 'Thunderbird 1', action: UPDRAFT });
    expect(log.type).toBe('ability_use');
    expect(log.characterName).toBe('Thunderbird 1');
    expect(log.abilityName).toBe('Updraft');
    expect(log.description).toContain('immediately rises 60 ft. vertically');
    expect(log.rollType).toBeUndefined();
    expect(log.roll).toBeUndefined();
  });

  it('one press = popup + exactly ONE ability_use log; no other writes', async () => {
    const addEntry = vi.fn(() => Promise.resolve());
    const setPopupHtml = vi.fn();
    const res = await resolveMonsterActionAdvisoryRow({ action: UPDRAFT, monsterName: 'Thunderbird 1', campaignName: 'test-campaign', setPopupHtml, deps: { addEntry } });
    expect(res.resolved).toBe(true);
    expect(setPopupHtml).toHaveBeenCalledTimes(1);
    expect(addEntry).toHaveBeenCalledTimes(1);
    const entry = addEntry.mock.calls[0][1];
    expect(entry.type).toBe('ability_use');
    expect(entry.abilityName).toBe('Updraft');
    expect(entry.description).toMatch(/GM-enforced/);
  });

  it('refire press stays record-only: two logs, zero spends (RAW unlimited, no consumer to latch)', async () => {
    const addEntry = vi.fn(() => Promise.resolve());
    const setPopupHtml = vi.fn();
    await resolveMonsterActionAdvisoryRow({ action: UPDRAFT, monsterName: 'Thunderbird 1', campaignName: 'test-campaign', setPopupHtml, deps: { addEntry } });
    await resolveMonsterActionAdvisoryRow({ action: UPDRAFT, monsterName: 'Thunderbird 1', campaignName: 'test-campaign', setPopupHtml, deps: { addEntry } });
    expect(addEntry).toHaveBeenCalledTimes(2);
    expect(setPopupHtml).toHaveBeenCalledTimes(2);
    expect(addEntry).not.toHaveBeenCalledWith('test-campaign', expect.objectContaining({ automationType: expect.stringMatching(/refused|spend/i) }));
  });
});
