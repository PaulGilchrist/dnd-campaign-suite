// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

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

const { buildAttackRollDamageSteps } = await import('./attackRollDamageSteps.js');
const { getRuntimeValue, setRuntimeValue } = await import('../../../hooks/runtime/useRuntimeState.js');
const { addEntry } = await import('../../ui/logService.js');
const { loadCombatSummary } = await import('../../encounters/combatData.js');
const { getActiveBuffs } = await import('../../automation/common/buffToggle.js');

function makeCtx(overrides = {}) {
  return {
    attack: {},
    playerStats: { name: 'TestChar', abilities: [{ name: 'Strength', bonus: 3 }], automation: { actions: [], passives: [] }, level: 5, proficiency: 3 },
    proceedWithDamage: vi.fn(),
    campaignName: 'test-campaign',
    ...overrides,
  };
}
function buffsMock(b) { vi.mocked(getActiveBuffs).mockReturnValue(b); }
function gvImpl(fn) { getRuntimeValue.mockImplementation(fn); }

describe('buildAttackRollDamageSteps - automationBonuses', () => {
  let steps;
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(loadCombatSummary).mockImplementation(() => Promise.resolve({ lastAttack: { hit: true } }));
    steps = buildAttackRollDamageSteps();
  });

  // ── automationBonuses (index 10) ──
  describe('automationBonuses step', () => {
    describe('condition', () => {
      const cond = (o) => steps[11].condition(makeCtx(o));
      it('true when automation exists', () => expect(cond({ playerStats: { automation: { actions: [] } } })).toBe(true));
      it('false when automation missing', () => expect(cond({ playerStats: { automation: {} } })).toBe(false));
    });
    describe('handler', () => {
      it('returns data when no matching actions', async () => {
        const r = await steps[11].handler(makeCtx({ isMeleeOrUnarmed: true, automation: { actions: [] }, formula: '1d8+3', total: 11, rolls: [8, 3] }));
        expect(r.data.formula).toBe('1d8+3');
      });
      it('applies melee_weapon_hit damage_bonus', async () => {
        const r = await steps[11].handler(makeCtx({ isMeleeOrUnarmed: true, playerStats: { automation: { actions: [{ type: 'damage_bonus', trigger: 'melee_weapon_hit', damageExpression: '1d6', damageType: 'fire' }] } }, formula: '1d8+3', total: 11, rolls: [8, 3] }));
        expect(r.data.formula).toContain('+ 1d6 [fire]');
      });
      it('CLA-280: melee hit gains 1d8 radiant from Radiant Strikes', async () => {
        const r = await steps[11].handler(makeCtx({ isMeleeOrUnarmed: true, attack: { weaponType: 'melee', properties: ['Versatile'] }, playerStats: { name: 'TestChar', automation: { actions: [{ type: 'damage_bonus', trigger: 'melee_weapon_hit', damageExpression: '1d8', damageType: 'Radiant' }] } }, formula: '1d8+5', total: 10, rolls: [5, 5] }));
        expect(r.data.formula).toContain('+ 1d8 [radiant]');
        expect(r.data.total).toBeGreaterThan(10);
      });
      it('CLA-280: ranged attack gains NO melee_weapon_hit bonus', async () => {
        const r = await steps[11].handler(makeCtx({ isMeleeOrUnarmed: false, attack: { weaponType: 'ranged', properties: ['Ammunition', 'Heavy', 'Range'] }, playerStats: { name: 'TestChar', automation: { actions: [{ type: 'damage_bonus', trigger: 'melee_weapon_hit', damageExpression: '1d8', damageType: 'Radiant' }] } }, formula: '1d8+3', total: 8, rolls: [5, 3] }));
        expect(r.data.formula).toBe('1d8+3');
        expect(r.data.total).toBe(8);
      });
      it('CLA-280: unarmed strike gains melee_weapon_hit bonus', async () => {
        const r = await steps[11].handler(makeCtx({ isMeleeOrUnarmed: true, attack: { weaponType: 'unarmed' }, playerStats: { name: 'TestChar', automation: { actions: [{ type: 'damage_bonus', trigger: 'melee_weapon_hit', damageExpression: '1d8', damageType: 'Radiant' }] } }, formula: '1d8+5', total: 9, rolls: [4, 5] }));
        expect(r.data.formula).toContain('+ 1d8 [radiant]');
      });
      it('applies monk_weapon_or_unarmed_hit with elemental attunement', async () => {
        gvImpl((_, p) => p === '_Elemental_Attunement_option' ? 'fire' : null);
        const r = await steps[11].handler(makeCtx({ isMeleeOrUnarmed: true, playerStats: { automation: { actions: [{ type: 'damage_bonus', trigger: 'monk_weapon_or_unarmed_hit', damageExpression: '1d6', damageType: '' }] } }, formula: '1d8+3', total: 11, rolls: [8, 3] }));
        expect(r.data.formula).toContain('+ 1d6 [fire]');
      });
      it('applies monk with default fire when no attunement', async () => {
        getRuntimeValue.mockReturnValue(null);
        const r = await steps[11].handler(makeCtx({ isMeleeOrUnarmed: true, playerStats: { automation: { actions: [{ type: 'damage_bonus', trigger: 'monk_weapon_or_unarmed_hit', damageExpression: '1d6', damageType: '' }] } }, formula: '1d8+3', total: 11, rolls: [8, 3] }));
        expect(r.data.formula).toContain('+ 1d6 [fire]');
      });
      it('applies monk with lowercase option', async () => {
        gvImpl((_, p) => p === '_Elemental_Attunement_option' ? 'Lightning' : null);
        const r = await steps[11].handler(makeCtx({ isMeleeOrUnarmed: true, playerStats: { automation: { actions: [{ type: 'damage_bonus', trigger: 'monk_weapon_or_unarmed_hit', damageExpression: '1d6', damageType: '' }] } }, formula: '1d8+3', total: 11, rolls: [8, 3] }));
        expect(r.data.formula).toContain('+ 1d6 [lightning]');
      });
      it('applies melee_heavy when weapon is heavy', async () => {
        const r = await steps[11].handler(makeCtx({ isMeleeOrUnarmed: true, playerStats: { automation: { actions: [{ type: 'damage_bonus', trigger: 'melee_heavy_weapon_hit', damageExpression: '1d6', damageType: 'slashing' }] } }, attack: { properties: ['Heavy'] }, formula: '1d8+3', total: 11, rolls: [8, 3] }));
        expect(r.data.formula).toContain('+ 1d6 [slashing]');
      });
      it('skips melee_heavy when not heavy', async () => {
        const r = await steps[11].handler(makeCtx({ isMeleeOrUnarmed: true, playerStats: { automation: { actions: [{ type: 'damage_bonus', trigger: 'melee_heavy_weapon_hit', damageExpression: '1d6', damageType: 'slashing' }] } }, attack: { properties: ['Finesse'] }, formula: '1d8+3', total: 11, rolls: [8, 3] }));
        expect(r.data.formula).not.toContain('+ 1d6');
      });
      it('defaults to Slashing for heavy when no damageType', async () => {
        const r = await steps[11].handler(makeCtx({ isMeleeOrUnarmed: true, playerStats: { automation: { actions: [{ type: 'damage_bonus', trigger: 'melee_heavy_weapon_hit', damageExpression: '1d6' }] } }, attack: { properties: ['Heavy'] }, formula: '1d8+3', total: 11, rolls: [8, 3] }));
        expect(r.data.formula).toContain('+ 1d6 [slashing]');
      });

      // Frenzy tests
      const frenzyBase = { isMeleeOrUnarmed: true, playerStats: { name: 'TestChar', automation: { actions: [{ type: 'damage_bonus', trigger: 'reckless_attack_hit_while_raging', damageExpression: '2', damageType: '' }] }, level: 5 }, attack: { abilityName: 'Strength' }, formula: '1d8+3', total: 11, rolls: [8, 3] };
      it('applies frenzy when reckless+raging+strength', async () => {
        gvImpl((_, p) => p === '_frenzyUsedRound' ? null : p === 'activeBuffs' ? [{ effect: 'advantage_attacks_advantage_against' }, { damageBonusExpression: '1d6' }] : null);
        const r = await steps[11].handler(makeCtx({ ...frenzyBase, hit: true, playerStats: { ...frenzyBase.playerStats, class: { class_levels: [{ rage_damage: 2 }] } } }));
        expect(r.data.formula).toContain('+ 2');
        expect(setRuntimeValue).toHaveBeenCalledWith('TestChar', '_frenzyUsedRound', 1, 'test-campaign');
      });
      it('skips frenzy when attack misses', async () => {
        gvImpl((_, p) => p === '_frenzyUsedRound' ? null : p === 'activeBuffs' ? [{ effect: 'advantage_attacks_advantage_against' }, { damageBonusExpression: '1d6' }] : null);
        const r = await steps[11].handler(makeCtx({ ...frenzyBase, hit: false, playerStats: { ...frenzyBase.playerStats, class: { class_levels: [{ rage_damage: 2 }] } } }));
        expect(r.data.formula).not.toContain('+ 2');
        expect(setRuntimeValue).not.toHaveBeenCalledWith('TestChar', '_frenzyUsedRound', expect.any(Number), 'test-campaign');
      });
      it('skips frenzy when not reckless', async () => {
        gvImpl((_, p) => p === '_frenzyUsedRound' ? null : p === 'activeBuffs' ? [{ damageBonusExpression: '1d6' }] : null);
        const r = await steps[11].handler(frenzyBase);
        expect(r.data.formula).not.toContain('+ 2');
      });
      it('skips frenzy when not raging', async () => {
        gvImpl((_, p) => p === '_frenzyUsedRound' ? null : p === 'activeBuffs' ? [{ effect: 'advantage_attacks_advantage_against' }] : null);
        const r = await steps[11].handler(frenzyBase);
        expect(r.data.formula).not.toContain('+ 2');
      });
      it('skips frenzy when not strength', async () => {
        gvImpl((_, p) => p === '_frenzyUsedRound' ? null : p === 'activeBuffs' ? [{ effect: 'advantage_attacks_advantage_against' }, { damageBonusExpression: '1d6' }] : null);
        const r = await steps[11].handler({ ...frenzyBase, attack: { abilityName: 'Dexterity' } });
        expect(r.data.formula).not.toContain('+ 2');
      });
      it('skips frenzy when already used', async () => {
        gvImpl((_, p) => p === '_frenzyUsedRound' ? 1 : p === 'activeBuffs' ? [{ effect: 'advantage_attacks_advantage_against' }, { damageBonusExpression: '1d6' }] : null);
        const r = await steps[11].handler(frenzyBase);
        expect(r.data.formula).not.toContain('+ 2');
      });

      // Divine fury tests
      const dfBase = { isMeleeOrUnarmed: true, playerStats: { automation: { actions: [{ type: 'damage_bonus', trigger: 'first_hit_while_raging', damageExpression: '2', damageType: 'radiant' }] }, level: 5 }, formula: '1d8+3', total: 11, rolls: [8, 3] };
      it('applies divine fury while raging', async () => {
        gvImpl((_, p) => p === '_divineFuryUsedRound' ? null : p === 'activeBuffs' ? [{ damageBonusExpression: '1d6' }] : null);
        const r = await steps[11].handler(makeCtx({ ...dfBase, playerStats: { ...dfBase.playerStats, automation: { actions: [{ type: 'damage_bonus', trigger: 'first_hit_while_raging', damageExpression: 'barbarian_level / 2', damageType: 'radiant' }] }, level: 5 } }));
        expect(r.data.formula).toContain('+ 2 [radiant]');
      });
      it('skips divine fury when already used', async () => {
        gvImpl((_, p) => p === '_divineFuryUsedRound' ? 1 : p === 'activeBuffs' ? [{ damageBonusExpression: '1d6' }] : null);
        const r = await steps[11].handler(dfBase);
        expect(r.data.formula).not.toContain('+ 2');
      });
      it('skips divine fury when not raging', async () => {
        gvImpl((_, p) => p === '_divineFuryUsedRound' ? null : p === 'activeBuffs' ? [] : null);
        const r = await steps[11].handler(dfBase);
        expect(r.data.formula).not.toContain('+ 2');
      });
      it('prompts for divine fury damage type when type has "or"', async () => {
        gvImpl((_, p) => p === '_divineFuryUsedRound' ? null : p === 'activeBuffs' ? [{ damageBonusExpression: '1d6' }] : null);
        const setDF = vi.fn();
        const r = await steps[11].handler(makeCtx({ ...dfBase, setDivineFuryChoice: setDF, playerStats: { ...dfBase.playerStats, automation: { actions: [{ type: 'damage_bonus', trigger: 'first_hit_while_raging', damageExpression: '2', damageType: 'radiant or necrotic' }] }, level: 5 } }));
        expect(r.modal).toEqual({ type: 'divineFury', props: { damageType: 'radiant or necrotic' } });
        expect(r.data._divineFuryPending).toBe(true);
        expect(setDF).toHaveBeenCalledWith('radiant or necrotic');
      });

      // Brutal strike tests
      const bsBase = { isMeleeOrUnarmed: true, playerStats: { automation: { actions: [{ type: 'attack_rider', trigger: 'strength_attack_hit_after_reckless', damageExpression: '1d6', damageType: 'slashing' }] } }, formula: '1d8+3', total: 11, rolls: [8, 3] };
      it('applies attack_rider when brutalStrikeActive', async () => {
        gvImpl((_, p) => p === '_brutalStrikeActive' ? true : null);
        const r = await steps[11].handler(bsBase);
        expect(r.data.formula).toContain('+ 1d6 [slashing]');
      });
      it('skips attack_rider when not brutalStrikeActive', async () => {
        getRuntimeValue.mockReturnValue(null);
        const r = await steps[11].handler(bsBase);
        expect(r.data.formula).toBe('1d8+3');
      });
      it('selects highest damage rider when multiple exist', async () => {
        gvImpl((_, p) => p === '_brutalStrikeActive' ? true : p === '_brutalStrikeEffects' ? [] : null);
        const r = await steps[11].handler(makeCtx({ ...bsBase, targetName: 'Orc', playerStats: { ...bsBase.playerStats, automation: { actions: [
          { type: 'attack_rider', trigger: 'strength_attack_hit_after_reckless', damageExpression: '1d4', damageType: 'slashing', name: "Lesser" },
          { type: 'attack_rider', trigger: 'strength_attack_hit_after_reckless', damageExpression: '3d6', damageType: 'force', name: "Greater" },
        ]} } }));
        expect(r.data.formula).toContain('+ 3d6 [force]');
        expect(r.data.formula).not.toContain('+ 1d4');
      });
      it('stores Staggering Blow targetEffects and logs', async () => {
        gvImpl((_, p) => p === '_brutalStrikeActive' ? true : p === '_brutalStrikeEffects' ? ['Staggering Blow'] : p === 'targetEffects' ? [] : null);
        const r = await steps[11].handler(makeCtx({ isMeleeOrUnarmed: true, targetName: 'Goblin', playerStats: { automation: { actions: [{ type: 'attack_rider', trigger: 'strength_attack_hit_after_reckless', damageExpression: '1d6', damageType: 'slashing', name: "Brutal Strike (Level 13)", options: [{ name: 'Staggering Blow', effect: 'disadvantage_on_next_save', value: '1 round', noOpportunityAttacks: true }] }] } }, formula: '1d8+3', total: 11, rolls: [8, 3] }));
        expect(r.data.formula).toContain('+ 1d6 [slashing]');
        expect(setRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects', expect.any(Array), 'test-campaign');
        expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({ abilityName: "Brutal Strike (Level 13)" }));
      });
      it('stores Sundering Blow targetEffects', async () => {
        gvImpl((_, p) => p === '_brutalStrikeActive' ? true : p === '_brutalStrikeEffects' ? ['Sundering Blow'] : p === 'targetEffects' ? [] : null);
        const r = await steps[11].handler(makeCtx({ isMeleeOrUnarmed: true, targetName: 'Orc', playerStats: { automation: { actions: [{ type: 'attack_rider', trigger: 'strength_attack_hit_after_reckless', damageExpression: '1d6', damageType: 'slashing', name: "Brutal Strike (Level 17)", options: [{ name: 'Sundering Blow', effect: 'next_attack_bonus', value: 5 }] }] } }, formula: '1d8+3', total: 11, rolls: [8, 3] }));
        expect(r.data.formula).toContain('+ 1d6 [slashing]');
        expect(setRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects', expect.any(Array), 'test-campaign');
        expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({ abilityName: "Brutal Strike (Level 17)" }));
      });
    });
  });

  // ── weaponHitBonuses (index 11) ──
  describe('weaponHitBonuses step', () => {
    describe('condition', () => {
      const cond = (o) => steps[12].condition(makeCtx(o));
      it('true when automation.actions exists', () => expect(cond({ playerStats: { automation: { actions: [] } } })).toBe(true));
      it('false when automation missing', () => expect(cond({ playerStats: { automation: {} } })).toBe(false));
    });
    describe('handler', () => {
      const base = { playerStats: { automation: { actions: [], passives: [] } }, formula: '1d8+3', total: 11, rolls: [8, 3] };
      it('applies weapon_attack_hit bonuses', async () => {
        const r = await steps[12].handler(makeCtx({ ...base, playerStats: { ...base.playerStats, automation: { actions: [{ type: 'damage_bonus', trigger: 'weapon_attack_hit', damageExpression: '1d4', damageType: 'cold', name: 'TB' }] } } }));
        expect(r.data.formula).toContain('+ 1d4 [cold]');
      });
      it('applies weapon_or_beast_form_attack_hit bonuses', async () => {
        const r = await steps[12].handler(makeCtx({ ...base, playerStats: { ...base.playerStats, automation: { actions: [{ type: 'damage_bonus', trigger: 'weapon_or_beast_form_attack_hit', damageExpression: '1d4', damageType: 'piercing', name: 'TB' }] } } }));
        expect(r.data.formula).toContain('+ 1d4 [piercing]');
      });
      it('skips upgraded bonuses', async () => {
        const r = await steps[12].handler(makeCtx({ ...base, playerStats: { ...base.playerStats, automation: { actions: [{ type: 'damage_bonus', trigger: 'weapon_attack_hit', damageExpression: '1d4', damageType: 'cold', name: 'PS' }], passives: [{ name: 'PS', upgrades: 'PS' }] } } }));
        expect(r.data.formula).not.toContain('+ 1d4');
      });
      it('skips when option does not include strike', async () => {
        gvImpl((_, p) => p === '_TB_option' ? 'poison' : null);
        const r = await steps[12].handler(makeCtx({ ...base, playerStats: { ...base.playerStats, automation: { actions: [{ type: 'damage_bonus', trigger: 'weapon_attack_hit', damageExpression: '1d4', damageType: 'cold', options: ['poison', 'cold strike'], name: 'TB' }] } } }));
        expect(r.data.formula).not.toContain('+ 1d4');
      });
      it('skips oncePerTurn when already used', async () => {
        gvImpl((_, p) => p === '_TB_usedRound' ? 1 : null);
        const r = await steps[12].handler(makeCtx({ ...base, playerStats: { ...base.playerStats, automation: { actions: [{ type: 'damage_bonus', trigger: 'weapon_attack_hit', damageExpression: '1d4', damageType: 'cold', oncePerTurn: true, name: 'TB' }] } } }));
        expect(r.data.formula).not.toContain('+ 1d4');
      });
      it('skips when uses depleted', async () => {
        gvImpl((_, p) => p === '_TB_uses' ? '0' : null);
        const r = await steps[12].handler(makeCtx({ ...base, playerStats: { ...base.playerStats, automation: { actions: [{ type: 'damage_bonus', trigger: 'weapon_attack_hit', damageExpression: '1d4', damageType: 'cold', uses_expression: '1d4', recharge: true, name: 'TB', usesMax: 3 }] } } }));
        expect(r.data.formula).not.toContain('+ 1d4');
      });
      it('prompts for damage type when type has "or"', async () => {
        const r = await steps[12].handler(makeCtx({ ...base, playerStats: { ...base.playerStats, automation: { actions: [{ type: 'damage_bonus', trigger: 'weapon_attack_hit', damageExpression: '1d4', damageType: 'radiant or necrotic', name: 'TB' }] } } }));
        expect(r.modal).toEqual({ type: 'damageTypeChoice', props: { title: 'TB — Damage Type', types: ['radiant', 'necrotic'] } });
        expect(r.data._weaponHitPending).toBe(true);
      });
      it('decrements uses when recharge enabled', async () => {
        gvImpl((_, p) => p === '_TB_uses' ? '2' : null);
        const r = await steps[12].handler(makeCtx({ playerStats: { name: 'TestChar', abilities: [{ name: 'Strength', bonus: 3 }], automation: { actions: [{ type: 'damage_bonus', trigger: 'weapon_attack_hit', damageExpression: '1d4', damageType: 'cold', uses_expression: '1d4', recharge: true, name: 'TB', usesMax: 3 }], passives: [] }, level: 5, proficiency: 3 }, formula: '1d8+3', total: 11, rolls: [8, 3] }));
        expect(r.data.formula).toContain('+ 1d4 [cold]');
        expect(setRuntimeValue).toHaveBeenCalledWith('TestChar', '_TB_uses', 1, 'test-campaign');
      });
      it('sets usedRound when oncePerTurn', async () => {
        const r = await steps[12].handler(makeCtx({ playerStats: { name: 'TestChar', abilities: [{ name: 'Strength', bonus: 3 }], automation: { actions: [{ type: 'damage_bonus', trigger: 'weapon_attack_hit', damageExpression: '1d4', damageType: 'cold', oncePerTurn: true, name: 'OB' }], passives: [] }, level: 5, proficiency: 3 }, formula: '1d8+3', total: 11, rolls: [8, 3] }));
        expect(r.data.formula).toContain('+ 1d4 [cold]');
        expect(setRuntimeValue).toHaveBeenCalledWith('TestChar', '_OB_usedRound', 1, 'test-campaign');
      });
      it('returns data when no matching actions', async () => {
        const r = await steps[12].handler(makeCtx({ ...base, playerStats: { ...base.playerStats, automation: { actions: [] } } }));
        expect(r.data.formula).toBe('1d8+3');
      });
    });
  });

  // ── natural20Bonuses (index 12) ──
  describe('natural20Bonuses step', () => {
    describe('condition', () => {
      const cond = (o) => steps[13].condition(makeCtx(o));
      it('true when isNatural20 and automation exists', () => expect(cond({ isNatural20: true, playerStats: { automation: { actions: [] } } })).toBe(true));
      it('true when d20Roll >= 20 and automation exists', () => expect(cond({ d20Roll: 20, playerStats: { automation: { actions: [] } } })).toBe(true));
      it('false when isNatural20 but no automation', () => expect(cond({ isNatural20: true, playerStats: { automation: {} } })).toBe(false));
      it('false when d20Roll is 19', () => expect(cond({ d20Roll: 19, playerStats: { automation: { actions: [] } } })).toBe(false));
    });
    describe('handler', () => {
      const base = { isNatural20: true, playerStats: { automation: { actions: [], passives: [] } }, formula: '1d8+3', total: 11, rolls: [8, 3] };
      it('applies natural_20_attack_roll bonuses', async () => {
        const r = await steps[13].handler(makeCtx({ ...base, playerStats: { ...base.playerStats, automation: { actions: [{ type: 'damage_bonus', trigger: 'natural_20_attack_roll', extraDamageExpression: '1d6', name: 'ED' }] } } }));
        expect(r.data.formula).toContain('+ 1d6 [ED]');
      });
      it('applies increased_ability_score when specified', async () => {
        const r = await steps[13].handler(makeCtx({ ...base, playerStats: { ...base.playerStats, abilities: [{ name: 'Strength', bonus: 3 }, { name: 'Dexterity', bonus: 2 }], automation: { actions: [{ type: 'damage_bonus', trigger: 'natural_20_attack_roll', extraDamageExpression: 'increased_ability_score', abilityIncreased: 'Strength', name: 'AB' }] } } }));
        expect(r.data.formula).toContain('+ 3 [AB]');
      });
      it('applies max str/dex when abilityIncreased not specified', async () => {
        const r = await steps[13].handler(makeCtx({ ...base, playerStats: { ...base.playerStats, abilities: [{ name: 'Strength', bonus: 3 }, { name: 'Dexterity', bonus: 5 }], automation: { actions: [{ type: 'damage_bonus', trigger: 'natural_20_attack_roll', extraDamageExpression: 'increased_ability_score', name: 'AB' }] } } }));
        expect(r.data.formula).toContain('+ 5 [AB]');
      });
      it('handles flat numeric expression', async () => {
        const r = await steps[13].handler(makeCtx({ ...base, playerStats: { ...base.playerStats, automation: { actions: [{ type: 'damage_bonus', trigger: 'natural_20_attack_roll', extraDamageExpression: '5', name: 'FB' }] } } }));
        expect(r.data.formula).toContain('+ 5 [FB]');
      });
      it('handles zero ability score bonus', async () => {
        const r = await steps[13].handler(makeCtx({ ...base, playerStats: { ...base.playerStats, abilities: [{ name: 'Strength', bonus: 0 }], automation: { actions: [{ type: 'damage_bonus', trigger: 'natural_20_attack_roll', extraDamageExpression: 'increased_ability_score', abilityIncreased: 'Strength', name: 'AB' }] } } }));
        expect(r.data.formula).toContain('+ 0 [AB]');
      });
      it('returns data when no matching actions', async () => {
        const r = await steps[13].handler(makeCtx({ ...base, playerStats: { ...base.playerStats, automation: { actions: [] } } }));
        expect(r.data.formula).toBe('1d8+3');
      });
    });
  });

  // ── celestialRevelation (index 13) ──
  describe('celestialRevelation step', () => {
    describe('condition', () => {
      const cond = (o) => steps[14].condition(makeCtx(o));
      it('true when automation.passives exists', () => expect(cond({ playerStats: { automation: { passives: [] } } })).toBe(true));
      it('false when passives missing', () => expect(cond({ playerStats: { automation: { actions: [] } } })).toBe(false));
    });
    describe('handler', () => {
      const base = { playerStats: { automation: { actions: [], passives: [] } }, formula: '1d8+3', total: 11, rolls: [8, 3] };
      it('returns empty when no riders', async () => {
        buffsMock([]);
        const r = await steps[14].handler(makeCtx({ ...base, playerStats: { ...base.playerStats, automation: { passives: [] } } }));
        expect(r.data).toEqual({});
      });
      it('returns empty when no matching buff', async () => {
        buffsMock([{ name: 'Other Buff' }]);
        const r = await steps[14].handler(makeCtx({ ...base, playerStats: { ...base.playerStats, automation: { passives: [{ type: 'attack_rider', name: 'Heavenly Wings', damageExpression: '1d6', trigger: 'hit' }] } } }));
        expect(r.data).toEqual({});
      });
      it('returns empty when rider not found', async () => {
        buffsMock([{ name: 'Heavenly Wings' }]);
        const r = await steps[14].handler(makeCtx({ ...base, playerStats: { ...base.playerStats, automation: { passives: [{ type: 'attack_rider', name: 'Other', damageExpression: '1d6', trigger: 'hit' }] } } }));
        expect(r.data).toEqual({});
      });
      it('returns empty when oncePerTurn used', async () => {
        buffsMock([{ name: 'Heavenly Wings' }]);
        gvImpl((_, p) => p === '_Heavenly_Wings_usedRound' ? 1 : null);
        const r = await steps[14].handler(makeCtx({ ...base, playerStats: { ...base.playerStats, automation: { passives: [{ type: 'attack_rider', name: 'Heavenly Wings', damageExpression: '1d6', trigger: 'hit', oncePerTurn: true }] } } }));
        expect(r.data).toEqual({});
      });
      it('applies celestial damage when conditions met', async () => {
        buffsMock([{ name: 'Inner Radiance' }]);
        getRuntimeValue.mockReturnValue(null);
        const r = await steps[14].handler(makeCtx({ targetName: 'Goblin', playerStats: { name: 'TestChar', abilities: [{ name: 'Strength', bonus: 3 }], automation: { passives: [{ type: 'attack_rider', name: 'Inner Radiance', damageExpression: '1d6', damageType: 'radiant', trigger: 'hit', oncePerTurn: true }] }, level: 5, proficiency: 3 }, formula: '1d8+3', total: 11, rolls: [8, 3] }));
        expect(r.data.formula).toContain('+ 1d6 [radiant]');
        expect(r.data.total).toBe(15);
        expect(setRuntimeValue).toHaveBeenCalledWith('TestChar', '_Inner_Radiance_usedRound', 1, 'test-campaign');
      });
      it('works with Heavenly Wings', async () => {
        buffsMock([{ name: 'Heavenly Wings' }]);
        getRuntimeValue.mockReturnValue(null);
        const r = await steps[14].handler(makeCtx({ ...base, targetName: 'Goblin', playerStats: { ...base.playerStats, automation: { passives: [{ type: 'attack_rider', name: 'Heavenly Wings', damageExpression: '1d4', damageType: 'fire', trigger: 'hit' }] } } }));
        expect(r.data.formula).toContain('+ 1d4 [fire]');
      });
      it('works with Necrotic Shroud', async () => {
        buffsMock([{ name: 'Necrotic Shroud' }]);
        getRuntimeValue.mockReturnValue(null);
        const r = await steps[14].handler(makeCtx({ ...base, targetName: 'Goblin', playerStats: { ...base.playerStats, automation: { passives: [{ type: 'attack_rider', name: 'Necrotic Shroud', damageExpression: '1d4', damageType: 'necrotic', trigger: 'hit' }] } } }));
        expect(r.data.formula).toContain('+ 1d4 [necrotic]');
      });
      it('returns empty when rollExpression fails', async () => {
        buffsMock([{ name: 'Heavenly Wings' }]);
        getRuntimeValue.mockReturnValue(null);
        const r = await steps[14].handler(makeCtx({ ...base, playerStats: { ...base.playerStats, automation: { passives: [{ type: 'attack_rider', name: 'Heavenly Wings', damageExpression: '0', trigger: 'hit' }] } } }));
        expect(r.data).toEqual({});
      });
    });
  });
});
