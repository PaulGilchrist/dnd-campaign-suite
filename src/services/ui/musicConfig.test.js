import { describe, it, expect } from 'vitest';
import { MOODS, getMood, getTracksForMood, extractVideoId } from './musicConfig.js';

describe('MOODS catalogue', () => {
  it('defines the core moods', () => {
    expect(MOODS.map(m => m.key)).toEqual(['town', 'outdoors', 'combat', 'dungeon', 'tavern']);
  });

  it('gives every mood a label, icon and at least one track with an 11-char video id', () => {
    for (const mood of MOODS) {
      expect(mood.label).toBeTruthy();
      expect(mood.icon).toMatch(/^fa-/);
      expect(mood.tracks.length).toBeGreaterThan(0);
      for (const track of mood.tracks) {
        expect(track.videoId).toMatch(/^[a-zA-Z0-9_-]{11}$/);
        expect(track.title).toBeTruthy();
      }
    }
  });

  it('has no duplicate video ids', () => {
    const ids = MOODS.flatMap(m => m.tracks.map(t => t.videoId));
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('getTracksForMood', () => {
  it('returns starter tracks when no override exists', () => {
    expect(getTracksForMood('town', {})).toBe(getMood('town').tracks);
  });

  it('returns GM overrides when present', () => {
    const override = [{ videoId: 'aaaaaaaaaaa', title: 'Custom' }];
    expect(getTracksForMood('town', { town: override })).toBe(override);
  });

  it('falls back to starter tracks for empty overrides', () => {
    expect(getTracksForMood('town', { town: [] })).toBe(getMood('town').tracks);
  });

  it('returns empty list for unknown mood', () => {
    expect(getTracksForMood('nope', null)).toEqual([]);
  });
});

describe('extractVideoId', () => {
  it('accepts raw ids', () => {
    expect(extractVideoId('q9yaKpYS9qc')).toBe('q9yaKpYS9qc');
    expect(extractVideoId('  q9yaKpYS9qc  ')).toBe('q9yaKpYS9qc');
  });

  it('accepts watch, youtu.be and embed URLs', () => {
    expect(extractVideoId('https://www.youtube.com/watch?v=q9yaKpYS9qc')).toBe('q9yaKpYS9qc');
    expect(extractVideoId('https://youtu.be/q9yaKpYS9qc?si=abc')).toBe('q9yaKpYS9qc');
    expect(extractVideoId('https://www.youtube.com/embed/q9yaKpYS9qc')).toBe('q9yaKpYS9qc');
  });

  it('rejects garbage', () => {
    expect(extractVideoId('not a url')).toBeNull();
    expect(extractVideoId('https://example.com/watch?v=q9yaKpYS9qc')).toBeNull();
    expect(extractVideoId('')).toBeNull();
    expect(extractVideoId(null)).toBeNull();
  });
});
