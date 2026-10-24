// @maintained-by-ai
// MA-1058: Kraken Toxic Ink emanation picker (CON DC 23, 15-ft Emanation,
// DAMAGELESS). Pre-fix the row had NO numeric save_dc and NO range → the save
// chip never armed and the gated "Expend Legendary" chip spent the use then hit
// resolveLegendaryRowMechanic's else-branch console.error (§423 silent-burn).
// Post-fix save_dc:23 + range:"15-ft Emanation" route the gated click to
// handleSaveRoll → breathAoeShape (MA-0590 range-field seam) opens THIS picker.
// resolveSaveFailGrant must grant Blinded+Poisoned on FAILED saves ONLY (the
// save_effect "Failure or Success:" clause attaches to the REUSE LIMIT, not the
// conditions — parseBothOutcomesClause reads that tail and finds no canonical
// condition / no "can't take Reactions" → null → SUCCESS grants NOTHING, §157).
// Zero damage dice on the row → applyDamageToTarget never fires with >0.
// Row-data byte-pins (save_dc:23, range field, clause→null, blinded+poisoned
// extraction) live canon in MonsterCardModal.legendary-uses-kraken.test.jsx;
// explicit-null-clause guardrail canon lives in the demilich-howl sibling —
// this file owns ONLY the live picker adjudication.
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
vi.mock('./CreatureSelectionModal.jsx', async () => {
  const { createStaticPickerModal } = await import('./SaveAttackAoeModal.test-utils.jsx');
  return { default: createStaticPickerModal(seenTargets, { descClass: 'sp-desc', noteClass: 'sp-note-copy' }) };
});

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

function renderToxicInk() {
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
      saveConditions={extractConditionsFromSaveEffect(TOXIC_INK.save_effect)}
      bothOutcomesClause={parseBothOutcomesClause(TOXIC_INK.save_effect)}
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
  it('mixed confirms: FAIL grants Blinded+Poisoned w/ source+dc meta + named log; SUCCESS grants NOTHING (§157 inert reuse-limit tail); damageless pays zero', async () => {
    // Honest arm: the reuse-limit tail parses to null (byte-pinned canon in the
    // legendary-uses-kraken sibling) — this run IS the fail-only + inert-null path.
    expect(parseBothOutcomesClause(TOXIC_INK.save_effect)).toBeNull();

    spyRandom([0.01, 0.99]); // Bandit 1: nat 1 − 19 < 23 FAIL; Bandit 2: nat 20 + 19 ≥ 23 SUCCESS
    const { getByText } = renderToxicInk();
    await waitFor(() => expect(seenTargets.current.length).toBe(2));
    fireEvent.click(getByText('Confirm'));
    await waitFor(() => expect(addEntry).toHaveBeenCalled());

    // FAIL leg: both conditions land with dc/ability/source meta + one named condition log.
    expect(runtime.store['Bandit 1.activeConditions']).toEqual(['blinded', 'poisoned']);
    expect(runtime.store['Bandit 1.activeConditionMeta'].blinded).toMatchObject({ dc: 23, ability: 'con', source: 'Kraken 1' });
    expect(runtime.store['Bandit 1.activeConditionMeta'].poisoned).toMatchObject({ dc: 23, ability: 'con', source: 'Kraken 1' });
    const logs = addEntry.mock.calls.map(c => c[1]);
    const condRow = logs.find(l => l.type === 'condition' && l.characterName === 'Bandit 1' && /failed the Constitution save \(DC 23\)/.test(l.description));
    expect(condRow).toBeTruthy();
    expect(condRow.condition).toContain('Blinded');
    expect(condRow.condition).toContain('Poisoned');

    // SUCCESS leg: §157 — the reuse-limit clause names no condition, so NOTHING grants:
    // no conditions, no meta, no success-leg condition log, no expiry clock.
    expect(runtime.store['Bandit 2.activeConditions'] ?? null).toBeNull();
    expect(runtime.store['Bandit 2.activeConditionMeta'] ?? null).toBeNull();
    expect(logs.filter(l => l.type === 'condition' && l.characterName === 'Bandit 2')).toHaveLength(0);
    expect(expirations.current).toHaveLength(0);

    // damageless row: applyDamageToTarget never pays any damage, to either victim.
    expect(applyDamageToTarget).not.toHaveBeenCalled();
    expect(logs.filter(e => e.rollType === 'save-damage' && (e.finalDamage ?? 0) > 0)).toHaveLength(0);
  });
});
