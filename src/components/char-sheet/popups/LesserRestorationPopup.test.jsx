// @improved-by-ai
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import LesserRestorationPopup from './LesserRestorationPopup.jsx';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => null),
}));

vi.mock('../../../services/encounters/combatData.js', () => ({
    getCombatSummary: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../../services/ui/utils.js', () => ({
    default: {
        getName: (name) => name || 'Unknown',
    },
}));

// Import mocked functions AFTER vi.mock calls
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { getCombatSummary } from '../../../services/encounters/combatData.js';

// ── Test fixtures ──

const mockSpell = { name: 'Lesser Restoration', level: 2 };
const mockCreatureTargets = ['Goblin', 'Orc', 'Player Character'];
const mockRange = '30 ft';

function renderPopup(overrides = {}) {
    const onConfirm = vi.fn();
    const onSkip = vi.fn();

    // The renderPopup default onConfirm/onSkip are always created;
    // overrides let tests replace them.
    const props = {
        spell: mockSpell,
        playerStats: {},
        campaignName: 'test-campaign',
        creatureTargets: mockCreatureTargets,
        range: mockRange,
        onConfirm,
        onSkip,
        ...overrides,
    };

    // If the caller passed a custom onConfirm/onSkip via overrides,
    // we need to use those instead of the defaults.
    if (overrides.onConfirm !== undefined) {
        props.onConfirm = overrides.onConfirm;
    }
    if (overrides.onSkip !== undefined) {
        props.onSkip = overrides.onSkip;
    }

    return render(<LesserRestorationPopup {...props} />);
}

// ── Helpers ──

async function selectTarget(name) {
    const targetEl = screen.getByText(name);
    fireEvent.click(targetEl);
}

// ── Tests ──

describe('LesserRestorationPopup', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // ── Default rendering ──

    it('renders the popup with spell title, icon, and details', () => {
        renderPopup();
        expect(screen.getByRole('heading', { name: 'Lesser Restoration' })).toBeInTheDocument();
        expect(document.querySelector('.fa-hand-holding-medical')).toBeInTheDocument();
        expect(screen.getByText(/Level 2 Abjuration/)).toBeInTheDocument();
        expect(screen.getByText(/30 ft/)).toBeInTheDocument();
        expect(screen.getByText('Target:')).toBeInTheDocument();
    });

    it('disables the cast button when no target is selected', () => {
        renderPopup();
        expect(screen.getByText('Cast Lesser Restoration')).toBeDisabled();
    });

    it('renders all creature targets', () => {
        renderPopup();
        expect(screen.getByText('Goblin')).toBeInTheDocument();
        expect(screen.getByText('Orc')).toBeInTheDocument();
        expect(screen.getByText('Player Character')).toBeInTheDocument();
    });

    // ── Target selection ──

    it('selects a target and loads its conditions when clicked', async () => {
        getRuntimeValue.mockReturnValue(['blinded']);
        getCombatSummary.mockResolvedValue(null);

        renderPopup();
        await selectTarget('Goblin');

        await waitFor(() => {
            expect(getRuntimeValue).toHaveBeenCalledWith('Goblin', 'activeConditions');
        });
    });

    it('highlights the selected target visually', async () => {
        getRuntimeValue.mockReturnValue([]);
        getCombatSummary.mockResolvedValue(null);

        renderPopup();
        await selectTarget('Goblin');

        await waitFor(() => {
            // Check that the selected target shows a checkmark in its text
            expect(screen.getByText(/\u2713\s+Goblin/)).toBeInTheDocument();
        });
    });

    // ── Condition selection ──

    it('shows condition selection section when a target is selected', async () => {
        getRuntimeValue.mockReturnValue(['blinded']);
        getCombatSummary.mockResolvedValue(null);

        renderPopup();
        await selectTarget('Goblin');

        await waitFor(() => {
            expect(screen.getByText(/Condition to remove from/)).toBeInTheDocument();
        });
    });

    it('shows "No applicable conditions found" when target has no conditions', async () => {
        getRuntimeValue.mockReturnValue([]);
        getCombatSummary.mockResolvedValue(null);

        renderPopup();
        await selectTarget('Goblin');

        await waitFor(() => {
            expect(screen.getByText('No applicable conditions found on this target')).toBeInTheDocument();
        });
    });

    it('renders available conditions as selectable items', async () => {
        getRuntimeValue.mockReturnValue(['blinded', 'poisoned']);
        getCombatSummary.mockResolvedValue(null);

        renderPopup();
        await selectTarget('Goblin');

        await waitFor(() => {
            expect(screen.getByText('Blinded condition')).toBeInTheDocument();
            expect(screen.getByText('Poisoned condition')).toBeInTheDocument();
        });
    });

    it('toggles condition selection on click', async () => {
        getRuntimeValue.mockReturnValue(['blinded']);
        getCombatSummary.mockResolvedValue(null);

        renderPopup();
        await selectTarget('Goblin');

        await waitFor(() => {
            expect(screen.getByText(/Blinded condition/)).toBeInTheDocument();
        });

        const blindedEl = screen.getByText(/Blinded condition/);

        // Toggle ON
        fireEvent.click(blindedEl);
        await waitFor(() => {
            expect(blindedEl.textContent).toContain('\u2713');
        });

        // Toggle OFF
        fireEvent.click(blindedEl);
        await waitFor(() => {
            expect(blindedEl.textContent).not.toContain('\u2713');
        });
    });

    it('enables the cast button only when both target and condition are selected', async () => {
        getRuntimeValue.mockReturnValue(['blinded']);
        getCombatSummary.mockResolvedValue(null);

        renderPopup();
        await selectTarget('Goblin');

        await waitFor(() => {
            expect(screen.getByText(/Blinded condition/)).toBeInTheDocument();
        });

        const castButton = screen.getByText('Cast Lesser Restoration');
        expect(castButton).toBeDisabled();

        fireEvent.click(screen.getByText(/Blinded condition/));

        await waitFor(() => {
            expect(castButton).toBeEnabled();
        });
    });

    // ── Confirm ──

    it('calls onConfirm with target name and condition when cast button is clicked', async () => {
        const onConfirm = vi.fn();
        getRuntimeValue.mockReturnValue(['blinded', 'poisoned']);
        getCombatSummary.mockResolvedValue(null);

        renderPopup({ onConfirm });
        await selectTarget('Goblin');

        await waitFor(() => {
            expect(screen.getByText(/Blinded condition/)).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText(/Blinded condition/));

        await waitFor(() => {
            expect(screen.getByText('Cast Lesser Restoration')).toBeEnabled();
        });

        fireEvent.click(screen.getByText('Cast Lesser Restoration'));
        expect(onConfirm).toHaveBeenCalledTimes(1);
        expect(onConfirm).toHaveBeenCalledWith({ targetName: 'Goblin', condition: 'blinded' });
    });

    it('passes only the first selected condition to onConfirm', async () => {
        const onConfirm = vi.fn();
        getRuntimeValue.mockReturnValue(['blinded', 'poisoned', 'deafened']);
        getCombatSummary.mockResolvedValue(null);

        renderPopup({ onConfirm });
        await selectTarget('Orc');

        await waitFor(() => {
            expect(screen.getByText(/Blinded condition/)).toBeInTheDocument();
            expect(screen.getByText(/Poisoned condition/)).toBeInTheDocument();
        });

        // Select multiple conditions
        fireEvent.click(screen.getByText(/Blinded condition/));
        fireEvent.click(screen.getByText(/Poisoned condition/));
        fireEvent.click(screen.getByText(/Deafened condition/));

        fireEvent.click(screen.getByText('Cast Lesser Restoration'));
        expect(onConfirm).toHaveBeenCalledTimes(1);
        // Only the first condition should be passed
        expect(onConfirm).toHaveBeenCalledWith({ targetName: 'Orc', condition: 'blinded' });
    });

    it('does not call onConfirm when cast button is clicked without a target', () => {
        const onConfirm = vi.fn();
        renderPopup({ onConfirm });
        fireEvent.click(screen.getByText('Cast Lesser Restoration'));
        expect(onConfirm).not.toHaveBeenCalled();
    });

    it('does not call onConfirm when cast button is clicked without a condition', async () => {
        const onConfirm = vi.fn();
        getRuntimeValue.mockReturnValue(['blinded']);
        getCombatSummary.mockResolvedValue(null);

        renderPopup({ onConfirm });
        await selectTarget('Goblin');

        await waitFor(() => {
            expect(screen.getByText('Blinded condition')).toBeInTheDocument();
        });

        // Don't select any condition, just click cast
        fireEvent.click(screen.getByText('Cast Lesser Restoration'));
        expect(onConfirm).not.toHaveBeenCalled();
    });

    // ── Skip / Cancel ──

    it('calls onSkip when Cancel button is clicked', () => {
        const onSkip = vi.fn();
        renderPopup({ onSkip });
        fireEvent.click(screen.getByText('Cancel'));
        expect(onSkip).toHaveBeenCalledTimes(1);
    });

    it('calls onSkip when overlay is clicked', () => {
        const onSkip = vi.fn();
        renderPopup({ onSkip });
        const overlay = document.querySelector('.popup-overlay');
        fireEvent.click(overlay);
        expect(onSkip).toHaveBeenCalledTimes(1);
    });

    it('does not call onSkip when modal content is clicked', () => {
        const onSkip = vi.fn();
        renderPopup({ onSkip });
        const modal = document.querySelector('.popup-modal');
        fireEvent.click(modal);
        expect(onSkip).not.toHaveBeenCalled();
    });

    it('calls onSkip when Escape key is pressed', () => {
        const onSkip = vi.fn();
        renderPopup({ onSkip });
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(onSkip).toHaveBeenCalledTimes(1);
    });

    it('does not call onSkip for non-Escape key', () => {
        const onSkip = vi.fn();
        renderPopup({ onSkip });
        fireEvent.keyDown(document, { key: 'Enter' });
        expect(onSkip).not.toHaveBeenCalled();
    });

    // ── Fallback values ──

    it('handles undefined spell with fallback values', () => {
        render(
            <LesserRestorationPopup
                spell={undefined}
                playerStats={{}}
                campaignName="test-campaign"
                creatureTargets={mockCreatureTargets}
                range={mockRange}
                onConfirm={vi.fn()}
                onSkip={vi.fn()}
            />
        );
        expect(screen.getByText(/Spell/)).toBeInTheDocument();
        expect(screen.getByText(/Level 2/)).toBeInTheDocument();
    });

    it('handles null spell with fallback values', () => {
        render(
            <LesserRestorationPopup
                spell={null}
                playerStats={{}}
                campaignName="test-campaign"
                creatureTargets={mockCreatureTargets}
                range={mockRange}
                onConfirm={vi.fn()}
                onSkip={vi.fn()}
            />
        );
        expect(screen.getByText(/Spell/)).toBeInTheDocument();
        expect(screen.getByText(/Level 2/)).toBeInTheDocument();
    });

    // ── Empty creature targets ──

    it('renders no target options when creatureTargets is empty', () => {
        renderPopup({ creatureTargets: [] });
        expect(screen.getByText('Target:')).toBeInTheDocument();
        expect(screen.queryByText('Goblin')).not.toBeInTheDocument();
    });

    // ── Combat summary integration ──

    it('merges runtime conditions and combat summary conditions', async () => {
        getRuntimeValue.mockReturnValue(['poisoned']);
        getCombatSummary.mockResolvedValue({
            creatures: [{ name: 'Goblin', conditions: [{ key: 'blinded' }, { key: 'poisoned' }] }],
        });

        renderPopup();
        await selectTarget('Goblin');

        await waitFor(() => {
            expect(screen.getByText('Blinded condition')).toBeInTheDocument();
            expect(screen.getByText('Poisoned condition')).toBeInTheDocument();
        });
    });

    it('deduplicates conditions from runtime and combat summary', async () => {
        getRuntimeValue.mockReturnValue(['blinded']);
        getCombatSummary.mockResolvedValue({
            creatures: [{ name: 'Goblin', conditions: [{ key: 'blinded' }] }],
        });

        renderPopup();
        await selectTarget('Goblin');

        await waitFor(() => {
            const blindeds = screen.getAllByText('Blinded condition');
            expect(blindeds).toHaveLength(1);
        });
    });

    it('handles combat summary error gracefully', async () => {
        getRuntimeValue.mockReturnValue(['blinded']);
        getCombatSummary.mockRejectedValue(new Error('Network error'));

        renderPopup();
        await selectTarget('Goblin');

        await waitFor(() => {
            expect(screen.getByText('Blinded condition')).toBeInTheDocument();
        });
    });

    it('handles creature not found in combat summary', async () => {
        getRuntimeValue.mockReturnValue(['blinded']);
        getCombatSummary.mockResolvedValue({
            creatures: [{ name: 'Other Creature', conditions: [{ key: 'deafened' }] }],
        });

        renderPopup();
        await selectTarget('Goblin');

        await waitFor(() => {
            expect(screen.getByText('Blinded condition')).toBeInTheDocument();
            expect(screen.queryByText('Deafened condition')).not.toBeInTheDocument();
        });
    });

    // ── Condition matching (case-insensitive) ──

    it('matches conditions case-insensitively', async () => {
        getRuntimeValue.mockReturnValue(['BLINDED']);
        getCombatSummary.mockResolvedValue(null);

        renderPopup();
        await selectTarget('Goblin');

        await waitFor(() => {
            expect(screen.getByText('Blinded condition')).toBeInTheDocument();
        });
    });

    // ── Allowed conditions filter ──

    it('only shows allowed conditions (blinded, deafened, paralyzed, poisoned)', async () => {
        getRuntimeValue.mockReturnValue(['exhaustion', 'frightened', 'blinded']);
        getCombatSummary.mockResolvedValue(null);

        renderPopup();
        await selectTarget('Goblin');

        await waitFor(() => {
            expect(screen.getByText('Blinded condition')).toBeInTheDocument();
            expect(screen.queryByText('Exhaustion condition')).not.toBeInTheDocument();
            expect(screen.queryByText('Frightened condition')).not.toBeInTheDocument();
        });
    });

    // ── Name matching via utils.getName ──

    it('matches creature names via utils.getName for combat summary lookup', async () => {
        getRuntimeValue.mockReturnValue([]);
        getCombatSummary.mockResolvedValue({
            creatures: [{ name: 'Goblin', conditions: [{ key: 'blinded' }] }],
        });

        renderPopup();
        await selectTarget('Goblin');

        await waitFor(() => {
            expect(getCombatSummary).toHaveBeenCalled();
        });
    });
});
