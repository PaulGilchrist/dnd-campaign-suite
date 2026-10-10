// @improved-by-ai
// @cleaned-by-ai
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Initiative from './Initiative.jsx';
import * as combatData from '../../services/encounters/combatData.js';
import { clearCombat } from '../../services/encounters/initiativeService.js';

const syncStateStore = new Map();

vi.mock('../../hooks/runtime/useSSEEqualityGuard.js', () => ({ default: (setter) => setter }));
vi.mock('../../services/ui/utils.js', () => ({ default: { getName: (name) => name } }));
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getStore: vi.fn(() => syncStateStore),
    useSyncedState: vi.fn((key, prop, defaultValue) => {
        const storeKey = `${key}-${prop}`;
        if (!syncStateStore.has(storeKey)) {
            syncStateStore.set(storeKey, { value: defaultValue, setter: null });
        }
        const entry = syncStateStore.get(storeKey);
        if (!entry.setter) {
            entry.setter = vi.fn((newValue) => { entry.value = newValue; });
        }
        return [entry.value, entry.setter];
    }),
    listeners: new Map(),
    getRuntimeValue: vi.fn((_key, _prop, _campaign) => {
        if (_prop === 'currentHitPoints') return 10;
        if (_prop === 'hitPoints') return 10;
        if (_prop === 'activeConditions') return [];
        if (_prop === 'activeBuffs') return [];
        if (_prop === 'inspiringMovementNoOA') return false;
        return null;
    }),
    setRuntimeValue: vi.fn((_key, _prop, _value, _campaign) => {}),
    setRuntimeObject: vi.fn(),
}));
vi.mock('../../services/ui/storage.js', () => ({
    default: { get: vi.fn(), set: vi.fn(), getProperty: vi.fn(), setProperty: vi.fn() },
}));
vi.mock('../../services/combat/conditions/savePromptService.js', () => ({ clearDeathSavePrompt: vi.fn() }));
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
vi.mock('../../services/rules/effects/expirations.js', () => ({ expireStaleEffects: vi.fn(), applyTurnStartEffects: vi.fn(), applyTurnEndConditionRemoval: vi.fn(() => Promise.resolve()) }));
vi.mock('../../services/encounters/combatData.js', () => ({
    loadCombatSummary: vi.fn(() => Promise.resolve(null)),
    getCombatSummary: vi.fn(() => null),
    getActiveCreatureName: vi.fn(() => null),
    setCombatSummaryCache: vi.fn(),
}));
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
vi.mock('../encounter/MonsterCardModal.jsx', () => ({ default: () => <div data-testid="monster-card-modal" /> }));
vi.mock('../common/Subscriber.jsx', () => ({ default: () => <div data-testid="subscriber" /> }));
vi.mock('../common/Popup.jsx', () => ({ default: ({ children, onClickOrKeyDown }) => (<div data-testid="popup-overlay" onClick={onClickOrKeyDown}><div data-testid="popup-modal">{children}</div></div>) }));
vi.mock('../char-sheet/DiceRollResult.jsx', () => ({ default: ({ name }) => <div data-testid="dice-roll-result">{name}</div> }));
vi.mock('./CreatureCard.jsx', () => ({ default: ({ creature }) => (<div data-testid={`creature-card-${creature.name}`} className={`creature-card ${creature.type}`}><span>{creature.name}</span></div>) }));
vi.mock('./EffectAdder.jsx', () => ({ default: ({ targetName }) => (<div data-testid="effect-adder"><span>{targetName}</span></div>) }));

describe('Initiative', () => {
    let props;

    beforeEach(() => {
        vi.clearAllMocks();
        syncStateStore.clear();
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

    describe('rendering', () => {
        it('should render initiative heading with round number, subscriber, carousel, and combat controls', async () => {
            vi.mocked(combatData.loadCombatSummary).mockResolvedValue({ round: 1, creatures: [] });
            await act(async () => { render(<Initiative {...props} />); });
            await waitFor(() => {
                expect(screen.getByText(/Initiative \(round 1\)/)).toBeInTheDocument();
                expect(screen.getByTestId('subscriber')).toBeInTheDocument();
                expect(document.querySelector('.carousel-container')).toBeInTheDocument();
                expect(screen.getByText('Clear')).toBeInTheDocument();
                expect(screen.getByText('+ NPC')).toBeInTheDocument();
                expect(screen.getByText('← Prev')).toBeInTheDocument();
                expect(screen.getByText('Next →')).toBeInTheDocument();
            });
        });

        it('should give the + NPC button a title explaining the auto-naming and 10 HP default', async () => {
            vi.mocked(combatData.loadCombatSummary).mockResolvedValue({ round: 1, creatures: [] });
            await act(async () => { render(<Initiative {...props} />); });
            const npcButton = await screen.findByText('+ NPC');
            const title = npcButton.getAttribute('title');
            expect(title).toContain('NPC 1');
            expect(title).toContain('NPC 2');
            expect(title).toContain('10 HP');
            expect(title).toMatch(/statless/i);
        });
    });

    describe('clear combat', () => {
        it('should clear combat when Clear button is clicked and confirmed', async () => {
            vi.mocked(clearCombat).mockReturnValue({ round: 1, creatures: [{ name: 'Alice', type: 'player', initiative: '', targetName: null, concentration: null }, { name: 'Bob', type: 'player', initiative: '', targetName: null, concentration: null }] });
            vi.mocked(combatData.loadCombatSummary).mockResolvedValue({ round: 3, creatures: [{ name: 'Alice', type: 'player' }, { name: 'Bob', type: 'player' }, { name: 'Goblin', type: 'npc' }] });
            await act(async () => { render(<Initiative {...props} />); });
            await waitFor(() => { expect(screen.getByText(/Initiative \(round 3\)/)).toBeInTheDocument(); });
            await act(async () => { fireEvent.click(screen.getByText('Clear')); });
            await waitFor(() => { expect(screen.getByText(/Initiative \(round 1\)/)).toBeInTheDocument(); });
        });

        it('should not clear combat when cancelled', async () => {
            window.confirm = vi.fn(() => false);
            vi.mocked(combatData.loadCombatSummary).mockResolvedValue({ round: 3, creatures: [{ name: 'Alice', type: 'player' }] });
            await act(async () => { render(<Initiative {...props} />); });
            await waitFor(() => { expect(screen.getByText(/Initiative \(round 3\)/)).toBeInTheDocument(); });
            await act(async () => { fireEvent.click(screen.getByText('Clear')); });
            await waitFor(() => { expect(screen.getByText(/Initiative \(round 3\)/)).toBeInTheDocument(); });
        });
    });
});
