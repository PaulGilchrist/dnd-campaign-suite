// @maintained-by-ai 2026-11-27
// MAIN LANE #1978 (trio close; #1978-IMPROVE-AND-TRIM 2026-11-27, 46->25 titles) —
// summonSpiritHandler orchestration canonical: handle()/confirmSummonSpirit modal
// dispatch, SP-015/SP-114 AC-HP ladder, CLA-066 Create Thrall rider, CLA-252
// phantasmal free cast, SP-005 refusal + unique-name/markers, SP-120 Fey chooser.
// Trio split (siblings read-only, homes honored):
//   cla138 #1976 = _noConcentrationChoice stamp lane ONLY + Instantaneous/unparseable
//     no-Conc clock legs (verified there, lines 191-230) — no stamp pins here.
//   mao #1977  = MA-0284/0285 Huge/Large Slam disk locks + resolveMonsterActions
//     sign-fold consumers — zero concentration content, none restated here.
// Fold coverage per mao's claim lives HERE: Celestial Spirit (MA-0465/0466/0467),
// Construct Spirit (Clay) (MA-0516), synthetic rows — never re-joined
// to the Huge/Large sign matrix.
// findSteedSummon consumer lane (CLA-130, 8/8) closed — only direct handler
// content pinned here; no delegation-lane restatement.
// Exports live (#1916 verified): handle + confirmSummonSpirit registered in
// services/automation/index.js:619-620 (summon_spirit / summon_spirit_confirm)
// and confirmSummonSpirit consumed by CharActionModals.SecondaryModals.jsx;
// resolveCreateThrallRiderHit consumed by MonsterCardModal.jsx.
// TURN-BASED ONLY: no timers in this file; Date.now is frozen ONLY as a log-byte
// sentinel (vi.spyOn), never a game clock. Duration policy: the source encodes
// 'Concentration, up to 1 hour' as rounds:600 and the Create Thrall 1-minute as
// rounds:10 (CLA-334 minutes×10/hours×600 recipe). Per OWNER-PENDING divergence
// #1822 (>=1min durations are combat-scoped canon, precedent grease #1902 /
// sleet #1903) these are pinned as HONEST source bytes, not as endorsed policy.
// TIMESTAMP CENSUS (verified against source bytes): the stamping outlets are the
// addEntry legs (summons, summon_refused, create_thrall_applied, rider grant/
// refusal) and the returned result.logEntries — ALL pinned full-shape under the
// frozen NOW. Popups (infoPopup / performSummon / refusal payloads) carry NO
// timestamp — pinned by exact toEqual without one.
// TRIM LOG (removed as cross-test-redundant, same handler branches):
//   - Fey-chooser modal dispatch (handle modal branch pinned T1 + disk variant
//     shape locked by the SP-120 data test);
//   - Fey lv5 HP-scale e2e (same resolveSummonedHp branch as the slot-4 ladder);
//   - 'paid slotConsumed:true PASS' (subsumed by the refusal-family $-matrix and
//     the multi-cast test which casts with slotConsumed:true);
//   - Avenger end-to-end fold (foldRowDice proven by disk folds + placeholder
//     e2e; reaction wiring e2e stays once via Defender);
//   - Clay end-to-end (resolveMonsterReactions ride-shape pinned directly;
//     combatant wiring e2e proven once by Defender);
//   - per-variant Fey spawn triple -> one sequential census (single code path,
//     distinct monsterIndex lookups).
import { handle, confirmSummonSpirit, resolveMonsterActions, resolveMonsterReactions, resolveCreateThrallRiderHit } from './summonSpiritHandler.js';
import summonFeySpells from '../../../../../public/data/2024/spells.json' with { type: 'json' };
import summonFeyMonsters from '../../../../../public/data/monsters.json' with { type: 'json' };

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn().mockResolvedValue({}),
}));

vi.mock('../../../encounters/combatData.js', () => ({
    getCombatSummary: vi.fn(),
    getCurrentCombatRound: vi.fn(() => 1),
}));

vi.mock('../../../dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
}));

vi.mock('../../../ui/storage.js', () => ({
    __esModule: true,
    default: {
        get: vi.fn(),
        set: vi.fn(),
    },
}));

vi.mock('../../../ui/dataLoader.js', () => ({
    loadMonsters: vi.fn(),
}));

vi.mock('../../../combat/concentration/concentrationService.js', () => ({
    addConcentration: vi.fn(),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

vi.mock('../buffs/tempHpService.js', () => ({
    setTempHpOnKey: vi.fn(),
}));

// getNextUniqueMonsterName stays REAL (SP-005 numbered displayName is exactly
// what the spawn-seam pins consume); only save-bonus extraction is stubbed.
vi.mock('../../../encounters/encounterToInitiative.js', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        getMonsterSaveBonuses: vi.fn().mockImplementation((monster) => {
            const map = { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 };
            for (const [abbr] of Object.entries(map)) {
                if (monster.saving_throws?.[abbr]?.modifier != null) {
                    map[abbr] = monster.saving_throws[abbr].modifier;
                }
            }
            return map;
        }),
    };
});

import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { getCombatSummary } from '../../../encounters/combatData.js';
import { rollExpression } from '../../../dice/diceRoller.js';
import storage from '../../../ui/storage.js';
import { loadMonsters } from '../../../ui/dataLoader.js';
import { addConcentration } from '../../../combat/concentration/concentrationService.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { setTempHpOnKey } from '../buffs/tempHpService.js';

// Frozen wall-clock sentinel for log-byte pins ONLY (game state is round-counted
// at seams; see turn-based header note).
const NOW = 1735689600000;

describe('summonSpiritHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(Date, 'now').mockReturnValue(NOW);
        // SP-005: store-backed targetEffects so a fresh [...] write (no longer
        // mutated in place) is observable via getRuntimeValue across multi-cast.
        const store = { targetEffects: [] };
        getRuntimeValue.mockImplementation((_entity, key) => (key in store ? store[key] : null));
        setRuntimeValue.mockImplementation((_entity, key, value) => { store[key] = value; });
        getCombatSummary.mockReturnValue({
            creatures: [
                { name: 'TestCaster', initiative: '15', initiativeBonus: 3 },
            ],
        });
        // Re-baseline every overridable stub: clearAllMocks keeps mockReturnValue.
        loadMonsters.mockResolvedValue([]);
        rollExpression.mockReturnValue(null);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    const mockPlayerStats = {
        name: 'TestCaster',
        level: 5,
        proficiency: 3,
        abilities: [{ name: 'Wisdom', bonus: 3 }],
        spellAbilities: { toHit: 6, saveDc: 13, modifier: 3 },
    };
    const mockCampaignName = 'test-campaign';

    const bestialVariants = [
        { name: 'Bestial Spirit (Air)', monsterIndex: 'bestial-spirit-air' },
        { name: 'Bestial Spirit (Land)', monsterIndex: 'bestial-spirit-land' },
        { name: 'Bestial Spirit (Water)', monsterIndex: 'bestial-spirit-water' },
    ];

    // Merge contract (verified against spread order): overrides.automation REPLACES
    // the defaults wholesale (the trailing `...overrides` re-spreads it); the
    // defaults apply only when no automation override is given. Top-level
    // overrides (name, spell, metaCtx) also replace wholesale.
    function makeAction(overrides = {}) {
        return {
            name: 'Summon Beast',
            automation: {
                type: 'summon_spirit',
                typeLabel: 'Bestial Spirit',
                baseLevel: 2,
                hpPerLevelAbove: 5,
                variants: bestialVariants,
                ...overrides.automation,
            },
            spell: { level: 2, duration: 'Concentration, up to 1 hour', concentration: true },
            ...overrides,
        };
    }

    const singleVariantAction = (overrides = {}) => makeAction({
        ...overrides,
        automation: {
            type: 'summon_spirit',
            typeLabel: 'Bestial Spirit',
            baseLevel: 2,
            hpPerLevelAbove: 5,
            variants: [bestialVariants[0]],
        },
    });

    const mockMonsters = [
        {
            index: 'animated-object-medium', name: 'Animated Object (Medium)', type: 'construct',
            armor_class: 15, hit_points: 10, damage_resistances: [], damage_immunities: [], immunities: [],
            saving_throws: {}, actions: [{
                name: 'Slam',
                description: 'Melee Spell Attack: +spell attack modifier, reach 5 ft. Hit: 1d4+3 Force damage.',
                attack_bonus: null,
                reach: '5 ft.',
                damage_dice_primary: '1d4+3',
                damage_type_primary: 'force',
            }],
        },
        {
            index: 'bestial-spirit-air', name: 'Bestial Spirit (Air)', type: 'beast',
            armor_class: 11, armor_class_scales_with_slot: true, hit_points: 20, damage_resistances: [], damage_immunities: [], immunities: [],
            saving_throws: { str: { modifier: 4 }, dex: { modifier: 0 }, con: { modifier: 3 }, int: { modifier: -3 }, wis: { modifier: 2 }, cha: { modifier: -3 } },
            actions: [{
                name: "Beast's Strike",
                description: 'Melee Weapon Attack: +spell attack modifier, reach 5 ft. Hit: 1d8+2+WIS modifier Piercing damage.',
                attack_bonus: null,
                reach: '5 ft.',
                damage_dice_primary: '1d8+2+WIS modifier',
                damage_type_primary: 'piercing',
            }],
        },
        {
            index: 'bestial-spirit-land', name: 'Bestial Spirit (Land)', type: 'beast',
            armor_class: 11, armor_class_scales_with_slot: true, hit_points: 30, damage_resistances: [], damage_immunities: [], immunities: [],
            saving_throws: { str: { modifier: 4 }, dex: { modifier: 0 }, con: { modifier: 3 }, int: { modifier: -3 }, wis: { modifier: 2 }, cha: { modifier: -3 } },
            actions: [
                {
                    name: "Beast's Strike",
                    description: 'Melee Weapon Attack: +spell attack modifier, reach 5 ft. Hit: 1d8+2+WIS modifier damage.',
                    attack_bonus: null,
                    reach: '5 ft.',
                    damage_dice_primary: '1d8+2+WIS modifier',
                    damage_type_primary: 'bludgeoning',
                },
                {
                    name: "Beast's Strike — Charge",
                    description: 'The target must succeed on a DC 20 Strength saving throw or be knocked prone.',
                    save_dc: 20,
                    save_type: 'Str',
                },
            ],
        },
        {
            index: 'aberrant-spirit-mind-flayer', name: 'Aberrant Spirit (Mind Flayer)', type: 'aberration',
            armor_class: 11, hit_points: 40, damage_resistances: [], damage_immunities: [], immunities: [],
            saving_throws: { str: { modifier: 2 }, dex: { modifier: 0 }, con: { modifier: 3 }, int: { modifier: 4 }, wis: { modifier: 2 }, cha: { modifier: 3 } },
            actions: [{
                name: 'Psychic Slam',
                description: 'Melee Spell Attack: +spell attack modifier, reach 5 ft. Hit: 3d6+spellcasting modifier Psychic damage.',
                attack_bonus: null,
                reach: '5 ft.',
                damage_dice_primary: '3d6+spellcasting modifier',
                damage_type_primary: 'psychic',
            }],
        },
    ];

    describe('handle', () => {
        it('multi-variant spell: exact modal dispatch, zero board read or write', async () => {
            const action = makeAction();

            const result = await handle(action, mockPlayerStats, mockCampaignName);

            expect(result).toEqual({
                type: 'modal',
                modalName: 'summonSpirit',
                payload: { action, playerStats: mockPlayerStats, campaignName: mockCampaignName },
            });
            // Gate order: dispatch precedes every later channel.
            expect(getCombatSummary).not.toHaveBeenCalled();
            expect(loadMonsters).not.toHaveBeenCalled();
            expect(storage.set).not.toHaveBeenCalled();
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
        });

        it('single-variant spell: full commit census — roster/te/concentration/clock/storage/log in order, exact popup + logEntries', async () => {
            loadMonsters.mockResolvedValue(mockMonsters);
            const combatSummary = getCombatSummary(mockCampaignName);

            const result = await handle(singleVariantAction(), mockPlayerStats, mockCampaignName);

            // --- roster write -------------------------------------------------
            const added = combatSummary.creatures.find(c => c.name?.startsWith('Bestial Spirit (Air)'));
            expect(added).toMatchObject({
                name: 'Bestial Spirit (Air) 1',
                type: 'npc',
                monsterIndex: 'bestial-spirit-air',
                initiative: '14.9', // caster 15 - 0.1: acts right after the caster
                summonedBy: 'TestCaster',
                summonSource: 'spell',
                concentration: null,
                ac: 13, // SP-015: armor_class_scales_with_slot block -> 11 + slot 2
                maxHp: 20,
                currentHp: 20,
                createThrall: false,
            });
            // --- te marker write: fresh full array (SP-004 spread, never in-place) --
            expect(getRuntimeValue('campaign', 'targetEffects')).toEqual([{
                target: 'Bestial Spirit (Air) 1',
                source: 'TestCaster',
                effect: 'summoned',
                summonSource: 'spell',
                duration: 'concentration',
            }]);
            expect(setRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects', [{
                target: 'Bestial Spirit (Air) 1',
                source: 'TestCaster',
                effect: 'summoned',
                summonSource: 'spell',
                duration: 'concentration',
            }], mockCampaignName);
            // --- concentration + spell-end clock ------------------------------
            expect(addConcentration).toHaveBeenCalledWith(combatSummary, 'TestCaster', 'Summon Beast', 13);
            expect(addExpiration).toHaveBeenCalledWith({
                attackerName: 'TestCaster', targetName: 'TestCaster', effects: [
                    { type: 'remove_summoned_creatures', spell: 'Summon Beast' },
                ], campaignName: mockCampaignName, rounds: 600,
            });
            expect(setTempHpOnKey).not.toHaveBeenCalled();
            // --- storage commit: initiative-sorted exact-array census ---------
            expect(storage.set).toHaveBeenCalledTimes(1);
            const [storageKey, storedSummary, storageCampaign] = storage.set.mock.calls[0];
            expect(storageKey).toBe('combatSummary');
            expect(storageCampaign).toBe(mockCampaignName);
            expect(storedSummary.creatures.map(c => c.name)).toEqual([
                'TestCaster', 'Bestial Spirit (Air) 1',
            ]);
            // --- log + return payloads (full shape, frozen timestamp) ---------
            const castLabel = 'TestCaster casts Summon Beast (slot level 2), summoning Bestial Spirit (Air) (20/20 HP).';
            const summonEntry = {
                type: 'summons',
                characterName: 'TestCaster',
                summonName: 'Bestial Spirit',
                description: castLabel,
                summonedCreatures: ['Bestial Spirit (Air) 1'],
                timestamp: NOW,
            };
            expect(addEntry).toHaveBeenCalledTimes(1);
            expect(addEntry).toHaveBeenCalledWith(mockCampaignName, summonEntry);
            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Summon Beast',
                    automationType: 'summon_spirit',
                    description: 'TestCaster casts Summon Beast, summoning Bestial Spirit (Air). It acts right after TestCaster.',
                    automation: singleVariantAction().automation,
                },
                logEntries: [summonEntry],
            });
            // --- ordered commit census (summon write lane) --------------------
            const order = [
                ['addConcentration', addConcentration],
                ['addExpiration', addExpiration],
                ['storage.set', storage.set],
                ['setRuntimeValue', setRuntimeValue],
                ['addEntry', addEntry],
            ]
                .map(([name, mock]) => [name, mock.mock.invocationCallOrder[0]])
                .sort((a, b) => a[1] - b[1])
                .map(([name]) => name);
            expect(order).toEqual(['addConcentration', 'addExpiration', 'storage.set', 'setRuntimeValue', 'addEntry']);
        });
    });

    describe('confirmSummonSpirit', () => {
        // Owner decision 2026-11-10 (bug-summon-lanes-initiative-rolled-board-refresh):
        // the summon join is a PURE board refresh — never the new-combat-reset
        // event whose mount-scoped consumers wipe pendingOAs / round flags /
        // Hunter's Mark / concentration.
        it('dispatches combat-summary-updated EXACTLY once and never initiative-rolled', async () => {
            loadMonsters.mockResolvedValue(mockMonsters);

            const rolled = vi.fn();
            const refreshed = vi.fn();
            window.addEventListener('initiative-rolled', rolled);
            window.addEventListener('combat-summary-updated', refreshed);
            try {
                const result = await confirmSummonSpirit(singleVariantAction(), mockPlayerStats, mockCampaignName, 'Bestial Spirit (Air)');
                expect(result.type).toBe('popup');
                expect(refreshed).toHaveBeenCalledTimes(1);
                expect(rolled).not.toHaveBeenCalled();
            } finally {
                window.removeEventListener('initiative-rolled', rolled);
                window.removeEventListener('combat-summary-updated', refreshed);
            }
        });

        it.each([
            {
                label: 'unknown chooser variant',
                setup: () => {},
                run: (action) => confirmSummonSpirit(action, mockPlayerStats, mockCampaignName, 'Unknown'),
                description: 'No summon variant selected.',
            },
            {
                label: 'missing combat summary',
                setup: () => getCombatSummary.mockReturnValue(null),
                run: (action) => confirmSummonSpirit(action, mockPlayerStats, mockCampaignName, 'Bestial Spirit (Air)'),
                description: 'Failed to load combat summary.',
            },
            {
                label: 'monster index absent from disk',
                setup: () => loadMonsters.mockResolvedValue([]),
                run: (action) => confirmSummonSpirit(action, mockPlayerStats, mockCampaignName, 'Bestial Spirit (Air)'),
                description: 'Failed to load monster data for Bestial Spirit (Air).',
            },
        ])('$label — exact advisory popup, zero roster/te/clock/log writes', async ({ setup, run, description }) => {
            const action = singleVariantAction();
            setup();

            const result = await run(action);

            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Summon Beast',
                    automationType: 'summon_spirit',
                    description,
                    automation: action.automation,
                },
            });
            expect(storage.set).not.toHaveBeenCalled();
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(addConcentration).not.toHaveBeenCalled();
            expect(addExpiration).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
        });

        it('scales HP and AC by the slot level used for armor_class_scales_with_slot blocks (SP-015)', async () => {
            loadMonsters.mockResolvedValue(mockMonsters);
            const combatSummary = getCombatSummary(mockCampaignName);
            const action = singleVariantAction({ metaCtx: { slotLevel: 4 } });

            await confirmSummonSpirit(action, mockPlayerStats, mockCampaignName, 'Bestial Spirit (Air)');

            const added = combatSummary.creatures.find(c => c.name?.startsWith('Bestial Spirit (Air)'));
            expect(added.ac).toBe(11 + 4);
            expect(added.maxHp).toBe(20 + 5 * (4 - 2));
            expect(added.currentHp).toBe(added.maxHp);
        });

        it('SP-114: unflagged blocks stay byte-identical — AC never gains the slot level (scale stays fixed too)', async () => {
            loadMonsters.mockResolvedValue(mockMonsters);
            const combatSummary = getCombatSummary(mockCampaignName);
            const action = makeAction({
                name: 'Animate Objects',
                automation: { typeLabel: 'Animated Object', scale: false, variants: [{ name: 'Animated Object (Medium)', monsterIndex: 'animated-object-medium' }] },
            });

            const result = await confirmSummonSpirit(action, mockPlayerStats, mockCampaignName, 'Animated Object (Medium)');
            const ao = combatSummary.creatures.find(c => c.name?.startsWith('Animated Object (Medium)'));
            expect(ao.ac).toBe(15);
            expect(ao.maxHp).toBe(10);
            expect(ao.summonedBy).toBe('TestCaster');
            expect(ao.summonSource).toBe('spell');
            expect(ao.speed.walk).toBe('30 ft.');
            expect(ao.concentration).toBe(null);
            expect(getRuntimeValue('campaign', 'targetEffects')).toEqual([{
                target: 'Animated Object (Medium) 1', source: 'TestCaster', effect: 'summoned', summonSource: 'spell', duration: 'concentration',
            }]);
            expect(result.type).toBe('popup');

            // Fixed-block AC spell, upcast: HP scales, AC stays armor_class base.
            const aberrant = makeAction({
                name: 'Summon Aberration',
                automation: { typeLabel: 'Aberrant Spirit', baseLevel: 4, hpPerLevelAbove: 5, variants: [{ name: 'Aberrant Spirit (Mind Flayer)', monsterIndex: 'aberrant-spirit-mind-flayer' }] },
                metaCtx: { slotLevel: 5 },
            });
            await confirmSummonSpirit(aberrant, mockPlayerStats, mockCampaignName, 'Aberrant Spirit (Mind Flayer)');
            const mf = combatSummary.creatures.find(c => c.name?.startsWith('Aberrant Spirit (Mind Flayer)'));
            expect(mf.ac).toBe(11);
            expect(mf.maxHp).toBe(40 + 5 * (5 - 4));
        });

        it('resolves spell attack, WIS modifier, spell level and save DC placeholders end-to-end', async () => {
            loadMonsters.mockResolvedValue(mockMonsters);
            const combatSummary = getCombatSummary(mockCampaignName);
            const action = makeAction({ metaCtx: { slotLevel: 3 } });

            await confirmSummonSpirit(action, mockPlayerStats, mockCampaignName, 'Bestial Spirit (Land)');

            const added = combatSummary.creatures.find(c => c.name?.startsWith('Bestial Spirit (Land)'));
            expect(added.actions[0].description).toBe('Melee Weapon Attack: +6, reach 5 ft. Hit: 1d8+2+3 damage.');
            expect(added.actions[0].damage_dice_primary).toBe('1d8+2+3');
            expect(added.actions[0].attack_bonus).toBe(6);
            // save rows: DC 20 placeholder swaps to the caster's spell save DC.
            expect(added.actions[1].save_dc).toBe(13);
        });

        describe('SP-114 Summon Aberration concentration + CLA-066 Create Thrall', () => {
            const aberrantVariants = [{ name: 'Aberrant Spirit (Mind Flayer)', monsterIndex: 'aberrant-spirit-mind-flayer' }];

            function makeAberrantAction(overrides = {}) {
                return makeAction({
                    name: 'Summon Aberration',
                    automation: {
                        type: 'summon_spirit',
                        typeLabel: 'Aberrant Spirit',
                        baseLevel: 4,
                        hpPerLevelAbove: 5,
                        variants: aberrantVariants,
                    },
                    spell: { level: 4, duration: 'Concentration, up to 1 hour', concentration: true },
                    ...overrides,
                });
            }

            const createThrallWarlock = {
                ...mockPlayerStats,
                class: {
                    class_levels: [{
                        level: 14,
                        features: [{
                            name: 'Create Thrall',
                            automation: [
                                { type: 'create_thrall', spell: 'Summon Aberration' },
                                { type: 'passive_rule', effect: 'create_thrall_temp_hp' },
                            ],
                        }],
                    }],
                },
            };

            it('canonical caster WITHOUT Create Thrall: concentrates, fixed AC/HP, inert rows, no temp HP, one summons log, 600-round spell-end clock', async () => {
                loadMonsters.mockResolvedValue(mockMonsters);
                const combatSummary = getCombatSummary(mockCampaignName);

                await confirmSummonSpirit(makeAberrantAction(), mockPlayerStats, mockCampaignName, 'Aberrant Spirit (Mind Flayer)');

                const added = combatSummary.creatures.find(c => c.name?.startsWith('Aberrant Spirit (Mind Flayer)'));
                expect(added.ac).toBe(11);
                expect(added.maxHp).toBe(40);
                // Non-thrall: canonical rows only — no Psychic Strike, no rider transport.
                expect(added.actions.map(a => a.name)).toEqual(['Psychic Slam']);
                expect(added.createThrall).toBe(false);
                expect(added.actions[0].thrall_hex_rider).toBeUndefined();
                expect(setTempHpOnKey).not.toHaveBeenCalled();

                expect(getRuntimeValue('campaign', 'targetEffects')).toEqual([{
                    target: 'Aberrant Spirit (Mind Flayer) 1', source: 'TestCaster', effect: 'summoned', summonSource: 'spell', duration: 'concentration',
                }]);
                expect(addConcentration).toHaveBeenCalledWith(combatSummary, 'TestCaster', 'Summon Aberration', 13);
                // 'Concentration, up to 1 hour' -> 600 rounds (CLA-334 hours×600 —
                // honest source bytes; owner-pending divergence #1822, header note).
                expect(addExpiration).toHaveBeenCalledWith({
                    attackerName: 'TestCaster', targetName: 'TestCaster', effects: [
                        { type: 'remove_summoned_creatures', spell: 'Summon Aberration' },
                    ], campaignName: mockCampaignName, rounds: 600,
                });
                expect(addEntry).toHaveBeenCalledTimes(1);
                expect(addEntry.mock.calls[0][1].type).toBe('summons');
            });

            it('Create Thrall via legacy class_levels: rider transport + full-shape folded rows, exact THP, 1_minute marker, rounds:10 clock, both logs', async () => {
                loadMonsters.mockResolvedValue(mockMonsters);
                const combatSummary = getCombatSummary(mockCampaignName);

                await confirmSummonSpirit(makeAberrantAction(), createThrallWarlock, mockCampaignName, 'Aberrant Spirit (Mind Flayer)');

                const added = combatSummary.creatures.find(c => c.name?.startsWith('Aberrant Spirit (Mind Flayer)'));
                expect(added.createThrall).toBe(true);
                expect(added.actions.map(a => a.name)).toEqual(['Psychic Slam', 'Psychic Strike']);
                // Folded attack row + CLA-036-byte-shape rider transport (default die).
                expect(added.actions[0]).toEqual({
                    name: 'Psychic Slam',
                    description: 'Melee Spell Attack: +6, reach 5 ft. Hit: 3d6+3 Psychic damage.',
                    attack_bonus: 6,
                    reach: '5 ft.',
                    damage_dice_primary: '3d6+3',
                    damage_type_primary: 'psychic',
                    thrall_hex_rider: true,
                    thrall_hex_bonus: { expression: '1d6', damageType: 'Psychic' },
                });
                // Authored Psychic Strike row (pushed verbatim, caster attack mod).
                expect(added.actions[1]).toEqual({
                    name: 'Psychic Strike',
                    casting_time: 'Bonus Action',
                    description: "The thrall lashes out with psychic energy. Make a spell attack roll. On a hit, the target takes 1d6 Psychic damage. This bonus action can only be used on a creature under the warlock's Hex spell.",
                    attack_bonus: 6,
                    damage_dice_primary: '1d6',
                    damage_type_primary: 'Psychic',
                });
                // THP = warlock level + CHA mod (absent here -> 0) = 5.
                expect(setTempHpOnKey).toHaveBeenCalledWith('Aberrant Spirit (Mind Flayer) 1', 'tempHp', 5, mockCampaignName);

                expect(getRuntimeValue('campaign', 'targetEffects')).toEqual([{
                    target: 'Aberrant Spirit (Mind Flayer) 1', source: 'TestCaster', effect: 'summoned', summonSource: 'spell', duration: '1_minute',
                }]);
                expect(addConcentration).not.toHaveBeenCalled();
                // CLA-066: the no-Concentration thrall carries a hard 1-minute
                // expiry clock (rounds:10, CLA-334 recipe — honest bytes, header
                // #1822 note) — the old "no clock at all" pin was a defect.
                expect(addExpiration).toHaveBeenCalledWith({
                    attackerName: 'TestCaster', targetName: 'TestCaster', effects: [
                        { type: 'remove_summoned_creatures', spell: 'Summon Aberration' },
                    ], campaignName: mockCampaignName, rounds: 10,
                });
                // CLA-066 spend log parity: summons log THEN create_thrall_applied.
                expect(addEntry).toHaveBeenCalledTimes(2);
                const logs = addEntry.mock.calls.map(c => c[1]);
                expect(logs[1]).toEqual({
                    type: 'automation',
                    characterName: 'TestCaster',
                    automationType: 'create_thrall_applied',
                    name: 'Create Thrall',
                    description: 'Create Thrall: Aberrant Spirit (Mind Flayer) 1 is summoned without Concentration (duration 1 minute) with 5 Temporary Hit Points (Warlock level + Charisma modifier).',
                    timestamp: NOW,
                });
            });

            it('CLA-066 automation-collected shape (subclass name-only): gate true via automation.specialActions, rider die authored on passives', async () => {
                loadMonsters.mockResolvedValue(mockMonsters);
                const combatSummary = getCombatSummary(mockCampaignName);

                // 2024 runtime shape: playerStats.class.subclass is { name } only
                // (majors flattened by the collector into automation.specialActions).
                const automationShapeWarlock = {
                    ...mockPlayerStats,
                    level: 14,
                    abilities: [...mockPlayerStats.abilities, { name: 'Charisma', bonus: 3 }],
                    class: { subclass: { name: 'Great Old One Patron' } },
                    automation: {
                        specialActions: [{ type: 'create_thrall', name: 'Create Thrall', spell: 'Summon Aberration' }],
                        passives: [
                            { type: 'create_thrall_temp_hp', name: 'Create Thrall' },
                            { type: 'attack_rider', trigger: 'companion_aberration_hit', damageExpression: '2d8', damageType: 'Necrotic', oncePerTurn: true },
                        ],
                    },
                };

                await confirmSummonSpirit(makeAberrantAction(), automationShapeWarlock, mockCampaignName, 'Aberrant Spirit (Mind Flayer)');

                const added = combatSummary.creatures.find(c => c.name?.startsWith('Aberrant Spirit (Mind Flayer)'));
                expect(added).toBeDefined();
                expect(added.createThrall).toBe(true); // conditional on the gate, not a stamp
                // resolveThrallHexBonus reads the authored attack_rider passive.
                expect(added.actions[0].thrall_hex_bonus).toEqual({ expression: '2d8', damageType: 'Necrotic' });
                expect(addConcentration).not.toHaveBeenCalled();
                // THP = 14 + 3 = 17 (no-conc clock fully pinned in the legacy test —
                // same seam, one pin suffices).
                expect(setTempHpOnKey).toHaveBeenCalledWith('Aberrant Spirit (Mind Flayer) 1', 'tempHp', 17, mockCampaignName);
            });

            it('resolveCreateThrallRiderHit: hexed grant rolls once (exact legs + latch write), second hit same round refused', async () => {
                const store = { targetEffects: [{ target: 'Goblin 1', effect: 'hex_ability_check_disadvantage', source: 'HexWarlock' }] };
                getRuntimeValue.mockImplementation((entity, key) => (entity === 'campaign' && key === 'targetEffects' ? store.targetEffects : store[`${entity}.${key}`]));
                setRuntimeValue.mockImplementation((entity, key, value) => { store[`${entity}.${key}`] = value; });

                rollExpression.mockReturnValue({ total: 4, rolls: [4] });
                const rollDamage = vi.fn().mockResolvedValue({});
                const autoDamage = {
                    name: 'Psychic Slam',
                    targetName: 'Goblin 1',
                    thrallHexRider: true,
                    thrallHexBonus: { expression: '1d6', damageType: 'Psychic' },
                };

                const first = await resolveCreateThrallRiderHit({ campaignName: mockCampaignName, monsterName: 'Aberrant Spirit (Mind Flayer) 1', autoDamage, rollDamage });
                expect(first).toEqual({ total: 4, rolls: [4] });
                expect(rollDamage).toHaveBeenCalledTimes(1);
                expect(rollDamage).toHaveBeenCalledWith({
                    name: 'Psychic Slam — Create Thrall',
                    formula: '1d6',
                    total: 4,
                    rolls: [4],
                    modifier: 0,
                    context: { damageType: 'Psychic', targetName: 'Goblin 1', attackerName: 'Aberrant Spirit (Mind Flayer) 1' },
                });
                // Latch stamp awaited BEFORE the next rider read consumes it (§40).
                expect(setRuntimeValue).toHaveBeenCalledWith('Aberrant Spirit (Mind Flayer) 1', '_CreateThrall_usedRound', 1, mockCampaignName);

                // second hit same round — once-per-turn latch refuses, no second roll
                const second = await resolveCreateThrallRiderHit({ campaignName: mockCampaignName, monsterName: 'Aberrant Spirit (Mind Flayer) 1', autoDamage, rollDamage });
                expect(second).toBeNull();
                expect(rollDamage).toHaveBeenCalledTimes(1);
                expect(rollExpression).toHaveBeenCalledTimes(1);

                const logs = addEntry.mock.calls.map(c => c[1]);
                expect(logs.map(l => l.automationType)).toEqual(['create_thrall_hex_bonus', 'create_thrall_refused']);
                expect(logs[0]).toEqual({
                    type: 'automation',
                    automationType: 'create_thrall_hex_bonus',
                    characterName: 'Aberrant Spirit (Mind Flayer) 1',
                    abilityName: 'Psychic Slam',
                    description: 'Aberrant Spirit (Mind Flayer) 1 deals extra 1d6 Psychic (Hex on Goblin 1) — Create Thrall 4 Psychic.',
                    timestamp: NOW,
                });
                expect(logs[1]).toEqual({
                    type: 'automation',
                    automationType: 'create_thrall_refused',
                    characterName: 'Aberrant Spirit (Mind Flayer) 1',
                    abilityName: 'Psychic Slam',
                    description: 'Aberrant Spirit (Mind Flayer) 1: Create Thrall Hex bonus already applied this turn (once per turn) — no extra damage.',
                    timestamp: NOW,
                });
            });

            it('resolveCreateThrallRiderHit zero-spend legs: un-hexed target and rider-mark-free row pay nothing, log nothing', async () => {
                const store = { targetEffects: [{ target: 'Skeleton 1', effect: 'other', source: 'X' }] };
                getRuntimeValue.mockImplementation((entity, key) => (entity === 'campaign' && key === 'targetEffects' ? store.targetEffects : store[`${entity}.${key}`]));

                rollExpression.mockReturnValue({ total: 4, rolls: [4] });
                const rollDamage = vi.fn();

                // guard: no 'hex_ability_check_disadvantage' on the target
                const unHexed = await resolveCreateThrallRiderHit({
                    campaignName: mockCampaignName,
                    monsterName: 'Aberrant Spirit (Mind Flayer) 1',
                    autoDamage: { name: 'Psychic Slam', targetName: 'Skeleton 1', thrallHexRider: true, thrallHexBonus: { expression: '1d6', damageType: 'Psychic' } },
                    rollDamage,
                });
                expect(unHexed).toBeNull();

                // guard: row carries no thrallHexRider marker -> byte-inert entry
                const unmarked = await resolveCreateThrallRiderHit({
                    campaignName: mockCampaignName,
                    monsterName: 'Goblin 1',
                    autoDamage: { name: 'Bite', targetName: 'Goblin 2' },
                    rollDamage,
                });
                expect(unmarked).toBeNull();

                expect(rollExpression).not.toHaveBeenCalled();
                expect(rollDamage).not.toHaveBeenCalled();
                expect(setRuntimeValue).not.toHaveBeenCalled();
                expect(addEntry).not.toHaveBeenCalled();
            });
        });

        describe('CLA-252 Phantasmal Creatures free cast', () => {
            const phantasmalPlayerStats = {
                ...mockPlayerStats,
                automation: {
                    passives: [{
                        type: 'phantasmal_creatures',
                        name: 'Phantasmal Creatures',
                        freeCastSpells: ['Summon Beast', 'Summon Fey'],
                        usesMax: 1,
                        recharge: 'long_rest',
                        halvesHp: true,
                    }],
                },
            };

            const freeCastAction = () => {
                const action = makeAction({ metaCtx: { slotLevel: 2 } });
                action.spell = { level: 2, school: 'Illusion', _phantasmalCreatures: true, _phantasmalHalvesHp: true };
                return action;
            };

            it('halves HP, stamps spectral flags, and logs the trait citation instead of a slot-level mislabel', async () => {
                loadMonsters.mockResolvedValue(mockMonsters);
                const combatSummary = getCombatSummary(mockCampaignName);

                await confirmSummonSpirit(freeCastAction(), phantasmalPlayerStats, mockCampaignName, 'Bestial Spirit (Land)');

                const added = combatSummary.creatures.find(c => c.name?.startsWith('Bestial Spirit (Land)'));
                expect(added.maxHp).toBe(15);
                expect(added.currentHp).toBe(15);
                expect(added.phantasmal).toBe(true);
                expect(added.spectral).toBe(true);

                // Full-string own-composition pin (payment truth, no slot level).
                expect(addEntry).toHaveBeenCalledTimes(1);
                expect(addEntry.mock.calls[0][1].description).toBe(
                    'TestCaster casts Summon Beast — Phantasmal Creatures free cast (spectral, half HP), summoning Bestial Spirit (Land) (15/15 HP).'
                );
            });

            it('keeps full HP on a normal slotted cast even with the passive present', async () => {
                loadMonsters.mockResolvedValue(mockMonsters);
                const combatSummary = getCombatSummary(mockCampaignName);

                await confirmSummonSpirit(makeAction({ metaCtx: { slotLevel: 2 } }), phantasmalPlayerStats, mockCampaignName, 'Bestial Spirit (Land)');

                const added = combatSummary.creatures.find(c => c.name?.startsWith('Bestial Spirit (Land)'));
                expect(added.maxHp).toBe(30);
                expect(added.phantasmal).toBeUndefined();
                expect(added.spectral).toBeUndefined();
            });
        });
    });

    describe('SP-005 zero-slot refusal + multi-cast uniqueness', () => {
        const aoAction = (metaCtx) => ({
            name: 'Animate Objects',
            automation: { type: 'summon_spirit', typeLabel: 'Animated Object', scale: false, variants: [{ name: 'Animated Object (Medium)', monsterIndex: 'animated-object-medium' }] },
            spell: { level: 5, duration: 'Concentration, up to 1 minute', concentration: true },
            metaCtx,
        });

        // SP-005 defect A: refusal fires ONLY on an explicitly-unpaid slotted
        // cast; every free-payment stamp exemption rides line 316.
        it.each([
            { label: 'slotConsumed:false', metaCtx: { slotConsumed: false }, expectation: 'REFUSED — exact popup + summon_refused log, zero reads/writes', expectRefusal: true },
            { label: 'slotConsumed:false + freeCastUsed', metaCtx: { slotConsumed: false, freeCastUsed: true }, expectation: 'summons (free-cast exemption)', expectRefusal: false },
            { label: 'slotConsumed:false + quickRitualUsed', metaCtx: { slotConsumed: false, quickRitualUsed: true }, expectation: 'summons (quick-ritual exemption)', expectRefusal: false },
            { label: 'slotConsumed:false + _psionicUsed', metaCtx: { slotConsumed: false, _psionicUsed: true }, expectation: 'summons (psionic exemption)', expectRefusal: false },
            { label: 'slotConsumed:true', metaCtx: { slotConsumed: true }, expectation: 'summons (PASS-safe paid cast)', expectRefusal: false },
            { label: 'unstamped metaCtx', metaCtx: undefined, expectation: 'summons (unstamped lane stays allowed)', expectRefusal: false },
        ])('$label — $expectation', async ({ metaCtx, expectRefusal }) => {
            loadMonsters.mockResolvedValue(mockMonsters);
            const action = aoAction(metaCtx);

            const result = await confirmSummonSpirit(action, mockPlayerStats, mockCampaignName, 'Animated Object (Medium)');

            if (expectRefusal) {
                const reason = 'No spell slot available at level 5 — Animate Objects summon refused.';
                expect(result).toEqual({
                    type: 'popup',
                    payload: {
                        type: 'automation_info',
                        name: 'Animate Objects',
                        automationType: 'summon_spirit',
                        description: reason,
                        automation: action.automation,
                    },
                });
                expect(addEntry).toHaveBeenCalledTimes(1);
                expect(addEntry).toHaveBeenCalledWith(mockCampaignName, {
                    type: 'automation',
                    characterName: 'TestCaster',
                    automationType: 'summon_refused',
                    name: 'Animate Objects',
                    description: `TestCaster — ${reason}`,
                    timestamp: NOW,
                });
                // Gate order: the refusal short-circuits BEFORE any board read,
                // monster load, roster/te/clock/storage write.
                expect(getCombatSummary).not.toHaveBeenCalled();
                expect(loadMonsters).not.toHaveBeenCalled();
                expect(storage.set).not.toHaveBeenCalled();
                expect(setRuntimeValue).not.toHaveBeenCalled();
                expect(addConcentration).not.toHaveBeenCalled();
                expect(addExpiration).not.toHaveBeenCalled();
            } else {
                expect(result.type).toBe('popup');
                expect(getCombatSummary(mockCampaignName).creatures.some(c => c.name === 'Animated Object (Medium) 1')).toBe(true);
                expect(getRuntimeValue('campaign', 'targetEffects').some(te => te.target === 'Animated Object (Medium) 1')).toBe(true);
            }
        });

        it('two same-variant casts get unique names + one te marker each in cast order (no collision, no te loss)', async () => {
            loadMonsters.mockResolvedValue(mockMonsters);
            const combatSummary = getCombatSummary(mockCampaignName);

            await confirmSummonSpirit(aoAction({ slotConsumed: true }), mockPlayerStats, mockCampaignName, 'Animated Object (Medium)');
            await confirmSummonSpirit(aoAction({ slotConsumed: true }), mockPlayerStats, mockCampaignName, 'Animated Object (Medium)');

            const names = combatSummary.creatures.filter(c => c.name?.startsWith('Animated Object (Medium)')).map(c => c.name);
            expect(names).toEqual(['Animated Object (Medium) 1', 'Animated Object (Medium) 2']);

            expect(getRuntimeValue('campaign', 'targetEffects')).toEqual([
                { target: 'Animated Object (Medium) 1', source: 'TestCaster', effect: 'summoned', summonSource: 'spell', duration: 'concentration' },
                { target: 'Animated Object (Medium) 2', source: 'TestCaster', effect: 'summoned', summonSource: 'spell', duration: 'concentration' },
            ]);
        });
    });

    describe('SP-120 Summon Fey form chooser (locked to disk data)', () => {
        const summonFeySpell = summonFeySpells.find(s => s.index === 'summon-fey');
        const summonFeyVariants = summonFeySpell.automation.variants;

        const summonFeyAction = (spellLevel = 4) => ({
            name: 'Summon Fey',
            automation: summonFeySpell.automation,
            spell: { level: spellLevel, duration: summonFeySpell.duration, concentration: true },
        });

        it('encodes three Trickster/Warrior/Guide variants with distinct monsterIndex entries', () => {
            expect(summonFeyVariants.map(v => v.name)).toEqual([
                'Fey Spirit (Trickster)',
                'Fey Spirit (Warrior)',
                'Fey Spirit (Guide)',
            ]);
            summonFeyVariants.forEach(v => {
                expect(summonFeyMonsters.find(m => m.index === v.monsterIndex)?.name).toBe(v.name);
            });
        });

        it('each chooser variant spawns through its own monsterIndex at base AC 12 / HP 30, te markers in cast order', async () => {
            loadMonsters.mockResolvedValue(summonFeyMonsters);
            const combatSummary = getCombatSummary(mockCampaignName);

            for (const variant of summonFeyVariants) {
                await confirmSummonSpirit(summonFeyAction(), mockPlayerStats, mockCampaignName, variant.name);
            }

            const summons = combatSummary.creatures.filter(c => c.summonedBy === 'TestCaster');
            expect(summons.map(c => [c.name, c.monsterIndex, c.ac, c.maxHp])).toEqual([
                ['Fey Spirit (Trickster) 1', 'fey-spirit-trickster', 12, 30],
                ['Fey Spirit (Warrior) 1', 'fey-spirit-warrior', 12, 30],
                ['Fey Spirit (Guide) 1', 'fey-spirit-guide', 12, 30],
            ]);
            expect(getRuntimeValue('campaign', 'targetEffects').map(te => te.target)).toEqual([
                'Fey Spirit (Trickster) 1', 'Fey Spirit (Warrior) 1', 'Fey Spirit (Guide) 1',
            ]);
            // concentration default for chooser spawns (one log per cast)
            expect(addConcentration).toHaveBeenCalledTimes(3);
            const summonsLogs = addEntry.mock.calls.filter(c => c[1]?.type === 'summons');
            expect(summonsLogs).toHaveLength(3);
            expect(summonsLogs[0][1].description).toContain('slot level 4');
            expect(summonsLogs[0][1].description).toContain('30/30 HP');
        });
    });

    describe('MA-0465/0466 "spell level" damage-token fold', () => {
        const avenger = summonFeyMonsters.find(m => m.index === 'celestial-spirit-avenger');
        const defender = summonFeyMonsters.find(m => m.index === 'celestial-spirit-defender');
        const lv17Mods = { slotLevel: 5, spellAttackMod: 9, spellSaveDc: 17, wisModifier: 3, spellcastingModifier: 3 };

        it('folds disk rows: Avenger "2d6+2+spell level" and Defender "1d10+3+spell level" to the slot, null attack_bonus -> +9, upcast re-folds', () => {
            expect(avenger.actions[0].damage_dice_primary).toBe('2d6+2+spell level');
            expect(avenger.actions[0].attack_bonus).toBeNull();
            const [av] = resolveMonsterActions(avenger, lv17Mods);
            expect(av.damage_dice_primary).toBe('2d6+2+5');
            expect(av.description).toContain('2d6+2+5');
            expect(av.attack_bonus).toBe(9);
            const [avUp] = resolveMonsterActions(avenger, { ...lv17Mods, slotLevel: 6 });
            expect(avUp.damage_dice_primary).toBe('2d6+2+6');

            expect(defender.actions[0].damage_dice_primary).toBe('1d10+3+spell level');
            const [df] = resolveMonsterActions(defender, lv17Mods);
            expect(df.damage_dice_primary).toBe('1d10+3+5');
            expect(df.description).toContain('1d10+3+5');
            expect(df.attack_bonus).toBe(9);
        });

        it('folds damage_dice_secondary too and leaves token-free rows byte-unchanged (exact whole-row shape)', () => {
            const twinMonster = { actions: [{
                name: 'Twin Strike',
                description: 'Hit: 2d6+2+spell level Radiant plus 1d6+spell level Fire damage.',
                attack_bonus: 9,
                damage_dice_primary: '2d6+spell level',
                damage_dice_secondary: '1d6+spell level',
            }] };
            const [twin] = resolveMonsterActions(twinMonster, lv17Mods);
            expect(twin).toEqual({
                name: 'Twin Strike',
                description: 'Hit: 2d6+2+5 Radiant plus 1d6+5 Fire damage.',
                attack_bonus: 9,
                damage_dice_primary: '2d6+5',
                damage_dice_secondary: '1d6+5',
            });

            const plainRow = {
                name: 'Slam',
                description: 'Melee Weapon Attack: reach 5 ft. Hit: 1d8+2 bludgeoning damage.',
                attack_bonus: 5,
                damage_dice_primary: '1d8+2',
                damage_dice_secondary: null,
            };
            const [plain] = resolveMonsterActions({ actions: [plainRow] }, lv17Mods);
            expect(plain).toEqual(plainRow);
        });
    });

    describe('MA-0467 reaction dice fold (Healing Touch)', () => {
        const defender = summonFeyMonsters.find(m => m.index === 'celestial-spirit-defender');
        const lv17Mods = { slotLevel: 5, spellAttackMod: 9, spellSaveDc: 17, wisModifier: 3, spellcastingModifier: 3 };

        it('folds the disk reaction row by slot (5->"2d8+5", 7->"2d8+7"), NEVER backfills attack_bonus, rides automation/usage byte-shape, empty/missing -> []', () => {
            expect(defender.reactions[0].name).toBe('Healing Touch');
            expect(defender.reactions[0].damage_dice_primary).toBe('2d8+spell level');
            const [reaction] = resolveMonsterReactions(defender, lv17Mods);
            expect(reaction.damage_dice_primary).toBe('2d8+5');
            expect(reaction.description).toContain('2d8+5');
            // no false auto-hit attack affordance on reaction rows
            expect(reaction.attack_bonus).toBeNull();
            expect(reaction.automation).toEqual(defender.reactions[0].automation);
            expect(reaction.usage).toBe('At Will');
            expect(reaction.uses).toBe(999);
            expect(reaction.maxUses).toBe(999);

            const [upcast] = resolveMonsterReactions(defender, { ...lv17Mods, slotLevel: 7 });
            expect(upcast.damage_dice_primary).toBe('2d8+7');

            expect(resolveMonsterReactions({}, lv17Mods)).toEqual([]);
            expect(resolveMonsterReactions({ reactions: [] }, lv17Mods)).toEqual([]);
        });

        it('end-to-end: summoned Defender combatant carries the folded live heal reaction', async () => {
            loadMonsters.mockResolvedValue(summonFeyMonsters);
            const combatSummary = getCombatSummary(mockCampaignName);
            const lv17Cleric = {
                ...mockPlayerStats,
                level: 17,
                proficiency: 6,
                spellAbilities: { toHit: 9, saveDc: 17, modifier: 3 },
            };
            const action = {
                name: 'Summon Celestial',
                automation: {
                    type: 'summon_spirit',
                    typeLabel: 'Celestial Spirit',
                    baseLevel: 5,
                    hpPerLevelAbove: 10,
                    variants: [{ name: 'Celestial Spirit (Defender)', monsterIndex: 'celestial-spirit-defender' }],
                },
                spell: { level: 5, duration: 'Concentration, up to 1 hour', concentration: true },
            };

            await confirmSummonSpirit(action, lv17Cleric, mockCampaignName, 'Celestial Spirit (Defender)');

            const added = combatSummary.creatures.find(c => c.name?.startsWith('Celestial Spirit (Defender)'));
            expect(added.reactions).toHaveLength(1);
            expect(added.reactions[0].name).toBe('Healing Touch');
            expect(added.reactions[0].damage_dice_primary).toBe('2d8+5');
            expect(added.reactions[0].automation).toMatchObject({ type: 'reaction', trigger: 'touch', effect: 'heal' });
        });
    });

    describe('MA-0516 Berserk Lashing fold (Construct Spirit (Clay))', () => {
        const clay = summonFeyMonsters.find(m => m.index === 'construct-spirit-clay');
        const lv20Mods = { slotLevel: 5, spellAttackMod: 11, spellSaveDc: 19, wisModifier: 0, spellcastingModifier: 5 };

        it('disk reactions[0] carries the gated attack automation + At Will sentinel (MA-0341 byte-shape); fold rides it unchanged and the lashing route folds the Slam action row', () => {
            expect(clay.reactions[0].name).toBe('Berserk Lashing');
            expect(clay.reactions[0].automation).toMatchObject({ type: 'reaction', trigger: 'damage_taken', effect: 'attack', attack: 'Slam' });
            expect(clay.reactions[0].usage).toBe('At Will');
            expect(clay.reactions[0].attack_bonus).toBeNull();

            const [reaction] = resolveMonsterReactions(clay, lv20Mods);
            expect(reaction.automation).toEqual(clay.reactions[0].automation);
            expect(reaction.attack_bonus).toBeNull();
            const [slam] = resolveMonsterActions(clay, lv20Mods);
            expect(slam.attack_bonus).toBe(11);
            expect(slam.damage_dice_primary).toBe('1d8+4+5');
        });
    });

    describe('SP-038/SP-047 AC-ladder disk blocks (draconic-spirit + fey-spirit)', () => {
        const draconicSpell = summonFeySpells.find(s => s.index === 'draconic-spirit');
        const draconic = summonFeyMonsters.find(m => m.index === 'draconic-spirit');
        const feySpell = summonFeySpells.find(s => s.index === 'fey-spirit');
        const fey = summonFeyMonsters.find(m => m.index === 'fey-spirit');

        it('both RAW AC-ladder spell rows route to their blocks and both blocks carry the SP-015 armor_class_scales_with_slot opt-in', () => {
            expect(draconicSpell.description.join(' ')).toContain('AC 14 + the spell\'s level');
            expect(draconicSpell.automation).toMatchObject({ type: 'summon_spirit', baseLevel: 5, hpPerLevelAbove: 10 });
            expect(draconicSpell.automation.variants).toEqual([{ name: 'Draconic Spirit', monsterIndex: 'draconic-spirit' }]);
            expect(draconic.armor_class).toBe(14);
            expect(draconic.armor_class_scales_with_slot).toBe(true);

            expect(feySpell.description.join(' ')).toContain('AC 12 + the spell\'s level');
            expect(feySpell.automation).toMatchObject({ type: 'summon_spirit', baseLevel: 3, hpPerLevelAbove: 10 });
            expect(feySpell.automation.variants).toEqual([{ name: 'Fey Spirit', monsterIndex: 'fey-spirit' }]);
            expect(fey.armor_class).toBe(12);
            expect(fey.armor_class_scales_with_slot).toBe(true);
        });

        it('lv5 cast spawns AC 19 / HP 50 and lv6 upcast spawns AC 20 / HP 60', async () => {
            loadMonsters.mockResolvedValue(summonFeyMonsters);
            const combatSummary = getCombatSummary(mockCampaignName);
            const lv20Wizard = {
                ...mockPlayerStats,
                level: 20,
                proficiency: 6,
                spellAbilities: { toHit: 11, saveDc: 19, modifier: 5 },
            };
            const action = {
                name: 'Draconic Spirit',
                automation: draconicSpell.automation,
                spell: { ...draconicSpell },
                metaCtx: { slotLevel: 5 },
            };
            await handle(action, lv20Wizard, mockCampaignName);
            const lv5 = combatSummary.creatures.find(c => c.name?.startsWith('Draconic Spirit'));
            expect(lv5.ac).toBe(19);  // armor_class 14 + slot 5
            expect(lv5.maxHp).toBe(50);

            await handle({ ...action, metaCtx: { slotLevel: 6 } }, lv20Wizard, mockCampaignName);
            const lv6 = combatSummary.creatures.filter(c => c.name?.startsWith('Draconic Spirit')).at(-1);
            expect(lv6.ac).toBe(20);  // armor_class 14 + slot 6
            expect(lv6.maxHp).toBe(60); // 50 + 10×(6−5)
        });
    });
});
