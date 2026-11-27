// @maintained-by-ai 2026-11-26
// Deterministic mocked-seam lane; runtime store, combat summary, storage, dataLoader and
// logService are module-mocked; Date.now frozen. Pins the handler's own contract: refusal
// families with zero-spend write censuses, full caster-folded creature-row toEqual per beast,
// ordered commit censuses (exact mock.calls), combat-summary-updated-only dispatch, and the
// CLA-036 Bestial Fury double-strike gate + Hunter's Mark rider. Real diceRoller for
// rollExpression legs (totals unpinned via expect.any); rollD20 mocked for the fix#169
// initiative fallback. Disk-row fingerprint owned by MonsterAction.ma1344 sibling.
import { handle, confirmPrimalCompanionSummon, handleCommand, handleRestore, handleBonusActionCommand, applyBonusActionCommand, resolveBestialFuryStrikeGate, resolveBestialFuryMarkStrike, resolveBestialFuryBonus, BESTIAL_FURY_STRIKES_KEY, BESTIAL_FURY_MARK_LATCH_KEY } from './primalCompanionHandler.js';

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

vi.mock('../../../encounters/encounterToInitiative.js', () => ({
    getMonsterSaveBonuses: vi.fn().mockImplementation((monster) => {
        const map = { str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma' };
        const bonuses = {};
        for (const [abbr] of Object.entries(map)) {
            if (monster.saving_throws?.[abbr]?.modifier != null) {
                bonuses[abbr] = monster.saving_throws[abbr].modifier;
            } else {
                bonuses[abbr] = 0;
            }
        }
        return bonuses;
    }),
}));

import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { getCombatSummary, getCurrentCombatRound } from '../../../encounters/combatData.js';
import storage from '../../../ui/storage.js';
import { loadMonsters } from '../../../ui/dataLoader.js';

// Canonical dice lane mock (fix#169 recipe): the companion-initiative fallback
// d20 arrives via diceRoller.rollD20. Spread keeps every other diceRoller
// export REAL (markStrike lanes keep their live rollExpression semantics).
vi.mock('../../../dice/diceRoller.js', async (importOriginal) => ({
    ...(await importOriginal()),
    rollD20: vi.fn(),
}));

import { rollD20 } from '../../../dice/diceRoller.js';

// Frozen wall clock so every timestamp pin is exact (no expect.any(Number) slack).
const FROZEN_NOW = 1730000000000;

describe('primalCompanionHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Re-installed happy-path impls (clearAllMocks keeps call history clean but a
        // test-local rejection/impl must never survive into the next test).
        addEntry.mockResolvedValue({});
        getRuntimeValue.mockReturnValue(null);
        getCombatSummary.mockReturnValue(null);
        loadMonsters.mockResolvedValue([]);
        rollD20.mockReturnValue(1);
        getCurrentCombatRound.mockReturnValue(1);
        vi.spyOn(Date, 'now').mockReturnValue(FROZEN_NOW);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    const mockPlayerStats = {
        name: 'TestRanger',
        level: 5,
        proficiency: 3,
        abilities: [{ name: 'Wisdom', bonus: 3 }],
        spellAbilities: { toHit: 6, saveDc: 13, modifier: 3 },
    };
    const mockCampaignName = 'test-campaign';

    function makeAction(overrides = {}) {
        return {
            name: 'Primal Companion',
            automation: {
                type: 'primal_companion_summon',
                companionTypes: mockCompanionTypes,
                ...overrides.automation,
            },
            ...overrides,
        };
    }

    const mockMonsters = [
        {
            index: 'primal-companion-beast-of-the-sky', name: 'Primal Companion (Beast of the Sky)', type: 'beast',
            armor_class: 11, hit_points: 20, damage_resistances: [], damage_immunities: [], immunities: [],
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
            index: 'primal-companion-beast-of-the-land', name: 'Primal Companion (Beast of the Land)', type: 'beast',
            armor_class: 11, hit_points: 30, damage_resistances: [], damage_immunities: [], immunities: [],
            saving_throws: { str: { modifier: 4 }, dex: { modifier: 0 }, con: { modifier: 3 }, int: { modifier: -3 }, wis: { modifier: 2 }, cha: { modifier: -3 } },
            actions: [
                {
                    name: "Beast's Strike",
                    description: 'Melee Weapon Attack: +spell attack modifier, reach 5 ft. Hit: 1d8+2+WIS modifier Bludgeoning/Piercing/Slashing damage.',
                    attack_bonus: null,
                    reach: '5 ft.',
                    damage_dice_primary: '1d8+2+WIS modifier',
                    damage_type_primary: 'bludgeoning/piercing/slashing',
                },
                {
                    name: "Beast's Strike — Charge",
                    description: 'The beast charges forward 20 ft. The target must succeed on a DC 20 Strength saving throw or be knocked prone.',
                    save_dc: 20,
                    save_type: 'Str',
                },
            ],
        },
        {
            index: 'primal-companion-beast-of-the-sea', name: 'Primal Companion (Beast of the Sea)', type: 'beast',
            armor_class: 11, hit_points: 30, damage_resistances: [], damage_immunities: [], immunities: [],
            saving_throws: { str: { modifier: 4 }, dex: { modifier: 0 }, con: { modifier: 3 }, int: { modifier: -3 }, wis: { modifier: 2 }, cha: { modifier: -3 } },
            actions: [
                {
                    name: "Beast's Strike",
                    description: 'Melee Spell Attack: +spell attack modifier, reach 5 ft. Hit: 1d6+2+WIS modifier Bludgeoning or Piercing damage (your choice), and the target has the Grappled condition (escape DC = 8 + Proficiency Bonus + WIS modifier).',
                    attack_bonus: null,
                    reach: '5 ft.',
                    damage_dice_primary: '1d6+2+WIS modifier',
                    damage_type_primary: 'bludgeoning/piercing',
                    hit_conditions: ['grappled'],
                },
                {
                    name: "Beast's Strike — Grapple",
                    description: 'The beast lunges to grapple the target. The target must succeed on a DC 20 Wisdom saving throw or become grappled.',
                    save_dc: 20,
                    save_type: 'Wis',
                },
            ],
        },
    ];

    const mockCompanionTypes = [
        { name: 'Beast of the Land', size: 'Medium', hpBase: 5, hpPerLevel: 5, speed: '40 ft', specialSpeed: 'climb 40 ft', attacks: [{ name: "Beast's Strike", damageDice: '1d8', damageFlat: '2 + WIS modifier', damageType: 'Bludgeoning/Piercing/Slashing' }] },
        { name: 'Beast of the Sea', size: 'Medium', hpBase: 5, hpPerLevel: 5, speed: '5 ft', specialSpeed: 'swim 60 ft', attacks: [{ name: "Beast's Strike", damageDice: '1d6', damageFlat: '2 + WIS modifier', damageType: 'Bludgeoning/Piercing', onHit: 'grappled' }] },
        { name: 'Beast of the Sky', size: 'Small', hpBase: 4, hpPerLevel: 4, speed: '10 ft', specialSpeed: 'fly 60 ft', attacks: [{ name: "Beast's Strike", damageDice: '1d4', damageFlat: '3 + WIS modifier', damageType: 'Slashing' }] },
    ];

    // Caster fold for mockPlayerStats (WIS 3, spell attack +6, saveDc 13, PB 3):
    // every action row gains damage_dice_primary (empty string when the source row
    // has none) and non-null attack_bonus — the save-row artifacts are pinned honestly.
    const exceptionalTrainingRow = {
        name: 'Exceptional Training',
        description: 'Bonus Action: The beast can take the Dash, Disengage, Dodge, or Help action. It can deal Force damage instead of its normal damage type.',
    };

    describe('handle (summon)', () => {
        // Both summon-modal branches (nothing stored; stored but not on the board)
        // return the identical modal with zero writes.
        it.each([
            ['no companion stored', null, null],
            ['type stored but companion not in combat', 'Beast of the Land', { creatures: [{ name: 'TestRanger' }] }],
        ])('returns the summon modal when %s', async (_title, stored, summary) => {
            getRuntimeValue.mockReturnValue(stored);
            getCombatSummary.mockReturnValue(summary);
            const action = makeAction();

            const result = await handle(action, mockPlayerStats, mockCampaignName);

            expect(result).toEqual({
                type: 'modal',
                modalName: 'primalCompanionSummon',
                payload: { action, playerStats: mockPlayerStats, campaignName: mockCampaignName },
            });
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(storage.set).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
        });

        it('returns an info popup when the companion is stored AND on the combat board', async () => {
            getRuntimeValue.mockReturnValue('Beast of the Land');
            getCombatSummary.mockReturnValue({ creatures: [{ name: 'Primal Companion (Beast of the Land)' }] });
            const action = makeAction();

            const result = await handle(action, mockPlayerStats, mockCampaignName);

            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Primal Companion',
                    automationType: 'primal_companion_summon',
                    description: 'Primal Companion: Beast of the Land companion is active.',
                    automation: action.automation,
                },
            });
        });
    });

    describe('confirmPrimalCompanionSummon', () => {
        // Refusal family: every early-return shape must be a zero-spend write census
        // (no runtime writes, no board write, no log, no board-refresh dispatch).
        it.each([
            {
                label: 'no type selected',
                selected: null,
                description: 'No companion type selected.',
            },
            {
                label: 'unknown type',
                selected: 'Bogey Beast',
                description: 'Unknown companion type: Bogey Beast.',
            },
            {
                label: 'combat summary unavailable',
                selected: 'Beast of the Land',
                summary: null,
                description: 'Failed to load combat summary.',
            },
            {
                label: 'monster data not found',
                selected: 'Beast of the Land',
                monsters: [],
                description: 'Failed to load Beast of the Land monster data.',
            },
            {
                label: 'companionTypes config missing the selected type',
                selected: 'Beast of the Land',
                monsters: mockMonsters,
                automation: { companionTypes: [] },
                description: 'Unknown companion type: Beast of the Land.',
            },
        ])('refuses with $label: full refusal popup, zero writes, zero dispatch', async ({ selected, summary, monsters, automation, description }) => {
            getCombatSummary.mockReturnValue(summary === undefined ? { creatures: [] } : summary);
            if (monsters !== undefined) loadMonsters.mockResolvedValue(monsters);
            const action = makeAction(automation ? { automation } : {});
            const updated = vi.fn();
            const rolled = vi.fn();
            window.addEventListener('combat-summary-updated', updated);
            window.addEventListener('initiative-rolled', rolled);
            try {
                const result = await confirmPrimalCompanionSummon(action, mockPlayerStats, mockCampaignName, selected);

                // Refusal payloads carry NO automationType key (honest schema).
                expect(result).toEqual({
                    type: 'popup',
                    payload: {
                        type: 'automation_info',
                        name: 'Primal Companion',
                        description,
                        automation: action.automation,
                    },
                });
                expect(setRuntimeValue).not.toHaveBeenCalled();
                expect(storage.set).not.toHaveBeenCalled();
                expect(addEntry).not.toHaveBeenCalled();
                expect(updated).not.toHaveBeenCalled();
                expect(rolled).not.toHaveBeenCalled();
            } finally {
                window.removeEventListener('combat-summary-updated', updated);
                window.removeEventListener('initiative-rolled', rolled);
            }
        });

        // Success commit: full creature-row pin (all three beasts), ordered write
        // census, exact log entry, exact popup + logEntries, and the owner-decision
        // dispatch (PURE board refresh — never initiative-rolled, 2026-11-10).
        it.each([
            {
                type: 'Beast of the Land',
                size: 'Medium',
                hp: 30,
                speed: { walk: '40 ft', climb: 'climb 40 ft' },
                actions: [
                    {
                        name: "Beast's Strike",
                        // Prose artifact pinned honestly: '+spell attack modifier' folds to '++6'.
                        description: 'Melee Weapon Attack: ++6, reach 5 ft. Hit: 1d8+2+3 Bludgeoning/Piercing/Slashing damage.',
                        attack_bonus: 6,
                        reach: '5 ft.',
                        damage_dice_primary: '1d8+2+3',
                        damage_type_primary: 'bludgeoning/piercing/slashing',
                    },
                    {
                        // MA-1344 byte-inert: rows without authored hit_conditions never gain escape_dc.
                        name: "Beast's Strike — Charge",
                        description: 'The beast charges forward 20 ft. The target must succeed on a DC 20 Strength saving throw or be knocked prone.',
                        save_dc: 13,
                        save_type: 'Str',
                        damage_dice_primary: '',
                        attack_bonus: 6,
                    },
                    exceptionalTrainingRow,
                ],
            },
            {
                type: 'Beast of the Sea',
                size: 'Medium',
                hp: 30,
                speed: { walk: '5 ft', swim: 'swim 60 ft' },
                actions: [
                    {
                        name: "Beast's Strike",
                        description: 'Melee Spell Attack: ++6, reach 5 ft. Hit: 1d6+2+3 Bludgeoning or Piercing damage (your choice), and the target has the Grappled condition (escape DC = 8 + Proficiency Bonus + 3).',
                        attack_bonus: 6,
                        reach: '5 ft.',
                        damage_dice_primary: '1d6+2+3',
                        damage_type_primary: 'bludgeoning/piercing',
                        hit_conditions: ['grappled'],
                        // MA-1344: caster-folded grapple escape DC (8 + PB 3 + WIS 3).
                        escape_dc: 14,
                    },
                    {
                        name: "Beast's Strike — Grapple",
                        description: 'The beast lunges to grapple the target. The target must succeed on a DC 20 Wisdom saving throw or become grappled.',
                        save_dc: 13,
                        save_type: 'Wis',
                        damage_dice_primary: '',
                        attack_bonus: 6,
                    },
                    exceptionalTrainingRow,
                ],
            },
            {
                type: 'Beast of the Sky',
                size: 'Small',
                hp: 24,
                speed: { walk: '10 ft', fly: 'fly 60 ft' },
                actions: [
                    {
                        // Honest divergence pin: the cs row folds from MONSTER data
                        // (1d8+2+WIS), NOT from the config's attacks (1d4, 3+WIS) —
                        // the config attacks[] is never consulted for row building.
                        name: "Beast's Strike",
                        description: 'Melee Weapon Attack: ++6, reach 5 ft. Hit: 1d8+2+3 Piercing damage.',
                        attack_bonus: 6,
                        reach: '5 ft.',
                        damage_dice_primary: '1d8+2+3',
                        damage_type_primary: 'piercing',
                    },
                    exceptionalTrainingRow,
                ],
            },
        ])('summons $type: full caster-folded row, ordered commit census, one board refresh', async ({ type, size, hp, speed, actions }) => {
            getRuntimeValue.mockImplementation((scope, key) => {
                if (scope === 'campaign' && key === 'targetEffects') return [];
                return null;
            });
            getCombatSummary.mockReturnValue({ creatures: [{ name: 'TestRanger', initiative: '15', initiativeBonus: 2 }] });
            loadMonsters.mockResolvedValue(mockMonsters);
            const action = makeAction();
            const displayName = `Primal Companion (${type})`;
            const updated = vi.fn();
            const rolled = vi.fn();
            window.addEventListener('combat-summary-updated', updated);
            window.addEventListener('initiative-rolled', rolled);
            try {
                const result = await confirmPrimalCompanionSummon(action, mockPlayerStats, mockCampaignName, type);

                expect(result).toEqual({
                    type: 'popup',
                    payload: {
                        type: 'automation_info',
                        name: 'Primal Companion',
                        automationType: 'primal_companion_summon',
                        description: `TestRanger summons a Primal Companion (${type}). It acts on your turn, right after you.`,
                        automation: action.automation,
                    },
                    logEntries: [{
                        type: 'summons',
                        characterName: 'TestRanger',
                        summonName: 'Primal Companion',
                        description: `TestRanger summons a Primal Companion (${type}).`,
                        summonedCreatures: [displayName],
                        timestamp: FROZEN_NOW,
                    }],
                });

                // Board row: everything the caster fold owes the combat summary.
                expect(storage.set.mock.calls).toEqual([['combatSummary', expect.any(Object), mockCampaignName]]);
                const cs = storage.set.mock.calls[0][1];
                expect(cs.creatures.map(c => c.name)).toEqual(['TestRanger', displayName]); // init 15 sorts above 14.9
                expect(cs.creatures.find(c => c.name === displayName)).toEqual({
                    name: displayName,
                    type: 'npc',
                    monsterType: 'beast',
                    initiative: '14.9', // String(caster init 15 − 0.1): acts right after the caster
                    targetName: null,
                    ac: 16, // 13 + WIS 3
                    resistances: [],
                    immunities: [],
                    concentration: null,
                    maxHp: hp,
                    currentHp: hp,
                    saveBonuses: { str: 7, dex: 3, con: 6, int: 0, wis: 5, cha: 0 }, // monster saves + PB 3
                    monsterIndex: `primal-companion-beast-of-the-${type.split(' of the ')[1].toLowerCase()}`,
                    size,
                    speed,
                    actions,
                    summonedBy: 'TestRanger',
                    bestialFury: false, // mockPlayerStats lacks the feature — stamp stays false
                });

                // Ordered commit census: summoned effect, then type, then alive.
                expect(setRuntimeValue.mock.calls).toEqual([
                    ['campaign', 'targetEffects', [{ target: displayName, source: 'TestRanger', effect: 'summoned' }], mockCampaignName],
                    ['TestRanger', 'primalCompanionType', type, mockCampaignName],
                    ['TestRanger', 'primalCompanionAlive', true, mockCampaignName],
                ]);
                expect(addEntry.mock.calls).toEqual([[mockCampaignName, {
                    type: 'summons',
                    characterName: 'TestRanger',
                    summonName: 'Primal Companion',
                    description: `TestRanger summons a Primal Companion (${type}).`,
                    summonedCreatures: [displayName],
                    timestamp: FROZEN_NOW,
                }]]);
                // Caster initiative present: the dice-backed fallback is untouched.
                expect(rollD20).not.toHaveBeenCalled();
                // PURE board refresh — never the new-combat-reset event whose
                // mount-scoped consumers wipe pendingOAs / round flags / marks.
                expect(updated).toHaveBeenCalledTimes(1);
                expect(rolled).not.toHaveBeenCalled();
            } finally {
                window.removeEventListener('combat-summary-updated', updated);
                window.removeEventListener('initiative-rolled', rolled);
            }
        });

        it('rolls the companion initiative through the canonical rollD20 lane when the caster has no initiative (fix#169)', async () => {
            getRuntimeValue.mockImplementation((scope, key) => {
                if (scope === 'campaign' && key === 'targetEffects') return [];
                return null;
            });
            getCombatSummary.mockReturnValue({ creatures: [{ name: 'TestRanger', initiative: '', initiativeBonus: 2 }] });
            loadMonsters.mockResolvedValue(mockMonsters);
            rollD20.mockReturnValue(7);

            await confirmPrimalCompanionSummon(makeAction(), mockPlayerStats, mockCampaignName, 'Beast of the Land');

            // rollD20() + casterInitBonus 2 = 9; buildPrimalCompanionCreature writes String(init − 0.1).
            expect(rollD20.mock.calls).toEqual([[]]);
            const summonedCreature = storage.set.mock.calls[0][1].creatures.find(c => c.name === 'Primal Companion (Beast of the Land)');
            expect(summonedCreature.initiative).toBe('8.9');
        });

        it('never duplicates the summoned targetEffect on a re-summon', async () => {
            getRuntimeValue.mockImplementation((scope, key) => {
                if (scope === 'campaign' && key === 'targetEffects') {
                    return [{ target: 'Primal Companion (Beast of the Land)', source: 'TestRanger', effect: 'summoned' }];
                }
                return null;
            });
            getCombatSummary.mockReturnValue({ creatures: [{ name: 'TestRanger', initiative: '15', initiativeBonus: 2 }] });
            loadMonsters.mockResolvedValue(mockMonsters);

            await confirmPrimalCompanionSummon(makeAction(), mockPlayerStats, mockCampaignName, 'Beast of the Land');

            expect(setRuntimeValue.mock.calls[0]).toEqual([
                'campaign',
                'targetEffects',
                [{ target: 'Primal Companion (Beast of the Land)', source: 'TestRanger', effect: 'summoned' }],
                mockCampaignName,
            ]);
        });
    });

    describe('handleCommand', () => {
        it('returns the command popup and writes nothing when the player lacks Bestial Fury', async () => {
            getRuntimeValue.mockImplementation((scope, key) =>
                (scope === 'TestRanger' && key === 'primalCompanionType') ? 'Beast of the Sky' : null
            );
            const action = makeAction({ automation: { type: 'primal_companion_command' } });

            const result = await handleCommand(action, mockPlayerStats, mockCampaignName);

            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Primal Companion',
                    automationType: 'primal_companion_command',
                    description: "Primal Companion: Commanded Beast of the Sky to use Beast's Strike.",
                    automation: action.automation,
                },
            });
            // Non-Fury command: no strike counter, no grant log (zero-spend census).
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
        });

        // Bestial Fury is detected through three feature locations; major.features
        // is pinned by the CLA-036 arming census below — this family covers the other two.
        it.each([
            ['class levels', {
                name: 'TestRanger',
                class: { class_levels: [{ features: [{ name: 'Extra Attack' }, { name: 'Bestial Fury' }] }] },
            }],
            ['subclass levels', {
                name: 'TestRanger',
                class: {
                    class_levels: [{ features: [{ name: 'Extra Attack' }] }],
                    subclass: { class_levels: [{ features: [{ name: 'Bestial Fury' }] }] },
                },
            }],
        ])('notes double-strike when the feature comes from %s', async (_source, stats) => {
            getRuntimeValue.mockImplementation((scope, key) =>
                (key === 'primalCompanionType') ? 'Beast of the Land' : null
            );
            const action = makeAction({ automation: { type: 'primal_companion_command' } });

            const result = await handleCommand(action, stats, mockCampaignName);

            expect(result.payload.description).toBe("Primal Companion: Commanded Beast of the Land to use Beast's Strike. Bestial Fury: beast attacks twice!");
        });

        it('refuses when no companion is summoned (zero writes)', async () => {
            const action = makeAction({ automation: { type: 'primal_companion_command' } });

            const result = await handleCommand(action, mockPlayerStats, mockCampaignName);

            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Primal Companion',
                    description: 'No primal companion summoned.',
                    automation: action.automation,
                },
            });
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
        });
    });

    describe('handleRestore', () => {
        it('flips primalCompanionAlive exactly once and returns the restored popup', async () => {
            getRuntimeValue.mockReturnValue('Beast of the Land');
            const action = makeAction({ automation: { type: 'primal_companion_restore', spellSlotCost: true } });

            const result = await handleRestore(action, mockPlayerStats, mockCampaignName);

            expect(setRuntimeValue.mock.calls).toEqual([
                ['TestRanger', 'primalCompanionAlive', true, mockCampaignName],
            ]);
            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Primal Companion',
                    automationType: 'primal_companion_restore',
                    description: 'Primal Companion: Beast of the Land restored with full HP after 1 minute.',
                    automation: action.automation,
                },
            });
            // Pin of record: the restore lane logs nothing to the campaign log.
            expect(addEntry).not.toHaveBeenCalled();
        });

        it('refuses when no companion exists (zero writes)', async () => {
            const action = makeAction({ automation: { type: 'primal_companion_restore' } });

            const result = await handleRestore(action, mockPlayerStats, mockCampaignName);

            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Primal Companion',
                    description: 'No primal companion to restore.',
                    automation: action.automation,
                },
            });
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });
    });

    describe('bonus action command (Exceptional Training)', () => {
        const trainingAction = (automation = {}) => makeAction({
            name: 'Exceptional Training',
            automation: { type: 'primal_companion_bonus_action_command', ...automation },
        });

        it('opens the command modal when a companion is summoned', async () => {
            getRuntimeValue.mockReturnValue('Beast of the Land');
            const action = trainingAction({ forceDamageOption: true });

            const result = await handleBonusActionCommand(action, mockPlayerStats, mockCampaignName);

            expect(result).toEqual({
                type: 'modal',
                modalName: 'primalCompanionBonusActionCommand',
                payload: { action, playerStats: mockPlayerStats, campaignName: mockCampaignName, companionType: 'Beast of the Land' },
            });
        });

        it('refuses both modal-open and apply when no companion is summoned (zero writes)', async () => {
            const refusal = {
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Exceptional Training',
                    description: 'No primal companion to command.',
                    automation: trainingAction().automation,
                },
            };

            expect(await handleBonusActionCommand(trainingAction(), mockPlayerStats, mockCampaignName)).toEqual(refusal);
            expect(await applyBonusActionCommand(trainingAction(), mockPlayerStats, mockCampaignName, 'Dash', false)).toEqual(refusal);
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });

        // Force-damage note matrix: note only when BOTH the toggle and the authored
        // option are on. Full popup pins; nothing in this lane writes or logs.
        it.each([
            { type: 'Beast of the Land', option: true, useForce: false, command: 'Dash', forceNote: false },
            { type: 'Beast of the Sea', option: true, useForce: true, command: 'Dodge', forceNote: true },
            { type: 'Beast of the Sky', option: false, useForce: true, command: 'Help', forceNote: false },
        ])('apply: $command (option=$option, force=$useForce) folds the Force note: $forceNote', async ({ type, option, useForce, command, forceNote }) => {
            getRuntimeValue.mockReturnValue(type);
            const action = trainingAction({ forceDamageOption: option });

            const result = await applyBonusActionCommand(action, mockPlayerStats, mockCampaignName, command, useForce);

            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Exceptional Training',
                    automationType: 'primal_companion_bonus_action_command',
                    description: `Exceptional Training: Commanded ${type} to take a ${command} action as a Bonus Action.`
                        + (forceNote ? ' Companion deals Force damage instead of its normal damage type.' : ''),
                    automation: action.automation,
                },
            });
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
        });

        it('rejects an unknown action name with "No action selected." (full shape)', async () => {
            getRuntimeValue.mockReturnValue('Beast of the Sky');
            const action = trainingAction();

            const result = await applyBonusActionCommand(action, mockPlayerStats, mockCampaignName, 'InvalidAction', false);

            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Exceptional Training',
                    description: 'No action selected.',
                    automation: action.automation,
                },
            });
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });
    });

    // CLA-036 — Bestial Fury: double-strike economy + Hunter's Mark extra-Force rider.
    describe('CLA-036 Bestial Fury lanes', () => {
        const furyPlayerStats = {
            name: 'TestRanger',
            level: 11,
            proficiency: 3,
            abilities: [{ name: 'Wisdom', bonus: 3 }],
            spellAbilities: { toHit: 9, saveDc: 16 },
            class: {
                name: 'Ranger',
                major: {
                    name: 'Beast Master',
                    features: [{
                        name: 'Bestial Fury',
                        automation: [
                            { type: 'primal_companion_double_strike', casting_time: 'passive' },
                            { type: 'primal_companion_double_strike_damage', trigger: 'companion_beasts_strike_hit', damageExpression: '1d6', damageType: 'Force', oncePerTurn: true },
                        ],
                    }],
                },
            },
        };
        const companion = 'Primal Companion (Beast of the Land)';
        let runtimeStore;
        let currentRound;

        beforeEach(() => {
            runtimeStore = {};
            currentRound = 1;
            getCurrentCombatRound.mockImplementation(() => currentRound);
            getRuntimeValue.mockImplementation((scope, key) => {
                if (scope === 'campaign' && key === 'targetEffects') return [];
                const bag = runtimeStore[scope] || {};
                return bag[key] ?? null;
            });
            setRuntimeValue.mockImplementation(async (scope, key, value) => {
                runtimeStore[scope] = runtimeStore[scope] || {};
                runtimeStore[scope][key] = value;
            });
        });

        const furyStrikeAction = () => ({
            name: "Beast's Strike",
            attack_bonus: 9,
            damage_dice_primary: '1d8+2+3',
            damage_type_primary: 'Force',
            bestial_fury_double_strike: true,
            bestial_fury_bonus: { expression: '1d6', damageType: 'Force' },
        });

        it('resolveBestialFuryBonus reads the feature automation expression, falling back to 1d6 Force', () => {
            expect(resolveBestialFuryBonus(furyPlayerStats)).toEqual({ expression: '1d6', damageType: 'Force' });
            const custom = {
                class: {
                    major: {
                        features: [{
                            name: 'Bestial Fury',
                            automation: [{ type: 'primal_companion_double_strike_damage', damageExpression: '2d8', damageType: 'Radiant' }],
                        }],
                    },
                },
            };
            expect(resolveBestialFuryBonus(custom)).toEqual({ expression: '2d8', damageType: 'Radiant' });
            expect(resolveBestialFuryBonus({ name: 'X' })).toEqual({ expression: '1d6', damageType: 'Force' });
        });

        it('Fury summon stamps the full double-strike row onto the board (save-row twin inert)', async () => {
            getCombatSummary.mockReturnValue({ creatures: [{ name: 'TestRanger', initiative: '12' }] });
            loadMonsters.mockResolvedValue(mockMonsters);

            await confirmPrimalCompanionSummon(makeAction(), furyPlayerStats, mockCampaignName, 'Beast of the Land');

            // Level 11, WIS 3, spell attack +9, saveDc 16: full Fury-folded row.
            expect(storage.set.mock.calls[0][1].creatures.find(c => c.name === companion)).toEqual({
                name: companion,
                type: 'npc',
                monsterType: 'beast',
                initiative: '11.9',
                targetName: null,
                ac: 16,
                resistances: [],
                immunities: [],
                concentration: null,
                maxHp: 60,
                currentHp: 60,
                saveBonuses: { str: 7, dex: 3, con: 6, int: 0, wis: 5, cha: 0 },
                monsterIndex: 'primal-companion-beast-of-the-land',
                size: 'Medium',
                speed: { walk: '40 ft', climb: 'climb 40 ft' },
                actions: [
                    {
                        name: "Beast's Strike",
                        // Damage-type prose folds to Force and the (twice per turn)
                        // suffix rides the WEAPON row...
                        description: 'Melee Weapon Attack: ++9, reach 5 ft. Hit: 1d8+2+3 Force damage. (can be used twice per turn)',
                        attack_bonus: 9,
                        reach: '5 ft.',
                        damage_dice_primary: '1d8+2+3',
                        damage_type_primary: 'Force',
                        bestial_fury_double_strike: true,
                        bestial_fury_bonus: { expression: '1d6', damageType: 'Force' },
                    },
                    {
                        // ...and the save-row twin honestly inherits the same prose/type
                        // fold but NEVER the gate/rider stamps.
                        name: "Beast's Strike — Charge",
                        description: 'The beast charges forward 20 ft. The target must succeed on a DC 20 Strength saving throw or be knocked prone. (can be used twice per turn)',
                        save_dc: 16,
                        save_type: 'Str',
                        damage_dice_primary: '',
                        attack_bonus: 9,
                        damage_type_primary: 'Force',
                    },
                    exceptionalTrainingRow,
                ],
                summonedBy: 'TestRanger',
                bestialFury: true,
            });
        });

        it('Fury command arms the 2-strike counter and logs the grant — exact census', async () => {
            runtimeStore['TestRanger'] = { primalCompanionType: 'Beast of the Land' };
            const action = makeAction({ automation: { type: 'primal_companion_command' } });

            const result = await handleCommand(action, furyPlayerStats, mockCampaignName);

            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Primal Companion',
                    automationType: 'primal_companion_command',
                    description: "Primal Companion: Commanded Beast of the Land to use Beast's Strike. Bestial Fury: beast attacks twice!",
                    automation: action.automation,
                },
            });
            expect(setRuntimeValue.mock.calls).toEqual([
                [companion, BESTIAL_FURY_STRIKES_KEY, { round: 1, used: 0 }, mockCampaignName],
            ]);
            expect(addEntry.mock.calls).toEqual([[mockCampaignName, {
                type: 'automation',
                automationType: 'bestial_fury_command',
                characterName: 'TestRanger',
                abilityName: 'Primal Companion',
                description: "TestRanger commands Primal Companion (Beast of the Land) to take Beast's Strike — Bestial Fury grants 2 strikes this turn.",
                timestamp: FROZEN_NOW,
            }]]);
        });

        describe('resolveBestialFuryStrikeGate (double-strike economy)', () => {
            it('is byte-inert for unstamped rows (zero write, zero log, no popup)', () => {
                const setPopupHtml = vi.fn();
                const refused = resolveBestialFuryStrikeGate({
                    campaignName: mockCampaignName, monsterName: 'Bandit 1', action: { name: 'Scimitar', attack_bonus: 4 }, setPopupHtml,
                });
                expect(refused).toBe(false);
                expect(setRuntimeValue).not.toHaveBeenCalled();
                expect(addEntry).not.toHaveBeenCalled();
                expect(setPopupHtml).not.toHaveBeenCalled();
            });

            it('allows exactly two strikes per command then refuses the third (zero extra write)', () => {
                const setPopupHtml = vi.fn();
                const press = () => resolveBestialFuryStrikeGate({
                    campaignName: mockCampaignName, monsterName: companion, action: furyStrikeAction(), setPopupHtml,
                });

                expect(press()).toBe(false);
                expect(press()).toBe(false);
                expect(setRuntimeValue.mock.calls).toEqual([
                    [companion, BESTIAL_FURY_STRIKES_KEY, { round: 1, used: 1 }, mockCampaignName],
                    [companion, BESTIAL_FURY_STRIKES_KEY, { round: 1, used: 2 }, mockCampaignName],
                ]);

                expect(press()).toBe(true);
                // Third press: no third write, popup + refusal log, zero roll seams.
                expect(setRuntimeValue.mock.calls).toHaveLength(2);
                expect(setPopupHtml.mock.calls).toEqual([[{
                    type: 'automation_info',
                    name: 'Bestial Fury',
                    description: `${companion} has already taken both Beast's Strike attacks granted by the command this turn — attack refused.`,
                }]]);
                expect(addEntry.mock.calls).toEqual([[mockCampaignName, {
                    type: 'automation',
                    automationType: 'bestial_fury_refused',
                    characterName: companion,
                    abilityName: "Beast's Strike",
                    description: `${companion}: Beast's Strike refused (bestial_fury_refused — 2 strikes already used this command).`,
                    timestamp: FROZEN_NOW,
                }]]);
            });

            it('round-wrap re-arms the counter (stale stamp reads fresh)', () => {
                runtimeStore[companion] = { [BESTIAL_FURY_STRIKES_KEY]: { round: 1, used: 2 } };
                currentRound = 2;
                const refused = resolveBestialFuryStrikeGate({
                    campaignName: mockCampaignName, monsterName: companion, action: furyStrikeAction(), setPopupHtml: vi.fn(),
                });
                expect(refused).toBe(false);
                expect(setRuntimeValue.mock.calls).toEqual([
                    [companion, BESTIAL_FURY_STRIKES_KEY, { round: 2, used: 1 }, mockCampaignName],
                ]);
            });
        });

        describe('resolveBestialFuryMarkStrike (Hunter\'s Mark rider)', () => {
            let rollDamage;

            function seedBoard(markTarget) {
                getCombatSummary.mockReturnValue({
                    creatures: [
                        { name: companion, type: 'npc', summonedBy: 'TestRanger', bestialFury: true },
                        { name: 'TestRanger', type: 'player', concentration: markTarget ? { spell: "Hunter's Mark", dc: 17, target: markTarget } : null },
                        { name: 'Bandit 1', type: 'npc' },
                    ],
                });
            }

            const autoHit = (targetName = 'Bandit 1', bonus = { expression: '1d6', damageType: 'Force' }) => ({
                name: "Beast's Strike",
                formula: '1d8+2+3',
                total: 7,
                attackerName: companion,
                targetName,
                bestialFuryRider: true,
                bestialFuryBonus: bonus,
            });

            beforeEach(() => {
                rollDamage = vi.fn().mockResolvedValue({});
            });

            it('is byte-inert when the auto-damage carries no Fury marker', async () => {
                seedBoard('Bandit 1');
                const res = await resolveBestialFuryMarkStrike({ campaignName: mockCampaignName, monsterName: 'Bandit 1', autoDamage: { name: 'Scimitar', targetName: 'ElderPaladin' }, rollDamage });
                expect(res).toBeNull();
                expect(addEntry).not.toHaveBeenCalled();
                expect(setRuntimeValue).not.toHaveBeenCalled();
                expect(rollDamage).not.toHaveBeenCalled();
            });

            // Real rollExpression (diceRoller spread mock): totals unpinned, the
            // transported expression (custom die respected) fully pinned.
            it.each([
                ['1d6', { expression: '1d6', damageType: 'Force' }],
                ['2d6', { expression: '2d6', damageType: 'Force' }],
            ])('first HIT under Hunter\'s Mark folds a separate %s leg, logs trigger + grant, latches the round', async (_label, bonus) => {
                seedBoard('Bandit 1');

                const res = await resolveBestialFuryMarkStrike({ campaignName: mockCampaignName, monsterName: companion, autoDamage: autoHit('Bandit 1', bonus), rollDamage });

                expect(rollDamage.mock.calls).toEqual([[{
                    name: "Beast's Strike — Bestial Fury",
                    formula: bonus.expression,
                    total: expect.any(Number),
                    rolls: expect.any(Array),
                    modifier: 0,
                    context: { damageType: 'Force', targetName: 'Bandit 1', attackerName: companion },
                }]]);
                expect(res.total).toBe(rollDamage.mock.calls[0][0].total);
                expect(setRuntimeValue.mock.calls).toEqual([
                    [companion, BESTIAL_FURY_MARK_LATCH_KEY, 1, mockCampaignName],
                ]);

                const logs = addEntry.mock.calls.map(c => c[1]);
                expect(logs[0]).toEqual({
                    type: 'automation',
                    automationType: 'companion_beasts_strike_hit',
                    characterName: companion,
                    abilityName: "Beast's Strike",
                    description: `${companion} hits Bandit 1 with Beast's Strike (companion_beasts_strike_hit).`,
                    timestamp: FROZEN_NOW,
                });
                expect(logs[1]).toEqual(expect.objectContaining({
                    automationType: 'bestial_fury_mark_bonus',
                    characterName: companion,
                    description: expect.stringContaining(`deals extra ${bonus.expression} Force (Hunter's Mark on Bandit 1)`),
                }));
            });

            // Rider-off branches: the trigger event ALWAYS logs; the extra die never folds.
            it.each([
                {
                    label: 'second HIT same turn (once-per-turn latch)',
                    setup: () => { runtimeStore[companion] = { [BESTIAL_FURY_MARK_LATCH_KEY]: 1 }; },
                    target: 'Bandit 1',
                    expectRefused: true,
                },
                {
                    label: 'HIT on an unmarked target',
                    setup: () => {},
                    target: 'Bandit 2',
                    expectRefused: false,
                },
                {
                    label: 'no Hunter\'s Mark concentration at all',
                    setup: () => seedBoard(null),
                    target: 'Bandit 1',
                    expectRefused: false,
                },
            ])('rider off for $label: trigger logged, zero fold', async ({ setup, target, expectRefused }) => {
                seedBoard('Bandit 1');
                setup();

                const res = await resolveBestialFuryMarkStrike({ campaignName: mockCampaignName, monsterName: companion, autoDamage: autoHit(target), rollDamage });

                expect(res).toBeNull();
                expect(rollDamage).not.toHaveBeenCalled();
                expect(setRuntimeValue).not.toHaveBeenCalled();
                const logs = addEntry.mock.calls.map(c => c[1]);
                expect(logs.find(e => e.automationType === 'companion_beasts_strike_hit')).toBeDefined();
                expect(logs.find(e => e.automationType === 'bestial_fury_mark_bonus')).toBeUndefined();
                expect(!!logs.find(e => e.automationType === 'bestial_fury_refused')).toBe(expectRefused);
            });

            it('next round re-folds (stale latch)', async () => {
                seedBoard('Bandit 1');
                runtimeStore[companion] = { [BESTIAL_FURY_MARK_LATCH_KEY]: 1 };
                currentRound = 2;

                const res = await resolveBestialFuryMarkStrike({ campaignName: mockCampaignName, monsterName: companion, autoDamage: autoHit(), rollDamage });

                expect(res).not.toBeNull();
                expect(rollDamage).toHaveBeenCalledTimes(1);
                expect(setRuntimeValue.mock.calls).toEqual([
                    [companion, BESTIAL_FURY_MARK_LATCH_KEY, 2, mockCampaignName],
                ]);
            });
        });
    });
});
