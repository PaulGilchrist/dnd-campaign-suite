// MA-1285 regression: REACTION-category advisory one-field fix on the
// byte-identical Uncanny Dodge twins (Performer + Scout Captain —
// name/trigger/description-only rows, zero affordance §60: no attack_bonus/
// dice/save_dc → every MonsterAction chip lane null, no automation.effect →
// GatedReactionSlot null, no registered uncanny_dodge gated-reaction key).
// Binding orchestrator Option A = ONE field per row: advisory:"monster_
// uncanny_dodge" (advisory_message optional — buildMonsterActionAdvisory*
// fallback copy is honest). Mirrors MA-1224 Nalfeshnee Pursuit / MA-1223
// Teleport advisory siblings; ZERO code. Locks disk shape + placement,
// detector truthiness on both rows, AdvisoryLink chip render on the reaction
// row, and the record-only resolver contract: popup + ONE ability_use log per
// press, zero rolls, zero spends; parry/feather_fall te-channel twins
// byte-inert.
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
const PERFORMER = monstersData.find((m) => m.index === 'performer');
const SCOUT_CAPTAIN = monstersData.find((m) => m.index === 'scout-captain');
const PERFORMER_UD = PERFORMER.reactions[0];
const SCOUT_UD = SCOUT_CAPTAIN.reactions[0];
const FEATHER_FALL = monstersData.find((m) => m.index === 'aarakocra-aeromancer').reactions[0];
const PARRY = monstersData.find((m) => m.index === 'bandit-captain').reactions[0];

describe('MA-1285 disk lock: Uncanny Dodge twins carry the advisory one-field fix', () => {
  it('Performer reactions[0] name/trigger/description byte-identical to the RAW row', () => {
    expect(PERFORMER_UD.name).toBe('Uncanny Dodge');
    expect(PERFORMER_UD.trigger).toBe('The performer is hit by an attack roll');
    expect(PERFORMER_UD.description).toBe('The performer halves the damage (round down) it takes from that attack.');
  });

  it('Scout Captain reactions[0] name/trigger/description byte-identical to the RAW row', () => {
    expect(SCOUT_UD.name).toBe('Uncanny Dodge');
    expect(SCOUT_UD.trigger).toBe('The scout is hit by an attack roll');
    expect(SCOUT_UD.description).toBe('The scout halves the damage (round down) it takes from that attack.');
  });

  it('both rows carry EXACTLY advisory:"monster_uncanny_dodge" (Option A one-field)', () => {
    expect(PERFORMER_UD.advisory).toBe('monster_uncanny_dodge');
    expect(SCOUT_UD.advisory).toBe('monster_uncanny_dodge');
    expect(PERFORMER_UD.automation).toBeUndefined();
    expect(SCOUT_UD.automation).toBeUndefined();
    expect(PERFORMER_UD.attack_bonus).toBeUndefined();
    expect(SCOUT_UD.attack_bonus).toBeUndefined();
    expect(PERFORMER_UD.save_dc).toBeUndefined();
    expect(SCOUT_UD.save_dc).toBeUndefined();
    expect(PERFORMER_UD.zone).toBeUndefined();
    expect(SCOUT_UD.zone).toBeUndefined();
  });

  it('placement mirrors siblings: advisory sits after description (MA-1224 byte-shape)', () => {
    const performerShape = '"trigger": "The performer is hit by an attack roll",\n        "description": "The performer halves the damage (round down) it takes from that attack.",\n        "advisory": "monster_uncanny_dodge"';
    const scoutShape = '"trigger": "The scout is hit by an attack roll",\n        "description": "The scout halves the damage (round down) it takes from that attack.",\n        "advisory": "monster_uncanny_dodge"';
    expect(RAW.split(performerShape).length - 1).toBe(1);
    expect(RAW.split(scoutShape).length - 1).toBe(1);
    expect(RAW.split('"advisory": "monster_uncanny_dodge"').length - 1).toBe(2);
  });
});

describe('MA-1285 advisory detection on the reaction twins', () => {
  it('arms on both reactions[0] via the pure truthiness detector', () => {
    expect(isMonsterActionAdvisoryRow(PERFORMER_UD)).toBe(true);
    expect(isMonsterActionAdvisoryRow(SCOUT_UD)).toBe(true);
  });

  it('te-channel reaction twins stay unarmed (byte-inert §37)', () => {
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

describe('MA-1285 MonsterAction render: advisory chip arms on the reaction row', () => {
  it('Performer Uncanny Dodge row renders the labelled advisory chip', () => {
    const { container } = renderRow(PERFORMER_UD);
    const chip = container.querySelector('.mc-dice-link-advisory');
    expect(chip).not.toBe(null);
    expect(chip.textContent).toContain('Uncanny Dodge');
    expect(chip.getAttribute('title')).toMatch(/GM-enforced/);
  });

  it('Scout Captain Uncanny Dodge row renders the labelled advisory chip', () => {
    const { container } = renderRow(SCOUT_UD);
    const chip = container.querySelector('.mc-dice-link-advisory');
    expect(chip).not.toBe(null);
    expect(chip.textContent).toContain('Uncanny Dodge');
  });

  it('chip press routes onAdvisoryRow with the row, never onAttack', () => {
    const { container, onAttack, onAdvisoryRow } = renderRow(PERFORMER_UD);
    fireEvent.click(container.querySelector('.mc-dice-link-advisory'));
    expect(onAdvisoryRow).toHaveBeenCalledTimes(1);
    expect(onAdvisoryRow.mock.calls[0][0]).toBe(PERFORMER_UD);
    expect(onAttack).not.toHaveBeenCalled();
  });

  it('incapacitated advisory chip is inert (no click route)', () => {
    const { container, onAdvisoryRow } = renderRow(SCOUT_UD, { attackerCannotAct: true });
    fireEvent.click(container.querySelector('.mc-dice-link-advisory'));
    expect(onAdvisoryRow).not.toHaveBeenCalled();
  });
});

describe('MA-1285 builders + resolver on the Uncanny Dodge rows — record-only contract', () => {
  it('popup is honest record chrome with the fallback GM-enforced copy (no advisory_message authored)', () => {
    const html = buildMonsterActionAdvisoryPopup({ monsterName: 'Performer 1', action: PERFORMER_UD });
    expect(html).toMatch(/^<div class="mc-prerequisite-refusal"><h3>Action — Uncanny Dodge<\/h3>/);
    expect(html).toMatch(/Uncanny Dodge is GM-enforced \(no engine consumer for this mechanic\)/);
  });

  it('log is an ability_use record naming Uncanny Dodge, no roll fields', () => {
    const log = buildMonsterActionAdvisoryLog({ monsterName: 'Scout Captain 1', action: SCOUT_UD });
    expect(log.type).toBe('ability_use');
    expect(log.characterName).toBe('Scout Captain 1');
    expect(log.abilityName).toBe('Uncanny Dodge');
    expect(log.rollType).toBeUndefined();
    expect(log.roll).toBeUndefined();
  });

  it('one press = popup + exactly ONE ability_use log; no other writes', async () => {
    const addEntry = vi.fn(() => Promise.resolve());
    const setPopupHtml = vi.fn();
    const res = await resolveMonsterActionAdvisoryRow({ action: PERFORMER_UD, monsterName: 'Performer 1', campaignName: 'test-campaign', setPopupHtml, deps: { addEntry } });
    expect(res.resolved).toBe(true);
    expect(setPopupHtml).toHaveBeenCalledTimes(1);
    expect(addEntry).toHaveBeenCalledTimes(1);
    const entry = addEntry.mock.calls[0][1];
    expect(entry.type).toBe('ability_use');
    expect(entry.abilityName).toBe('Uncanny Dodge');
    expect(entry.description).toMatch(/GM-enforced/);
  });

  it('refire press stays record-only (no uses authored, nothing to gate): two logs, zero spends', async () => {
    const addEntry = vi.fn(() => Promise.resolve());
    const setPopupHtml = vi.fn();
    await resolveMonsterActionAdvisoryRow({ action: SCOUT_UD, monsterName: 'Scout Captain 1', campaignName: 'test-campaign', setPopupHtml, deps: { addEntry } });
    await resolveMonsterActionAdvisoryRow({ action: SCOUT_UD, monsterName: 'Scout Captain 1', campaignName: 'test-campaign', setPopupHtml, deps: { addEntry } });
    expect(addEntry).toHaveBeenCalledTimes(2);
    expect(setPopupHtml).toHaveBeenCalledTimes(2);
    expect(addEntry).not.toHaveBeenCalledWith('test-campaign', expect.objectContaining({ automationType: expect.stringMatching(/refused|spend/i) }));
  });
});

// MA-1290: Performer Legend "Warding Charm" reactions[0] — same FAIL(b)
// zero-affordance fingerprint (name/trigger/description/save_type/save_effect
// only, §60) fixed via the SAME Option A one-field advisory seam. Hit-
// negation (Option B) stays out of scope — no consumer semantics for
// negating a committed hit. Mirrors the MA-1285 blocks byte-for-byte.
const LEGEND = monstersData.find((m) => m.index === 'performer-legend');
const LEGEND_WC = LEGEND.reactions[0];

describe('MA-1290 disk lock: Warding Charm carries the advisory one-field fix', () => {
  it('reactions[0] name/trigger/description/save_type/save_effect byte-identical to the RAW row', () => {
    expect(LEGEND_WC.name).toBe('Warding Charm');
    expect(LEGEND_WC.trigger).toBe('A creature hits the performer with an attack roll');
    expect(LEGEND_WC.description).toBe('Wisdom Saving Throw: DC 17, the triggering creature. Failure: The attack roll misses the performer, and the target has the <strong>Charmed</strong> condition until the end of the performer\'s next turn.');
    expect(LEGEND_WC.save_type).toBe('Wisdom');
    expect(LEGEND_WC.save_effect).toBe('Failure: The attack roll misses the performer, and the target has the Charmed condition until the end of the performer\'s next turn.');
  });

  it('row carries EXACTLY advisory:"monster_warding_charm" (Option A one-field, no save_dc)', () => {
    expect(LEGEND_WC.advisory).toBe('monster_warding_charm');
    expect(LEGEND_WC.automation).toBeUndefined();
    expect(LEGEND_WC.attack_bonus).toBeUndefined();
    expect(LEGEND_WC.save_dc).toBeUndefined();
    expect(LEGEND_WC.zone).toBeUndefined();
    expect(LEGEND_WC.usage).toBeUndefined();
  });

  it('placement: advisory sits after save_effect, unique on disk', () => {
    const shape = '"save_effect": "Failure: The attack roll misses the performer, and the target has the Charmed condition until the end of the performer\'s next turn.",\n        "advisory": "monster_warding_charm"';
    expect(RAW.split(shape).length - 1).toBe(1);
    expect(RAW.split('"advisory": "monster_warding_charm"').length - 1).toBe(1);
  });
});

describe('MA-1290 advisory detection + render on the Warding Charm reaction', () => {
  it('arms via the pure truthiness detector', () => {
    expect(isMonsterActionAdvisoryRow(LEGEND_WC)).toBe(true);
  });

  it('row renders the labelled advisory chip', () => {
    const { container } = renderRow(LEGEND_WC);
    const chip = container.querySelector('.mc-dice-link-advisory');
    expect(chip).not.toBe(null);
    expect(chip.textContent).toContain('Warding Charm');
    expect(chip.getAttribute('title')).toMatch(/GM-enforced/);
  });

  it('chip press routes onAdvisoryRow with the row, never onAttack', () => {
    const { container, onAttack, onAdvisoryRow } = renderRow(LEGEND_WC);
    fireEvent.click(container.querySelector('.mc-dice-link-advisory'));
    expect(onAdvisoryRow).toHaveBeenCalledTimes(1);
    expect(onAdvisoryRow.mock.calls[0][0]).toBe(LEGEND_WC);
    expect(onAttack).not.toHaveBeenCalled();
  });

  it('incapacitated advisory chip is inert (no click route)', () => {
    const { container, onAdvisoryRow } = renderRow(LEGEND_WC, { attackerCannotAct: true });
    fireEvent.click(container.querySelector('.mc-dice-link-advisory'));
    expect(onAdvisoryRow).not.toHaveBeenCalled();
  });
});

describe('MA-1290 builders + resolver on Warding Charm — record-only contract', () => {
  it('popup is honest record chrome with the fallback GM-enforced copy', () => {
    const html = buildMonsterActionAdvisoryPopup({ monsterName: 'Performer Legend 1', action: LEGEND_WC });
    expect(html).toMatch(/^<div class="mc-prerequisite-refusal"><h3>Action — Warding Charm<\/h3>/);
    expect(html).toMatch(/Warding Charm is GM-enforced \(no engine consumer for this mechanic\)/);
  });

  it('log is an ability_use record naming Warding Charm, no roll fields', () => {
    const log = buildMonsterActionAdvisoryLog({ monsterName: 'Performer Legend 1', action: LEGEND_WC });
    expect(log.type).toBe('ability_use');
    expect(log.characterName).toBe('Performer Legend 1');
    expect(log.abilityName).toBe('Warding Charm');
    expect(log.rollType).toBeUndefined();
    expect(log.roll).toBeUndefined();
  });

  it('one press = popup + exactly ONE ability_use log; no other writes', async () => {
    const addEntry = vi.fn(() => Promise.resolve());
    const setPopupHtml = vi.fn();
    const res = await resolveMonsterActionAdvisoryRow({ action: LEGEND_WC, monsterName: 'Performer Legend 1', campaignName: 'test-campaign', setPopupHtml, deps: { addEntry } });
    expect(res.resolved).toBe(true);
    expect(setPopupHtml).toHaveBeenCalledTimes(1);
    expect(addEntry).toHaveBeenCalledTimes(1);
    const entry = addEntry.mock.calls[0][1];
    expect(entry.type).toBe('ability_use');
    expect(entry.abilityName).toBe('Warding Charm');
    expect(entry.description).toMatch(/GM-enforced/);
  });

  it('refire press stays record-only: two logs, zero spends', async () => {
    const addEntry = vi.fn(() => Promise.resolve());
    const setPopupHtml = vi.fn();
    await resolveMonsterActionAdvisoryRow({ action: LEGEND_WC, monsterName: 'Performer Legend 1', campaignName: 'test-campaign', setPopupHtml, deps: { addEntry } });
    await resolveMonsterActionAdvisoryRow({ action: LEGEND_WC, monsterName: 'Performer Legend 1', campaignName: 'test-campaign', setPopupHtml, deps: { addEntry } });
    expect(addEntry).toHaveBeenCalledTimes(2);
    expect(setPopupHtml).toHaveBeenCalledTimes(2);
    expect(addEntry).not.toHaveBeenCalledWith('test-campaign', expect.objectContaining({ automationType: expect.stringMatching(/refused|spend/i) }));
  });
});

// MA-1309: Pirate Admiral "Defensive Stance" reactions[0] — same FAIL(b)
// zero-affordance fingerprint (name/trigger/description only, §60) fixed via
// the SAME Option A one-field advisory seam (MA-1285 byte-shape twin).
// Sustained +4 AC hit-negation clock (Option B) stays out of scope —
// orchestrator binding decision. Mirrors the MA-1285/MA-1290 blocks.
const PIRATE_ADMIRAL = monstersData.find((m) => m.index === 'pirate-admiral');
const PIRATE_DS = PIRATE_ADMIRAL.reactions[0];

describe('MA-1309 disk lock: Pirate Admiral Defensive Stance carries the advisory one-field fix', () => {
  it('reactions[0] name/trigger/description byte-identical to the RAW row', () => {
    expect(PIRATE_DS.name).toBe('Defensive Stance');
    expect(PIRATE_DS.trigger).toBe('The pirate is hit by a melee attack roll while holding a weapon');
    expect(PIRATE_DS.description).toBe('The pirate adds 4 to its AC against melee attack rolls (including the triggering attack) until the start of its next turn, possibly causing the attacks to miss.');
  });

  it('row carries EXACTLY advisory:"monster_defensive_stance" (Option A one-field)', () => {
    expect(PIRATE_DS.advisory).toBe('monster_defensive_stance');
    expect(PIRATE_DS.automation).toBeUndefined();
    expect(PIRATE_DS.attack_bonus).toBeUndefined();
    expect(PIRATE_DS.save_dc).toBeUndefined();
    expect(PIRATE_DS.zone).toBeUndefined();
    expect(PIRATE_DS.usage).toBeUndefined();
  });

  it('placement mirrors MA-1285 siblings: advisory sits after description, unique on disk', () => {
    const shape = '"trigger": "The pirate is hit by a melee attack roll while holding a weapon",\n        "description": "The pirate adds 4 to its AC against melee attack rolls (including the triggering attack) until the start of its next turn, possibly causing the attacks to miss.",\n        "advisory": "monster_defensive_stance"';
    expect(RAW.split(shape).length - 1).toBe(1);
    expect(RAW.split('"advisory": "monster_defensive_stance"').length - 1).toBe(1);
  });
});

describe('MA-1309 advisory detection + render on the Defensive Stance reaction', () => {
  it('arms via the pure truthiness detector', () => {
    expect(isMonsterActionAdvisoryRow(PIRATE_DS)).toBe(true);
  });

  it('row renders the labelled advisory chip', () => {
    const { container } = renderRow(PIRATE_DS);
    const chip = container.querySelector('.mc-dice-link-advisory');
    expect(chip).not.toBe(null);
    expect(chip.textContent).toContain('Defensive Stance');
    expect(chip.getAttribute('title')).toMatch(/GM-enforced/);
  });

  it('chip press routes onAdvisoryRow with the row, never onAttack', () => {
    const { container, onAttack, onAdvisoryRow } = renderRow(PIRATE_DS);
    fireEvent.click(container.querySelector('.mc-dice-link-advisory'));
    expect(onAdvisoryRow).toHaveBeenCalledTimes(1);
    expect(onAdvisoryRow.mock.calls[0][0]).toBe(PIRATE_DS);
    expect(onAttack).not.toHaveBeenCalled();
  });

  it('incapacitated advisory chip is inert (no click route)', () => {
    const { container, onAdvisoryRow } = renderRow(PIRATE_DS, { attackerCannotAct: true });
    fireEvent.click(container.querySelector('.mc-dice-link-advisory'));
    expect(onAdvisoryRow).not.toHaveBeenCalled();
  });
});

describe('MA-1309 builders + resolver on Defensive Stance — record-only contract', () => {
  it('popup is honest record chrome with the fallback GM-enforced copy', () => {
    const html = buildMonsterActionAdvisoryPopup({ monsterName: 'Pirate Admiral 1', action: PIRATE_DS });
    expect(html).toMatch(/^<div class="mc-prerequisite-refusal"><h3>Action — Defensive Stance<\/h3>/);
    expect(html).toMatch(/Defensive Stance is GM-enforced \(no engine consumer for this mechanic\)/);
  });

  it('log is an ability_use record naming Defensive Stance, no roll fields', () => {
    const log = buildMonsterActionAdvisoryLog({ monsterName: 'Pirate Admiral 1', action: PIRATE_DS });
    expect(log.type).toBe('ability_use');
    expect(log.characterName).toBe('Pirate Admiral 1');
    expect(log.abilityName).toBe('Defensive Stance');
    expect(log.rollType).toBeUndefined();
    expect(log.roll).toBeUndefined();
  });

  it('one press = popup + exactly ONE ability_use log; no other writes', async () => {
    const addEntry = vi.fn(() => Promise.resolve());
    const setPopupHtml = vi.fn();
    const res = await resolveMonsterActionAdvisoryRow({ action: PIRATE_DS, monsterName: 'Pirate Admiral 1', campaignName: 'test-campaign', setPopupHtml, deps: { addEntry } });
    expect(res.resolved).toBe(true);
    expect(setPopupHtml).toHaveBeenCalledTimes(1);
    expect(addEntry).toHaveBeenCalledTimes(1);
    const entry = addEntry.mock.calls[0][1];
    expect(entry.type).toBe('ability_use');
    expect(entry.abilityName).toBe('Defensive Stance');
    expect(entry.description).toMatch(/GM-enforced/);
  });

  it('refire press stays record-only: two logs, zero spends', async () => {
    const addEntry = vi.fn(() => Promise.resolve());
    const setPopupHtml = vi.fn();
    await resolveMonsterActionAdvisoryRow({ action: PIRATE_DS, monsterName: 'Pirate Admiral 1', campaignName: 'test-campaign', setPopupHtml, deps: { addEntry } });
    await resolveMonsterActionAdvisoryRow({ action: PIRATE_DS, monsterName: 'Pirate Admiral 1', campaignName: 'test-campaign', setPopupHtml, deps: { addEntry } });
    expect(addEntry).toHaveBeenCalledTimes(2);
    expect(setPopupHtml).toHaveBeenCalledTimes(2);
    expect(addEntry).not.toHaveBeenCalledWith('test-campaign', expect.objectContaining({ automationType: expect.stringMatching(/refused|spend/i) }));
  });
});

// MA-1313: Pirate Captain "Riposte" reactions[0] — same FAIL(b)
// zero-affordance fingerprint (name/trigger/description only, §60) fixed via
// the SAME Option A one-field advisory seam (MA-1285/MA-1309 byte-shape twin).
// Two-stage +3 AC hit-negation → conditional Rapier counter (Option B) stays
// out of scope — orchestrator binding decision. Mirrors the sibling blocks.
const PIRATE_CAPTAIN = monstersData.find((m) => m.index === 'pirate-captain');
const PIRATE_RIPOSTE = PIRATE_CAPTAIN.reactions[0];

describe('MA-1313 disk lock: Pirate Captain Riposte carries the advisory one-field fix', () => {
  it('reactions[0] name/trigger/description byte-identical to the RAW row', () => {
    expect(PIRATE_RIPOSTE.name).toBe('Riposte');
    expect(PIRATE_RIPOSTE.trigger).toBe('The pirate is hit by a melee attack roll while holding a weapon');
    expect(PIRATE_RIPOSTE.description).toBe('The pirate adds 3 to its AC against that attack, possibly causing it to miss. On a miss, the pirate makes one Rapier attack against the triggering creature if within range.');
  });

  it('row carries EXACTLY advisory:"monster_riposte" (Option A one-field)', () => {
    expect(PIRATE_RIPOSTE.advisory).toBe('monster_riposte');
    expect(PIRATE_RIPOSTE.automation).toBeUndefined();
    expect(PIRATE_RIPOSTE.attack_bonus).toBeUndefined();
    expect(PIRATE_RIPOSTE.save_dc).toBeUndefined();
    expect(PIRATE_RIPOSTE.zone).toBeUndefined();
    expect(PIRATE_RIPOSTE.usage).toBeUndefined();
  });

  it('placement mirrors MA-1285 siblings: advisory sits after description, unique on disk', () => {
    const shape = '"trigger": "The pirate is hit by a melee attack roll while holding a weapon",\n        "description": "The pirate adds 3 to its AC against that attack, possibly causing it to miss. On a miss, the pirate makes one Rapier attack against the triggering creature if within range.",\n        "advisory": "monster_riposte"';
    expect(RAW.split(shape).length - 1).toBe(1);
    expect(RAW.split('"advisory": "monster_riposte"').length - 1).toBe(1);
  });
});

describe('MA-1313 advisory detection + render on the Riposte reaction', () => {
  it('arms via the pure truthiness detector', () => {
    expect(isMonsterActionAdvisoryRow(PIRATE_RIPOSTE)).toBe(true);
  });

  it('row renders the labelled advisory chip', () => {
    const { container } = renderRow(PIRATE_RIPOSTE);
    const chip = container.querySelector('.mc-dice-link-advisory');
    expect(chip).not.toBe(null);
    expect(chip.textContent).toContain('Riposte');
    expect(chip.getAttribute('title')).toMatch(/GM-enforced/);
  });

  it('chip press routes onAdvisoryRow with the row, never onAttack', () => {
    const { container, onAttack, onAdvisoryRow } = renderRow(PIRATE_RIPOSTE);
    fireEvent.click(container.querySelector('.mc-dice-link-advisory'));
    expect(onAdvisoryRow).toHaveBeenCalledTimes(1);
    expect(onAdvisoryRow.mock.calls[0][0]).toBe(PIRATE_RIPOSTE);
    expect(onAttack).not.toHaveBeenCalled();
  });

  it('incapacitated advisory chip is inert (no click route)', () => {
    const { container, onAdvisoryRow } = renderRow(PIRATE_RIPOSTE, { attackerCannotAct: true });
    fireEvent.click(container.querySelector('.mc-dice-link-advisory'));
    expect(onAdvisoryRow).not.toHaveBeenCalled();
  });
});

describe('MA-1313 builders + resolver on Riposte — record-only contract', () => {
  it('popup is honest record chrome with the fallback GM-enforced copy', () => {
    const html = buildMonsterActionAdvisoryPopup({ monsterName: 'Pirate Captain 1', action: PIRATE_RIPOSTE });
    expect(html).toMatch(/^<div class="mc-prerequisite-refusal"><h3>Action — Riposte<\/h3>/);
    expect(html).toMatch(/Riposte is GM-enforced \(no engine consumer for this mechanic\)/);
  });

  it('log is an ability_use record naming Riposte, no roll fields', () => {
    const log = buildMonsterActionAdvisoryLog({ monsterName: 'Pirate Captain 1', action: PIRATE_RIPOSTE });
    expect(log.type).toBe('ability_use');
    expect(log.characterName).toBe('Pirate Captain 1');
    expect(log.abilityName).toBe('Riposte');
    expect(log.rollType).toBeUndefined();
    expect(log.roll).toBeUndefined();
  });

  it('one press = popup + exactly ONE ability_use log; no other writes', async () => {
    const addEntry = vi.fn(() => Promise.resolve());
    const setPopupHtml = vi.fn();
    const res = await resolveMonsterActionAdvisoryRow({ action: PIRATE_RIPOSTE, monsterName: 'Pirate Captain 1', campaignName: 'test-campaign', setPopupHtml, deps: { addEntry } });
    expect(res.resolved).toBe(true);
    expect(setPopupHtml).toHaveBeenCalledTimes(1);
    expect(addEntry).toHaveBeenCalledTimes(1);
    const entry = addEntry.mock.calls[0][1];
    expect(entry.type).toBe('ability_use');
    expect(entry.abilityName).toBe('Riposte');
    expect(entry.description).toMatch(/GM-enforced/);
  });

  it('refire press stays record-only: two logs, zero spends', async () => {
    const addEntry = vi.fn(() => Promise.resolve());
    const setPopupHtml = vi.fn();
    await resolveMonsterActionAdvisoryRow({ action: PIRATE_RIPOSTE, monsterName: 'Pirate Captain 1', campaignName: 'test-campaign', setPopupHtml, deps: { addEntry } });
    await resolveMonsterActionAdvisoryRow({ action: PIRATE_RIPOSTE, monsterName: 'Pirate Captain 1', campaignName: 'test-campaign', setPopupHtml, deps: { addEntry } });
    expect(addEntry).toHaveBeenCalledTimes(2);
    expect(setPopupHtml).toHaveBeenCalledTimes(2);
    expect(addEntry).not.toHaveBeenCalledWith('test-campaign', expect.objectContaining({ automationType: expect.stringMatching(/refused|spend/i) }));
  });
});
