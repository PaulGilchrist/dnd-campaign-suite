// @maintained-by-ai
// FT-002 regression lane: skill-proficiency cap enforcement in
// WizardStepSkills — over-cap selections must be refused at the checkbox
// (previously the counter showed "3 of 2 allowed" and the over-cap
// selection persisted). The component keeps over-cap checkboxes clickable
// and refuses via onChange feedback, mirroring the expertise blockReason
// flow (WizardStepSkills.jsx getProficiencyCapBlockReason).
// Fixtures verified verbatim against disk: public/data/classes.json Wizard
// proficiency_choices "choose: 2" and public/data/ability-scores.json
// (Arcana, History, Religion → Intelligence — the { name, ability } shape
// loadSkills produces). Generic skills rendering/toggle/expertise lanes
// live in WizardStepSkills.test.jsx.
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import WizardStepSkills from './WizardStepSkills.jsx';

vi.mock('../../services/ui/dataLoader.js', () => {
  return { loadSkills: vi.fn() };
});

import { loadSkills } from '../../services/ui/dataLoader.js';

const wizardSkillsFixture = [
  { name: 'Arcana', ability: 'Intelligence' },
  { name: 'History', ability: 'Intelligence' },
  { name: 'Religion', ability: 'Intelligence' },
];

// Wizard cap from public/data/classes.json: proficiency_choices choose 2.
const ALLOWED = 2;

function makeProps(overrides = {}) {
  return {
    stepNumber: 10,
    formData: { skillProficiencies: ['Arcana', 'History'], expertSkills: [] },
    errors: {},
    skillLimits: { allowed: ALLOWED, details: 'Choose 2 skills.' },
    expertiseLimits: null,
    preSelectedSkills: [],
    warnings: [],
    onSkillToggle: vi.fn(),
    onSkillExpertiseToggle: vi.fn(),
    ...overrides,
  };
}

async function renderStep(overrides) {
  const props = makeProps(overrides);
  render(<WizardStepSkills {...props} />);
  await waitFor(() => {
    expect(screen.getAllByRole('checkbox')).toHaveLength(wizardSkillsFixture.length);
  });
  return props;
}

// Accessible name is the wrapping label's text ("History Elevate", ...),
// so anchor with a prefix regex on the skill name.
const checkboxFor = (skill) => screen.getByRole('checkbox', { name: new RegExp(`^${skill}`) });

beforeEach(() => {
  vi.clearAllMocks();
  loadSkills.mockResolvedValue(wizardSkillsFixture);
});

describe('WizardStepSkills proficiency cap', () => {
  it('refuses to check a third skill at the cap: no handler call, stays unchecked, refusal shown', async () => {
    const { onSkillToggle } = await renderStep();
    const religionCheckbox = checkboxFor('Religion');

    fireEvent.click(religionCheckbox);

    expect(onSkillToggle).not.toHaveBeenCalled();
    expect(religionCheckbox).not.toBeChecked();

    const feedback = document.querySelector('.expertise-feedback');
    expect(feedback).toBeInTheDocument();
    expect(feedback).toHaveClass('error');
    expect(feedback).toHaveTextContent(
      `You can only select ${ALLOWED} allowed skill proficiency/ies. Deselect one first.`
    );
    // FT-002: the counter must never report more selected than allowed.
    expect(document.querySelector('.skill-count-text').textContent).toMatch(/selected 2 of 2/);
  });

  it.each([
    ['below the cap', { formData: { skillProficiencies: ['Arcana'], expertSkills: [] } }, 'History'],
    ['to deselect a skill at the cap', {}, 'Arcana'],
    ['when skillLimits is null (still loading)', { skillLimits: null }, 'Religion'],
    ['for a pre-selected skill at the cap', { preSelectedSkills: ['Religion'] }, 'Religion'],
  ])('calls onSkillToggle when toggling %s', async (_case, overrides, skill) => {
    const { onSkillToggle } = await renderStep(overrides);

    fireEvent.click(checkboxFor(skill));

    expect(onSkillToggle).toHaveBeenCalledTimes(1);
    expect(onSkillToggle).toHaveBeenCalledWith(skill);
    expect(document.querySelector('.expertise-feedback')).not.toBeInTheDocument();
  });
});
