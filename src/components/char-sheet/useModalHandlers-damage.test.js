// @maintained-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import useModalHandlers from './useModalHandlers.js';

// Services the damage lane calls directly — controllable, deterministic values.
vi.mock('../../services/dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
    getCurrentCombatRound: vi.fn(),
    // Hook destructures this at module load for the flurry lane (not exercised here).
    getCombatSummary: vi.fn(),
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    setRuntimeValue: vi.fn(),
    // Imported by live-graph savePrompt.js / openHandTechniqueHandler.js (never called here).
    getRuntimeValue: vi.fn(),
}));

// Non-damage deps imported at module level by useModalHandlers.js — or reached through the
// live openHandTechniqueHandler/conditionSaveService registry chain. Runtime-probed: removing
// these mocks (or the `handle`/`getTargetFromAttacker` keys) fails at import or via the
// feature registry, so each supplied name is load-required even though the damage lane
// never calls them.
vi.mock('../../services/rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
    // Imported by live-graph openHandTechniqueHandler.js (lazy binding, never called here).
    getTargetFromAttacker: vi.fn(),
}));

vi.mock('../../services/automation/handlers/class-sorcerer/starryFormHandler.js', () => ({
    applyConstellationOption: vi.fn(),
    handle: vi.fn(),
}));

vi.mock('../../services/automation/handlers/class-sorcerer/twinklingConstellationHandler.js', () => ({
    applyConstellationOption: vi.fn(),
    handle: vi.fn(),
}));

vi.mock('../../services/automation/handlers/combat/bonusAttacksHandler.js', () => ({
    applyFlurryOfBlows: vi.fn(),
    handle: vi.fn(),
}));

import { rollExpression } from '../../services/dice/diceRoller.js';
import { getCurrentCombatRound } from '../../services/encounters/combatData.js';
import { setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';

function createDeps(overrides = {}) {
    const modalState = {};
    return {
        playerStats: { name: 'TestFighter', ...overrides.playerStats },
        campaignName: 'test-campaign',
        pendingDamage: null,
        proceedWithDamage: vi.fn(),
        setPendingDamage: vi.fn(),
        setModalState: vi.fn((updates) => Object.assign(modalState, updates)),
        modalState,
        setPopupHtml: vi.fn(),
        ...overrides,
    };
}

describe('useModalHandlers - damage type handlers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getCurrentCombatRound.mockReturnValue(4);
        rollExpression.mockReturnValue({ total: 3, rolls: [3], modifier: 0 });
    });

    describe('gate refusals (no pending damage)', () => {
        it.each([
            ['handleDivineFuryDamageType', 'divineFuryChoice'],
            ['handleDivineFurySkip', 'divineFuryChoice'],
            ['handleGenericDamageTypeChoice', 'damageTypeChoice'],
            ['handleGenericDamageTypeSkip', 'damageTypeChoice'],
            ['handleDamageTypeModifierChoice', 'damageTypeChoice'],
            ['handleDamageTypeModifierSkip', 'damageTypeChoice'],
            ['handleEnhancedUnarmedChoice', 'damageTypeChoice'],
            ['handleEnhancedUnarmedSkip', 'damageTypeChoice'],
        ])('%s closes its modal but never proceeds or records anything', (handlerName, modalKey) => {
            const deps = createDeps();
            useModalHandlers(deps)[handlerName]('Radiant');
            expect(deps.setModalState).toHaveBeenCalledWith({ [modalKey]: null });
            expect(deps.proceedWithDamage).not.toHaveBeenCalled();
            expect(deps.setPendingDamage).not.toHaveBeenCalled();
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });
    });

    describe('handleDivineFuryDamageType', () => {
        it('appends the bonus dice with lowercased type, records the used round, proceeds with combined damage', () => {
            const pending = {
                attack: { name: 'Fury of the Gods' },
                formula: '2d6',
                total: 7,
                rolls: [3, 4],
                modifier: 1,
                bonusExpr: '1d6',
                bonusTotal: 3,
                bonusRolls: [3],
            };
            const deps = createDeps({ playerStats: { name: 'PaladinOne' }, pendingDamage: pending });
            useModalHandlers(deps).handleDivineFuryDamageType('Thunder');
            expect(setRuntimeValue).toHaveBeenCalledWith('PaladinOne', '_divineFuryUsedRound', 4, 'test-campaign');
            expect(deps.setModalState).toHaveBeenCalledWith({ divineFuryChoice: null });
            expect(deps.setPendingDamage).toHaveBeenCalledWith(null);
            expect(deps.proceedWithDamage).toHaveBeenCalledWith({
                attack: pending.attack,
                formula: '2d6 + 1d6 [thunder]',
                total: 10,
                rolls: [3, 4, 3],
                modifier: 1,
            });
        });
    });

    describe('handleDivineFurySkip', () => {
        it('proceeds with the untouched original damage and never records a used round', () => {
            const pending = {
                attack: { name: 'Fury of the Gods' },
                formula: '1d8+3',
                total: 10,
                rolls: [5, 5],
                modifier: 3,
                bonusExpr: '1d8',
                bonusTotal: 4,
                bonusRolls: [4],
            };
            const deps = createDeps({ pendingDamage: pending });
            useModalHandlers(deps).handleDivineFurySkip();
            expect(deps.setModalState).toHaveBeenCalledWith({ divineFuryChoice: null });
            expect(deps.setPendingDamage).toHaveBeenCalledWith(null);
            expect(deps.proceedWithDamage).toHaveBeenCalledWith({
                attack: pending.attack,
                formula: '1d8+3',
                total: 10,
                rolls: [5, 5],
                modifier: 3,
            });
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });
    });

    describe('handleGenericDamageTypeChoice', () => {
        it('appends bonus dice and spends oncePerTurnKey on the current round', () => {
            const pending = {
                attack: { name: 'Divine Strike' },
                formula: '1d8',
                total: 5,
                rolls: [5],
                modifier: 0,
                bonusExpr: '1d8',
                bonusTotal: 4,
                bonusRolls: [4],
                oncePerTurnKey: '_DivineStrike_usedRound',
            };
            const deps = createDeps({ pendingDamage: pending });
            useModalHandlers(deps).handleGenericDamageTypeChoice('Thunder');
            expect(setRuntimeValue).toHaveBeenCalledWith('TestFighter', '_DivineStrike_usedRound', 4, 'test-campaign');
            expect(deps.setModalState).toHaveBeenCalledWith({ damageTypeChoice: null });
            expect(deps.setPendingDamage).toHaveBeenCalledWith(null);
            expect(deps.proceedWithDamage).toHaveBeenCalledWith({
                attack: pending.attack,
                formula: '1d8 + 1d8 [thunder]',
                total: 9,
                rolls: [5, 4],
                modifier: 0,
            });
        });

        it('still applies combined damage but spends nothing when oncePerTurnKey is absent', () => {
            const pending = {
                attack: { name: 'Extra Damage' },
                formula: '1d6',
                total: 5,
                rolls: [5],
                modifier: 0,
                bonusExpr: '1d6',
                bonusTotal: 3,
                bonusRolls: [3],
            };
            const deps = createDeps({ pendingDamage: pending });
            useModalHandlers(deps).handleGenericDamageTypeChoice('Fire');
            expect(deps.proceedWithDamage).toHaveBeenCalledWith({
                attack: pending.attack,
                formula: '1d6 + 1d6 [fire]',
                total: 8,
                rolls: [5, 3],
                modifier: 0,
            });
            expect(deps.setPendingDamage).toHaveBeenCalledWith(null);
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });
    });

    describe('handleGenericDamageTypeSkip', () => {
        it('proceeds with the untouched original damage and never records anything', () => {
            const pending = {
                attack: { name: 'Extra Damage' },
                formula: '1d6',
                total: 5,
                rolls: [5],
                modifier: 0,
            };
            const deps = createDeps({ pendingDamage: pending });
            useModalHandlers(deps).handleGenericDamageTypeSkip();
            expect(deps.setModalState).toHaveBeenCalledWith({ damageTypeChoice: null });
            expect(deps.setPendingDamage).toHaveBeenCalledWith(null);
            expect(deps.proceedWithDamage).toHaveBeenCalledWith({
                attack: pending.attack,
                formula: '1d6',
                total: 5,
                rolls: [5],
                modifier: 0,
            });
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });
    });

    describe('handleDamageTypeModifierChoice', () => {
        it('rewrites only the first formula annotation, mutates attack.damageType, and spends the derived runtime key', () => {
            const pending = {
                attack: { name: 'Unarmed Strike', damageType: 'bludgeoning' },
                formula: '1d12+3 [bludgeoning] + 3d6 [fire]',
                total: 31,
                rolls: [31],
                modifier: 3,
                _damageTypeModifier: { name: 'Empowered Strikes' },
            };
            const deps = createDeps({ pendingDamage: pending });
            useModalHandlers(deps).handleDamageTypeModifierChoice('Radiant');
            expect(pending.attack.damageType).toBe('radiant');
            expect(setRuntimeValue).toHaveBeenCalledWith('TestFighter', '_Empowered_Strikes_usedRound', 4, 'test-campaign');
            expect(deps.setModalState).toHaveBeenCalledWith({ damageTypeChoice: null });
            expect(deps.setPendingDamage).toHaveBeenCalledWith(null);
            expect(deps.proceedWithDamage).toHaveBeenCalledWith({
                attack: pending.attack,
                formula: '1d12+3 [radiant] + 3d6 [fire]',
                total: 31,
                rolls: [31],
                modifier: 3,
            });
        });

        it('without _damageTypeModifier leaves damageType untouched and spends nothing', () => {
            const pending = {
                attack: { name: 'Some Attack', damageType: 'fire' },
                formula: '2d6+3',
                total: 9,
                rolls: [6, 3],
                modifier: 3,
            };
            const deps = createDeps({ pendingDamage: pending });
            useModalHandlers(deps).handleDamageTypeModifierChoice('cold');
            expect(pending.attack.damageType).toBe('fire');
            expect(deps.setPendingDamage).toHaveBeenCalledWith(null);
            expect(deps.proceedWithDamage).toHaveBeenCalledWith({
                attack: pending.attack,
                formula: '2d6+3',
                total: 9,
                rolls: [6, 3],
                modifier: 3,
            });
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });
    });

    describe('handleDamageTypeModifierSkip', () => {
        it('spends the derived runtime key but leaves damage type and formula untouched', () => {
            const pending = {
                attack: { name: 'Empowered Strikes', damageType: 'slashing' },
                formula: '1d8 [slashing]',
                total: 5,
                rolls: [5],
                modifier: 0,
                _damageTypeModifier: { name: 'Empowered Strikes' },
            };
            const deps = createDeps({ pendingDamage: pending });
            useModalHandlers(deps).handleDamageTypeModifierSkip();
            expect(pending.attack.damageType).toBe('slashing');
            expect(setRuntimeValue).toHaveBeenCalledWith('TestFighter', '_Empowered_Strikes_usedRound', 4, 'test-campaign');
            expect(deps.setModalState).toHaveBeenCalledWith({ damageTypeChoice: null });
            expect(deps.setPendingDamage).toHaveBeenCalledWith(null);
            expect(deps.proceedWithDamage).toHaveBeenCalledWith({
                attack: pending.attack,
                formula: '1d8 [slashing]',
                total: 5,
                rolls: [5],
                modifier: 0,
            });
        });

        it('without _damageTypeModifier proceeds without any runtime spend', () => {
            const pending = {
                attack: { name: 'Some Attack', damageType: 'fire' },
                formula: '1d8',
                total: 5,
                rolls: [5],
                modifier: 0,
            };
            const deps = createDeps({ pendingDamage: pending });
            useModalHandlers(deps).handleDamageTypeModifierSkip();
            expect(deps.proceedWithDamage).toHaveBeenCalledWith({
                attack: pending.attack,
                formula: '1d8',
                total: 5,
                rolls: [5],
                modifier: 0,
            });
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });
    });

    describe('handleEnhancedUnarmedChoice', () => {
        it.each([
            ['annotates the option damageType', 'force', '1d4 + 1d4 [force]'],
            ['falls back to same_as_weapon when option omits damageType', undefined, '1d4 + 1d4 [same_as_weapon]'],
        ])('rolls the damage_bonus rider and merges it — %s', (_label, damageType, expectedFormula) => {
            const pending = {
                attack: { name: 'Unarmed Strike' },
                formula: '1d4',
                total: 5,
                rolls: [5],
                rider: 'rider-ctx',
                _attackRider: {
                    name: 'Unarmed Fighting',
                    options: [{ name: 'Damage Bonus', effect: 'damage_bonus', damageExpression: '1d4', damageType }],
                },
            };
            const deps = createDeps({ pendingDamage: pending });
            useModalHandlers(deps).handleEnhancedUnarmedChoice('Damage Bonus');
            expect(rollExpression).toHaveBeenCalledWith('1d4');
            expect(setRuntimeValue).toHaveBeenCalledWith('TestFighter', '_Unarmed_Fighting_usedRound', 4, 'test-campaign');
            expect(deps.setModalState).toHaveBeenCalledWith({ damageTypeChoice: null });
            expect(deps.setPendingDamage).toHaveBeenCalledWith(null);
            expect(deps.proceedWithDamage).toHaveBeenCalledWith({
                attack: pending.attack,
                formula: expectedFormula,
                total: 8,
                rolls: [5, 3],
                modifier: 'rider-ctx',
            });
        });

        it.each([
            ['no _attackRider on pending', null, 'Damage Bonus', undefined],
            ['chosen option not found', { name: 'Unarmed Fighting', options: [{ name: 'Other Option', effect: 'other' }] }, 'Nonexistent Option', undefined],
            ['option exists but effect is not damage_bonus', { name: 'Unarmed Fighting', options: [{ name: 'Other Option', effect: 'other' }] }, 'Other Option', undefined],
            ['rollExpression returns null', { name: 'Unarmed Fighting', options: [{ name: 'Damage Bonus', effect: 'damage_bonus', damageExpression: '1d4', damageType: 'force' }] }, 'Damage Bonus', null],
        ])('falls back to the original unmodified payload when %s', (_label, rider, chosen, rollResult) => {
            const pending = {
                attack: { name: 'Unarmed Strike' },
                formula: '1d4',
                total: 5,
                rolls: [5],
                rider: 'rider-ctx',
                _attackRider: rider,
            };
            if (rollResult === null) {
                rollExpression.mockReturnValue(null);
            }
            const deps = createDeps({ pendingDamage: pending });
            useModalHandlers(deps).handleEnhancedUnarmedChoice(chosen);
            expect(deps.setModalState).toHaveBeenCalledWith({ damageTypeChoice: null });
            expect(deps.setPendingDamage).toHaveBeenCalledWith(null);
            expect(deps.proceedWithDamage).toHaveBeenCalledWith({
                attack: pending.attack,
                formula: '1d4',
                total: 5,
                rolls: [5],
                modifier: 'rider-ctx',
            });
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });
    });

    describe('handleEnhancedUnarmedSkip', () => {
        it('spends the rider runtime key and passes the original payload through with its rider modifier', () => {
            const pending = {
                attack: { name: 'Unarmed Strike' },
                formula: '1d4',
                total: 5,
                rolls: [5],
                rider: 'rider-ctx',
                _attackRider: { name: 'Unarmed Fighting' },
            };
            const deps = createDeps({ pendingDamage: pending });
            useModalHandlers(deps).handleEnhancedUnarmedSkip();
            expect(setRuntimeValue).toHaveBeenCalledWith('TestFighter', '_Unarmed_Fighting_usedRound', 4, 'test-campaign');
            expect(deps.setModalState).toHaveBeenCalledWith({ damageTypeChoice: null });
            expect(deps.setPendingDamage).toHaveBeenCalledWith(null);
            expect(deps.proceedWithDamage).toHaveBeenCalledWith({
                attack: pending.attack,
                formula: '1d4',
                total: 5,
                rolls: [5],
                modifier: 'rider-ctx',
            });
        });

        it('without _attackRider proceeds without any runtime spend', () => {
            const pending = {
                attack: { name: 'Unarmed Strike' },
                formula: '1d4',
                total: 5,
                rolls: [5],
                rider: 'no-rider',
            };
            const deps = createDeps({ pendingDamage: pending });
            useModalHandlers(deps).handleEnhancedUnarmedSkip();
            expect(deps.proceedWithDamage).toHaveBeenCalledWith({
                attack: pending.attack,
                formula: '1d4',
                total: 5,
                rolls: [5],
                modifier: 'no-rider',
            });
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });
    });
});
