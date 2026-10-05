// @improved-by-ai
// @cleaned-by-ai
import { render, screen, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Initiative from './Initiative.jsx';
import { loadCombatSummary, getCombatSummary } from '../../services/encounters/combatData.js';
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import storage from '../../services/ui/storage.js';
import { clearExpirationEffects } from '../../services/rules/effects/expirations.js';

const PER_ROUND_RESETS = [
    'activeBuffs',
    'invokeDuplicityAdvantageTargets',
    'unbreakableMajestyActive',
    'unbreakableMajestySaveDc',
    'wrathOfTheSeaActive',
    'wrathOfTheSeaDc',
    'wrathOfTheSeaWisMod',
    'wrathOfTheSeaSource',
    'peerlessAthleteActive',
    'elementalAttunementActive',
    'elementalAttunementElement',
    '_CunningStrike_usedRound',
    '_Charge_Attack_usedRound',
    '_FastHands_usedRound',
    '_CunningAction_usedRound',
    '_Cleave_UsedRound',
    '_Nick_UsedRound',
    'surgeUsedRound',
    'illusoryRealityUsedRound',
    'portentUsedThisTurn',
    'psionicStrikeUsedThisTurn',
    '_BrutalStrike_usedRound',
    '_fortifiedHealth_usedRound',
    '_Shield_Bash_usedRound',
    'piercerPunctureUsedThisTurn',
    // CLA-100: Dread Ambush Ambusher's Leap once-per-combat latch re-arms on initiative.
    'dreadAmbushSpeedActive',
];

vi.mock('../../hooks/runtime/useSSEEqualityGuard.js', () => ({ default: (setter) => setter }));
vi.mock('../../services/ui/utils.js', () => ({ default: { getName: (name) => name } }));
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getStore: vi.fn(() => new Map()),
    useSyncedState: vi.fn(() => [null, vi.fn()]),
    listeners: new Map(),
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
    setRuntimeObject: vi.fn(),
}));
vi.mock('../../services/ui/storage.js', () => ({
    default: { get: vi.fn(), set: vi.fn(), getProperty: vi.fn(), setProperty: vi.fn() },
}));
vi.mock('../../services/npcs/monsterUtils.js', () => ({ getMonsterImageUrl: vi.fn(() => Promise.resolve(null)), getMonsterData: vi.fn(() => Promise.resolve(null)) }));
vi.mock('../../services/combat/conditions/conditionUtils.js', () => ({
    getAbilityLabel: (ability) => ability?.toUpperCase() || '',
    CONDITIONS: [
        { key: 'blinded', label: 'Blinded' }, { key: 'charmed', label: 'Charmed' },
        { key: 'deafened', label: 'Deafened' }, { key: 'frightened', label: 'Frightened' },
        { key: 'grappled', label: 'Grappled' }, { key: 'incapacitated', label: 'Incapacitated' },
        { key: 'invisible', label: 'Invisible' }, { key: 'paralyzed', label: 'Paralyzed' },
        { key: 'petrified', label: 'Petrified' }, { key: 'poisoned', label: 'Poisoned' },
        { key: 'prone', label: 'Prone' }, { key: 'restrained', label: 'Restrained' },
        { key: 'stunned', label: 'Stunned' }, { key: 'unconscious', label: 'Unconscious' },
    ],
}));
vi.mock('../../services/npcs/npcsService.js', () => ({ loadNPCs: vi.fn(() => Promise.resolve({ npcs: [] })) }));
vi.mock('../../services/encounters/npcStatBlockUtils.js', () => ({ npcToMonsterFormat: vi.fn(() => null), npcHasStatBlock: vi.fn(() => true) }));
vi.mock('../../services/rules/effects/expirations.js', () => ({
    expireStaleEffects: vi.fn(),
    applyTurnStartEffects: vi.fn(),
    applyTurnEndConditionRemoval: vi.fn(() => Promise.resolve()),
    clearExpirationEffects: vi.fn(),
}));
vi.mock('../../services/encounters/combatData.js', () => {
    const mock = {
        loadCombatSummary: vi.fn(() => Promise.resolve(null)),
        getCombatSummary: vi.fn(() => null),
        getActiveCreatureName: vi.fn(() => null),
        setCombatSummaryCache: vi.fn(),
    };
    return mock;
});
vi.mock('../../services/combat/auras/unbreakableMajesty.js', () => ({ clearPerRoundMajestyTrackers: vi.fn() }));
vi.mock('../../services/encounters/initiativeService.js', () => ({
    setupCreatures: vi.fn((characters) => characters.map((ch) => ({ name: ch.name, type: 'player', initiative: '', targetName: null, concentration: null }))),
    addNpc: vi.fn((cs) => { cs.creatures.push({ name: 'NPC 1', type: 'npc', initiative: '', targetName: null, ac: 10, resistances: [], immunities: [], conditions: [], concentration: null, maxHp: 10, currentHp: 10, saveBonuses: {} }); return 1; }),
    removeNpc: vi.fn(),
    getNextCreatureName: vi.fn((cs, active) => { const idx = cs.creatures.findIndex((c) => c.name === active); if (idx < cs.creatures.length - 1) return { newActiveName: cs.creatures[idx + 1].name, roundIncrement: false }; return { newActiveName: cs.creatures[0].name, roundIncrement: true }; }),
    getPreviousCreatureName: vi.fn((cs, active) => { const idx = cs.creatures.findIndex((c) => c.name === active); if (idx > 0) return { newActiveName: cs.creatures[idx - 1].name, roundDecrement: false }; return { newActiveName: cs.creatures[cs.creatures.length - 1].name, roundDecrement: true }; }),
    isPreviousDisabled: vi.fn(() => false),
    setInitiative: vi.fn(),
    rollNpcInitiative: vi.fn(() => ({ roll: 15, bonus: 2, total: 17 })),
    renameNpc: vi.fn(() => Promise.resolve()),
    setTarget: vi.fn(),
    clearCombat: vi.fn((characters) => ({ round: 1, creatures: characters.map((ch) => ({ name: ch.name, type: 'player', initiative: '', targetName: null, concentration: null })) })),
    mergeCombatSummaryWithCharacters: vi.fn((initialSummary, characters) => {
        const names = new Set((initialSummary?.creatures ?? []).map(c => c.name));
        const newCreatures = characters.filter(ch => !names.has(ch.name)).map((ch) => ({ name: ch.name, type: 'player', initiative: '', targetName: null, concentration: null }));
        return { round: initialSummary?.round ?? 1, creatures: [...(initialSummary?.creatures ?? []), ...newCreatures] };
    }),
}));
vi.mock('../../services/combat/conditions/conditionSaveService.js', () => ({
    rollConditionSave: vi.fn(async () => ({ roll: 15, success: true, bonus: 2, bonusDetail: '' })),
    removeCondition: vi.fn(), addCondition: vi.fn(),
    buildConditionPopup: vi.fn(() => ({ name: 'Test Creature', condition: 'Blinded', type: 'save', rolls: [15], bonus: 2, targetName: 'Test Creature', targetAc: 10, hit: false, success: true, dc: 10 })),
}));
vi.mock('../../services/combat/concentration/concentrationService.js', () => ({
    rollConcentrationSave: vi.fn(async () => ({ roll: 15, success: true, bonus: 2, bonusDetail: '' })),
    breakConcentration: vi.fn(() => 'Shield'), addConcentration: vi.fn(),
    buildConcentrationPopup: vi.fn(() => ({ name: 'Test Creature', condition: null, spell: 'Shield', type: 'save', rolls: [15], bonus: 2, targetName: 'Test Creature', targetAc: 10, hit: false, success: true, dc: 10 })),
    cleanupConcentrationEffects: vi.fn(),
}));
vi.mock('../../services/encounters/combatLoggingService.js', () => ({
    logInitiativeRoll: vi.fn(), logConditionEvent: vi.fn(), logConcentrationSave: vi.fn(),
    logConditionSave: vi.fn(), logHpChange: vi.fn(), logNpcThreshold: vi.fn(),
}));
vi.mock('../../services/ui/logService.js', () => ({
    getLog: vi.fn(async () => []),
    addEntry: vi.fn(async () => ({})),
}));
vi.mock('../encounter/MonsterCardModal.jsx', () => ({ default: () => <div data-testid="monster-card-modal" /> }));
vi.mock('../common/Subscriber.jsx', () => ({ default: () => <div data-testid="subscriber" /> }));
vi.mock('../common/Popup.jsx', () => ({ default: ({ children, onClickOrKeyDown }) => (<div data-testid="popup-overlay" onClick={onClickOrKeyDown}><div data-testid="popup-modal">{children}</div></div>) }));
vi.mock('../char-sheet/DiceRollResult.jsx', () => ({ default: ({ name }) => <div data-testid="dice-roll-result">{name}</div> }));
vi.mock('./CreatureCard.jsx', () => ({ default: ({ creature }) => (<div data-testid={`creature-card-${creature.name}`} className={`creature-card ${creature.type}`}><span>{creature.name}</span></div>) }));
vi.mock('./EffectAdder.jsx', () => ({ default: ({ targetName }) => (<div data-testid="effect-adder"><span>{targetName}</span></div>) }));

describe('Initiative - Initiative Rolled Handler Paths', () => {
    let props;

    beforeEach(() => {
        vi.clearAllMocks();
        window.confirm = vi.fn(() => true);
        Element.prototype.scrollIntoView = vi.fn();
        props = {
            characters: [
                { name: 'Alice', computedStats: { hitPoints: 20, currentHitPoints: 20, armorClass: 15 } },
                { name: 'Bob', computedStats: { hitPoints: 15, currentHitPoints: 15, armorClass: 14 } },
            ],
            campaignName: 'test-campaign',
            onNpcsChange: vi.fn(),
            isLocalhost: true,
            mapName: 'test-map',
        };
    });

    function hasResetCall(creature, prop) {
        return setRuntimeValue.mock.calls.some(
            call => call[0] === creature && call[1] === prop
        );
    }

    function noResetCalls(creature) {
        for (const prop of PER_ROUND_RESETS) {
            expect(hasResetCall(creature, prop)).toBe(false);
        }
    }

    describe('initiative-rolled: per-round resets for player creatures', () => {
        it('should reset all per-round counters for player creatures', async () => {
            vi.mocked(loadCombatSummary).mockResolvedValue({ round: 1, creatures: [{ name: 'Alice', type: 'player' }, { name: 'Bob', type: 'player' }] });
            await act(async () => { render(<Initiative {...props} />); });
            await waitFor(() => { expect(screen.queryByTestId('creature-card-Alice')).toBeInTheDocument(); });

            vi.mocked(getCombatSummary).mockReturnValue({ round: 1, creatures: [{ name: 'Alice', type: 'player' }, { name: 'Bob', type: 'player' }] });
            await act(async () => {
                window.dispatchEvent(new Event('initiative-rolled'));
            });

            for (const creature of ['Alice', 'Bob']) {
                for (const prop of PER_ROUND_RESETS) {
                    expect(hasResetCall(creature, prop)).toBe(true);
                }
            }
        });

        it('should NOT clear per-round counters for NPC creatures', async () => {
            vi.mocked(loadCombatSummary).mockResolvedValue({ round: 1, creatures: [{ name: 'Alice', type: 'player' }, { name: 'Goblin', type: 'npc' }] });
            await act(async () => { render(<Initiative {...props} />); });
            await waitFor(() => { expect(screen.queryByTestId('creature-card-Alice')).toBeInTheDocument(); });

            vi.mocked(getCombatSummary).mockReturnValue({ round: 1, creatures: [{ name: 'Alice', type: 'player' }, { name: 'Goblin', type: 'npc' }] });
            await act(async () => {
                window.dispatchEvent(new Event('initiative-rolled'));
            });

            expect(hasResetCall('Alice', 'activeBuffs')).toBe(true);
            noResetCalls('Goblin');
        });
    });

    describe('initiative-rolled: Hunter\'s Mark concentration clearing', () => {
        it('should clear Hunter\'s Mark concentration on initiative roll', async () => {
            vi.mocked(setRuntimeValue).mockImplementation((_key, _prop, _value, _campaign) => {});
            vi.mocked(loadCombatSummary).mockResolvedValue({ round: 1, creatures: [{ name: 'Alice', type: 'player', concentration: { spell: "Hunter's Mark", dc: 10 } }, { name: 'Bob', type: 'player' }] });
            await act(async () => { render(<Initiative {...props} />); });
            await waitFor(() => { expect(screen.queryByTestId('creature-card-Alice')).toBeInTheDocument(); });

            vi.mocked(getCombatSummary).mockReturnValue({ round: 1, creatures: [{ name: 'Alice', type: 'player', concentration: { spell: "Hunter's Mark", dc: 10 } }, { name: 'Bob', type: 'player' }] });
            await act(async () => {
                window.dispatchEvent(new Event('initiative-rolled'));
            });

            expect(hasResetCall('Alice', 'activeBuffs')).toBe(true);
            expect(storage.set).toHaveBeenCalledTimes(2);
        });

        it.each([
            { name: 'non-Hunter\'s Mark spell', concentration: { spell: 'Shield', dc: 10 } },
            { name: 'null concentration', concentration: null },
        ])('should NOT clear concentration when %s', async ({ concentration }) => {
            vi.mocked(setRuntimeValue).mockImplementation((_key, _prop, _value, _campaign) => {});
            vi.mocked(loadCombatSummary).mockResolvedValue({ round: 1, creatures: [{ name: 'Alice', type: 'player', concentration }] });
            await act(async () => { render(<Initiative {...props} />); });
            await waitFor(() => { expect(screen.queryByTestId('creature-card-Alice')).toBeInTheDocument(); });

            vi.mocked(getCombatSummary).mockReturnValue({ round: 1, creatures: [{ name: 'Alice', type: 'player', concentration }] });
            await act(async () => {
                window.dispatchEvent(new Event('initiative-rolled'));
            });

            expect(hasResetCall('Alice', 'activeBuffs')).toBe(true);
            expect(storage.set).toHaveBeenCalledTimes(1);
        });
    });

    describe('initiative-rolled: pendingExpirations dominate clearing', () => {
        it('should clear dominated effects and call clearExpirationEffects', async () => {
            vi.mocked(setRuntimeValue).mockImplementation((_key, _prop, _value, _campaign) => {});
            vi.mocked(getRuntimeValue).mockImplementation((_key, _prop, _campaign) => {
                if (_prop === 'currentHitPoints') return 10;
                if (_prop === 'hitPoints') return 10;
                if (_prop === 'activeConditions') return [];
                if (_prop === 'activeBuffs') return [];
                if (_prop === 'pendingExpirations') return [
                    { target: 'Enemy1', effects: [{ type: 'dominated', effect: 'dominated', duration: '1 round' }] }
                ];
                return null;
            });
            vi.mocked(loadCombatSummary).mockResolvedValue({ round: 1, creatures: [{ name: 'Alice', type: 'player' }] });
            await act(async () => { render(<Initiative {...props} />); });
            await waitFor(() => { expect(screen.queryByTestId('creature-card-Alice')).toBeInTheDocument(); });

            vi.mocked(getCombatSummary).mockReturnValue({ round: 1, creatures: [{ name: 'Alice', type: 'player' }] });
            await act(async () => {
                window.dispatchEvent(new Event('initiative-rolled'));
            });

            expect(clearExpirationEffects).toHaveBeenCalledWith(
                expect.arrayContaining([expect.objectContaining({ type: 'dominated' })]),
                'Enemy1',
                'Alice',
                'test-campaign'
            );
            expect(hasResetCall('Alice', 'pendingExpirations')).toBe(true);
        });

        it('should preserve non-dominated effects in pendingExpirations', async () => {
            vi.mocked(setRuntimeValue).mockImplementation((_key, _prop, _value, _campaign) => {});
            vi.mocked(getRuntimeValue).mockImplementation((_key, _prop, _campaign) => {
                if (_prop === 'currentHitPoints') return 10;
                if (_prop === 'hitPoints') return 10;
                if (_prop === 'activeConditions') return [];
                if (_prop === 'activeBuffs') return [];
                if (_prop === 'pendingExpirations') return [
                    { target: 'Enemy1', effects: [{ type: 'dominated', effect: 'dominated', duration: '1 round' }] },
                    { target: 'Enemy2', effects: [{ type: 'charmed', effect: 'charmed', duration: '1 turn' }] },
                ];
                return null;
            });
            vi.mocked(loadCombatSummary).mockResolvedValue({ round: 1, creatures: [{ name: 'Alice', type: 'player' }] });
            await act(async () => { render(<Initiative {...props} />); });
            await waitFor(() => { expect(screen.queryByTestId('creature-card-Alice')).toBeInTheDocument(); });

            vi.mocked(getCombatSummary).mockReturnValue({ round: 1, creatures: [{ name: 'Alice', type: 'player' }] });
            await act(async () => {
                window.dispatchEvent(new Event('initiative-rolled'));
            });

            expect(clearExpirationEffects).toHaveBeenCalledTimes(1);
            expect(hasResetCall('Alice', 'pendingExpirations')).toBe(true);
        });

        it('should skip dominate clearing when no pendingExpirations', async () => {
            vi.mocked(setRuntimeValue).mockImplementation((_key, _prop, _value, _campaign) => {});
            vi.mocked(getRuntimeValue).mockImplementation((_key, _prop, _campaign) => {
                if (_prop === 'currentHitPoints') return 10;
                if (_prop === 'hitPoints') return 10;
                if (_prop === 'activeConditions') return [];
                if (_prop === 'activeBuffs') return [];
                if (_prop === 'pendingExpirations') return [];
                return null;
            });
            vi.mocked(loadCombatSummary).mockResolvedValue({ round: 1, creatures: [{ name: 'Alice', type: 'player' }] });
            await act(async () => { render(<Initiative {...props} />); });
            await waitFor(() => { expect(screen.queryByTestId('creature-card-Alice')).toBeInTheDocument(); });

            vi.mocked(getCombatSummary).mockReturnValue({ round: 1, creatures: [{ name: 'Alice', type: 'player' }] });
            await act(async () => {
                window.dispatchEvent(new Event('initiative-rolled'));
            });

            expect(hasResetCall('Alice', 'activeBuffs')).toBe(true);
            expect(clearExpirationEffects).not.toHaveBeenCalled();
        });


    });

    describe('initiative-rolled: null/empty guard', () => {
        it('should do nothing when getCombatSummary returns null', async () => {
            vi.mocked(setRuntimeValue).mockImplementation((_key, _prop, _value, _campaign) => {});
            vi.mocked(loadCombatSummary).mockResolvedValue({ round: 1, creatures: [{ name: 'Alice', type: 'player' }] });
            await act(async () => { render(<Initiative {...props} />); });
            await waitFor(() => { expect(screen.queryByTestId('creature-card-Alice')).toBeInTheDocument(); });

            const resetCallsBefore = setRuntimeValue.mock.calls.length;
            const storageCallsBefore = storage.set.mock.calls.length;
            const expireCallsBefore = clearExpirationEffects.mock.calls.length;

            vi.mocked(getCombatSummary).mockReturnValue(null);
            await act(async () => {
                window.dispatchEvent(new Event('initiative-rolled'));
            });

            expect(setRuntimeValue.mock.calls.length).toBe(resetCallsBefore);
            expect(storage.set.mock.calls.length).toBe(storageCallsBefore);
            expect(clearExpirationEffects.mock.calls.length).toBe(expireCallsBefore);
        });


    });


});
