// @maintained-by-ai
//
// .ct-* design-kit convergence (tranche 4, FINAL): the Music view arrived as
// DEAD KIT — .ct-header/.ct-title on the root with no .ct-container ancestor
// (playbook §5 law 1), every action button on the bespoke .music-btn tier.
// Owned here:
//   - the root IS the kit container now (ct-header/ct-title finally style);
//   - toolbar/action buttons ride the kit hierarchy (transport Play/Pause/
//     Stop, add-category +, edit-pencil on .ct-btn .ct-btn-sm; editor and
//     create-form actions on base/-primary/-danger; the custom-category × on
//     -danger), with the pinned titles/aria preserved ALONGSIDE;
//   - the PINNED tiers are re-pinned untouched: .music-mood-btn chips, the
//     SFX mute + Sound Owner audio-settings buttons (.music-btn), the
//     editor's icon-picker internals, and the DeleteConfirmModal shells.
// Behaviour pins (transport chrome, discard confirms, save intents) stay in
// the sibling test files — do not duplicate them here. Harness mirrors
// MusicPlayer.custom-categories.test.jsx.

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import MusicPlayer from './MusicPlayer.jsx';
import { getStore } from '../../hooks/runtime/useRuntimeState.js';

vi.mock('../../services/ui/youtubePlayer.js', () => ({
  ensurePlayer: vi.fn(),
  playTracks: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  stop: vi.fn(),
  setVolume: vi.fn(),
  dispose: vi.fn(),
}));

vi.mock('../../services/ui/logService.js', () => ({
  getLog: vi.fn().mockResolvedValue([]),
  addEntry: vi.fn().mockResolvedValue({}),
}));

function stubMusicServer(initialMusic) {
  let server = {
    mood: null, playing: false, volume: 0.6, overrides: {}, customCategories: {},
    ...(initialMusic || {}),
  };
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, opts = {}) => {
    if (opts.method === 'POST' && String(url).endsWith('/music')) {
      const body = JSON.parse(opts.body);
      const incoming = 'value' in body ? body.value : body;
      server = { ...server, ...incoming };
      return { ok: true, status: 200, json: async () => ({ music: server, message: 'Music saved successfully' }) };
    }
    return { ok: true, status: 200, json: async () => ({}), text: async () => '' };
  });
}

function mount(initialMusic) {
  stubMusicServer(initialMusic);
  getStore('campaign').set('music', {
    mood: null, playing: false, volume: 0.6, overrides: {}, customCategories: {},
    ...(initialMusic || {}),
  });
  return render(<MusicPlayer campaignName="test-campaign" />);
}

beforeEach(() => {
  getStore('campaign').set('soundOwner', null);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Music .ct-* kit classes (tranche 4 convergence)', () => {
  it('the view root is the kit container and its header tier finally has scope', () => {
    const { container } = mount();
    expect(container.querySelector('.music-player.ct-container > .ct-header > .ct-title')).toBeInTheDocument();
  });

  it('transport + add-category + edit-pencil ride the compact kit tier with their pinned titles/aria intact', () => {
    mount({ mood: 'town', playing: true });
    const pause = screen.getByTitle('Pause');
    const stop = screen.getByTitle('Stop');
    expect(pause).toHaveClass('ct-btn', 'ct-btn-sm');
    expect(stop).toHaveClass('ct-btn', 'ct-btn-sm');
    // Icon glyphs unchanged (transport-chrome law): kit class never swaps the face.
    expect(pause.querySelector('i')).toHaveClass('fa-pause');
    expect(stop.querySelector('i')).toHaveClass('fa-stop');
    const add = screen.getByTitle('Add music category');
    expect(add).toHaveClass('ct-btn', 'ct-btn-sm');
    expect(add).toHaveAttribute('aria-label', 'Add music category');
    const pencil = screen.getByTitle('Edit tracks for this mood');
    expect(pencil).toHaveClass('ct-btn', 'ct-btn-sm');
    expect(pencil).toHaveAttribute('aria-label', 'Edit tracks for this mood');
  });

  it('PINNED music controls stay off the kit tiers: mood chips, SFX toggle, Sound Owner', () => {
    mount({ mood: 'town', playing: true });
    const chip = screen.getByTitle('Play Town ambience');
    expect(chip).toHaveClass('music-mood-btn');
    expect(chip).not.toHaveClass('ct-btn');
    const sfx = screen.getByTitle('Mute sound effects');
    expect(sfx).toHaveClass('music-btn');
    expect(sfx).not.toHaveClass('ct-btn');
    const owner = screen.getByRole('button', { name: /Sound screen/ });
    expect(owner).toHaveClass('music-btn');
    expect(owner).not.toHaveClass('ct-btn');
  });

  it('track-editor actions ride the hierarchy (primary/danger/plain) and the scoped [title] locator survives', () => {
    mount({ customCategories: { 'custom-crypt': { label: 'Crypt', icon: 'fa-skull' } } });
    fireEvent.click(screen.getByTitle('Edit tracks for this mood'));
    const moodSelect = screen.getByLabelText('Tracks mood');
    // Built-in face (Town): Save + Reset + Cancel.
    fireEvent.change(moodSelect, { target: { value: 'town' } });
    expect(screen.getByText('Save')).toHaveClass('ct-btn', 'ct-btn-primary');
    expect(screen.getByTitle('Restore starter tracks')).toHaveClass('ct-btn');
    expect(screen.getByText('Cancel')).toHaveClass('ct-btn');
    // Custom face (Crypt): Delete replaces Reset on the danger tier.
    fireEvent.change(moodSelect, { target: { value: 'custom-crypt' } });
    const del = document.querySelector('.music-editor-actions [title="Delete Crypt category"]');
    expect(del).not.toBeNull();
    expect(del).toHaveClass('ct-btn', 'ct-btn-danger');
  });

  it('create-category form actions ride the kit tiers; the icon-picker internals keep their pinned lane skin', () => {
    mount();
    fireEvent.click(screen.getByTitle('Add music category'));
    expect(screen.getByText('Create')).toHaveClass('ct-btn', 'ct-btn-primary');
    expect(screen.getByText('Cancel')).toHaveClass('ct-btn');
    const picker = document.querySelector('.music-category-form .music-icon-btn');
    expect(picker).toHaveClass('music-btn');
    expect(picker).not.toHaveClass('ct-btn');
  });

  it('the custom-category × rides the kit danger tier with title AND aria preserved', () => {
    mount({ customCategories: { 'custom-crypt': { label: 'Crypt', icon: 'fa-skull' } } });
    const x = screen.getByTitle('Delete Crypt category');
    expect(x).toHaveClass('ct-btn', 'ct-btn-danger', 'ct-btn-sm');
    expect(x).toHaveAttribute('aria-label', 'Delete Crypt category');
    expect(x.querySelector('i')).toHaveClass('fa-xmark');
    // The chip beside it is untouched (pinned tier).
    expect(screen.getByTitle('Add Crypt tracks')).toHaveClass('music-mood-btn');
  });

  it('retired bespoke rules are gone from MusicPlayer.css; the pinned .music-btn tier survives', async () => {
    const { readFileSync } = await import('node:fs');
    const { join, dirname } = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const css = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), 'MusicPlayer.css'),
      'utf-8'
    ).replace(/\/\*[\s\S]*?\*\//g, '');
    // Criterion-2 negative-absence pins (selectors only — comments above may
    // still NAME the retired classes as history):
    expect(css).not.toMatch(/\.music-mood-delete\b/);
    expect(css).not.toMatch(/\.music-add-category\b/);
    expect(css).not.toMatch(/\.music-editor-actions\s+\.music-btn/);
    // Root layout rule retired: only the scoped toast selectors keep .music-player.
    expect(css).not.toMatch(/^\.music-player\s*\{/m);
    expect(css).toMatch(/\.music-player\s+\.music-toast\s*{/);
    // Pinned tiers still own their lanes: mood chips + the settings/picker icons.
    expect(css).toMatch(/\.music-mood-btn\s*{/);
    expect(css).toMatch(/\.music-btn\s*{/);
  });
});
