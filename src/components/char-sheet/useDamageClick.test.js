import { describe, it, expect, vi, beforeEach } from 'vitest';
import useDamageClick from './useDamageClick.js';

vi.mock('../../services/dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
    rollExpressionDoubled: vi.fn(),
}));

vi.mock('../../services/rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
    getTargetFromAttacker: vi.fn(),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
    getCurrentCombatRound: vi.fn(() => 1),
    loadCombatSummary: vi.fn(),
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../services/automation/common/buffToggle.js', () => ({
    getActiveBuffs: vi.fn(),
}));

vi.mock('../../services/combat/automation/automationService.js', () => ({
    collectWeaponMastery: vi.fn(),
    evaluateAutoExpression: vi.fn(),
    hasTwoWeaponFighting: vi.fn(),
}));

vi.mock('../../services/rules/combat/applyDamage.js', () => ({
    applyDamageToTarget: vi.fn(),
}));

vi.mock('../../services/rules/core/attackCalc.js', () => ({
    parseMagicItemName: vi.fn((name) => ({ baseName: name })),
}));

vi.mock('../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

import { rollExpression, rollExpressionDoubled } from '../../services/dice/diceRoller.js';
import { getCombatContext } from '../../services/rules/combat/damageUtils.js';
import { getCurrentCombatRound } from '../../services/encounters/combatData.js';
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { getActiveBuffs } from '../../services/automation/common/buffToggle.js';
import { collectWeaponMastery, hasTwoWeaponFighting } from '../../services/combat/automation/automationService.js';
import { addEntry } from '../../services/ui/logService.js';

describe('useDamageClick', () => {
    const mockPlayerStats = {
        name: 'TestFighter',
        level: 5,
        abilities: [{ name: 'Strength', bonus: 3 }, { name: 'Dexterity', bonus: 2 }],
        proficiency: 3,
        class: { name: 'Barbarian', class_levels: [{ level: 5, rage_damage: 2 }] },
        automation: { actions: [], passives: [] },
    };

    const mockCampaignName = 'test-campaign';

    const mockSetPopupHtml = vi.fn();
    const mockRollDamage = vi.fn();
    const mockBuildCtx = vi.fn(() => Promise.resolve({ targetName: 'Goblin' }));
    const mockBuildCtxSync = vi.fn(() => Promise.resolve({ targetName: 'Goblin' }));
    const mockSetDamageTypeChoice = vi.fn();
    const mockSetDivineFuryChoice = vi.fn();
    const mockSetWeaponMasteryModal = vi.fn();
    const mockSetAttackRiderModal = vi.fn();
    const mockPendingDamageRef = { current: null };

    let deps = {
        playerStats: mockPlayerStats,
        campaignName: mockCampaignName,
        mapName: null,
        popupHtml: null,
        setPopupHtml: mockSetPopupHtml,
        rollDamage: mockRollDamage,
        buildCtx: mockBuildCtx,
        buildCtxSync: mockBuildCtxSync,
        setDamageTypeChoice: mockSetDamageTypeChoice,
        setDivineFuryChoice: mockSetDivineFuryChoice,
        setWeaponMasteryModal: mockSetWeaponMasteryModal,
        setAttackRiderModal: mockSetAttackRiderModal,
        pendingDamageRef: mockPendingDamageRef,
    };

    function UseDamageClick() {
        return useDamageClick(deps);
    }

    beforeEach(() => {
        vi.clearAllMocks();
        rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0 });
        rollExpressionDoubled.mockReturnValue({ total: 10, rolls: [5, 5], modifier: 0 });
        getRuntimeValue.mockReturnValue(null);
        setRuntimeValue.mockReturnValue(undefined);
        getActiveBuffs.mockReturnValue([]);
        hasTwoWeaponFighting.mockReturnValue(false);
        collectWeaponMastery.mockReturnValue({ baseMastery: null, extraMasteries: [] });
        addEntry.mockResolvedValue(undefined);
        getCombatContext.mockResolvedValue(null);
        getCurrentCombatRound.mockReturnValue(1);
        mockBuildCtx.mockReturnValue(Promise.resolve({ targetName: 'Goblin' }));
        mockBuildCtxSync.mockReturnValue(Promise.resolve({ targetName: 'Goblin' }));
    });

    async function tick() {
        await new Promise(r => setTimeout(r, 0));
    }

    describe('basic damage click', () => {
        it('calls rollDamage with correct arguments for non-crit', async () => {
            const { handleDamageClick } = UseDamageClick();
            const attack = { name: 'Longsword', damage: '1d8+3', damageType: 'slashing', properties: [] };

            await handleDamageClick(attack);
            await tick();

            expect(rollExpression).toHaveBeenCalledWith('1d8+3');
            expect(mockRollDamage).toHaveBeenCalledWith(
                'Longsword',
                '1d8+3',
                expect.any(Number),
                expect.any(Array),
                expect.any(Number),
                expect.any(Object)
            );
        });

        it('calls rollDamageDoubled when popupHtml.isCrit is true', async () => {
            deps = { ...deps, popupHtml: { isCrit: true } };
            const { handleDamageClick } = useDamageClick(deps);
            const attack = { name: 'Longsword', damage: '1d8+3', damageType: 'slashing', properties: [] };

            await handleDamageClick(attack);
            await tick();

            expect(rollExpressionDoubled).toHaveBeenCalledWith('1d8+3');
        });

        it('clears popupHtml on crit', async () => {
            deps = { ...deps, popupHtml: { isCrit: true, isNatural20: true } };
            const { handleDamageClick } = useDamageClick(deps);
            const attack = { name: 'Longsword', damage: '1d8+3', damageType: 'slashing', properties: [] };

            await handleDamageClick(attack);
            await tick();

            expect(mockSetPopupHtml).toHaveBeenCalledWith(null);
        });

        it('returns early when rollExpression returns null', async () => {
            deps = { ...deps, popupHtml: null };
            rollExpression.mockReturnValue(null);
            const { handleDamageClick } = useDamageClick(deps);
            const attack = { name: 'Longsword', damage: '1d8+3', damageType: 'slashing', properties: [] };

            await handleDamageClick(attack);

            expect(mockRollDamage).not.toHaveBeenCalled();
        });
    });

    describe('two weapon fighting', () => {
        it('adds ability modifier to bonus action light weapon damage', async () => {
            hasTwoWeaponFighting.mockReturnValue(true);
            const { handleDamageClick } = UseDamageClick();
            const attack = {
                name: 'Handaxe',
                damage: '1d6',
                damageType: 'slashing',
                type: 'Bonus Action',
                properties: ['Light'],
                abilityName: 'Strength',
            };

            await handleDamageClick(attack);
            await tick();

            expect(mockRollDamage).toHaveBeenCalledWith(
                'Handaxe',
                expect.stringContaining('+ 3[Strength]'),
                expect.any(Number),
                expect.any(Array),
                expect.any(Number),
                expect.any(Object)
            );
        });

        it('does not add ability modifier for non-light weapons', async () => {
            const { handleDamageClick } = UseDamageClick();
            const attack = {
                name: 'Warhammer',
                damage: '1d8',
                damageType: 'bludgeoning',
                type: 'Bonus Action',
                properties: [],
                abilityName: 'Strength',
            };

            await handleDamageClick(attack);
            await tick();

            expect(mockRollDamage).toHaveBeenCalledWith(
                'Warhammer',
                '1d8',
                expect.any(Number),
                expect.any(Array),
                expect.any(Number),
                expect.any(Object)
            );
        });

        it('does not add ability modifier when abilityMod is 0', async () => {
            hasTwoWeaponFighting.mockReturnValue(true);
            const stats = { ...mockPlayerStats, abilities: [{ name: 'Strength', bonus: 0 }] };
            const hookDeps = { ...deps, playerStats: stats };
            const { handleDamageClick } = useDamageClick(hookDeps);
            const attack = {
                name: 'Handaxe',
                damage: '1d6',
                damageType: 'slashing',
                type: 'Bonus Action',
                properties: ['Light'],
                abilityName: 'Strength',
            };

            await handleDamageClick(attack);
            await tick();

            expect(mockRollDamage).toHaveBeenCalledWith(
                'Handaxe',
                '1d6',
                expect.any(Number),
                expect.any(Array),
                expect.any(Number),
                expect.any(Object)
            );
        });
    });

    describe('rider damage effects', () => {
        it('applies damage_bonus targetEffects', async () => {
            getRuntimeValue.mockReturnValueOnce([{ effect: 'damage_bonus', damageExpression: '1d4', damageType: 'fire' }]);
            rollExpression.mockReturnValueOnce({ total: 4, rolls: [4], modifier: 0 });
            const { handleDamageClick } = UseDamageClick();
            const attack = { name: 'Longsword', damage: '1d8', damageType: 'slashing', properties: [] };

            await handleDamageClick(attack);
            await tick();

            expect(mockRollDamage).toHaveBeenCalledWith(
                'Longsword',
                expect.stringContaining('1d4'),
                expect.any(Number),
                expect.any(Array),
                expect.any(Number),
                expect.any(Object)
            );
        });

        it('does not apply rider effects when getRuntimeValue returns null', async () => {
            const { handleDamageClick } = UseDamageClick();
            const attack = { name: 'Longsword', damage: '1d8', damageType: 'slashing', properties: [] };

            await handleDamageClick(attack);
            await tick();

            expect(mockRollDamage).toHaveBeenCalledWith(
                'Longsword',
                '1d8',
                expect.any(Number),
                expect.any(Array),
                expect.any(Number),
                expect.any(Object)
            );
        });
    });

    describe('sudden strike handling', () => {
        it('clears pendingSuddenStrike for bonus action attacks', async () => {
            getRuntimeValue.mockReturnValueOnce(true);
            const { handleDamageClick } = UseDamageClick();
            const attack = {
                name: 'Sudden Strike',
                damage: '1d6',
                damageType: 'psychic',
                type: 'Bonus Action',
                properties: [],
            };

            await handleDamageClick(attack);
            await tick();

            expect(setRuntimeValue).toHaveBeenCalledWith('TestFighter', 'pendingSuddenStrike', null, 'test-campaign');
        });

        it('does not clear pendingSuddenStrike for non-bonus action attacks', async () => {
            const { handleDamageClick } = UseDamageClick();
            const attack = {
                name: 'Longsword',
                damage: '1d8',
                damageType: 'slashing',
                type: 'Action',
                properties: [],
            };

            await handleDamageClick(attack);
            await tick();

            expect(setRuntimeValue).not.toHaveBeenCalledWith('TestFighter', 'pendingSuddenStrike', null, 'test-campaign');
        });
    });

    describe('horde breaker handling', () => {
        it('marks horde breaker as used for this round', async () => {
            getRuntimeValue.mockReturnValueOnce(null).mockReturnValueOnce('Horde Breaker');
            const { handleDamageClick } = UseDamageClick();
            const attack = {
                name: 'Horde Breaker',
                damage: '1d6',
                damageType: 'force',
                type: 'Bonus Action',
                properties: [],
            };

            await handleDamageClick(attack);
            await tick();

            expect(setRuntimeValue).toHaveBeenCalledWith('TestFighter', "_Hunters_Prey_HordeBreaker_UsedRound", 1, 'test-campaign');
        });

        it('does not mark horde breaker when hunter prey choice is different', async () => {
            getRuntimeValue.mockReturnValueOnce(null).mockReturnValueOnce('Colossus Slayer');
            const { handleDamageClick } = UseDamageClick();
            const attack = {
                name: 'Horde Breaker',
                damage: '1d6',
                damageType: 'force',
                type: 'Bonus Action',
                properties: [],
            };

            await handleDamageClick(attack);
            await tick();

            expect(setRuntimeValue).not.toHaveBeenCalledWith('TestFighter', '_Hunters_Prey_HordeBreaker_UsedRound', expect.any(Number), 'test-campaign');
        });
    });

    describe('map name handling', () => {
        it('uses buildCtx when mapName is truthy', async () => {
            const mapDeps = { ...deps, mapName: 'test-map' };
            const { handleDamageClick } = useDamageClick(mapDeps);
            const attack = { name: 'Fire Bolt', damage: '1d10', damageType: 'fire', properties: [] };

            await handleDamageClick(attack);
            await tick();

            expect(mockBuildCtx).toHaveBeenCalled();
        });

        it('uses buildCtxSync when mapName is falsy', async () => {
            const { handleDamageClick } = UseDamageClick();
            const attack = { name: 'Longsword', damage: '1d8', damageType: 'slashing', properties: [] };

            await handleDamageClick(attack);
            await tick();

            expect(mockBuildCtxSync).toHaveBeenCalled();
        });
    });

    describe('weapon mastery modal', () => {
        it('opens weapon mastery modal when melee attack has mastery', async () => {
            collectWeaponMastery.mockReturnValue({ baseMastery: { name: 'Mercy' }, extraMasteries: [] });
            const { handleDamageClick } = UseDamageClick();
            const attack = {
                name: 'Longsword',
                damage: '1d8+3',
                damageType: 'slashing',
                weaponType: 'melee',
                properties: [],
            };

            await handleDamageClick(attack);
            await tick();

            expect(mockSetWeaponMasteryModal).toHaveBeenCalledWith({
                attackName: 'Longsword',
                baseMastery: { name: 'Mercy' },
                extraMasteries: [],
            });
            expect(mockPendingDamageRef.current).toEqual(expect.objectContaining({
                attack,
                formula: '1d8+3',
            }));
        });

        it('does not open modal for ranged attacks', async () => {
            collectWeaponMastery.mockReturnValue({ baseMastery: { name: 'Mercy' }, extraMasteries: [] });
            const { handleDamageClick } = UseDamageClick();
            const attack = {
                name: 'Longbow',
                damage: '1d8+3',
                damageType: 'piercing',
                weaponType: 'ranged',
                properties: [],
            };

            await handleDamageClick(attack);
            await tick();

            expect(mockSetWeaponMasteryModal).not.toHaveBeenCalled();
        });
    });

    describe('sacred weapon damage type', () => {
        it('applies damageTypeChoice from sacred weapon buff', async () => {
            getRuntimeValue.mockReturnValueOnce([{ name: 'Sacred Weapon', effect: 'sacred_weapon', damageTypeChoice: 'radiant' }]);
            const { handleDamageClick } = UseDamageClick();
            const attack = {
                name: 'Longsword',
                damage: '1d8+3',
                damageType: 'slashing',
                weaponType: 'melee',
                properties: [],
            };

            await handleDamageClick(attack);
            await tick();

            expect(mockRollDamage).toHaveBeenCalled();
        });
    });
});
