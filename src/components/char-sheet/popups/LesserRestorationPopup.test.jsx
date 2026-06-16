import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
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
    return render(
        <LesserRestorationPopup
            spell={mockSpell}
            playerStats={{}}
            campaignName="test-campaign"
            creatureTargets={mockCreatureTargets}
            range={mockRange}
            onConfirm={onConfirm}
            onSkip={onSkip}
            {...overrides}
        />
    );
}

// ── Helpers ──

async function selectTarget(name) {
    await act(async () => {
        const targetEl = screen.getByText(name);
        fireEvent.click(targetEl);
        // Wait for async loadTargetData to settle
        await new Promise(r => setTimeout(r, 50));
    });
}

// ── Tests ──

describe('LesserRestorationPopup', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // ── Default rendering ──

    it('renders the popup with spell title and medical icon', () => {
        renderPopup();
        expect(screen.getByRole('heading', { name: 'Lesser Restoration' })).toBeInTheDocument();
        const icon = document.querySelector('.fa-hand-holding-medical');
        expect(icon).toBeInTheDocument();
    });

    it('displays spell name and level info', () => {
        renderPopup();
        expect(screen.getByText(/Level 2 Abjuration/)).toBeInTheDocument();
    });

    it('displays range in the instructions', () => {
        renderPopup();
        expect(screen.getByText(/30 ft/)).toBeInTheDocument();
    });

    it('disables the cast button when no target is selected', () => {
        renderPopup();
        const castButton = screen.getByText('Cast Lesser Restoration');
        expect(castButton).toBeDisabled();
    });

    it('renders Cancel button', () => {
        renderPopup();
        expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    it('renders target selection section', () => {
        renderPopup();
        expect(screen.getByText('Target:')).toBeInTheDocument();
    });

    it('renders all creature targets', () => {
        renderPopup();
        expect(screen.getByText('Goblin')).toBeInTheDocument();
        expect(screen.getByText('Orc')).toBeInTheDocument();
        expect(screen.getByText('Player Character')).toBeInTheDocument();
    });

    // ── Target selection ──

    it('highlights the selected target with checkmark and green styling', async () => {
        getRuntimeValue.mockReturnValue([]);
        getCombatSummary.mockResolvedValue(null);

        renderPopup();
        await selectTarget('Goblin');

        await waitFor(() => {
            const targetDivs = document.querySelectorAll('.metamagic-twin-target div[style*="cursor: pointer"]');
            const selected = Array.from(targetDivs).find(d => d.textContent.includes('✓') && d.textContent.includes('Goblin'));
            expect(selected).toBeTruthy();
        });

        const selectedDivs = document.querySelectorAll('[style*="rgba(76, 175, 80, 0.3)"]');
        expect(selectedDivs.length).toBeGreaterThan(0);
    });

    it('calls getRuntimeValue when a creature target is clicked', async () => {
        getRuntimeValue.mockReturnValue([]);
        getCombatSummary.mockResolvedValue(null);

        renderPopup();
        await selectTarget('Goblin');

        await waitFor(() => {
            expect(getRuntimeValue).toHaveBeenCalledWith('Goblin', 'activeConditions');
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

    it('highlights selected condition with checkmark and green styling', async () => {
        getRuntimeValue.mockReturnValue(['blinded']);
        getCombatSummary.mockResolvedValue(null);

        renderPopup();
        await selectTarget('Goblin');

        await waitFor(() => {
            expect(screen.getByText(/Blinded condition/)).toBeInTheDocument();
        });

        await act(async () => {
            const blindedEl = screen.getByText(/Blinded condition/);
            fireEvent.click(blindedEl);
            await new Promise(r => setTimeout(r, 50));
        });

        await waitFor(() => {
            const blindedEl = screen.getByText(/Blinded condition/);
            expect(blindedEl.textContent).toContain('✓');
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

        await act(async () => {
            const blindedEl = screen.getByText(/Blinded condition/);
            fireEvent.click(blindedEl);
            await new Promise(r => setTimeout(r, 50));
        });

        await waitFor(() => {
            expect(castButton).toBeEnabled();
        });
    });

    // ── Toggle selection ──

    it('toggles condition selection on click', async () => {
        getRuntimeValue.mockReturnValue(['blinded', 'deafened']);
        getCombatSummary.mockResolvedValue(null);

        renderPopup();
        await selectTarget('Goblin');

        await waitFor(() => {
            expect(screen.getByText(/Blinded condition/)).toBeInTheDocument();
            expect(screen.getByText(/Deafened condition/)).toBeInTheDocument();
        });

        // Toggle ON
        await act(async () => {
            const blindedEl = screen.getByText(/Blinded condition/);
            fireEvent.click(blindedEl);
            await new Promise(r => setTimeout(r, 50));
        });

        await waitFor(() => {
            const blindedEl = screen.getByText(/Blinded condition/);
            expect(blindedEl.textContent).toContain('✓');
        });

        // Toggle OFF
        await act(async () => {
            const blindedEl = screen.getByText(/Blinded condition/);
            fireEvent.click(blindedEl);
            await new Promise(r => setTimeout(r, 50));
        });

        await waitFor(() => {
            const blindedEl = screen.getByText(/Blinded condition/);
            expect(blindedEl.textContent).not.toContain('✓');
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

        await act(async () => {
            const blindedEl = screen.getByText(/Blinded condition/);
            fireEvent.click(blindedEl);
            await new Promise(r => setTimeout(r, 50));
        });

        await waitFor(() => {
            expect(screen.getByText('Cast Lesser Restoration')).toBeEnabled();
        });

        fireEvent.click(screen.getByText('Cast Lesser Restoration'));
        expect(onConfirm).toHaveBeenCalledTimes(1);
        expect(onConfirm).toHaveBeenCalledWith({ targetName: 'Goblin', condition: 'blinded' });
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

    // ── CSS classes ──

    it('renders with popup-overlay class', () => {
        renderPopup();
        const overlay = document.querySelector('.popup-overlay');
        expect(overlay).toBeInTheDocument();
    });

    it('renders with popup-modal class', () => {
        renderPopup();
        const modal = document.querySelector('.popup-modal');
        expect(modal).toBeInTheDocument();
    });

    it('renders with metamagic-popup class', () => {
        renderPopup();
        const modal = document.querySelector('.metamagic-popup');
        expect(modal).toBeInTheDocument();
    });

    it('renders with metamagic-popup-inner class', () => {
        renderPopup();
        const inner = document.querySelector('.metamagic-popup-inner');
        expect(inner).toBeInTheDocument();
    });

    it('renders with metamagic-spell-name class', () => {
        renderPopup();
        const spellName = document.querySelector('.metamagic-spell-name');
        expect(spellName).toBeInTheDocument();
    });

    it('renders with metamagic-twin-target class', () => {
        renderPopup();
        const twinTarget = document.querySelector('.metamagic-twin-target');
        expect(twinTarget).toBeInTheDocument();
    });

    it('renders with metamagic-actions class', () => {
        renderPopup();
        const actions = document.querySelector('.metamagic-actions');
        expect(actions).toBeInTheDocument();
    });

    // ── Button classes ──

    it('renders Cancel button with btn-secondary class', () => {
        renderPopup();
        const cancelButton = document.querySelector('.btn-secondary');
        expect(cancelButton).toBeInTheDocument();
        expect(cancelButton.textContent).toBe('Cancel');
    });

    it('renders Cast button with btn class (but not btn-secondary)', () => {
        renderPopup();
        const castButton = document.querySelector('.btn:not(.btn-secondary)');
        expect(castButton).toBeInTheDocument();
        expect(castButton.textContent).toBe('Cast Lesser Restoration');
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
});
