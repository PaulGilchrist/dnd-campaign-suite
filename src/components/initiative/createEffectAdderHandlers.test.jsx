// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createEffectAdderHandlers } from './createEffectAdderHandlers.js';
import * as conditionSaveService from '../../services/combat/conditions/conditionSaveService.js';
import * as concentrationService from '../../services/combat/concentration/concentrationService.js';
import * as combatLoggingService from '../../services/encounters/combatLoggingService.js';
import * as useRuntimeState from '../../hooks/runtime/useRuntimeState.js';
import storage from '../../services/ui/storage.js';
import { cloneDeep } from 'lodash';

vi.mock('../../services/ui/storage.js', () => ({
    default: { get: vi.fn(), set: vi.fn(), getProperty: vi.fn(), setProperty: vi.fn() },
}));

vi.mock('../../services/combat/conditions/conditionSaveService.js', () => ({
    addCondition: vi.fn(),
}));

vi.mock('../../services/combat/concentration/concentrationService.js', () => ({
    addConcentration: vi.fn(),
}));

vi.mock('../../services/encounters/combatLoggingService.js', () => ({
    logConditionEvent: vi.fn(),
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

describe('createEffectAdderHandlers', () => {
    let handlers;
    let campaignName;
    let characters;
    let combatSummary;
    let setEffectAdderTarget;
    let setCombatSummary;

    const mockCombatSummary = {
        round: 1,
        creatures: [
            { name: 'Alice', type: 'player', computedStats: { hitPoints: 20 } },
            { name: 'Bob', type: 'player', computedStats: { hitPoints: 15 } },
            { name: 'Goblin', type: 'npc' },
        ],
    };

    beforeEach(() => {
        vi.clearAllMocks();
        campaignName = 'test-campaign';
        characters = [
            { name: 'Alice', computedStats: { hitPoints: 20, currentHitPoints: 20 } },
            { name: 'Bob', computedStats: { hitPoints: 15, currentHitPoints: 15 } },
        ];
        combatSummary = cloneDeep(mockCombatSummary);
        setEffectAdderTarget = vi.fn();
        setCombatSummary = vi.fn();

        handlers = createEffectAdderHandlers({
            campaignName,
            characters,
            combatSummary,
            setEffectAdderTarget,
            setCombatSummary,
        });
    });

    describe('early return - no combatSummary', () => {
        it('should return early without side effects when combatSummary is null or undefined', () => {
            [null, undefined].forEach((cs) => {
                const handlersNoCs = createEffectAdderHandlers({
                    campaignName,
                    characters,
                    combatSummary: cs,
                    setEffectAdderTarget,
                    setCombatSummary,
                });

                handlersNoCs.handleApplyEffect('conditions', { conditionKey: 'blinded', target: 'Alice' });
                expect(conditionSaveService.addCondition).not.toHaveBeenCalled();
                expect(storage.set).not.toHaveBeenCalled();
                expect(setCombatSummary).not.toHaveBeenCalled();
                expect(combatLoggingService.logConditionEvent).not.toHaveBeenCalled();
                expect(setEffectAdderTarget).not.toHaveBeenCalled();
                expect(useRuntimeState.getRuntimeValue).not.toHaveBeenCalled();
                expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
            });
        });

        it('should proceed with empty object combatSummary (truthy but no creatures)', () => {
            const handlersEmpty = createEffectAdderHandlers({
                campaignName,
                characters,
                combatSummary: {},
                setEffectAdderTarget,
                setCombatSummary,
            });

            vi.mocked(useRuntimeState.getRuntimeValue).mockImplementation((key, prop, campaign) => {
                if (key === 'Alice' && prop === 'activeBuffs' && campaign === 'test-campaign') return [];
                return null;
            });
            handlersEmpty.handleApplyEffect('concentration', { spellName: 'Shield', target: 'Alice' });
            expect(concentrationService.addConcentration).toHaveBeenCalled();
            expect(storage.set).toHaveBeenCalledWith('combatSummary', {}, 'test-campaign');
        });
    });

    describe('conditions tab', () => {
        const conditionData = {
            conditionKey: 'blinded',
            target: 'Alice',
            dc: 15,
            ability: 'wis',
        };

        it('should call addCondition, storage.set, setCombatSummary, logConditionEvent, and clear target on success', () => {
            handlers.handleApplyEffect('conditions', conditionData);

            expect(conditionSaveService.addCondition).toHaveBeenCalledWith(
                expect.objectContaining({
                    combatSummary,
                    creatureName: 'Alice',
                    conditionDef: expect.objectContaining({ key: 'blinded' }),
                    dc: 15,
                    ability: 'wis',
                    getRuntimeValue: useRuntimeState.getRuntimeValue,
                    setRuntimeValue: useRuntimeState.setRuntimeValue,
                    campaignName: 'test-campaign',
                    playerStats: expect.any(Object),
                }),
            );
            expect(storage.set).toHaveBeenCalledWith('combatSummary', combatSummary, 'test-campaign');
            expect(setCombatSummary).toHaveBeenCalled();
            expect(combatLoggingService.logConditionEvent).toHaveBeenCalledWith(
                'test-campaign',
                'applied',
                'Alice',
                'Blinded',
                15,
                'wis',
            );
            expect(setEffectAdderTarget).toHaveBeenCalledWith(null);
        });

        it('should find target by suffix name (e.g. "Alice the Wizard") in characters array', () => {
            characters.push({ name: 'Alice the Wizard', computedStats: { hitPoints: 25 } });
            const cs = cloneDeep(mockCombatSummary);
            cs.creatures.push({ name: 'Alice the Wizard', type: 'player' });

            const handlersAlt = createEffectAdderHandlers({
                campaignName,
                characters,
                combatSummary: cs,
                setEffectAdderTarget,
                setCombatSummary,
            });

            handlersAlt.handleApplyEffect('conditions', { conditionKey: 'blinded', target: 'Alice the Wizard', dc: 10, ability: 'con' });

            expect(conditionSaveService.addCondition).toHaveBeenCalledWith(
                expect.objectContaining({
                    combatSummary: cs,
                    creatureName: 'Alice the Wizard',
                    conditionDef: expect.any(Object),
                    dc: 10,
                    ability: 'con',
                    getRuntimeValue: useRuntimeState.getRuntimeValue,
                    setRuntimeValue: useRuntimeState.setRuntimeValue,
                    campaignName: 'test-campaign',
                    playerStats: expect.objectContaining({ hitPoints: 25 }),
                }),
            );
        });

        it('should find target in combatSummary creatures when not in characters array', () => {
            handlers.handleApplyEffect('conditions', { conditionKey: 'blinded', target: 'Goblin', dc: 10, ability: 'con' });

            expect(conditionSaveService.addCondition).toHaveBeenCalledWith(
                expect.objectContaining({
                    combatSummary,
                    creatureName: 'Goblin',
                    conditionDef: expect.any(Object),
                    dc: 10,
                    ability: 'con',
                    getRuntimeValue: useRuntimeState.getRuntimeValue,
                    setRuntimeValue: useRuntimeState.setRuntimeValue,
                    campaignName: 'test-campaign',
                    playerStats: undefined,
                }),
            );
        });

        it('should not apply any side effects when condition key is unknown', () => {
            handlers.handleApplyEffect('conditions', { conditionKey: 'nonexistent', target: 'Alice', dc: 10, ability: 'con' });

            expect(conditionSaveService.addCondition).not.toHaveBeenCalled();
            expect(storage.set).not.toHaveBeenCalled();
            expect(setCombatSummary).not.toHaveBeenCalled();
            expect(combatLoggingService.logConditionEvent).not.toHaveBeenCalled();
            expect(setEffectAdderTarget).not.toHaveBeenCalled();
        });

        it('should use default DC and ability when not provided', () => {
            handlers.handleApplyEffect('conditions', { conditionKey: 'blinded', target: 'Alice' });

            expect(conditionSaveService.addCondition).toHaveBeenCalledWith(
                expect.objectContaining({
                    combatSummary,
                    creatureName: 'Alice',
                    conditionDef: expect.any(Object),
                    dc: undefined,
                    ability: undefined,
                    getRuntimeValue: useRuntimeState.getRuntimeValue,
                    setRuntimeValue: useRuntimeState.setRuntimeValue,
                    campaignName: 'test-campaign',
                    playerStats: expect.any(Object),
                }),
            );
        });
    });

    describe('effects tab', () => {
        const effectData = {
            target: 'Alice',
            effectKey: 'goad',
        };

        it('should add effectEntry with all optional fields when provided', () => {
            handlers.handleApplyEffect('effects', {
                ...effectData,
                source: 'Bob',
                value: 5,
                ability: 'str',
                dc: 15,
                notes: 'GM note',
            });

            expect(useRuntimeState.getRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects');
            expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
                'campaign',
                'targetEffects',
                expect.arrayContaining([
                    expect.objectContaining({
                        target: 'Alice',
                        effect: 'goad',
                        source: 'Bob',
                        value: 5,
                        ability: 'str',
                        saveDc: 15,
                        saveAbility: 'str',
                        notes: 'GM note',
                    }),
                ]),
                'test-campaign',
            );
            expect(combatLoggingService.logConditionEvent).toHaveBeenCalledWith(
                'test-campaign',
                'target-effect-applied',
                'Alice',
                'goad',
                15,
                'str',
            );
            expect(setEffectAdderTarget).toHaveBeenCalledWith(null);
        });

        it('should exclude optional fields when not provided', () => {
            handlers.handleApplyEffect('effects', effectData);

            expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
                'campaign',
                'targetEffects',
                expect.arrayContaining([
                    expect.objectContaining({ target: 'Alice', effect: 'goad' }),
                ]),
                'test-campaign',
            );
        });

        it('should filter out existing effect with same target and effectKey before adding', () => {
            vi.mocked(useRuntimeState.getRuntimeValue).mockReturnValue([
                { target: 'Alice', effect: 'goad', source: 'Old Source' },
                { target: 'Bob', effect: 'goad', source: 'Bob' },
            ]);

            handlers.handleApplyEffect('effects', { ...effectData, source: 'New Source' });

            const effectsArg = useRuntimeState.setRuntimeValue.mock.calls[0][2];
            expect(effectsArg).toHaveLength(2);
            expect(effectsArg).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ target: 'Bob', effect: 'goad' }),
                    expect.objectContaining({ target: 'Alice', effect: 'goad', source: 'New Source' }),
                ]),
            );
        });

        it('should log with dc and ability when provided', () => {
            handlers.handleApplyEffect('effects', { ...effectData, dc: 18, ability: 'dex' });

            expect(combatLoggingService.logConditionEvent).toHaveBeenCalledWith(
                'test-campaign',
                'target-effect-applied',
                'Alice',
                'goad',
                18,
                'dex',
            );
        });
    });

    describe('concentration tab', () => {
        const concentrationData = {
            target: 'Alice',
            spellName: 'Shield',
            dc: 13,
        };

        const setupConcentrationMock = () => {
            vi.mocked(useRuntimeState.getRuntimeValue).mockImplementation((key, prop, campaign) => {
                if (key === 'Alice' && prop === 'activeBuffs' && campaign === 'test-campaign') return [];
                return null;
            });
        };

        it('should call addConcentration, storage.set, setCombatSummary, logConditionEvent, and clear target on success', () => {
            setupConcentrationMock();
            handlers.handleApplyEffect('concentration', concentrationData);

            expect(concentrationService.addConcentration).toHaveBeenCalledWith(
                combatSummary,
                'Alice',
                'Shield',
                13,
            );
            expect(storage.set).toHaveBeenCalledWith('combatSummary', combatSummary, 'test-campaign');
            expect(setCombatSummary).toHaveBeenCalled();
            expect(combatLoggingService.logConditionEvent).toHaveBeenCalledWith(
                'test-campaign',
                'concentration-started',
                'Alice',
                'Concentration: Shield',
                13,
                'con',
            );
            expect(setEffectAdderTarget).toHaveBeenCalledWith(null);
        });

        it('should block concentration when target has Rage buff and still clear target', () => {
            vi.mocked(useRuntimeState.getRuntimeValue).mockImplementation((key, prop, campaign) => {
                if (key === 'Alice' && prop === 'activeBuffs' && campaign === 'test-campaign') {
                    return [{ name: 'Rage' }, { name: 'Bless' }];
                }
                return null;
            });

            handlers.handleApplyEffect('concentration', concentrationData);

            expect(concentrationService.addConcentration).not.toHaveBeenCalled();
            expect(storage.set).not.toHaveBeenCalled();
            expect(setCombatSummary).not.toHaveBeenCalled();
            expect(combatLoggingService.logConditionEvent).not.toHaveBeenCalled();
            expect(setEffectAdderTarget).toHaveBeenCalledWith(null);
        });

        it('should allow concentration when target has other buffs but not Rage', () => {
            vi.mocked(useRuntimeState.getRuntimeValue).mockImplementation((key, prop, campaign) => {
                if (key === 'Alice' && prop === 'activeBuffs' && campaign === 'test-campaign') {
                    return [{ name: 'Bless' }, { name: 'Heroism' }];
                }
                return null;
            });

            handlers.handleApplyEffect('concentration', concentrationData);

            expect(concentrationService.addConcentration).toHaveBeenCalled();
            expect(setEffectAdderTarget).toHaveBeenCalledWith(null);
        });

        it('should allow concentration when activeBuffs is null or empty array', () => {
            [null, []].forEach((buffs) => {
                vi.mocked(useRuntimeState.getRuntimeValue).mockImplementation((key, prop, campaign) => {
                    if (key === 'Alice' && prop === 'activeBuffs' && campaign === 'test-campaign') return buffs;
                    return null;
                });

                handlers.handleApplyEffect('concentration', concentrationData);

                expect(concentrationService.addConcentration).toHaveBeenCalled();
                expect(setEffectAdderTarget).toHaveBeenCalledWith(null);
            });
        });

        it('should use default DC when not provided', () => {
            setupConcentrationMock();
            handlers.handleApplyEffect('concentration', { target: 'Alice', spellName: 'Shield' });

            expect(concentrationService.addConcentration).toHaveBeenCalledWith(
                combatSummary,
                'Alice',
                'Shield',
                undefined,
            );
        });

        it('should handle target with suffix in name for buff check', () => {
            vi.mocked(useRuntimeState.getRuntimeValue).mockImplementation((key, prop, campaign) => {
                if (key === 'Alice the Wizard' && prop === 'activeBuffs' && campaign === 'test-campaign') {
                    return [{ name: 'Rage' }];
                }
                return null;
            });

            handlers.handleApplyEffect('concentration', { target: 'Alice the Wizard', spellName: 'Fireball', dc: 15 });

            expect(concentrationService.addConcentration).not.toHaveBeenCalled();
            expect(setEffectAdderTarget).toHaveBeenCalledWith(null);
        });
    });

    describe('invalid tab', () => {
        it('should do nothing for unknown tab and still clear effect adder target', () => {
            handlers.handleApplyEffect('unknownTab', { some: 'data' });

            expect(conditionSaveService.addCondition).not.toHaveBeenCalled();
            expect(useRuntimeState.getRuntimeValue).not.toHaveBeenCalled();
            expect(concentrationService.addConcentration).not.toHaveBeenCalled();
            expect(storage.set).not.toHaveBeenCalled();
            expect(setEffectAdderTarget).toHaveBeenCalledWith(null);
        });
    });

});
