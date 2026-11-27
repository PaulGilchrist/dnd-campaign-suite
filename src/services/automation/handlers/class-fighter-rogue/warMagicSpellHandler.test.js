// @maintained-by-ai 2026-11-26 — deterministic: all dependencies mocked at module
// boundaries (bare vi.fn() factories — default impls installed in beforeEach
// after resetAllMocks, never factory-baked), full-shape result/log pins for
// this handler's own composition (slot expenditure, Magic Missile auto-hit,
// shield block, save/attack lanes, weapon-attack rider arms), exact-string
// popup pins, timestamps via expect.any(Number), no timers/DOM; no churn
// required when the app changes.
// CLA-381 twin: the SPELL half (slot payment, weapon-attack rider, casting_time
// token law owned here as the canonical export). Refusal-popup and save-prompt
// shapes mirror the cantrip twin (warMagicCantripHandler.test.js); this lane
// pins its own strings/census because the spell refusal path writes NO
// war_magic_refused log (buildConfirmRefusalPopup is popup-only).
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { handle, confirmWarMagicSpell, isActionCastingTime } from './warMagicSpellHandler.js'
import { addEntry } from '../../../ui/logService.js'
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js'
import { getCombatSummary } from '../../../encounters/combatData.js'
import { getTargetFromAttacker } from '../../../rules/combat/damageUtils.js'
import { applyDamageToTarget } from '../../../rules/combat/applyDamage.js'
import { rollD20, rollExpression, rollExpressionDoubled } from '../../../dice/diceRoller.js'
import { isWithinRange } from '../../../rules/combat/rangeCheck.js'
import { createSaveListener } from '../../common/savePrompt.js'
import { endInvisibilityOnHostileAction } from '../../../rules/features/invisibilityService.js'
import { loadSpellData } from '../../../ui/dataLoader.js'

vi.mock('../../../ui/dataLoader.js', () => ({
    loadSpellData: vi.fn(),
    loadWildMagicSurgeTable: vi.fn(),
}))

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(),
}))

vi.mock('../../../dice/diceRoller.js', () => ({
    rollD20: vi.fn(),
    rollExpression: vi.fn(),
    rollExpressionDoubled: vi.fn(),
}))

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}))

vi.mock('../../../encounters/combatData.js', () => ({
    getCombatSummary: vi.fn(),
}))

// NOTE: no getCombatContext here — the spell lane has no once-per-turn latch
// (unlike the cantrip twin); its absence pins that the latch never runs here.
vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getTargetFromAttacker: vi.fn(),
}))

vi.mock('../../../rules/combat/applyDamage.js', () => ({
    applyDamageToTarget: vi.fn(),
}))

vi.mock('../../../rules/combat/rangeCheck.js', () => ({
    isWithinRange: vi.fn(),
}))

vi.mock('../../common/savePrompt.js', () => ({
    createSaveListener: vi.fn(),
    buildSaveDc: vi.fn(),
}))

vi.mock('../../../rules/features/invisibilityService.js', () => ({
    endInvisibilityOnHostileAction: vi.fn(),
}))

vi.mock('../../../ui/utils.js', () => ({
    DEBUG_FORCE_CRIT: false,
}))

const mockCampaignName = 'test-campaign'

const magicMissile = {
    name: 'Magic Missile',
    level: 1,
    casting_time: 'Action',
    range: '120 feet',
    description: 'Three darts of force.',
    damage: { damage_type: 'Force', damage_at_slot_level: { 1: '1d4 + 1' } },
    dc: null,
}

// Level 2 so the save lane also pins own-slot payment (spell_slots_level_2).
const burningHands = {
    name: 'Burning Hands',
    level: 2,
    casting_time: 'Action',
    range: 'Self (15-foot cone)',
    description: 'A fan of flame.',
    damage: { damage_type: 'Fire', damage_at_slot_level: { 2: '4d6' } },
    dc: { dc_type: 'DEX', dc_success: 'half' },
}

// No dc, not auto-hit → spell-attack lane.
const scorchingRay = {
    name: 'Scorching Ray',
    level: 2,
    casting_time: 'Action',
    range: '120 feet',
    description: 'Rays of fire.',
    damage: { damage_type: 'Fire', damage_at_slot_level: { 2: '2d6' } },
    dc: null,
}

const combatSummary = {
    creatures: [
        { name: 'TestFighter', targetName: 'Wight 1' },
        { name: 'Wight 1', ac: 12, currentHp: 50, maxHp: 58 },
    ],
}

const attacks = [{ hitBonus: 5, damage: '1d6+2', damageType: 'Piercing' }]

const applyOpts = { campaignName: mockCampaignName, characters: [], ignoreResistance: false, attackerName: 'TestFighter' }

function makeAction(overrides = {}) {
    return {
        name: 'War Magic',
        automation: { type: 'war_magic_spell', maxSpellLevel: 2 },
        ...overrides,
    }
}

function makePlayerStats(overrides = {}) {
    return { name: 'TestFighter', rules: '2024', ...overrides }
}

const logEntries = () => addEntry.mock.calls.map(c => c[1])

function setupConfirm({ spells = [magicMissile], target = { name: 'Wight 1' }, inRange = true, slots = 3, targetBuffs = [] } = {}) {
    loadSpellData.mockResolvedValue(spells)
    getCombatSummary.mockReturnValue(combatSummary)
    getTargetFromAttacker.mockReturnValue(target)
    isWithinRange.mockResolvedValue(inRange)
    getRuntimeValue.mockImplementation((key, subKey) => {
        if (subKey.startsWith('spell_slots_level_')) return slots
        if (subKey === 'characters') return []
        if (subKey === 'activeBuffs') return key === 'Wight 1' ? targetBuffs : []
        return null
    })
    rollD20.mockReturnValue(15)
    rollExpression.mockImplementation(() => ({ total: 5, rolls: [4, 1], modifier: 1 }))
    rollExpressionDoubled.mockImplementation(() => ({ total: 12, rolls: [4, 1, 4, 1], modifier: 2 }))
    applyDamageToTarget.mockImplementation((_cs, _t, raw) => ({ finalDamage: raw }))
}

describe('warMagicSpellHandler', () => {
    beforeEach(() => {
        vi.resetAllMocks()
        addEntry.mockResolvedValue(undefined)
        setRuntimeValue.mockResolvedValue(undefined)
        isWithinRange.mockResolvedValue(true)
        getRuntimeValue.mockReturnValue(null)
    })

    describe('handle (chooser)', () => {
        it('opens the chooser with a full-shape payload: level 1-2 action-casting spells only, detail defaults applied, malformed rows excluded loudly', async () => {
            const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
            loadSpellData.mockResolvedValue([
                { name: 'Burning Hands', level: 1, casting_time: 'Action', range: 'Self (15-foot cone)', description: 'A fan of flame.', damage: '3d6 fire' },
                { name: 'Old Spell', level: 1, casting_time: '1 action' }, // 5e token; optional fields default
                { name: 'Web', level: 2, casting_time: 'Action or Ritual', description: 'Mass of webs.' },
                { name: 'Ray of Frost', level: 0, casting_time: 'Action' },        // cantrip — cantrip lane
                { name: 'Fireball', level: 3, casting_time: 'Action' },            // above maxSpellLevel
                { name: 'Mystery Spell', casting_time: 'Action' },                 // level undefined
                { name: 'Negative Spell', level: -1, casting_time: 'Action' },     // malformed level
                { name: 'Shield', level: 1, casting_time: 'Reaction' },            // gate
                { name: 'Healing Word', level: 1, casting_time: '1 bonus action' },// gate
                { name: 'Ghost Spell', level: 1 },                                 // malformed: no casting_time
            ])
            const action = makeAction()
            const playerStats = makePlayerStats()

            const result = await handle(action, playerStats, mockCampaignName)

            expect(result).toEqual({
                type: 'modal',
                modalName: 'warMagicSpell',
                payload: {
                    action,
                    playerStats,
                    campaignName: mockCampaignName,
                    options: ['Burning Hands', 'Old Spell', 'Web'],
                    optionDetails: {
                        'Burning Hands': {
                            name: 'Burning Hands', level: 1, casting_time: 'Action',
                            range: 'Self (15-foot cone)', description: 'A fan of flame.', damage: '3d6 fire',
                        },
                        'Old Spell': {
                            name: 'Old Spell', level: 1, casting_time: '1 action',
                            range: '', description: '', damage: null,
                        },
                        'Web': {
                            name: 'Web', level: 2, casting_time: 'Action or Ritual',
                            range: '', description: 'Mass of webs.', damage: null,
                        },
                    },
                    spellListKey: 'wizard_spells',
                    maxSpellLevel: 2,
                },
            })
            // malformed row excluded LOUDLY (no-fallbacks law), not silently offered
            expect(spy).toHaveBeenCalledWith(expect.stringContaining('Ghost Spell'))
            spy.mockRestore()
        })

        it.each([
            ['Action', true],
            ['1 action', true],
            ['action', true],
            ['1 Action', true],
            ['Action or Ritual', true],
            ['1 action or ritual', true],
            ['Reaction', false],
            ['1 reaction', false],
            ['Bonus Action', false],
            ['1 bonus action', false],
        ])('isActionCastingTime(%j) is %s', (castingTime, expected) => {
            // Canonical token law shared by the cantrip twin (it imports this).
            expect(isActionCastingTime(castingTime)).toBe(expected)
        })

        it.each([null, []])('refuses to open when the spell list is %j (full-shape popup, nothing logged)', async (spellList) => {
            loadSpellData.mockResolvedValue(spellList)

            const result = await handle(makeAction(), makePlayerStats(), mockCampaignName)

            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'War Magic',
                    description: 'No Wizard spells available.',
                },
            })
            expect(addEntry.mock.calls).toEqual([])
        })

        it.each([
            { label: 'only cantrips and above-max spells', spells: [{ name: 'Ray of Frost', level: 0, casting_time: 'Action' }, { name: 'Fireball', level: 3, casting_time: 'Action' }] },
            { label: 'every level-eligible spell fails the casting gate', spells: [{ name: 'Shield', level: 1, casting_time: 'Reaction' }, { name: 'Misty Step', level: 2, casting_time: 'Bonus Action' }] },
        ])('refuses the chooser when $label (level 1-2 wording)', async ({ spells }) => {
            loadSpellData.mockResolvedValue(spells)

            const result = await handle(makeAction(), makePlayerStats(), mockCampaignName)

            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'War Magic',
                    description: 'No Wizard spells of level 1-2 available.',
                },
            })
        })

        it('honors custom spellList and maxSpellLevel from automation config', async () => {
            loadSpellData.mockResolvedValue([
                { name: 'Burning Hands', level: 1, casting_time: 'Action' },
                { name: 'Fireball', level: 3, casting_time: 'Action' },
            ])

            const result = await handle(
                makeAction({ automation: { type: 'war_magic_spell', maxSpellLevel: 3, spellList: 'sorcerer_spells' } }),
                makePlayerStats(),
                mockCampaignName
            )

            expect(result.payload.spellListKey).toBe('sorcerer_spells')
            expect(result.payload.maxSpellLevel).toBe(3)
            expect(result.payload.options).toEqual(['Burning Hands', 'Fireball'])
        })
    })

    describe('confirmWarMagicSpell', () => {
        it.each([
            [null, 'No spell selected.'],
            [undefined, 'No spell selected.'],
            ['', 'No spell selected.'],
        ])('refuses selection %j with %j before touching spell data', async (selection, description) => {
            const result = await confirmWarMagicSpell(makeAction(), makePlayerStats(), mockCampaignName, selection)

            expect(result).toEqual({
                type: 'popup',
                payload: { type: 'automation_info', name: 'War Magic', description },
            })
            expect(loadSpellData.mock.calls).toEqual([])
            expect(addEntry.mock.calls).toEqual([])
            expect(setRuntimeValue.mock.calls).toEqual([])
            expect(applyDamageToTarget.mock.calls).toEqual([])
        })

        it('refuses an unknown spell name with a not-found popup and writes nothing', async () => {
            loadSpellData.mockResolvedValue([])

            const result = await confirmWarMagicSpell(makeAction(), makePlayerStats(), mockCampaignName, 'Unknown Spell')

            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'War Magic',
                    description: 'Spell "Unknown Spell" not found.',
                },
            })
            expect(addEntry.mock.calls).toEqual([])
            expect(setRuntimeValue.mock.calls).toEqual([])
            expect(applyDamageToTarget.mock.calls).toEqual([])
        })

        it.each([
            {
                label: 'a non-action spell (before the target check)',
                setup: { spells: [{ ...magicMissile, name: 'Shield', casting_time: 'Reaction' }] },
                spellName: 'Shield',
                description: 'Shield casts as Reaction — War Magic replaces the Attack action, so only action-casting spells qualify.',
                noCombatLookup: true,
            },
            {
                label: 'no target armed on the initiative card',
                setup: { target: null },
                spellName: 'Magic Missile',
                description: 'War Magic requires a target — set the Target dropdown on your initiative card first.',
            },
            {
                label: 'an armed target out of range',
                setup: { inRange: false },
                spellName: 'Magic Missile',
                description: 'Wight 1 is out of range for Magic Missile (120 feet).',
                expectRangeFeet: 120,
            },
            {
                label: 'no spell slots of the spell level',
                setup: { slots: 0 },
                spellName: 'Magic Missile',
                description: 'No level 1 spell slots available to cast Magic Missile.',
            },
        ])('refuses $label with a side-effect-free popup and zero spend', async ({ setup, spellName, description, noCombatLookup, expectRangeFeet }) => {
            setupConfirm(setup)

            const result = await confirmWarMagicSpell(makeAction(), makePlayerStats(), mockCampaignName, spellName)

            expect(result).toEqual({
                type: 'popup',
                payload: { type: 'automation_info', name: 'War Magic', description },
            })
            expect(addEntry.mock.calls).toEqual([])
            expect(setRuntimeValue.mock.calls).toEqual([])
            expect(applyDamageToTarget.mock.calls).toEqual([])
            if (noCombatLookup) {
                // The casting gate runs before any combat state is touched.
                expect(getCombatSummary.mock.calls).toEqual([])
                expect(getTargetFromAttacker.mock.calls).toEqual([])
            }
            if (expectRangeFeet !== undefined) {
                expect(isWithinRange).toHaveBeenCalledWith('TestFighter', 'Wight 1', expectRangeFeet)
            }
        })

        it('resolves Magic Missile end-to-end: pays the slot, 3 auto-hit darts, weapon rider, ordered full-shape logs', async () => {
            setupConfirm()
            const action = makeAction()
            const playerStats = makePlayerStats({ attacks })

            const result = await confirmWarMagicSpell(action, playerStats, mockCampaignName, 'Magic Missile')

            expect(isWithinRange).toHaveBeenCalledWith('TestFighter', 'Wight 1', 120)
            // Slot paid at the spell's own level before any resolution.
            expect(setRuntimeValue.mock.calls).toEqual([['TestFighter', 'spell_slots_level_1', 2, mockCampaignName]])
            // 3 darts × (1d4+1 → 5) = 15 Force, then the weapon attack — in order.
            expect(rollExpression.mock.calls).toEqual([['1d4 + 1'], ['1d4 + 1'], ['1d4 + 1'], ['1d6+2']])
            expect(rollExpressionDoubled.mock.calls).toEqual([])
            expect(applyDamageToTarget.mock.calls).toEqual([
                [combatSummary, 'Wight 1', 15, ['Force'], applyOpts],
                [combatSummary, 'Wight 1', 5, ['Piercing'], applyOpts],
            ])
            expect(endInvisibilityOnHostileAction.mock.calls).toEqual([
                ['TestFighter', mockCampaignName],
                ['TestFighter', mockCampaignName],
            ])
            // Full-shape ordered commit census: ability_use → spell damage → attack → weapon damage.
            expect(logEntries()).toEqual([
                {
                    type: 'ability_use',
                    characterName: 'TestFighter',
                    abilityName: 'War Magic',
                    description: 'War Magic: Expended a level 1 spell slot to cast "Magic Missile" at Wight 1.',
                },
                {
                    type: 'roll',
                    characterName: 'TestFighter',
                    rollType: 'damage',
                    name: 'Magic Missile (Wight 1)',
                    formula: '3× 1d4 + 1',
                    rolls: [5, 5, 5],
                    total: 15,
                    damageType: 'Force',
                    targetName: 'Wight 1',
                    finalDamage: 15,
                    isAutoHit: true,
                    timestamp: expect.any(Number),
                },
                {
                    type: 'roll',
                    characterName: 'TestFighter',
                    rollType: 'attack',
                    name: 'War Magic (weapon attack)',
                    rolls: [15],
                    total: 20,
                    bonus: 5,
                    isNatural20: false,
                    isNatural1: false,
                    targetName: 'Wight 1',
                    targetAc: 12,
                    damageType: 'Piercing',
                    hit: true,
                    isCrit: false,
                    timestamp: expect.any(Number),
                },
                {
                    type: 'roll',
                    characterName: 'TestFighter',
                    rollType: 'damage',
                    name: 'War Magic (weapon attack)',
                    formula: '1d6+2',
                    rolls: [4, 1],
                    total: 5,
                    modifier: 1,
                    damageType: 'Piercing',
                    targetName: 'Wight 1',
                    finalDamage: 5,
                    isCrit: false,
                    timestamp: expect.any(Number),
                },
            ])
            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'War Magic',
                    automationType: 'war_magic_spell',
                    description: '<b>War Magic</b>: Cast <b>Magic Missile</b> (level 1 spell slot expended) at <b>Wight 1</b>. Spell dealt <b>15</b> Force damage.<br/>Weapon attack: Hit — d20(15) + 5 = 20 vs AC 12, 5 Piercing damage',
                    automation: action.automation,
                },
            })
        })

        it('blocks Magic Missile entirely against a Shield-buffed target — slot still paid, weapon rider still fires', async () => {
            setupConfirm({ targetBuffs: [{ effect: 'shield' }] })

            const result = await confirmWarMagicSpell(makeAction(), makePlayerStats(), mockCampaignName, 'Magic Missile')

            // Blocked before any dart is rolled; slot and weapon attack proceed.
            expect(rollExpression.mock.calls).toEqual([['1d4+0']])
            expect(setRuntimeValue.mock.calls).toEqual([['TestFighter', 'spell_slots_level_1', 2, mockCampaignName]])
            expect(applyDamageToTarget.mock.calls).toEqual([
                [combatSummary, 'Wight 1', 5, ['Slashing'], applyOpts],
            ])
            expect(result.payload.description).toBe('<b>War Magic</b>: Cast <b>Magic Missile</b> (level 1 spell slot expended) at <b>Wight 1</b>. Spell dealt no damage.<br/>Weapon attack: Hit — d20(15) + 0 = 15 vs AC 12, 5 Slashing damage')
        })

        it('pays the level-2 slot and arms the save prompt with full DC context for a save spell', async () => {
            setupConfirm({ spells: [burningHands] })
            createSaveListener.mockReturnValue({ promptId: 'p', promise: Promise.resolve({ success: true }) })

            await confirmWarMagicSpell(makeAction(), makePlayerStats(), mockCampaignName, 'Burning Hands')

            expect(isWithinRange).toHaveBeenCalledWith('TestFighter', 'Wight 1', null) // Self range parses to null
            expect(setRuntimeValue.mock.calls).toEqual([['TestFighter', 'spell_slots_level_2', 2, mockCampaignName]])
            expect(createSaveListener).toHaveBeenCalledTimes(1)
            // saveDc falls back to 8 + proficiency (unset here → 8)
            expect(createSaveListener).toHaveBeenCalledWith(mockCampaignName, {
                targetName: 'Wight 1',
                attackerName: 'TestFighter',
                saveType: 'DEX',
                saveDc: 8,
                sourceName: 'War Magic — Burning Hands',
            })
        })

        it.each([
            {
                label: 'a successful save rolls no spell damage but still pays and attacks',
                promise: () => Promise.resolve({ success: true }),
                expectedRolls: [['1d4+0']],
                expectedApply: [
                    [combatSummary, 'Wight 1', 5, ['Slashing'], applyOpts],
                ],
                description: '<b>War Magic</b>: Cast <b>Burning Hands</b> (level 2 spell slot expended) at <b>Wight 1</b>. Spell dealt no damage.<br/>Weapon attack: Hit — d20(15) + 0 = 15 vs AC 12, 5 Slashing damage',
            },
            {
                label: 'a failed half save applies floor-halved damage (4d6 → 5 → 2)',
                promise: () => Promise.resolve({ success: false }),
                // real resolveSpellDamageAtLevel picks the level-2 formula '4d6'
                expectedRolls: [['4d6'], ['1d4+0']],
                expectedApply: [
                    [combatSummary, 'Wight 1', 2, ['Fire'], applyOpts],
                    [combatSummary, 'Wight 1', 5, ['Slashing'], applyOpts],
                ],
                description: '<b>War Magic</b>: Cast <b>Burning Hands</b> (level 2 spell slot expended) at <b>Wight 1</b>. Spell dealt <b>2</b> Fire damage.<br/>Weapon attack: Hit — d20(15) + 0 = 15 vs AC 12, 5 Slashing damage',
            },
        ])('runs the save lane for save spells: $label', async ({ promise, expectedRolls, expectedApply, description }) => {
            setupConfirm({ spells: [burningHands] })
            createSaveListener.mockReturnValue({ promptId: 'p', promise: promise() })

            const result = await confirmWarMagicSpell(makeAction(), makePlayerStats(), mockCampaignName, 'Burning Hands')

            expect(result.payload.description).toBe(description)
            expect(rollExpression.mock.calls).toEqual(expectedRolls)
            expect(applyDamageToTarget.mock.calls).toEqual(expectedApply)
            expect(setRuntimeValue.mock.calls).toEqual([['TestFighter', 'spell_slots_level_2', 2, mockCampaignName]])
        })

        it('resolves a spell-attack spell against the card target AC and skips the save prompt', async () => {
            setupConfirm({ spells: [scorchingRay] })

            const result = await confirmWarMagicSpell(makeAction(), makePlayerStats({ spellAbilities: { toHit: 7 } }), mockCampaignName, 'Scorching Ray')

            // d20(15) + 7 = 22 vs AC 12 → hit, 2d6 (→ 5) Fire applied; d20 rolls for
            // the spell attack and again for the weapon rider.
            expect(rollD20.mock.calls).toEqual([[], []])
            expect(createSaveListener.mock.calls).toEqual([])
            expect(rollExpression.mock.calls).toEqual([['2d6'], ['1d4+0']])
            expect(applyDamageToTarget.mock.calls).toEqual([
                [combatSummary, 'Wight 1', 5, ['Fire'], applyOpts],
                [combatSummary, 'Wight 1', 5, ['Slashing'], applyOpts],
            ])
            const spellDamageLog = logEntries().find(e => e.rollType === 'damage' && e.damageType === 'Fire')
            expect(spellDamageLog).toEqual({
                type: 'roll',
                characterName: 'TestFighter',
                rollType: 'damage',
                name: 'Scorching Ray (Wight 1)',
                formula: '2d6 (spell attack hit)',
                rolls: [4, 1],
                total: 5,
                damageType: 'Fire',
                targetName: 'Wight 1',
                finalDamage: 5,
                isAutoHit: false,
                timestamp: expect.any(Number),
            })
            expect(result.payload.description).toContain('Spell dealt <b>5</b> Fire damage.')
        })

        it.each([
            {
                label: 'a natural 1',
                d20: 1,
                weaponLine: 'Weapon attack: Miss — d20(1) + 5 = 6 vs AC 12',
                expectedRolls: [['1d4 + 1'], ['1d4 + 1'], ['1d4 + 1']],
                expectedApply: [
                    [combatSummary, 'Wight 1', 15, ['Force'], applyOpts],
                ],
            },
            {
                label: 'a critical hit',
                d20: 20,
                weaponLine: 'Weapon attack: CRITICAL HIT — d20(20) + 5 = 25 vs AC 12, 12 Piercing damage',
                expectedRolls: [['1d4 + 1'], ['1d4 + 1'], ['1d4 + 1']],
                expectedApply: [
                    [combatSummary, 'Wight 1', 15, ['Force'], applyOpts],
                    [combatSummary, 'Wight 1', 12, ['Piercing'], applyOpts],
                ],
                expectedDoubled: [['1d6+2']],
            },
        ])('rolls the weapon rider arms: $label (spell damage resolves either way)', async ({ d20, weaponLine, expectedRolls, expectedApply, expectedDoubled }) => {
            setupConfirm()
            rollD20.mockReturnValue(d20)

            const result = await confirmWarMagicSpell(makeAction(), makePlayerStats({ attacks }), mockCampaignName, 'Magic Missile')

            expect(rollExpression.mock.calls).toEqual(expectedRolls)
            expect(rollExpressionDoubled.mock.calls).toEqual(expectedDoubled || [])
            expect(applyDamageToTarget.mock.calls).toEqual(expectedApply)
            expect(result.payload.description).toBe('<b>War Magic</b>: Cast <b>Magic Missile</b> (level 1 spell slot expended) at <b>Wight 1</b>. Spell dealt <b>15</b> Force damage.<br/>' + weaponLine)
        })

        it('does not throw when addEntry rejects', async () => {
            setupConfirm()
            addEntry.mockRejectedValue(new Error('log failed'))

            const result = await confirmWarMagicSpell(makeAction(), makePlayerStats(), mockCampaignName, 'Magic Missile')

            expect(result.type).toBe('popup')
            expect(result.payload.type).toBe('automation_info')
        })
    })
})
