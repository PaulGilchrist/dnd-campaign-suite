// @improved-by-ai
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Initiative from './initiative.jsx';
import { loadCombatSummary, getActiveCreatureName } from '../../services/encounters/combatData.js';
import { loadNPCs } from '../../services/npcs/npcsService.js';
import { isPreviousDisabled, clearCombat } from '../../services/encounters/initiativeService.js';

vi.mock('../../hooks/runtime/useSSEEqualityGuard.js', () => ({ default: (setter) => setter }));
vi.mock('../../services/ui/utils.js', () => ({ default: { getName: (name) => name } }));
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn((key, prop) => {
        if (prop === 'currentHitPoints') return 10;
        if (prop === 'hitPoints') return 10;
        if (prop === 'activeConditions') return [];
        if (prop === 'activeBuffs') return [];
        if (prop === 'inspiringMovementNoOA') return false;
        return null;
    }),
    setRuntimeValue: vi.fn(),
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
vi.mock('../../services/rules/effects/expirations.js', () => ({ expireStaleEffects: vi.fn(), applyTurnStartEffects: vi.fn() }));
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
vi.mock('./ConditionPicker.jsx', () => ({ default: ({ targetName, selected: _sel, onSelect, onApply, onCancel }) => (<div data-testid="condition-picker"><span>{targetName}</span><button onClick={() => onSelect('blinded')}>Select Blinded</button><button onClick={onApply}>Apply</button><button onClick={onCancel}>Cancel</button></div>) }));
vi.mock('./ConcentrationPicker.jsx', () => ({ default: ({ targetName, spellName, onSpellNameChange, onApply, onCancel }) => (<div data-testid="concentration-picker"><span>{targetName}</span><input data-testid="concentration-spell-input" value={spellName} onChange={(e) => onSpellNameChange(e.target.value)} /><button onClick={onApply}>Apply</button><button onClick={onCancel}>Cancel</button></div>) }));

describe('Initiative', () => {
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

    describe('rendering', () => {
        it('should render initiative heading with round number, subscriber, carousel, and combat controls', async () => {
            vi.mocked(loadCombatSummary).mockResolvedValue({ round: 1, creatures: [] });
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

        it('should render creature cards with correct type class for players and NPCs', async () => {
            vi.mocked(loadCombatSummary).mockResolvedValue({ round: 1, creatures: [{ name: 'Alice', type: 'player' }, { name: 'Goblin', type: 'npc' }] });
            await act(async () => { render(<Initiative {...props} />); });
            await waitFor(() => {
                const alice = screen.queryByTestId('creature-card-Alice');
                const goblin = screen.queryByTestId('creature-card-Goblin');
                expect(alice).toBeInTheDocument();
                expect(goblin).toBeInTheDocument();
                expect(alice).toHaveClass('player');
                expect(goblin).toHaveClass('npc');
            });
        });
    });

    describe('combat summary initialization', () => {
        it('should load existing combat summary from storage', async () => {
            vi.mocked(loadCombatSummary).mockResolvedValue({ round: 3, creatures: [{ name: 'Alice', type: 'player', initiative: '15' }, { name: 'Goblin', type: 'npc', initiative: '10' }] });
            await act(async () => { render(<Initiative {...props} />); });
            await waitFor(() => { expect(screen.getByText(/Initiative \(round 3\)/)).toBeInTheDocument(); });
        });

        it('should create new combat summary when none exists', async () => {
            vi.mocked(loadCombatSummary).mockResolvedValue(null);
            await act(async () => { render(<Initiative {...props} />); });
            await waitFor(() => { expect(screen.getByText(/Initiative \(round 1\)/)).toBeInTheDocument(); });
        });

        it('should set first creature as active on initialization', async () => {
            vi.mocked(loadCombatSummary).mockResolvedValue({ round: 1, creatures: [{ name: 'Alice', type: 'player' }, { name: 'Bob', type: 'player' }] });
            await act(async () => { render(<Initiative {...props} />); });
            await waitFor(() => { expect(screen.queryByTestId('creature-card-Alice')).toBeInTheDocument(); });
        });

        it('should restore active creature name from storage on initialization', async () => {
            vi.mocked(loadCombatSummary).mockResolvedValue({ round: 1, creatures: [{ name: 'Alice', type: 'player' }, { name: 'Bob', type: 'player' }] });
            vi.mocked(getActiveCreatureName).mockReturnValue('Bob');
            await act(async () => { render(<Initiative {...props} />); });
            await waitFor(() => { expect(screen.queryByTestId('creature-card-Bob')).toBeInTheDocument(); });
        });
    });

    describe('NPC management', () => {
        it('should add an NPC when + NPC button is clicked', async () => {
            vi.mocked(loadCombatSummary).mockResolvedValue({ round: 1, creatures: [{ name: 'Alice', type: 'player' }] });
            await act(async () => { render(<Initiative {...props} />); });
            await waitFor(() => { expect(screen.getByText('+ NPC')).toBeInTheDocument(); });
            await act(async () => { fireEvent.click(screen.getByText('+ NPC')); });
            await waitFor(() => { expect(screen.getByText('+ NPC')).toBeInTheDocument(); });
        });

        it('should confirm before removing NPC with HP', async () => {
            vi.mocked(loadCombatSummary).mockResolvedValue({ round: 1, creatures: [{ name: 'Alice', type: 'player' }, { name: 'Goblin', type: 'npc', currentHp: 5 }] });
            await act(async () => { render(<Initiative {...props} />); });
            await waitFor(() => {
                expect(screen.queryByTestId('creature-card-Alice')).toBeInTheDocument();
                expect(screen.queryByTestId('creature-card-Goblin')).toBeInTheDocument();
            });
        });
    });

    describe('creature navigation', () => {
        it('should navigate to next creature', async () => {
            vi.mocked(loadCombatSummary).mockResolvedValue({ round: 1, creatures: [{ name: 'Alice', type: 'player' }, { name: 'Bob', type: 'player' }, { name: 'Charlie', type: 'player' }] });
            await act(async () => { render(<Initiative {...props} />); });
            await waitFor(() => { expect(screen.queryByTestId('creature-card-Alice')).toBeInTheDocument(); });
            await act(async () => { fireEvent.click(screen.getByText('Next →')); });
            await waitFor(() => { expect(screen.queryByTestId('creature-card-Bob')).toBeInTheDocument(); });
        });

        it('should wrap to first creature when at end (round increment)', async () => {
            vi.mocked(loadCombatSummary).mockResolvedValue({ round: 1, creatures: [{ name: 'Alice', type: 'player' }, { name: 'Bob', type: 'player' }] });
            await act(async () => { render(<Initiative {...props} />); });
            await waitFor(() => { expect(screen.queryByTestId('creature-card-Alice')).toBeInTheDocument(); });
            await act(async () => { fireEvent.click(screen.getByText('Next →')); });
            await waitFor(() => { expect(screen.queryByTestId('creature-card-Bob')).toBeInTheDocument(); });
            await act(async () => { fireEvent.click(screen.getByText('Next →')); });
            await waitFor(() => { expect(screen.queryByTestId('creature-card-Alice')).toBeInTheDocument(); });
        });

        it('should navigate to previous creature', async () => {
            vi.mocked(loadCombatSummary).mockResolvedValue({ round: 2, creatures: [{ name: 'Alice', type: 'player' }, { name: 'Bob', type: 'player' }, { name: 'Charlie', type: 'player' }] });
            vi.mocked(getActiveCreatureName).mockReturnValue('Charlie');
            await act(async () => { render(<Initiative {...props} />); });
            await waitFor(() => { expect(screen.queryByTestId('creature-card-Charlie')).toBeInTheDocument(); });
            await act(async () => { fireEvent.click(screen.getByText('← Prev')); });
            await waitFor(() => { expect(screen.queryByTestId('creature-card-Bob')).toBeInTheDocument(); });
        });

        it('should disable previous button on first creature in round 1', async () => {
            vi.mocked(isPreviousDisabled).mockReturnValue(true);
            vi.mocked(loadCombatSummary).mockResolvedValue({ round: 1, creatures: [{ name: 'Alice', type: 'player' }, { name: 'Bob', type: 'player' }] });
            await act(async () => { render(<Initiative {...props} />); });
            await waitFor(() => {
                const prevBtn = screen.getByText('← Prev');
                expect(prevBtn).toBeDisabled();
            });
        });
    });

    describe('keyboard navigation', () => {
        it('should navigate to next creature with ArrowRight', async () => {
            vi.mocked(loadCombatSummary).mockResolvedValue({ round: 1, creatures: [{ name: 'Alice', type: 'player' }, { name: 'Bob', type: 'player' }] });
            await act(async () => { render(<Initiative {...props} />); });
            await waitFor(() => { expect(screen.queryByTestId('creature-card-Alice')).toBeInTheDocument(); });
            await act(async () => { fireEvent.keyDown(window, { key: 'ArrowRight' }); });
            await waitFor(() => { expect(screen.queryByTestId('creature-card-Bob')).toBeInTheDocument(); });
        });

        it('should navigate to previous creature with ArrowLeft', async () => {
            vi.mocked(loadCombatSummary).mockResolvedValue({ round: 2, creatures: [{ name: 'Alice', type: 'player' }, { name: 'Bob', type: 'player' }] });
            vi.mocked(getActiveCreatureName).mockReturnValue('Bob');
            await act(async () => { render(<Initiative {...props} />); });
            await waitFor(() => { expect(screen.queryByTestId('creature-card-Bob')).toBeInTheDocument(); });
            await act(async () => { fireEvent.keyDown(window, { key: 'ArrowLeft' }); });
            await waitFor(() => { expect(screen.queryByTestId('creature-card-Alice')).toBeInTheDocument(); });
        });

        it('should add NPC with + key', async () => {
            vi.mocked(loadCombatSummary).mockResolvedValue({ round: 1, creatures: [{ name: 'Alice', type: 'player' }] });
            await act(async () => { render(<Initiative {...props} />); });
            await act(async () => { fireEvent.keyDown(window, { key: '+' }); });
        });

        it('should not navigate with ArrowLeft when previous is disabled', async () => {
            vi.mocked(isPreviousDisabled).mockReturnValue(true);
            vi.mocked(loadCombatSummary).mockResolvedValue({ round: 1, creatures: [{ name: 'Alice', type: 'player' }, { name: 'Bob', type: 'player' }] });
            await act(async () => { render(<Initiative {...props} />); });
            await waitFor(() => { expect(screen.queryByTestId('creature-card-Alice')).toBeInTheDocument(); });
            const event = new KeyboardEvent('keydown', { key: 'ArrowLeft', cancelable: true });
            await act(async () => { window.dispatchEvent(event); });
            expect(event.defaultPrevented).toBe(false);
        });
    });

    describe('clear combat', () => {
        it('should clear combat when Clear button is clicked and confirmed', async () => {
            vi.mocked(clearCombat).mockReturnValue({ round: 1, creatures: [{ name: 'Alice', type: 'player', initiative: '', targetName: null, concentration: null }, { name: 'Bob', type: 'player', initiative: '', targetName: null, concentration: null }] });
            vi.mocked(loadCombatSummary).mockResolvedValue({ round: 3, creatures: [{ name: 'Alice', type: 'player' }, { name: 'Bob', type: 'player' }, { name: 'Goblin', type: 'npc' }] });
            await act(async () => { render(<Initiative {...props} />); });
            await waitFor(() => { expect(screen.getByText(/Initiative \(round 3\)/)).toBeInTheDocument(); });
            await act(async () => { fireEvent.click(screen.getByText('Clear')); });
            await waitFor(() => { expect(screen.getByText(/Initiative \(round 1\)/)).toBeInTheDocument(); });
        });

        it('should not clear combat when cancelled', async () => {
            window.confirm = vi.fn(() => false);
            vi.mocked(loadCombatSummary).mockResolvedValue({ round: 3, creatures: [{ name: 'Alice', type: 'player' }] });
            await act(async () => { render(<Initiative {...props} />); });
            await waitFor(() => { expect(screen.getByText(/Initiative \(round 3\)/)).toBeInTheDocument(); });
            await act(async () => { fireEvent.click(screen.getByText('Clear')); });
            await waitFor(() => { expect(screen.getByText(/Initiative \(round 3\)/)).toBeInTheDocument(); });
        });
    });

    describe('callbacks', () => {
        it('should call onNpcsChange with NPC list when combatSummary changes', async () => {
            vi.mocked(loadCombatSummary).mockResolvedValue({ round: 1, creatures: [{ name: 'Alice', type: 'player' }, { name: 'Goblin', type: 'npc' }] });
            await act(async () => { render(<Initiative {...props} />); });
            await waitFor(() => { expect(props.onNpcsChange).toHaveBeenCalled(); });
        });

        it('should load NPCs when campaignName is provided', async () => {
            vi.mocked(loadCombatSummary).mockResolvedValue({ round: 1, creatures: [{ name: 'Alice', type: 'player' }] });
            await act(async () => { render(<Initiative {...props} />); });
            await waitFor(() => { expect(loadNPCs).toHaveBeenCalledWith('test-campaign'); });
        });
    });

    describe('edge cases', () => {
        it('should handle empty characters array', async () => {
            vi.mocked(loadCombatSummary).mockResolvedValue({ round: 1, creatures: [] });
            await act(async () => { render(<Initiative {...props} characters={[]} />); });
            await waitFor(() => { expect(screen.getByText(/Initiative \(round 1\)/)).toBeInTheDocument(); });
        });

        it('should render without isLocalhost flag', async () => {
            vi.mocked(loadCombatSummary).mockResolvedValue({ round: 1, creatures: [{ name: 'Alice', type: 'player' }] });
            await act(async () => { render(<Initiative {...props} isLocalhost={false} />); });
            await waitFor(() => { expect(screen.getByTestId('subscriber')).toBeInTheDocument(); });
        });

        it('should handle undefined campaignName', async () => {
            vi.mocked(loadCombatSummary).mockResolvedValue({ round: 1, creatures: [{ name: 'Alice', type: 'player' }] });
            await act(async () => { render(<Initiative {...props} campaignName={undefined} />); });
            await waitFor(() => { expect(screen.getByTestId('subscriber')).toBeInTheDocument(); });
        });
    });

    describe('SSE event handling - combatSummary', () => {
        it('should handle combatSummary SSE event without error', async () => {
            vi.mocked(loadCombatSummary).mockResolvedValue({ round: 1, creatures: [{ name: 'Alice', type: 'player' }] });
            await act(async () => { render(<Initiative {...props} />); });
            await waitFor(() => { expect(screen.queryByTestId('creature-card-Alice')).toBeInTheDocument(); });

            await act(async () => {
                window.dispatchEvent(new CustomEvent('change-test-campaign-combatSummary', {
                    detail: { key: 'change-test-campaign-combatSummary', data: { round: 2, creatures: [{ name: 'Alice', type: 'player' }] } },
                }));
            });
            expect(screen.queryByTestId('creature-card-Alice')).toBeInTheDocument();
        });

        it('should ignore combatSummary SSE event without creatures array', async () => {
            vi.mocked(loadCombatSummary).mockResolvedValue({ round: 1, creatures: [{ name: 'Alice', type: 'player' }] });
            await act(async () => { render(<Initiative {...props} />); });
            await waitFor(() => { expect(screen.queryByTestId('creature-card-Alice')).toBeInTheDocument(); });

            await act(async () => {
                window.dispatchEvent(new CustomEvent('change-test-campaign-combatSummary', {
                    detail: { key: 'change-test-campaign-combatSummary', data: { round: 2 } },
                }));
            });
            expect(screen.queryByTestId('creature-card-Alice')).toBeInTheDocument();
        });

        it('should ignore SSE events from other campaigns', async () => {
            vi.mocked(loadCombatSummary).mockResolvedValue({ round: 1, creatures: [{ name: 'Alice', type: 'player' }] });
            await act(async () => { render(<Initiative {...props} />); });
            await waitFor(() => { expect(screen.queryByTestId('creature-card-Alice')).toBeInTheDocument(); });

            await act(async () => {
                window.dispatchEvent(new CustomEvent('change-other-campaign-combatSummary', {
                    detail: { key: 'change-other-campaign-combatSummary', data: { round: 2, creatures: [] } },
                }));
            });
            expect(screen.queryByTestId('creature-card-Alice')).toBeInTheDocument();
        });
    });

    describe('SSE event handling - activeCreatureName', () => {
        it('should handle activeCreatureName SSE event', async () => {
            vi.mocked(loadCombatSummary).mockResolvedValue({ round: 1, creatures: [{ name: 'Alice', type: 'player' }, { name: 'Bob', type: 'player' }] });
            await act(async () => { render(<Initiative {...props} />); });
            await waitFor(() => { expect(screen.queryByTestId('creature-card-Alice')).toBeInTheDocument(); });

            await act(async () => {
                window.dispatchEvent(new CustomEvent('change-test-campaign-activeCreatureName', {
                    detail: { key: 'change-test-campaign-activeCreatureName', data: 'Bob' },
                }));
            });
            expect(screen.queryByTestId('creature-card-Alice')).toBeInTheDocument();
        });
    });

    describe('SSE event handling - spell overlays', () => {
        it('should handle overlay add event', async () => {
            vi.mocked(loadCombatSummary).mockResolvedValue({ round: 1, creatures: [{ name: 'Alice', type: 'player' }] });
            await act(async () => { render(<Initiative {...props} />); });
            await waitFor(() => { expect(screen.queryByTestId('creature-card-Alice')).toBeInTheDocument(); });

            await act(async () => {
                window.dispatchEvent(new CustomEvent('spell-overlay-test-campaign', {
                    detail: { key: 'spell-overlay-test-campaign', data: { action: 'add', overlays: [{ id: 'overlay-1', label: 'Fireball' }] } },
                }));
            });
            expect(screen.queryByTestId('creature-card-Alice')).toBeInTheDocument();
        });

        it('should handle overlay update event', async () => {
            vi.mocked(loadCombatSummary).mockResolvedValue({ round: 1, creatures: [{ name: 'Alice', type: 'player' }] });
            await act(async () => { render(<Initiative {...props} />); });
            await waitFor(() => { expect(screen.queryByTestId('creature-card-Alice')).toBeInTheDocument(); });

            await act(async () => {
                window.dispatchEvent(new CustomEvent('spell-overlay-test-campaign', {
                    detail: { key: 'spell-overlay-test-campaign', data: { action: 'update', overlays: [{ id: 'overlay-1', label: 'Updated Fireball' }] } },
                }));
            });
        });

        it('should handle overlay remove event', async () => {
            vi.mocked(loadCombatSummary).mockResolvedValue({ round: 1, creatures: [{ name: 'Alice', type: 'player' }] });
            await act(async () => { render(<Initiative {...props} />); });
            await waitFor(() => { expect(screen.queryByTestId('creature-card-Alice')).toBeInTheDocument(); });

            await act(async () => {
                window.dispatchEvent(new CustomEvent('spell-overlay-test-campaign', {
                    detail: { key: 'spell-overlay-test-campaign', data: { action: 'remove', overlayId: 'overlay-1' } },
                }));
            });
        });

        it('should handle overlay clear event', async () => {
            vi.mocked(loadCombatSummary).mockResolvedValue({ round: 1, creatures: [{ name: 'Alice', type: 'player' }] });
            await act(async () => { render(<Initiative {...props} />); });
            await waitFor(() => { expect(screen.queryByTestId('creature-card-Alice')).toBeInTheDocument(); });

            await act(async () => {
                window.dispatchEvent(new CustomEvent('spell-overlay-test-campaign', {
                    detail: { key: 'spell-overlay-test-campaign', data: { action: 'clear' } },
                }));
            });
        });

        it('should ignore overlay events from other campaigns', async () => {
            vi.mocked(loadCombatSummary).mockResolvedValue({ round: 1, creatures: [{ name: 'Alice', type: 'player' }] });
            await act(async () => { render(<Initiative {...props} />); });
            await waitFor(() => { expect(screen.queryByTestId('creature-card-Alice')).toBeInTheDocument(); });

            await act(async () => {
                window.dispatchEvent(new CustomEvent('spell-overlay-other-campaign', {
                    detail: { key: 'spell-overlay-other-campaign', data: { action: 'clear' } },
                }));
            });
            expect(screen.queryByTestId('creature-card-Alice')).toBeInTheDocument();
        });
    });

    describe('window event listeners', () => {
        it('should handle initiative-rolled event without error', async () => {
            vi.mocked(loadCombatSummary).mockResolvedValue({ round: 1, creatures: [{ name: 'Alice', type: 'player' }] });
            await act(async () => { render(<Initiative {...props} />); });
            await waitFor(() => { expect(screen.queryByTestId('creature-card-Alice')).toBeInTheDocument(); });

            await act(async () => {
                window.dispatchEvent(new CustomEvent('initiative-rolled'));
            });
            expect(screen.queryByTestId('creature-card-Alice')).toBeInTheDocument();
        });

        it('should handle concentration-result event that breaks concentration', async () => {
            vi.mocked(loadCombatSummary).mockResolvedValue({ round: 1, creatures: [{ name: 'Alice', type: 'player', concentration: { spell: 'Shield', dc: 10 } }] });
            await act(async () => { render(<Initiative {...props} />); });
            await waitFor(() => { expect(screen.queryByTestId('creature-card-Alice')).toBeInTheDocument(); });

            await act(async () => {
                window.dispatchEvent(new CustomEvent('concentration-result', {
                    detail: { targetName: 'Alice', success: false },
                }));
            });
            expect(screen.queryByTestId('creature-card-Alice')).toBeInTheDocument();
        });

        it('should handle death-save-result event', async () => {
            vi.mocked(loadCombatSummary).mockResolvedValue({ round: 1, creatures: [{ name: 'Alice', type: 'player' }] });
            await act(async () => { render(<Initiative {...props} />); });
            await waitFor(() => { expect(screen.queryByTestId('creature-card-Alice')).toBeInTheDocument(); });

            await act(async () => {
                window.dispatchEvent(new CustomEvent('death-save-result', {
                    detail: { targetName: 'Alice', restoredToHp: 5 },
                }));
            });
            expect(screen.queryByTestId('creature-card-Alice')).toBeInTheDocument();
        });
    });

    describe('displayCreatures memo', () => {
        it('should not render carousel content when combatSummary is null', async () => {
            vi.mocked(loadCombatSummary).mockResolvedValue(null);
            const { container } = await act(async () => render(<Initiative {...props} />));
            await waitFor(() => {
                expect(container.querySelector('.carousel-container')).not.toBeNull();
            });
        });

        it('should handle player creature with no matching character by using defaults', async () => {
            vi.mocked(loadCombatSummary).mockResolvedValue({ round: 1, creatures: [{ name: 'Unknown', type: 'player' }] });
            await act(async () => { render(<Initiative {...props} />); });
            await waitFor(() => { expect(screen.queryByTestId('creature-card-Unknown')).toBeInTheDocument(); });
        });
    });
});
