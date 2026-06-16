import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handle } from './autoRerollHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { getLastAttackRoll, getLastAbilityCheck, getLastSaveRoll } from '../../../../hooks/useMetamagic.js';
import { automationInfoPopup } from '../../../shared/popupResponse.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { getDistanceFeet, rangeToFeet } from '../../../rules/combat/rangeValidation.js';
import { resolveMapPositions } from '../../common/targetResolver.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../../hooks/useMetamagic.js', () => ({
    getLastAttackRoll: vi.fn(),
    getLastAbilityCheck: vi.fn(),
}));

vi.mock('../../../shared/popupResponse.js', () => ({
    automationInfoPopup: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
}));

vi.mock('../../../rules/combat/rangeValidation.js', () => ({
    getDistanceFeet: vi.fn(),
    rangeToFeet: vi.fn(),
}));

vi.mock('../../common/targetResolver.js', () => ({
    resolveMapPositions: vi.fn(),
}));

vi.mock('../../../../services/encounters/combatData.js', () => ({
    getCurrentCombatRound: vi.fn(() => 1),
}));

vi.mock('../../../../hooks/useMetamagic.js', () => ({
    getLastAttackRoll: vi.fn(),
    getLastAbilityCheck: vi.fn(),
    getLastSaveRoll: vi.fn(),
}));

describe('autoRerollHandler.handle', () => {
    let playerStats;
    const campaignName = 'TestCampaign';
    const mapName = 'TestMap';

    beforeEach(() => {
        vi.clearAllMocks();

        getLastAttackRoll.mockReturnValue(null);
        getLastAbilityCheck.mockReturnValue(null);
        getLastSaveRoll.mockReturnValue(null);
        getRuntimeValue.mockReturnValue(undefined);

        playerStats = {
            name: 'Player',
            level: 2,
            proficiency: 2,
            class: {
                class_levels: [
                    { level: 1, bardic_die: 4, bardic_inspiration_uses: 2 },
                    { level: 2, bardic_die: 4, bardic_inspiration_uses: 2 },
                ]
            }
        };

        automationInfoPopup.mockImplementation((a) => ({ type: 'popup', payload: { name: a.name } }));
    });

    describe('Bardic Inspiration Path', () => {
        let bardAction;
        beforeEach(() => {
            bardAction = {
                name: 'Bardic Reroll',
                automation: { bonusExpression: 'bardic_inspiration_die' }
            };
        });

        it('should return popup when uses are exhausted', async () => {
            getRuntimeValue.mockReturnValue(0); // used 0, max is 2
            const result = await handle(bardAction, playerStats, campaignName, mapName);
            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: bardAction.name,
                    description: `${bardAction.name} has no uses remaining. Recharges on a Long Rest.`,
                    automation: bardAction.automation,
                },
            });
        });

        it('should return popup when even with uses, no recent failure is found', async () => {
            getRuntimeValue.mockReturnValue(2);
            getLastAttackRoll.mockReturnValue(null);
            getLastAbilityCheck.mockReturnValue(null);
            const result = await handle(bardAction, playerStats, campaignName, mapName);
            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: bardAction.name,
                    description: `No recent failed ability check or attack roll found. ${bardAction.name} can only be used shortly after a failure.`,
                    automation: bardAction.automation,
                },
            });
        });

        it('should apply to a fresh failed attack roll', async () => {
            getRuntimeValue.mockReturnValue(2);
            getLastAttackRoll.mockReturnValue({
                timestamp: Date.now(),
                d20: 5,
                bonus: 3,
                targetAc: 12,
                hit: false,
                effectiveAc: null
            });
            getLastAbilityCheck.mockReturnValue(null);

            const result = await handle(bardAction, playerStats, campaignName, mapName);
            
            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Bardic Reroll'); 
        });

        it('should apply to a fresh ability check', async () => {
            getRuntimeValue.mockReturnValue(2);
            getLastAttackRoll.mockReturnValue(null);
            getLastAbilityCheck.mockReturnValue({
                timestamp: Date.now(),
                d20: 10,
                bonus: 2,
                checkName: 'Athletics'
            });

            const result = await handle(bardAction, playerStats, campaignName, mapName);
            expect(result.payload.description).toContain('Athletics');
            expect(setRuntimeValue).toHaveBeenCalledWith(playerStats.name, 'bardicInspirationUses', 1, campaignName);
            expect(addEntry).toHaveBeenCalled();
        });

        it('should ignore stale failures', async () => {
            getRuntimeValue.mockReturnValue(2);
            getLastAttackRoll.mockReturnValue({ timestamp: Date.now() - 70000, hit: false });
            getLastAbilityCheck.mockReturnValue({ timestamp: Date.now() - 70000 });

            const result = await handle(bardAction, playerStats, campaignName, mapName);
            expect(result.payload.description).toContain('No recent failed ability check');
        });
    });

    describe('Fixed Bonus Path', () => {
        let bonusAction;
        beforeEach(() => {
            bonusAction = {
                name: 'Blessing',
                automation: { bonus: 2 }
            };
        });

        it('should fail if channel divinity charges are empty', async () => {
            bonusAction.automation.resourceCost = 'channel_divinity';
            getRuntimeValue.mockReturnValue(0); // stored Charges

            const result = await handle(bonusAction, playerStats, campaignName, mapName);
            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: playerStats.name,
                    description: 'No Channel Divinity charges remaining.',
                    automation: bonusAction.automation,
                },
            });
        });

        it('should consume channel divinity charge and proceed if available', async () => {
            bonusAction.automation.resourceCost = 'channel_divinity';
            getRuntimeValue.mockReturnValue(1); 
            getLastAttackRoll.mockReturnValue({ timestamp: Date.now(), hit: false, d20: 5, bonus: 3, targetAc: 15 });
            
            await handle(bonusAction, playerStats, campaignName, mapName);
            expect(setRuntimeValue).toHaveBeenCalledWith(playerStats.name, 'channelDivinityCharges', 0, campaignName);
        });

        it('should prioritize own failed attack roll over ability check', async () => {
            getLastAttackRoll.mockReturnValue({ timestamp: Date.now(), hit: false, d20: 5, bonus: 3, targetAc: 15 });
            getLastAbilityCheck.mockReturnValue({ timestamp: Date.now(), d20: 10, bonus: 2 });

            const result = await handle(bonusAction, playerStats, campaignName, mapName);
            expect(result.payload.description).toContain('Attack roll');
        });

        it('should use ability check if no failed attack exists', async () => {
            getLastAttackRoll.mockReturnValue(null);
            getLastAbilityCheck.mockReturnValue({ timestamp: Date.now(), d20: 10, bonus: 2 });

            const result = await handle(bonusAction, playerStats, campaignName, mapName);
            expect(result.payload.description).toContain('Modified');
        });

        it('should look for ally missed attack if own succeeded/missing and range is specified', async () => {
            getLastAttackRoll.mockReturnValue({ timestamp: Date.now(), hit: true }); // Own hit
            bonusAction.automation.range = '30ft';
            rangeToFeet.mockReturnValue(30);
            getCombatContext.mockResolvedValue({
                creatures: [
                    { name: 'Player' },
                    { name: 'Ally' }
                ]
            });
            getLastAttackRoll.mockImplementation((name) => {
                if (name === 'Player') return { timestamp: Date.now(), hit: true };
                if (name === 'Ally') return { timestamp: Date.now(), hit: false, d20: 5, bonus: 3, targetAc: 15 };
                return null;
            });
            resolveMapPositions.mockResolvedValue({ attackerPos: { x: 0, y: 0 }, targetPos: { x: 10, y: 0 } });
            getDistanceFeet.mockReturnValue(10);

            const result = await handle(bonusAction, playerStats, campaignName, mapName);
            expect(result.payload.description).toContain('Attacker: Ally');
        });

        it('should ignore ally if outside range', async () => {
            getLastAttackRoll.mockReturnValue({ timestamp: Date.now(), hit: true });
            bonusAction.automation.range = '30ft';
            rangeToFeet.mockReturnValue(30);
            getCombatContext.mockResolvedValue({ creatures: [{ name: 'Player' }, { name: 'Ally' }] });
            getLastAttackRoll.mockImplementation((name) => {
                if (name === 'Player') return { timestamp: Date.now(), hit: true };
                if (name === 'Ally') return { timestamp: Date.now(), hit: false, d20: 5, bonus: 3, targetAc: 15 };
                return null;
            });
            resolveMapPositions.mockResolvedValue({ attackerPos: { x: 0, y: 0 }, targetPos: { x: 60, y: 0 } });
            getDistanceFeet.mockReturnValue(60);

            const result = await handle(bonusAction, playerStats, campaignName, mapName);
            expect(result.payload.description).toContain('No recent failed attack roll or ability check found for you or any ally');
        });

        it('should return general failure popup if nothing is fresh', async () => {
            getLastAttackRoll.mockReturnValue(null);
            getLastAbilityCheck.mockReturnValue(null);
            const result = await handle(bonusAction, playerStats, campaignName, mapName);
            expect(result.payload.description).toContain('No recent failed attack roll or ability check found');
        });
    });

    describe('Default Fallback', () => {
        it('should return automationInfoPopup for an action without applicable automation', async () => {
            const action = { name: 'Simple Action', automation: {} };
            const result = await handle(action, playerStats, campaignName, mapName);
            expect(automationInfoPopup).toHaveBeenCalledWith(action);
            expect(result).toEqual({ type: 'popup', payload: { name: 'Simple Action' } });
        });
    });

    describe('convert_miss_to_hit (Fearless Aim)', () => {
        let fearlessAction;
        beforeEach(() => {
            fearlessAction = {
                name: 'Fearless Aim',
                automation: {
                    type: 'auto_reroll',
                    trigger: 'attack_roll_miss',
                    effect: 'convert_miss_to_hit',
                    oncePerTurn: true,
                    casting_time: '1 action',
                },
            };
        });

        it('should block when oncePerTurn already used this round', async () => {
            const { getCurrentCombatRound } = await import('../../../../services/encounters/combatData.js');
            getCurrentCombatRound.mockReturnValue(3);
            getRuntimeValue.mockReturnValue(3);

            const result = await handle(fearlessAction, playerStats, campaignName, mapName);

            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Fearless Aim',
                    description: 'Fearless Aim can only be used once per turn.',
                    automation: fearlessAction.automation,
                },
            });
        });

        it('should fail when no recent attack roll found', async () => {
            getRuntimeValue.mockReturnValue(undefined);
            getLastAttackRoll.mockReturnValue(null);

            const result = await handle(fearlessAction, playerStats, campaignName, mapName);

            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Fearless Aim',
                    description: 'No recent attack roll found for Player. This feature can only be used shortly after an attack roll.',
                    automation: fearlessAction.automation,
                },
            });
        });

        it('should fail when attack roll is stale', async () => {
            getRuntimeValue.mockReturnValue(undefined);
            getLastAttackRoll.mockReturnValue({ timestamp: Date.now() - 70000, hit: false, d20: 5, bonus: 3, targetAc: 15 });

            const result = await handle(fearlessAction, playerStats, campaignName, mapName);

            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Fearless Aim',
                    description: 'No recent attack roll found for Player. This feature can only be used shortly after an attack roll.',
                    automation: fearlessAction.automation,
                },
            });
        });

        it('should fail when last attack already hit', async () => {
            getRuntimeValue.mockReturnValue(undefined);
            getLastAttackRoll.mockReturnValue({ timestamp: Date.now(), hit: true, d20: 18, bonus: 5, targetAc: 15 });

            const result = await handle(fearlessAction, playerStats, campaignName, mapName);

            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Fearless Aim',
                    description: 'The last attack already hit — Fearless Aim only works when you miss.',
                    automation: fearlessAction.automation,
                },
            });
        });

        it('should succeed when last attack missed and not yet used this turn', async () => {
            const { getCurrentCombatRound } = await import('../../../../services/encounters/combatData.js');
            getCurrentCombatRound.mockReturnValue(5);
            getRuntimeValue.mockReturnValue(undefined);
            getLastAttackRoll.mockReturnValue({
                timestamp: Date.now(),
                hit: false,
                d20: 4,
                bonus: 5,
                targetAc: 15,
            });

            const result = await handle(fearlessAction, playerStats, campaignName, mapName);

            expect(setRuntimeValue).toHaveBeenCalledWith(playerStats.name, '_fearlessAim_usedRound', 5, campaignName);
            expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                type: 'ability_use',
                characterName: playerStats.name,
                abilityName: 'Fearless Aim',
                description: expect.stringContaining('Fearless Aim'),
            }));
            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('Fearless Aim');
            expect(result.payload.description).toContain('MISS');
            expect(result.payload.description).toContain('Miss converted to hit!');
        });

        it('should succeed without tracking when oncePerTurn is false', async () => {
            const noOncePerTurnAction = {
                name: 'Fearless Aim',
                automation: {
                    type: 'auto_reroll',
                    trigger: 'attack_roll_miss',
                    effect: 'convert_miss_to_hit',
                    oncePerTurn: false,
                    casting_time: '1 action',
                },
            };
            getLastAttackRoll.mockReturnValue({
                timestamp: Date.now(),
                hit: false,
                d20: 3,
                bonus: 5,
                targetAc: 14,
            });

            const result = await handle(noOncePerTurnAction, playerStats, campaignName, mapName);

            expect(setRuntimeValue).not.toHaveBeenCalledWith(
                playerStats.name,
                '_fearlessAim_usedRound',
                expect.any(Number),
                campaignName
            );
            expect(result.payload.description).toContain('Miss converted to hit!');
        });

        it('should allow use again in a new round', async () => {
            const { getCurrentCombatRound } = await import('../../../../services/encounters/combatData.js');
            getCurrentCombatRound.mockReturnValue(7);
            getRuntimeValue.mockReturnValue(5);
            getLastAttackRoll.mockReturnValue({
                timestamp: Date.now(),
                hit: false,
                d20: 6,
                bonus: 5,
                targetAc: 15,
            });

            const result = await handle(fearlessAction, playerStats, campaignName, mapName);

            expect(setRuntimeValue).toHaveBeenCalledWith(playerStats.name, '_fearlessAim_usedRound', 7, campaignName);
            expect(result.payload.description).toContain('Miss converted to hit!');
        });
    });

    describe('Guarded Mind (override_fail_to_success)', () => {
        let guardedMindAction;
        beforeEach(() => {
            guardedMindAction = {
                name: 'Guarded Mind',
                automation: {
                    type: 'auto_reroll',
                    target: 'saving_throw',
                    trigger: 'failed_int_wis_cha_save',
                    effect: 'override_fail_to_success',
                    oncePer: 'short_or_long_rest',
                    casting_time: '1 action',
                },
            };
        });

        it('should block when already used this rest', async () => {
            getRuntimeValue.mockReturnValue('rest');

            const result = await handle(guardedMindAction, playerStats, campaignName, mapName);

            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Guarded Mind',
                    description: 'Guarded Mind can only be used once per Short or Long Rest.',
                    automation: guardedMindAction.automation,
                },
            });
        });

        it('should fail when no recent saving throw found', async () => {
            getRuntimeValue.mockReturnValue(undefined);
            getLastSaveRoll.mockReturnValue(null);

            const result = await handle(guardedMindAction, playerStats, campaignName, mapName);

            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Guarded Mind',
                    description: 'No recent saving throw found for Player. This feature can only be used shortly after a saving throw.',
                    automation: guardedMindAction.automation,
                },
            });
        });

        it('should fail when save is stale', async () => {
            getRuntimeValue.mockReturnValue(undefined);
            getLastSaveRoll.mockReturnValue({ timestamp: Date.now() - 70000, saveType: 'Intelligence', d20: 5, bonus: 3 });

            const result = await handle(guardedMindAction, playerStats, campaignName, mapName);

            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Guarded Mind',
                    description: 'No recent saving throw found for Player. This feature can only be used shortly after a saving throw.',
                    automation: guardedMindAction.automation,
                },
            });
        });

        it('should fail for invalid save type (not INT/WIS/CHA)', async () => {
            getRuntimeValue.mockReturnValue(undefined);
            getLastSaveRoll.mockReturnValue({
                timestamp: Date.now(),
                saveType: 'Strength',
                d20: 5,
                bonus: 3,
            });

            const result = await handle(guardedMindAction, playerStats, campaignName, mapName);

            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Guarded Mind',
                    description: 'Guarded Mind only works on Intelligence, Wisdom, or Charisma saving throws.',
                    automation: guardedMindAction.automation,
                },
            });
        });

        it('should succeed for Intelligence save', async () => {
            getRuntimeValue.mockReturnValue(undefined);
            getLastSaveRoll.mockReturnValue({
                timestamp: Date.now(),
                saveType: 'Intelligence',
                d20: 5,
                bonus: 3,
            });

            const result = await handle(guardedMindAction, playerStats, campaignName, mapName);

            expect(setRuntimeValue).toHaveBeenCalledWith(playerStats.name, '_guardedMind_usedRest', 'rest', campaignName);
            expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                type: 'ability_use',
                characterName: playerStats.name,
                abilityName: 'Guarded Mind',
            }));
            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('INT');
            expect(result.payload.description).toContain('SUCCESS (Guarded Mind)');
        });

        it('should succeed for Wisdom save', async () => {
            getRuntimeValue.mockReturnValue(undefined);
            getLastSaveRoll.mockReturnValue({
                timestamp: Date.now(),
                saveType: 'Wisdom',
                d20: 8,
                bonus: 2,
            });

            const result = await handle(guardedMindAction, playerStats, campaignName, mapName);

            expect(result.payload.description).toContain('WIS');
            expect(result.payload.description).toContain('SUCCESS (Guarded Mind)');
        });

        it('should succeed for Charisma save', async () => {
            getRuntimeValue.mockReturnValue(undefined);
            getLastSaveRoll.mockReturnValue({
                timestamp: Date.now(),
                saveType: 'Charisma',
                d20: 12,
                bonus: 1,
            });

            const result = await handle(guardedMindAction, playerStats, campaignName, mapName);

            expect(result.payload.description).toContain('CHA');
            expect(result.payload.description).toContain('SUCCESS (Guarded Mind)');
        });

        it('should succeed for abbreviated save type (INT)', async () => {
            getRuntimeValue.mockReturnValue(undefined);
            getLastSaveRoll.mockReturnValue({
                timestamp: Date.now(),
                saveType: 'INT',
                d20: 7,
                bonus: 4,
            });

            const result = await handle(guardedMindAction, playerStats, campaignName, mapName);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('SUCCESS (Guarded Mind)');
        });
    });
});
