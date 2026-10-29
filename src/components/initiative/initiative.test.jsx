// @maintained-by-ai
// Initiative CONTAINER lane: proves only what the real Initiative.jsx wiring can prove —
// (1) mount census: exact card set per combatSummary roster, ONE shared Subscriber (app SSE
// mandate), GM controls + their contract tooltip, onNpcsChange push to the parent;
// (2) combat-summary-updated adoption seam (inline listener, owned here — not #863's
// concentration/death-save pair, not #864's initiative-rolled seam);
// (3) Clear-button DOM→handler flow through window.confirm (factory internals: cite
// createCreatureHandlers.test.jsx #837 "handleClear confirmed/declined"; cancelled path
// folded here per REC #837, shrunk to one click assertion).
// CUT (owners cited): handler internals #833-#847, inline concentration/death-save
// listeners #863, initiative-rolled seam #864, card render/dispatch/prompts #848-#853,
// EffectAdder #855-#861/#838-#839, HpBar #862, keydown/nav seams → navigationHandlers
// lanes (queued). Boundary-mocked per REC #837 + zero-network guard #841:
// sessionService, autoRewardService, zoneDurationClock, spellOverlayService (mount fetch).
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
    // L5-001: TurnEconomyStrip subscribes via useRuntimeValue; null ⇒ enforcement off.
    useRuntimeValue: vi.fn(() => null),
    // useLootHandlers subscribes to cross-tab loot-draft echoes via addStorageChangeListener.
    addStorageChangeListener: vi.fn(() => () => {}),
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
vi.mock('../../services/rules/effects/expirations.js', () => ({ expireStaleEffects: vi.fn(), applyTurnStartEffects: vi.fn(), applyTurnEndConditionRemoval: vi.fn(() => Promise.resolve()), clearExpirationEffects: vi.fn() }));
// REC #837 boundary mocks — handleClear reaches these for REAL otherwise (fetches in jsdom).
vi.mock('../../services/combat/sessionService.js', () => ({ setSessionPhase: vi.fn(() => Promise.resolve()) }));
vi.mock('../../services/items/autoRewardService.js', () => ({ autoAwardCombatRewards: vi.fn(() => Promise.resolve()) }));
vi.mock('../../services/rules/effects/zoneDurationClock.js', () => ({ sweepNewCombatClocks: vi.fn(() => Promise.resolve()) }));
// Zero-network guard #841: mount fetches spell overlays for real otherwise.
vi.mock('../../services/maps/spellOverlayService.js', () => ({
    fetchSpellOverlays: vi.fn(() => Promise.resolve([])),
    overlayTargetId: vi.fn(() => null),
}));
vi.mock('../../services/encounters/combatData.js', () => ({
    loadCombatSummary: vi.fn(),
    getCombatSummary: vi.fn(() => null),
    getActiveCreatureName: vi.fn(() => null),
    setCombatSummaryCache: vi.fn(),
}));
vi.mock('../../services/combat/auras/unbreakableMajesty.js', () => ({ clearPerRoundMajestyTrackers: vi.fn() }));
vi.mock('../../services/encounters/initiativeService.js', () => ({
    setupCreatures: vi.fn((characters) => characters.map((ch) => ({ name: ch.name, type: 'player', initiative: '', targetName: null, concentration: null }))),
    isBareNpcPlaceholder: (c) => c.type === 'npc' && !c.monsterIndex && /^NPC \d+$/.test(c.name || ''),
    addNpc: vi.fn((cs) => { cs.creatures.push({ name: 'NPC 1', type: 'npc', initiative: '', targetName: null, ac: 10, resistances: [], immunities: [], conditions: [], concentration: null, maxHp: 10, currentHp: 10, saveBonuses: {} }); return 1; }),
    removeNpc: vi.fn(),
    getNextCreatureName: vi.fn((cs, active) => { const idx = cs.creatures.findIndex((c) => c.name === active); if (idx < cs.creatures.length - 1) return { newActiveName: cs.creatures[idx + 1].name, roundIncrement: false }; return { newActiveName: cs.creatures[0].name, roundIncrement: true }; }),
    getPreviousCreatureName: vi.fn((cs, active) => { const idx = cs.creatures.findIndex((c) => c.name === active); if (idx > 0) return { newActiveName: cs.creatures[idx - 1].name, roundDecrement: false }; return { newActiveName: cs.creatures[cs.creatures.length - 1].name, roundDecrement: true }; }),
    isPreviousDisabled: vi.fn(() => false),
    setInitiative: vi.fn(),
    rollNpcInitiative: vi.fn(() => ({ roll: 15, bonus: 2, total: 17 })),
    renameNpc: vi.fn(() => Promise.resolve()),
    setTarget: vi.fn(),
    clearCombat: vi.fn((characters, npcCount = 0) => ({ round: 1, creatures: [
        ...characters.map((ch) => ({ name: ch.name, type: 'player', initiative: '', targetName: null, concentration: null })),
        ...Array.from({ length: npcCount }, (_, i) => ({ name: `NPC ${i + 1}`, type: 'npc', initiative: '', targetName: null, concentration: null })),
    ] })),
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
        // Determinism #827: every summary source re-pinned per test, no cross-test leak.
        vi.mocked(combatData.loadCombatSummary).mockResolvedValue({ round: 3, creatures: [
            { name: 'Alice', type: 'player', initiative: '18', targetName: null, concentration: null },
            { name: 'Bob', type: 'player', initiative: '12', targetName: null, concentration: null },
            { name: 'Goblin', type: 'npc', initiative: '8', targetName: null, concentration: null, maxHp: 7, currentHp: 7 },
        ] });
        vi.mocked(combatData.getCombatSummary).mockReturnValue(null);
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

    it('renders round heading, exact card census, ONE shared Subscriber, GM controls, and reports the NPC roster to the parent', async () => {
        await act(async () => { render(<Initiative {...props} />); });

        await waitFor(() => {
            expect(screen.getByText('Initiative (round 3)')).toBeInTheDocument();
        });
        // Card census #781: exact set by name — no deep card content (that's CreatureCard lanes #848-#853).
        const cardNames = screen.getAllByTestId(/^creature-card-/).map((el) => el.getAttribute('data-testid').replace('creature-card-', ''));
        expect([...cardNames].sort()).toEqual(['Alice', 'Bob', 'Goblin']);
        // App mandate: subscription flows through the single shared Subscriber component, never a second EventSource.
        expect(screen.getAllByTestId('subscriber')).toHaveLength(1);
        // GM controls present, with the + NPC button's exact auto-naming/10-HP contract tooltip.
        const npcButton = screen.getByText('+ NPC');
        expect(screen.getByText('Clear')).toBeInTheDocument();
        expect(screen.getByText('← Prev')).toBeInTheDocument();
        expect(screen.getByText('Next →')).toBeInTheDocument();
        expect(npcButton.getAttribute('title')).toBe('Adds a statless NPC named "NPC 1", "NPC 2", … at 10 HP (AC 10) — rename it to a monster name or drop a monster from the Encounter Builder to set real stats');
        // Container push to parent: exactly the NPCs on the tracker, imageless until resolved.
        await waitFor(() => {
            expect(props.onNpcsChange).toHaveBeenCalledWith([{ name: 'Goblin', type: 'npc', imageUrl: null }]);
        });
    });

    it('adopts the combat-summary cache when combat-summary-updated fires', async () => {
        await act(async () => { render(<Initiative {...props} />); });
        await waitFor(() => { expect(screen.getByText('Initiative (round 3)')).toBeInTheDocument(); });

        vi.mocked(combatData.getCombatSummary).mockReturnValue({ round: 5, creatures: [
            { name: 'Alice', type: 'player', initiative: '18', targetName: null, concentration: null },
            { name: 'Ogre', type: 'npc', initiative: '6', targetName: null, concentration: null, maxHp: 20, currentHp: 20 },
        ] });
        await act(async () => { window.dispatchEvent(new Event('combat-summary-updated')); });

        await waitFor(() => { expect(screen.getByText('Initiative (round 5)')).toBeInTheDocument(); });
        // Adoption replaces the roster byte-adopted from the cache (no merge at this seam).
        const cardNames = screen.getAllByTestId(/^creature-card-/).map((el) => el.getAttribute('data-testid').replace('creature-card-', ''));
        expect([...cardNames].sort()).toEqual(['Alice', 'Ogre']);
    });

    it('Clear button clears combat only after confirm, resetting the tracker to round 1', async () => {
        await act(async () => { render(<Initiative {...props} />); });
        await waitFor(() => { expect(screen.getByText('Initiative (round 3)')).toBeInTheDocument(); });

        // Cancelled path (shrunk per REC #837 — factory declined-row internals cited there).
        window.confirm = vi.fn(() => false);
        fireEvent.click(screen.getByText('Clear'));
        expect(clearCombat).not.toHaveBeenCalled();
        expect(screen.getByText('Initiative (round 3)')).toBeInTheDocument();

        // Confirmed path: DOM click reaches the factory handler and the UI round-trips to round 1.
        // The fixture's 'Goblin' has no monsterIndex but is not a bare "NPC N" placeholder either —
        // it is monster-shaped, so Clear counts zero carry-overs (bug-initiative-clear-monsters-become-npc-stubs).
        window.confirm = vi.fn(() => true);
        await act(async () => { fireEvent.click(screen.getByText('Clear')); });
        expect(clearCombat).toHaveBeenCalledWith(props.characters, 0, expect.any(Function));
        await waitFor(() => { expect(screen.getByText('Initiative (round 1)')).toBeInTheDocument(); });
        const cardNames = screen.getAllByTestId(/^creature-card-/).map((el) => el.getAttribute('data-testid').replace('creature-card-', ''));
        expect([...cardNames].sort()).toEqual(['Alice', 'Bob']);
    });

    it('Clear re-seeds players + only bare "NPC N" placeholders — EB-joined monsters never resurrect as stubs', async () => {
        // Live board shape after EB Join + "+ NPC": the monster carries monsterIndex.
        vi.mocked(combatData.loadCombatSummary).mockResolvedValue({ round: 2, creatures: [
            { name: 'Alice', type: 'player', initiative: '18', targetName: null, concentration: null },
            { name: 'Bob', type: 'player', initiative: '12', targetName: null, concentration: null },
            { name: 'Goblin', type: 'npc', monsterIndex: 'goblin', initiative: '13', targetName: null, concentration: null, ac: 15, maxHp: 7, currentHp: 7, saveBonuses: {} },
            { name: 'NPC 1', type: 'npc', initiative: '5', targetName: null, concentration: null, ac: 10, maxHp: 10, currentHp: 10, saveBonuses: {} },
        ] });
        await act(async () => { render(<Initiative {...props} />); });
        await waitFor(() => { expect(screen.getByText('Initiative (round 2)')).toBeInTheDocument(); });

        window.confirm = vi.fn(() => true);
        await act(async () => { fireEvent.click(screen.getByText('Clear')); });

        // Only the bare placeholder is counted — the Goblin is gone for good.
        expect(clearCombat).toHaveBeenCalledWith(props.characters, 1, expect.any(Function));
        await waitFor(() => { expect(screen.getByText('Initiative (round 1)')).toBeInTheDocument(); });
        const cardNames = screen.getAllByTestId(/^creature-card-/).map((el) => el.getAttribute('data-testid').replace('creature-card-', ''));
        expect([...cardNames].sort()).toEqual(['Alice', 'Bob', 'NPC 1']);
    });
});
