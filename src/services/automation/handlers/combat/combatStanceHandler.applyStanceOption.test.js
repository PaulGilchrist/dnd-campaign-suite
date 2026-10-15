// @maintained-by-ai
// combatStanceHandler sextet — lane: APPLY STANCE OPTION (chosen-option activation,
// the path CombatStanceModal drives after the user picks an option).
// Owns: option-derived buff fields (flySpeed armor gate, ice_walk/speed_boost/
// fly_speed/teleport via STANCE_OPTION_EFFECTS), resistance flattening, the
// chosen-option popup description composition ('X chosen. ... (N Rage use(s)
// remaining)'), the charmed/frightened-clear pin for this handler family, and the
// Rage of the Wilds flows (handle-modal unconditionally, rage prerequisite, no
// ragePoints deduction, wild-choice log).
// Six-lane seam map lives in combatStanceHandler.activation.test.js header.
// Deterministic: runtime/logService mocked, pure handler, exact pins — no churn expected.
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handle, applyStanceOption } from './combatStanceHandler.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../buffs/tempHpBuffHandler.js', () => ({
    grantTempHpOnRage: vi.fn(),
    handle: vi.fn(),
    confirmVitalityOfTheTree: vi.fn(),
}));

vi.mock('../class-warlock/tempTeleportHandler.js', () => ({
    clearExtendedFlag: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
    return {
        name: 'TestBarbarian',
        level: 5,
        speed: 30,
        ...overrides,
    };
}

function makeAction(automation = {}) {
    return {
        name: 'Rage',
        automation: {
            type: 'combat_stance',
            ...automation,
        },
    };
}

function setupRuntimeMocks(mocks) {
    runtimeState.getRuntimeValue.mockImplementation((player, prop, camp) => {
        const key = `${player}:${prop}:${camp}`;
        if (key in mocks) {
            return mocks[key];
        }
        return undefined;
    });
}

const baseMocks = {
    'TestBarbarian:activeBuffs:TestCampaign': [],
    'TestBarbarian:ragePoints:TestCampaign': 4,
};

// ─── applyStanceOption: buff creation with option ───

describe('applyStanceOption - buff creation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('delegates to activateStance when valid option is found', async () => {
        setupRuntimeMocks(baseMocks);

        const options = [{ name: 'Bear', resistanceTypes: ['fire'] }];
        const action = makeAction({ effect: 'stance', options });
        const result = await applyStanceOption(action, makePlayerStats(), campaignName, 'Bear');

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.name).toBe('Rage');
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
            'TestBarbarian',
            'activeBuffs',
            expect.arrayContaining([
                expect.objectContaining({
                    optionName: 'Bear',
                    resistanceTypes: ['fire'],
                }),
            ]),
            campaignName,
        );
    });

    it('sets flySpeed when chosen option has flySpeed and player is not wearing armor', async () => {
        setupRuntimeMocks(baseMocks);

        const ps = makePlayerStats({
            armorClassFormula: 'Unarmored Defense',
        });
        const options = [{ name: 'Falcon', flySpeed: 30, noArmor: true }];
        const action = makeAction({ effect: 'stance', options });
        await applyStanceOption(action, ps, campaignName, 'Falcon');

        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
            'TestBarbarian',
            'activeBuffs',
            expect.arrayContaining([
                expect.objectContaining({
                    effect: 'fly_speed_equals_walk_speed',
                    flySpeed: 30,
                }),
            ]),
            campaignName,
        );
    });

    it('blocks flySpeed when chosen option has noArmor and player is wearing armor', async () => {
        setupRuntimeMocks(baseMocks);

        const ps = makePlayerStats({
            armorClassFormula: 'Armor (16) + DEX modifier',
        });
        const options = [{ name: 'Falcon', flySpeed: 30, noArmor: true }];
        const action = makeAction({ effect: 'stance', options });
        const result = await applyStanceOption(action, ps, campaignName, 'Falcon');

        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
            'TestBarbarian',
            'activeBuffs',
            expect.arrayContaining([
                expect.objectContaining({
                    effect: 'stance',
                    flySpeed: null,
                }),
            ]),
            campaignName,
        );
        expect(result.payload.description).toBe('Falcon chosen. While raging, you have a Fly Speed equal to your Speed if you are not wearing armor. Blocked because you are wearing armor. (4 Rage use(s) remaining)');
    });

    it('allows flySpeed when noArmor is false on the option', async () => {
        setupRuntimeMocks(baseMocks);

        const ps = makePlayerStats({
            armorClassFormula: '(Armor) 18',
        });
        const options = [{ name: 'Falcon', flySpeed: 30, noArmor: false }];
        const action = makeAction({ effect: 'stance', options });
        await applyStanceOption(action, ps, campaignName, 'Falcon');

        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
            'TestBarbarian',
            'activeBuffs',
            expect.arrayContaining([
                expect.objectContaining({
                    effect: 'fly_speed_equals_walk_speed',
                    flySpeed: 30,
                }),
            ]),
            campaignName,
        );
    });

    it('sets effect to ice_walk when chosen option has ice_walk effect', async () => {
        setupRuntimeMocks(baseMocks);

        const options = [{ name: 'Cold', effect: 'ice_walk' }];
        const action = makeAction({ effect: 'stance', options });
        await applyStanceOption(action, makePlayerStats(), campaignName, 'Cold');

        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
            'TestBarbarian',
            'activeBuffs',
            expect.arrayContaining([
                expect.objectContaining({
                    effect: 'ice_walk',
                }),
            ]),
            campaignName,
        );
    });

    it('sets speedBonus when chosen option has speed_boost effect', async () => {
        setupRuntimeMocks(baseMocks);

        const options = [{ name: 'Fire', effect: 'speed_boost', speedBonus: 15 }];
        const action = makeAction({ effect: 'stance', options });
        await applyStanceOption(action, makePlayerStats(), campaignName, 'Fire');

        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
            'TestBarbarian',
            'activeBuffs',
            expect.arrayContaining([
                expect.objectContaining({
                    effect: 'speed_boost',
                    speedBonus: 15,
                }),
            ]),
            campaignName,
        );
    });

    it('sets flySpeed to equals_walk_speed when chosen option has fly_speed effect', async () => {
        setupRuntimeMocks(baseMocks);

        const options = [{ name: 'Lightning', effect: 'fly_speed' }];
        const action = makeAction({ effect: 'stance', options });
        await applyStanceOption(action, makePlayerStats(), campaignName, 'Lightning');

        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
            'TestBarbarian',
            'activeBuffs',
            expect.arrayContaining([
                expect.objectContaining({
                    effect: 'fly_speed_equals_walk_speed',
                    flySpeed: 'equals_walk_speed',
                }),
            ]),
            campaignName,
        );
    });

    it('writes teleport_ready buff and returns teleport modal flagged triggeredByElementalStride for teleport option', async () => {
        setupRuntimeMocks(baseMocks);

        const options = [{ name: 'Thunder', effect: 'teleport', teleportDistance: '60 ft' }];
        const action = makeAction({ effect: 'stance', options });
        const result = await applyStanceOption(action, makePlayerStats(), campaignName, 'Thunder');

        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
            'TestBarbarian',
            'activeBuffs',
            expect.arrayContaining([
                expect.objectContaining({
                    effect: 'teleport_ready',
                    teleportDistance: '60 ft',
                }),
            ]),
            campaignName,
        );
        expect(result.type).toBe('modal');
        expect(result.modalName).toBe('teleport');
        expect(result.payload.triggeredByElementalStride).toBe(true);
    });

    it('passes noArmor and range through from chosen option', async () => {
        setupRuntimeMocks(baseMocks);

        const options = [{ name: 'Falcon', noArmor: true, range: '60 ft' }];
        const action = makeAction({ effect: 'stance', options });
        await applyStanceOption(action, makePlayerStats(), campaignName, 'Falcon');

        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
            'TestBarbarian',
            'activeBuffs',
            expect.arrayContaining([
                expect.objectContaining({
                    noArmor: true,
                    range: '60 ft',
                }),
            ]),
            campaignName,
        );
    });

    it('removes charmed and frightened conditions when Rage is activated via applyStanceOption', async () => {
        setupRuntimeMocks({
            ...baseMocks,
            'TestBarbarian:activeConditions:TestCampaign': ['charmed', 'frightened', 'poisoned'],
        });

        const options = [{ name: 'Bear' }];
        const action = makeAction({ effect: 'stance', options });
        await applyStanceOption(action, makePlayerStats(), campaignName, 'Bear');

        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
            'TestBarbarian',
            'activeConditions',
            ['poisoned'],
            campaignName,
        );
    });

    it('flattens all_except token and composes the chosen-option description with uses remaining', async () => {
        setupRuntimeMocks(baseMocks);

        const options = [{ name: 'Bear', resistanceTypes: ['all_except_force_necrotic_psychic_radiant'] }];
        const action = makeAction({ effect: 'stance', options });
        const result = await applyStanceOption(action, makePlayerStats(), campaignName, 'Bear');

        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
            'TestBarbarian',
            'activeBuffs',
            expect.arrayContaining([
                expect.objectContaining({
                    resistanceTypes: expect.arrayContaining([
                        'acid', 'bludgeoning', 'cold', 'fire', 'lightning', 'piercing', 'poison', 'slashing', 'thunder',
                    ]),
                }),
            ]),
            campaignName,
        );
        expect(result.payload.description).toBe('Bear chosen. Resistance to Acid, Bludgeoning, Cold, Fire, Lightning, Piercing, Poison, Slashing, Thunder (4 Rage use(s) remaining)');
    });
});

// ─── Rage of the Wilds - special handling ───

describe('combatStanceHandler - Rage of the Wilds', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    function makeWildsAction(options) {
        return {
            name: 'Rage of the Wilds',
            automation: { type: 'combat_stance', effect: 'animal_rage_option', options },
        };
    }

    const bearOption = { name: 'Bear', resistanceTypes: ['all_except_force_necrotic_psychic_radiant'] };

    it('returns modal for Rage of the Wilds (options shown even if rage not active)', async () => {
        setupRuntimeMocks({
            'TestBarbarian:activeBuffs:TestCampaign': [],
        });

        const action = makeWildsAction([bearOption, { name: 'Eagle' }, { name: 'Wolf' }]);
        const result = await handle(action, makePlayerStats(), campaignName);

        expect(result.type).toBe('modal');
        expect(result.modalName).toBe('combatStance');
    });

    it('returns error popup when rage is not active via applyStanceOption', async () => {
        setupRuntimeMocks({
            'TestBarbarian:activeBuffs:TestCampaign': [],
        });

        const action = makeWildsAction([bearOption, { name: 'Wolf' }]);
        const result = await applyStanceOption(action, makePlayerStats(), campaignName, 'Bear');

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.description).toBe('Rage of the Wilds requires Rage to be active.');
    });

    it('creates buff without deducting rage points when rage is active', async () => {
        setupRuntimeMocks({
            'TestBarbarian:activeBuffs:TestCampaign': [{ name: 'Rage', effect: 'stance' }],
            'TestBarbarian:ragePoints:TestCampaign': 4,
        });

        const action = makeWildsAction([bearOption]);
        const result = await applyStanceOption(action, makePlayerStats(), campaignName, 'Bear');

        expect(result.type).toBe('popup');
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
            'TestBarbarian',
            'activeBuffs',
            expect.arrayContaining([
                expect.objectContaining({
                    name: 'Rage of the Wilds',
                    optionName: 'Bear',
                }),
            ]),
            campaignName,
        );
        expect(runtimeState.setRuntimeValue).not.toHaveBeenCalledWith(
            'TestBarbarian',
            'ragePoints',
            expect.any(Number),
            campaignName,
        );
    });

    it('logs wild selection to campaign log', async () => {
        const { addEntry } = await import('../../../ui/logService.js');

        setupRuntimeMocks({
            'TestBarbarian:activeBuffs:TestCampaign': [{ name: 'Rage', effect: 'stance' }],
            'TestBarbarian:ragePoints:TestCampaign': 4,
        });

        const options = [{ name: 'Wolf', effect: 'ally_advantage_on_nearby_enemies', range: '5 ft' }];
        const action = makeWildsAction(options);
        await applyStanceOption(action, makePlayerStats(), campaignName, 'Wolf');

        expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
            type: 'automation',
            automationType: 'Rage of the Wilds',
            creatureName: 'TestBarbarian',
            description: 'Selected Wolf wild form',
        }));
    });
});
