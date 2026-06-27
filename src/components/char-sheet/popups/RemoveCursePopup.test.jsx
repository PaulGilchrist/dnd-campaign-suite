// @improved-by-ai
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import RemoveCursePopup from './RemoveCursePopup.jsx';

// ── Mocks ──

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
}));

import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

// ── Test fixtures ──

const baseSpell = { name: 'Remove Curse', level: 3 };
const creatureTargets = ['Goblin', 'Orc', 'Troll'];

function createProps(overrides = {}) {
    return {
        spell: { ...baseSpell, ...overrides.spell },
        creatureTargets: overrides.creatureTargets ?? creatureTargets,
        range: overrides.range ?? '30 ft',
        onConfirm: vi.fn(),
        onSkip: vi.fn(),
        _playerStats: overrides._playerStats ?? null,
        _campaignName: overrides._campaignName ?? 'test-campaign',
        ...overrides,
    };
}

function mockRuntimeValue(targetName, cursedBuffs, attunement) {
    getRuntimeValue.mockImplementation((key, prop) => {
        if (key === targetName && prop === 'activeBuffs') return cursedBuffs || [];
        if (key === targetName && prop === 'attunement') return attunement || [];
        return null;
    });
}

// ── Tests ──

describe('RemoveCursePopup', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockReturnValue(null);
    });

    // ── Rendering ──

    it('renders the popup header with spell name and medical icon', () => {
        render(<RemoveCursePopup {...createProps()} />);
        const header = document.querySelector('h3');
        expect(header).toHaveTextContent('Remove Curse');
        expect(document.querySelector('.fa-hand-holding-medical')).toBeInTheDocument();
    });

    it('displays spell name, level, and school in the spell name row', () => {
        render(<RemoveCursePopup {...createProps()} />);
        const spellNameEl = document.querySelector('.metamagic-spell-name strong');
        expect(spellNameEl.textContent).toBe('Remove Curse');
        expect(screen.getByText(/Level 3 Abjuration/)).toBeInTheDocument();
    });

    it('displays the range in the description', () => {
        render(<RemoveCursePopup {...createProps({ range: '60 ft' })} />);
        expect(screen.getByText('60 ft')).toBeInTheDocument();
    });

    it('shows the description text about curses and attunement', () => {
        render(<RemoveCursePopup {...createProps()} />);
        expect(screen.getByText(/This spell ends all curses affecting the target/)).toBeInTheDocument();
        expect(screen.getByText(/breaks the target.*attunement/)).toBeInTheDocument();
    });

    it('renders the target label and creature targets', () => {
        render(<RemoveCursePopup {...createProps()} />);
        expect(screen.getByText(/Target:/)).toBeInTheDocument();
        expect(screen.getByText('Goblin')).toBeInTheDocument();
        expect(screen.getByText('Orc')).toBeInTheDocument();
        expect(screen.getByText('Troll')).toBeInTheDocument();
    });

    it('renders Cancel and Cast Remove Curse buttons', () => {
        render(<RemoveCursePopup {...createProps()} />);
        expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Cast Remove Curse' })).toBeInTheDocument();
    });

    // ── Null safety ──

    it('handles null spell gracefully', () => {
        render(<RemoveCursePopup {...createProps({ spell: null })} />);
        expect(screen.getByText(/Spell/)).toBeInTheDocument();
        expect(screen.getByText(/Level 3/)).toBeInTheDocument();
    });

    it('handles spell with missing name', () => {
        render(<RemoveCursePopup {...createProps({ spell: { level: 3 } })} />);
        expect(screen.getByText(/Level 3/)).toBeInTheDocument();
        const spellNameEl = document.querySelector('.metamagic-spell-name strong');
        expect(spellNameEl.textContent).toBe('Spell');
    });

    it('handles spell with missing level', () => {
        render(<RemoveCursePopup {...createProps({ spell: { name: 'Remove Curse' } })} />);
        expect(screen.getByText(/Level/)).toBeInTheDocument();
    });

    it('handles empty creature targets array', () => {
        render(<RemoveCursePopup {...createProps({ creatureTargets: [] })} />);
        expect(screen.getByText(/Target:/)).toBeInTheDocument();
    });

    // ── Target selection ──

    it('selects a target and highlights it when clicked', () => {
        mockRuntimeValue('Goblin', [], []);
        render(<RemoveCursePopup {...createProps()} />);
        const goblinTarget = screen.getByText('Goblin');
        fireEvent.click(goblinTarget);
        expect(goblinTarget.textContent).toContain('\u2713');
    });

    it('switches selection to a different creature when clicked', () => {
        mockRuntimeValue('Goblin', [], []);
        render(<RemoveCursePopup {...createProps()} />);
        const goblinTarget = screen.getByText('Goblin');
        const orcTarget = screen.getByText('Orc');
        fireEvent.click(goblinTarget);
        expect(goblinTarget.textContent).toContain('\u2713');
        fireEvent.click(orcTarget);
        expect(orcTarget.textContent).toContain('\u2713');
        expect(goblinTarget.textContent).not.toContain('\u2713');
    });

    it('loads cursed buffs and attunement data from runtime state when target is selected', () => {
        mockRuntimeValue('Goblin', [{ type: 'cursed', name: 'Cursed Sword' }], []);
        render(<RemoveCursePopup {...createProps()} />);
        const goblinTarget = screen.getByText('Goblin');
        fireEvent.click(goblinTarget);
        expect(getRuntimeValue).toHaveBeenCalledWith('Goblin', 'activeBuffs');
        expect(getRuntimeValue).toHaveBeenCalledWith('Goblin', 'attunement');
    });

    // ── Effects to remove section ──

    it('shows effects section header when a target is selected', () => {
        mockRuntimeValue('Goblin', [], []);
        render(<RemoveCursePopup {...createProps()} />);
        const goblinTarget = screen.getByText('Goblin');
        fireEvent.click(goblinTarget);
        expect(screen.getByText(/Effects to remove from Goblin/)).toBeInTheDocument();
    });

    it('shows curse option when target has cursed buffs by type', async () => {
        mockRuntimeValue('Goblin', [{ type: 'cursed', name: 'Cursed Ring' }], []);
        render(<RemoveCursePopup {...createProps()} />);
        fireEvent.click(screen.getByText('Goblin'));
        await waitFor(() => {
            expect(screen.getByText(/Curse \(1 cursed effect\(s\)\)/)).toBeInTheDocument();
        });
    });

    it('shows curse option when target has cursed buffs by flag', async () => {
        mockRuntimeValue('Goblin', [{ name: 'Hex', cursed: true }], []);
        render(<RemoveCursePopup {...createProps()} />);
        fireEvent.click(screen.getByText('Goblin'));
        await waitFor(() => {
            expect(screen.getByText(/Curse \(1 cursed effect\(s\)\)/)).toBeInTheDocument();
        });
    });

    it('shows attunement option when target has attuned items', async () => {
        mockRuntimeValue('Goblin', [], [{ item: 'Cursed Armor' }]);
        render(<RemoveCursePopup {...createProps()} />);
        fireEvent.click(screen.getByText('Goblin'));
        await waitFor(() => {
            expect(screen.getByText(/Attunement \(1 attuned item\(s\)\)/)).toBeInTheDocument();
        });
    });

    it('shows multiple cursed effects with correct count', async () => {
        mockRuntimeValue('Goblin', [
            { type: 'cursed', name: 'Cursed Ring' },
            { type: 'cursed', name: 'Cursed Shield' },
        ], []);
        render(<RemoveCursePopup {...createProps()} />);
        fireEvent.click(screen.getByText('Goblin'));
        await waitFor(() => {
            expect(screen.getByText(/Curse \(2 cursed effect\(s\)\)/)).toBeInTheDocument();
        });
    });

    it('shows multiple attuned items with correct count', async () => {
        mockRuntimeValue('Goblin', [], [
            { item: 'Cursed Armor' },
            { item: 'Cursed Helm' },
            { item: 'Cursed Ring' },
        ]);
        render(<RemoveCursePopup {...createProps()} />);
        fireEvent.click(screen.getByText('Goblin'));
        await waitFor(() => {
            expect(screen.getByText(/Attunement \(3 attuned item\(s\)\)/)).toBeInTheDocument();
        });
    });

    it('shows both curse and attunement options when target has both', async () => {
        mockRuntimeValue('Goblin', [{ type: 'cursed', name: 'Cursed Ring' }], [{ item: 'Cursed Armor' }]);
        render(<RemoveCursePopup {...createProps()} />);
        fireEvent.click(screen.getByText('Goblin'));
        await waitFor(() => {
            expect(screen.getByText(/Curse \(\d/)).toBeInTheDocument();
            expect(screen.getByText(/Attunement \(\d/)).toBeInTheDocument();
        });
    });

    it('shows no curses message when target has neither curses nor attunement', () => {
        mockRuntimeValue('Goblin', [], []);
        render(<RemoveCursePopup {...createProps()} />);
        const goblinTarget = screen.getByText('Goblin');
        fireEvent.click(goblinTarget);
        expect(screen.getByText(/No curses or attunement found on this target/)).toBeInTheDocument();
    });

    // ── Selection toggling ──

    it('toggles curse selection on and off', async () => {
        mockRuntimeValue('Goblin', [{ type: 'cursed', name: 'Cursed Ring' }], []);
        render(<RemoveCursePopup {...createProps()} />);
        fireEvent.click(screen.getByText('Goblin'));
        const curseOption = await screen.findByText(/Curse \(\d/);
        fireEvent.click(curseOption);
        expect(curseOption.textContent).toContain('\u2713');
        fireEvent.click(curseOption);
        expect(curseOption.textContent).not.toContain('\u2713');
    });

    it('toggles attunement selection on and off', async () => {
        mockRuntimeValue('Goblin', [], [{ item: 'Cursed Armor' }]);
        render(<RemoveCursePopup {...createProps()} />);
        fireEvent.click(screen.getByText('Goblin'));
        const attunementOption = await screen.findByText(/Attunement \(\d/);
        fireEvent.click(attunementOption);
        expect(attunementOption.textContent).toContain('\u2713');
        fireEvent.click(attunementOption);
        expect(attunementOption.textContent).not.toContain('\u2713');
    });

    it('allows selecting both curse and attunement independently', async () => {
        mockRuntimeValue('Goblin', [{ type: 'cursed', name: 'Cursed Ring' }], [{ item: 'Cursed Armor' }]);
        render(<RemoveCursePopup {...createProps()} />);
        fireEvent.click(screen.getByText('Goblin'));
        const curseOption = await screen.findByText(/Curse \(\d/);
        const attunementOption = await screen.findByText(/Attunement \(\d/);
        fireEvent.click(curseOption);
        fireEvent.click(attunementOption);
        expect(curseOption.textContent).toContain('\u2713');
        expect(attunementOption.textContent).toContain('\u2713');
    });

    // ── Button state ──

    it('disables Cast Remove Curse when no target is selected', () => {
        render(<RemoveCursePopup {...createProps()} />);
        const castButton = screen.getByRole('button', { name: 'Cast Remove Curse' });
        expect(castButton).toBeDisabled();
    });

    it('disables Cast Remove Curse when target is selected but no effects are chosen', () => {
        mockRuntimeValue('Goblin', [{ type: 'cursed', name: 'Cursed Ring' }], []);
        render(<RemoveCursePopup {...createProps()} />);
        const goblinTarget = screen.getByText('Goblin');
        fireEvent.click(goblinTarget);
        const castButton = screen.getByRole('button', { name: 'Cast Remove Curse' });
        expect(castButton).toBeDisabled();
    });

    it('enables Cast Remove Curse when at least one effect is selected', async () => {
        mockRuntimeValue('Goblin', [{ type: 'cursed', name: 'Cursed Ring' }], []);
        render(<RemoveCursePopup {...createProps()} />);
        fireEvent.click(screen.getByText('Goblin'));
        const curseOption = await screen.findByText(/Curse \(\d/);
        fireEvent.click(curseOption);
        expect(screen.getByRole('button', { name: 'Cast Remove Curse' })).toBeEnabled();
    });

    // ── Confirm behavior ──

    it('calls onConfirm with target name and selections when Cast is clicked', async () => {
        const onConfirm = vi.fn();
        mockRuntimeValue('Goblin', [{ type: 'cursed', name: 'Cursed Ring' }], [{ item: 'Cursed Armor' }]);
        render(<RemoveCursePopup {...createProps({ onConfirm })} />);
        fireEvent.click(screen.getByText('Goblin'));
        const curseOption = await screen.findByText(/Curse \(\d/);
        const attunementOption = await screen.findByText(/Attunement \(\d/);
        fireEvent.click(curseOption);
        fireEvent.click(attunementOption);
        fireEvent.click(screen.getByRole('button', { name: 'Cast Remove Curse' }));
        expect(onConfirm).toHaveBeenCalledTimes(1);
        expect(onConfirm).toHaveBeenCalledWith({
            targetName: 'Goblin',
            selections: [{ type: 'curse' }, { type: 'attunement' }],
        });
    });

    it('does not call onConfirm when Cast is clicked with no target selected', () => {
        const onConfirm = vi.fn();
        render(<RemoveCursePopup {...createProps({ onConfirm })} />);
        fireEvent.click(screen.getByRole('button', { name: 'Cast Remove Curse' }));
        expect(onConfirm).not.toHaveBeenCalled();
    });

    it('does not call onConfirm when Cast is clicked with target but no selections', () => {
        const onConfirm = vi.fn();
        mockRuntimeValue('Goblin', [{ type: 'cursed', name: 'Cursed Ring' }], []);
        render(<RemoveCursePopup {...createProps({ onConfirm })} />);
        const goblinTarget = screen.getByText('Goblin');
        fireEvent.click(goblinTarget);
        fireEvent.click(screen.getByRole('button', { name: 'Cast Remove Curse' }));
        expect(onConfirm).not.toHaveBeenCalled();
    });

    it('passes correct selections when only curse is selected', async () => {
        const onConfirm = vi.fn();
        mockRuntimeValue('Orc', [{ type: 'cursed', name: 'Hex' }], []);
        render(<RemoveCursePopup {...createProps({ onConfirm, creatureTargets: ['Orc'] })} />);
        fireEvent.click(screen.getByText('Orc'));
        const curseOption = await screen.findByText(/Curse \(\d/);
        fireEvent.click(curseOption);
        fireEvent.click(screen.getByRole('button', { name: 'Cast Remove Curse' }));
        expect(onConfirm).toHaveBeenCalledWith({
            targetName: 'Orc',
            selections: [{ type: 'curse' }],
        });
    });

    it('passes correct selections when only attunement is selected', async () => {
        const onConfirm = vi.fn();
        mockRuntimeValue('Troll', [], [{ item: 'Plate Armor' }]);
        render(<RemoveCursePopup {...createProps({ onConfirm, creatureTargets: ['Troll'] })} />);
        fireEvent.click(screen.getByText('Troll'));
        const attunementOption = await screen.findByText(/Attunement \(\d/);
        fireEvent.click(attunementOption);
        fireEvent.click(screen.getByRole('button', { name: 'Cast Remove Curse' }));
        expect(onConfirm).toHaveBeenCalledWith({
            targetName: 'Troll',
            selections: [{ type: 'attunement' }],
        });
    });

    // ── Cancel / skip behavior ──

    it('calls onSkip when Cancel button is clicked', () => {
        const onSkip = vi.fn();
        render(<RemoveCursePopup {...createProps({ onSkip })} />);
        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
        expect(onSkip).toHaveBeenCalledTimes(1);
    });

    it('calls onSkip when overlay background is clicked', () => {
        const onSkip = vi.fn();
        render(<RemoveCursePopup {...createProps({ onSkip })} />);
        fireEvent.click(document.querySelector('.popup-overlay'));
        expect(onSkip).toHaveBeenCalledTimes(1);
    });

    it('does not call onSkip when modal content is clicked', () => {
        const onSkip = vi.fn();
        render(<RemoveCursePopup {...createProps({ onSkip })} />);
        fireEvent.click(document.querySelector('.popup-modal'));
        expect(onSkip).not.toHaveBeenCalled();
    });

    it('calls onSkip when Escape key is pressed', () => {
        const onSkip = vi.fn();
        render(<RemoveCursePopup {...createProps({ onSkip })} />);
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(onSkip).toHaveBeenCalledTimes(1);
    });

    it('does not call onSkip for non-Escape key presses', () => {
        const onSkip = vi.fn();
        render(<RemoveCursePopup {...createProps({ onSkip })} />);
        fireEvent.keyDown(document, { key: 'Enter' });
        expect(onSkip).not.toHaveBeenCalled();
    });
});
