// @maintained-by-ai
/**
 * CappedRows overflow disclosure (backlog RG 2026-11-19): the "+N more" fold
 * used to be a dead <span> — with a spell-heavy draft a REMOVED spell name
 * (Chromatic Orb) and its drop reason were never disclosed. Pinned here:
 * the fold is a real <button> with aria-expanded, activation reveals every
 * folded row's name AND its drop reason, re-activation restores the capped
 * face, group counts are untouched, and at-or-under-cap groups render no
 * affordance at all.
 *
 * The keep/drop CLASSIFICATION is pinned in rulesetSwitchPreview.test.js and
 * the wizard seam in CharacterCreationWizard.ruleset-switch.test.jsx — this
 * file renders the modal directly over a preview shaped exactly like
 * classifyRulesetSwitch's output (the RG live spell-draft ledger: 7 spells,
 * cap 6, Chromatic Orb folded).
 */
import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import RulesetSwitchConfirmModal from './RulesetSwitchConfirmModal.jsx';
import { NAME_LIST_VISIBLE_CAP } from '../../services/character/rulesetSwitchPreview.js';

// Spell-draft scenario from the live RG run: kept+dropped merge into ONE
// capped list per group, so the 7th row (Chromatic Orb, dropped) folds.
const SPELL_KEPT = ['Fire Bolt', 'Mage Hand', 'Prestidigitation', 'Shield', 'Magic Missile'];
const SPELL_DROPPED = [
  { name: 'Blade Ward', reason: 'missing', detail: 'not in the 5th Edition (5e) spell data' },
  { name: 'Chromatic Orb', reason: 'missing', detail: 'not in the 5th Edition (5e) spell data' },
];

function makePreview(spells = { kept: SPELL_KEPT, dropped: SPELL_DROPPED }) {
  return {
    targetRuleset: '5e',
    targetDataLoaded: true,
    keptCount: spells.kept.length + 1,
    droppedCount: spells.dropped.length,
    hasSelections: true,
    className: 'Wizard',
    spells: { selected: [...spells.kept, ...spells.dropped.map(r => r.name)], ...spells },
    feats: { selected: ['Alert'], kept: ['Alert'], dropped: [] },
    background: {
      selected: ['Guard'],
      kept: null,
      dropped: [{ name: 'Guard', reason: 'ruleset-unsupported', detail: 'the Background step only exists under 2024 Rules' }],
    },
  };
}

function renderModal(preview = makePreview()) {
  return render(
    <RulesetSwitchConfirmModal preview={preview} onCancel={vi.fn()} onConfirm={vi.fn()} />
  );
}

const spellGroup = () => {
  const groups = Array.from(document.querySelectorAll('.ruleset-switch-group'));
  return groups.find(el => el.textContent.includes('Spells'));
};

const rowNames = (group) =>
  Array.from(group.querySelectorAll('.ruleset-switch-name')).map(el => el.textContent);

describe('RulesetSwitchConfirmModal — CappedRows overflow disclosure', () => {
  it('default face is capped: cap rows visible, folded row absent, fold is an aria-expanded=false BUTTON', () => {
    renderModal();
    const group = spellGroup();
    expect(rowNames(group)).toHaveLength(NAME_LIST_VISIBLE_CAP);
    expect(rowNames(group)).not.toContain('Chromatic Orb');
    // No dead span remains — the only .ruleset-switch-more is the button.
    expect(group.querySelectorAll('span.ruleset-switch-more')).toHaveLength(0);

    const fold = within(group).getByRole('button', { name: '+1 more spell' });
    expect(fold.tagName).toBe('BUTTON');
    expect(fold).toHaveAttribute('aria-expanded', 'false');
    expect(group.textContent).toContain('5 kept, 2 removed');
  });

  it('activating the fold reveals the hidden spell name AND its drop reason; counts unchanged', () => {
    renderModal();
    const group = spellGroup();
    fireEvent.click(within(group).getByRole('button', { name: '+1 more spell' }));

    expect(rowNames(group)).toContain('Chromatic Orb');
    // The revealed row carries name AND the classifier's honest reason.
    const orbRow = Array.from(group.querySelectorAll('.ruleset-switch-row'))
      .find(el => el.textContent.includes('Chromatic Orb'));
    expect(orbRow).toBeTruthy();
    expect(orbRow.textContent).toContain('not in the 5th Edition (5e) spell data');
    // aria-expanded reflects the open state; label flips to the collapse idiom.
    expect(within(group).getByRole('button', { name: 'Show less' }))
      .toHaveAttribute('aria-expanded', 'true');
    // Group arithmetic never moved.
    expect(group.textContent).toContain('5 kept, 2 removed');
  });

  it('re-activating collapses back to the exact capped face (folded name hidden again)', () => {
    renderModal();
    const group = spellGroup();
    fireEvent.click(within(group).getByRole('button', { name: '+1 more spell' }));
    expect(rowNames(group)).toContain('Chromatic Orb');

    fireEvent.click(within(group).getByRole('button', { name: 'Show less' }));
    expect(rowNames(group)).toHaveLength(NAME_LIST_VISIBLE_CAP);
    expect(rowNames(group)).not.toContain('Chromatic Orb');
    expect(within(group).getByRole('button', { name: '+1 more spell' }))
      .toHaveAttribute('aria-expanded', 'false');
  });

  it('keyboard activation (focus + Enter) expands the fold without a mouse click', async () => {
    const user = userEvent.setup();
    renderModal();
    const group = spellGroup();
    const fold = within(group).getByRole('button', { name: '+1 more spell' });
    // The fold is the body's first control, so the modal's initial-focus lane
    // lands a keyboard user straight on it — no mouse needed.
    expect(document.activeElement).toBe(fold);
    await user.keyboard('{Enter}');
    expect(rowNames(group)).toContain('Chromatic Orb');
    expect(fold).toHaveAttribute('aria-expanded', 'true');
  });

  it('groups at or under the cap render no overflow affordance at all', () => {
    const preview = makePreview({
      kept: ['Fire Bolt', 'Mage Hand'],
      dropped: [{ name: 'Blade Ward', reason: 'missing', detail: 'not in the 5th Edition (5e) spell data' }],
    });
    renderModal(preview);
    const group = spellGroup();
    expect(within(group).queryByRole('button', { name: /more|Show less/i })).not.toBeInTheDocument();
    expect(group.querySelector('.ruleset-switch-more')).toBeNull();
    // Feats group (1 kept row) and Background group (1 dropped row) too:
    // only the over-cap spell scenario above ever renders a fold.
    expect(document.querySelectorAll('button.ruleset-switch-more')).toHaveLength(0);
    // The dialog itself is still mounted (Cancel/confirm lanes untouched).
    expect(screen.getByRole('button', { name: 'Yes, switch ruleset' })).toBeInTheDocument();
  });
});
