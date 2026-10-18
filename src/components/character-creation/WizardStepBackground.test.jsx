// @maintained-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import WizardStepBackground from './WizardStepBackground.jsx';

// Disk-faithful to public/data/2024/backgrounds.json (16 entries; subset used here)
const acolyte = {
  index: 'acolyte',
  name: 'Acolyte',
  description: 'You devoted yourself to service in a temple, either nestled in a town or secluded in a sacred grove. There you performed rites in honor of a god or pantheos. You served under a priest and studied religion. Thanks to your priest\'s instruction and your own devotion, you also learned how to channel a modicu1n of divine poweer, in service to your place of worship and the people who prayed there.',
  ability_scores: 'Intelligence, Wisdom, Charisma',
  feat: 'Magic Initiate',
  skill_proficiencies: 'Insight and Religion',
  tool_proficiencies: 'Calligrapher\'s Supplies',
};
const soldier = {
  index: 'soldier',
  name: 'Soldier',
  description: 'You began training for war as soon as you reached adulthood and carry precious few me1nories of life before you took up arms. Battle is in your blood. Sometimes you catch yourself reflexively performing the basic fighting exercises you learned first. Eventually, you put that training to use on the battlefield, protecting the realm by waging war.',
  ability_scores: 'Strength, Dexterity, Constitution',
  feat: 'Savage Attacker',
  skill_proficiencies: 'Athletics and Intimidation',
  tool_proficiencies: 'Choose one kind of Gaming Set',
};
// Synthetic: every disk background defines feat/skills/tools, so this sparse
// fixture exists solely to exercise the component's optional-field guards.
const sparse = {
  index: 'clan-crafter',
  name: 'Clan Crafter',
  description: 'You trained with a guild of craftspeople, honing patience and precision.',
  ability_scores: 'Constitution, Intelligence',
};
const testBackgrounds = [acolyte, soldier, sparse];

function createProps(overrides = {}) {
  return {
    stepNumber: 5,
    formData: { background: '' },
    errors: {},
    backgrounds: testBackgrounds,
    ruleset: '2024',
    onInputChange: vi.fn(),
    ...overrides,
  };
}

describe('WizardStepBackground', () => {
  describe('background selection', () => {
    it.each([
      ['nothing selected', '', ''],
      ['a background preselected', 'Soldier', 'Soldier'],
    ])('renders exact option list with %s', (_label, selected, expectedValue) => {
      render(<WizardStepBackground {...createProps({ formData: { background: selected } })} />);
      expect(screen.getByText('Background *')).toBeInTheDocument();
      const select = screen.getByRole('combobox');
      expect(select).toHaveValue(expectedValue);
      expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([
        'Select a background', 'Acolyte', 'Soldier', 'Clan Crafter',
      ]);
      // Step-5 validation ("Background is required") is owned by utils.validateStep
      // and its own test; this component only renders errors passed to it.
      expect(screen.queryByText('Background is required')).not.toBeInTheDocument();
    });

    it.each([
      ['selecting', '', 'Soldier'],
      ['deselecting', 'Acolyte', ''],
    ])('onInputChange receives exact (key, value) when %s', (_label, initial, next) => {
      const props = createProps({ formData: { background: initial } });
      render(<WizardStepBackground {...props} />);
      fireEvent.change(screen.getByRole('combobox'), { target: { value: next } });
      expect(props.onInputChange).toHaveBeenCalledWith('background', next);
    });

    it('renders a passed-down validation error beside the select', () => {
      render(<WizardStepBackground {...createProps({ errors: { background: 'Background is required' } })} />);
      expect(screen.getByText('Background is required')).toBeInTheDocument();
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });
  });

  describe('detail card', () => {
    it('starts collapsed, expands via header click, collapses via toggle button', () => {
      render(<WizardStepBackground {...createProps({ formData: { background: 'Acolyte' } })} />);
      expect(screen.getByText('Acolyte Details')).toBeInTheDocument();
      expect(screen.queryByText('Description')).not.toBeInTheDocument();

      fireEvent.click(screen.getByText('Acolyte Details'));
      expect(screen.getByRole('button', { name: 'Hide Details' })).toBeInTheDocument();
      expect(screen.getByText(acolyte.description)).toBeInTheDocument();
      expect(screen.getByText('Ability Scores')).toBeInTheDocument();
      expect(screen.getByText(acolyte.ability_scores)).toBeInTheDocument();
      expect(screen.getByText('Feat')).toBeInTheDocument();
      expect(screen.getByText(acolyte.feat)).toBeInTheDocument();
      expect(screen.getByText('Skill Proficiencies')).toBeInTheDocument();
      expect(screen.getByText(acolyte.skill_proficiencies)).toBeInTheDocument();
      expect(screen.getByText('Tool Proficiencies')).toBeInTheDocument();
      expect(screen.getByText(acolyte.tool_proficiencies)).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Hide Details' }));
      expect(screen.queryByText('Description')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Show Details' })).toBeInTheDocument();
    });

    it('omits detail sections for fields the background lacks', () => {
      render(<WizardStepBackground {...createProps({ formData: { background: 'Clan Crafter' } })} />);
      fireEvent.click(screen.getByText('Clan Crafter Details'));
      expect(screen.getByText('Description')).toBeInTheDocument();
      expect(screen.getByText('Ability Scores')).toBeInTheDocument();
      expect(screen.queryByText('Feat')).not.toBeInTheDocument();
      expect(screen.queryByText('Skill Proficiencies')).not.toBeInTheDocument();
      expect(screen.queryByText('Tool Proficiencies')).not.toBeInTheDocument();
    });
  });

  describe('early return paths', () => {
    it.each([
      ['5e ruleset', { ruleset: '5e' }, 'Backgrounds are only available for 2024 (Essentials) ruleset characters. For 5e characters, backgrounds are purely narrative and do not grant mechanical benefits.'],
      ['backgrounds not loaded', { backgrounds: [] }, 'Background data not yet loaded. Please try again.'],
    ])('%s: notice replaces the selection UI and errors stay hidden', (_label, overrides, notice) => {
      render(<WizardStepBackground {...createProps({ ...overrides, errors: { background: 'Background is required' } })} />);
      expect(screen.getByText(notice)).toBeInTheDocument();
      expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
      expect(screen.queryByText('Background is required')).not.toBeInTheDocument();
    });
  });
});
