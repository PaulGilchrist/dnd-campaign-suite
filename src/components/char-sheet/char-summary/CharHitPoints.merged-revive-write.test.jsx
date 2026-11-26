// @maintained-by-ai 2026-11-14
// Network-shape lock for the merged sheet-revive write (backlog 2026-11-14 MM):
// a value>0 HP commit used to fire FOUR full-bucket POSTs per action
// (currentHitPoints, deathSaves, deathFailures, isDead — one SSE echo each).
// This test rides the REAL useRuntimeState/store + savePromptService modules
// against a capture-only fetch so the request census is the assertion, not a
// mock-call census: exactly ONE POST /<Char> whose body.value carries all
// four keys, plus the unchanged mirror-gated deathSavePrompt DELETE lanes.
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import CharHitPoints from './CharHitPoints.jsx';
import {
  clearRuntimeState,
  getStore,
  setRuntimeObject,
} from '../../../hooks/runtime/useRuntimeState.js';

// logService and the unconscious-pane child are separate lanes; mock them so
// every fetch this test counts belongs to the char-bucket / prompt surface.
vi.mock('../../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve({})),
}));

vi.mock('./DeathSavingThrows.jsx', () => ({
  default: vi.fn(({ playerStats }) => (
    <div>Death Saving Throws for {playerStats.name}</div>
  )),
}));

import { addEntry } from '../../../services/ui/logService.js';

const NAME = 'TestCharacter';
const CAMPAIGN = 'test-campaign';
const CHAR_URL = `/api/campaigns/${CAMPAIGN}/${NAME}`;
const PROMPT_KEY = `deathSavePrompt-${NAME}`;

let requests;

function mockFetch() {
  requests = [];
  vi.stubGlobal('fetch', vi.fn((url, options = {}) => {
    requests.push({
      url,
      method: options.method || 'GET',
      body: options.body ? JSON.parse(options.body) : null,
    });
    return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
  }));
}

// Seeded directly into the runtime store via setRuntimeObject WITHOUT a
// campaignName — memory-only, zero fetches (the pre-commit mount state).
function seedCharStore(seed) {
  setRuntimeObject(NAME, seed);
}

function renderSheet() {
  return render(
    <CharHitPoints playerStats={{ name: NAME, hitPoints: 10 }} campaignName={CAMPAIGN} />
  );
}

// Real user path: open the HiddenInput editor, type, blur-commit.
// Requests recorded BEFORE this point are dropped so only the commit's
// own network traffic is counted.
function commitHp(newValue) {
  fireEvent.click(screen.getByText(/Hit Points:/).parentElement);
  const input = screen.getByRole('spinbutton');
  fireEvent.change(input, { target: { value: String(newValue) } });
  requests.length = 0;
  fireEvent.blur(input);
}

const charPosts = () =>
  requests.filter((r) => r.method === 'POST' && r.url === CHAR_URL);
const promptRequests = () =>
  requests.filter((r) => r.url.endsWith(`/${PROMPT_KEY}`));

describe('CharHitPoints — merged revive write (one POST per commit)', () => {
  beforeEach(() => {
    mockFetch();
    addEntry.mockClear();
    clearRuntimeState(NAME);
    clearRuntimeState('campaign');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('revive (0→25 with armed death buckets) POSTs the char bucket exactly once with all four keys', () => {
    seedCharStore({
      currentHitPoints: 0,
      deathSaves: [true, true, false],
      deathFailures: [true, false, false],
      isDead: 1,
      tempHp: 3, // unrelated key must survive untouched in the same bucket
    });
    renderSheet();
    commitHp(25);

    const posts = charPosts();
    expect(posts).toHaveLength(1);
    expect(posts[0].body.value).toMatchObject({
      currentHitPoints: 25,
      deathSaves: [false, false, false],
      deathFailures: [false, false, false],
      isDead: 0,
      tempHp: 3,
    });

    // One POST → one echo: the ONLY requests this commit makes are the
    // single char-bucket POST (no prompt mirror ⇒ zero deathSavePrompt
    // traffic, the 3a99fd08a evict law).
    expect(requests).toHaveLength(1);

    // Audit row unchanged (AC5 unit face): exactly one hp_change, sheet stamp.
    expect(addEntry).toHaveBeenCalledTimes(1);
    expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
      type: 'hp_change',
      targetName: NAME,
      sourceName: 'sheet editor',
      delta: 25,
      currentHp: 25,
      maxHp: 10,
      isHealing: true,
    }));

    // Store updated immediately (UI reflects the merge without a reload).
    expect(screen.getByText(/Hit Points:/).parentElement).toHaveTextContent('25/10');
  });

  it('revive with an armed prompt mirror still DELETEs the prompt key (still one char POST)', () => {
    seedCharStore({
      currentHitPoints: 0,
      deathSaves: [true, false, false],
      deathFailures: [false, false, false],
      isDead: 0,
    });
    // Arm the mirror the way the campaign-select seed lane does.
    getStore('campaign').set(PROMPT_KEY, { targetName: NAME });
    renderSheet();
    commitHp(12);

    const posts = charPosts();
    expect(posts).toHaveLength(1);
    expect(posts[0].body.value).toMatchObject({
      currentHitPoints: 12,
      deathSaves: [false, false, false],
      deathFailures: [false, false, false],
      isDead: 0,
    });

    const promptReqs = promptRequests();
    expect(promptReqs).toHaveLength(1);
    expect(promptReqs[0].method).toBe('DELETE');
  });

  it('non-revive >0→0 commit sends one char POST and NO death-bucket keys', () => {
    seedCharStore({ currentHitPoints: 30 });
    renderSheet();
    commitHp(0);

    const posts = charPosts();
    expect(posts).toHaveLength(1);
    // Single-key lane shape unchanged: the body is the full mirror, but no
    // death properties are written where the old code wrote none.
    expect(posts[0].body.value).toEqual({ currentHitPoints: 0 });
    expect(requests).toHaveLength(1);
    expect(promptRequests()).toHaveLength(0);
  });

  it('non-revive heal 30→50 with clean death buckets still sends exactly one POST', () => {
    seedCharStore({
      currentHitPoints: 30,
      deathSaves: [false, false, false],
      deathFailures: [false, false, false],
      isDead: 0,
    });
    renderSheet();
    commitHp(50);

    // Old code: 1 real POST (HP) + 3 self-skips; new code: 1 merged POST.
    // What the server ends up holding is identical.
    const posts = charPosts();
    expect(posts).toHaveLength(1);
    expect(posts[0].body.value).toMatchObject({
      currentHitPoints: 50,
      deathSaves: [false, false, false],
      deathFailures: [false, false, false],
      isDead: 0,
    });
    expect(requests).toHaveLength(1);
    expect(promptRequests()).toHaveLength(0);
  });
});
