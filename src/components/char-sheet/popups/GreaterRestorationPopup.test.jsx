// @cleaned-by-ai
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TargetWithCheckboxesPopup from './TargetWithCheckboxesPopup.jsx';
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { getCombatSummary } from '../../../services/encounters/combatData.js';

// ── Mocks ──

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
}));

vi.mock('../../../services/encounters/combatData.js', () => ({
    getCombatSummary: vi.fn(),
}));

vi.mock('../../../services/ui/utils.js', () => ({
    __esModule: true,
    default: {
        getName: (name) => name || 'Unknown',
    },
}));

// ── Test fixtures ──

const baseSpell = { name: 'Greater Restoration', level: 5 };
const creatureTargets = ['Goblin', 'Orc', 'Troll'];

function makeProps(overrides = {}) {
    const campaignName = overrides.campaignName ?? 'test-campaign';
    const conditionMatches = (c, targetCondition) =>
        (typeof c === 'string' ? c.toLowerCase() : '').trim() === (typeof targetCondition === 'string' ? targetCondition.toLowerCase() : '').trim();

    const loadTargetData = async (targetName) => {
        const result = [];
        const conditions = getRuntimeValue(targetName, 'activeConditions') || [];
        let csConditions = [];
        try {
            const cs = await getCombatSummary(campaignName);
            if (cs) {
                const creature = cs.creatures?.find(c => require('../../../services/ui/utils.js').default.getName(c.name) === require('../../../services/ui/utils.js').default.getName(targetName));
                if (creature && Array.isArray(creature.conditions)) {
                    csConditions = creature.conditions.map(c => c.key);
                }
            }
        } catch { /* ignore */ }
        const allConditions = [...new Set([...conditions, ...csConditions])];
        const RESTORATION_CONDITIONS = [{ id: 'charmed' }, { id: 'petrified' }];
        RESTORATION_CONDITIONS
            .filter(c => allConditions.some(cond => conditionMatches(cond, c.id)))
            .forEach(c => {
                result.push({ id: c.id, label: `${c.id.charAt(0).toUpperCase() + c.id.slice(1)} condition`, selectionData: { type: 'condition', condition: c.id } });
            });
        const exhaustion = getRuntimeValue(targetName, 'exhaustionLevel') || 0;
        if (exhaustion > 0) {
            result.push({ id: 'exhaustion', label: `Exhaustion level (current: ${exhaustion})`, selectionData: { type: 'exhaustion' } });
        }
        const activeBuffs = getRuntimeValue(targetName, 'activeBuffs') || [];
        const hasCurse = activeBuffs.some(b => b.type === 'cursed' || b.cursed);
        if (hasCurse) {
            result.push({ id: 'curse', label: 'Curse (including attunement to cursed magic item)', selectionData: { type: 'curse' } });
        }
        const abilityReductions = getRuntimeValue(targetName, 'abilityReductions') || {};
        if (Object.keys(abilityReductions).length > 0) {
            result.push({ id: 'ability_reduction', label: 'Ability score reduction', selectionData: { type: 'ability_reduction' } });
        }
        const hpMaxReduction = getRuntimeValue(targetName, 'hpMaxReduction') || 0;
        if (hpMaxReduction > 0) {
            result.push({ id: 'hp_max_reduction', label: 'Hit Point maximum reduction', selectionData: { type: 'hp_max_reduction' } });
        }
        return result;
    };

    const range = overrides.range ?? '60 ft';
    return {
        spell: baseSpell,
        _playerStats: {},
        _campaignName: 'test-campaign',
        creatureTargets,
        range,
        onConfirm: vi.fn(),
        onSkip: vi.fn(),
        loadTargetData,
        icon: 'fa-solid fa-hand-holding-medical',
        title: 'Greater Restoration',
        school: 'Abjuration',
        defaultLevel: 5,
        description: `Choose a creature within ${range} and select the effect(s) to remove. This spell can remove one or more of the following from the target: an exhaustion level, the Charmed or Petrified condition, a curse (including attunement to a cursed magic item), any reduction to an ability score, or any reduction to the target's Hit Point maximum.`,
        noItemsMessage: 'No removable effects found on this target',
        confirmLabel: 'Cast Greater Restoration',
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

describe('TargetWithCheckboxesPopup', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // ── Default render ──

    it('renders the popup overlay, modal, spell heading, and buttons', () => {
        render(<TargetWithCheckboxesPopup {...makeProps()} />);
        expect(screen.getByRole('heading', { name: /greater restoration/i })).toBeInTheDocument();
        expect(document.querySelector('.popup-overlay')).toBeInTheDocument();
        expect(document.querySelector('.popup-modal')).toBeInTheDocument();
        expect(screen.getByText('Cancel')).toBeInTheDocument();
        expect(screen.getByText('Cast Greater Restoration')).toBeInTheDocument();
        expect(screen.getByText('Cast Greater Restoration')).toBeDisabled();
    });

    it('displays the spell name, level, and school in the spell name section', () => {
        render(<TargetWithCheckboxesPopup {...makeProps()} />);
        const spellName = document.querySelector('.metamagic-spell-name');
        expect(spellName.textContent).toContain('Greater Restoration');
        expect(spellName.textContent).toContain('Level 5');
        expect(spellName.textContent).toContain('Abjuration');
    });

    it('renders the spell description with range', () => {
        render(<TargetWithCheckboxesPopup {...makeProps()} />);
        expect(screen.getByText(/Choose a creature within/)).toBeInTheDocument();
        expect(screen.getByText(/60 ft/)).toBeInTheDocument();
    });

    it('renders all creature targets in the target list', () => {
        render(<TargetWithCheckboxesPopup {...makeProps()} />);
        creatureTargets.forEach(name => {
            expect(screen.getByText(name)).toBeInTheDocument();
        });
    });

    it('renders structural CSS classes', () => {
        render(<TargetWithCheckboxesPopup {...makeProps()} />);
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

        render(<TargetWithCheckboxesPopup {...makeProps()} />);
        fireEvent.click(screen.getByText('Goblin'));
        await waitFor(() => {
            expect(screen.getByText(/Effects to remove from/)).toBeInTheDocument();
        });
        expect(screen.getByText(/Effects to remove from Goblin/)).toBeInTheDocument();
    });

    it('highlights the selected target with a checkmark prefix', async () => {
        applyRuntimeState(defaultRuntimeState());
        getCombatSummary.mockReturnValue(null);

        render(<TargetWithCheckboxesPopup {...makeProps()} />);
        fireEvent.click(screen.getByText('Goblin'));
        await waitFor(() => {
            expect(screen.getByText(/\u2713 Goblin/)).toBeInTheDocument();
        });
    });

    it('changes selection when clicking a different target', async () => {
        applyRuntimeState(defaultRuntimeState({ activeConditions: ['charmed'] }));
        getCombatSummary.mockReturnValue(null);

        render(<TargetWithCheckboxesPopup {...makeProps()} />);
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

        render(<TargetWithCheckboxesPopup {...makeProps()} />);
        fireEvent.click(screen.getByText('Goblin'));
        await waitFor(() => {
            expect(screen.getByText(/No removable effects found on this target/)).toBeInTheDocument();
        });
    });

    // ── Conditions ──

    it('shows conditions when target has them in runtime state', async () => {
        applyRuntimeState(defaultRuntimeState({ activeConditions: ['charmed'] }));
        getCombatSummary.mockReturnValue(null);

        render(<TargetWithCheckboxesPopup {...makeProps()} />);
        fireEvent.click(screen.getByText('Goblin'));
        await waitFor(() => {
            expect(screen.getByText(/Charmed condition/)).toBeInTheDocument();
        });
    });

    it('shows conditions from combat summary when runtime state is empty', async () => {
        applyRuntimeState(defaultRuntimeState());
        getCombatSummary.mockResolvedValue({
            creatures: [{ name: 'Goblin', conditions: [{ key: 'charmed' }] }],
        });

        render(<TargetWithCheckboxesPopup {...makeProps()} />);
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

        render(<TargetWithCheckboxesPopup {...makeProps()} />);
        fireEvent.click(screen.getByText('Goblin'));
        await waitFor(() => {
            expect(screen.getByText(/Effects to remove from Goblin/)).toBeInTheDocument();
        });

        const selectableItems = document.querySelectorAll(
            '[style*="padding: 6px 10px"]:not([style*="font-style: italic"])'
        );
        const conditionItems = Array.from(selectableItems).filter(el =>
            el.textContent.trim().includes('condition')
        );
        expect(conditionItems).toHaveLength(2);
    });

    it('ignores combat summary conditions for a different creature', async () => {
        applyRuntimeState(defaultRuntimeState());
        getCombatSummary.mockResolvedValue({
            creatures: [{ name: 'Orc', conditions: [{ key: 'charmed' }] }],
        });

        render(<TargetWithCheckboxesPopup {...makeProps()} />);
        fireEvent.click(screen.getByText('Goblin'));
        await waitFor(() => {
            expect(screen.getByText(/No removable effects found on this target/)).toBeInTheDocument();
        });
    });

    it('handles combat summary error gracefully', async () => {
        applyRuntimeState(defaultRuntimeState());
        getCombatSummary.mockRejectedValue(new Error('network error'));

        render(<TargetWithCheckboxesPopup {...makeProps()} />);
        fireEvent.click(screen.getByText('Goblin'));
        await waitFor(() => {
            expect(screen.getByText(/No removable effects found on this target/)).toBeInTheDocument();
        });
    });

    it('matches conditions case-insensitively', async () => {
        applyRuntimeState(defaultRuntimeState({ activeConditions: ['CHARMED'] }));
        getCombatSummary.mockReturnValue(null);

        render(<TargetWithCheckboxesPopup {...makeProps()} />);
        fireEvent.click(screen.getByText('Goblin'));
        await waitFor(() => {
            expect(screen.getByText(/Charmed condition/)).toBeInTheDocument();
        });
    });

    // ── Exhaustion ──

    it('shows exhaustion option when target has exhaustion level > 0', async () => {
        applyRuntimeState(defaultRuntimeState({ exhaustionLevel: 2 }));
        getCombatSummary.mockReturnValue(null);

        render(<TargetWithCheckboxesPopup {...makeProps()} />);
        fireEvent.click(screen.getByText('Goblin'));
        await waitFor(() => {
            expect(screen.getByText(/Exhaustion level \(current: 2\)/)).toBeInTheDocument();
        });
    });

    // ── Curse ──

    it('shows curse option when target has active buff with type "cursed" or cursed property', async () => {
        applyRuntimeState(defaultRuntimeState({ activeBuffs: [{ type: 'cursed' }] }));
        getCombatSummary.mockReturnValue(null);

        render(<TargetWithCheckboxesPopup {...makeProps()} />);
        fireEvent.click(screen.getByText('Goblin'));
        await waitFor(() => {
            expect(screen.getByText(/Curse/)).toBeInTheDocument();
        });
    });

    // ── Ability reduction ──

    it('shows ability score reduction option when target has ability reductions', async () => {
        applyRuntimeState(defaultRuntimeState({ abilityReductions: { STR: -2 } }));
        getCombatSummary.mockReturnValue(null);

        render(<TargetWithCheckboxesPopup {...makeProps()} />);
        fireEvent.click(screen.getByText('Goblin'));
        await waitFor(() => {
            expect(screen.getByText(/Ability score reduction/)).toBeInTheDocument();
        });
    });

    // ── HP max reduction ──

    it('shows HP max reduction option when target has hpMaxReduction > 0', async () => {
        applyRuntimeState(defaultRuntimeState({ hpMaxReduction: 5 }));
        getCombatSummary.mockReturnValue(null);

        render(<TargetWithCheckboxesPopup {...makeProps()} />);
        fireEvent.click(screen.getByText('Goblin'));
        await waitFor(() => {
            expect(screen.getByText(/Hit Point maximum reduction/)).toBeInTheDocument();
        });
    });

    // ── Selection toggling ──

    it('toggles effect selection on and off', async () => {
        applyRuntimeState(defaultRuntimeState({ activeConditions: ['charmed'] }));
        getCombatSummary.mockReturnValue(null);

        render(<TargetWithCheckboxesPopup {...makeProps()} />);
        fireEvent.click(screen.getByText('Goblin'));
        await waitFor(() => {
            expect(screen.getByText(/Charmed condition/)).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText(/Charmed condition/));
        expect(screen.getByText(/\u2713 Charmed condition/)).toBeInTheDocument();

        fireEvent.click(screen.getByText(/Charmed condition/));
        expect(screen.queryByText(/\u2713 Charmed condition/)).not.toBeInTheDocument();
    });

    it('allows selecting multiple effects at once', async () => {
        applyRuntimeState(defaultRuntimeState({
            activeConditions: ['charmed'],
            exhaustionLevel: 1,
            activeBuffs: [{ type: 'cursed' }],
            abilityReductions: { STR: -2 },
        }));
        getCombatSummary.mockReturnValue(null);

        render(<TargetWithCheckboxesPopup {...makeProps()} />);
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

        render(<TargetWithCheckboxesPopup {...makeProps()} />);
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

        render(<TargetWithCheckboxesPopup {...makeProps()} />);
        fireEvent.click(screen.getByText('Goblin'));
        await waitFor(() => {
            expect(screen.getByText(/No removable effects found/)).toBeInTheDocument();
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

        render(<TargetWithCheckboxesPopup {...makeProps({ onConfirm })} />);
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

    it('calls onConfirm with all five effect types selected', async () => {
        const onConfirm = vi.fn();
        applyRuntimeState(defaultRuntimeState({
            activeConditions: ['charmed'],
            exhaustionLevel: 1,
            activeBuffs: [{ type: 'cursed' }],
            abilityReductions: { STR: -2 },
            hpMaxReduction: 5,
        }));
        getCombatSummary.mockReturnValue(null);

        render(<TargetWithCheckboxesPopup {...makeProps({ onConfirm })} />);
        fireEvent.click(screen.getByText('Goblin'));
        await waitFor(() => {
            expect(screen.getByText(/Exhaustion level/)).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText(/Exhaustion level \(current: 1\)/));
        fireEvent.click(screen.getByText(/Charmed condition/));
        fireEvent.click(screen.getByText(/Curse/));
        fireEvent.click(screen.getByText(/Ability score reduction/));
        fireEvent.click(screen.getByText(/Hit Point maximum reduction/));

        fireEvent.click(screen.getByText('Cast Greater Restoration'));
        expect(onConfirm).toHaveBeenCalledWith({
            targetName: 'Goblin',
            selections: [
                { type: 'exhaustion' },
                { type: 'condition', condition: 'charmed' },
                { type: 'curse' },
                { type: 'ability_reduction' },
                { type: 'hp_max_reduction' },
            ],
        });
    });

    it('does not call onConfirm when no target is selected', () => {
        const onConfirm = vi.fn();
        render(<TargetWithCheckboxesPopup {...makeProps({ onConfirm })} />);
        fireEvent.click(screen.getByText('Cast Greater Restoration'));
        expect(onConfirm).not.toHaveBeenCalled();
    });

    // ── Cancel/Skip ──

    it('calls onSkip when Cancel button is clicked', () => {
        const onSkip = vi.fn();
        render(<TargetWithCheckboxesPopup {...makeProps({ onSkip })} />);
        fireEvent.click(screen.getByText('Cancel'));
        expect(onSkip).toHaveBeenCalledTimes(1);
    });

    it('calls onSkip when overlay background is clicked', () => {
        const onSkip = vi.fn();
        render(<TargetWithCheckboxesPopup {...makeProps({ onSkip })} />);
        fireEvent.click(document.querySelector('.popup-overlay'));
        expect(onSkip).toHaveBeenCalledTimes(1);
    });

    it('does not call onSkip when modal content is clicked', () => {
        const onSkip = vi.fn();
        applyRuntimeState(defaultRuntimeState());
        getCombatSummary.mockReturnValue(null);

        render(<TargetWithCheckboxesPopup {...makeProps({ onSkip })} />);
        fireEvent.click(screen.getByText('Goblin'));
        fireEvent.click(screen.getByText(/Choose a creature within/));
        expect(onSkip).not.toHaveBeenCalled();
    });

    // ── Keyboard handler ──

    it('calls onSkip when Escape key is pressed', () => {
        const onSkip = vi.fn();
        render(<TargetWithCheckboxesPopup {...makeProps({ onSkip })} />);
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(onSkip).toHaveBeenCalledTimes(1);
    });

    it('does not call onSkip for non-Escape key press', () => {
        const onSkip = vi.fn();
        render(<TargetWithCheckboxesPopup {...makeProps({ onSkip })} />);
        fireEvent.keyDown(document, { key: 'Enter' });
        expect(onSkip).not.toHaveBeenCalled();
    });

    // ── Edge cases ──

    it('renders description with custom range prop', () => {
        render(<TargetWithCheckboxesPopup {...makeProps({ range: '30 ft' })} />);
        expect(screen.getByText(/Choose a creature within 30 ft/)).toBeInTheDocument();
    });

    it('renders without target list when creatureTargets is empty', () => {
        render(<TargetWithCheckboxesPopup {...makeProps({ creatureTargets: [] })} />);
        expect(screen.getByText('Cast Greater Restoration')).toBeDisabled();
        creatureTargets.forEach(name => {
            expect(screen.queryByText(name)).not.toBeInTheDocument();
        });
    });

    it('passes campaignName to getCombatSummary', async () => {
        applyRuntimeState(defaultRuntimeState());
        getCombatSummary.mockResolvedValue(null);

        const props = makeProps({ campaignName: 'my-campaign' });
        render(<TargetWithCheckboxesPopup {...props} />);
        fireEvent.click(screen.getByText('Goblin'));

        await waitFor(() => {
            expect(getCombatSummary).toHaveBeenCalledWith('my-campaign');
        });
    });

    it('calls getRuntimeValue with correct property keys for target data', async () => {
        applyRuntimeState(defaultRuntimeState({ activeConditions: ['charmed'] }));
        getCombatSummary.mockReturnValue(null);

        render(<TargetWithCheckboxesPopup {...makeProps()} />);
        fireEvent.click(screen.getByText('Goblin'));

        await waitFor(() => {
            expect(getRuntimeValue).toHaveBeenCalledWith('Goblin', 'activeConditions');
            expect(getRuntimeValue).toHaveBeenCalledWith('Goblin', 'exhaustionLevel');
            expect(getRuntimeValue).toHaveBeenCalledWith('Goblin', 'activeBuffs');
            expect(getRuntimeValue).toHaveBeenCalledWith('Goblin', 'abilityReductions');
            expect(getRuntimeValue).toHaveBeenCalledWith('Goblin', 'hpMaxReduction');
        });
    });

    it('displays the full spell description text', () => {
        render(<TargetWithCheckboxesPopup {...makeProps()} />);
        expect(screen.getByText(/This spell can remove one or more of the following/)).toBeInTheDocument();
        expect(screen.getByText(/exhaustion level/)).toBeInTheDocument();
        expect(screen.getByText(/Charmed or Petrified condition/)).toBeInTheDocument();
        expect(screen.getByText(/curse/)).toBeInTheDocument();
        expect(screen.getByText(/ability score/)).toBeInTheDocument();
        expect(screen.getByText(/Hit Point maximum/)).toBeInTheDocument();
    });
});
