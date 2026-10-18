// @maintained-by-ai
// MA-0044 regression: Adult Blue Dracolich Frightful Presence (Multiattack-named
// mechanic). Frightened application landed with MA-0017 (saveProcessing
// .applyDamagelessSaveConditions — verified live PC + NPC paths). Residuals
// fixed here in monsters.json: dc_success "none" (FP deals NO damage — the
// prompt must not claim "Half damage on successful save", MA-0030 token) and
// Bite secondary lightning structured (damage_dice_secondary 1d10, mirroring
// Adult Blue Dragon Rend).
// Lane canon: service arming + turn-end repeat-save + 24h immunity grant on this
// row → frightfulPresenceService.test.js; chip render/label → legendary-uses /
// card-body suites; byte-key mirror claim + its own Wisdom/Charisma objects →
// adult-white-fp #576 / ancient-black-fp #577. This file keeps ONLY the
// BY-name disk locks (FP dc_success none + canonical repeat_save/
// success_immunity objects the mirrors cite :94-105, Bite secondary lightning)
// and the modal click → save-context forwarding of repeatSave/successImmunity.
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';
import { extractConditionsFromSaveEffect } from './MonsterCardHelpers.js';
import monstersData from '../../../public/data/monsters.json';

const ROLLERS = vi.hoisted(() => ({ rollSavingThrow: null }));
vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => {
  let _popupHtml = null;
  const _setPopupHtml = vi.fn((val) => { _popupHtml = val; });
  const rollSavingThrow = vi.fn();
  ROLLERS.rollSavingThrow = rollSavingThrow;
  return { default: vi.fn(() => ({
    get popupHtml() { return _popupHtml; },
    setPopupHtml: _setPopupHtml,
    rollAttack: vi.fn(), rollDamage: vi.fn(), rollAbilityCheck: vi.fn(),
    rollSavingThrow, rollSkillCheck: vi.fn(), rollInitiative: vi.fn(), quickRollPlayerSave: vi.fn(),
  })), _setPopupHtml };
});
const ABD = monstersData.find(m => m.name === 'Adult Blue Dracolich');
const FP = ABD.actions.find(a => a.name === 'Frightful Presence');
const BITE = ABD.actions.find(a => a.name === 'Bite');

const CREATURES = [
  { name: 'Adult Blue Dracolich 1', type: 'npc', targetName: 'TestPC', currentHp: 225, maxHp: 225, ac: 19, conditions: [] },
  { name: 'TestPC', type: 'player', currentHp: 224, maxHp: 224, conditions: [] },
];

function fpSaveChip() {
  return Array.from(document.querySelectorAll('.mc-dice-link')).find(el => el.textContent.includes('DC 18 Wisdom')) || null;
}

describe('MA-0044 monsters.json data: Adult Blue Dracolich FP + Bite structured', () => {
  it('FP row: DC 18 Wisdom + frightened save_effect + dc_success none (no damage — no half-damage boilerplate)', () => {
    expect(FP.save_dc).toBe(18);
    expect(FP.save_type).toBe('Wisdom');
    expect(FP.dc_success).toBe('none');
    expect(FP.damage_dice_primary == null).toBe(true);
    expect(extractConditionsFromSaveEffect(FP.save_effect)).toEqual(['frightened']);
    // Canonical service objects the adult-white #576 + ancient-black #577 rows byte-mirror.
    expect(FP.repeat_save).toEqual({ condition: 'frightened', save_type: 'Wisdom', duration_minutes: 1 });
    expect(FP.success_immunity).toEqual({ effect: 'frightful_presence_immunity', duration: '24_hours', duration_minutes: 1440 });
  });

  it('Bite row: secondary lightning 1d10 structured (mirrors Adult Blue Dragon Rend)', () => {
    expect(BITE.damage_dice_primary).toBe('2d10 + 7');
    expect(BITE.damage_dice_secondary).toBe('1d10');
    expect(BITE.damage_type_secondary).toBe('Lightning');
  });
});

describe('MA-0044 MonsterCardModal FP save roll context', () => {
  it('click opens WIS save at DC 18 with frightened conditions, no damage formula, dcSuccess none, repeatSave + successImmunity forwarded', async () => {
    const m = makeMonster({ ...ABD, name: 'Adult Blue Dracolich' });
    render(<MonsterCardModal {...makeProps(m, { creatureName: 'Adult Blue Dracolich 1', creatures: CREATURES })} />);
    const chip = fpSaveChip();
    expect(chip).toBeTruthy();
    fireEvent.click(chip);
    await waitFor(() => expect(ROLLERS.rollSavingThrow).toHaveBeenCalled());
    const call = ROLLERS.rollSavingThrow.mock.calls[0];
    expect(String(call[0]).toLowerCase()).toBe('wis');
    expect(call[2]).toMatchObject({
      saveDc: 18,
      saveType: 'Wisdom',
      dcSuccess: 'none',
      saveConditions: ['frightened'],
      autoDamageFormula: null,
      attackerName: 'Adult Blue Dracolich 1',
      actionName: 'Frightful Presence',
      repeatSave: { condition: 'frightened', save_type: 'Wisdom', duration_minutes: 1 },
      successImmunity: { effect: 'frightful_presence_immunity', duration: '24_hours', duration_minutes: 1440 },
    });
  });
});
