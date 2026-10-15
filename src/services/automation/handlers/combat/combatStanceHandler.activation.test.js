// @maintained-by-ai
// combatStanceHandler sextet — lane: ACTIVATION via handle() with no options chosen.
//
// Six-lane seam map (each lane owns what it pins; do not duplicate across lanes):
//  - activation (THIS file):         handle() direct-activation path — triggerOnRage dispatch
//                                    to grantTempHpOnRage (wrapped {name, automation} arg shape),
//                                    teleport_on_rage modal (triggeredByRage flag), create_illusion
//                                    follow-up branches (no passive → plain popup + illusion-space note),
//                                    buff shape from defaults + auto-config (raw/unflattened
//                                    resistanceTypes), successful resource decrements (ragePoints,
//                                    channel divinity), description templates.
//  - .test.js (main):               deactivation (wasActive) path, modal path (options > 0),
//                                    resource-exhaustion refusals, null activeBuffs, invalid option.
//  - .applyStanceOption.test.js:   chosen-option-driven activation — option-derived buff fields
//                                    (flySpeed armor gate, ice_walk/speed_boost/fly_speed/teleport,
//                                    flattened Bear resistances), Rage of the Wilds flows, and the
//                                    charmed/frightened-clear pin on this handler family lives there.
//  - .cla366-duplicity-handoff:    regression — create_illusion → teleport_swap_with_illusion
//                                    handoff re-wraps flat specialActions (payload.action.automation).
//  - .cla378-rage-thp-lifecycle:   regression — grant-BEFORE-buff-POST ordering, rage anchor
//                                    stamps, rage-end THP strip (call counts/order, not arg shape).
//  - .instinctive-pounce:          regression CLA-201 — canonical half-Speed advisory numbers
//                                    ('up to N feet') in the popup and the ability_use log.
//
// Deterministic: runtime/logService/combatData mocked, pure handler, exact pins — no churn expected.
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handle } from './combatStanceHandler.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as tempHpBuff from '../buffs/tempHpBuffHandler.js';

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

vi.mock('../../../encounters/combatData.js', () => ({
    getCurrentCombatRound: vi.fn(() => 1),
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

function writeCallsFor(prop) {
    return runtimeState.setRuntimeValue.mock.calls.filter(c => c[1] === prop);
}

function writtenBuffs() {
    const call = writeCallsFor('activeBuffs')[0];
    expect(call).toBeDefined();
    return call[2];
}

const baseMocks = {
    'TestBarbarian:activeBuffs:TestCampaign': [],
    'TestBarbarian:ragePoints:TestCampaign': 4,
};

// ─── handle: activation - triggerOnRage feature dispatch ───

describe('combatStanceHandler - triggerOnRage dispatch on activation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('dispatches grantTempHpOnRage wrapped as {name, automation} and routes the pounce popup', async () => {
        setupRuntimeMocks(baseMocks);

        const pounceSa = { name: 'Instinctive Pounce', effect: 'rage_bonus_movement', triggerOnRage: true };
        const ps = makePlayerStats({
            automation: { specialActions: [pounceSa] },
        });

        const result = await handle(makeAction({ effect: 'stance', options: [] }), ps, campaignName);

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.name).toBe('Rage');
        // Advisory presence only — the exact distance wording is owned by the
        // instinctive-pounce lane, grant call order by the cla378 lane.
        expect(result.payload.description).toContain('Instinctive Pounce');
        expect(tempHpBuff.grantTempHpOnRage).toHaveBeenCalledWith({ name: 'Instinctive Pounce', automation: pounceSa }, ps, campaignName);
    });

    it('does not grant temp HP and returns a plain popup when no triggerOnRage feature exists', async () => {
        setupRuntimeMocks(baseMocks);

        const ps = makePlayerStats({
            automation: {
                specialActions: [{ name: 'Other Feature', effect: 'something_else' }],
            },
        });

        const result = await handle(makeAction({ effect: 'stance', options: [] }), ps, campaignName);

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.name).toBe('Rage');
        expect(result.payload.description).not.toContain('Instinctive Pounce');
        expect(tempHpBuff.grantTempHpOnRage).not.toHaveBeenCalled();
    });

    it('handles missing automation gracefully without throwing', async () => {
        setupRuntimeMocks(baseMocks);

        const ps = makePlayerStats({ automation: null });
        const result = await handle(makeAction({ effect: 'stance', options: [] }), ps, campaignName);

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.name).toBe('Rage');
        expect(tempHpBuff.grantTempHpOnRage).not.toHaveBeenCalled();
    });
});

// ─── handle: activation - teleport on rage ───

describe('combatStanceHandler - teleport on rage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns teleport modal flagged triggeredByRage when teleport_on_rage feature exists', async () => {
        setupRuntimeMocks(baseMocks);

        const teleportSa = { name: 'Test Teleport', effect: 'teleport_on_rage' };
        const ps = makePlayerStats({
            automation: {
                specialActions: [
                    teleportSa,
                    { name: 'Instinctive Pounce', effect: 'rage_bonus_movement', triggerOnRage: true },
                ],
            },
        });

        const result = await handle(makeAction({ effect: 'stance', options: [] }), ps, campaignName);

        expect(result.type).toBe('modal');
        expect(result.modalName).toBe('teleport');
        expect(result.payload.action).toBe(teleportSa);
        expect(result.payload.triggeredByRage).toBe(true);
    });
});

// ─── handle: activation - create_illusion follow-up (no swap passive) ───
// The teleport_swap_with_illusion handoff itself is owned by the
// cla366-duplicity-handoff lane; this lane pins only the negative branch.

describe('combatStanceHandler - create_illusion activation follow-up', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns plain popup with illusion-space casting note when no teleport swap passive exists', async () => {
        setupRuntimeMocks(baseMocks);

        const ps = makePlayerStats({
            automation: { specialActions: [] },
        });

        const action = makeAction({ effect: 'create_illusion', options: [] });
        const result = await handle(action, ps, campaignName);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toBe("Rage activated While active, you can cast spells as though you were in the illusion's space.");
    });
});

// ─── handle: activation - buff creation ───

describe('combatStanceHandler - buff creation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('writes the default buff shape when no auto config is present', async () => {
        setupRuntimeMocks(baseMocks);

        const action = makeAction({ effect: 'stance', options: [] });
        const result = await handle(action, makePlayerStats(), campaignName);

        expect(result.type).toBe('popup');
        expect(writtenBuffs()).toEqual([
            {
                name: 'Rage',
                effect: 'stance',
                duration: '1_minute',
                resistanceTypes: [],
                advantages: [],
                damageBonusExpression: '',
                blocksSpellcasting: false,
                optionName: null,
                noArmor: false,
                range: null,
                flySpeed: null,
                reactionSave: null,
                isImprovedDuplicity: false,
            },
        ]);
    });

    it('passes auto-config fields through to the buff verbatim (resistances stay unflattened)', async () => {
        setupRuntimeMocks(baseMocks);

        // Flattening of all_except_force_necrotic_psychic_radiant happens ONLY on the
        // chosen-option path (applyStanceOption lane); the auto path is a raw passthrough.
        const action = makeAction({
            effect: 'stance',
            options: [],
            resistanceTypes: ['fire', 'cold', 'all_except_force_necrotic_psychic_radiant'],
            advantages: ['melee_attack_rolls'],
            damageBonusExpression: '1d12',
            blocksSpellcasting: true,
            reactionSave: { dc: 15, save: 'dexterity' },
            flySpeed: 20,
        });
        await handle(action, makePlayerStats(), campaignName);

        expect(writtenBuffs()).toEqual([
            {
                name: 'Rage',
                effect: 'stance',
                duration: '1_minute',
                resistanceTypes: ['fire', 'cold', 'all_except_force_necrotic_psychic_radiant'],
                advantages: ['melee_attack_rolls'],
                damageBonusExpression: '1d12',
                blocksSpellcasting: true,
                optionName: null,
                noArmor: false,
                range: null,
                flySpeed: 20,
                reactionSave: { dc: 15, save: 'dexterity' },
                isImprovedDuplicity: false,
            },
        ]);
    });

    it('does not write activeConditions when stored conditions is null', async () => {
        setupRuntimeMocks({
            'TestBarbarian:activeBuffs:TestCampaign': [],
            'TestBarbarian:ragePoints:TestCampaign': 4,
            'TestBarbarian:activeConditions:TestCampaign': null,
        });

        const action = makeAction({ effect: 'stance', options: [] });
        const result = await handle(action, makePlayerStats(), campaignName);

        expect(result.type).toBe('popup');
        expect(writeCallsFor('activeConditions')).toHaveLength(0);
    });

    it('decrements ragePoints on activation', async () => {
        setupRuntimeMocks(baseMocks);

        const action = makeAction({ effect: 'stance', options: [] });
        await handle(action, makePlayerStats(), campaignName);

        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
            'TestBarbarian',
            'ragePoints',
            3,
            campaignName,
        );
    });

    it('decrements channel divinity charges on activation', async () => {
        setupRuntimeMocks({
            'TestBarbarian:activeBuffs:TestCampaign': [],
            'TestBarbarian:channelDivinityCharges:TestCampaign': 2,
        });

        const action = makeAction({ effect: 'stance', options: [], resourceCost: 'channel_divinity' });
        await handle(action, makePlayerStats(), campaignName);

        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
            'TestBarbarian',
            'channelDivinityCharges',
            1,
            campaignName,
        );
    });
});

// ─── handle: activation - description formatting ───

describe('combatStanceHandler - description formatting', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns exact activated message when no uses are tracked', async () => {
        setupRuntimeMocks(baseMocks);

        const action = makeAction({ effect: 'stance', options: [] });
        const result = await handle(action, makePlayerStats(), campaignName);

        expect(result.payload.description).toBe('Rage activated');
    });

    it('derives the uses key from the action name and reports uses remaining', async () => {
        setupRuntimeMocks(baseMocks);

        // uses with no resourceKey → derived key 'rageUses'; unset runtime falls back to maxUses.
        const action = makeAction({ effect: 'stance', options: [], uses: 3 });
        const result = await handle(action, makePlayerStats(), campaignName);

        expect(result.payload.description).toBe('Rage activated (2/3 uses remaining)');
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('TestBarbarian', 'rageUses', 2, campaignName);
    });

    it('honours custom resourceKey for tracked uses', async () => {
        setupRuntimeMocks({
            'TestBarbarian:activeBuffs:TestCampaign': [],
            'TestBarbarian:customResource:TestCampaign': 3,
        });

        const action = makeAction({ effect: 'stance', options: [], uses: 3, resourceKey: 'customResource' });
        const result = await handle(action, makePlayerStats(), campaignName);

        expect(result.payload.description).toBe('Rage activated (2/3 uses remaining)');
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('TestBarbarian', 'customResource', 2, campaignName);
    });
});
