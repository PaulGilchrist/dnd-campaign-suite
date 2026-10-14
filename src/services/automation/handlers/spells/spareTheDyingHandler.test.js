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

    describe('handle', () => {
        it('offers dying PCs (runtime 0 HP, not dead) and reports them valid', async () => {
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

            expect(result.type).toBe('popup')
            expect(result.payload.type).toBe('automation_info')
            expect(result.payload.targets.length).toBe(2)
            expect(result.payload.targets[0].isValidTarget).toBe(true)
            expect(result.payload.targets[0].hp).toBe(0)
        })

        it('excludes the caster from targets', async () => {
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

            expect(result.payload.targets.length).toBe(1)
            expect(result.payload.targets[0].name).toBe('Ally1')
        })

        it('excludes healthy PCs', async () => {
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'HealthyAlly', type: 'player' }],
            })
            getRuntimeValue.mockImplementation(runtimeHp({ HealthyAlly: { currentHitPoints: 10 } }))

            const result = await handle(
                { name: 'Spare the Dying', spell: { range: '15 feet' } },
                playerStats,
                campaignName,
                null
            )

            expect(result.payload.description).toContain('No valid targets found')
        })

        it('excludes dead PCs (runtime isDead)', async () => {
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'DeadAlly', type: 'player' }],
            })
            getRuntimeValue.mockImplementation(runtimeHp({ DeadAlly: { currentHitPoints: 0, isDead: 1 } }))

            const result = await handle(
                { name: 'Spare the Dying', spell: {} },
                playerStats,
                campaignName,
                null
            )

            expect(result.payload.description).toContain('No valid targets found')
        })

        it('excludes already-Stable PCs (three death-save successes)', async () => {
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'StableAlly', type: 'player' }],
            })
            getRuntimeValue.mockImplementation(runtimeHp({
                StableAlly: { currentHitPoints: 0, deathSaves: [true, true, true] },
            }))

            const result = await handle(
                { name: 'Spare the Dying', spell: {} },
                playerStats,
                campaignName,
                null
            )

            expect(result.payload.description).toContain('No valid targets found')
        })

        it('excludes healthy monsters via cs.currentHp (runtime monster HP keys never exist)', async () => {
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Thug 1', type: 'npc', monsterType: 'humanoid', currentHp: 32 }],
            })
            getRuntimeValue.mockImplementation(() => undefined)

            const result = await handle(
                { name: 'Spare the Dying', spell: {} },
                playerStats,
                campaignName,
                null
            )

            expect(result.payload.description).toContain('No valid targets found')
        })

        it('excludes dead monsters (cs 0 HP is canonical dead)', async () => {
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Thug 2', type: 'npc', monsterType: 'humanoid', currentHp: 0 }],
            })
            getRuntimeValue.mockImplementation(() => undefined)

            const result = await handle(
                { name: 'Spare the Dying', spell: {} },
                playerStats,
                campaignName,
                null
            )

            expect(result.payload.description).toContain('No valid targets found')
        })

        it('offers dying-modelled monsters (cs 0 HP + deathSaves)', async () => {
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Thug 3', type: 'npc', monsterType: 'humanoid', currentHp: 0, deathSaves: [false, false, false] }],
            })
            getRuntimeValue.mockImplementation(() => undefined)

            const result = await handle(
                { name: 'Spare the Dying', spell: {} },
                playerStats,
                campaignName,
                null
            )

            expect(result.payload.targets.length).toBe(1)
            expect(result.payload.targets[0].name).toBe('Thug 3')
        })

        it('excludes undead creatures', async () => {
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Zombie', type: 'npc', monsterType: 'Undead', currentHp: 0, deathSaves: [false, false, false] }],
            })
            getRuntimeValue.mockImplementation(() => undefined)

            const result = await handle(
                { name: 'Spare the Dying', spell: {} },
                playerStats,
                campaignName,
                null
            )

            expect(result.payload.description).toContain('No valid targets found')
        })

        it('excludes construct creatures', async () => {
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'IronGolem', type: 'npc', monsterType: 'Construct', currentHp: 0, deathSaves: [false, false, false] }],
            })
            getRuntimeValue.mockImplementation(() => undefined)

            const result = await handle(
                { name: 'Spare the Dying', spell: {} },
                playerStats,
                campaignName,
                null
            )

            expect(result.payload.description).toContain('No valid targets found')
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

    describe('applySpareTheDying', () => {
        const dyingCs = {
            creatures: [
                { name: 'Cleric', type: 'player' },
                { name: 'Ally1', type: 'player' },
            ],
        }

        it('stabilizes WITHOUT healing: deathSaves stamped, currentHitPoints never written', async () => {
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

            expect(setRuntimeValue).toHaveBeenCalledWith('Ally1', 'deathSaves', [true, true, true], campaignName)
            expect(setRuntimeValue).not.toHaveBeenCalledWith('Ally1', 'currentHitPoints', 1, campaignName)
            expect(setRuntimeValue).not.toHaveBeenCalledWith('Ally1', 'currentHitPoints', 0, campaignName)
            expect(result.payload.type).toBe('automation_info')
            expect(result.payload.description).toContain('Stable')
            expect(result.payload.description).not.toContain('1 HP and gained')
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
                description: expect.stringContaining('stabilized'),
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

        it('refuses a healthy PC and writes nothing', async () => {
            getCombatContext.mockResolvedValue(dyingCs)
            getRuntimeValue.mockImplementation(runtimeHp({ Ally1: { currentHitPoints: 45 } }))

            const result = await applySpareTheDying(
                { name: 'Spare the Dying' },
                playerStats,
                campaignName,
                null,
                { targetName: 'Ally1' }
            )

            expect(result.payload.type).toBe('automation_info')
            expect(result.payload.description).toContain('no longer a valid target')
            expect(setRuntimeValue).not.toHaveBeenCalled()
        })

        it('refuses a dead PC (isDead) and writes nothing', async () => {
            getCombatContext.mockResolvedValue(dyingCs)
            getRuntimeValue.mockImplementation(runtimeHp({
                Ally1: { currentHitPoints: 0, isDead: 1 },
            }))

            const result = await applySpareTheDying(
                { name: 'Spare the Dying' },
                playerStats,
                campaignName,
                null,
                { targetName: 'Ally1' }
            )

            expect(result.payload.description).toContain('no longer a valid target')
            expect(setRuntimeValue).not.toHaveBeenCalled()
        })

        it('refuses a healthy monster even though runtime monster HP keys are absent', async () => {
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Thug 1', type: 'npc', monsterType: 'humanoid', currentHp: 32 }],
            })
            getRuntimeValue.mockImplementation(() => undefined)

            const result = await applySpareTheDying(
                { name: 'Spare the Dying' },
                playerStats,
                campaignName,
                null,
                { targetName: 'Thug 1' }
            )

            expect(result.payload.description).toContain('no longer a valid target')
            expect(setRuntimeValue).not.toHaveBeenCalled()
        })

        it('refuses a canonical-dead monster (cs 0 HP, no deathSaves)', async () => {
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Thug 2', type: 'npc', monsterType: 'humanoid', currentHp: 0 }],
            })
            getRuntimeValue.mockImplementation(() => undefined)

            const result = await applySpareTheDying(
                { name: 'Spare the Dying' },
                playerStats,
                campaignName,
                null,
                { targetName: 'Thug 2' }
            )

            expect(result.payload.description).toContain('no longer a valid target')
            expect(setRuntimeValue).not.toHaveBeenCalled()
        })

        it('refuses undead and constructs at 0 HP', async () => {
            getCombatContext.mockResolvedValue({
                creatures: [
                    { name: 'Zombie', type: 'npc', monsterType: 'Undead', currentHp: 0, deathSaves: [false, false, false] },
                    { name: 'IronGolem', type: 'npc', monsterType: 'Construct', currentHp: 0, deathSaves: [false, false, false] },
                ],
            })
            getRuntimeValue.mockImplementation(() => undefined)

            const zombieResult = await applySpareTheDying(
                { name: 'Spare the Dying' },
                playerStats,
                campaignName,
                null,
                { targetName: 'Zombie' }
            )
            const golemResult = await applySpareTheDying(
                { name: 'Spare the Dying' },
                playerStats,
                campaignName,
                null,
                { targetName: 'IronGolem' }
            )

            expect(zombieResult.payload.description).toContain('no longer a valid target')
            expect(golemResult.payload.description).toContain('no longer a valid target')
            expect(setRuntimeValue).not.toHaveBeenCalled()
        })

        it('stabilizes a dying-modelled monster via cs', async () => {
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

            expect(result.payload.description).toContain('Stable')
            expect(setRuntimeValue).not.toHaveBeenCalledWith('Thug 3', 'currentHitPoints', 1, campaignName)
        })

        it('returns null when no target selected', async () => {
            const result = await applySpareTheDying(
                { name: 'Spare the Dying' },
                playerStats,
                campaignName,
                null,
                {}
            )

            expect(result).toBeNull()
        })
    })
})
