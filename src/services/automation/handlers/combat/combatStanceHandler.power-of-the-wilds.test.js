// @maintained-by-ai
// bug-power-of-the-wilds-row-inert-no-producer regression — lane: lv14 POWER OF THE
// WILDS (Falcon/Lion/Ram) producer flow through the same combat_stance handler as
// its lv3 Rage-of-the-Wilds twin. Pre-fix the row's {modalName:'combatStance'}
// result was dropped by the Special Actions grid (silent zero delta — see
// CharSpecialActions.modals.test.jsx emit pin) AND, had it reached activation,
// Power of the Wilds would have consumed a rage use and logged NOTHING because
// every Wild Heart lane gate keyed on action.name === 'Rage of the Wilds'.
// Owns: chooser-modal routing, re-open (not strip) on re-click while active, the
// Rage prerequisite refusal (action-named copy), zero ragePoints deduction, the
// Falcon armor gate, and the 'Selected X wild form' log with action-named
// automationType. Consumer byte-pins: lionAuraUtils matches optionName==='Lion'
// (+range), contextBuilder-sync Ram gate reads optionName==='Ram', and
// charSummaryCalc's generic fly reads !!flySpeed with a non-NON_GENERIC effect.
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
        level: 14,
        speed: 30,
        ...overrides,
    };
}

// Verbatim option shape from public/data/2024/classes.json → Barbarian →
// Path of the Wild Heart → Power of the Wilds (lv14) automation block.
function makePowerOfWildsAction() {
    return {
        name: 'Power of the Wilds',
        automation: {
            type: 'combat_stance',
            effect: 'power_of_wilds_option',
            options: [
                { name: 'Falcon', flySpeed: 'speed', noArmor: true },
                { name: 'Lion', effect: 'enemies_disadvantage_attacks', range: '5 ft' },
                { name: 'Ram', effect: 'prone_on_melee_hit' },
            ],
            duration: 'while_raging',
        },
    };
}

function setupRuntimeMocks(mocks) {
    runtimeState.getRuntimeValue.mockImplementation((player, prop, camp) => {
        const key = `${player}:${prop}:${camp}`;
        return key in mocks ? mocks[key] : undefined;
    });
}

const rageActiveMocks = {
    'TestBarbarian:activeBuffs:TestCampaign': [{ name: 'Rage', effect: 'stance' }],
    'TestBarbarian:ragePoints:TestCampaign': 4,
};

beforeEach(() => {
    vi.clearAllMocks();
});

describe('Power of the Wilds — chooser modal routing', () => {
    it('handle() returns the combatStance chooser modal for Falcon/Lion/Ram', async () => {
        setupRuntimeMocks({ 'TestBarbarian:activeBuffs:TestCampaign': [] });

        const result = await handle(makePowerOfWildsAction(), makePlayerStats(), campaignName);

        expect(result).toEqual({
            type: 'modal',
            modalName: 'combatStance',
            payload: {
                action: expect.objectContaining({ name: 'Power of the Wilds' }),
                playerStats: expect.objectContaining({ name: 'TestBarbarian' }),
                campaignName,
            },
        });
    });

    it('re-click while the buff is active re-opens the chooser instead of silently stripping', async () => {
        setupRuntimeMocks({
            'TestBarbarian:activeBuffs:TestCampaign': [
                { name: 'Rage', effect: 'stance' },
                { name: 'Power of the Wilds', effect: 'power_of_wilds_option', optionName: 'Lion' },
            ],
        });

        const result = await handle(makePowerOfWildsAction(), makePlayerStats(), campaignName);

        expect(result.type).toBe('modal');
        expect(result.modalName).toBe('combatStance');
        // the active Lion buff was NOT stripped
        expect(runtimeState.setRuntimeValue).not.toHaveBeenCalledWith(
            'TestBarbarian', 'activeBuffs', expect.not.arrayContaining([
                expect.objectContaining({ optionName: 'Lion' }),
            ]), campaignName,
        );
    });
});

describe('Power of the Wilds — activation gates', () => {
    it('refuses when Rage is not active with the action-named copy', async () => {
        setupRuntimeMocks({ 'TestBarbarian:activeBuffs:TestCampaign': [] });

        const result = await applyStanceOption(makePowerOfWildsAction(), makePlayerStats(), campaignName, 'Lion');

        expect(result.type).toBe('popup');
        expect(result.payload.description).toBe('Power of the Wilds requires Rage to be active.');
        expect(runtimeState.setRuntimeValue).not.toHaveBeenCalledWith(
            'TestBarbarian', 'activeBuffs', expect.anything(), campaignName,
        );
    });

    it('stamps the Lion buff byte-matching the lionAuraUtils matcher, deducting no rage use', async () => {
        setupRuntimeMocks(rageActiveMocks);

        const result = await applyStanceOption(makePowerOfWildsAction(), makePlayerStats(), campaignName, 'Lion');

        expect(result.type).toBe('popup');
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
            'TestBarbarian',
            'activeBuffs',
            expect.arrayContaining([
                expect.objectContaining({
                    name: 'Power of the Wilds',
                    effect: 'power_of_wilds_option',
                    duration: 'while_raging',
                    optionName: 'Lion',
                    range: '5 ft',
                }),
            ]),
            campaignName,
        );
        expect(runtimeState.setRuntimeValue).not.toHaveBeenCalledWith(
            'TestBarbarian', 'ragePoints', expect.any(Number), campaignName,
        );
    });

    it('stamps the Ram optionName read by the contextBuilder-sync Ram gate / Ram prone rider', async () => {
        setupRuntimeMocks(rageActiveMocks);

        await applyStanceOption(makePowerOfWildsAction(), makePlayerStats(), campaignName, 'Ram');

        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
            'TestBarbarian',
            'activeBuffs',
            expect.arrayContaining([
                expect.objectContaining({ name: 'Power of the Wilds', optionName: 'Ram' }),
            ]),
            campaignName,
        );
    });

    it('Falcon gains the generic fly-speed buff when unarmored (charSummaryCalc generic-fly read)', async () => {
        setupRuntimeMocks(rageActiveMocks);

        await applyStanceOption(makePowerOfWildsAction(), makePlayerStats(), campaignName, 'Falcon');

        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
            'TestBarbarian',
            'activeBuffs',
            expect.arrayContaining([
                expect.objectContaining({
                    name: 'Power of the Wilds',
                    optionName: 'Falcon',
                    noArmor: true,
                    flySpeed: 'speed',
                }),
            ]),
            campaignName,
        );
    });

    it('Falcon keeps NO flySpeed while wearing armor (noArmor gate)', async () => {
        setupRuntimeMocks(rageActiveMocks);

        await applyStanceOption(
            makePowerOfWildsAction(),
            makePlayerStats({ armorClassFormula: 'Armor (Plate) + Dex' }),
            campaignName,
            'Falcon',
        );

        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
            'TestBarbarian',
            'activeBuffs',
            expect.arrayContaining([
                expect.objectContaining({ optionName: 'Falcon', flySpeed: null }),
            ]),
            campaignName,
        );
    });
});

describe('Power of the Wilds — campaign log', () => {
    it('logs every Falcon/Lion/Ram selection like the lv3 twin (Selected X wild form)', async () => {
        const { addEntry } = await import('../../../ui/logService.js');
        setupRuntimeMocks(rageActiveMocks);

        const action = makePowerOfWildsAction();
        for (const optionName of ['Falcon', 'Lion', 'Ram']) {
            await applyStanceOption(action, makePlayerStats(), campaignName, optionName);
        }

        for (const optionName of ['Falcon', 'Lion', 'Ram']) {
            expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                type: 'automation',
                automationType: 'Power of the Wilds',
                creatureName: 'TestBarbarian',
                description: `Selected ${optionName} wild form`,
            }));
        }
    });
});
