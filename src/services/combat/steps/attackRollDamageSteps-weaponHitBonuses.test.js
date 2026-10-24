// @maintained-by-ai
// attackRollDamageSteps-weaponHitBonuses lane: the TWO positive-option legs of
// buildWeaponHitBonusesStep's guard weaponHitChoiceSkips (attackRollBonuses.js:273-278) —
// the repo's only falsifiers of "chosen option contains 'strike' → bonus applies".
// Fold (attackRollDamageSteps-automationBonuses.test.js, CANON #1029; its steps[12]
// block :468-540, ranges refreshed fix#363) owns every other face of this step:
// condition arms :473-474, no-match unchanged :479, weapon_attack_hit app :484,
// weapon_or_beast_form_attack_hit app :488, option-SKIP (negative only,
// chosen 'poison') :496, upgraded-suppress :492, oncePerTurn-skip :501,
// oncePerTurn-stamp :527, uses-depleted skip :507, recharge consume 2→1
// :520, ' or ' modal CANON :514 (cited by spellDiscriminator #1025,
// lunarForm #1024/#1028). Spell gate isSpellAttackContext (:359) CANON in
// attackRollBonuses-spellDiscriminator.test.js; round plumbing CANON in the lunarForm
// lane (#1024). Old 13 arms here byte-matched or were weaker copies of those legs
// (#923/#870 deletion-with-forwarding-cite). The two survivors are strengthened to
// exact acc + zero-write negative pins (#829/#1007), distinguishable dice/types
// (#1022), and pin the option-key derivation `bonus.upgrades || bonus.name` (:274):
// t1 is the repo's ONLY exercise of the upgrades side (break it → '_undefined_option'
// → null → silent damage loss that the fold's 'poison' negative arm cannot see);
// t2 pins the name side positive-direction. Option shapes mirror real 2024
// Divine Strike / Blessed Strikes authoring (options: ['Divine Strike',
// 'Potent Spellcasting'], public/data/2024/classes.json).
//
// old->new map: condition×2, no-match, weapon_attack_hit, beast_form, upgraded,
// oncePerTurn-skip, oncePerTurn-stamp, uses<=0-skip, uses-2→1, ' or ' modal,
// option-skip('') → fold attackRollDamageSteps-automationBonuses.test.js steps[12];
// option-apply('strike') → t1 (upgrades-key) + t2 (name-key).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../dice/diceRoller.js', () => ({
  rollExpression: vi.fn((f) => {
    if (!f || f === '0') return null;
    const base = f.replace(/\s*\[.*?\]\s*/g, '').trim();
    if (!base) return null;
    const m = base.match(/^(\d+)d(\d+)([+-]\d+)?$/i);
    if (m) {
      const c = parseInt(m[1], 10), s = parseInt(m[2], 10), mod = m[3] ? parseInt(m[3], 10) : 0;
      const rolls = Array(c).fill(Math.floor(s / 2) + 1);
      return { total: rolls.reduce((a, b) => a + b, 0) + mod, rolls, modifier: mod };
    }
    const n = base.match(/^(\d+)$/);
    if (n) return { total: parseInt(n[1], 10), rolls: [parseInt(n[1], 10)], modifier: 0 };
    return { total: 6, rolls: [6], modifier: 0 };
  }),
  rollExpressionDoubled: vi.fn(),
  rollExpressionMaximized: vi.fn(),
  parseConstant: vi.fn((s) => (/^\d+$/.test(String(s)) ? Number(s) : undefined)),
}));

vi.mock('../../rules/combat/damageUtils.js', () => ({ getCombatContext: vi.fn(), getTargetFromAttacker: vi.fn() }));
vi.mock('../../encounters/combatData.js', () => ({
  getCurrentCombatRound: vi.fn(() => 1),
  loadCombatSummary: vi.fn(() => Promise.resolve({ lastAttack: {} })),
}));
vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
  setRuntimeObject: vi.fn(),
}));
vi.mock('../../combat/automation/automationService.js', () => ({
  hasTwoWeaponFighting: vi.fn(() => false),
  collectWeaponMastery: vi.fn(),
  evaluateAutoExpression: vi.fn((expr, ps) => expr === 'proficiency_bonus' ? ps?.proficiency || 0 : null),
}));
vi.mock('../../rules/combat/applyDamage.js', () => ({ applyDamageToTarget: vi.fn() }));
vi.mock('../../ui/logService.js', () => ({ addEntry: vi.fn(() => Promise.resolve({})) }));
vi.mock('../../automation/handlers/class-fighter-rogue/combatSuperiorityHandler.js', () => ({
  getAttackRiderOptions: vi.fn(() => Promise.resolve([])),
  getAttackRiderOptionsByContext: vi.fn(() => Promise.resolve([])),
}));
vi.mock('../../combat/prompts/bardicInspirationPromptUtils.js', () => ({ sendBardicInspirationOffensePrompt: vi.fn() }));
vi.mock('../../combat/auras/bardicInspirationState.js', () => ({
  hasBardicInspirationOffense: vi.fn(() => false),
  getBardicInspirationDieSize: vi.fn(() => null),
}));
vi.mock('../../automation/common/resourceCheck.js', () => ({ spendResource: vi.fn() }));
vi.mock('../../automation/common/buffToggle.js', () => ({ getActiveBuffs: vi.fn(() => []) }));
vi.mock('../../ui/utils.js', () => ({ default: { guid: () => 'test-guid-123' } }));
vi.mock('./features/index.js', () => ({ featureModules: [] }));
vi.mock('../../automation/handlers/combat/weaponMasteryHandler.js', () => ({ applyMasteryEffect: vi.fn(() => Promise.resolve()) }));
vi.mock('../../rules/combat/rangeValidation.js', () => ({ getDistanceFeet: vi.fn(() => 3) }));
vi.mock('../../automation/common/savePrompt.js', () => ({
  createSaveListener: vi.fn(() => ({ promptId: 'test-prompt-id', promise: Promise.resolve({ success: true }) })),
}));
vi.mock('../../rules/effects/expirations.js', () => ({ addExpiration: vi.fn() }));

const { buildAttackRollDamageSteps } = await import('./attackRollDamageSteps.js');
const { getRuntimeValue, setRuntimeValue } = await import('../../../hooks/runtime/useRuntimeState.js');
const { loadCombatSummary } = await import('../../encounters/combatData.js');

function makeCtx(overrides = {}) {
  return {
    attack: {},
    playerStats: { name: 'TestChar', abilities: [{ name: 'Strength', bonus: 3 }], automation: { actions: [], passives: [] }, level: 5, proficiency: 3 },
    proceedWithDamage: vi.fn(),
    campaignName: 'test-campaign',
    ...overrides,
  };
}
function gvImpl(fn) { getRuntimeValue.mockImplementation(fn); }

describe('buildAttackRollDamageSteps - weaponHitBonuses positive option legs', () => {
  let steps;
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(loadCombatSummary).mockImplementation(() => Promise.resolve({ lastAttack: { hit: true } }));
    steps = buildAttackRollDamageSteps();
  });
  afterEach(() => { vi.restoreAllMocks(); });

  // :274 upgrades-side option key (ONLY falsifier): the upgraded rider reads the BASE
  // feature's stored choice '_Blessed_Strikes_option'; chosen 'Divine Strike' contains
  // 'strike' (:277) → rider fires. 1d8 stub → [5] (#829). No oncePerTurn/uses → zero
  // runtime writes pinned negative.
  it('upgraded rider with chosen "Divine Strike" option applies +1d8 [radiant] (exact acc, zero writes)', async () => {
    gvImpl((_, p) => p === '_Blessed_Strikes_option' ? 'Divine Strike' : null);
    const r = await steps[12].handler(makeCtx({
      playerStats: { name: 'TestChar', automation: { actions: [
        { name: 'Improved Blessed Strikes', upgrades: 'Blessed Strikes', type: 'damage_bonus', trigger: 'weapon_attack_hit', damageExpression: '1d8', damageType: 'radiant', options: ['Divine Strike', 'Potent Spellcasting'] },
      ], passives: [] } },
      formula: '1d8+3', total: 11, rolls: [8, 3],
    }));
    expect(r.data).toEqual({ formula: '1d8+3 + 1d8 [radiant]', total: 16, rolls: [8, 3, 5] });
    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  // :274 name-side option key, positive direction: a base rider (no upgrades) with the
  // same real-data options must also fire on a 'strike'-containing choice. Distinguishable
  // by die+type from t1 (#1022). Fold's 'poison' arm (:378-382) stays the negative here.
  it('base rider with chosen "Divine Strike" option applies +1d6 [necrotic] (exact acc, zero writes)', async () => {
    gvImpl((_, p) => p === '_Divine_Strike_option' ? 'Divine Strike' : null);
    const r = await steps[12].handler(makeCtx({
      playerStats: { name: 'TestChar', automation: { actions: [
        { name: 'Divine Strike', type: 'damage_bonus', trigger: 'weapon_attack_hit', damageExpression: '1d6', damageType: 'necrotic', options: ['Divine Strike', 'Potent Spellcasting'] },
      ], passives: [] } },
      formula: '1d8+3', total: 11, rolls: [8, 3],
    }));
    expect(r.data).toEqual({ formula: '1d8+3 + 1d6 [necrotic]', total: 15, rolls: [8, 3, 4] });
    expect(setRuntimeValue).not.toHaveBeenCalled();
  });
});
