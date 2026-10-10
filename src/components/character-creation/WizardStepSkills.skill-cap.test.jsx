// Regression tests for FT-002: WizardStepSkills proficiency checkboxes
// previously let users check beyond the allowed cap (counter showed
// "3 of 2 allowed" and the over-cap selection persisted). The third
// checkbox must refuse to toggle on while at the cap, mirroring the
// expertise blockReason refusal flow in the same component.
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import WizardStepSkills from './WizardStepSkills.jsx';

vi.mock('../../services/ui/dataLoader.js', () => ({
  loadSkills: vi.fn(),
}));

import { loadSkills } from '../../services/ui/dataLoader.js';

const defaultSkillsData = [
  { name: 'Arcana', ability: 'Intelligence' },
  { name: 'History', ability: 'Intelligence' },
  { name: 'Religion', ability: 'Intelligence' },
];

const baseProps = {
  formData: {
    skillProficiencies: ['Arcana', 'History'],
    expertSkills: [],
  },
  errors: {},
  skillLimits: { allowed: 2, details: 'Choose 2 skills.' },
  expertiseLimits: null,
  preSelectedSkills: [],
  warnings: [],
  onSkillToggle: vi.fn(),
  onSkillExpertiseToggle: vi.fn(),
};

async function waitForSkillsLoaded() {
  await waitFor(() => {
    expect(document.querySelectorAll('.multi-select-item').length).toBeGreaterThan(0);
  });
}

function checkboxFor(container, name) {
  const label = Array.from(container.querySelectorAll('.multi-select-item'))
    .find(l => l.textContent.includes(name));
  return label.querySelector('input[type="checkbox"]');
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
  loadSkills.mockResolvedValue(defaultSkillsData);
});

describe('WizardStepSkills proficiency cap', () => {
  it('refuses to toggle on a third skill when at the allowed cap', async () => {
    const onSkillToggle = vi.fn();
    const { container } = render(<WizardStepSkills {...baseProps} onSkillToggle={onSkillToggle} />);
    await waitForSkillsLoaded();

    fireEvent.click(checkboxFor(container, 'Religion'));

    expect(onSkillToggle).not.toHaveBeenCalled();
    await waitFor(() => {
      const feedback = document.querySelector('.expertise-feedback');
      expect(feedback).toBeInTheDocument();
      expect(feedback).toHaveClass('error');
      expect(feedback.textContent).toContain('only select 2');
    });
  });

  it('allows toggling on a skill while below the cap', async () => {
    const onSkillToggle = vi.fn();
    const { container } = render(
      <WizardStepSkills
        {...baseProps}
        formData={{ skillProficiencies: ['Arcana'], expertSkills: [] }}
        onSkillToggle={onSkillToggle}
      />
    );
    await waitForSkillsLoaded();

    fireEvent.click(checkboxFor(container, 'History'));

    expect(onSkillToggle).toHaveBeenCalledWith('History');
    expect(document.querySelector('.expertise-feedback')).not.toBeInTheDocument();
  });

  it('allows toggling off a skill while at the cap', async () => {
    const onSkillToggle = vi.fn();
    const { container } = render(<WizardStepSkills {...baseProps} onSkillToggle={onSkillToggle} />);
    await waitForSkillsLoaded();

    fireEvent.click(checkboxFor(container, 'Arcana'));

    expect(onSkillToggle).toHaveBeenCalledWith('Arcana');
  });

  it('does not gate toggle-on when skillLimits is null (still loading)', async () => {
    const onSkillToggle = vi.fn();
    const { container } = render(
      <WizardStepSkills
        {...baseProps}
        skillLimits={null}
        formData={{ skillProficiencies: ['Arcana', 'History'], expertSkills: [] }}
        onSkillToggle={onSkillToggle}
      />
    );
    await waitForSkillsLoaded();

    fireEvent.click(checkboxFor(container, 'Religion'));

    expect(onSkillToggle).toHaveBeenCalledWith('Religion');
  });

  it('does not gate a pre-selected skill at the cap', async () => {
    const onSkillToggle = vi.fn();
    const { container } = render(
      <WizardStepSkills
        {...baseProps}
        preSelectedSkills={['Religion']}
        onSkillToggle={onSkillToggle}
      />
    );
    await waitForSkillsLoaded();

    fireEvent.click(checkboxFor(container, 'Religion'));

    expect(onSkillToggle).toHaveBeenCalledWith('Religion');
  });
});
