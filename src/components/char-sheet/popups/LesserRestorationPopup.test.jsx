// @improved-by-ai
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TargetWithCheckboxesPopup from './TargetWithCheckboxesPopup.jsx';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => null),
}));

vi.mock('../../../services/encounters/combatData.js', () => ({
    getCombatSummary: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../../services/ui/utils.js', () => ({
    __esModule: true,
    default: {
        getName: (name) => name || 'Unknown',
    },
}));

import utils from '../../../services/ui/utils.js';

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

    const conditionMatches = (c, targetCondition) =>
        (typeof c === 'string' ? c.toLowerCase() : '').trim() === (typeof targetCondition === 'string' ? targetCondition.toLowerCase() : '').trim();

    const loadTargetData = async (targetName) => {
        const conditions = getRuntimeValue(targetName, 'activeConditions') || [];
        let csConditions = [];
        try {
            const cs = await getCombatSummary('test-campaign');
            if (cs) {
                const creature = cs.creatures?.find(c => utils.getName(c.name) === utils.getName(targetName));
                if (creature && Array.isArray(creature.conditions)) {
                    csConditions = creature.conditions.map(c => c.key);
                }
            }
        } catch { /* ignore */ }
        const allConditions = [...new Set([...conditions, ...csConditions])];
        const ALLOWED_CONDITIONS = [{ id: 'blinded' }, { id: 'deafened' }, { id: 'paralyzed' }, { id: 'poisoned' }];
        return ALLOWED_CONDITIONS
            .filter(c => allConditions.some(a => conditionMatches(a, c.id)))
            .map(c => ({ id: c.id, label: `${c.id.charAt(0).toUpperCase() + c.id.slice(1)} condition`, selectionData: { condition: c.id } }));
    };

    const props = {
        spell: mockSpell,
        playerStats: {},
        campaignName: 'test-campaign',
        creatureTargets: mockCreatureTargets,
        range: mockRange,
        onConfirm,
        onSkip,
        loadTargetData,
        icon: 'fa-solid fa-hand-holding-medical',
        title: 'Lesser Restoration',
        school: 'Abjuration',
        defaultLevel: 2,
        description: 'Choose a creature within range and select one condition to remove.',
        noItemsMessage: 'No applicable conditions found on this target',
        confirmLabel: 'Cast Lesser Restoration',
        ...overrides,
    };

    if (overrides.onConfirm !== undefined) {
        props.onConfirm = overrides.onConfirm;
    }
    if (overrides.onSkip !== undefined) {
        props.onSkip = overrides.onSkip;
    }

    return render(<TargetWithCheckboxesPopup {...props} />);
}

// ── Helpers ──

async function selectTarget(name) {
    const targetEl = screen.getByText(name);
    fireEvent.click(targetEl);
}

// ── Tests ──

describe('TargetWithCheckboxesPopup', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // ── Default rendering ──

    it('renders the popup with spell title, icon, and details', () => {
        renderPopup();
        expect(screen.getByRole('heading', { name: 'Lesser Restoration' })).toBeInTheDocument();
        expect(document.querySelector('.fa-hand-holding-medical')).toBeInTheDocument();
        expect(screen.getByText(/Level 2 Abjuration/)).toBeInTheDocument();
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

    it('renders with the expected structural CSS classes', () => {
        renderPopup();
        expect(document.querySelector('.popup-overlay')).toBeInTheDocument();
        expect(document.querySelector('.popup-modal')).toBeInTheDocument();
        expect(document.querySelector('.metamagic-popup')).toBeInTheDocument();
        expect(document.querySelector('.metamagic-popup-inner')).toBeInTheDocument();
        expect(document.querySelector('.metamagic-actions')).toBeInTheDocument();
    });

    it('renders the spell name and level from the spell prop', () => {
        const spellNameEl = document.querySelector('.metamagic-spell-name strong');
        renderPopup({ spell: { name: 'Test Spell', level: 3 } });
        expect(spellNameEl?.textContent || screen.getByText(/Test Spell/)).toBeInTheDocument();
        expect(screen.getByText(/Level 3/)).toBeInTheDocument();
    });

    it('renders the description mentioning range', () => {
        renderPopup({ range: '60 ft' });
        expect(screen.getByText(/within range/)).toBeInTheDocument();
    });

    it('displays the spell description mentioning the four conditions', () => {
        renderPopup();
        expect(screen.getByText(/Blinded, Deafened, Paralyzed, or Poisoned/)).toBeInTheDocument();
    });

    it('renders Cancel and Cast buttons', () => {
        renderPopup();
        expect(screen.getByText('Cancel')).toBeInTheDocument();
        expect(screen.getByText('Cast Lesser Restoration')).toBeInTheDocument();
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
            expect(screen.getByText(/\u2713\s+Goblin/)).toBeInTheDocument();
        });
    });

    it('switches target selection when clicking a different target', async () => {
        getRuntimeValue.mockReturnValue(['blinded']);
        getCombatSummary.mockResolvedValue(null);

        renderPopup();
        await selectTarget('Goblin');

        await waitFor(() => {
            expect(screen.getByText(/\u2713\s+Goblin/)).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('Orc'));

        await waitFor(() => {
            expect(screen.getByText(/\u2713\s+Orc/)).toBeInTheDocument();
        });
        expect(screen.queryByText(/\u2713\s+Goblin/)).not.toBeInTheDocument();
    });

    it('loads conditions for a different target after switching', async () => {
        getRuntimeValue.mockReturnValue(['blinded']);
        getCombatSummary.mockResolvedValue(null);

        renderPopup();
        await selectTarget('Goblin');

        await waitFor(() => {
            expect(getRuntimeValue).toHaveBeenCalledWith('Goblin', 'activeConditions');
        });

        vi.clearAllMocks();
        getRuntimeValue.mockReturnValue(['deafened']);

        fireEvent.click(screen.getByText('Orc'));

        await waitFor(() => {
            expect(getRuntimeValue).toHaveBeenCalledWith('Orc', 'activeConditions');
        });
    });

    it('shows condition selection section when a target is selected', async () => {
        getRuntimeValue.mockReturnValue(['blinded']);
        getCombatSummary.mockResolvedValue(null);

        renderPopup();
        await selectTarget('Goblin');

        await waitFor(() => {
            expect(screen.getByText(/Effects to remove from/)).toBeInTheDocument();
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

    it('shows all four condition types when target has them', async () => {
        getRuntimeValue.mockReturnValue(['blinded', 'deafened', 'paralyzed', 'poisoned']);
        getCombatSummary.mockResolvedValue(null);

        renderPopup();
        await selectTarget('Goblin');

        await waitFor(() => {
            expect(screen.getByText('Blinded condition')).toBeInTheDocument();
            expect(screen.getByText('Deafened condition')).toBeInTheDocument();
            expect(screen.getByText('Paralyzed condition')).toBeInTheDocument();
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

    it('does not call onConfirm when target has no applicable conditions', async () => {
        const onConfirm = vi.fn();
        getRuntimeValue.mockReturnValue([]);
        getCombatSummary.mockResolvedValue(null);

        renderPopup({ onConfirm });
        await selectTarget('Goblin');

        await waitFor(() => {
            expect(screen.getByText('No applicable conditions found on this target')).toBeInTheDocument();
        });

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
            <TargetWithCheckboxesPopup
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
            <TargetWithCheckboxesPopup
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

    it('handles spell missing name property with fallback', () => {
        render(
            <TargetWithCheckboxesPopup
                spell={{ level: 3 }}
                playerStats={{}}
                campaignName="test-campaign"
                creatureTargets={mockCreatureTargets}
                range={mockRange}
                onConfirm={vi.fn()}
                onSkip={vi.fn()}
            />
        );
        expect(screen.getByText(/Spell/)).toBeInTheDocument();
    });

    it('handles spell missing level property with fallback', () => {
        render(
            <TargetWithCheckboxesPopup
                spell={{ name: 'Test Spell' }}
                playerStats={{}}
                campaignName="test-campaign"
                creatureTargets={mockCreatureTargets}
                range={mockRange}
                onConfirm={vi.fn()}
                onSkip={vi.fn()}
            />
        );
        expect(screen.getByText(/Level 2/)).toBeInTheDocument();
    });

    // ── Empty creature targets ──

    it('renders no target options when creatureTargets is empty', () => {
        renderPopup({ creatureTargets: [] });
        expect(screen.getByText('Target:')).toBeInTheDocument();
        expect(screen.queryByText('Goblin')).not.toBeInTheDocument();
    });

    it('keeps cast button disabled when creatureTargets is empty', () => {
        renderPopup({ creatureTargets: [] });
        expect(screen.getByText('Cast Lesser Restoration')).toBeDisabled();
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

    it('handles combat summary with null creatures array', async () => {
        getRuntimeValue.mockReturnValue(['blinded']);
        getCombatSummary.mockResolvedValue({ creatures: null });

        renderPopup();
        await selectTarget('Goblin');

        await waitFor(() => {
            expect(screen.getByText('Blinded condition')).toBeInTheDocument();
        });
    });

    it('handles combat summary creature without conditions array', async () => {
        getRuntimeValue.mockReturnValue(['blinded']);
        getCombatSummary.mockResolvedValue({
            creatures: [{ name: 'Goblin' }],
        });

        renderPopup();
        await selectTarget('Goblin');

        await waitFor(() => {
            expect(screen.getByText('Blinded condition')).toBeInTheDocument();
        });
    });

    it('passes campaignName to getCombatSummary', async () => {
        getRuntimeValue.mockReturnValue([]);
        getCombatSummary.mockResolvedValue(null);

        renderPopup({ campaignName: 'my-campaign' });
        await selectTarget('Goblin');

        await waitFor(() => {
            expect(getCombatSummary).toHaveBeenCalledWith('my-campaign');
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

    it('matches conditions from combat summary case-insensitively', async () => {
        getRuntimeValue.mockReturnValue([]);
        getCombatSummary.mockResolvedValue({
            creatures: [{ name: 'Goblin', conditions: [{ key: 'DEAFENED' }] }],
        });

        renderPopup();
        await selectTarget('Goblin');

        await waitFor(() => {
            expect(screen.getByText('Deafened condition')).toBeInTheDocument();
        });
    });

    it('matches conditions with leading/trailing whitespace', async () => {
        getRuntimeValue.mockReturnValue(['  blinded  ']);
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

    it('filters combat summary conditions to only allowed types', async () => {
        getRuntimeValue.mockReturnValue([]);
        getCombatSummary.mockResolvedValue({
            creatures: [{ name: 'Goblin', conditions: [{ key: 'exhaustion' }, { key: 'poisoned' }, { key: 'restrained' }] }],
        });

        renderPopup();
        await selectTarget('Goblin');

        await waitFor(() => {
            expect(screen.getByText('Poisoned condition')).toBeInTheDocument();
            expect(screen.queryByText('Exhaustion condition')).not.toBeInTheDocument();
            expect(screen.queryByText('Restrained condition')).not.toBeInTheDocument();
        });
    });

    it('shows no applicable message when all conditions are filtered out', async () => {
        getRuntimeValue.mockReturnValue(['exhaustion', 'frightened', 'restrained']);
        getCombatSummary.mockResolvedValue(null);

        renderPopup();
        await selectTarget('Goblin');

        await waitFor(() => {
            expect(screen.getByText('No applicable conditions found on this target')).toBeInTheDocument();
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

    it('does not match combat summary conditions for a different creature', async () => {
        getRuntimeValue.mockReturnValue([]);
        getCombatSummary.mockResolvedValue({
            creatures: [{ name: 'Orc', conditions: [{ key: 'blinded' }] }],
        });

        renderPopup();
        await selectTarget('Goblin');

        await waitFor(() => {
            expect(screen.getByText('No applicable conditions found on this target')).toBeInTheDocument();
        });
    });

    // ── getRuntimeValue integration ──

    it('calls getRuntimeValue with target name and activeConditions property', async () => {
        getRuntimeValue.mockReturnValue(['blinded']);
        getCombatSummary.mockResolvedValue(null);

        renderPopup();
        await selectTarget('Orc');

        await waitFor(() => {
            expect(getRuntimeValue).toHaveBeenCalledWith('Orc', 'activeConditions');
        });
    });

    it('handles getRuntimeValue returning undefined', async () => {
        getRuntimeValue.mockReturnValue(undefined);
        getCombatSummary.mockResolvedValue(null);

        renderPopup();
        await selectTarget('Goblin');

        await waitFor(() => {
            expect(screen.getByText('No applicable conditions found on this target')).toBeInTheDocument();
        });
    });

    // ── Target switching clears previous state ──

    it('clears target and conditions when switching from one target to another', async () => {
        getRuntimeValue.mockReturnValue(['blinded']);
        getCombatSummary.mockResolvedValue(null);

        renderPopup();
        await selectTarget('Goblin');

        await waitFor(() => {
            expect(screen.getByText(/Effects to remove from/)).toBeInTheDocument();
        });
        expect(screen.getByText('Blinded condition')).toBeInTheDocument();

        getRuntimeValue.mockReturnValue(['deafened']);

        fireEvent.click(screen.getByText('Orc'));

        await waitFor(() => {
            expect(screen.getByText(/Effects to remove from Orc/)).toBeInTheDocument();
            expect(screen.queryByText('Blinded condition')).not.toBeInTheDocument();
            expect(screen.getByText('Deafened condition')).toBeInTheDocument();
        });
    });

    // ── Creature targets with null values ──

    it('handles creatureTargets with null values gracefully', () => {
        renderPopup({ creatureTargets: ['Goblin', null, 'Orc'] });
        expect(screen.getByText('Goblin')).toBeInTheDocument();
        expect(screen.getByText('Orc')).toBeInTheDocument();
    });

    // ── Multiple conditions selected and confirmed ──

    it('calls onConfirm with the first selected condition when multiple are selected', async () => {
        const onConfirm = vi.fn();
        getRuntimeValue.mockReturnValue(['blinded', 'deafened', 'paralyzed']);
        getCombatSummary.mockResolvedValue(null);

        renderPopup({ onConfirm });
        await selectTarget('Goblin');

        await waitFor(() => {
            expect(screen.getByText(/Blinded condition/)).toBeInTheDocument();
        });

        // Select all three conditions
        fireEvent.click(screen.getByText(/Blinded condition/));
        fireEvent.click(screen.getByText(/Deafened condition/));
        fireEvent.click(screen.getByText(/Paralyzed condition/));

        fireEvent.click(screen.getByText('Cast Lesser Restoration'));
        expect(onConfirm).toHaveBeenCalledTimes(1);
        expect(onConfirm).toHaveBeenCalledWith({ targetName: 'Goblin', condition: 'blinded' });
    });

    // ── Range display ──

    it('renders description text mentioning range', () => {
        renderPopup({ range: '60 ft' });
        expect(screen.getByText(/within range/)).toBeInTheDocument();
    });

    it('renders description with default range text', () => {
        renderPopup();
        expect(screen.getByText(/within range/)).toBeInTheDocument();
    });
});
