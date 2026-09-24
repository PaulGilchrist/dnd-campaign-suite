// MA-1058: Kraken Toxic Ink emanation picker (CON DC 23, 15-ft Emanation,
// DAMAGELESS). Pre-fix the row had NO numeric save_dc and NO range → the save
// chip never armed and the gated "Expend Legendary" chip spent the use then hit
// resolveLegendaryRowMechanic's else-branch console.error (§423 silent-burn).
// Post-fix save_dc:23 + range:"15-foot Emanation" route the gated click to
// handleSaveRoll → breathAoeShape (MA-0590 range-field seam) opens THIS picker.
// resolveSaveFailGrant must grant Blinded+Poisoned on FAILED saves ONLY (the
// save_effect "Failure or Success:" clause attaches to the REUSE LIMIT, not the
// conditions — parseBothOutcomesClause reads that tail and finds no canonical
// condition / no "can't take Reactions" → null → SUCCESS grants NOTHING, §157).
// Zero damage dice on the row → applyDamageToTarget never fires with >0.
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import SaveAttackAoeModal from './SaveAttackAoeModal.jsx';
import monstersData from '../../../../../public/data/monsters.json';

vi.mock('../../../../services/dice/diceRoller.js', async (importActual) => ({
  ...(await importActual()),
  rollExpression: vi.fn((f) => (f ? { total: 10, rolls: [], modifier: 0 } : null)),
  rollExpressionMaximized: vi.fn((f) => (f ? { total: 10, rolls: [], modifier: 0 } : null)),
}));
vi.mock('../../../../services/combat/automation/automationExpressions.js', () => ({ resolveScaling: vi.fn(() => null) }));

const runtime = vi.hoisted(() => {
  const store = {};
  return {
    store,
    getRuntimeValue: vi.fn((k, p) => store[`${k}.${p}`] ?? null),
    setRuntimeValue: vi.fn((k, p, v) => { store[`${k}.${p}`] = v; }),
  };
});
vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: runtime.getRuntimeValue,
  setRuntimeValue: runtime.setRuntimeValue,
}));

vi.mock('../../../../services/combat/conditions/savePromptService.js', () => ({
  sendSavePrompt: vi.fn(),
}));
vi.mock('../../../../services/rules/combat/applyDamage.js', () => ({
  applyDamageToTarget: vi.fn(),
  computeDamageAfterSave: vi.fn((raw, success, dcSuccess) => (success && dcSuccess === 'half' ? Math.floor(raw / 2) : raw)),
  computeDamageAfterEvasion: vi.fn((raw, success, dcSuccess) => (success && dcSuccess === 'half' ? Math.floor(raw / 2) : raw)),
  computeDamageAfterResistancesWithDetails: vi.fn(({ rawDamage }) => ({ finalDamage: rawDamage })),
  hasEvasionForSave: vi.fn(() => false),
  normalizeSaveType: vi.fn((t) => t),
}));
vi.mock('../../../../services/ui/logService.js', () => ({ addEntry: vi.fn(() => Promise.resolve()) }));

const summaryCfg = vi.hoisted(() => ({ b1Con: -19, b2Con: 19 }));
vi.mock('../../../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => ({
    creatures: [
      { name: 'Kraken 1', type: 'npc', currentHp: 472, maxHp: 472, saveBonuses: {}, resistances: [], immunities: [] },
      { name: 'Bandit 1', type: 'npc', currentHp: 819, maxHp: 999, saveBonuses: { constitution: summaryCfg.b1Con }, resistances: [], immunities: [] },
      { name: 'Bandit 2', type: 'npc', currentHp: 819, maxHp: 999, saveBonuses: { constitution: summaryCfg.b2Con }, resistances: [], immunities: [] },
    ],
  })),
  setCombatSummaryCache: vi.fn(),
}));
vi.mock('../../../../hooks/useAllySelection.js', () => ({ getAllyList: vi.fn(() => null) }));
vi.mock('../../../../services/automation/common/damageRollback.js', () => ({ storeSpellLastAttack: vi.fn(), addTargetResult: vi.fn() }));
vi.mock('../../../../services/rules/combat/rangeCheck.js', () => ({
  isWithinRange: vi.fn(async () => true),
  isDistanceInRange: vi.fn(() => true),
}));
vi.mock('../../../../services/rules/features/sleepService.js', () => ({ stageSleepTargets: vi.fn() }));

const expirations = vi.hoisted(() => ({ current: [] }));
vi.mock('../../../../services/rules/effects/expirationQueue.js', () => ({
  addExpiration: vi.fn((arg) => { expirations.current.push(arg); }),
}));

const seenTargets = vi.hoisted(() => ({ current: [] }));
vi.mock('./CreatureSelectionModal.jsx', () => ({
  default: ({ title, description, note, targets, onConfirm, onSkip }) => {
    seenTargets.current = targets;
    return (
      <div className="sp-overlay">
        <div className="sp-header">{title}</div>
        <div className="sp-desc">{description}</div>
        <div className="sp-note-copy">{note}</div>
        {targets.map(t => (<label key={t.name} className="secondary-target-row"><input type="checkbox" />{t.name}</label>))}
        <button className="sp-roll-btn" onClick={() => onConfirm(seenTargets.current.map(t => t.name))} type="button">Confirm</button>
        <button className="sp-dismiss-btn" onClick={onSkip} type="button">Skip</button>
      </div>
    );
  },
}));

import { applyDamageToTarget } from '../../../../services/rules/combat/applyDamage.js';
import { addEntry } from '../../../../services/ui/logService.js';
import { parseBothOutcomesClause, extractConditionsFromSaveEffect } from '../../../encounter/MonsterCardHelpers.js';

const TOXIC_INK = monstersData.find(m => m.index === 'kraken').legendary_actions.find(a => a.name === 'Toxic Ink');

let randomSpy;
function spyRandom(seq) {
  let i = 0;
  randomSpy = vi.spyOn(Math, 'random').mockImplementation(() => seq[Math.min(i++, seq.length - 1)]);
}
afterEach(() => randomSpy?.mockRestore());

function renderToxicInk({ bothOutcomesClause = parseBothOutcomesClause(TOXIC_INK.save_effect), saveConditions = extractConditionsFromSaveEffect(TOXIC_INK.save_effect) } = {}) {
  return render(
    <SaveAttackAoeModal
      action={TOXIC_INK}
      playerStats={{ name: 'Kraken 1' }}
      campaignName="test-campaign"
      range={15}
      damage={null}
      damageType={null}
      saveType="Constitution"
      saveDc={23}
      dcSuccess="half"
      titleOverride="15-ft Radius (GM positions tokens; selection advisory)"
      excludeNames={['Kraken 1']}
      rangeGateFt={15}
      saveConditions={saveConditions}
      bothOutcomesClause={bothOutcomesClause}
      conditionDurationNote="until the end of the kraken's next turn"
      storeLastAttack={false}
      onClose={vi.fn()}
    />
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  seenTargets.current = [];
  expirations.current = [];
  summaryCfg.b1Con = -19;
  summaryCfg.b2Con = 19;
});

describe('MA-1058 Kraken Toxic Ink emanation picker', () => {
  it('save_dc:23 + 15-ft emanation range parsed; damageless row has zero damage dice', () => {
    expect(TOXIC_INK.save_dc).toBe(23);
    expect(TOXIC_INK.range).toBe('15-foot Emanation');
    expect(TOXIC_INK.save_type).toBe('Constitution');
    expect(TOXIC_INK.damage_dice_primary).toBeUndefined();
    expect(extractConditionsFromSaveEffect(TOXIC_INK.save_effect)).toEqual(['blinded', 'poisoned']);
    // §157: reuse-limit tail names no condition / no Reactions → success-leg inert.
    expect(parseBothOutcomesClause(TOXIC_INK.save_effect)).toBeNull();
  });

  it('FAIL (con -19) grants Blinded+Poisoned w/ source+dc meta + named condition log; ZERO damage applied', async () => {
    spyRandom([0.01, 0.01]);
    const { getByText } = renderToxicInk();
    await waitFor(() => expect(seenTargets.current.length).toBe(2));
    fireEvent.click(getByText('Confirm'));
    await waitFor(() => expect(addEntry).toHaveBeenCalled());

    expect(runtime.store['Bandit 1.activeConditions']).toEqual(['blinded', 'poisoned']);
    expect(runtime.store['Bandit 1.activeConditionMeta'].blinded).toMatchObject({ dc: 23, ability: 'con', source: 'Kraken 1' });
    expect(runtime.store['Bandit 1.activeConditionMeta'].poisoned).toMatchObject({ dc: 23, ability: 'con', source: 'Kraken 1' });

    const logs = addEntry.mock.calls.map(c => c[1]);
    const condRow = logs.find(l => l.type === 'condition' && l.characterName === 'Bandit 1' && /failed the Constitution save \(DC 23\)/.test(l.description));
    expect(condRow).toBeTruthy();
    expect(condRow.condition).toContain('Blinded');
    expect(condRow.condition).toContain('Poisoned');

    // damageless: applyDamageToTarget never pays any damage
    expect(applyDamageToTarget).not.toHaveBeenCalled();
    expect(logs.filter(e => e.rollType === 'save-damage' && (e.finalDamage ?? 0) > 0)).toHaveLength(0);
  });

  it('SUCCESS (con +19, nat 20) grants NOTHING — §157 reuse-limit marker stays inert, fail-only conditions', async () => {
    summaryCfg.b1Con = 19;
    summaryCfg.b2Con = 19;
    spyRandom([0.99, 0.99]);
    const { getByText } = renderToxicInk();
    await waitFor(() => expect(seenTargets.current.length).toBe(2));
    fireEvent.click(getByText('Confirm'));
    await waitFor(() => expect(addEntry).toHaveBeenCalled());

    expect(runtime.store['Bandit 1.activeConditions'] ?? null).toBeNull();
    expect(runtime.store['Bandit 1.activeConditionMeta'] ?? null).toBeNull();
    expect(runtime.store['Bandit 2.activeConditions'] ?? null).toBeNull();
    // no success-leg condition log, no expiry clock for a condition-only fail-only row
    const logs = addEntry.mock.calls.map(c => c[1]);
    expect(logs.filter(l => l.type === 'condition' && /succeeded the Constitution save \(DC 23\)/.test(String(l.description)))).toHaveLength(0);
    expect(expirations.current).toHaveLength(0);
    expect(applyDamageToTarget).not.toHaveBeenCalled();
  });

  it('guardrail: explicit bothOutcomesClause null + successful save grants zero conditions', async () => {
    summaryCfg.b1Con = 19;
    summaryCfg.b2Con = 19;
    spyRandom([0.99, 0.99]);
    const { getByText } = renderToxicInk({ bothOutcomesClause: null, saveConditions: extractConditionsFromSaveEffect(TOXIC_INK.save_effect) });
    await waitFor(() => expect(seenTargets.current.length).toBe(2));
    fireEvent.click(getByText('Confirm'));
    await waitFor(() => expect(addEntry).toHaveBeenCalled());
    expect(runtime.store['Bandit 1.activeConditions'] ?? null).toBeNull();
    expect(runtime.store['Bandit 2.activeConditions'] ?? null).toBeNull();
    expect(expirations.current).toHaveLength(0);
  });
});
