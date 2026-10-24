// @maintained-by-ai
// MA-0102 lane: Adult Gold Dragon Weakening Breath picker — damageless STR DC 21
// cone. The picker seam owns: weakening-clause copy (never the MA-0090 "null null
// damage" / half-damage boilerplate), the RAW "isn't currently affected by this
// breath" exclusion (source-scoped via weakenedNamesFor), and per-NPC save
// adjudication on confirm — each failed save forwards grantWeakeningBreath with
// the honest roll + full-lowercase-key saveBonus + parsed die ('1d6' adult /
// MA-0212 '1d10' ancient), each successful save grants nothing, ZERO damage
// either way. Service internals (merged auto-success clock, save_result +
// condition logs) are pinned in weakeningBreathService.test.js; clause parsing
// in MonsterCardHelpers.weakening-breath.test.js; the PC prompt/listener seam
// for damageless rows is canon in SaveAttackAoeModal.repulsion-breath.test.js —
// this lane stays NPC-only (family recipe, [0.01,0.01,0.99,0.99] = 2 draws/NPC
// in target order, IEEE-accurate).
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import SaveAttackAoeModal from './SaveAttackAoeModal.jsx';
import monstersData from '../../../../../public/data/monsters.json';

vi.mock('../../../../services/dice/diceRoller.js', async (importActual) => ({
  ...(await importActual()),
  rollExpression: vi.fn((f) => (f ? { total: 10, rolls: [3, 3, 4], modifier: 0 } : null)),
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
// Attacker name is lane-swappable (Adult vs Ancient) so each render's eligible
// set is exactly the two NPCs — draw order stays pinned at 2 draws/NPC. STR
// saveBonuses are FULL lowercase keys ('strength'), as the component reads them:
// Thug 1 1+1=2 fails DC 21 and DC 24; Acolyte 2 20+4=24 succeeds on both
// (exact-at-DC on the ancient cone).
const combat = vi.hoisted(() => ({ attacker: 'Adult Gold Dragon 1' }));
vi.mock('../../../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => ({
    creatures: [
      { name: combat.attacker, type: 'npc', currentHp: 243, maxHp: 243, saveBonuses: {}, resistances: [], immunities: ['Fire'] },
      { name: 'Thug 1', type: 'npc', currentHp: 45, maxHp: 45, saveBonuses: { strength: 1 }, resistances: [], immunities: [] },
      { name: 'Acolyte 2', type: 'npc', currentHp: 33, maxHp: 33, saveBonuses: { strength: 4 }, resistances: [], immunities: [] },
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

const grants = vi.hoisted(() => ({ current: [] }));
vi.mock('../../../../services/rules/features/weakeningBreathService.js', () => ({
  grantWeakeningBreath: vi.fn(async (arg) => { grants.current.push(arg); }),
}));

const seenTargets = vi.hoisted(() => ({ current: [] }));
vi.mock('./CreatureSelectionModal.jsx', async () => {
  const { createStaticPickerModal } = await import('./SaveAttackAoeModal.test-utils.jsx');
  return { default: createStaticPickerModal(seenTargets, { descClass: 'sp-desc', noteClass: 'sp-note-copy' }) };
});

import { applyDamageToTarget } from '../../../../services/rules/combat/applyDamage.js';
import { addEntry } from '../../../../services/ui/logService.js';
import { addTargetResult } from '../../../../services/automation/common/damageRollback.js';
import { parseWeakeningBreathClause } from '../../../encounter/MonsterCardHelpers.js';

const GOLD = monstersData.find(m => m.index === 'adult-gold-dragon');
const WEAKENING = GOLD.actions.find(a => a.name === 'Weakening Breath');

// MA-0212: Ancient Gold clause — same shape, DC 24, 1d10 subtract die.
const ANCIENT_WEAKENING = {
  name: 'Weakening Breath',
  save_dc: 24,
  save_type: 'Strength',
  save_effect: 'Failure: The target has Disadvantage on Strength-based D20 Tests and subtracts 5 (1d10) from its damage rolls. It repeats the save at the end of each of its turns, ending the effect on itself on a success. After 1 minute, it succeeds automatically.',
};

let randomSpy;
// Each NPC save consumes exactly two draws (raw1, raw2 — computeNpcSave);
// 0.01 → raw 1, 0.99 → raw 20. Target order: Thug 1, Acolyte 2.
function spyRandom(seq) {
  let i = 0;
  randomSpy = vi.spyOn(Math, 'random').mockImplementation(() => seq[Math.min(i++, seq.length - 1)]);
}
afterEach(() => randomSpy?.mockRestore());

function renderBreath({ attacker = 'Adult Gold Dragon 1', action = WEAKENING, saveDc = 21 } = {}) {
  combat.attacker = attacker;
  return render(
    <SaveAttackAoeModal
      action={action}
      playerStats={{ name: attacker }}
      campaignName="test-campaign"
      range={60}
      damage={null}
      damageType=""
      saveType="Strength"
      saveDc={saveDc}
      dcSuccess="none"
      titleOverride="60-ft Cone (GM positions tokens; selection advisory)"
      excludeNames={[attacker]}
      rangeGateFt={60}
      saveConditions={[]}
      weakeningBreath={parseWeakeningBreathClause(action.save_effect)}
      storeLastAttack={false}
      onClose={vi.fn()}
    />
  );
}

const saveRows = () => addTargetResult.mock.calls.map(c => c[1]);

beforeEach(() => {
  vi.clearAllMocks();
  Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  seenTargets.current = [];
  grants.current = [];
  combat.attacker = 'Adult Gold Dragon 1';
});

describe('MA-0102 Adult Gold Weakening Breath picker', () => {
  it('damageless picker copy states the weakening clause with the parsed 1d6 die and stays inert until Confirm — no null / half-damage boilerplate', async () => {
    spyRandom([0.5]);
    renderBreath();
    await waitFor(() => expect(seenTargets.current).toHaveLength(2));
    expect(seenTargets.current.map(t => t.name)).toEqual(['Thug 1', 'Acolyte 2']);

    const copy = document.querySelector('.sp-note-copy').textContent;
    expect(copy).toMatch(/Disadvantage on Strength-based D20 Tests and subtracts 1d6 from its damage rolls/);
    expect(copy).toMatch(/auto-succeeds after 1 minute/i);
    expect(document.querySelector('.sp-desc').textContent).toContain('Strength');
    expect(document.querySelector('.sp-desc').textContent).toContain('DC 21');
    expect(document.querySelector('.sp-overlay').textContent).not.toMatch(/null/i);
    expect(document.querySelector('.sp-overlay').textContent).not.toMatch(/half damage/i);

    expect(grants.current).toHaveLength(0);
    expect(runtime.setRuntimeValue).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();
    expect(applyDamageToTarget).not.toHaveBeenCalled();
  });

  it('RAW exclusion: creatures already carrying this dragon\'s weakening_breath te are excluded; same-effect te from another source never excludes', async () => {
    spyRandom([0.5]);
    runtime.store['campaign.targetEffects'] = [
      { target: 'Thug 1', effect: 'weakening_breath', source: 'Adult Gold Dragon 1' },
      { target: 'Acolyte 2', effect: 'weakening_breath', source: 'Ancient Gold Dragon 9' },
    ];
    renderBreath();
    await waitFor(() => expect(seenTargets.current).toHaveLength(1));
    expect(seenTargets.current.map(t => t.name)).toEqual(['Acolyte 2']);
  });

  it('mixed confirm: failed STR save grants weakening_breath via the service with honest roll/bonus and parsed 1d6 die; successful save grants nothing; zero damage', async () => {
    // Two draws per NPC save in target order: Thug 1 rolls 1 (+1 = 2, fails
    // DC 21), Acolyte 2 rolls 20 (+4 = 24, succeeds).
    spyRandom([0.01, 0.01, 0.99, 0.99]);
    const { getByText } = renderBreath();
    await waitFor(() => expect(seenTargets.current).toHaveLength(2));
    fireEvent.click(getByText('Confirm'));

    await waitFor(() => expect(addTargetResult).toHaveBeenCalledTimes(2));
    // FAIL leg — Thug 1: exactly one grant, full-lowercase 'strength' save
    // bonus consulted from the creature row, adult clause forwards 1d6.
    expect(grants.current).toHaveLength(1);
    expect(grants.current[0]).toMatchObject({
      campaignName: 'test-campaign',
      attackerName: 'Adult Gold Dragon 1',
      targetName: 'Thug 1',
      saveType: 'Strength',
      saveDc: 21,
      roll: 1,
      saveBonus: 1,
      die: '1d6',
    });
    // SUCCESS leg — Acolyte 2: resolved as a success row, no grant.
    expect(saveRows()).toEqual([
      expect.objectContaining({ targetName: 'Thug 1', saveResult: 'failure', roll: 1, total: 2, appliedDamage: 0 }),
      expect.objectContaining({ targetName: 'Acolyte 2', saveResult: 'success', roll: 20, total: 24, appliedDamage: 0 }),
    ]);
    expect(applyDamageToTarget).not.toHaveBeenCalled();
  });
});

// MA-0212: the parsed per-monster die must ride both the picker copy and the
// grant call — Ancient Gold clause (1d10) forwards die:'1d10' at DC 24.
describe('MA-0212 weakening breath forwards parsed die', () => {
  it('ancient clause picker copy and grant forward the parsed 1d10 die; success leg exact-at-DC grants nothing', async () => {
    // Thug 1 rolls 1 (+1 = 2, fails DC 24); Acolyte 2 rolls 20 (+4 = 24,
    // exactly DC 24 — succeeds).
    spyRandom([0.01, 0.01, 0.99, 0.99]);
    const { getByText } = renderBreath({ attacker: 'Ancient Gold Dragon 1', action: ANCIENT_WEAKENING, saveDc: 24 });
    await waitFor(() => expect(seenTargets.current).toHaveLength(2));
    expect(document.querySelector('.sp-note-copy').textContent).toMatch(/subtracts 1d10 from its damage rolls/);

    fireEvent.click(getByText('Confirm'));
    await waitFor(() => expect(addTargetResult).toHaveBeenCalledTimes(2));
    expect(grants.current).toHaveLength(1);
    expect(grants.current[0]).toMatchObject({
      attackerName: 'Ancient Gold Dragon 1',
      targetName: 'Thug 1',
      saveDc: 24,
      roll: 1,
      saveBonus: 1,
      die: '1d10',
    });
    expect(saveRows()).toEqual([
      expect.objectContaining({ targetName: 'Thug 1', saveResult: 'failure', total: 2, appliedDamage: 0 }),
      expect.objectContaining({ targetName: 'Acolyte 2', saveResult: 'success', roll: 20, total: 24, appliedDamage: 0 }),
    ]);
    expect(applyDamageToTarget).not.toHaveBeenCalled();
  });
});
