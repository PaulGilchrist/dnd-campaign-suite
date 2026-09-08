// CLA-357 regression: chooser modal + isWithinRange gate + te + refusal log +
// raw `30_ft` token never leaks into popup/log prose.
import { handle, applyTelekineticMovement } from './telekineticMovementHandler.js';
import * as logService from '../../../ui/logService.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as rangeCheck from '../../../rules/combat/rangeCheck.js';
import * as teDefs from '../../../combat/conditions/targetEffectDefinitions.js';

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
    getTargetFromAttacker: vi.fn(),
}));

vi.mock('../../../rules/combat/rangeCheck.js', () => ({
    isWithinRange: vi.fn(async () => true),
    isDistanceInRange: (dist, rangeFt) => rangeFt == null || dist == null || dist <= rangeFt,
}));

vi.mock('../../../combat/conditions/targetEffectDefinitions.js', () => ({
    registerTargetEffect: vi.fn(),
    getEffectDefinition: vi.fn(() => ({ effect: 'telekinetic_movement' })),
}));

const makeAction = (auto = {}) => ({
    name: 'Telekinetic Movement',
    automation: { type: 'telekinetic_movement', range: '30_ft', casting_time: '1 action', ...auto },
});

const makePlayerStats = (overrides = {}) => ({
    ...overrides,
    name: 'TestHero',
});

const makeCombatSummary = (names = ['TestHero', 'Thug 1', 'Gazer 1']) => ({
    creatures: names.map(n => ({ name: n, type: n === 'TestHero' ? 'player' : 'monster', currentHp: 10, maxHp: 10 })),
});

describe('telekineticMovementHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        rangeCheck.isWithinRange.mockResolvedValue(true);
        damageUtils.getCombatContext.mockResolvedValue(makeCombatSummary());
    });

    describe('handle', () => {
        it('should open a willing-creature chooser modal when combat has creatures', async () => {
            const action = makeAction();
            const result = await handle(action, makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('telekineticMovement');
            expect(result.payload.action).toBe(action);
            expect(result.payload.campaignName).toBe('campaign');
            expect(result.payload.rangeFt).toBe(30);
            expect(result.payload.creatureTargets.map(t => t.name)).toEqual(['Thug 1', 'Gazer 1']);
        });

        it('should resolve the raw 30_ft token to numeric feet in the payload', async () => {
            const result = await handle(makeAction({ range: '60_ft' }), makePlayerStats(), 'campaign', 'map');

            expect(result.payload.rangeFt).toBe(60);
        });

        it('should fall back to popup + ability_use log with no creatures in combat', async () => {
            damageUtils.getCombatContext.mockResolvedValue({ creatures: [{ name: 'TestHero', type: 'player' }] });

            const result = await handle(makeAction(), makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('30');
            expect(result.payload.description).not.toContain('30_ft');
            expect(logService.addEntry).toHaveBeenCalledWith('campaign', expect.objectContaining({
                type: 'ability_use',
                characterName: 'TestHero',
                abilityName: 'Telekinetic Movement',
            }));
        });

        it('should tolerate getCombatContext rejection without throwing', async () => {
            damageUtils.getCombatContext.mockResolvedValue(null);

            const result = await handle(makeAction(), makePlayerStats(), 'campaign', 'map');
            expect(result.type).toBe('popup');
        });
    });

    describe('applyTelekineticMovement', () => {
        it('should record a telekinetic_movement te and log ability_use when in range', async () => {
            const result = await applyTelekineticMovement(makeAction(), makePlayerStats(), 'campaign', 'Thug 1');

            expect(rangeCheck.isWithinRange).toHaveBeenCalledWith('TestHero', 'Thug 1', 30);
            expect(teDefs.registerTargetEffect).toHaveBeenCalledWith('campaign', 'Thug 1', 'telekinetic_movement', 'Telekinetic Movement', expect.objectContaining({
                value: 30,
                movedDistanceFt: 30,
            }));
            expect(result.type).toBe('popup');
            expect(result.payload.description).toBe('Telekinetic Movement: Moved <strong>Thug 1</strong> up to <strong>30</strong> feet.');
            expect(logService.addEntry).toHaveBeenCalledWith('campaign', expect.objectContaining({
                type: 'ability_use',
                characterName: 'TestHero',
                abilityName: 'Telekinetic Movement',
                description: 'TestHero used Telekinetic Movement to telekinetically move Thug 1 up to 30 feet.',
            }));
        });

        it('should refuse out-of-range targets with refusal log and no te', async () => {
            rangeCheck.isWithinRange.mockResolvedValue(false);

            const result = await applyTelekineticMovement(makeAction(), makePlayerStats(), 'campaign', 'Gazer 1');

            expect(teDefs.registerTargetEffect).not.toHaveBeenCalled();
            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('out of range');
            expect(result.payload.description).not.toContain('30_ft');
            expect(logService.addEntry).toHaveBeenCalledWith('campaign', expect.objectContaining({
                type: 'automation',
                automationType: 'telekinetic_movement_refused',
                characterName: 'TestHero',
            }));
            const abilityUseCalls = logService.addEntry.mock.calls.filter(c => c[1]?.type === 'ability_use');
            expect(abilityUseCalls.length).toBe(0);
        });

        it('should use custom range from automation in gate, log, and popup', async () => {
            await applyTelekineticMovement(makeAction({ range: '60_ft' }), makePlayerStats(), 'campaign', 'Thug 1');

            expect(rangeCheck.isWithinRange).toHaveBeenCalledWith('TestHero', 'Thug 1', 60);
            expect(logService.addEntry).toHaveBeenCalledWith('campaign', expect.objectContaining({
                description: 'TestHero used Telekinetic Movement to telekinetically move Thug 1 up to 60 feet.',
            }));
        });

        it('should return null when no target name is provided', async () => {
            const result = await applyTelekineticMovement(makeAction(), makePlayerStats(), 'campaign', null);

            expect(result).toBeNull();
            expect(teDefs.registerTargetEffect).not.toHaveBeenCalled();
        });

        it('should tolerate addEntry rejection without throwing', async () => {
            logService.addEntry.mockRejectedValue(new Error('network error'));

            await expect(
                applyTelekineticMovement(makeAction(), makePlayerStats(), 'campaign', 'Thug 1')
            ).resolves.toMatchObject({
                type: 'popup',
                payload: expect.objectContaining({ type: 'automation_info' }),
            });
        });
    });
});
