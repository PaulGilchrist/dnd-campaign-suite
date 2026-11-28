// @maintained-by-ai 2026-11-28
// Base lane for WizardStepSkills: disk-faithful skill rendering (names/abilities
// are a verified subset of public/data/ability-scores.json as loadSkills() derives
// { name, ability }), proficiency checkbox onChange payloads, expertise elevate/
// lower flows with all slot/list gating messages, and the feedback lifecycle.
// Proficiency CAP refusal (FT-002) is owned by WizardStepSkills.skill-cap.test.jsx
// — never restated here.
// #390/#391 contract note: elevating a NON-proficient skill is refused purely by
// the disabled Elevate button + its 'Select proficient first' tooltip — by design:
// the guard and the disabled attribute were born in the SAME commit (c45bdf94e) and
// cf74986e7 deliberately narrowed disabled to proficiency-only. The component's
// internal "Please select ... as proficient first" feedback branch was unreachable
// dead code and was REMOVED at #391 verdict-b. The disabled-inert test below is the
// single owner of the non-proficient button contract (glyph, title, inert click).
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import WizardStepSkills from './WizardStepSkills.jsx';

vi.mock('../../services/ui/dataLoader.js', () => ({
  loadSkills: vi.fn(),
}));

import { loadSkills } from '../../services/ui/dataLoader.js';

// Disk-faithful subset of ability-scores.json skills (DEX: Acrobatics, Stealth;
// WIS: Perception, Insight) in loadSkills' { name, ability } shape.
const SKILLS = [
  { name: 'Acrobatics', ability: 'Dexterity' },
  { name: 'Stealth', ability: 'Dexterity' },
  { name: 'Perception', ability: 'Wisdom' },
  { name: 'Insight', ability: 'Wisdom' },
];

function makeProps(overrides = {}) {
  return {
    stepNumber: 10,
    formData: { skillProficiencies: ['Acrobatics'], expertSkills: [] },
    errors: {},
    skillLimits: { allowed: 3, details: 'Your class and level grant 3 skills.' },
    expertiseLimits: { allowed: true, count: 2, classCount: 2, details: 'Rogues get expertise in 2 skills.' },
    preSelectedSkills: ['Stealth'],
    warnings: [],
    onSkillToggle: vi.fn(),
    onSkillExpertiseToggle: vi.fn(),
    ...overrides,
  };
}

async function renderStep(overrides = {}) {
  const props = makeProps(overrides);
  render(<WizardStepSkills {...props} />);
  await waitFor(() => {
    expect(screen.getAllByRole('checkbox')).toHaveLength(SKILLS.length);
  });
  return props;
}

// Accessible checkbox name is the wrapping label text ("Acrobatics Elevate", ...),
// so anchor with a prefix regex on the skill name.
const checkboxFor = (skill) => screen.getByRole('checkbox', { name: new RegExp(`^${skill}`) });

// The Elevate/✓ Expert button lives inside the same label as the checkbox.
const expertiseButtonFor = (skill) =>
  checkboxFor(skill).closest('label').querySelector('.expertise-toggle-btn');

beforeEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
  loadSkills.mockResolvedValue(SKILLS);
});

describe('WizardStepSkills', () => {
  describe('rendering', () => {
    it('renders header, rules, proficiency counter, and every loaded skill as a checkbox reflecting formData', async () => {
      await renderStep();

      expect(screen.getByRole('heading', { name: 'Step 10: Skill Proficiencies' })).toBeInTheDocument();
      expect(screen.getByText(/Your class and level grant 3 skills/)).toBeInTheDocument();
      expect(document.querySelector('.skill-count-text').textContent).toMatch(/selected 1 of 3/);

      expect(checkboxFor('Acrobatics')).toBeChecked();
      expect(checkboxFor('Stealth')).not.toBeChecked();
      expect(checkboxFor('Perception')).not.toBeChecked();
      expect(checkboxFor('Insight')).not.toBeChecked();
    });

    it('renders provided warnings and field errors', async () => {
      await renderStep({
        warnings: [{ type: 'warning', message: 'Warning message' }],
        errors: { skillProficiencies: 'Too many skills selected.' },
      });

      expect(screen.getByText('Warning message')).toBeInTheDocument();
      expect(screen.getByText('Too many skills selected.')).toBeInTheDocument();
    });

    it.each([
      ['skillLimits is null', { skillLimits: null }, [/You have selected/, /Your class and level grant/]],
      ['expertiseLimits is null', { expertiseLimits: null }, [/Expertise:/]],
      ['expertiseLimits.allowed is false', { expertiseLimits: { allowed: false, count: 0, details: 'No expertise available.' } }, [/Expertise:/]],
    ])('hides the limit section when %s', async (_case, overrides, absentPatterns) => {
      await renderStep(overrides);
      absentPatterns.forEach(pattern => {
        expect(screen.queryByText(pattern)).not.toBeInTheDocument();
      });
    });

    // The non-proficient (disabled 'Elevate' + 'Select proficient first') leg is
    // owned by the #391(b) disabled-inert test below — never restated here.
    it.each([
      {
        case: 'expert skill',
        formData: { skillProficiencies: ['Acrobatics'], expertSkills: ['Acrobatics'] },
        label: '✓ Expert',
        disabled: false,
        title: 'Click to remove Expert status',
        extra: () => {
          expect(screen.getByText('(Expert)')).toBeInTheDocument();
          expect(screen.getByText(/You have expertise in 1 of 2/)).toBeInTheDocument();
        },
      },
      {
        case: 'proficient non-expert skill',
        formData: { skillProficiencies: ['Acrobatics'], expertSkills: [] },
        label: 'Elevate',
        disabled: false,
        title: 'Click to elevate to Expert',
      },
    ])('renders expertise button and counter for $case', async ({ formData, label, disabled, title, extra }) => {
      await renderStep({ formData });

      const button = expertiseButtonFor('Acrobatics');
      expect(button).toHaveTextContent(label);
      expect(button.disabled).toBe(disabled);
      expect(button).toHaveAttribute('title', title);
      extra?.();
    });

    it('pins pre-selected skills: locked once proficient, still selectable while unselected', async () => {
      const { onSkillToggle } = await renderStep({
        formData: { skillProficiencies: ['Acrobatics', 'Stealth'], expertSkills: [] },
        preSelectedSkills: ['Stealth', 'Perception'],
      });

      const stealth = checkboxFor('Stealth');
      expect(stealth).toBeChecked();
      expect(stealth).toBeDisabled();

      // An unselected pre-selected skill stays live: a real click toggles it.
      const perception = checkboxFor('Perception');
      expect(perception).not.toBeChecked();
      expect(perception).not.toBeDisabled();
      fireEvent.click(perception);
      expect(onSkillToggle).toHaveBeenCalledTimes(1);
      expect(onSkillToggle).toHaveBeenCalledWith('Perception');
    });

    it('renders gracefully when no skills load and proficiency arrays are nullish', async () => {
      loadSkills.mockResolvedValue([]);
      render(<WizardStepSkills {...makeProps({ formData: { skillProficiencies: null, expertSkills: undefined } })} />);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Step 10: Skill Proficiencies' })).toBeInTheDocument();
      });
      expect(document.querySelector('.skill-count-text').textContent).toMatch(/selected 0 of 3/);
      expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
    });
  });

  describe('proficiency toggling', () => {
    it('calls onSkillToggle with the exact skill name on check and uncheck, and never touches expertise or feedback', async () => {
      const { onSkillToggle, onSkillExpertiseToggle } = await renderStep({
        preSelectedSkills: [],
        formData: { skillProficiencies: ['Acrobatics'], expertSkills: [] },
      });

      // Select an unselected skill.
      fireEvent.click(checkboxFor('Stealth'));
      expect(onSkillToggle).toHaveBeenCalledTimes(1);
      expect(onSkillToggle).toHaveBeenCalledWith('Stealth');

      // Deselect a selected non-expert skill.
      fireEvent.click(checkboxFor('Acrobatics'));
      expect(onSkillToggle).toHaveBeenCalledTimes(2);
      expect(onSkillToggle).toHaveBeenLastCalledWith('Acrobatics');

      expect(onSkillExpertiseToggle).not.toHaveBeenCalled();
      expect(document.querySelector('.expertise-feedback')).not.toBeInTheDocument();
    });

    it('also drops expertise when unchecking a skill that is proficient and expert', async () => {
      const { onSkillToggle, onSkillExpertiseToggle } = await renderStep({
        formData: { skillProficiencies: ['Acrobatics'], expertSkills: ['Acrobatics'] },
      });

      fireEvent.click(checkboxFor('Acrobatics'));

      expect(onSkillToggle).toHaveBeenCalledTimes(1);
      expect(onSkillToggle).toHaveBeenCalledWith('Acrobatics');
      expect(onSkillExpertiseToggle).toHaveBeenCalledTimes(1);
      expect(onSkillExpertiseToggle).toHaveBeenCalledWith('Acrobatics', false);
    });
  });

  describe('expertise elevation gating and feedback', () => {
    const scholarLimits = {
      allowed: true,
      count: 1,
      classCount: 1,
      featCount: 0,
      classExpertiseSkillLists: [['Acrobatics', 'Stealth']],
    };

    it.each([
      {
        case: 'elevates a proficient skill and shows success feedback',
        formData: { skillProficiencies: ['Acrobatics'], expertSkills: [] },
        skill: 'Acrobatics',
        called: true,
        feedback: /Acrobatics is now Expert!/,
      },
      {
        case: 'refuses a feat-restricted skill when no feat slots exist',
        formData: { skillProficiencies: ['Acrobatics'], expertSkills: [] },
        expertiseLimits: { allowed: true, count: 2, classCount: 2, featCount: 0, featExpertiseSkillLists: [['Acrobatics']] },
        skill: 'Acrobatics',
        called: false,
        feedback: /requires a feat expertise slot/,
      },
      {
        case: 'refuses a feat-restricted skill when all feat slots are used',
        formData: { skillProficiencies: ['Acrobatics', 'Stealth', 'Perception'], expertSkills: ['Acrobatics'] },
        expertiseLimits: { allowed: true, count: 2, classCount: 2, featCount: 1, featExpertiseSkillLists: [['Acrobatics', 'Perception']] },
        skill: 'Perception',
        called: false,
        feedback: /All feat expertise slots are used/,
      },
      {
        case: 'allows a feat-restricted skill when a feat slot is free',
        formData: { skillProficiencies: ['Acrobatics'], expertSkills: [] },
        expertiseLimits: { allowed: true, count: 2, classCount: 2, featCount: 1, featExpertiseSkillLists: [['Acrobatics']] },
        skill: 'Acrobatics',
        called: true,
        feedback: /Acrobatics is now Expert!/,
      },
      {
        case: 'refuses a skill outside the class expertise list',
        formData: { skillProficiencies: ['Acrobatics', 'Perception'], expertSkills: [] },
        expertiseLimits: scholarLimits,
        skill: 'Perception',
        called: false,
        feedback: /^Class expertise is limited to: Acrobatics, Stealth$/,
      },
      {
        case: 'allows a proficient skill inside the class expertise list',
        formData: { skillProficiencies: ['Acrobatics', 'Perception'], expertSkills: [] },
        expertiseLimits: scholarLimits,
        skill: 'Acrobatics',
        called: true,
        feedback: /Acrobatics is now Expert!/,
      },
      {
        case: 'count-gates in-list skills once class slots are exhausted',
        formData: { skillProficiencies: ['Acrobatics', 'Stealth'], expertSkills: ['Acrobatics'] },
        expertiseLimits: scholarLimits,
        skill: 'Stealth',
        called: false,
        feedback: /All class expertise slots are used/,
      },
      {
        case: 'falls back to a free feat slot when class slots are exhausted',
        formData: { skillProficiencies: ['Acrobatics', 'Stealth', 'Perception'], expertSkills: ['Acrobatics', 'Stealth'] },
        expertiseLimits: { allowed: true, count: 2, classCount: 2, featCount: 1 },
        skill: 'Perception',
        called: true,
        feedback: /Perception is now Expert!/,
      },
      {
        case: 'refuses when the class grants no expertise slots at all',
        formData: { skillProficiencies: ['Acrobatics'], expertSkills: [] },
        expertiseLimits: { allowed: true, count: 0, classCount: 0, featCount: 0 },
        skill: 'Acrobatics',
        called: false,
        feedback: /does not grant expertise slots/,
      },
      {
        case: 'applies no list gating when classExpertiseSkillLists is absent',
        formData: { skillProficiencies: ['Acrobatics', 'Perception'], expertSkills: [] },
        expertiseLimits: { allowed: true, count: 1, classCount: 1, featCount: 0 },
        skill: 'Perception',
        called: true,
        feedback: /Perception is now Expert!/,
      },
    ])('$case', async ({ formData, expertiseLimits, skill, called, feedback }) => {
      const { onSkillExpertiseToggle } = await renderStep(
        expertiseLimits ? { formData, expertiseLimits } : { formData },
      );

      const button = expertiseButtonFor(skill);
      expect(button).not.toBeDisabled();
      fireEvent.click(button);

      if (called) {
        expect(onSkillExpertiseToggle).toHaveBeenCalledWith(skill, true);
      } else {
        expect(onSkillExpertiseToggle).not.toHaveBeenCalled();
      }
      const box = document.querySelector('.expertise-feedback');
      expect(box).toBeInTheDocument();
      // success/error is the only channel distinguishing the styling of the two
      // message branches (message.includes('Expert')), so this pin is load-bearing.
      expect(box).toHaveClass(called ? 'success' : 'error');
      expect(box.textContent).toMatch(feedback);
    });

    it('#391(b) non-proficient Elevate is disabled-inert while a proficient row stays live (mutual pair)', async () => {
      const { onSkillExpertiseToggle } = await renderStep({
        formData: { skillProficiencies: ['Acrobatics'], expertSkills: [] },
      });

      // Non-proficient row: disabled control + tooltip IS the designed feedback.
      const insight = expertiseButtonFor('Insight');
      expect(insight.disabled).toBe(true);
      expect(insight).toHaveTextContent('Elevate');
      expect(insight).toHaveAttribute('title', 'Select proficient first');

      // React suppresses onClick on disabled buttons (verified by probe), so even a
      // dispatched click is inert: no toggle, no feedback box, no removed-branch bytes.
      fireEvent.click(insight);
      expect(onSkillExpertiseToggle).not.toHaveBeenCalled();
      expect(document.querySelector('.expertise-feedback')).not.toBeInTheDocument();
      expect(screen.queryByText(/as proficient first/i)).not.toBeInTheDocument();
      expect(insight.disabled).toBe(true);

      // Mutually distinguishable #1348: proficient row in the same render is live.
      const acrobatics = expertiseButtonFor('Acrobatics');
      expect(acrobatics.disabled).toBe(false);
      expect(acrobatics).toHaveAttribute('title', 'Click to elevate to Expert');
      fireEvent.click(acrobatics);
      expect(onSkillExpertiseToggle).toHaveBeenCalledWith('Acrobatics', true);
      const box = document.querySelector('.expertise-feedback');
      expect(box).toHaveClass('success');
      expect(box.textContent).toBe('Acrobatics is now Expert!');
    });

    it('#391(b) Elevate enables the moment the skill becomes proficient, then elevates', async () => {
      const props = makeProps({ formData: { skillProficiencies: [], expertSkills: [] } });
      const { rerender } = render(<WizardStepSkills {...props} />);
      await waitFor(() => expect(screen.getAllByRole('checkbox')).toHaveLength(SKILLS.length));

      const before = expertiseButtonFor('Perception');
      expect(before.disabled).toBe(true);
      fireEvent.click(before);
      expect(props.onSkillExpertiseToggle).not.toHaveBeenCalled();

      rerender(<WizardStepSkills {...props} formData={{ skillProficiencies: ['Perception'], expertSkills: [] }} />);
      const after = expertiseButtonFor('Perception');
      expect(after.disabled).toBe(false);
      expect(after).toHaveAttribute('title', 'Click to elevate to Expert');
      fireEvent.click(after);
      expect(props.onSkillExpertiseToggle).toHaveBeenCalledWith('Perception', true);
      const box = document.querySelector('.expertise-feedback');
      expect(box).toHaveClass('success');
      expect(box.textContent).toBe('Perception is now Expert!');
    });

    it('removes expertise immediately and shows no feedback when deselecting an expert skill', async () => {
      const { onSkillExpertiseToggle } = await renderStep({
        formData: { skillProficiencies: ['Acrobatics', 'Stealth'], expertSkills: ['Acrobatics'] },
      });

      const button = expertiseButtonFor('Acrobatics');
      expect(button).toHaveTextContent('✓ Expert');
      fireEvent.click(button);

      expect(onSkillExpertiseToggle).toHaveBeenCalledTimes(1);
      expect(onSkillExpertiseToggle).toHaveBeenCalledWith('Acrobatics', false);
      expect(document.querySelector('.expertise-feedback')).not.toBeInTheDocument();
    });

    it('auto-dismisses feedback 3 seconds after elevating to Expert', async () => {
      vi.useFakeTimers();
      try {
        const props = makeProps({ formData: { skillProficiencies: ['Acrobatics'], expertSkills: [] } });
        await act(async () => {
          render(<WizardStepSkills {...props} />);
          // Flush the loadSkills microtask/pending timers so the list renders.
          await vi.runOnlyPendingTimersAsync();
        });

        await act(async () => {
          fireEvent.click(expertiseButtonFor('Acrobatics'));
        });
        expect(screen.getByText(/Acrobatics is now Expert!/)).toBeInTheDocument();

        await act(async () => {
          // Advance past the 3-second setTimeout that dismisses feedback.
          await vi.advanceTimersByTimeAsync(3001);
        });
        expect(document.querySelector('.expertise-feedback')).not.toBeInTheDocument();
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('skill limits breakdown', () => {
    it.each([
      {
        case: 'with skillChoiceSources: per-source breakdown shown, generic details suppressed',
        skillLimits: {
          allowed: 5,
          details: 'This should not appear.',
          skillChoiceSources: [
            { source: 'class', count: 3, skills: ['Acrobatics', 'Stealth', 'Perception'] },
            { source: 'feat', featName: 'Skilled', count: 1, skills: ['Acrobatics', 'Stealth', 'Perception', 'Insight'] },
          ],
        },
        formData: { skillProficiencies: ['Acrobatics', 'Insight'], expertSkills: [] },
        expectLabels: ['Class: 1 of 3', 'Skilled: 1 of 1'],
        absentDetails: 'This should not appear.',
      },
      {
        case: 'without skillChoiceSources: generic details shown, no breakdown',
        skillLimits: { allowed: 3, details: 'Your class grants 3 skills.' },
        formData: { skillProficiencies: ['Acrobatics'], expertSkills: [] },
        expectLabels: null,
        presentDetails: 'Your class grants 3 skills.',
      },
      {
        case: 'Skilled uses tracker shown when skilledUsesAvailable > 0',
        skillLimits: {
          allowed: 3,
          skilledUsesAvailable: 2,
          skilledUsesUsed: 1,
          skillChoiceSources: [
            { source: 'class', count: 2, skills: ['Acrobatics', 'Stealth', 'Perception'] },
          ],
        },
        formData: { skillProficiencies: ['Stealth'], expertSkills: [] },
        expectLabels: ['Class: 1 of 2', 'Skilled: 1 of 2'],
      },
    ])('$case', async ({ skillLimits, formData, expectLabels, absentDetails, presentDetails }) => {
      await renderStep({ skillLimits, formData });

      const ruleInfo = document.querySelector('.rule-info');
      if (expectLabels) {
        const labels = Array.from(document.querySelectorAll('.breakdown-source-label')).map(el => el.textContent);
        expectLabels.forEach(label => expect(labels).toContain(label));
        if (absentDetails) {
          expect(ruleInfo.textContent).not.toContain(absentDetails);
        }
      } else {
        expect(document.querySelector('.breakdown-source')).not.toBeInTheDocument();
        expect(ruleInfo.textContent).toContain(presentDetails);
      }
    });
  });
});
