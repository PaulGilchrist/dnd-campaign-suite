// @maintained-by-ai
/* Lane: NPC editor AI refine payload (bug-ai-refine-npc-form-preflight-dead).
 * Raw editor formData always carries the GM-owned avatar upload trio and
 * string-typed HP/AC; npcSchema is additionalProperties:false with
 * integer-typed stats, so EVERY editor-sourced refine was dead at the
 * server preflight before the model was ever called. The footer must project
 * the authored-row shape — and the proposal must land in the FORM only
 * (never-write), merging so the avatar fields survive for the later Save. */
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import NPCFormModal from './NPCFormModal.jsx';
import { getDefaultFormData, projectNPCForRefine } from '../../services/npcs/npcFormUtils.js';
import { refineEntity } from '../../services/ai/aiClient.js';

vi.mock('../../services/ai/aiClient.js', () => ({
  refineEntity: vi.fn(),
}));

const DIRTY_ROW = {
  name: 'Marta Copperkettle',
  image: 'data:image/png;base64,abc',
  imageName: 'marta.png',
  imagePath: 'images/Marta Copperkettle.png',
  armorClass: '15',
  hitPoints: '45',
  initiativeBonus: '+2',
  updatedAt: 1793124887756,
};

function renderEditor(formOverrides = {}) {
  const formData = getDefaultFormData({ ...DIRTY_ROW, ...formOverrides });
  const setFormData = vi.fn();
  render(
    <NPCFormModal
      formData={formData}
      setFormData={setFormData}
      editingNPC={{ name: formData.name }}
      campaignName="test-campaign"
      onClose={vi.fn()}
      onSave={vi.fn()}
      onDelete={vi.fn()}
    />
  );
  return { formData, setFormData };
}

const openRefineAndAsk = async (instruction) => {
  fireEvent.click(screen.getByRole('button', { name: /refine with AI/i }));
  fireEvent.change(screen.getByPlaceholderText(/what should change/i), { target: { value: instruction } });
  fireEvent.click(screen.getByRole('button', { name: /apply to form/i }));
  await waitFor(() => expect(refineEntity).toHaveBeenCalled());
};

beforeEach(() => {
  refineEntity.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('NPCFormModal AI refine (authored-row projection)', () => {
  it('sends a schema-clean entity: no image/imageName/imagePath, numeric stats coerced to integers', async () => {
    renderEditor();
    refineEntity.mockResolvedValue({ ok: false, errors: ['stopped after payload probe'] });
    await openRefineAndAsk('give her a nervous habit');

    const sent = refineEntity.mock.calls[0][0];
    expect(sent.campaignName).toBe('test-campaign');
    expect(sent.kind).toBe('npc');
    expect(sent.instruction).toBe('give her a nervous habit');

    const entity = sent.entity;
    expect(entity).not.toHaveProperty('image');
    expect(entity).not.toHaveProperty('imageName');
    expect(entity).not.toHaveProperty('imagePath');
    // Numeric-string stats arrive as integers (schema: integer|null).
    expect(entity.hitPoints).toBe(45);
    expect(entity.armorClass).toBe(15);
    // initiativeBonus is schema-STRING — left untouched, not int-coerced.
    expect(entity.initiativeBonus).toBe('+2');
    expect(entity.name).toBe('Marta Copperkettle');
  });

  it('maps a blank HP field to null instead of an empty string', async () => {
    renderEditor({ hitPoints: '', armorClass: null });
    refineEntity.mockResolvedValue({ ok: false, errors: ['stopped after payload probe'] });
    await openRefineAndAsk('warmer speech');

    const entity = refineEntity.mock.calls[0][0].entity;
    expect(entity.hitPoints).toBeNull();
    expect(entity.armorClass).toBeNull();
  });

  it('drops the proposal into the form WITHOUT writing and keeps the GM-owned avatar fields', async () => {
    const { setFormData } = renderEditor();
    refineEntity.mockResolvedValue({
      ok: true,
      replacement: {
        name: 'Marta Copperkettle',
        personality: 'Bites her nails when the door chimes.',
      },
    });
    await openRefineAndAsk('give her one nervous habit');

    // Proposal applied via a functional update (form-only — Save stays the
    // only write lane; no CRUD service is even mounted here).
    const [updater] = setFormData.mock.calls.at(-1);
    expect(typeof updater).toBe('function');
    const applied = updater(getDefaultFormData(DIRTY_ROW));
    expect(applied.personality).toBe('Bites her nails when the door chimes.');
    // Merge, not replace: the schema-clean proposal carries no upload trio
    // or stamp — those must survive on the form for the next Save.
    expect(applied.imagePath).toBe('images/Marta Copperkettle.png');
    expect(applied.image).toBe('data:image/png;base64,abc');
    expect(applied.updatedAt).toBe(1793124887756);
  });

  it('surfaces preflight/schema errors in the .ai-refine-error strip, form untouched', async () => {
    const { setFormData } = renderEditor();
    refineEntity.mockResolvedValue({ ok: false, errors: ['hitPoints must be a integer or a null'] });
    await openRefineAndAsk('anything');

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('hitPoints must be a integer or a null');
    // Failed proposal: the editor form never moved (instruction text is
    // AiRefineButton-local state, so setFormData is not touched at all).
    expect(setFormData).not.toHaveBeenCalled();
  });
});

describe('projectNPCForRefine', () => {
  it('is a pure projection: input form state is not mutated', () => {
    const form = getDefaultFormData(DIRTY_ROW);
    const before = JSON.stringify(form);
    const projected = projectNPCForRefine(form);
    expect(JSON.stringify(form)).toBe(before);
    expect(projected).not.toHaveProperty('image');
    expect(projected.hitPoints).toBe(45);
  });

  it('nulls non-numeric HP loudly (console.error, no silent fallback)', () => {
    const projected = projectNPCForRefine(getDefaultFormData({ name: 'Grog', hitPoints: 'plenty' }));
    expect(projected.hitPoints).toBeNull();
    expect(console.error).toHaveBeenCalled();
  });
});
