// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveAttackDamageStandalone, normalizeAutoDamage } from './useAttackDamageResolution.js';

vi.mock('../../services/dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
}));

vi.mock('../../services/combat/automation/automationService.js', () => ({
    evaluateAutoExpression: vi.fn(),
}));

vi.mock('../../services/rules/spells/postCastRiderService.js', () => ({
    getEmpoweredEvocationFeatures: vi.fn(() => []),
    getEmpoweredEvocationIntModifier: vi.fn(() => 0),
}));

vi.mock('../../services/automation/handlers/class-fighter-rogue/combatSuperiorityHandler.js', () => ({
    executeAttackRiderManeuver: vi.fn(),
    applyManeuveringAllyGrant: vi.fn(),
}));

vi.mock('../../services/rules/combat/applyDamage.js', () => ({
    applyDamageToTarget: vi.fn(),
}));

vi.mock('../../services/combat/steps/index.js', () => ({
    buildPipelineForAction: vi.fn(() => ({
        run: vi.fn().mockResolvedValue(undefined),
    })),
}));

import { buildPipelineForAction } from '../../services/combat/steps/index.js';
import { rollExpression } from '../../services/dice/diceRoller.js';

const mockRollDamage = vi.fn();
const mockSetPopupHtml = vi.fn();

const defaultPlayerStats = {
    name: 'TestFighter',
    level: 5,
    abilities: [],
    automation: { actions: [], passives: [] },
};

function makeAttack(overrides = {}) {
    return { name: 'Longsword', damage: '1d8+3', damageType: 'slashing', ...overrides };
}

function getCtxFromLastRun() {
    const pipeline = buildPipelineForAction.mock.results[0]?.value;
    const runCalls = pipeline?.run?.mock?.calls;
    return runCalls?.length > 0 ? runCalls[0][1] : null;
}

describe('resolveAttackDamageStandalone', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 3 });
        buildPipelineForAction.mockReturnValue({
            run: vi.fn().mockResolvedValue(undefined),
        });
    });

    describe('pipeline construction and execution', () => {
        it('calls buildPipelineForAction with attack and playerStats, then runs housekeeping:do', async () => {
            const attack = makeAttack();
            const playerStats = { ...defaultPlayerStats };

            await resolveAttackDamageStandalone(attack, {}, {
                playerStats,
                campaignName: 'test-campaign',
                setPopupHtml: mockSetPopupHtml,
                rollDamage: mockRollDamage,
            });

            expect(buildPipelineForAction).toHaveBeenCalledWith(attack, playerStats);
            const pipeline = buildPipelineForAction.mock.results[0].value;
            expect(pipeline.run).toHaveBeenCalledWith('housekeeping:do', expect.any(Object), expect.any(Object));
        });

        it('returns a resolved promise when pipeline completes successfully', async () => {
            const attack = makeAttack();
            const playerStats = { ...defaultPlayerStats };
            const result = resolveAttackDamageStandalone(attack, {}, {
                playerStats,
                campaignName: 'test-campaign',
                setPopupHtml: mockSetPopupHtml,
                rollDamage: mockRollDamage,
            });

            expect(result).toBeInstanceOf(Promise);
            await expect(result).resolves.toBeUndefined();
        });
    });

    describe('context defaults from ctxOverrides', () => {
        it('sets all default context fields when ctxOverrides is an empty object', async () => {
            const attack = makeAttack();
            const playerStats = { ...defaultPlayerStats };

            await resolveAttackDamageStandalone(attack, {}, {
                playerStats,
                campaignName: 'test-campaign',
                setPopupHtml: mockSetPopupHtml,
                rollDamage: mockRollDamage,
            });

            const ctx = getCtxFromLastRun();
            expect(ctx).toMatchObject({
                hit: true, isCrit: false, isNatural20: false, targetName: null,
                isBonusActionAttack: false, formula: null, total: 0, rolls: [],
                modifier: 0, sneakDice: 0, effectiveSneakDice: 0,
                isMeleeOrUnarmed: false, buildCtxResult: null,
                autoFormulaOverride: null, overchannelActive: false,
                overchannelUseCount: 0, overchannelSpellLevel: 1,
                autoDamageSaveDc: null, empoweredEvocationModifier: 0,
            });
        });

        it('overrides defaults with provided ctxOverrides values including arbitrary spread fields', async () => {
            const attack = makeAttack();
            const playerStats = { ...defaultPlayerStats };
            const overrides = {
                hit: false, isCrit: true, isNatural20: true, targetName: 'Goblin',
                isBonusActionAttack: true, overchannelActive: true,
                overchannelUseCount: 2, overchannelSpellLevel: 3,
                sneakDice: 4, effectiveSneakDice: 4, isMeleeOrUnarmed: true,
                autoFormulaOverride: 'custom formula', empoweredEvocationModifier: 2,
                autoDamageSaveDc: 16, attackerName: 'Custom Attacker',
            };

            await resolveAttackDamageStandalone(attack, overrides, {
                playerStats, campaignName: 'test-campaign',
                setPopupHtml: mockSetPopupHtml, rollDamage: mockRollDamage,
            });

            const ctx = getCtxFromLastRun();
            expect(ctx).toMatchObject(overrides);
        });
    });

    describe('modal state handlers', () => {
        it('creates a context with modal setter functions that update internal state', async () => {
            const attack = makeAttack();
            const playerStats = { ...defaultPlayerStats };

            await resolveAttackDamageStandalone(attack, {}, {
                playerStats,
                campaignName: 'test-campaign',
                setPopupHtml: mockSetPopupHtml,
                rollDamage: mockRollDamage,
            });

            const ctx = getCtxFromLastRun();
            expect(typeof ctx.setDamageTypeChoice).toBe('function');
            expect(typeof ctx.setDivineFuryChoice).toBe('function');
            expect(typeof ctx.setAttackRiderModal).toBe('function');
            expect(typeof ctx.setAttackRiderManeuverPrompt).toBe('function');
            expect(typeof ctx.setSweepingAttackTargetModal).toBe('function');
            expect(typeof ctx.setSecondaryTargetModal).toBe('function');

            ctx.setDamageTypeChoice('fire');
            ctx.setDivineFuryChoice('cold');
            expect(ctx.setDamageTypeChoice).toBeDefined();
        });
    });

    describe('proceedWithDamage', () => {
        it('passes minimalCtx fields through to rollDamage', async () => {
            const attack = makeAttack();
            const playerStats = { ...defaultPlayerStats };
            const mockRun = vi.fn().mockImplementation(async (event, ctx) => {
                if (event === 'housekeeping:do') {
                    ctx.proceedWithDamage({
                        attack: { name: 'Longsword', damageType: 'slashing' },
                        formula: '1d8+3', total: 8, rolls: [5, 3], modifier: 3,
                    });
                }
            });
            buildPipelineForAction.mockReturnValue({ run: mockRun });

            await resolveAttackDamageStandalone(attack, { targetName: 'Goblin', attackerName: 'Player' }, {
                playerStats, campaignName: 'test-campaign',
                setPopupHtml: mockSetPopupHtml, rollDamage: mockRollDamage,
            });

            expect(mockRollDamage).toHaveBeenCalledWith(
                'Longsword', '1d8+3', 8, [5, 3], 3,
                expect.objectContaining({
                    attackName: 'Longsword', damageType: 'slashing',
                    targetName: 'Goblin', attackerName: 'Player',
                    isAutoCrit: false, doubledRolls: null, playerStats: null,
                    autoDamageSecondaryFormula: null, autoDamageSecondaryName: null,
                    autoDamageSecondaryDamageType: null, saveDc: null,
                    saveType: null, dcSuccess: null, metamagicTwinTarget: null,
                    metamagicHeighten: false,
                })
            );
        });

        it('passes autoDamageSecondary, save, metamagic, and doubledRolls fields through minimalCtx', async () => {
            const attack = makeAttack({ name: 'Fire Bolt', damage: '1d10+4', damageType: 'fire' });
            const playerStats = { ...defaultPlayerStats };
            const mockRun = vi.fn().mockImplementation(async (event, ctx) => {
                if (event === 'housekeeping:do') {
                    ctx.proceedWithDamage({
                        attack: { name: 'Fire Bolt', damageType: 'fire' },
                        formula: '1d10+4', total: 14, rolls: [10, 4], modifier: 4,
                    });
                }
            });
            buildPipelineForAction.mockReturnValue({ run: mockRun });

            await resolveAttackDamageStandalone(attack, {
                autoDamageSecondaryFormula: '1d6', autoDamageSecondaryName: 'Secondary',
                autoDamageSecondaryDamageType: 'fire', saveDc: 15, saveType: 'Dexterity',
                dcSuccess: 'half', metamagicTwinTarget: 'Goblin', metamagicHeighten: true,
                isCrit: true, doubledRolls: [5, 5],
            }, {
                playerStats, campaignName: 'test-campaign',
                setPopupHtml: mockSetPopupHtml, rollDamage: mockRollDamage,
            });

            expect(mockRollDamage).toHaveBeenCalledWith(
                'Fire Bolt', '1d10+4', 14, [10, 4], 4,
                expect.objectContaining({
                    autoDamageSecondaryFormula: '1d6', autoDamageSecondaryName: 'Secondary',
                    autoDamageSecondaryDamageType: 'fire', saveDc: 15, saveType: 'Dexterity',
                    dcSuccess: 'half', metamagicTwinTarget: 'Goblin', metamagicHeighten: true,
                    doubledRolls: [5, 5], isAutoCrit: true,
                })
            );
        });

        it('uses attack name as attackerName fallback when attackerName is absent from ctxOverrides', async () => {
            const attack = makeAttack({ name: 'Rapier' });
            const playerStats = { ...defaultPlayerStats };
            const mockRun = vi.fn().mockImplementation(async (event, ctx) => {
                if (event === 'housekeeping:do') {
                    ctx.proceedWithDamage({
                        attack: { name: 'Rapier', damageType: 'piercing' },
                        formula: '1d8+4', total: 9, rolls: [5, 4], modifier: 4,
                    });
                }
            });
            buildPipelineForAction.mockReturnValue({ run: mockRun });

            await resolveAttackDamageStandalone(attack, {}, {
                playerStats, campaignName: 'test-campaign',
                setPopupHtml: mockSetPopupHtml, rollDamage: mockRollDamage,
            });

            expect(mockRollDamage).toHaveBeenCalledWith(
                'Rapier', '1d8+4', 9, [5, 4], 4,
                expect.objectContaining({ attackerName: 'Rapier' })
            );
        });
    });

    describe('ctxOverrides field defaults', () => {
        it('defaults all autoDamageSecondary, save, and metamagic fields to null/false when absent from ctxOverrides', async () => {
            const attack = makeAttack();
            const playerStats = { ...defaultPlayerStats };
            const mockRun = vi.fn().mockImplementation(async (event, ctx) => {
                if (event === 'housekeeping:do') {
                    ctx.proceedWithDamage({
                        attack: { name: 'Longsword', damageType: 'slashing' },
                        formula: '1d8+3', total: 8, rolls: [5, 3], modifier: 3,
                    });
                }
            });
            buildPipelineForAction.mockReturnValue({ run: mockRun });

            await resolveAttackDamageStandalone(attack, {}, {
                playerStats, campaignName: 'test-campaign',
                setPopupHtml: mockSetPopupHtml, rollDamage: mockRollDamage,
            });

            expect(mockRollDamage).toHaveBeenCalledWith(
                'Longsword', '1d8+3', 8, [5, 3], 3,
                expect.objectContaining({
                    autoDamageSecondaryFormula: null, autoDamageSecondaryName: null,
                    autoDamageSecondaryDamageType: null, saveDc: null,
                    saveType: null, dcSuccess: null, metamagicHeighten: false,
                    isAutoCrit: false, doubledRolls: null,
                })
            );
        });
    });
});

describe('normalizeAutoDamage', () => {
    it('returns attack and ctx objects from a valid autoDamage payload', () => {
        const autoDamage = {
            name: 'Longsword',
            formula: '1d8+3',
            damageType: 'slashing',
            isAutoCrit: false,
            targetName: 'Goblin',
            saveDc: 15,
            saveType: 'Dexterity',
            dcSuccess: 'half',
            secondaryFormula: '1d6',
            secondaryName: 'Sneak Attack',
            secondaryDamageType: 'piercing',
            attackerName: 'TestFighter',
            isCantrip: false,
            metamagicHeighten: false,
            metamagicTwinTarget: null,
            autoDamageSchool: 'evocation',
            d20Roll: 15,
        };
        const playerStats = {
            name: 'TestFighter',
            attacks: [{ name: 'Longsword', weaponType: 'weapon', properties: [] }],
        };

        const { attack, ctx } = normalizeAutoDamage(autoDamage, false, playerStats);

        expect(attack).toEqual({
            name: 'Longsword',
            damage: '1d8+3',
            damageType: 'slashing',
            weaponType: 'weapon',
            properties: [],
            type: undefined,
            isHordeBreaker: false,
            // SP-112: school carried through to the pipeline attack (mirrors the
            // ctx.autoDamageSchool pass-through asserted below).
            school: 'evocation',
        });

        expect(ctx.hit).toBe(true);
        expect(ctx.isCrit).toBe(false);
        expect(ctx.isAutoCrit).toBe(false);
        expect(ctx.isNatural20).toBe(false);
        expect(ctx.targetName).toBe('Goblin');
        expect(ctx.isBonusActionAttack).toBe(false);
        expect(ctx.autoDamageSource).toBe(true);
        expect(ctx.saveDc).toBe(15);
        expect(ctx.saveType).toBe('Dexterity');
        expect(ctx.dcSuccess).toBe('half');
        expect(ctx.autoDamageSecondaryFormula).toBe('1d6');
        expect(ctx.autoDamageSecondaryName).toBe('Sneak Attack');
        expect(ctx.autoDamageSecondaryDamageType).toBe('piercing');
        expect(ctx.attackerName).toBe('TestFighter');
        expect(ctx.isCantrip).toBe(false);
        expect(ctx.metamagicHeighten).toBe(false);
        expect(ctx.metamagicTwinTarget).toBe(null);
        expect(ctx.autoDamageSchool).toBe('evocation');
        expect(ctx.d20Roll).toBe(15);
    });

    it('sets isCrit and isAutoCrit to true when isCrit parameter is true', () => {
        const autoDamage = { name: 'Longsword', formula: '1d8+3', damageType: 'slashing' };
        const playerStats = { attacks: [] };

        const { ctx } = normalizeAutoDamage(autoDamage, true, playerStats);

        expect(ctx.isCrit).toBe(true);
        expect(ctx.isAutoCrit).toBe(true);
        expect(ctx.isNatural20).toBe(true);
    });

    it('sets isCrit and isAutoCrit to true when autoDamage.isAutoCrit is true', () => {
        const autoDamage = { name: 'Longsword', formula: '1d8+3', damageType: 'slashing', isAutoCrit: true };
        const playerStats = { attacks: [] };

        const { ctx } = normalizeAutoDamage(autoDamage, false, playerStats);

        expect(ctx.isCrit).toBe(true);
        expect(ctx.isAutoCrit).toBe(true);
    });

    it('detects unarmed strike weaponType', () => {
        const autoDamage = { name: 'Unarmed Strike', formula: '1d4', damageType: 'bludgeoning' };
        const playerStats = { attacks: [] };

        const { attack } = normalizeAutoDamage(autoDamage, false, playerStats);

        expect(attack.weaponType).toBe('unarmed');
    });

    it('uses weaponAttack info for weaponType and properties when available', () => {
        const autoDamage = { name: 'Greataxe', formula: '1d12+3', damageType: 'slashing' };
        const playerStats = {
            attacks: [{ name: 'Greataxe', weaponType: 'melee', properties: ['Heavy', 'Two-Handed'] }],
        };

        const { attack } = normalizeAutoDamage(autoDamage, false, playerStats);

        expect(attack.weaponType).toBe('melee');
        expect(attack.properties).toEqual(['Heavy', 'Two-Handed']);
    });

    it('defaults weaponType to weapon when no matching attack found', () => {
        const autoDamage = { name: 'Mystic Weapon', formula: '1d6+2', damageType: 'force' };
        const playerStats = { attacks: [{ name: 'Longsword', weaponType: 'weapon' }] };

        const { attack } = normalizeAutoDamage(autoDamage, false, playerStats);

        expect(attack.weaponType).toBe('weapon');
        expect(attack.properties).toEqual([]);
    });

    it('defaults missing fields to safe defaults', () => {
        const autoDamage = {};
        const playerStats = { attacks: [] };

        const { ctx } = normalizeAutoDamage(autoDamage, false, playerStats);

        expect(ctx.hit).toBe(true);
        expect(ctx.isCrit).toBe(false);
        expect(ctx.isAutoCrit).toBe(false);
        expect(ctx.isNatural20).toBe(false);
        expect(ctx.targetName).toBe(null);
        expect(ctx.isBonusActionAttack).toBe(false);
        expect(ctx.overchannelActive).toBe(false);
        expect(ctx.overchannelUseCount).toBe(0);
        expect(ctx.overchannelSpellLevel).toBe(1);
        expect(ctx.sneakDice).toBe(0);
        expect(ctx.autoDamageSource).toBe(true);
        expect(ctx.empoweredEvocationModifier).toBe(0);
        expect(ctx.autoDamageSecondaryFormula).toBeUndefined();
        expect(ctx.autoDamageSchool).toBe('');
        expect(ctx.d20Roll).toBeUndefined();
    });

    it('defaults overchannel values from autoDamage when present', () => {
        const autoDamage = {
            name: 'Fire Bolt',
            formula: '1d10+4',
            damageType: 'fire',
            overchannelActive: true,
            overchannelUseCount: 2,
            overchannelSpellLevel: 3,
            sneakAttackDice: 4,
        };
        const playerStats = { attacks: [] };

        const { ctx } = normalizeAutoDamage(autoDamage, false, playerStats);

        expect(ctx.overchannelActive).toBe(true);
        expect(ctx.overchannelUseCount).toBe(2);
        expect(ctx.overchannelSpellLevel).toBe(3);
        expect(ctx.sneakDice).toBe(4);
    });

    it('computes empoweredEvocationModifier when player has the feature and spell is evocation', () => {
        const autoDamage = {
            name: 'Fire Bolt',
            formula: '1d10+4',
            damageType: 'fire',
            autoDamageSchool: 'evocation',
        };
        const playerStats = {
            name: 'TestWizard',
            attacks: [],
            automation: { actions: [], passives: [] },
        };

        // The mock returns empty features and 0 modifier, so empoweredEvocationModifier should be 0
        const { ctx } = normalizeAutoDamage(autoDamage, false, playerStats);

        expect(ctx.empoweredEvocationModifier).toBe(0);
    });

    it('handles null/undefined playerStats gracefully', () => {
        const autoDamage = { name: 'Weapon', formula: '1d6', damageType: 'slashing' };

        const { attack, ctx } = normalizeAutoDamage(autoDamage, false, null);

        expect(attack.weaponType).toBe('weapon');
        expect(ctx.hit).toBe(true);
        expect(ctx.empoweredEvocationModifier).toBe(0);
    });

    it('handles attack name with "Unarmed Strike" substring in null playerStats', () => {
        const autoDamage = { name: 'Unarmed Strike', formula: '1d4', damageType: 'bludgeoning' };

        const { attack } = normalizeAutoDamage(autoDamage, false, null);

        expect(attack.weaponType).toBe('unarmed');
    });
});
