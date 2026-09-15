// MA-0102: Adult Gold Dragon Weakening Breath picker — damageless STR DC 21
// cone. Confirming grants the registered weakening_breath te (STR-test
// disadvantage + damageSubtractDie 1d6, sourced from the dragon) on each
// failed save via weakeningBreathService (ONE merged 10-round auto-success
// clock), writes save_result + condition logs, and ZERO damage. Successful
// saves grant nothing. The picker copy states the weakening clause and never
// carries the MA-0090 "null null damage" cosmetic. Targets already carrying
// this dragon's weakening_breath te are excluded (RAW "isn't currently
// affected by this breath").
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
vi.mock('../../../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => ({
    creatures: [
      { name: 'Adult Gold Dragon 1', type: 'npc', currentHp: 243, maxHp: 243, saveBonuses: {}, resistances: [], immunities: ['Fire'] },
      { name: 'Thug 1', type: 'npc', currentHp: 45, maxHp: 45, saveBonuses: { str: 1 }, resistances: [], immunities: [] },
      { name: 'EvasiveFighter', type: 'player', currentHp: 100, maxHp: 100, saveBonuses: {}, resistances: [], immunities: [] },
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
  applyWeakeningBreathTurnEnd: vi.fn(),
  WEAKENING_BREATH_TE: 'weakening_breath',
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
import { parseWeakeningBreathClause } from '../../../encounter/MonsterCardHelpers.js';

const GOLD = monstersData.find(m => m.index === 'adult-gold-dragon');
const WEAKENING = GOLD.actions.find(a => a.name === 'Weakening Breath');

let randomSpy;
function spyRandom(seq) {
  let i = 0;
  randomSpy = vi.spyOn(Math, 'random').mockImplementation(() => seq[Math.min(i++, seq.length - 1)]);
}
afterEach(() => randomSpy?.mockRestore());

function renderBreath() {
  return render(
    <SaveAttackAoeModal
      action={WEAKENING}
      playerStats={{ name: 'Adult Gold Dragon 1' }}
      campaignName="test-campaign"
      range={60}
      damage={null}
      damageType=""
      saveType="Strength"
      saveDc={21}
      dcSuccess="none"
      titleOverride="60-ft Cone (GM positions tokens; selection advisory)"
      excludeNames={['Adult Gold Dragon 1']}
      rangeGateFt={60}
      saveConditions={[]}
      weakeningBreath={parseWeakeningBreathClause(WEAKENING.save_effect)}
      storeLastAttack={false}
      onClose={vi.fn()}
    />
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  seenTargets.current = [];
  grants.current = [];
});

describe('MA-0102 Adult Gold Weakening Breath picker', () => {
  it('damageless picker copy states the weakening clause, never null-null / half-damage boilerplate', async () => {
    spyRandom([0.5]);
    renderBreath();
    await waitFor(() => expect(seenTargets.current.length).toBe(2));
    const copy = document.querySelector('.sp-note-copy').textContent;
    expect(copy).toMatch(/Disadvantage on Strength-based D20 Tests and subtracts 1d6/);
    expect(copy).toMatch(/auto-succeeds after 1 minute/i);
    expect(copy).not.toMatch(/null/i);
    expect(copy).not.toMatch(/half damage/i);
  });

  it('excludes creatures already affected by this dragon\'s breath (RAW)', async () => {
    spyRandom([0.5]);
    runtime.store['campaign.targetEffects'] = [
      { target: 'Thug 1', effect: 'weakening_breath', source: 'Adult Gold Dragon 1' },
    ];
    renderBreath();
    await waitFor(() => expect(seenTargets.current.length).toBe(1));
    expect(seenTargets.current.map(t => t.name)).toEqual(['EvasiveFighter']);
  });

  it('NPC failed STR save grants weakening_breath via the service, zero damage', async () => {
    spyRandom([0.05, 0.05, 0.05, 0.05, 0.05, 0.05]);
    const { getByText } = renderBreath();
    await waitFor(() => expect(seenTargets.current.length).toBe(2));
    const thugRow = [...document.querySelectorAll('.secondary-target-row')].find(r => r.textContent.includes('Thug 1'));
    fireEvent.click(thugRow);
    fireEvent.click(getByText('Confirm'));
    await waitFor(() => expect(grants.current.length).toBe(1));
    expect(grants.current[0].attackerName).toBe('Adult Gold Dragon 1');
    expect(grants.current[0].targetName).toBe('Thug 1');
    expect(grants.current[0].saveType).toBe('Strength');
    expect(grants.current[0].saveDc).toBe(21);
    expect(applyDamageToTarget).not.toHaveBeenCalled();
  });

  it('NPC successful STR save grants nothing (DC 10 probe — picker NPC saves roll raw d20, abbr-keyed cs bonuses are not consulted by this seam)', async () => {
    spyRandom([0.99, 0.99, 0.99, 0.99, 0.99, 0.99]);
    const { getByText } = render(
      <SaveAttackAoeModal
        action={WEAKENING}
        playerStats={{ name: 'Adult Gold Dragon 1' }}
        campaignName="test-campaign"
        range={60}
        damage={null}
        damageType=""
        saveType="Strength"
        saveDc={10}
        dcSuccess="none"
        titleOverride="60-ft Cone"
        excludeNames={['Adult Gold Dragon 1']}
        rangeGateFt={60}
        saveConditions={[]}
        weakeningBreath={parseWeakeningBreathClause(WEAKENING.save_effect)}
        storeLastAttack={false}
        onClose={vi.fn()}
      />
    );
    await waitFor(() => expect(seenTargets.current.length).toBe(2));
    const thugRow = [...document.querySelectorAll('.secondary-target-row')].find(r => r.textContent.includes('Thug 1'));
    fireEvent.click(thugRow);
    fireEvent.click(getByText('Confirm'));
    await waitFor(() => expect(document.body.textContent).toBeTruthy());
    expect(grants.current).toHaveLength(0);
    expect(applyDamageToTarget).not.toHaveBeenCalled();
  });
});

// MA-0212: the parsed per-monster die must ride the grant call — Ancient
// Gold clause (1d10) forwards die:"1d10"; Adult clause still forwards 1d6.
describe('MA-0212 weakening breath grant forwards parsed die', () => {
  const ANCIENT_WEAKENING = {
    name: 'Weakening Breath',
    save_dc: 24,
    save_type: 'Strength',
    save_effect: 'Failure: The target has Disadvantage on Strength-based D20 Tests and subtracts 5 (1d10) from its damage rolls. It repeats the save at the end of each of its turns, ending the effect on itself on a success. After 1 minute, it succeeds automatically.',
  };

  it('ancient clause grants die 1d10; adult clause forwards 1d6', async () => {
    expect(parseWeakeningBreathClause(ANCIENT_WEAKENING.save_effect).damageSubtractDie).toBe('1d10');
    expect(parseWeakeningBreathClause(WEAKENING.save_effect).damageSubtractDie).toBe('1d6');
    spyRandom([0.05, 0.05, 0.05, 0.05, 0.05, 0.05]);
    render(
      <SaveAttackAoeModal
        action={ANCIENT_WEAKENING}
        playerStats={{ name: 'Ancient Gold Dragon 1' }}
        campaignName="test-campaign"
        range={60}
        damage={null}
        damageType=""
        saveType="Strength"
        saveDc={24}
        dcSuccess="none"
        titleOverride="60-ft Cone (GM positions tokens; selection advisory)"
        excludeNames={['Ancient Gold Dragon 1']}
        rangeGateFt={60}
        saveConditions={[]}
        weakeningBreath={parseWeakeningBreathClause(ANCIENT_WEAKENING.save_effect)}
        storeLastAttack={false}
        onClose={vi.fn()}
      />
    );
    await waitFor(() => expect(seenTargets.current.length).toBeGreaterThan(0));
    const row = document.querySelector('.secondary-target-row');
    fireEvent.click(row);
    const confirm = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Confirm');
    fireEvent.click(confirm);
    await waitFor(() => expect(grants.current.length).toBeGreaterThanOrEqual(1));
    expect(grants.current[0].die).toBe('1d10');
  });
});
