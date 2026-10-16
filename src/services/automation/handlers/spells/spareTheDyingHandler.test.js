// @maintained-by-ai: 2026-10-16
//
// SP-110 spareTheDyingHandler EXECUTION lane — automation/index.js registry
// `spare_the_dying` (handle → automation_info picker) and `spare_the_dying_apply`,
// dispatched live via spellCastService triggerSpells.js and the
// useSpellMetamagicFlow pending-confirm flow. Rules checked against spells.json
// (5e + 2024): "You touch a living creature that has 0 hit points... has no
// effect on undead or constructs." Stabilization model: target STAYS at 0 HP
// and gains 3 successful death saves — it is never healed to 1 HP.
// Canonical HP truth: PCs via the runtime store, monsters via combatSummary
// currentHp only (pitfall 29); canonical-dead monsters need deathSaves to be
// dying-modelled. The isSpareTheDyingTarget edge MATRIX is canonically pinned
// in spellGates.spareTheDying.test.js (gate lane) — this lane keeps one row
// per predicate input path as wiring evidence and OWNS the write semantics,
// campaign-log entries, and popup-envelope/target-shape composition.

import { handle, applySpareTheDying } from './spareTheDyingHandler.js'

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => undefined),
    setRuntimeValue: vi.fn(),
}))

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}))

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
}))

vi.mock('../../../rules/combat/rangeValidation.js', () => ({
    rangeToFeet: vi.fn(() => 15),
}))

const { getRuntimeValue, setRuntimeValue } = await import('../../../../hooks/runtime/useRuntimeState.js')
const { getCombatContext } = await import('../../../rules/combat/damageUtils.js')
const { addEntry } = await import('../../../ui/logService.js')

const campaignName = 'TestCampaign'
const playerStats = { name: 'Cleric' }

// Canonical HP truth (SP-110): PCs runtime, monsters cs.currentHp only.
function runtimeHp(map) {
    return (name, key) => {
        if (map[name] && key in map[name]) return map[name][key]
        return undefined
    }
}

describe('spareTheDyingHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('handle — automation_info picker popup', () => {
        it('offers dying PCs with the full popup envelope and target shape', async () => {
            getCombatContext.mockResolvedValue({
                creatures: [
                    { name: 'Ally1', type: 'player' },
                    { name: 'Ally2', type: 'player' },
                ],
            })
            getRuntimeValue.mockImplementation(runtimeHp({
                Ally1: { currentHitPoints: 0, isDead: null },
                Ally2: { currentHitPoints: 0, isDead: null },
            }))

            const result = await handle(
                { name: 'Spare the Dying', spell: { range: '15 feet', automation: { type: 'spare_the_dying' } }, playerStats },
                playerStats,
                campaignName,
                null
            )

            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Spare the Dying',
                    description: 'Select a creature with 0 HP to make stable.',
                    automation: { type: 'spare_the_dying' },
                    range: '15 feet',
                    rangeFt: 15,
                    targets: [
                        { name: 'Ally1', isValidTarget: true, hp: 0, isDead: false, type: undefined },
                        { name: 'Ally2', isValidTarget: true, hp: 0, isDead: false, type: undefined },
                    ],
                },
            })
        })

        it('excludes the caster even when dying', async () => {
            getCombatContext.mockResolvedValue({
                creatures: [
                    { name: 'Cleric', type: 'player' },
                    { name: 'Ally1', type: 'player' },
                ],
            })
            getRuntimeValue.mockImplementation(runtimeHp({
                Ally1: { currentHitPoints: 0 },
                Cleric: { currentHitPoints: 0 },
            }))

            const result = await handle(
                { name: 'Spare the Dying', spell: {}, playerStats },
                { name: 'Cleric' },
                campaignName,
                null
            )

            expect(result.payload.targets.map(t => t.name)).toEqual(['Ally1'])
        })

        it('offers dying-modelled monsters from cs.currentHp with cs type shaping', async () => {
            getCombatContext.mockResolvedValue({
                creatures: [
                    { name: 'Thug 1', type: 'npc', monsterType: 'humanoid', currentHp: 32 },
                    { name: 'Thug 3', type: 'npc', monsterType: 'humanoid', currentHp: 0, deathSaves: [false, false, false] },
                ],
            })
            getRuntimeValue.mockImplementation(() => undefined)

            const result = await handle(
                { name: 'Spare the Dying', spell: {} },
                playerStats,
                campaignName,
                null
            )

            expect(result.payload.targets).toEqual([
                { name: 'Thug 3', isValidTarget: true, hp: 0, isDead: false, type: 'humanoid' },
            ])
        })

        it('reports no valid targets for a roster rejected on every predicate path', async () => {
            // One creature per isSpareTheDyingTarget rejection path (matrix owner:
            // spellGates.spareTheDying.test.js): healthy PC, dead PC, Stable PC,
            // healthy monster, canonical-dead monster, undead, construct.
            getCombatContext.mockResolvedValue({
                creatures: [
                    { name: 'HealthyAlly', type: 'player' },
                    { name: 'DeadAlly', type: 'player' },
                    { name: 'StableAlly', type: 'player' },
                    { name: 'Thug 1', type: 'npc', monsterType: 'humanoid', currentHp: 32 },
                    { name: 'Thug 2', type: 'npc', monsterType: 'humanoid', currentHp: 0 },
                    { name: 'Zombie', type: 'npc', monsterType: 'Undead', currentHp: 0, deathSaves: [false, false, false] },
                    { name: 'IronGolem', type: 'npc', monsterType: 'Construct', currentHp: 0, deathSaves: [false, false, false] },
                ],
            })
            getRuntimeValue.mockImplementation(runtimeHp({
                HealthyAlly: { currentHitPoints: 10 },
                DeadAlly: { currentHitPoints: 0, isDead: 1 },
                StableAlly: { currentHitPoints: 0, deathSaves: [true, true, true] },
            }))

            const result = await handle(
                { name: 'Spare the Dying', spell: {} },
                playerStats,
                campaignName,
                null
            )

            expect(result.type).toBe('popup')
            expect(result.payload.description).toBe('No valid targets found. Target must have 0 HP, not be dead, and not be undead or a construct.')
        })

        it('returns error when no combat context', async () => {
            getCombatContext.mockResolvedValue(null)

            const result = await handle(
                { name: 'Spare the Dying', spell: {} },
                playerStats,
                campaignName,
                null
            )

            expect(result.type).toBe('popup')
            expect(result.payload.description).toContain('No combat context found')
        })
    })

    describe('applySpareTheDying — stabilize writes and refusal guards', () => {
        const dyingCs = {
            creatures: [
                { name: 'Cleric', type: 'player' },
                { name: 'Ally1', type: 'player' },
            ],
        }

        it('stabilizes WITHOUT healing: deathSaves + deathFailures stamped, currentHitPoints never written', async () => {
            getCombatContext.mockResolvedValue(dyingCs)
            getRuntimeValue.mockImplementation(runtimeHp({
                Ally1: { currentHitPoints: 0, deathFailures: [false, false, false] },
            }))

            const result = await applySpareTheDying(
                { name: 'Spare the Dying' },
                playerStats,
                campaignName,
                null,
                { targetName: 'Ally1' }
            )

            expect(setRuntimeValue).toHaveBeenCalledTimes(2)
            expect(setRuntimeValue).toHaveBeenCalledWith('Ally1', 'deathSaves', [true, true, true], campaignName)
            expect(setRuntimeValue).toHaveBeenCalledWith('Ally1', 'deathFailures', [false, false, false], campaignName)
            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Spare the Dying',
                    automationType: 'spare_the_dying',
                    description: 'Ally1 becomes Stable and remains at 0 Hit Points.',
                },
            })
        })

        it('logs ability_use and spell_effect entries naming Spare the Dying + Stable', async () => {
            getCombatContext.mockResolvedValue(dyingCs)
            getRuntimeValue.mockImplementation(runtimeHp({
                Ally1: { currentHitPoints: 0, deathFailures: [false, false, false] },
            }))

            await applySpareTheDying(
                { name: 'Spare the Dying' },
                playerStats,
                campaignName,
                null,
                { targetName: 'Ally1' }
            )

            expect(addEntry).toHaveBeenCalledWith(campaignName, {
                type: 'ability_use',
                characterName: 'Cleric',
                abilityName: 'Spare the Dying',
                description: 'Cleric cast Spare the Dying on Ally1: Ally1 is stabilized and becomes Stable at 0 Hit Points.',
                targetName: 'Ally1',
                timestamp: expect.any(Number),
            })
            expect(addEntry).toHaveBeenCalledWith(campaignName, {
                type: 'spell_effect',
                characterName: 'Cleric',
                spellName: 'Spare the Dying',
                targetName: 'Ally1',
                effects: ['Target becomes Stable'],
                timestamp: expect.any(Number),
            })
        })

        it.each([
            { desc: 'healthy PC is rejected by the runtime HP path', cs: dyingCs, runtime: { Ally1: { currentHitPoints: 45 } }, target: 'Ally1' },
            { desc: 'canonical-dead monster is rejected by the cs path', cs: { creatures: [{ name: 'Thug 2', type: 'npc', monsterType: 'humanoid', currentHp: 0 }] }, runtime: {}, target: 'Thug 2' },
            { desc: 'undead and constructs are rejected even when dying-modelled', cs: { creatures: [
                { name: 'Zombie', type: 'npc', monsterType: 'Undead', currentHp: 0, deathSaves: [false, false, false] },
                { name: 'IronGolem', type: 'npc', monsterType: 'Construct', currentHp: 0, deathSaves: [false, false, false] },
            ] }, runtime: {}, target: 'Zombie' },
        ])('refuses with no writes and console.error when $desc', async ({ cs, runtime, target }) => {
            getCombatContext.mockResolvedValue(cs)
            getRuntimeValue.mockImplementation(runtimeHp(runtime))
            const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

            const result = await applySpareTheDying(
                { name: 'Spare the Dying' },
                playerStats,
                campaignName,
                null,
                { targetName: target }
            )

            expect(result.payload.type).toBe('automation_info')
            expect(result.payload.description).toBe(`${target} is no longer a valid target for Spare the Dying. Target must be a living creature at 0 Hit Points.`)
            expect(setRuntimeValue).not.toHaveBeenCalled()
            expect(addEntry).not.toHaveBeenCalled()
            expect(errSpy).toHaveBeenCalledWith(expect.stringContaining(target))
            errSpy.mockRestore()
        })

        it('stabilizes a dying-modelled monster via cs, healing nothing', async () => {
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Thug 3', type: 'npc', monsterType: 'humanoid', currentHp: 0, deathSaves: [false, false, false] }],
            })
            getRuntimeValue.mockImplementation(() => undefined)

            const result = await applySpareTheDying(
                { name: 'Spare the Dying' },
                playerStats,
                campaignName,
                null,
                { targetName: 'Thug 3' }
            )

            expect(setRuntimeValue).toHaveBeenCalledTimes(2)
            expect(setRuntimeValue).toHaveBeenCalledWith('Thug 3', 'deathSaves', [true, true, true], campaignName)
            expect(setRuntimeValue).toHaveBeenCalledWith('Thug 3', 'deathFailures', [false, false, false], campaignName)
            expect(result.payload.description).toBe('Thug 3 becomes Stable and remains at 0 Hit Points.')
        })

        it('returns null when no target selected, writing nothing', async () => {
            const result = await applySpareTheDying(
                { name: 'Spare the Dying' },
                playerStats,
                campaignName,
                null,
                {}
            )

            expect(result).toBeNull()
            expect(setRuntimeValue).not.toHaveBeenCalled()
            expect(addEntry).not.toHaveBeenCalled()
        })
    })
})
