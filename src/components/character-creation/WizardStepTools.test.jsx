// @maintained-by-ai
// WizardStepTools component lane: disk-faithful tool grid (equipment.json Tools rows are
// imported VERBATIM and served through the getToolsByCategory seam exactly as prod filters
// them — 33 rows across the 4 wizard categories, every row has an `ability`, so empty-grid
// and missing-ability states are fiction and are NOT pinned). Selection/expand, locked
// pre-selected checkboxes (#289: disabled + inert click), exact onToolToggle name payloads,
// rules-panel counts, and the Skilled pool row. Fresh makeProps per test (#362).
// Reachability audit against the feeding hooks (useWizardTools/useWizardArrayToggle):
// - toolLimits starts null (useWizardConfig slot initial) and then always carries
//   { categoryLimits, preSelected, skilledUsesAvailable } — "{}" and missing-categoryLimits
//   props are unreachable and unpinned; zero-count map entries never enter the Map
//   (addCategoryLimit only adds positive parsed counts).
// - pre-selected ⊆ selected: useWizardConfig batches preSelectedTools + formData merge, and
//   useWizardArrayToggle refuses to un-toggle pre-selected items — so the only stable
//   pre-selected state is checked+disabled, pinned once below.
// - "N from:" placeholders live in `proficiencies` (campaign JSON, CharSummary lane), never
//   in the wizard's toolProficiencies (toggle pushes raw card names only) — unpinned here.
// Step-number display is owned by WizardStepNumbering.test.jsx; warnings rendering is owned
// by WarningList.test.jsx — only the step's pass-through of `warnings`/`errors` is pinned.
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import WizardStepTools from './WizardStepTools.jsx';
import DISK_EQUIPMENT from '../../../public/data/equipment.json';

vi.mock('../../services/character/toolValidation.js', () => ({
  getToolsByCategory: vi.fn(),
}));

import { getToolsByCategory } from '../../services/character/toolValidation.js';

// The four categories the step loads, in the component's loop order.
const TOOL_CATEGORIES = ["Artisan's Tools", 'Gaming Sets', 'Musical Instrument', 'Other Tools'];

// Verbatim disk rows (name/ability/utilize/craft straight from equipment.json).
const diskTools = DISK_EQUIPMENT.filter(e => e.equipment_category === 'Tools');
const diskToolsIn = cat => diskTools.filter(t => t.tool_category === cat);
const diskRow = name => diskTools.find(t => t.name === name);

// Disk-anchored prop sets (Bard "Choose 3 Musical Instruments", Soldier "Choose one kind of
// Gaming Set", Chef's fixed "Cook's Utensils", Skilled pool of 3) — shapes exactly as
// useWizardTools/getToolLimitsByCategory deliver them.
const BARD_SOLDIER_LIMITS = extra => ({
  categoryLimits: new Map([['Gaming Sets', 1], ['Musical Instrument', 3]]),
  preSelected: [],
  skilledUsesAvailable: 0,
  ...extra,
});

function makeProps(overrides = {}) {
  const { formData, ...rest } = overrides;
  return {
    stepNumber: 11,
    formData: { toolProficiencies: [], ...formData },
    errors: {},
    onToolToggle: vi.fn(),
    toolLimits: BARD_SOLDIER_LIMITS(),
    toolWarnings: [],
    preSelectedTools: [],
    skillLimits: { skilledUsesUsed: 0 },
    ...rest,
  };
}

async function renderStep(overrides = {}) {
  const props = makeProps(overrides);
  const utils = render(<WizardStepTools {...props} />);
  await waitFor(() => {
    expect(document.querySelectorAll('.tool-card')).toHaveLength(diskTools.length);
  });
  return { props, ...utils };
}

const cardFor = name =>
  Array.from(document.querySelectorAll('.tool-card'))
    .find(c => c.querySelector('.tool-name').textContent === name);

const checkboxFor = name => cardFor(name).querySelector('input[type="checkbox"]');

beforeEach(() => {
  vi.clearAllMocks();
  // Prod-shaped seam: getToolsByCategory filters equipment.json by tool_category.
  getToolsByCategory.mockImplementation(async cat => diskToolsIn(cat));
});

describe('WizardStepTools', () => {
  it('renders the grid: header, four categories in wizard order, every disk tool with its abbreviated ability badge', async () => {
    await renderStep();

    expect(screen.getByRole('heading', { name: 'Step 11: Tool Proficiencies' })).toBeInTheDocument();

    // Ordered exact set of category headers.
    expect(
      Array.from(document.querySelectorAll('.tool-category-header')).map(h => h.textContent)
    ).toEqual(TOOL_CATEGORIES);

    // Exact ordered tool names per category — verbatim disk rows, nothing dropped or invented.
    for (const cat of TOOL_CATEGORIES) {
      const section = cardFor(diskToolsIn(cat)[0].name).closest('.tool-category-section');
      expect(
        Array.from(section.querySelectorAll('.tool-name')).map(n => n.textContent)
      ).toEqual(diskToolsIn(cat).map(t => t.name));
    }

    // Every disk Tools row carries an ability -> full-name abbreviations on all cards.
    const badges = Array.from(document.querySelectorAll('.tool-ability-badge'));
    expect(badges).toHaveLength(diskTools.length);
    expect(badges.map(b => b.textContent)).not.toContain('Intelligence');
    expect(cardFor("Alchemist's Supplies").querySelector('.tool-ability-badge').textContent).toBe('INT');
    expect(cardFor('Dice Set').querySelector('.tool-ability-badge').textContent).toBe('WIS');
    expect(cardFor("Smith's Tools").querySelector('.tool-ability-badge').textContent).toBe('STR');
    expect(cardFor('Bagpipes').querySelector('.tool-ability-badge').textContent).toBe('CHA');
  });

  it('expands only selected tools with their verbatim disk utilize/craft details', async () => {
    await renderStep({
      formData: { toolProficiencies: ["Alchemist's Supplies", 'Dice Set'] },
    });

    const alchemist = cardFor("Alchemist's Supplies");
    expect(alchemist).toHaveClass('selected');
    expect(checkboxFor("Alchemist's Supplies").checked).toBe(true);
    expect(alchemist.querySelector('.tool-utilize').textContent)
      .toBe(`Utilize: ${diskRow("Alchemist's Supplies").utilize}`);
    expect(alchemist.querySelector('.tool-craft').textContent)
      .toBe(`Craft: ${diskRow("Alchemist's Supplies").craft}`);

    // Dice Set has no craft field on disk -> only the utilize row renders inside details.
    const dice = cardFor('Dice Set');
    expect(dice.querySelector('.tool-utilize').textContent).toBe(`Utilize: ${diskRow('Dice Set').utilize}`);
    expect(dice.querySelector('.tool-craft')).toBeNull();

    // Unselected tools: no details, unchecked, no selected class.
    const bagpipes = cardFor('Bagpipes');
    expect(bagpipes).not.toHaveClass('selected');
    expect(bagpipes.querySelector('.tool-card-details')).toBeNull();
    expect(checkboxFor('Bagpipes').checked).toBe(false);
  });

  it('locks granted tools: pre-selected + selected renders checked+disabled and inert to clicks', async () => {
    const { props } = await renderStep({
      formData: { toolProficiencies: ["Cook's Utensils"] },
      preSelectedTools: ["Cook's Utensils"],
    });

    const cook = cardFor("Cook's Utensils");
    expect(cook).toHaveClass('selected', 'pre-selected');
    const locked = checkboxFor("Cook's Utensils");
    expect(locked.checked).toBe(true);
    expect(locked.disabled).toBe(true);

    fireEvent.click(locked);
    expect(props.onToolToggle).not.toHaveBeenCalled();

    // Only the granted tool is locked; all others stay toggleable.
    expect(document.querySelectorAll('input[type="checkbox"]:disabled')).toHaveLength(1);
    expect(checkboxFor('Forgery Kit').disabled).toBe(false);
  });

  it('calls onToolToggle with exactly the tool name when toggling on and off', async () => {
    const { props } = await renderStep({
      formData: { toolProficiencies: ['Dice Set'] },
    });

    fireEvent.click(checkboxFor('Bagpipes'));
    expect(props.onToolToggle).toHaveBeenCalledTimes(1);
    expect(props.onToolToggle).toHaveBeenCalledWith('Bagpipes');

    fireEvent.click(checkboxFor('Dice Set'));
    expect(props.onToolToggle).toHaveBeenCalledTimes(2);
    expect(props.onToolToggle).toHaveBeenLastCalledWith('Dice Set');
  });

  it('shows granted choice limits and exact selection counts in the rules panel, hidden until limits load', async () => {
    const { rerender } = await renderStep({ toolLimits: null });

    // useWizardConfig slot starts null -> no rules panel at all.
    expect(screen.queryByText(/Rules:/)).not.toBeInTheDocument();

    rerender(<WizardStepTools {...makeProps({
      toolLimits: BARD_SOLDIER_LIMITS({ preSelected: ["Cook's Utensils"] }),
      preSelectedTools: ["Cook's Utensils"],
      formData: { toolProficiencies: ["Cook's Utensils", 'Bagpipes', 'Dice Set'] },
    })} />);

    // Insertion order preserved in the choice sentence (background grant before class grant).
    expect(screen.getByText(/You may choose 1 Gaming Sets, 3 Musical Instrument\./)).toBeInTheDocument();
    expect(screen.getByText(/You have selected 3 tool proficiency\/ies \(1 pre-selected, 2 chosen\)/)).toBeInTheDocument();
  });

  it('shows the Skilled pool row only when skilledUsesAvailable > 0', async () => {
    const { rerender } = await renderStep();
    expect(screen.queryByText(/Skilled/)).not.toBeInTheDocument();

    rerender(<WizardStepTools {...makeProps({
      toolLimits: BARD_SOLDIER_LIMITS({ skilledUsesAvailable: 3 }),
      skillLimits: { skilledUsesUsed: 2 },
    })} />);
    expect(screen.getByText('Skilled')).toBeInTheDocument();
    expect(screen.getByText('2 of 3 uses used for tools')).toBeInTheDocument();
  });

  it('surfaces toolWarnings and field errors verbatim', async () => {
    await renderStep({
      toolWarnings: [{
        type: 'warning',
        message: 'You have selected 2 from Gaming Sets, but your class/background/feats only grant 1 proficiency/ies from Gaming Sets.',
      }],
      errors: { toolProficiencies: 'Tool proficiency error' },
    });

    expect(screen.getByText('You have selected 2 from Gaming Sets, but your class/background/feats only grant 1 proficiency/ies from Gaming Sets.')).toBeInTheDocument();
    expect(screen.getByText('Tool proficiency error')).toBeInTheDocument();
  });
});
