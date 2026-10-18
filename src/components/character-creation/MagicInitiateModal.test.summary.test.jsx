// @maintained-by-ai
// Summary slice only: instance summary-row content (exact numbered rows, spell
// tags, — / "No class" placeholders, Remove-when->1 rule, Save All presence).
// Add/edit/remove click routing lives in .test.core; gates in -validation;
// persistence in -save. Empty-state render contract lives in .test.core.
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MagicInitiateModal, createProps } from './MagicInitiateModal.test-utils.js';

vi.mock('../../services/ui/sanitize.js', () => ({
  renderMarkdown: vi.fn((md) => `<p>${md}</p>`),
}));

const wizard = { class: 'Wizard', cantrips: ['Acid Splash', 'Chill Touch'], level1Spell: 'Burning Hands' };
const bardWithGap = { class: 'Bard', cantrips: ['Dancing Lights', null], level1Spell: 'Bless' };
const blankInstance = { class: '', cantrips: [null, null], level1Spell: null };

describe('MagicInitiateModal summary rendering', () => {
  it.each([
    {
      title: 'no instances: no rows, no Save All',
      instances: [],
      rows: [],
      spells: [],
      dashes: 0,
      editButtons: 0,
      removeButtons: 0,
      saveAll: false,
    },
    {
      title: 'single instance: Remove hidden, Save All shown',
      instances: [wizard],
      rows: ['Instance 1: Wizard'],
      spells: ['Acid Splash', 'Chill Touch', 'Burning Hands'],
      dashes: 0,
      editButtons: 1,
      removeButtons: 0,
      saveAll: true,
    },
    {
      title: 'multiple instances: exact numbered rows in order, Remove per row',
      instances: [wizard, bardWithGap],
      rows: ['Instance 1: Wizard', 'Instance 2: Bard'],
      spells: ['Acid Splash', 'Chill Touch', 'Burning Hands', 'Dancing Lights', 'Bless'],
      dashes: 1,
      editButtons: 2,
      removeButtons: 2,
      saveAll: true,
    },
    {
      title: 'missing selections: "No class" row and em-dash placeholders',
      instances: [blankInstance],
      rows: ['Instance 1: No class'],
      spells: [],
      dashes: 3,
      editButtons: 1,
      removeButtons: 0,
      saveAll: true,
    },
  ])('renders $title', ({ instances, rows, spells, dashes, editButtons, removeButtons, saveAll }) => {
    const props = createProps({
      formData: { magicInitiateInstances: instances, spells: [] },
    });
    render(<MagicInitiateModal {...props} />);

    expect(screen.queryAllByText(/^Instance \d+: /).map(el => el.textContent)).toEqual(rows);
    spells.forEach(spell => expect(screen.getByText(spell)).toBeInTheDocument());
    expect(screen.queryAllByText('—')).toHaveLength(dashes);
    expect(screen.queryAllByRole('button', { name: 'Edit' })).toHaveLength(editButtons);
    expect(screen.queryAllByRole('button', { name: 'Remove' })).toHaveLength(removeButtons);
    if (saveAll) {
      expect(screen.getByRole('button', { name: 'Save All' })).toBeInTheDocument();
    } else {
      expect(screen.queryByRole('button', { name: 'Save All' })).not.toBeInTheDocument();
    }
  });
});
