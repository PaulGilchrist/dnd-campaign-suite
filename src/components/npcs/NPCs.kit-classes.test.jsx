// @maintained-by-ai
//
// .ct-* design-kit convergence (tranche 3): the NPCs view chrome rides the
// shared App.css kit. The view arrived ALREADY container-rooted (the
// zero-ct-* census was stale, tranche-2 lesson) — OWNED HERE are the pieces
// that were genuinely bespoke or dead-kit:
//   - the row's Add-to-Initiative chip rides .ct-btn .ct-btn-sm; its bespoke
//     .npcs-init-btn skin (link-tinted fill + opacity-dim disabled) is GONE
//     from NPCs.css — the class token survives on the element as a locator
//     hook only (referenced by Sessions quick-action comments);
//   - the kit's .ct-btn-sm tier MOVED to App.css — NPCs.css must never own a
//     global kit class again (bare 0-1-0 rule = dead under the base tier);
//   - the NPC stat editor widens via the compound tier .ct-container
//     .ct-modal.npcs-modal (the retired bare .npcs-modal rule was dead code);
//   - the 409 "Reload list" recovery button rides ct-btn ct-btn-sm.
// Behaviour pins (save/delete gates, bestiary-name guard, SSE sync) stay in
// the sibling test files — do not duplicate them here.

import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockUseNPCsManagement = vi.fn();

vi.mock('../../hooks/useEntityManagement.js', () => ({
  useEntityManagement: (...args) => mockUseNPCsManagement(...args),
}));

const mockSaveNPC = vi.fn();
vi.mock('../../services/npcs/npcsService.js', () => ({
  loadNPCs: vi.fn(),
  saveNPC: (...args) => mockSaveNPC(...args),
  saveNPCs: vi.fn(),
  deleteNPC: vi.fn(),
}));

// Keep the real name-set OUT of the kit probes: the gate's behaviour matrix is
// pinned in NPCs.bestiary-name.test.jsx; here the gate just stays inert.
vi.mock('../../services/npcs/bestiaryNameGuard.js', () => ({
  loadBestiaryMonsterNames: vi.fn(async () => null),
  isBestiaryMonsterName: () => false,
  bestiaryNameError: () => null,
}));

vi.mock('../../services/npcs/npcGenerator.js', () => ({
  generateNPC: vi.fn(),
}));

vi.mock('../../services/npcs/npcCombatService.js', () => ({
  addNPCToInitiative: vi.fn(),
}));

// The footer's AiRefineButton owns refineEntity; stub the transport lane so
// no kit probe ever reaches the network (SessionPlannerModal.test idiom).
vi.mock('../../services/ai/aiClient.js', () => ({
  getAiStatus: vi.fn(async () => ({ configured: true })),
  refineEntity: vi.fn(),
}));

import NPCs from './NPCs.jsx';
import NPCFormModal from './NPCFormModal.jsx';
import { getDefaultFormData } from '../../services/npcs/npcFormUtils.js';

const combatReadyNPC = {
  name: 'Gandalf',
  armorClass: 15,
  hitPoints: '30',
  actions: [{ name: 'Mace', attack_bonus: '+4' }],
};

function renderNPCs(npcs = [combatReadyNPC]) {
  mockUseNPCsManagement.mockReturnValue({
    items: npcs,
    loading: false,
    loadItems: vi.fn(),
    deleteItem: vi.fn(),
  });
  return render(<NPCs campaignName="test-campaign" onViewInitiative={vi.fn()} />);
}

const conflictCopy =
  'NPC "Gandalf" was modified in another tab or session since you loaded it — reload the list and re-apply your edit — it was NOT saved.';

function renderFormModal(props = {}) {
  return render(
    <NPCFormModal
      formData={getDefaultFormData({ name: 'Gandalf' })}
      setFormData={vi.fn()}
      editingNPC={{ name: 'Gandalf' }}
      campaignName="test-campaign"
      saving={false}
      deleting={false}
      disabled={false}
      onClose={vi.fn()}
      onReloadList={vi.fn()}
      onSave={vi.fn()}
      onDelete={vi.fn()}
      onSaveAndAddToInitiative={vi.fn()}
      {...props}
    />
  );
}

describe('NPCs .ct-* kit classes (tranche 3 convergence)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('view root carries the kit scoping container and the toolbar rides the button tiers', () => {
    const { container } = renderNPCs();
    expect(container.querySelector('.ct-container')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /New NPC/ })).toHaveClass('ct-new-btn');
    expect(screen.getByRole('button', { name: /Generate NPC/ })).toHaveClass('ct-generate-btn');
    expect(screen.getByRole('textbox', { name: /Search NPCs/ })).toHaveClass('ct-search-input');
  });

  it('the row Add-to-Initiative chip rides ct-btn ct-btn-sm beside its locator token', () => {
    renderNPCs();
    const chip = screen.getByRole('button', { name: 'Add Gandalf to Initiative' });
    expect(chip).toHaveClass('npcs-init-btn', 'ct-btn', 'ct-btn-sm');
    // Byte-pinned DOM contract survived the convergence untouched.
    expect(chip).toHaveAttribute('title', 'Add Gandalf to Initiative');
  });

  it('the statless row keeps its disabled gate and refusal copy', () => {
    renderNPCs([{ name: 'Marta', armorClass: undefined, hitPoints: null, actions: [] }]);
    const chip = screen.getByRole('button', {
      name: "Fill in Marta's AC and HP (Stats tab) before adding to Initiative",
    });
    expect(chip).toHaveClass('npcs-init-btn', 'ct-btn', 'ct-btn-sm');
    expect(chip).toBeDisabled();
  });

  it('loading and empty faces ride ct-empty-state', () => {
    mockUseNPCsManagement.mockReturnValue({
      items: [], loading: true, loadItems: vi.fn(), deleteItem: vi.fn(),
    });
    const { rerender } = render(<NPCs campaignName="test-campaign" onViewInitiative={vi.fn()} />);
    expect(document.querySelector('.ct-empty-state')).toBeInTheDocument();
    mockUseNPCsManagement.mockReturnValue({
      items: [], loading: false, loadItems: vi.fn(), deleteItem: vi.fn(),
    });
    rerender(<NPCs campaignName="test-campaign" onViewInitiative={vi.fn()} />);
    const empty = document.querySelector('.ct-empty-state');
    expect(empty).toHaveTextContent('No NPCs yet.');
  });

  it('modal chrome rides the ct-modal tiers and the footer keeps the variant hierarchy', () => {
    const { container } = renderFormModal();
    expect(container.querySelector('.ct-modal-overlay .ct-modal.npcs-modal')).toBeInTheDocument();
    expect(container.querySelector('.ct-modal-header .ct-modal-close')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Save/ })).toHaveClass('ct-btn', 'ct-btn-primary');
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveClass('ct-btn');
    expect(screen.getByRole('button', { name: /Delete/ })).toHaveClass('ct-btn', 'ct-btn-danger');
    // Avatar controls ride the compact tier.
    expect(screen.getByText(/Upload Avatar/)).toHaveClass('ct-btn', 'ct-btn-sm');
  });

  it('the 409 Reload list recovery button rides the compact kit tier', () => {
    renderFormModal({ error: conflictCopy, errorConflict: true });
    const reload = screen.getByRole('button', { name: /Reload list/ });
    expect(reload).toHaveClass('ct-btn', 'ct-btn-sm', 'npcs-error-reload-btn');
    expect(screen.getByText(conflictCopy)).toBeInTheDocument();
  });

  it('retired bespoke rules are removed from NPCs.css', async () => {
    const { readFileSync } = await import('node:fs');
    const { join, dirname } = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const css = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), 'NPCs.css'),
      'utf-8'
    ).replace(/\/\*[\s\S]*?\*\//g, '');
    // Line-anchored so the surviving kit-comound re-anchors
    // (`.ct-container .npcs-init-btn`, `.ct-container .ct-modal.npcs-modal`)
    // cannot false-match the retired bare rules.
    for (const retired of [
      /^\s*\.npcs-init-btn\s*\{/m,
      /\.npcs-init-btn:hover/,
      /\.npcs-init-btn:disabled/,
      /^\s*\.npcs-modal\s*\{/m,
      /^\s*\.ct-btn-sm\s*\{/m,
    ]) {
      expect(css, `retired rule ${retired} must not come back`).not.toMatch(retired);
    }
    // Surviving kit-compound re-anchors: lane intent, kit-owned properties only.
    expect(css).toMatch(/\.ct-container \.ct-modal\.npcs-modal\s*{/);
    expect(css).toMatch(/\.ct-container \.npcs-init-btn\s*{/);
    // The error-reload lane rule keeps placement only — no dead padding.
    const reloadBlock = css.match(/\.npcs-error-reload-btn\s*{([^}]*)}/);
    expect(reloadBlock, 'placement rule must survive').not.toBeNull();
    expect(reloadBlock[1]).not.toContain('padding');
  });
});
