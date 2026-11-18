// @maintained-by-ai
// wizardOfferedStore contract (backlog KA 2026-11-18): the per-campaign
// "auto-wizard already offered" display pref is a pure facade over
// localStorage `character-wizard-offered:<campaign>` (same tier as the TV
// pref `initiative-tv`). isWizardOffered reads persisted bytes directly — no
// cached copy — so a raw test seed and an in-app markWizardOffered resolve
// identically; the flag is per-campaign, never global; missing/falsy names
// read as "never offered" and write nothing; junk values never count as
// offered (only the exact '1' stamp does).
import { describe, it, expect, afterEach } from 'vitest';
import { isWizardOffered, markWizardOffered } from './wizardOfferedStore.js';

const KEY = 'character-wizard-offered:qa-wiza';

describe('wizardOfferedStore', () => {
    afterEach(() => {
        localStorage.clear();
    });

    it('defaults to not-offered and stamps on mark (keyed per campaign name)', () => {
        expect(isWizardOffered('qa-wiza')).toBe(false);
        markWizardOffered('qa-wiza');
        expect(localStorage.getItem(KEY)).toBe('1');
        expect(isWizardOffered('qa-wiza')).toBe(true);
    });

    it('is per-campaign, not global', () => {
        markWizardOffered('qa-wiza');
        expect(isWizardOffered('qa-wizb')).toBe(false);
        markWizardOffered('qa-wizb');
        expect(isWizardOffered('qa-wiza')).toBe(true);
        expect(isWizardOffered('qa-wizb')).toBe(true);
    });

    it('reads a raw localStorage seed identically to an in-app mark', () => {
        localStorage.setItem(KEY, '1');
        expect(isWizardOffered('qa-wiza')).toBe(true);
    });

    it('treats only the exact "1" stamp as offered', () => {
        localStorage.setItem(KEY, '0');
        expect(isWizardOffered('qa-wiza')).toBe(false);
        localStorage.setItem(KEY, 'not-json');
        expect(isWizardOffered('qa-wiza')).toBe(false);
    });

    it('missing campaign names never open and never write', () => {
        expect(isWizardOffered(undefined)).toBe(false);
        expect(isWizardOffered('')).toBe(false);
        markWizardOffered(undefined);
        markWizardOffered('');
        expect(localStorage.getItem('character-wizard-offered:undefined')).toBeNull();
        expect(localStorage.getItem('character-wizard-offered:')).toBeNull();
    });
});
