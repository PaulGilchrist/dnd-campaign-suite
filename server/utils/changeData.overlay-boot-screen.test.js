// @maintained-by-ai
// ─── Lane: boot-load overlay screening (bug 2026-11-02 BG) ────────────────
// A persisted data/spell-overlays.json written BEFORE the write guards existed
// (null / bare strings / x-y-radius junk) booted RAW into the spellOverlayData
// Map, and every POST write traversal dereferenced `.id` on those rows — 500
// responses write-locked the whole overlay lane for that campaign while GET
// kept serving its filtered snapshot. Boot load must screen the disk doc
// through the SAME filterRenderableOverlays the GET lane uses: valid rows
// pass byte-identical, malformed rows are skipped from MEMORY with one
// `[spell-overlay] dropped N … boot …` census line, and the read path never
// writes or unlinks the disk file.
import fs from 'fs';
import { spellOverlayData, readFile } from '../utils/changeData.js';

const OVERLAY_FILE = 'spell-overlays.json';

const validSphere = (overrides = {}) => ({
    id: 'bg-valid',
    shape: 'sphere',
    startGridX: 2,
    startGridY: 2,
    angle: 0,
    radiusFt: 10,
    coneAngle: 0,
    widthFt: 0,
    distanceFt: 0,
    sizeFt: 0,
    color: 'rgba(80,255,80,0.07)',
    ...overrides,
});

// The exact legacy-bad mix from the bug repro: valid + null + x/y/radius junk
// + a bare string + a partial cone missing its coords/size.
const poisonedDoc = () => [
    validSphere(),
    null,
    { x: 1, y: 2, radius: 3 },
    'a bare string',
    { shape: 'cone', startGridX: 5 },
];

function mockBootFromDisk(doc) {
    vi.spyOn(fs, 'readdirSync').mockReturnValue([
        { name: 'overlay-campaign', isDirectory: () => true },
    ]);
    vi.spyOn(fs, 'existsSync').mockImplementation((p) => {
        const s = String(p);
        // campaigns dir + overlay file exist; change-data file does not
        return !s.includes('character-change-data');
    });
    vi.spyOn(fs, 'readFileSync').mockImplementation((p) => {
        if (String(p).endsWith(OVERLAY_FILE)) return JSON.stringify(doc);
        throw new Error('ENOENT');
    });
}

beforeEach(() => {
    spellOverlayData.clear();
});

afterEach(() => {
    vi.restoreAllMocks();
    spellOverlayData.clear();
});

describe('changeData - spell-overlay boot-load screening', () => {
    it('skips malformed disk rows into memory and keeps ONLY the valid ones, order preserved', () => {
        mockBootFromDisk(poisonedDoc());

        readFile();

        const stored = spellOverlayData.get('overlay-campaign');
        expect(stored).toEqual([validSphere()]);
    });

    it('logs one [spell-overlay] dropped N malformed row(s) boot <campaign> census line', () => {
        const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
        mockBootFromDisk(poisonedDoc());

        readFile();

        expect(logSpy).toHaveBeenCalledWith(
            expect.stringContaining('[spell-overlay] dropped 4 malformed row(s) boot overlay-campaign')
        );
    });

    it('a clean disk doc boots byte-identical with zero console noise', () => {
        const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
        const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const doc = [validSphere(), validSphere({ id: 'bg-valid-2' })];
        mockBootFromDisk(doc);

        readFile();

        expect(spellOverlayData.get('overlay-campaign')).toEqual(doc);
        expect(logSpy).not.toHaveBeenCalled();
        expect(errSpy).not.toHaveBeenCalled();
    });

    it('boot screening is read-only — never writes or unlinks the poisoned disk file', () => {
        vi.spyOn(console, 'log').mockImplementation(() => {});
        const writeSpy = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
        const unlinkSpy = vi.spyOn(fs, 'unlinkSync').mockImplementation(() => {});
        mockBootFromDisk(poisonedDoc());

        readFile();

        expect(writeSpy).not.toHaveBeenCalled();
        expect(unlinkSpy).not.toHaveBeenCalled();
    });

    it('an all-junk doc lands as an empty (not absent) entry — write lanes stay usable', () => {
        vi.spyOn(console, 'log').mockImplementation(() => {});
        mockBootFromDisk([null, 'a bare string', { x: 1, y: 2, radius: 3 }]);

        readFile();

        expect(spellOverlayData.get('overlay-campaign')).toEqual([]);
    });
});
