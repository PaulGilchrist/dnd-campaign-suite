// @maintained-by-ai
// Lane split for createConcentrationHandlers.js (this file is the CANONICAL base lane):
//  - THIS lane — handleRollConcentrationSave ONLY: no-op early returns, exact success/
//    failure persist-popup-log bytes, static concentration_breaker disadvantage incl.
//    resolveSaveMode breaker-over-advantage precedence, and roller advantage-source
//    modes flattened as it.each rows. te-driven disadvantage is NOT here.
//  - createConcentrationHandlers-2.test.jsx — handleBreakConcentration payloads/counts + SP-114.
//  - createConcentrationHandlers.te-disadvantage.test.jsx — MA-0038 concentration_disadvantage
//    te face (addEntry attribution + `|| !!te` breaker); pinned OFF here via mocks so the
//    static-breaker / advantage contract is the only variable.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createConcentrationHandlers } from './createConcentrationHandlers.js';
import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import storage from '../../services/ui/storage.js';
import {
    rollConcentrationSave,
    buildConcentrationPopup,
    cleanupConcentrationEffects,
} from '../../services/combat/concentration/concentrationService.js';
import { logConcentrationSave } from '../../services/encounters/combatLoggingService.js';
import { addEntry } from '../../services/ui/logService.js';

vi.mock('../../services/ui/storage.js', () => ({
    default: {
        get: vi.fn(),
        set: vi.fn(),
        getProperty: vi.fn(),
        setProperty: vi.fn(),
    },
}));

vi.mock('../../services/combat/concentration/concentrationService.js', () => ({
    rollConcentrationSave: vi.fn(),
    breakConcentration: vi.fn(),
    buildConcentrationPopup: vi.fn(),
    cleanupConcentrationEffects: vi.fn(),
}));

vi.mock('../../services/encounters/combatLoggingService.js', () => ({
    logConcentrationSave: vi.fn(),
    logConditionEvent: vi.fn(),
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

// MA-0038 te face is owned by .te-disadvantage.test.jsx — pinned off here so this
// lane only ever exercises the STATIC concentration_breaker breaker.
vi.mock('../../services/combat/conditions/targetEffectDefinitions.js', () => ({
    getActiveTargetEffect: vi.fn(() => null),
}));

vi.mock('../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

const POPUP = { type: 'concentration-popup-sentinel' };

describe('createConcentrationHandlers — handleRollConcentrationSave', () => {
    let combatSummary;
    let characters;
    let campaignNpcs;
    let setConditionPopup;
    let setCombatSummary;

    beforeEach(() => {
        vi.clearAllMocks();
        // Fresh fixtures per test (#771) — tests mutate these in place.
        combatSummary = {
            round: 1,
            creatures: [
                { name: 'Alice', type: 'player' },
                { name: 'Goblin', type: 'npc' },
            ],
        };
        characters = [
            { name: 'Alice', saveModifiers: [], computedStats: {} },
            { name: 'Goblin', saveModifiers: [], computedStats: {} },
        ];
        campaignNpcs = [];
        setConditionPopup = vi.fn();
        setCombatSummary = vi.fn();
        // Determinism pins (#827): no lastAttack stored (covers the optional-chain
        // default for every non-breaker case), successful d20 result, popup sentinel
        // so setConditionPopup's payload has an identifiable consumer-visible value.
        getRuntimeValue.mockResolvedValue(null);
        rollConcentrationSave.mockResolvedValue({
            roll: 15, success: true, bonus: 2, bonusDetail: undefined,
            starryDragonFloor: false, displayRolls: [15],
        });
        buildConcentrationPopup.mockReturnValue(POPUP);
    });

    function createHandlers(overrides = {}) {
        return createConcentrationHandlers({
            combatSummary,
            campaignName: 'test-campaign',
            characters,
            campaignNpcs,
            mapName: 'test-map',
            setConditionPopup,
            setCombatSummary,
            ...overrides,
        });
    }

    function giveAliceConcentration() {
        combatSummary.creatures[0].concentration = { spell: 'Fireball', dc: 13 };
    }

    it('does nothing when combatSummary is null, the creature is unknown, or it holds no concentration', async () => {
        await createConcentrationHandlers({
            combatSummary: null,
            campaignName: 'test-campaign',
            characters,
            campaignNpcs,
            mapName: 'test-map',
            setConditionPopup,
            setCombatSummary,
        }).handleRollConcentrationSave('Alice');
        await createHandlers().handleRollConcentrationSave('NonExistent');
        await createHandlers().handleRollConcentrationSave('Alice'); // fixture Alice has no concentration

        expect(rollConcentrationSave).not.toHaveBeenCalled();
        expect(storage.set).not.toHaveBeenCalled();
        expect(setCombatSummary).not.toHaveBeenCalled();
        expect(buildConcentrationPopup).not.toHaveBeenCalled();
        expect(setConditionPopup).not.toHaveBeenCalled();
        expect(logConcentrationSave).not.toHaveBeenCalled();
        expect(cleanupConcentrationEffects).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
    });

    it('successful save: exact roll/persist/popup/log payloads, concentration preserved, no cleanup', async () => {
        giveAliceConcentration();

        await createHandlers().handleRollConcentrationSave('Alice');

        // lastAttack pinned null → disadvantage:false arm of the breaker (twins collapsed).
        expect(rollConcentrationSave).toHaveBeenCalledTimes(1);
        expect(rollConcentrationSave).toHaveBeenCalledWith({
            creature: { name: 'Alice', type: 'player', concentration: { spell: 'Fireball', dc: 13 } },
            concentration: { spell: 'Fireball', dc: 13 },
            characters,
            campaignNpcs,
            campaignName: 'test-campaign',
            mapName: 'test-map',
            getName: expect.any(Function),
            disadvantage: false,
        });
        expect(storage.set).toHaveBeenCalledTimes(1);
        expect(storage.set).toHaveBeenCalledWith('combatSummary', combatSummary, 'test-campaign');
        expect(setCombatSummary).toHaveBeenCalledTimes(1);
        expect(setCombatSummary).toHaveBeenCalledWith({
            round: 1,
            creatures: [
                { name: 'Alice', type: 'player', concentration: { spell: 'Fireball', dc: 13 } },
                { name: 'Goblin', type: 'npc' },
            ],
        });
        expect(buildConcentrationPopup).toHaveBeenCalledWith({
            roll: 15, bonus: 2, bonusDetail: undefined, spellName: 'Fireball', dc: 13,
            success: true, starryDragonFloor: false, displayRolls: [15],
        });
        expect(setConditionPopup).toHaveBeenCalledWith(POPUP);
        expect(logConcentrationSave).toHaveBeenCalledTimes(1);
        expect(logConcentrationSave).toHaveBeenCalledWith({
            campaignName: 'test-campaign', creatureName: 'Alice', roll: 15, bonus: 2,
            bonusDetail: undefined, spellName: 'Fireball', dc: 13, success: true, mode: 'normal',
        });
        expect(cleanupConcentrationEffects).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
        expect(combatSummary.creatures[0].concentration).toEqual({ spell: 'Fireball', dc: 13 });
    });

    it('failed save: clears concentration, persists, exact popup/log bytes, cleanup once', async () => {
        giveAliceConcentration();
        rollConcentrationSave.mockResolvedValue({
            roll: 5, success: false, bonus: 2, bonusDetail: undefined,
            starryDragonFloor: false, displayRolls: [5],
        });

        await createHandlers().handleRollConcentrationSave('Alice');

        expect(combatSummary.creatures[0].concentration).toBeNull();
        expect(storage.set).toHaveBeenCalledTimes(1);
        expect(storage.set).toHaveBeenCalledWith('combatSummary', combatSummary, 'test-campaign');
        expect(setCombatSummary).toHaveBeenCalledWith({
            round: 1,
            creatures: [
                { name: 'Alice', type: 'player', concentration: null },
                { name: 'Goblin', type: 'npc' },
            ],
        });
        expect(buildConcentrationPopup).toHaveBeenCalledWith({
            roll: 5, bonus: 2, bonusDetail: undefined, spellName: 'Fireball', dc: 13,
            success: false, starryDragonFloor: false, displayRolls: [5],
        });
        expect(setConditionPopup).toHaveBeenCalledWith(POPUP);
        expect(logConcentrationSave).toHaveBeenCalledTimes(1);
        expect(logConcentrationSave).toHaveBeenCalledWith({
            campaignName: 'test-campaign', creatureName: 'Alice', roll: 5, bonus: 2,
            bonusDetail: undefined, spellName: 'Fireball', dc: 13, success: false, mode: 'normal',
        });
        expect(cleanupConcentrationEffects).toHaveBeenCalledTimes(1);
        expect(cleanupConcentrationEffects).toHaveBeenCalledWith('Alice', 'Fireball', 'test-campaign');
        expect(addEntry).not.toHaveBeenCalled();
    });

    // resolveSaveMode precedence owner (#834): static concentration_breaker on the
    // last attacker outranks the roller's own advantage sources; the static breaker
    // never writes a te attribution entry (that is MA-0038-only, te lane).
    it('static concentration_breaker on last attacker: disadvantage:true beats roller advantage, mode disadvantage, no te attribution', async () => {
        giveAliceConcentration();
        getRuntimeValue.mockImplementation((_scope, key) =>
            key === 'lastAttack' ? { attackerName: 'Goblin' } : null);
        characters[1].saveModifiers = [
            { condition: 'concentration_breaker', effect: 'disadvantage', source: 'Goblin' },
        ];
        characters[0].saveModifiers = [
            { source: 'Bard', target: 'concentration_saving_throws', condition: 'bless', effect: 'advantage' },
        ];

        await createHandlers().handleRollConcentrationSave('Alice');

        expect(rollConcentrationSave).toHaveBeenCalledTimes(1);
        expect(rollConcentrationSave).toHaveBeenCalledWith(expect.objectContaining({ disadvantage: true }));
        expect(logConcentrationSave).toHaveBeenCalledTimes(1);
        expect(logConcentrationSave).toHaveBeenCalledWith({
            campaignName: 'test-campaign', creatureName: 'Alice', roll: 15, bonus: 2,
            bonusDetail: undefined, spellName: 'Fireball', dc: 13, success: true, mode: 'disadvantage',
        });
        expect(addEntry).not.toHaveBeenCalled();
    });

    // Roller advantage sources (no breaker: lastAttack pinned null in beforeEach).
    describe('advantage-source modes', () => {
        it.each([
            {
                name: 'concentration_saving_throws modifier',
                saveModifiers: [{ source: 'Bard', target: 'concentration_saving_throws', condition: 'bless', effect: 'advantage' }],
                mode: 'advantage',
            },
            {
                name: 'Constitution concentration_spell_damage modifier',
                saveModifiers: [{ source: 'Paladin', target: 'saving_throw', condition: 'concentration_spell_damage', effect: 'advantage', abilities: ['Constitution'] }],
                mode: 'advantage',
            },
            {
                name: 'non-Concentration concentration_spell_damage ignored',
                saveModifiers: [{ source: 'Paladin', target: 'saving_throw', condition: 'concentration_spell_damage', effect: 'advantage', abilities: ['Strength'] }],
                mode: 'normal',
            },
            {
                name: 'missing saveModifiers defaults to normal',
                saveModifiers: undefined,
                mode: 'normal',
            },
        ])('$name → mode: $mode', async ({ saveModifiers, mode }) => {
            giveAliceConcentration();
            characters[0].saveModifiers = saveModifiers;

            await createHandlers().handleRollConcentrationSave('Alice');

            expect(rollConcentrationSave).toHaveBeenCalledTimes(1);
            expect(rollConcentrationSave).toHaveBeenCalledWith(expect.objectContaining({ disadvantage: false }));
            expect(logConcentrationSave).toHaveBeenCalledTimes(1);
            expect(logConcentrationSave).toHaveBeenCalledWith({
                campaignName: 'test-campaign', creatureName: 'Alice', roll: 15, bonus: 2,
                bonusDetail: undefined, spellName: 'Fireball', dc: 13, success: true, mode,
            });
        });
    });
});
