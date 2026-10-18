// MA-0087: Adult Copper Spellcasting — Mind Spike (level 4 version) is a
// save-leg spell (2024 WIS save, no attack_type). Clicking its per-spell link
// must route a spell-attributed WIS DC 17 save with the AUTHORED upcast level
// damage (5d8 Psychic, not the base lv2 3d8 — the MA-0112 save-leg residual),
// half-on-success. Byte-inert for clauseless/base rows.
// Single click→ctx identity test: the truthy-link guard inside carries the
// MA-0091 per-spell-render seam (link rendering itself is owned by
// MonsterCardModal.spellcasting.test.jsx); the diceRoller mock is purged —
// rollExpression/rollExpressionDoubled fire only on crit attack handlers,
// never on this save lane (rollSavingThrow is mocked wholesale).
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps, defaultConditionEffects } from './MonsterCardModal.test-utils.js';
import monstersData from '../../../public/data/monsters.json';
import spells2024 from '../../../public/data/2024/spells.json';

vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: vi.fn((html) => String(html || '')) }));
vi.mock('../../services/ui/logService.js', () => ({ addEntry: vi.fn(() => Promise.resolve()) }));
vi.mock('../../services/ui/dataLoader.js', () => ({
  loadSpells: vi.fn((version) => Promise.resolve(version === '2024' ? spells2024 : [])),
}));

vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => {
  let _popupHtml = null;
  const _rollSavingThrow = vi.fn();
  const mockHook = vi.fn(() => ({
    get popupHtml() { return _popupHtml; },
    setPopupHtml: vi.fn((val) => { _popupHtml = val; }),
    rollAttack: vi.fn(),
    rollDamage: vi.fn(),
    rollAbilityCheck: vi.fn(),
    rollSavingThrow: _rollSavingThrow,
    rollSkillCheck: vi.fn(),
    rollInitiative: vi.fn(),
    quickRollPlayerSave: vi.fn(),
  }));
  return { default: mockHook, _rollSavingThrow };
});

vi.mock('../../services/combat/conditions/conditionEffects.js', () => ({
  computeConditionEffects: vi.fn(() => ({ ...defaultConditionEffects })),
  combineAttackModes: vi.fn(() => 'normal'),
  CONDITIONS_THAT_CANNOT_ACT: new Set(['incapacitated', 'paralyzed', 'petrified', 'stunned', 'unconscious']),
}));
vi.mock('../../services/rules/combat/damageUtils.js', async (importActual) => ({
  ...(await importActual()),
  extractDamageTypes: vi.fn(() => []),
  getTargetFromAttacker: vi.fn(() => null),
  getResistanceNotice: vi.fn(() => null),
  getCombatContext: vi.fn().mockResolvedValue(null),
}));
vi.mock('../../services/rules/combat/rangeValidation.js', () => ({
  computeRangeEffect: vi.fn(() => ({ mode: 'normal', reason: '' })),
  getDistanceFeet: vi.fn(() => null),
  getNearestPlacedItem: vi.fn(() => null),
  rangeToFeet: vi.fn((r) => (typeof r === 'number' ? r : 30)),
}));
vi.mock('../../services/maps/mapsService.js', () => ({ loadMapData: vi.fn().mockResolvedValue(null) }));
vi.mock('../../services/shared/abilityLookup.js', () => ({ getAbilitySaveModifier: vi.fn(() => 0) }));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(() => Promise.resolve()),
  useRuntimeValue: vi.fn(() => null),
}));

import * as useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';
const rollSavingThrow = useLoggedDiceRoll._rollSavingThrow;

// Disk-row BY-name lock: the authored Adult Copper Spellcasting row carries
// the "(level 4 version)" clause on Mind Spike — the exact bytes this seam
// must honor on the save leg (5d8, not the base lv2 3d8).
const SPELLCASTING = monstersData.find(m => m.index === 'adult-copper-dragon').actions.find(a => a.name === 'Spellcasting');

describe('MA-0087 Adult Copper Spellcasting Mind Spike cast level', () => {
  it('clicking the Mind Spike link routes a WIS DC 17 save-leg with lv4 5d8 Psychic (not base 3d8), half-on-success', async () => {
    const m = makeMonster({ name: 'Adult Copper Dragon', actions: [SPELLCASTING] });
    const creatures = [
      { name: 'Adult Copper Dragon 1', type: 'npc', monsterType: 'dragon', targetName: 'TestPC', currentHp: 184, maxHp: 184, conditions: [] },
      { name: 'TestPC', type: 'player', currentHp: 30, maxHp: 30, conditions: [], computedStats: {} },
    ];
    render(<MonsterCardModal {...makeProps(m, { creatureName: 'Adult Copper Dragon 1', creatures })} />);
    const spike = Array.from(document.querySelectorAll('.mc-dice-link-spell')).find(el => el.textContent.trim().startsWith('Mind Spike'));
    expect(spike).toBeTruthy();
    fireEvent.click(spike);
    await waitFor(() => expect(rollSavingThrow).toHaveBeenCalled());
    const context = rollSavingThrow.mock.calls[0][2];
    expect(context.spellName).toBe('Mind Spike');
    expect(context.saveType).toBe('WIS');
    expect(context.saveDc).toBe(17);
    expect(context.dcSuccess).toBe('half');
    expect(context.autoDamageFormula).toBe('5d8');
    expect(context.autoDamageDamageType).toBe('Psychic');
    expect(context.isSpellDamage).toBe(true);
  });
});

// @maintained-by-ai
