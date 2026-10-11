// MA-1851 regression: REACTION-category advisory one-field fix on the Archlich
// "Spell Absorption" row (name/trigger/description-only, zero affordance §60:
// no attack_bonus/dice/save_dc → every MonsterAction chip lane null; no
// automation.effect → GatedReactionSlot null; grep-zero spell_absorption
// consumer app-wide; no targeted_by_concentration trigger producer — §270
// concentration lives caster-side only, §406 no generic spell-target reaction
// queue). Binding orchestrator steer: Option A advisory floor — flat
// advisory:"spell_absorption" + advisory_message carrying the DC 20
// Intelligence (Arcana) check and the +10 HP regain faithfully in prose.
// NO bare numeric save_dc authored (§128: would arm a misleading generic INT
// SAVING-THROW chip — this RAW is an ability CHECK + spell-negation + heal).
// Mirrors MA-1285 Uncanny Dodge / MA-1290 Warding Charm / MA-1309 Defensive
// Stance reaction advisory twins. Locks disk shape + placement, detector
// truthiness, AdvisoryLink chip render with zero save-shell chip, chip press
// routing, and the record-only resolver contract: popup + ONE ability_use log
// per press with the RAW numerics, zero rolls, zero spends.
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
const ARCHLICH = monstersData.find((m) => m.index === 'archlich');
const SA = ARCHLICH.reactions[0];

describe('MA-1851 disk lock: Archlich Spell Absorption carries the advisory fix', () => {
  it('reactions[0] name/trigger/description byte-identical to the RAW row', () => {
    expect(SA.name).toBe('Spell Absorption');
    expect(SA.trigger).toBe('When the archlich is targeted by a spell requiring concentration.');
    expect(SA.description).toBe('The archlich can use its Reaction to attempt to absorb the spell. If it succeeds on a DC 20 Intelligence (Arcana) check, the spell fails and the archlich regains 10 Hit Points.');
  });

  it('row carries advisory:"spell_absorption" + advisory_message, NO save_dc/automation (§128 misrepresenting save chip prohibited)', () => {
    expect(SA.advisory).toBe('spell_absorption');
    expect(SA.advisory_message).toContain('DC 20 Intelligence (Arcana) check');
    expect(SA.advisory_message).toContain('concentration spell fails');
    expect(SA.advisory_message).toContain('10 Hit Points');
    expect(SA.automation).toBeUndefined();
    expect(SA.attack_bonus).toBeUndefined();
    expect(SA.save_dc).toBeUndefined();
    expect(SA.save_type).toBeUndefined();
    expect(SA.zone).toBeUndefined();
    expect(SA.usage).toBeUndefined();
    expect(Object.keys(SA).sort()).toEqual(['advisory', 'advisory_message', 'description', 'name', 'trigger']);
  });

  it('placement mirrors MA-1285 siblings: advisory sits after description, unique on disk', () => {
    const shape = '"trigger": "When the archlich is targeted by a spell requiring concentration.",\n        "description": "The archlich can use its Reaction to attempt to absorb the spell. If it succeeds on a DC 20 Intelligence (Arcana) check, the spell fails and the archlich regains 10 Hit Points.",\n        "advisory": "spell_absorption"';
    expect(RAW.split(shape).length - 1).toBe(1);
    expect(RAW.split('"advisory": "spell_absorption"').length - 1).toBe(1);
  });
});

describe('MA-1851 advisory detection on the Spell Absorption reaction', () => {
  it('arms via the pure truthiness detector', () => {
    expect(isMonsterActionAdvisoryRow(SA)).toBe(true);
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

describe('MA-1851 MonsterAction render: advisory chip arms on the reaction row', () => {
  it('Spell Absorption row renders the labelled advisory chip', () => {
    const { container } = renderRow(SA);
    const chip = container.querySelector('.mc-dice-link-advisory');
    expect(chip).not.toBe(null);
    expect(chip.textContent).toContain('Spell Absorption');
    expect(chip.getAttribute('title')).toContain('DC 20 Intelligence (Arcana) check');
  });

  it('NO generic save-shell chip renders (no save_dc authored — §128 ability check ≠ saving throw)', () => {
    const { container } = renderRow(SA);
    expect(container.querySelector('.mc-dice-link-save-clickable')).toBe(null);
  });

  it('chip press routes onAdvisoryRow with the row, never onAttack', () => {
    const { container, onAttack, onAdvisoryRow } = renderRow(SA);
    fireEvent.click(container.querySelector('.mc-dice-link-advisory'));
    expect(onAdvisoryRow).toHaveBeenCalledTimes(1);
    expect(onAdvisoryRow.mock.calls[0][0]).toBe(SA);
    expect(onAttack).not.toHaveBeenCalled();
  });

  it('incapacitated advisory chip is inert (no click route)', () => {
    const { container, onAdvisoryRow } = renderRow(SA, { attackerCannotAct: true });
    fireEvent.click(container.querySelector('.mc-dice-link-advisory'));
    expect(onAdvisoryRow).not.toHaveBeenCalled();
  });
});

describe('MA-1851 builders + resolver on Spell Absorption — record-only contract', () => {
  it('popup carries the RAW numerics faithfully (DC 20 INT/Arcana check, concentration fail, +10 HP)', () => {
    const html = buildMonsterActionAdvisoryPopup({ monsterName: 'Archlich 1', action: SA });
    expect(html).toMatch(/^<div class="mc-prerequisite-refusal"><h3>Action — Spell Absorption<\/h3>/);
    expect(html).toContain('DC 20 Intelligence (Arcana) check');
    expect(html).toContain('concentration spell fails');
    expect(html).toContain('regains 10 Hit Points');
    expect(html).toContain('GM-enforced');
  });

  it('log is an ability_use record naming Spell Absorption, no roll fields', () => {
    const log = buildMonsterActionAdvisoryLog({ monsterName: 'Archlich 1', action: SA });
    expect(log.type).toBe('ability_use');
    expect(log.characterName).toBe('Archlich 1');
    expect(log.abilityName).toBe('Spell Absorption');
    expect(log.description).toContain('DC 20 Intelligence (Arcana) check');
    expect(log.rollType).toBeUndefined();
    expect(log.roll).toBeUndefined();
  });

  it('one press = popup + exactly ONE ability_use log; no other writes', async () => {
    const addEntry = vi.fn(() => Promise.resolve());
    const setPopupHtml = vi.fn();
    const res = await resolveMonsterActionAdvisoryRow({ action: SA, monsterName: 'Archlich 1', campaignName: 'test-campaign', setPopupHtml, deps: { addEntry } });
    expect(res.resolved).toBe(true);
    expect(setPopupHtml).toHaveBeenCalledTimes(1);
    expect(addEntry).toHaveBeenCalledTimes(1);
    const entry = addEntry.mock.calls[0][1];
    expect(entry.type).toBe('ability_use');
    expect(entry.abilityName).toBe('Spell Absorption');
    expect(entry.description).toMatch(/GM-enforced/);
  });

  it('refire press stays record-only: two logs, zero spends', async () => {
    const addEntry = vi.fn(() => Promise.resolve());
    const setPopupHtml = vi.fn();
    await resolveMonsterActionAdvisoryRow({ action: SA, monsterName: 'Archlich 1', campaignName: 'test-campaign', setPopupHtml, deps: { addEntry } });
    await resolveMonsterActionAdvisoryRow({ action: SA, monsterName: 'Archlich 1', campaignName: 'test-campaign', setPopupHtml, deps: { addEntry } });
    expect(addEntry).toHaveBeenCalledTimes(2);
    expect(setPopupHtml).toHaveBeenCalledTimes(2);
    expect(addEntry).not.toHaveBeenCalledWith('test-campaign', expect.objectContaining({ automationType: expect.stringMatching(/refused|spend/i) }));
  });
});
