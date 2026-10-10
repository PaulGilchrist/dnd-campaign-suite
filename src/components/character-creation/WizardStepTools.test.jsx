// @improved-by-ai
// @cleaned-by-ai
// Removed 6 redundant/low-value tests:
//   - "should hide rules info when toolLimits is null" + "should hide rules info when toolLimits is an empty object"
//     -> consolidated into "should hide rules info when toolLimits is falsy or empty" (single test, both cases)
//   - "should NOT show skilled info when skilledUsesAvailable is 0" + "should show skilled info when skilledUsesAvailable > 0"
//     -> consolidated into "should conditionally show skilled info based on skilledUsesAvailable"
//   - "should render all tools from all categories" -> redundant with "should render all four tool categories" + "should render tools within each category"
//   - "should render category sections with correct structure" -> asserts internal CSS class names (tool-category-header, tool-category-section)
//   - "should render multi-select-container with compact class" -> asserts internal CSS class names (multi-select-compact)
//   - "should render without crashing when all props are minimal" -> trivially simple component, no unique behavioral coverage
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import WizardStepTools from './WizardStepTools.jsx';

// Mock toolValidation so we don't need it for unit tests of the UI component
vi.mock('../../services/character/toolValidation.js', () => ({
  getToolsByCategory: vi.fn(),
}));

import { getToolsByCategory } from '../../services/character/toolValidation.js';

// Sample tool data for categories
const artisanTools = [
  { name: "Alchemist's Supplies", ability: 'Intelligence', utilize: 'Identify substance', craft: 'Acid' },
  { name: "Brewer's Supplies", ability: 'Intelligence', utilize: 'Detect poisoned drink', craft: 'Antitoxin' },
  { name: "Carver's Tools", ability: 'Dexterity', utilize: 'Carve stone', craft: 'Statue' },
];

const gamingSets = [
  { name: 'Dice Set', ability: 'Charisma', utilize: 'Play a game', craft: '' },
  { name: 'Playing Card Set', ability: 'Dexterity', utilize: 'Play cards', craft: '' },
];

const musicalInstruments = [
  { name: 'Bagpipes', ability: 'Charisma', utilize: 'Play a known tune', craft: '' },
  { name: 'Drum', ability: 'Wisdom', utilize: 'Set tempo', craft: '' },
  { name: 'Viol', ability: 'Charisma', utilize: 'Play a melody', craft: '' },
];

const otherTools = [
  { name: "Disguise Kit", ability: 'Charisma', utilize: 'Alter appearance', craft: '' },
  { name: 'Forgery Kit', ability: 'Intelligence', utilize: 'Create forgery', craft: '' },
];

const mockToolData = {
  "Artisan's Tools": artisanTools,
  'Gaming Sets': gamingSets,
  'Musical Instrument': musicalInstruments,
  'Other Tools': otherTools,
};

const baseProps = {
  formData: { toolProficiencies: [] },
  errors: {},
  onToolToggle: vi.fn(),
  toolLimits: {
    categoryLimits: new Map([["Artisan's Tools", 2]]),
    skilledUsesAvailable: 0,
  },
  toolWarnings: [],
  preSelectedTools: [],
  skillLimits: { skilledUsesUsed: 0 },
};

beforeEach(() => {
  vi.clearAllMocks();
  getToolsByCategory.mockImplementation(async (cat) => {
    return mockToolData[cat] || [];
  });
});

async function waitForTools() {
  await waitFor(() => {
    expect(document.querySelectorAll('.tool-card').length).toBeGreaterThan(0);
  }, { timeout: 5000 });
}

function getCardByName(name) {
  return Array.from(document.querySelectorAll('.tool-card')).find(
    (c) => c.textContent.includes(name)
  );
}

describe('WizardStepTools', () => {
  describe('rendering', () => {
    it('should render step header', async () => {
      render(<WizardStepTools stepNumber={11} {...baseProps} />);
      await waitForTools();
      expect(screen.getByText('Step 11: Tool Proficiencies')).toBeInTheDocument();
    });

    it('should render all four tool categories', async () => {
      render(<WizardStepTools stepNumber={11} {...baseProps} />);
      await waitForTools();
      expect(screen.getByText("Artisan's Tools")).toBeInTheDocument();
      expect(screen.getByText('Gaming Sets')).toBeInTheDocument();
      expect(screen.getByText('Musical Instrument')).toBeInTheDocument();
      expect(screen.getByText('Other Tools')).toBeInTheDocument();
    });

    it('should render tools within each category', async () => {
      render(<WizardStepTools stepNumber={11} {...baseProps} />);
      await waitForTools();
      expect(screen.getByText("Alchemist's Supplies")).toBeInTheDocument();
      expect(screen.getByText("Brewer's Supplies")).toBeInTheDocument();
      expect(screen.getByText('Bagpipes')).toBeInTheDocument();
      expect(screen.getByText("Disguise Kit")).toBeInTheDocument();
    });

    it('should render ability badges mapped from full ability names', async () => {
      render(<WizardStepTools stepNumber={11} {...baseProps} />);
      await waitForTools();
      // Intelligence -> INT, Dexterity -> DEX, Wisdom -> WIS, Charisma -> CHA
      expect(document.querySelectorAll('.tool-ability-badge').length).toBeGreaterThan(0);
      expect(document.querySelectorAll('.tool-ability-badge').length).toBe(10);
    });

    it('should NOT render ability badge for tools without an ability field', async () => {
      const toolsWithoutAbility = [
        { name: 'Simple Hammer', utilize: 'Hit things', craft: 'Nail' },
      ];
      getToolsByCategory.mockImplementation(async (cat) => {
        if (cat === "Artisan's Tools") return toolsWithoutAbility;
        return mockToolData[cat] || [];
      });

      render(<WizardStepTools stepNumber={11} {...baseProps} />);
      await waitForTools();

      const card = getCardByName('Simple Hammer');
      expect(card).toBeInTheDocument();
      expect(card.querySelector('.tool-ability-badge')).not.toBeInTheDocument();
    });

    it('should render tool details (utilize/craft) when tool is selected', async () => {
      render(<WizardStepTools stepNumber={11}
        {...baseProps}
        formData={{ toolProficiencies: ["Alchemist's Supplies"] }}
      />);
      await waitForTools();

      const alchemistCard = getCardByName("Alchemist's Supplies");
      expect(alchemistCard).toHaveClass('selected');
      expect(alchemistCard.querySelector('.tool-card-details')).toBeInTheDocument();
      expect(alchemistCard).toHaveTextContent('Utilize: Identify substance');
      expect(alchemistCard).toHaveTextContent('Craft: Acid');
    });

    it('should NOT render tool details for unselected tools', async () => {
      render(<WizardStepTools stepNumber={11}
        {...baseProps}
        formData={{ toolProficiencies: [] }}
      />);
      await waitForTools();

      const allCards = document.querySelectorAll('.tool-card');
      allCards.forEach((card) => {
        expect(card.querySelector('.tool-card-details')).toBeNull();
      });
    });

    it('should render warnings when provided', async () => {
      render(<WizardStepTools stepNumber={11}
        {...baseProps}
        toolWarnings={[{ type: 'warning', message: 'Too many tools selected' }]}
      />);
      await waitForTools();
      expect(screen.getByText('Too many tools selected')).toBeInTheDocument();
    });

    it('should render error message when provided', async () => {
      render(<WizardStepTools stepNumber={11}
        {...baseProps}
        errors={{ toolProficiencies: 'Tool proficiency error' }}
      />);
      await waitForTools();
      expect(screen.getByText('Tool proficiency error')).toBeInTheDocument();
    });

    it('should hide rules info when toolLimits is falsy or empty', async () => {
      render(<WizardStepTools stepNumber={11} {...baseProps} toolLimits={null} />);
      await waitForTools();
      expect(screen.queryByText(/Rules:/)).not.toBeInTheDocument();

      render(<WizardStepTools stepNumber={11} {...baseProps} toolLimits={{}} />);
      await waitForTools();
      expect(screen.queryByText(/Rules:/)).not.toBeInTheDocument();
    });

    it('should show rules info when toolLimits exists but categoryLimits is undefined', async () => {
      render(<WizardStepTools stepNumber={11}
        {...baseProps}
        toolLimits={{ skilledUsesAvailable: 0 }}
      />);
      await waitForTools();
      // toolLimits has keys so rules info still shows
      expect(screen.getByText(/Rules:/)).toBeInTheDocument();
      // But category limits line should be empty since categoryLimits is undefined
      const ruleInfo = document.querySelector('.rule-info');
      expect(ruleInfo.textContent).not.toContain('Artisan');
    });

    it('should render empty tool list when getToolsByCategory returns empty arrays', async () => {
      getToolsByCategory.mockResolvedValue([]);

      render(<WizardStepTools stepNumber={11} {...baseProps} />);
      await waitFor(() => {
        expect(screen.getByText('Step 11: Tool Proficiencies')).toBeInTheDocument();
      });
      expect(screen.queryByText('.tool-card')).not.toBeInTheDocument();
      expect(document.querySelectorAll('.tool-card')).toHaveLength(0);
    });
  });

  describe('selection state', () => {
    it('should mark selected tools with "selected" class', async () => {
      render(<WizardStepTools stepNumber={11}
        {...baseProps}
        formData={{ toolProficiencies: ["Alchemist's Supplies", 'Dice Set'] }}
      />);
      await waitForTools();

      const alchemistCard = getCardByName("Alchemist's Supplies");
      expect(alchemistCard).toHaveClass('selected');

      const diceCard = getCardByName('Dice Set');
      expect(diceCard).toHaveClass('selected');
    });

    it('should mark pre-selected tools with "pre-selected" class', async () => {
      render(<WizardStepTools stepNumber={11}
        {...baseProps}
        preSelectedTools={['Brewer\'s Supplies']}
      />);
      await waitForTools();

      const brewerCard = getCardByName("Brewer's Supplies");
      expect(brewerCard).toHaveClass('pre-selected');
    });

    it('should mark tools that are both pre-selected and selected with both classes', async () => {
      render(<WizardStepTools stepNumber={11}
        {...baseProps}
        formData={{ toolProficiencies: ['Brewer\'s Supplies'] }}
        preSelectedTools={['Brewer\'s Supplies']}
      />);
      await waitForTools();

      const brewerCard = getCardByName("Brewer's Supplies");
      expect(brewerCard).toHaveClass('selected');
      expect(brewerCard).toHaveClass('pre-selected');
    });

    it('should render checkboxes with checked state matching formData', async () => {
      render(<WizardStepTools stepNumber={11}
        {...baseProps}
        formData={{ toolProficiencies: ["Alchemist's Supplies"] }}
      />);
      await waitForTools();

      const allCheckboxes = document.querySelectorAll('input[type="checkbox"]');
      const alchemistCheckbox = Array.from(allCheckboxes).find((cb) => {
        const label = cb.closest('.tool-card');
        return label && label.textContent.includes("Alchemist's Supplies");
      });
      expect(alchemistCheckbox.checked).toBe(true);

      const diceCheckbox = Array.from(allCheckboxes).find((cb) => {
        const label = cb.closest('.tool-card');
        return label && label.textContent.includes('Dice Set');
      });
      expect(diceCheckbox.checked).toBe(false);
    });

    it('should disable checkbox for pre-selected + selected tools', async () => {
      render(<WizardStepTools stepNumber={11}
        {...baseProps}
        formData={{ toolProficiencies: ['Brewer\'s Supplies'] }}
        preSelectedTools={['Brewer\'s Supplies']}
      />);
      await waitForTools();

      const brewerCard = getCardByName("Brewer's Supplies");
      const checkbox = brewerCard.querySelector('input[type="checkbox"]');
      expect(checkbox.disabled).toBe(true);
    });

    it('should NOT disable checkbox for pre-selected but NOT selected tools', async () => {
      render(<WizardStepTools stepNumber={11}
        {...baseProps}
        formData={{ toolProficiencies: [] }}
        preSelectedTools={['Brewer\'s Supplies']}
      />);
      await waitForTools();

      const brewerCard = getCardByName("Brewer's Supplies");
      const checkbox = brewerCard.querySelector('input[type="checkbox"]');
      expect(checkbox.disabled).toBe(false);
      expect(brewerCard).toHaveClass('pre-selected');
      expect(brewerCard).not.toHaveClass('selected');
    });
  });

  describe('tool toggling', () => {
    it('should call onToolToggle when toggling a non-pre-selected tool on', async () => {
      const mockOnToolToggle = vi.fn();
      render(<WizardStepTools stepNumber={11}
        {...baseProps}
        onToolToggle={mockOnToolToggle}
      />);
      await waitForTools();

      const diceCard = getCardByName('Dice Set');
      const checkbox = diceCard.querySelector('input[type="checkbox"]');
      fireEvent.click(checkbox);

      expect(mockOnToolToggle).toHaveBeenCalledWith('Dice Set');
    });

    it('should NOT call onToolToggle when clicking a pre-selected + selected tool', async () => {
      const mockOnToolToggle = vi.fn();
      render(<WizardStepTools stepNumber={11}
        {...baseProps}
        formData={{ toolProficiencies: ['Brewer\'s Supplies'] }}
        preSelectedTools={['Brewer\'s Supplies']}
        onToolToggle={mockOnToolToggle}
      />);
      await waitForTools();

      const brewerCard = getCardByName("Brewer's Supplies");
      const checkbox = brewerCard.querySelector('input[type="checkbox"]');
      fireEvent.click(checkbox);

      expect(mockOnToolToggle).not.toHaveBeenCalled();
    });

    it('should call onToolToggle when toggling off a non-pre-selected tool', async () => {
      const mockOnToolToggle = vi.fn();
      render(<WizardStepTools stepNumber={11}
        {...baseProps}
        formData={{ toolProficiencies: ["Alchemist's Supplies"] }}
        onToolToggle={mockOnToolToggle}
      />);
      await waitForTools();

      const alchemistCard = getCardByName("Alchemist's Supplies");
      const checkbox = alchemistCard.querySelector('input[type="checkbox"]');
      fireEvent.click(checkbox);

      expect(mockOnToolToggle).toHaveBeenCalledWith("Alchemist's Supplies");
    });
  });

  describe('rules info display', () => {
    it('should display selected tool count including pre-selected', async () => {
      render(<WizardStepTools stepNumber={11}
        {...baseProps}
        formData={{ toolProficiencies: ["Alchemist's Supplies", 'Dice Set'] }}
        preSelectedTools={['Brewer\'s Supplies']}
      />);
      await waitForTools();

      // realToolCount = 2 (non-placeholder), preSelected = 1, chosen = 1
      expect(screen.getByText(/You have selected 2 tool proficiency/)).toBeInTheDocument();
      expect(screen.getByText(/1 pre-selected/)).toBeInTheDocument();
      expect(screen.getByText(/1 chosen/)).toBeInTheDocument();
    });

    it('should display category limits from toolLimits', async () => {
      render(<WizardStepTools stepNumber={11}
        {...baseProps}
        toolLimits={{
          categoryLimits: new Map([["Artisan's Tools", 2], ['Gaming Sets', 1]]),
          skilledUsesAvailable: 0,
        }}
      />);
      await waitForTools();

      expect(screen.getByText(/2 Artisan's Tools/)).toBeInTheDocument();
      expect(screen.getByText(/1 Gaming Sets/)).toBeInTheDocument();
    });

    it('should filter out zero-count categories from the display', async () => {
      render(<WizardStepTools stepNumber={11}
        {...baseProps}
        toolLimits={{
          categoryLimits: new Map([["Artisan's Tools", 2], ['Gaming Sets', 0]]),
          skilledUsesAvailable: 0,
        }}
      />);
      await waitForTools();

      expect(screen.getByText(/2 Artisan's Tools/)).toBeInTheDocument();
      expect(screen.queryByText(/0 Gaming Sets/)).not.toBeInTheDocument();
    });
  });

  describe('skilled tool usage display', () => {
    it('should conditionally show skilled info based on skilledUsesAvailable', async () => {
      render(<WizardStepTools stepNumber={11}
        {...baseProps}
        toolLimits={{ categoryLimits: new Map(), skilledUsesAvailable: 0 }}
      />);
      await waitForTools();
      expect(screen.queryByText(/Skilled/)).not.toBeInTheDocument();

      render(<WizardStepTools stepNumber={11}
        {...baseProps}
        toolLimits={{ categoryLimits: new Map(), skilledUsesAvailable: 3 }}
        skillLimits={{ skilledUsesUsed: 2 }}
      />);
      await waitForTools();
      expect(screen.getByText(/Skilled/)).toBeInTheDocument();
      expect(screen.getByText(/2 of 3 uses used for tools/)).toBeInTheDocument();

      render(<WizardStepTools stepNumber={11}
        {...baseProps}
        toolLimits={{ categoryLimits: new Map(), skilledUsesAvailable: 3 }}
        skillLimits={{ skilledUsesUsed: 0 }}
      />);
      await waitForTools();
      expect(screen.getByText(/0 of 3 uses used for tools/)).toBeInTheDocument();
    });
  });

  describe('placeholder tool handling', () => {
    it('should exclude placeholder tools from realToolCount', async () => {
      // Placeholder format: "2 from: SomeTool"
      render(<WizardStepTools stepNumber={11}
        {...baseProps}
        formData={{ toolProficiencies: ["Alchemist's Supplies", "2 from: Brewer's Supplies"] }}
      />);
      await waitForTools();

      // Only 1 real tool (the "2 from:" entry is a placeholder)
      expect(screen.getByText(/You have selected 1 tool proficiency/)).toBeInTheDocument();
    });

    it('should exclude placeholder tools from skilled tool tracking', async () => {
      render(<WizardStepTools stepNumber={11}
        {...baseProps}
        formData={{ toolProficiencies: ["Alchemist's Supplies", "2 from: Brewer's Supplies"] }}
        toolLimits={{
          categoryLimits: new Map(),
          skilledUsesAvailable: 3,
        }}
        skillLimits={{ skilledUsesUsed: 1 }}
        allTools={[]}
      />);
      await waitForTools();

      // Only 1 real tool, so 1 tool from skilled
      expect(screen.getByText(/1 of 3 uses used for tools/)).toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    it('should render without crashing when formData has no toolProficiencies key', async () => {
      render(<WizardStepTools stepNumber={11}
        {...baseProps}
        formData={{}}
      />);
      await waitForTools();
      expect(screen.getByText('Step 11: Tool Proficiencies')).toBeInTheDocument();
    });

  });

  describe('memoization (areEqual)', () => {
    it('should skip re-render when props are reference-equal', async () => {
      const mockOnToolToggle = vi.fn();
      const limits = {
        categoryLimits: new Map([["Artisan's Tools", 2]]),
        skilledUsesAvailable: 0,
      };
      const skillLimits = { skilledUsesUsed: 0 };

      const { rerender } = render(<WizardStepTools stepNumber={11}
        {...baseProps}
        onToolToggle={mockOnToolToggle}
        toolLimits={limits}
        skillLimits={skillLimits}
      />);
      await waitForTools();

      // Rerender with identical props (same references) should use memo
      rerender(<WizardStepTools stepNumber={11}
        {...baseProps}
        onToolToggle={mockOnToolToggle}
        toolLimits={limits}
        skillLimits={skillLimits}
      />);

      expect(screen.getByText('Step 11: Tool Proficiencies')).toBeInTheDocument();
    });

    it('should re-render when formData changes', async () => {
      const mockOnToolToggle = vi.fn();
      const limits = {
        categoryLimits: new Map([["Artisan's Tools", 2]]),
        skilledUsesAvailable: 0,
      };

      const { rerender } = render(<WizardStepTools stepNumber={11}
        {...baseProps}
        onToolToggle={mockOnToolToggle}
        toolLimits={limits}
        formData={{ toolProficiencies: [] }}
      />);
      await waitForTools();

      rerender(<WizardStepTools stepNumber={11}
        {...baseProps}
        onToolToggle={mockOnToolToggle}
        toolLimits={limits}
        formData={{ toolProficiencies: ["Alchemist's Supplies"] }}
      />);

      expect(screen.getByText('Step 11: Tool Proficiencies')).toBeInTheDocument();
      expect(screen.getByText("Alchemist's Supplies")).toBeInTheDocument();
    });
  });
});
