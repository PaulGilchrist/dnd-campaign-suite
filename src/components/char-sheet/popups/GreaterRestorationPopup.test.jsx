// @improved-by-ai
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import GreaterRestorationPopup from './GreaterRestorationPopup.jsx';
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { getCombatSummary } from '../../../services/encounters/combatData.js';

// ── Mocks ──

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
}));

vi.mock('../../../services/encounters/combatData.js', () => ({
    getCombatSummary: vi.fn(),
}));

// ── Test fixtures ──

const baseSpell = { name: 'Greater Restoration', level: 5 };
const creatureTargets = ['Goblin', 'Orc', 'Troll'];

function makeProps(overrides = {}) {
    return {
        spell: baseSpell,
        _playerStats: {},
        _campaignName: 'test-campaign',
        creatureTargets,
        range: '60 ft',
        onConfirm: vi.fn(),
        onSkip: vi.fn(),
        ...overrides,
    };
}

/**
 * Default runtime state mock: no conditions, no exhaustion, no buffs,
 * no ability reductions, no hp max reduction. Returns null for unknown keys.
 */
function defaultRuntimeState(overrides = {}) {
    return {
        activeConditions: [],
        exhaustionLevel: 0,
        activeBuffs: [],
        abilityReductions: {},
        hpMaxReduction: 0,
        ...overrides,
    };
}

function applyRuntimeState(runtimeState) {
    getRuntimeValue.mockImplementation((key, prop) => {
        if (prop in runtimeState) return runtimeState[prop];
        return null;
    });
}

// ── Tests ──

describe('GreaterRestorationPopup', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // ── Default render ──

    it('renders the popup overlay, modal, and spell heading', () => {
        render(<GreaterRestorationPopup {...makeProps()} />);
        expect(screen.getByRole('heading', { name: /greater restoration/i })).toBeInTheDocument();
        expect(document.querySelector('.popup-overlay')).toBeInTheDocument();
        expect(document.querySelector('.popup-modal')).toBeInTheDocument();
    });

    it('displays the spell name, level, and school in the spell name section', () => {
        render(<GreaterRestorationPopup {...makeProps()} />);
        const spellName = document.querySelector('.metamagic-spell-name');
        expect(spellName.textContent).toContain('Greater Restoration');
        expect(spellName.textContent).toContain('Level 5');
        expect(spellName.textContent).toContain('Abjuration');
    });

    it('renders the spell description with range', () => {
        render(<GreaterRestorationPopup {...makeProps()} />);
        expect(screen.getByText(/Choose a creature within/)).toBeInTheDocument();
        expect(screen.getByText('60 ft')).toBeInTheDocument();
    });

    it('renders a health icon in the heading', () => {
        render(<GreaterRestorationPopup {...makeProps()} />);
        expect(document.querySelector('.fa-hand-holding-medical')).toBeInTheDocument();
    });

    it('renders all creature targets in the target list', () => {
        render(<GreaterRestorationPopup {...makeProps()} />);
        creatureTargets.forEach(name => {
            expect(screen.getByText(name)).toBeInTheDocument();
        });
    });

    it('renders Cancel and Cast buttons', () => {
        render(<GreaterRestorationPopup {...makeProps()} />);
        expect(screen.getByText('Cancel')).toBeInTheDocument();
        expect(screen.getByText('Cast Greater Restoration')).toBeInTheDocument();
    });

    it('disables the Cast button before any target is selected', () => {
        render(<GreaterRestorationPopup {...makeProps()} />);
        expect(screen.getByText('Cast Greater Restoration')).toBeDisabled();
    });

    it('renders with the expected structural CSS classes', () => {
        render(<GreaterRestorationPopup {...makeProps()} />);
        expect(document.querySelector('.popup-overlay')).toBeInTheDocument();
        expect(document.querySelector('.popup-modal')).toBeInTheDocument();
        expect(document.querySelector('.metamagic-popup')).toBeInTheDocument();
        expect(document.querySelector('.metamagic-popup-inner')).toBeInTheDocument();
        expect(document.querySelector('.metamagic-actions')).toBeInTheDocument();
    });

    // ── Target selection ──

    it('selects a target and shows its removable effects', async () => {
        applyRuntimeState(defaultRuntimeState({ activeConditions: ['charmed'], exhaustionLevel: 1 }));
        getCombatSummary.mockReturnValue(null);

        render(<GreaterRestorationPopup {...makeProps()} />);
        fireEvent.click(screen.getByText('Goblin'));
        await waitFor(() => {
            expect(screen.getByText(/Effects to remove from/)).toBeInTheDocument();
        });
        expect(screen.getByText(/Effects to remove from Goblin/)).toBeInTheDocument();
    });

    it('highlights the selected target with a checkmark prefix', async () => {
        applyRuntimeState(defaultRuntimeState());
        getCombatSummary.mockReturnValue(null);

        render(<GreaterRestorationPopup {...makeProps()} />);
        fireEvent.click(screen.getByText('Goblin'));
        await waitFor(() => {
            expect(screen.getByText(/\u2713 Goblin/)).toBeInTheDocument();
        });
    });

    it('changes selection when clicking a different target', async () => {
        applyRuntimeState(defaultRuntimeState({ activeConditions: ['charmed'] }));
        getCombatSummary.mockReturnValue(null);

        render(<GreaterRestorationPopup {...makeProps()} />);
        fireEvent.click(screen.getByText('Goblin'));
        await waitFor(() => {
            expect(screen.getByText(/Effects to remove from/)).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('Orc'));
        await waitFor(() => {
            expect(screen.getByText(/Effects to remove from Orc/)).toBeInTheDocument();
        });
        expect(screen.queryByText(/\u2713 Goblin/)).not.toBeInTheDocument();
        expect(screen.getByText(/\u2713 Orc/)).toBeInTheDocument();
    });

    it('shows no removable effects message for a target with no effects', async () => {
        applyRuntimeState(defaultRuntimeState());
        getCombatSummary.mockReturnValue(null);

        render(<GreaterRestorationPopup {...makeProps()} />);
        fireEvent.click(screen.getByText('Goblin'));
        await waitFor(() => {
            expect(screen.getByText(/No removable effects found on this target/)).toBeInTheDocument();
        });
    });

    // ── Conditions from runtime state ──

    it('shows charmed condition when target has it in runtime state', async () => {
        applyRuntimeState(defaultRuntimeState({ activeConditions: ['charmed'] }));
        getCombatSummary.mockReturnValue(null);

        render(<GreaterRestorationPopup {...makeProps()} />);
        fireEvent.click(screen.getByText('Goblin'));
        await waitFor(() => {
            expect(screen.getByText(/Charmed condition/)).toBeInTheDocument();
        });
    });

    it('shows petrified condition when target has it in runtime state', async () => {
        applyRuntimeState(defaultRuntimeState({ activeConditions: ['petrified'] }));
        getCombatSummary.mockReturnValue(null);

        render(<GreaterRestorationPopup {...makeProps()} />);
        fireEvent.click(screen.getByText('Goblin'));
        await waitFor(() => {
            expect(screen.getByText(/Petrified condition/)).toBeInTheDocument();
        });
    });

    it('does not show a condition the target does not have', async () => {
        applyRuntimeState(defaultRuntimeState({ activeConditions: ['charmed'] }));
        getCombatSummary.mockReturnValue(null);

        render(<GreaterRestorationPopup {...makeProps()} />);
        fireEvent.click(screen.getByText('Goblin'));
        await waitFor(() => {
            expect(screen.getByText(/Charmed condition/)).toBeInTheDocument();
        });
        // Use querySelector to target only the selectable effect items, not the description paragraph
        const petrifiedEffects = document.querySelectorAll(
            '[style*="padding: 6px 10px"]:not([style*="font-style: italic"])'
        );
        const petrifiedOptions = Array.from(petrifiedEffects).filter(el =>
            el.textContent.trim().startsWith('Petrified')
        );
        expect(petrifiedOptions.length).toBe(0);
    });

    it('matches conditions case-insensitively', async () => {
        applyRuntimeState(defaultRuntimeState({ activeConditions: ['CHARMED'] }));
        getCombatSummary.mockReturnValue(null);

        render(<GreaterRestorationPopup {...makeProps()} />);
        fireEvent.click(screen.getByText('Goblin'));
        await waitFor(() => {
            expect(screen.getByText(/Charmed condition/)).toBeInTheDocument();
        });
    });

    // ── Conditions from combat summary ──

    it('falls back to combat summary conditions when runtime state is empty', async () => {
        applyRuntimeState(defaultRuntimeState());
        getCombatSummary.mockResolvedValue({
            creatures: [{ name: 'Goblin', conditions: [{ key: 'charmed' }] }],
        });

        render(<GreaterRestorationPopup {...makeProps()} />);
        fireEvent.click(screen.getByText('Goblin'));
        await waitFor(() => {
            expect(screen.getByText(/Charmed condition/)).toBeInTheDocument();
        });
    });

    it('merges conditions from runtime state and combat summary', async () => {
        applyRuntimeState(defaultRuntimeState({ activeConditions: ['charmed'] }));
        getCombatSummary.mockResolvedValue({
            creatures: [{ name: 'Goblin', conditions: [{ key: 'petrified' }] }],
        });

        render(<GreaterRestorationPopup {...makeProps()} />);
        fireEvent.click(screen.getByText('Goblin'));
        await waitFor(() => {
            expect(screen.getByText(/Charmed condition/)).toBeInTheDocument();
        });
        // Use querySelector to target only the selectable effect items, not the description paragraph
        await waitFor(() => {
            const petrifiedEffects = document.querySelectorAll(
                '[style*="padding: 6px 10px"]:not([style*="font-style: italic"])'
            );
            const petrifiedOptions = Array.from(petrifiedEffects).filter(el =>
                el.textContent.trim().startsWith('Petrified')
            );
            expect(petrifiedOptions.length).toBe(1);
        });
    });

    it('ignores combat summary conditions for a different creature', async () => {
        applyRuntimeState(defaultRuntimeState());
        getCombatSummary.mockResolvedValue({
            creatures: [{ name: 'Orc', conditions: [{ key: 'charmed' }] }],
        });

        render(<GreaterRestorationPopup {...makeProps()} />);
        fireEvent.click(screen.getByText('Goblin'));
        await waitFor(() => {
            expect(screen.getByText(/No removable effects found on this target/)).toBeInTheDocument();
        });
    });

    it('handles combat summary error gracefully', async () => {
        applyRuntimeState(defaultRuntimeState());
        getCombatSummary.mockRejectedValue(new Error('network error'));

        render(<GreaterRestorationPopup {...makeProps()} />);
        fireEvent.click(screen.getByText('Goblin'));
        await waitFor(() => {
            expect(screen.getByText(/No removable effects found on this target/)).toBeInTheDocument();
        });
    });

    // ── Exhaustion ──

    it('shows exhaustion option when target has exhaustion level > 0', async () => {
        applyRuntimeState(defaultRuntimeState({ exhaustionLevel: 2 }));
        getCombatSummary.mockReturnValue(null);

        render(<GreaterRestorationPopup {...makeProps()} />);
        fireEvent.click(screen.getByText('Goblin'));
        await waitFor(() => {
            expect(screen.getByText(/Exhaustion level \(current: 2\)/)).toBeInTheDocument();
        });
    });

    it('does not show exhaustion option when target has no exhaustion', async () => {
        applyRuntimeState(defaultRuntimeState({ exhaustionLevel: 0 }));
        getCombatSummary.mockReturnValue(null);

        render(<GreaterRestorationPopup {...makeProps()} />);
        fireEvent.click(screen.getByText('Goblin'));
        await waitFor(() => {
            expect(screen.getByText(/Effects to remove from/)).toBeInTheDocument();
        });
        expect(screen.queryByText(/Exhaustion level/)).not.toBeInTheDocument();
    });

    // ── Curse ──

    it('shows curse option when target has active buff with type "cursed"', async () => {
        applyRuntimeState(defaultRuntimeState({ activeBuffs: [{ type: 'cursed' }] }));
        getCombatSummary.mockReturnValue(null);

        render(<GreaterRestorationPopup {...makeProps()} />);
        fireEvent.click(screen.getByText('Goblin'));
        await waitFor(() => {
            expect(screen.getByText(/Curse/)).toBeInTheDocument();
        });
    });

    it('shows curse option when active buff has a truthy cursed property', async () => {
        applyRuntimeState(defaultRuntimeState({ activeBuffs: [{ cursed: true }] }));
        getCombatSummary.mockReturnValue(null);

        render(<GreaterRestorationPopup {...makeProps()} />);
        fireEvent.click(screen.getByText('Goblin'));
        await waitFor(() => {
            expect(screen.getByText(/Curse/)).toBeInTheDocument();
        });
    });

    it('does not show curse option when target has no cursed buffs', async () => {
        applyRuntimeState(defaultRuntimeState({ activeBuffs: [{ type: 'buff' }] }));
        getCombatSummary.mockReturnValue(null);

        render(<GreaterRestorationPopup {...makeProps()} />);
        fireEvent.click(screen.getByText('Goblin'));
        await waitFor(() => {
            expect(screen.getByText(/Effects to remove from/)).toBeInTheDocument();
        });
        expect(screen.queryByText(/Curse/)).not.toBeInTheDocument();
    });

    // ── Ability reduction ──

    it('shows ability score reduction option when target has ability reductions', async () => {
        applyRuntimeState(defaultRuntimeState({ abilityReductions: { STR: -2 } }));
        getCombatSummary.mockReturnValue(null);

        render(<GreaterRestorationPopup {...makeProps()} />);
        fireEvent.click(screen.getByText('Goblin'));
        await waitFor(() => {
            expect(screen.getByText(/Ability score reduction/)).toBeInTheDocument();
        });
    });

    it('does not show ability score reduction when target has no reductions', async () => {
        applyRuntimeState(defaultRuntimeState({ abilityReductions: {} }));
        getCombatSummary.mockReturnValue(null);

        render(<GreaterRestorationPopup {...makeProps()} />);
        fireEvent.click(screen.getByText('Goblin'));
        await waitFor(() => {
            expect(screen.getByText(/Effects to remove from/)).toBeInTheDocument();
        });
        expect(screen.queryByText(/Ability score reduction/)).not.toBeInTheDocument();
    });

    // ── HP max reduction ──

    it('shows HP max reduction option when target has hpMaxReduction > 0', async () => {
        applyRuntimeState(defaultRuntimeState({ hpMaxReduction: 5 }));
        getCombatSummary.mockReturnValue(null);

        render(<GreaterRestorationPopup {...makeProps()} />);
        fireEvent.click(screen.getByText('Goblin'));
        await waitFor(() => {
            expect(screen.getByText(/Hit Point maximum reduction/)).toBeInTheDocument();
        });
    });

    it('does not show HP max reduction when target has no hpMaxReduction', async () => {
        applyRuntimeState(defaultRuntimeState({ hpMaxReduction: 0 }));
        getCombatSummary.mockReturnValue(null);

        render(<GreaterRestorationPopup {...makeProps()} />);
        fireEvent.click(screen.getByText('Goblin'));
        await waitFor(() => {
            expect(screen.getByText(/Effects to remove from/)).toBeInTheDocument();
        });
        expect(screen.queryByText(/Hit Point maximum reduction/)).not.toBeInTheDocument();
    });

    // ── Selection toggling ──

    it('toggles exhaustion selection on and off', async () => {
        applyRuntimeState(defaultRuntimeState({ exhaustionLevel: 1 }));
        getCombatSummary.mockReturnValue(null);

        render(<GreaterRestorationPopup {...makeProps()} />);
        fireEvent.click(screen.getByText('Goblin'));
        await waitFor(() => {
            expect(screen.getByText(/Exhaustion level/)).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText(/Exhaustion level \(current: 1\)/));
        expect(screen.getByText(/\u2713 Exhaustion level \(current: 1\)/)).toBeInTheDocument();

        fireEvent.click(screen.getByText(/Exhaustion level \(current: 1\)/));
        expect(screen.queryByText(/\u2713 Exhaustion level \(current: 1\)/)).not.toBeInTheDocument();
    });

    it('toggles condition selection on and off', async () => {
        applyRuntimeState(defaultRuntimeState({ activeConditions: ['charmed'] }));
        getCombatSummary.mockReturnValue(null);

        render(<GreaterRestorationPopup {...makeProps()} />);
        fireEvent.click(screen.getByText('Goblin'));
        await waitFor(() => {
            expect(screen.getByText(/Charmed condition/)).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText(/Charmed condition/));
        expect(screen.getByText(/\u2713 Charmed condition/)).toBeInTheDocument();

        fireEvent.click(screen.getByText(/Charmed condition/));
        expect(screen.queryByText(/\u2713 Charmed condition/)).not.toBeInTheDocument();
    });

    it('toggles curse selection on and off', async () => {
        applyRuntimeState(defaultRuntimeState({ activeBuffs: [{ type: 'cursed' }] }));
        getCombatSummary.mockReturnValue(null);

        render(<GreaterRestorationPopup {...makeProps()} />);
        fireEvent.click(screen.getByText('Goblin'));
        await waitFor(() => {
            expect(screen.getByText(/Curse/)).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText(/Curse/));
        expect(screen.getByText(text => text.includes('\u2713') && text.includes('Curse'))).toBeInTheDocument();

        fireEvent.click(screen.getByText(/Curse/));
        expect(screen.queryByText(text => text.includes('\u2713') && text.includes('Curse'))).not.toBeInTheDocument();
    });

    it('toggles ability score reduction selection on and off', async () => {
        applyRuntimeState(defaultRuntimeState({ abilityReductions: { STR: -2 } }));
        getCombatSummary.mockReturnValue(null);

        render(<GreaterRestorationPopup {...makeProps()} />);
        fireEvent.click(screen.getByText('Goblin'));
        await waitFor(() => {
            expect(screen.getByText(/Ability score reduction/)).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText(/Ability score reduction/));
        expect(screen.getByText(/\u2713 Ability score reduction/)).toBeInTheDocument();

        fireEvent.click(screen.getByText(/Ability score reduction/));
        expect(screen.queryByText(/\u2713 Ability score reduction/)).not.toBeInTheDocument();
    });

    it('toggles HP max reduction selection on and off', async () => {
        applyRuntimeState(defaultRuntimeState({ hpMaxReduction: 3 }));
        getCombatSummary.mockReturnValue(null);

        render(<GreaterRestorationPopup {...makeProps()} />);
        fireEvent.click(screen.getByText('Goblin'));
        await waitFor(() => {
            expect(screen.getByText(/Hit Point maximum reduction/)).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText(/Hit Point maximum reduction/));
        expect(screen.getByText(/\u2713 Hit Point maximum reduction/)).toBeInTheDocument();

        fireEvent.click(screen.getByText(/Hit Point maximum reduction/));
        expect(screen.queryByText(/\u2713 Hit Point maximum reduction/)).not.toBeInTheDocument();
    });

    // ── Multiple selections ──

    it('allows selecting multiple effects at once', async () => {
        applyRuntimeState(defaultRuntimeState({
            activeConditions: ['charmed'],
            exhaustionLevel: 1,
            activeBuffs: [{ type: 'cursed' }],
            abilityReductions: { STR: -2 },
        }));
        getCombatSummary.mockReturnValue(null);

        render(<GreaterRestorationPopup {...makeProps()} />);
        fireEvent.click(screen.getByText('Goblin'));
        await waitFor(() => {
            expect(screen.getByText(/Exhaustion level/)).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText(/Exhaustion level \(current: 1\)/));
        fireEvent.click(screen.getByText(/Charmed condition/));
        fireEvent.click(screen.getByText(/Curse/));
        fireEvent.click(screen.getByText(/Ability score reduction/));

        expect(screen.getByText(/\u2713 Exhaustion level \(current: 1\)/)).toBeInTheDocument();
        expect(screen.getByText(/\u2713 Charmed condition/)).toBeInTheDocument();
        expect(screen.getByText(text => text.includes('\u2713') && text.includes('Curse'))).toBeInTheDocument();
        expect(screen.getByText(/\u2713 Ability score reduction/)).toBeInTheDocument();
    });

    // ── Confirm button state ──

    it('enables Cast button when target is selected and at least one effect is selected', async () => {
        applyRuntimeState(defaultRuntimeState({ activeConditions: ['charmed'] }));
        getCombatSummary.mockReturnValue(null);

        render(<GreaterRestorationPopup {...makeProps()} />);
        fireEvent.click(screen.getByText('Goblin'));
        await waitFor(() => {
            expect(screen.getByText(/Charmed condition/)).toBeInTheDocument();
        });

        expect(screen.getByText('Cast Greater Restoration')).toBeDisabled();

        fireEvent.click(screen.getByText(/Charmed condition/));
        expect(screen.getByText('Cast Greater Restoration')).toBeEnabled();
    });

    it('keeps Cast button disabled when target is selected but no effects are available', async () => {
        applyRuntimeState(defaultRuntimeState());
        getCombatSummary.mockReturnValue(null);

        render(<GreaterRestorationPopup {...makeProps()} />);
        fireEvent.click(screen.getByText('Goblin'));
        await waitFor(() => {
            expect(screen.getByText(/No removable effects found/)).toBeInTheDocument();
        });
        expect(screen.getByText('Cast Greater Restoration')).toBeDisabled();
    });

    it('keeps Cast button disabled when target is selected but no effects are chosen', async () => {
        applyRuntimeState(defaultRuntimeState({ activeConditions: ['charmed'] }));
        getCombatSummary.mockReturnValue(null);

        render(<GreaterRestorationPopup {...makeProps()} />);
        fireEvent.click(screen.getByText('Goblin'));
        await waitFor(() => {
            expect(screen.getByText(/Charmed condition/)).toBeInTheDocument();
        });

        expect(screen.getByText('Cast Greater Restoration')).toBeDisabled();
    });

    // ── Confirm action ──

    it('calls onConfirm with target name and selections when Cast is clicked', async () => {
        const onConfirm = vi.fn();
        applyRuntimeState(defaultRuntimeState({
            activeConditions: ['charmed'],
            exhaustionLevel: 2,
            activeBuffs: [{ type: 'cursed' }],
            abilityReductions: { STR: -2 },
        }));
        getCombatSummary.mockReturnValue(null);

        render(<GreaterRestorationPopup {...makeProps({ onConfirm })} />);
        fireEvent.click(screen.getByText('Goblin'));
        await waitFor(() => {
            expect(screen.getByText(/Exhaustion level/)).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText(/Exhaustion level \(current: 2\)/));
        fireEvent.click(screen.getByText(/Charmed condition/));

        fireEvent.click(screen.getByText('Cast Greater Restoration'));
        expect(onConfirm).toHaveBeenCalledTimes(1);
        expect(onConfirm).toHaveBeenCalledWith({
            targetName: 'Goblin',
            selections: [
                { type: 'exhaustion' },
                { type: 'condition', condition: 'charmed' },
            ],
        });
    });

    it('calls onConfirm with ability_reduction and hp_max_reduction types', async () => {
        const onConfirm = vi.fn();
        applyRuntimeState(defaultRuntimeState({
            abilityReductions: { DEX: -4 },
            hpMaxReduction: 10,
        }));
        getCombatSummary.mockReturnValue(null);

        render(<GreaterRestorationPopup {...makeProps({ onConfirm })} />);
        fireEvent.click(screen.getByText('Goblin'));
        await waitFor(() => {
            expect(screen.getByText(/Hit Point maximum reduction/)).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText(/Ability score reduction/));
        fireEvent.click(screen.getByText(/Hit Point maximum reduction/));

        fireEvent.click(screen.getByText('Cast Greater Restoration'));
        expect(onConfirm).toHaveBeenCalledWith({
            targetName: 'Goblin',
            selections: [
                { type: 'ability_reduction' },
                { type: 'hp_max_reduction' },
            ],
        });
    });

    it('does not call onConfirm when no target is selected', () => {
        const onConfirm = vi.fn();
        render(<GreaterRestorationPopup {...makeProps({ onConfirm })} />);
        fireEvent.click(screen.getByText('Cast Greater Restoration'));
        expect(onConfirm).not.toHaveBeenCalled();
    });

    it('does not call onConfirm when target is selected but no effects are selected', async () => {
        const onConfirm = vi.fn();
        applyRuntimeState(defaultRuntimeState());
        getCombatSummary.mockReturnValue(null);

        render(<GreaterRestorationPopup {...makeProps({ onConfirm })} />);
        fireEvent.click(screen.getByText('Goblin'));
        await waitFor(() => {
            expect(screen.getByText(/No removable effects found/)).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('Cast Greater Restoration'));
        expect(onConfirm).not.toHaveBeenCalled();
    });

    // ── Cancel/Skip ──

    it('calls onSkip when Cancel button is clicked', () => {
        const onSkip = vi.fn();
        render(<GreaterRestorationPopup {...makeProps({ onSkip })} />);
        fireEvent.click(screen.getByText('Cancel'));
        expect(onSkip).toHaveBeenCalledTimes(1);
    });

    it('calls onSkip when overlay background is clicked', () => {
        const onSkip = vi.fn();
        render(<GreaterRestorationPopup {...makeProps({ onSkip })} />);
        fireEvent.click(document.querySelector('.popup-overlay'));
        expect(onSkip).toHaveBeenCalledTimes(1);
    });

    it('does not call onSkip when modal content is clicked', () => {
        const onSkip = vi.fn();
        applyRuntimeState(defaultRuntimeState());
        getCombatSummary.mockReturnValue(null);

        render(<GreaterRestorationPopup {...makeProps({ onSkip })} />);
        fireEvent.click(screen.getByText('Goblin'));
        fireEvent.click(screen.getByText(/Choose a creature within/));
        expect(onSkip).not.toHaveBeenCalled();
    });

    // ── Keyboard handler ──

    it('calls onSkip when Escape key is pressed', () => {
        const onSkip = vi.fn();
        render(<GreaterRestorationPopup {...makeProps({ onSkip })} />);
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(onSkip).toHaveBeenCalledTimes(1);
    });

    it('does not call onSkip for non-Escape key press', () => {
        const onSkip = vi.fn();
        render(<GreaterRestorationPopup {...makeProps({ onSkip })} />);
        fireEvent.keyDown(document, { key: 'Enter' });
        expect(onSkip).not.toHaveBeenCalled();
    });

    // ── Fallback values ──

    it('shows fallback spell name when spell prop is undefined', () => {
        render(<GreaterRestorationPopup {...makeProps({ spell: undefined })} />);
        expect(screen.getByText(/Spell/)).toBeInTheDocument();
    });

    it('shows fallback level when spell.level is undefined', () => {
        render(<GreaterRestorationPopup {...makeProps({ spell: { name: 'Test Spell' } })} />);
        expect(screen.getByText(/Level 5/)).toBeInTheDocument();
    });

    // ── Empty creature targets ──

    it('renders without target list when creatureTargets is empty', () => {
        render(<GreaterRestorationPopup {...makeProps({ creatureTargets: [] })} />);
        expect(screen.getByText('Cast Greater Restoration')).toBeDisabled();
        creatureTargets.forEach(name => {
            expect(screen.queryByText(name)).not.toBeInTheDocument();
        });
    });

    // ── Range display ──

    it('renders the provided range in the description', () => {
        render(<GreaterRestorationPopup {...makeProps({ range: '30 ft' })} />);
        expect(screen.getByText('30 ft')).toBeInTheDocument();
    });
});
