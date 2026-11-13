// @maintained-by-ai
// Phase 1 TV-mode lane (Initiative CONTAINER): proves the presentation toggle
// (per-client localStorage display setting), the derived up-next strip, the
// HP-diff floater events (emit on damage, retire via the feedback-done callback
// — jsdom has no CSS animations; live animationend proven via Playwright),
// and the victory banner (shows the stamped result, dismiss persists, hidden
// while foes are on the board, honest defeat copy). Boundary mocks mirror
// initiative.test.jsx (REC #837 + zero-network guard #841 doctrine).
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cloneDeep } from 'lodash';
import Initiative from './Initiative.jsx';
import * as combatData from '../../services/encounters/combatData.js';
import * as monsterUtils from '../../services/npcs/monsterUtils.js';
import * as runtime from '../../hooks/runtime/useRuntimeState.js';
import storage from '../../services/ui/storage.js';
import { getTvModeActive } from '../../services/ui/tvModeStore.js';
import TvExitButton from '../common/TvExitButton/TvExitButton.jsx';

const syncStateStore = new Map();
let lastCombatResult = null;

vi.mock('../../hooks/runtime/useSSEEqualityGuard.js', () => ({ default: (setter) => setter }));
vi.mock('../../services/ui/utils.js', () => ({ default: { getName: (name) => name } }));
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    deleteRuntimeKey: vi.fn(),
    getStore: vi.fn(() => syncStateStore),
    useRuntimeValue: vi.fn((_key, prop) => (prop === 'lastCombatResult' ? lastCombatResult : null)),
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
    CONDITIONS: [{ key: 'blinded', label: 'Blinded' }],
}));
vi.mock('../../services/npcs/npcsService.js', () => ({ loadNPCs: vi.fn(() => Promise.resolve({ npcs: [] })) }));
vi.mock('../../services/encounters/npcStatBlockUtils.js', () => ({ npcToMonsterFormat: vi.fn(() => null), npcHasStatBlock: vi.fn(() => true) }));
vi.mock('../../services/rules/effects/expirations.js', () => ({ expireStaleEffects: vi.fn(), applyTurnStartEffects: vi.fn(), applyTurnEndConditionRemoval: vi.fn(() => Promise.resolve()), clearExpirationEffects: vi.fn() }));
vi.mock('../../services/combat/sessionService.js', () => ({ setSessionPhase: vi.fn(() => Promise.resolve()) }));
vi.mock('../../services/items/autoRewardService.js', () => ({ autoAwardCombatRewards: vi.fn(() => Promise.resolve()) }));
vi.mock('../../services/rules/effects/zoneDurationClock.js', () => ({ sweepNewCombatClocks: vi.fn(() => Promise.resolve()) }));
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
    addNpc: vi.fn(),
    removeNpc: vi.fn(),
    getNextCreatureName: vi.fn(),
    getPreviousCreatureName: vi.fn(),
    isPreviousDisabled: vi.fn(() => false),
    setInitiative: vi.fn(),
    rollNpcInitiative: vi.fn(),
    renameNpc: vi.fn(() => Promise.resolve()),
    setTarget: vi.fn(),
    clearCombat: vi.fn(),
    mergeCombatSummaryWithCharacters: vi.fn((initialSummary, characters) => {
        const names = new Set((initialSummary?.creatures ?? []).map(c => c.name));
        const newCreatures = characters.filter(ch => !names.has(ch.name)).map((ch) => ({ name: ch.name, type: 'player', initiative: '', targetName: null, concentration: null }));
        return { round: initialSummary?.round ?? 1, creatures: [...(initialSummary?.creatures ?? []), ...newCreatures] };
    }),
}));
vi.mock('../../services/combat/conditions/conditionSaveService.js', () => ({
    rollConditionSave: vi.fn(), removeCondition: vi.fn(), addCondition: vi.fn(), buildConditionPopup: vi.fn(),
}));
vi.mock('../../services/combat/concentration/concentrationService.js', () => ({
    rollConcentrationSave: vi.fn(), breakConcentration: vi.fn(), addConcentration: vi.fn(), buildConcentrationPopup: vi.fn(), cleanupConcentrationEffects: vi.fn(),
}));
vi.mock('../../services/combat/conditions/targetEffectDefinitions.js', () => ({
    getEffectDefinition: vi.fn(() => null),
}));
vi.mock('../../services/combat/automation/automationPassives.js', () => ({
    isResilientSphereActive: vi.fn(() => false),
    getResilientSphereSource: vi.fn(() => null),
}));
vi.mock('../../services/automation/common/buffToggle.js', () => ({ isBuffActive: vi.fn(() => false) }));
vi.mock('../../services/combat/auras/unbreakableMajesty.js', () => ({
    isUnbreakableMajestyActive: vi.fn(() => false),
    getUnbreakableMajestySaveDc: vi.fn(() => 0),
    clearUnbreakableMajesty: vi.fn(),
    clearPerRoundMajestyTrackers: vi.fn(),
}));
vi.mock('../../services/automation/handlers/class-druid/wildShapeCreatureBuilder.js', () => ({ cleanupWildShape: vi.fn() }));
vi.mock('../../services/automation/handlers/spells/polymorphService.js', () => ({ revertPolymorph: vi.fn() }));
vi.mock('../../services/automation/handlers/spells/animalShapesService.js', () => ({ revertAnimalShapes: vi.fn() }));
vi.mock('../../services/automation/handlers/spells/shapechangeService.js', () => ({ revertShapechange: vi.fn() }));
vi.mock('../../services/combat/sessionService.js', () => ({ setSessionPhase: vi.fn(() => Promise.resolve()) }));
vi.mock('../../services/combat/conditions/effectDescriptions.js', () => ({
    CONDITION_DESCRIPTIONS: {}, HP_STATUS_DESCRIPTIONS: { DEAD: 'dead', BLOODIED: 'bloodied', OK: 'ok' },
}));
vi.mock('../../services/combat/conditions/savePromptService.js', () => ({
    clearDeathSavePrompt: vi.fn(),
    sendFleshToStoneResult: vi.fn(), sendPrismaticSprayIndigoResult: vi.fn(), sendPrismaticSprayVioletResult: vi.fn(),
}));
vi.mock('../../services/combat/thiefsReflexesService.js', () => ({ isSecondTurnEntry: vi.fn(() => false) }));
vi.mock('../encounter/MonsterCardModal.jsx', () => ({ default: () => <div data-testid="monster-card-modal" /> }));
vi.mock('../common/Subscriber.jsx', () => ({ default: () => <div data-testid="subscriber" /> }));
vi.mock('../common/Popup.jsx', () => ({ default: ({ children, onClickOrKeyDown }) => (<div data-testid="popup-overlay" onClick={onClickOrKeyDown}><div data-testid="popup-modal">{children}</div></div>) }));
vi.mock('../char-sheet/DiceRollResult.jsx', () => ({ default: ({ name }) => <div data-testid="dice-roll-result">{name}</div> }));
// Card stands in for the real CreatureCard/HpFeedback pair: it echoes the
// container-owned hpEvent wiring (delta + animationend retirement) without
// re-testing card internals (#848-#853 lanes).
vi.mock('./CreatureCard.jsx', () => ({
    default: ({ creature, tvMode, hpEvent, onHpFeedbackDone, onNpcClick }) => (
        <div data-testid={`creature-card-${creature.name}`} className={`creature-card ${creature.type}${tvMode ? ' tv' : ''}`}>
            <span>{creature.name}</span>
            {/* Avatar-click seam: drives the container's real handleNpcClick. */}
            <button data-testid={`npc-click-${creature.name}`} onClick={() => onNpcClick(creature)}>avatar</button>
            {hpEvent && (
                <span
                    data-testid={`floater-${creature.name}`}
                    onAnimationEnd={() => onHpFeedbackDone(creature.name)}
                >
                    {hpEvent.delta}
                </span>
            )}
            <button data-testid={`retire-${creature.name}`} onClick={() => onHpFeedbackDone(creature.name)}>retire</button>
        </div>
    ),
}));
vi.mock('./EffectAdder.jsx', () => ({ default: ({ targetName }) => <div data-testid="effect-adder"><span>{targetName}</span></div> }));

const ROSTER_WITH_FOE = { round: 3, creatures: [
    { name: 'Alice', type: 'player', initiative: '18', targetName: null, concentration: null },
    { name: 'Bob', type: 'player', initiative: '12', targetName: null, concentration: null },
    { name: 'Goblin', type: 'npc', initiative: '8', targetName: null, concentration: null, maxHp: 7, currentHp: 7 },
] };
const ROSTER_PARTY_ONLY = { round: 1, creatures: [
    { name: 'Alice', type: 'player', initiative: '18', targetName: null, concentration: null },
    { name: 'Bob', type: 'player', initiative: '12', targetName: null, concentration: null },
] };

describe('Initiative TV mode', () => {
    let props;

    beforeEach(() => {
        vi.clearAllMocks();
        syncStateStore.clear();
        lastCombatResult = null;
        localStorage.clear();
        window.confirm = vi.fn(() => true);
        Element.prototype.scrollIntoView = vi.fn();
        vi.mocked(combatData.loadCombatSummary).mockResolvedValue(cloneDeep(ROSTER_WITH_FOE));
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

    it('TV toggle switches presentation mode and persists the per-client preference', async () => {
        await act(async () => { render(<Initiative {...props} />); });
        await waitFor(() => { expect(screen.getByText('Initiative (round 3)')).toBeInTheDocument(); });

        const root = document.querySelector('.initiative');
        expect(root.className).not.toContain('initiative--tv');

        const button = screen.getByRole('button', { name: /TV/i });
        expect(button).toHaveAttribute('aria-pressed', 'false');
        fireEvent.click(button);

        expect(document.querySelector('.initiative').className).toContain('initiative--tv');
        expect(button).toHaveAttribute('aria-pressed', 'true');
        expect(localStorage.getItem('initiative-tv')).toBe('1');

        // Toggle back off — the display setting, not game state, must follow.
        fireEvent.click(button);
        expect(document.querySelector('.initiative').className).not.toContain('initiative--tv');
        expect(localStorage.getItem('initiative-tv')).toBe('0');
    });

    it('restores TV mode from the saved per-client preference on mount', async () => {
        localStorage.setItem('initiative-tv', '1');
        let view;
        await act(async () => { view = render(<Initiative {...props} />); });
        await waitFor(() => { expect(screen.getByText('Initiative (round 3)')).toBeInTheDocument(); });

        expect(document.querySelector('.initiative').className).toContain('initiative--tv');
        expect(screen.getByRole('button', { name: /TV/i })).toHaveAttribute('aria-pressed', 'true');
        // Restored-TV also re-broadcasts the shell-wide sidebar gate.
        expect(getTvModeActive()).toBe(true);
        // Leaving the tracker view clears the broadcast (navigation returns).
        act(() => { view.unmount(); });
        expect(getTvModeActive()).toBe(false);
    });

    it('broadcasts TV mode to the app shell sidebar gate on toggle', async () => {
        expect(getTvModeActive()).toBe(false);
        await act(async () => { render(<Initiative {...props} />); });
        await waitFor(() => { expect(screen.getByText('Initiative (round 3)')).toBeInTheDocument(); });
        expect(getTvModeActive()).toBe(false);

        const button = screen.getByRole('button', { name: /TV/i });
        fireEvent.click(button);
        expect(getTvModeActive()).toBe(true);

        fireEvent.click(button);
        expect(getTvModeActive()).toBe(false);
    });

    it('app-level corner button exits the tracker TV presentation and re-arms on toggle', async () => {
        // Cold-load replica: pref ON → tracker mounts in TV with the corner
        // escape visible (QA backlog 2026-11-08: no nav-guessing trap).
        localStorage.setItem('initiative-tv', '1');
        render(
            <>
                <Initiative {...props} />
                <TvExitButton />
            </>
        );
        await waitFor(() => { expect(screen.getByText('Initiative (round 3)')).toBeInTheDocument(); });
        expect(document.querySelector('.initiative').className).toContain('initiative--tv');
        expect(getTvModeActive()).toBe(true);
        expect(screen.getByRole('button', { name: 'Exit TV mode' })).toBeInTheDocument();

        // Click exits — identical to the in-tracker toggle's OFF face.
        fireEvent.click(screen.getByRole('button', { name: 'Exit TV mode' }));
        await waitFor(() => {
            expect(document.querySelector('.initiative').className).not.toContain('initiative--tv');
        });
        expect(getTvModeActive()).toBe(false);
        expect(localStorage.getItem('initiative-tv')).toBe('0');
        expect(screen.queryByRole('button', { name: 'Exit TV mode' })).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'TV' })).toHaveAttribute('aria-pressed', 'false');

        // The in-tracker toggle keeps working both ways and re-arms the corner.
        fireEvent.click(screen.getByRole('button', { name: 'TV' }));
        expect(document.querySelector('.initiative').className).toContain('initiative--tv');
        expect(localStorage.getItem('initiative-tv')).toBe('1');
        expect(screen.getByRole('button', { name: 'Exit TV mode' })).toBeInTheDocument();
    });

    it('up-next strip lists the following creatures in turn order (wraparound), never the active one', async () => {
        await act(async () => { render(<Initiative {...props} />); });
        await waitFor(() => { expect(screen.getByText('Initiative (round 3)')).toBeInTheDocument(); });

        // Active creature defaults to the first card (Alice) — strip shows Bob then Goblin.
        const strip = document.querySelector('.tv-next-up');
        expect(strip).not.toBeNull();
        const chips = [...strip.querySelectorAll('.tv-next-chip')].map(el => el.textContent.trim());
        expect(chips).toEqual(['Bob', 'Goblin']);
        expect(strip.querySelector('.tv-next-chip.player')).not.toBeNull();
        expect(strip.querySelector('.tv-next-chip.npc')).not.toBeNull();
    });

    it('emits a damage floater event when a creature\'s HP drops and retires it via the feedback-done callback', async () => {
        await act(async () => { render(<Initiative {...props} />); });
        await waitFor(() => { expect(screen.getByText('Initiative (round 3)')).toBeInTheDocument(); });
        expect(screen.queryByTestId('floater-Goblin')).not.toBeInTheDocument();

        vi.mocked(combatData.getCombatSummary).mockReturnValue({ round: 3, creatures: [
            ...ROSTER_WITH_FOE.creatures.slice(0, 2),
            { ...ROSTER_WITH_FOE.creatures[2], currentHp: 4 },
        ] });
        await act(async () => { window.dispatchEvent(new Event('combat-summary-updated')); });

        await waitFor(() => { expect(screen.getByTestId('floater-Goblin')).toHaveTextContent('-3'); });

        // Retirement contract (onHpFeedbackDone ⇒ event dropped): exercised via
        // the stand-in button because jsdom never fires real CSS animationend.
        // The live HpFeedback wiring (floater onAnimationEnd → onDone) is
        // confirmed in the browser via Playwright.
        act(() => { fireEvent.click(screen.getByTestId('retire-Goblin')); });
        await waitFor(() => { expect(screen.queryByTestId('floater-Goblin')).not.toBeInTheDocument(); });

        // A further HP change re-arms a fresh event (heal lane — raw delta 2;
        // the real HpFeedback renders the "+2" glyph, asserted live via Playwright).
        vi.mocked(combatData.getCombatSummary).mockReturnValue({ round: 3, creatures: [
            ...ROSTER_WITH_FOE.creatures.slice(0, 2),
            { ...ROSTER_WITH_FOE.creatures[2], currentHp: 6 },
        ] });
        await act(async () => { window.dispatchEvent(new Event('combat-summary-updated')); });
        await waitFor(() => { expect(screen.getByTestId('floater-Goblin')).toHaveTextContent('2'); });
    });

    it('victory banner shows the stamped result, dismiss persists, foes on the board outrank it', async () => {
        lastCombatResult = { stamp: 42, rounds: 5, foes: 3, defeated: 3, survivors: 2, partySize: 2, wipe: false, celebrated: true, attackEvidence: '{"attackerName":"AasimarTest"}' };
        // Foes still on the tracker → the old result stays silent.
        await act(async () => { render(<Initiative {...props} />); });
        await waitFor(() => { expect(screen.getByText('Initiative (round 3)')).toBeInTheDocument(); });
        expect(screen.queryByText('Victory!')).not.toBeInTheDocument();

        // Combat cleared (party-only board) → the seam celebrates.
        vi.mocked(combatData.getCombatSummary).mockReturnValue(cloneDeep(ROSTER_PARTY_ONLY));
        await act(async () => { window.dispatchEvent(new Event('combat-summary-updated')); });

        await waitFor(() => { expect(screen.getByText('Victory!')).toBeInTheDocument(); });
        expect(screen.getByText('The party survived 5 rounds!')).toBeInTheDocument();
        expect(screen.getByText('All 3 foes defeated')).toBeInTheDocument();
        expect(screen.getByText('2 of 2 heroes standing')).toBeInTheDocument();

        // Continue click dismisses — and the dismissal survives re-render.
        fireEvent.click(screen.getByText('Continue'));
        expect(localStorage.getItem('initiative-victory-dismissed')).toBe('42');
        await waitFor(() => { expect(screen.queryByText('Victory!')).not.toBeInTheDocument(); });
    });

    it('defeat copy honors the wipe outcome', async () => {
        lastCombatResult = { stamp: 43, rounds: 2, foes: 4, defeated: 1, survivors: 0, partySize: 3, wipe: true, celebrated: true, attackEvidence: '{"attackerName":"Goblin"}' };
        vi.mocked(combatData.loadCombatSummary).mockResolvedValue(cloneDeep(ROSTER_PARTY_ONLY));
        await act(async () => { render(<Initiative {...props} />); });

        await waitFor(() => { expect(screen.getByText('The Party Falls')).toBeInTheDocument(); });
        expect(screen.getByText('The party fell after 2 rounds.')).toBeInTheDocument();
        expect(screen.getByText('1 foe defeated · 3 drove off')).toBeInTheDocument();
        expect(screen.getByText('0 of 3 heroes standing')).toBeInTheDocument();
    });

    it('IMP-1: a celebrated:false stamp (prep-time zero-attack clear) never mounts the banner', async () => {
        lastCombatResult = { stamp: 44, rounds: 1, foes: 0, defeated: 0, survivors: 13, partySize: 13, wipe: false, celebrated: false, attackEvidence: null };
        vi.mocked(combatData.loadCombatSummary).mockResolvedValue(cloneDeep(ROSTER_PARTY_ONLY));
        await act(async () => { render(<Initiative {...props} />); });
        await waitFor(() => { expect(screen.getByText(/^Initiative \(round \d+\)$/)).toBeInTheDocument(); });
        expect(screen.queryByText('Victory!')).not.toBeInTheDocument();
        expect(document.querySelector('.victory-banner')).toBeNull();
    });

    describe('MonsterCardModal privacy — GM-private stat block', () => {
        const GOBLIN_CARD = { name: 'Goblin', type: 'monster', actions: [] };

        const mountAndClick = async (overrides = {}) => {
            vi.mocked(monsterUtils.getMonsterData).mockResolvedValue(cloneDeep(GOBLIN_CARD));
            await act(async () => { render(<Initiative {...props} {...overrides} />); });
            await waitFor(() => { expect(screen.getByText('Initiative (round 3)')).toBeInTheDocument(); });
            await act(async () => { fireEvent.click(screen.getByTestId('npc-click-Goblin')); });
        };

        it('GM tab opens the card locally and authors ZERO synced-store traffic', async () => {
            await mountAndClick();

            await waitFor(() => { expect(screen.getByTestId('monster-card-modal')).toBeInTheDocument(); });
            // The old synced lane POSTed combat-ui-viewingMonster(+CreatureName)
            // and SSE-broadcast the open card to every tab. The keys must not
            // even be touched now (per-client useState).
            const viewingWrites = runtime.setRuntimeValue.mock.calls.filter(
                ([, key]) => String(key).includes('viewingMonster')
            );
            expect(viewingWrites).toHaveLength(0);
            expect(storage.set).not.toHaveBeenCalledWith('campaign', expect.stringContaining('viewingMonster'), expect.anything(), expect.anything());
            expect(syncStateStore.has('campaign-combat-ui-viewingMonster')).toBe(false);
            expect(syncStateStore.has('campaign-combat-ui-viewingMonsterCreatureName')).toBe(false);
        });

        it('TV presentation screen never shows the stat block (even on the GM machine)', async () => {
            localStorage.setItem('initiative-tv', '1');
            await mountAndClick();

            expect(screen.queryByTestId('monster-card-modal')).not.toBeInTheDocument();
        });

        it('player (non-localhost) tab cannot open a monster stat block', async () => {
            await mountAndClick({ isLocalhost: false });

            expect(screen.queryByTestId('monster-card-modal')).not.toBeInTheDocument();
        });
    });
});
