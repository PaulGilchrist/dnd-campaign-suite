// @maintained-by-ai
// createEffectAdderHandlers base lane: GM add-effect tab dispatch (effects/conditions/
// concentration), the canonical early-return guard battery, exact te append bytes,
// per-tab log shapes, and unknown-tab fall-through semantics.
//
// Lane owners cited, never duplicated here:
// - te registry definitions/completeness → services/combat/conditions/targetEffectDefinitions.test.js
//   (getEffectDefinition golden-once, #820). GM add UI reads that registry.
// - CLA-315 falling-chip delegate → createEffectAdderHandlers.falling.test.js (#838):
//   exact produceFallDamage payload, zero persistence, modal closes. That file also pins
//   the MINIMAL te entry bytes [{ target, effect }] (:89-98 there), so the omitted-
//   optional-fields case is NOT re-run here — only the present-field branches are.
// - addCondition internals → conditionSaveService tests; addConcentration internals →
//   concentrationService tests; aura immunity computation → auraConditionImmunity tests.
//
// Old-line → current test map (pre-consolidation citations resolve here):
//   :73  null/undefined combatSummary guard battery        → KEPT BYTE-INTACT (#838 cites it;
//          returns before tab dispatch, so the falling producer is unreachable without a cs)
//   :94  truthy-but-empty combatSummary proceeds          → "truthy-but-empty ... proceeds"
//   :121 conditions success payload + :208 default dc/ability → it.each "full payload per shape"
//   :180 target absent from characters                     → folded into that it.each (playerStats undefined)
//   :150 suffix target match in characters                 → "matches a suffix target"
//   :198 unknown condition key rejected                    → "unknown condition key ... zero side effects"
//   (new) CLA-019 suppressed addCondition: aura args threaded, no writes, modal stays
//          open, refusal detail (label + immunitySource) returned to EffectAdder
//   :233 effects all optional fields + :303 log shape    → it.each "exact te entry bytes" (full + wis default)
//   :272 effects minimal fields                           → CUT, covered by falling.test.js :89-98
//   :285 dedupe/re-append existing te                     → "replaces the matching te" (exact array bytes)
//   :331 concentration success + :371 non-Rage buffs + :385 null/[] buffs + :399 default dc → it.each "starts concentration"
//   :354 Rage block + :411 suffix-target Rage block       → it.each "blocks concentration while raging"
//   :427 unknown tab clears target, does nothing          → kept
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

vi.mock('../../services/combat/auras/auraConditionImmunity.js', () => ({
    getAuraConditionImmunities: vi.fn().mockResolvedValue({ immunities: [], immunitySources: {} }),
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

    const buffsFor = (target, buffs) => (key, prop, campaign) =>
        key === target && prop === 'activeBuffs' && campaign === campaignName ? buffs : null;

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

            vi.mocked(useRuntimeState.getRuntimeValue).mockImplementation(buffsFor('Alice', []));
            handlersEmpty.handleApplyEffect('concentration', { spellName: 'Shield', target: 'Alice' });
            expect(concentrationService.addConcentration).toHaveBeenCalled();
            expect(storage.set).toHaveBeenCalledWith('combatSummary', {}, 'test-campaign');
        });
    });

    describe('conditions tab', () => {
        it.each([
            {
                name: 'full dc and ability',
                data: { conditionKey: 'blinded', target: 'Alice', dc: 15, ability: 'wis' },
                playerStats: expect.objectContaining({ hitPoints: 20 }),
            },
            {
                name: 'dc and ability omitted pass through as undefined',
                data: { conditionKey: 'blinded', target: 'Alice' },
                playerStats: expect.objectContaining({ hitPoints: 20 }),
            },
            {
                name: 'target absent from characters receives undefined playerStats',
                data: { conditionKey: 'blinded', target: 'Goblin', dc: 10, ability: 'con' },
                playerStats: undefined,
            },
        ])('delegates to addCondition, persists, logs, and clears target — $name', async ({ data, playerStats }) => {
            await handlers.handleApplyEffect('conditions', data);

            expect(conditionSaveService.addCondition).toHaveBeenCalledWith(
                expect.objectContaining({
                    combatSummary,
                    creatureName: data.target,
                    conditionDef: expect.objectContaining({ key: 'blinded' }),
                    dc: data.dc,
                    ability: data.ability,
                    getRuntimeValue: useRuntimeState.getRuntimeValue,
                    setRuntimeValue: useRuntimeState.setRuntimeValue,
                    campaignName: 'test-campaign',
                    playerStats,
                }),
            );
            expect(storage.set).toHaveBeenCalledWith('combatSummary', combatSummary, 'test-campaign');
            expect(setCombatSummary).toHaveBeenCalledWith(combatSummary);
            expect(combatLoggingService.logConditionEvent).toHaveBeenCalledWith({
                campaignName: 'test-campaign',
                action: 'applied',
                creatureName: data.target,
                conditionLabel: 'Blinded',
                dc: data.dc,
                ability: data.ability,
            });
            expect(setEffectAdderTarget).toHaveBeenCalledWith(null);
        });

        it('matches a suffix target ("Alice the Wizard") in characters and carries its stats', async () => {
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

            await handlersAlt.handleApplyEffect('conditions', { conditionKey: 'blinded', target: 'Alice the Wizard', dc: 10, ability: 'con' });

            expect(conditionSaveService.addCondition).toHaveBeenCalledWith(
                expect.objectContaining({
                    combatSummary: cs,
                    creatureName: 'Alice the Wizard',
                    dc: 10,
                    ability: 'con',
                    campaignName: 'test-campaign',
                    playerStats: expect.objectContaining({ hitPoints: 25 }),
                }),
            );
        });

        it('unknown condition key is rejected with zero side effects', async () => {
            await handlers.handleApplyEffect('conditions', { conditionKey: 'nonexistent', target: 'Alice', dc: 10, ability: 'con' });

            expect(conditionSaveService.addCondition).not.toHaveBeenCalled();
            expect(storage.set).not.toHaveBeenCalled();
            expect(setCombatSummary).not.toHaveBeenCalled();
            expect(combatLoggingService.logConditionEvent).not.toHaveBeenCalled();
            expect(setEffectAdderTarget).not.toHaveBeenCalled();
        });

        it('CLA-019: an addCondition reported as suppressed writes nothing, keeps the modal open, and returns the refusal detail', async () => {
            vi.mocked(conditionSaveService.addCondition).mockReturnValue({ suppressed: true, immunitySource: 'Aura of Courage from Alice' });

            const outcome = await handlers.handleApplyEffect('conditions', { conditionKey: 'frightened', target: 'Alice', dc: 12, ability: 'wis' });

            // immunity data is threaded to addCondition, which owns the suppression decision
            expect(conditionSaveService.addCondition).toHaveBeenCalledWith(
                expect.objectContaining({ auraImmunities: [], auraImmunitySources: {} }),
            );
            expect(storage.set).not.toHaveBeenCalled();
            expect(setCombatSummary).not.toHaveBeenCalled();
            expect(combatLoggingService.logConditionEvent).not.toHaveBeenCalled();
            // refusal must be visible: the target is NOT cleared (modal stays open) and
            // the condition label + immunity source ride back to EffectAdder's inline notice
            expect(setEffectAdderTarget).not.toHaveBeenCalled();
            expect(outcome).toEqual({ suppressed: true, conditionLabel: 'Frightened', immunitySource: 'Aura of Courage from Alice' });
        });

        it('suppressed add without a plumbed immunitySource falls back to a generic source label', async () => {
            vi.mocked(conditionSaveService.addCondition).mockReturnValue({ suppressed: true });

            const outcome = await handlers.handleApplyEffect('conditions', { conditionKey: 'frightened', target: 'Alice', dc: 12, ability: 'wis' });

            expect(setEffectAdderTarget).not.toHaveBeenCalled();
            expect(outcome).toEqual({ suppressed: true, conditionLabel: 'Frightened', immunitySource: 'condition immunity' });
        });
    });

    describe('effects tab', () => {
        it.each([
            {
                name: 'every optional field maps onto the entry',
                data: { target: 'Alice', effectKey: 'goad', source: 'Bob', value: 5, ability: 'str', dc: 15, notes: 'GM note' },
                entry: { target: 'Alice', effect: 'goad', source: 'Bob', value: 5, ability: 'str', saveDc: 15, saveAbility: 'str', notes: 'GM note' },
            },
            {
                name: 'dc without ability defaults saveAbility to wis',
                data: { target: 'Alice', effectKey: 'goad', dc: 12 },
                entry: { target: 'Alice', effect: 'goad', saveDc: 12, saveAbility: 'wis' },
            },
        ])('appends the exact te entry bytes — $name', ({ data, entry }) => {
            handlers.handleApplyEffect('effects', data);

            expect(useRuntimeState.getRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects');
            expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
                'campaign',
                'targetEffects',
                [entry],
                'test-campaign',
            );
            expect(combatLoggingService.logConditionEvent).toHaveBeenCalledWith({
                campaignName: 'test-campaign',
                action: 'target-effect-applied',
                creatureName: 'Alice',
                conditionLabel: 'goad',
                dc: data.dc,
                ability: data.ability,
            });
            expect(setEffectAdderTarget).toHaveBeenCalledWith(null);
        });

        it('replaces the te matching target+effect, preserving the others in order', () => {
            vi.mocked(useRuntimeState.getRuntimeValue).mockReturnValue([
                { target: 'Alice', effect: 'goad', source: 'Old Source' },
                { target: 'Bob', effect: 'goad', source: 'Bob' },
            ]);

            handlers.handleApplyEffect('effects', { target: 'Alice', effectKey: 'goad', source: 'New Source' });

            expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
                'campaign',
                'targetEffects',
                [
                    { target: 'Bob', effect: 'goad', source: 'Bob' },
                    { target: 'Alice', effect: 'goad', source: 'New Source' },
                ],
                'test-campaign',
            );
        });
    });

    describe('concentration tab', () => {
        it.each([
            { name: 'null activeBuffs', buffs: null, data: { target: 'Alice', spellName: 'Shield', dc: 13 } },
            { name: 'empty activeBuffs', buffs: [], data: { target: 'Alice', spellName: 'Shield', dc: 13 } },
            { name: 'buffs without Rage', buffs: [{ name: 'Bless' }, { name: 'Heroism' }], data: { target: 'Alice', spellName: 'Shield', dc: 13 } },
            { name: 'omitted dc passes through as undefined', buffs: [], data: { target: 'Alice', spellName: 'Shield' } },
        ])('starts concentration, persists, logs, and clears target — $name', ({ buffs, data }) => {
            vi.mocked(useRuntimeState.getRuntimeValue).mockImplementation(buffsFor(data.target, buffs));

            handlers.handleApplyEffect('concentration', data);

            expect(concentrationService.addConcentration).toHaveBeenCalledWith(
                combatSummary,
                data.target,
                data.spellName,
                data.dc,
            );
            expect(storage.set).toHaveBeenCalledWith('combatSummary', combatSummary, 'test-campaign');
            expect(setCombatSummary).toHaveBeenCalledWith(combatSummary);
            expect(combatLoggingService.logConditionEvent).toHaveBeenCalledWith({
                campaignName: 'test-campaign',
                action: 'concentration-started',
                creatureName: data.target,
                conditionLabel: `Concentration: ${data.spellName}`,
                dc: data.dc,
                ability: 'con',
            });
            expect(setEffectAdderTarget).toHaveBeenCalledWith(null);
        });

        it.each([
            { name: 'Rage alongside other buffs', target: 'Alice', buffs: [{ name: 'Rage' }, { name: 'Bless' }] },
            { name: 'suffix target is looked up under its full name', target: 'Alice the Wizard', buffs: [{ name: 'Rage' }] },
        ])('blocks concentration while raging — $name', ({ target, buffs }) => {
            vi.mocked(useRuntimeState.getRuntimeValue).mockImplementation(buffsFor(target, buffs));

            handlers.handleApplyEffect('concentration', { target, spellName: 'Shield', dc: 13 });

            expect(concentrationService.addConcentration).not.toHaveBeenCalled();
            expect(storage.set).not.toHaveBeenCalled();
            expect(setCombatSummary).not.toHaveBeenCalled();
            expect(combatLoggingService.logConditionEvent).not.toHaveBeenCalled();
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
