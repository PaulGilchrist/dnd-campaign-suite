import fs from 'fs';
import path from 'path';
import {
    processImageUpload,
    deleteCharacterImage,
} from '../utils/imageUtils.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createTestCampaignDir(campaignName) {
    const imagesDir = path.join(process.cwd(), 'public', 'campaigns', campaignName, 'images');
    fs.mkdirSync(imagesDir, { recursive: true });
    return imagesDir;
}

function removeTestCampaignDir(campaignName) {
    const dir = path.join(process.cwd(), 'public', 'campaigns', campaignName);
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
}

function createMockCharacter(imageName, imageData) {
    const character = { name: 'TestChar' };
    if (imageName) {
        character.imageName = imageName;
    }
    if (imageData !== undefined) {
        character.image = imageData;
    }
    return character;
}

// ---------------------------------------------------------------------------
// processImageUpload
// ---------------------------------------------------------------------------
describe('imageUtils - processImageUpload', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        removeTestCampaignDir('test-campaign-1');
        removeTestCampaignDir('test-campaign-2');
        removeTestCampaignDir('test-campaign-3');
        removeTestCampaignDir('test-campaign-4');
        removeTestCampaignDir('test-campaign-5');
        removeTestCampaignDir('test-campaign-6');
        removeTestCampaignDir('test-campaign-7');
        removeTestCampaignDir('test-campaign-8');
    });

    it('should be a function', () => {
        expect(typeof processImageUpload).toBe('function');
    });

    it('should do nothing when character has no image field', () => {
        const character = { name: 'TestChar', imageName: 'photo.jpg' };

        processImageUpload('test-campaign-1', 'TestChar', character);

        expect(character.image).toBeUndefined();
        expect(character.imageName).toBe('photo.jpg');
        expect(character.imagePath).toBeUndefined();
    });

    it('should do nothing when character has no imageName field', () => {
        const character = { name: 'TestChar', image: 'data:image/png;base64,abc123' };

        processImageUpload('test-campaign-1', 'TestChar', character);

        expect(character.image).toBe('data:image/png;base64,abc123');
        expect(character.imageName).toBeUndefined();
        expect(character.imagePath).toBeUndefined();
    });

    it('should do nothing when both image and imageName are null', () => {
        const character = { name: 'TestChar', image: null, imageName: null };

        processImageUpload('test-campaign-1', 'TestChar', character);

        expect(character.image).toBeNull();
        expect(character.imageName).toBeNull();
        expect(character.imagePath).toBeUndefined();
    });

    it('should extract .jpg extension from imageName', () => {
        const imagesDir = createTestCampaignDir('test-campaign-1');
        const character = createMockCharacter('photo.jpg', 'data:image/jpeg;base64,abc123');

        processImageUpload('test-campaign-1', 'TestChar', character);

        const expectedPath = path.join(imagesDir, 'TestChar.jpg');
        expect(fs.existsSync(expectedPath)).toBe(true);
        expect(character.imagePath).toBe(path.join('campaigns', 'test-campaign-1', 'images', 'TestChar.jpg'));
        expect(character.image).toBeUndefined();
        expect(character.imageName).toBeUndefined();
    });

    it('should extract .png extension from imageName', () => {
        const imagesDir = createTestCampaignDir('test-campaign-2');
        const character = createMockCharacter('photo.png', 'data:image/png;base64,abc123');

        processImageUpload('test-campaign-2', 'TestChar', character);

        const expectedPath = path.join(imagesDir, 'TestChar.png');
        expect(fs.existsSync(expectedPath)).toBe(true);
        expect(character.imagePath).toBe(path.join('campaigns', 'test-campaign-2', 'images', 'TestChar.png'));
    });

    it('should extract .gif extension from imageName', () => {
        const imagesDir = createTestCampaignDir('test-campaign-3');
        const character = createMockCharacter('photo.gif', 'data:image/gif;base64,abc123');

        processImageUpload('test-campaign-3', 'TestChar', character);

        const expectedPath = path.join(imagesDir, 'TestChar.gif');
        expect(fs.existsSync(expectedPath)).toBe(true);
        expect(character.imagePath).toBe(path.join('campaigns', 'test-campaign-3', 'images', 'TestChar.gif'));
    });

    it('should default to .png when imageName has no extension', () => {
        const imagesDir = createTestCampaignDir('test-campaign-4');
        const character = createMockCharacter('photo', 'data:image/bmp;base64,abc123');

        processImageUpload('test-campaign-4', 'TestChar', character);

        const expectedPath = path.join(imagesDir, 'TestChar.png');
        expect(fs.existsSync(expectedPath)).toBe(true);
        expect(character.imagePath).toBe(path.join('campaigns', 'test-campaign-4', 'images', 'TestChar.png'));
    });

    it('should extract extension from imageName with dots in name', () => {
        const imagesDir = createTestCampaignDir('test-campaign-5');
        const character = createMockCharacter('my.photo', 'data:image/png;base64,abc123');

        processImageUpload('test-campaign-5', 'TestChar', character);

        // The regex \.[^.]+$ matches '.photo' as the extension
        const expectedPath = path.join(imagesDir, 'TestChar.photo');
        expect(fs.existsSync(expectedPath)).toBe(true);
    });

    it('should strip data URL prefix and save raw base64', () => {
        const imagesDir = createTestCampaignDir('test-campaign-1');
        const fullDataUrl = 'data:image/png;base64,aGVsbG8gd29ybGQ=';
        const character = createMockCharacter('photo.png', fullDataUrl);

        processImageUpload('test-campaign-1', 'TestChar', character);

        const expectedPath = path.join(imagesDir, 'TestChar.png');
        const fileContent = fs.readFileSync(expectedPath, 'base64');
        expect(fileContent).toBe('aGVsbG8gd29ybGQ=');
    });

    it('should handle jpeg data URL with jpeg mime type', () => {
        const imagesDir = createTestCampaignDir('test-campaign-2');
        const fullDataUrl = 'data:image/jpeg;base64,dGVzdA==';
        const character = createMockCharacter('photo.jpg', fullDataUrl);

        processImageUpload('test-campaign-2', 'TestChar', character);

        const expectedPath = path.join(imagesDir, 'TestChar.jpg');
        const fileContent = fs.readFileSync(expectedPath, 'base64');
        expect(fileContent).toBe('dGVzdA==');
    });

    it('should handle gif data URL with gif mime type', () => {
        const imagesDir = createTestCampaignDir('test-campaign-3');
        const fullDataUrl = 'data:image/gif;base64,Z2lm';
        const character = createMockCharacter('photo.gif', fullDataUrl);

        processImageUpload('test-campaign-3', 'TestChar', character);

        const expectedPath = path.join(imagesDir, 'TestChar.gif');
        const fileContent = fs.readFileSync(expectedPath, 'base64');
        expect(fileContent).toBe('Z2lm');
    });

    it('should create the images directory if it does not exist', () => {
        // Don't call createTestCampaignDir - let the function create it
        const character = createMockCharacter('photo.png', 'data:image/png;base64,abc123');

        processImageUpload('test-campaign-4', 'TestChar', character);

        const imagesDir = path.join(process.cwd(), 'public', 'campaigns', 'test-campaign-4', 'images');
        expect(fs.existsSync(imagesDir)).toBe(true);
    });

    it('should delete old image when originalImagePath is provided', () => {
        const imagesDir = createTestCampaignDir('test-campaign-5');

        // Create an old image file
        const oldImagePath = path.join('campaigns', 'test-campaign-5', 'images', 'OldChar.png');
        const oldFilePath = path.join(process.cwd(), 'public', oldImagePath);
        fs.mkdirSync(path.dirname(oldFilePath), { recursive: true });
        fs.writeFileSync(oldFilePath, 'old data', 'base64');

        const character = createMockCharacter('photo.png', 'data:image/png;base64,newdata');

        processImageUpload('test-campaign-5', 'TestChar', character, oldImagePath);

        // Old file should be deleted
        expect(fs.existsSync(oldFilePath)).toBe(false);
        // New file should exist
        const newFilePath = path.join(imagesDir, 'TestChar.png');
        expect(fs.existsSync(newFilePath)).toBe(true);
    });

    it('should not fail to delete old image if it does not exist', () => {
        const imagesDir = createTestCampaignDir('test-campaign-6');

        const character = createMockCharacter('photo.png', 'data:image/png;base64,newdata');

        processImageUpload('test-campaign-6', 'TestChar', character, 'campaigns/nonexistent/images/old.png');

        // New file should still be created
        const newFilePath = path.join(imagesDir, 'TestChar.png');
        expect(fs.existsSync(newFilePath)).toBe(true);
    });

    it('should not delete old image when originalImagePath is not provided', () => {
        const imagesDir = createTestCampaignDir('test-campaign-7');

        // Create an old image file
        const oldImagePath = path.join('campaigns', 'test-campaign-7', 'images', 'OldChar.png');
        const oldFilePath = path.join(process.cwd(), 'public', oldImagePath);
        fs.mkdirSync(path.dirname(oldFilePath), { recursive: true });
        fs.writeFileSync(oldFilePath, 'old data', 'base64');

        const character = createMockCharacter('photo.png', 'data:image/png;base64,newdata');

        processImageUpload('test-campaign-7', 'TestChar', character);

        // Old file should still exist
        expect(fs.existsSync(oldFilePath)).toBe(true);
        // New file should also exist
        const newFilePath = path.join(imagesDir, 'TestChar.png');
        expect(fs.existsSync(newFilePath)).toBe(true);
    });

    it('should use character name as the image filename', () => {
        const imagesDir = createTestCampaignDir('test-campaign-8');
        const character = createMockCharacter('photo.png', 'data:image/png;base64,abc123');

        processImageUpload('test-campaign-8', 'DragonSlayer', character);

        const expectedPath = path.join(imagesDir, 'DragonSlayer.png');
        expect(fs.existsSync(expectedPath)).toBe(true);
        expect(character.imagePath).toBe(path.join('campaigns', 'test-campaign-8', 'images', 'DragonSlayer.png'));
    });

    it('should preserve other character fields', () => {
        const character = {
            name: 'TestChar',
            hp: 25,
            maxHp: 30,
            imageName: 'photo.png',
            image: 'data:image/png;base64,abc123',
            level: 5,
        };

        processImageUpload('test-campaign-1', 'TestChar', character);

        expect(character.hp).toBe(25);
        expect(character.maxHp).toBe(30);
        expect(character.level).toBe(5);
        expect(character.imagePath).toBeDefined();
        expect(character.image).toBeUndefined();
        expect(character.imageName).toBeUndefined();
    });

    it('should write file with fsync for durability', () => {
        createTestCampaignDir('test-campaign-2');
        const character = createMockCharacter('photo.png', 'data:image/png;base64,abc123');

        const fsyncSyncSpy = vi.spyOn(fs, 'fsyncSync').mockImplementation(() => { /* no-op */ });
        const closeSyncSpy = vi.spyOn(fs, 'closeSync').mockImplementation(() => { /* no-op */ });

        processImageUpload('test-campaign-2', 'TestChar', character);

        expect(fsyncSyncSpy).toHaveBeenCalled();
        expect(closeSyncSpy).toHaveBeenCalled();

        fsyncSyncSpy.mockRestore();
        closeSyncSpy.mockRestore();
    });

    it('should log to console.error on success', () => {
        createTestCampaignDir('test-campaign-3');
        const character = createMockCharacter('photo.png', 'data:image/png;base64,abc123');

        const spy = vi.spyOn(console, 'error').mockImplementation(() => { /* no-op */ });

        processImageUpload('test-campaign-3', 'TestChar', character);

        expect(spy).toHaveBeenCalledWith(
            expect.stringContaining('Image saved:'),
        );
        spy.mockRestore();
    });

    it('should handle campaign names with hyphens', () => {
        const campaignName = 'my-test-campaign';
        const imagesDir = createTestCampaignDir(campaignName);
        const character = createMockCharacter('photo.png', 'data:image/png;base64,abc123');

        processImageUpload(campaignName, 'TestChar', character);

        const expectedPath = path.join(imagesDir, 'TestChar.png');
        expect(fs.existsSync(expectedPath)).toBe(true);
        expect(character.imagePath).toBe(path.join('campaigns', campaignName, 'images', 'TestChar.png'));
    });

    it('should handle campaign names with underscores', () => {
        const campaignName = 'my_test_campaign';
        const imagesDir = createTestCampaignDir(campaignName);
        const character = createMockCharacter('photo.png', 'data:image/png;base64,abc123');

        processImageUpload(campaignName, 'TestChar', character);

        const expectedPath = path.join(imagesDir, 'TestChar.png');
        expect(fs.existsSync(expectedPath)).toBe(true);
        expect(character.imagePath).toBe(path.join('campaigns', campaignName, 'images', 'TestChar.png'));
    });

    it('should handle large base64 data', () => {
        const imagesDir = createTestCampaignDir('test-campaign-4');
        // Simulate a large base64 string (e.g., 1MB image)
        const largeBase64 = 'data:image/png;base64,' + 'A'.repeat(1000000);
        const character = createMockCharacter('photo.png', largeBase64);

        processImageUpload('test-campaign-4', 'TestChar', character);

        const expectedPath = path.join(imagesDir, 'TestChar.png');
        expect(fs.existsSync(expectedPath)).toBe(true);
        const fileContent = fs.readFileSync(expectedPath, 'base64');
        expect(fileContent).toBe('A'.repeat(1000000));
    });

    it('should handle image data URL with uppercase extensions', () => {
        const imagesDir = createTestCampaignDir('test-campaign-5');
        const character = createMockCharacter('photo.PNG', 'data:image/png;base64,abc123');

        processImageUpload('test-campaign-5', 'TestChar', character);

        const expectedPath = path.join(imagesDir, 'TestChar.PNG');
        expect(fs.existsSync(expectedPath)).toBe(true);
    });

    it('should handle data URL with non-standard mime type', () => {
        const imagesDir = createTestCampaignDir('test-campaign-6');
        const character = createMockCharacter('photo.webp', 'data:image/webp;base64,d2VicA==');

        processImageUpload('test-campaign-6', 'TestChar', character);

        const expectedPath = path.join(imagesDir, 'TestChar.webp');
        expect(fs.existsSync(expectedPath)).toBe(true);
        const fileContent = fs.readFileSync(expectedPath, 'base64');
        expect(fileContent).toBe('d2VicA==');
    });

    it('should use process.cwd() for path resolution', () => {
        createTestCampaignDir('test-campaign-7');
        const character = createMockCharacter('photo.png', 'data:image/png;base64,abc123');

        processImageUpload('test-campaign-7', 'TestChar', character);

        const expectedPath = path.join(process.cwd(), 'public', 'campaigns', 'test-campaign-7', 'images', 'TestChar.png');
        expect(fs.existsSync(expectedPath)).toBe(true);
    });

    it('should handle image with empty string imageName (skipped due to falsy check)', () => {
        const character = { name: 'TestChar', image: 'data:image/png;base64,abc123', imageName: '' };

        processImageUpload('test-campaign-8', 'TestChar', character);

        // imageName is empty string (falsy), so the condition `character.image && character.imageName` is false
        // The function skips processing entirely
        expect(character.image).toBe('data:image/png;base64,abc123');
        expect(character.imageName).toBe('');
        expect(character.imagePath).toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// deleteCharacterImage
// ---------------------------------------------------------------------------
describe('imageUtils - deleteCharacterImage', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        removeTestCampaignDir('del-campaign-1');
        removeTestCampaignDir('del-campaign-2');
        removeTestCampaignDir('del-campaign-3');
    });

    it('should be a function', () => {
        expect(typeof deleteCharacterImage).toBe('function');
    });

    it('should delete an existing image file', () => {
        createTestCampaignDir('del-campaign-1');
        const imagePath = path.join('campaigns', 'del-campaign-1', 'images', 'TestChar.png');
        const fullPath = path.join(process.cwd(), 'public', imagePath);
        fs.writeFileSync(fullPath, 'test data', 'base64');

        deleteCharacterImage(imagePath);

        expect(fs.existsSync(fullPath)).toBe(false);
    });

    it('should do nothing when imagePath is null', () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => { /* no-op */ });

        deleteCharacterImage(null);

        expect(spy).not.toHaveBeenCalled();
        spy.mockRestore();
    });

    it('should do nothing when imagePath is undefined', () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => { /* no-op */ });

        deleteCharacterImage(undefined);

        expect(spy).not.toHaveBeenCalled();
        spy.mockRestore();
    });

    it('should do nothing when imagePath is empty string', () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => { /* no-op */ });

        deleteCharacterImage('');

        expect(spy).not.toHaveBeenCalled();
        spy.mockRestore();
    });

    it('should do nothing when file does not exist', () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => { /* no-op */ });

        deleteCharacterImage('campaigns/nonexistent/images/missing.png');

        expect(spy).not.toHaveBeenCalled();
        spy.mockRestore();
    });

    it('should log to console.error on successful deletion', () => {
        createTestCampaignDir('del-campaign-2');
        const imagePath = path.join('campaigns', 'del-campaign-2', 'images', 'TestChar.png');
        const fullPath = path.join(process.cwd(), 'public', imagePath);
        fs.writeFileSync(fullPath, 'test data', 'base64');

        const spy = vi.spyOn(console, 'error').mockImplementation(() => { /* no-op */ });

        deleteCharacterImage(imagePath);

        expect(spy).toHaveBeenCalledWith(expect.stringContaining('Deleted image:'));
        spy.mockRestore();
    });

    it('should log error when file deletion fails', () => {
        createTestCampaignDir('del-campaign-3');
        const imagePath = path.join('campaigns', 'del-campaign-3', 'images', 'TestChar.png');
        const fullPath = path.join(process.cwd(), 'public', imagePath);
        fs.writeFileSync(fullPath, 'test data', 'base64');

        vi.spyOn(fs, 'unlinkSync').mockImplementation(() => {
            throw new Error('permission denied');
        });

        const spy = vi.spyOn(console, 'error').mockImplementation(() => { /* no-op */ });

        deleteCharacterImage(imagePath);

        expect(spy).toHaveBeenCalledWith('Error deleting character image:', expect.anything());
        spy.mockRestore();
    });

    it('should resolve path relative to public/', () => {
        createTestCampaignDir('del-campaign-1');
        const imagePath = path.join('campaigns', 'del-campaign-1', 'images', 'TestChar.png');
        const fullPath = path.join(process.cwd(), 'public', imagePath);
        fs.writeFileSync(fullPath, 'test data', 'base64');

        const unlinkSyncSpy = vi.spyOn(fs, 'unlinkSync').mockImplementation(() => { /* no-op */ });

        deleteCharacterImage(imagePath);

        expect(unlinkSyncSpy).toHaveBeenCalledWith(fullPath);
        unlinkSyncSpy.mockRestore();
    });

    it('should handle image paths with subdirectories', () => {
        const campaignDir = path.join(process.cwd(), 'public', 'campaigns', 'del-campaign-2', 'images');
        fs.mkdirSync(campaignDir, { recursive: true });

        const subDir = path.join(campaignDir, 'subfolder');
        fs.mkdirSync(subDir, { recursive: true });

        const imagePath = path.join('campaigns', 'del-campaign-2', 'images', 'subfolder', 'TestChar.png');
        const fullPath = path.join(process.cwd(), 'public', imagePath);
        fs.writeFileSync(fullPath, 'test data', 'base64');

        deleteCharacterImage(imagePath);

        expect(fs.existsSync(fullPath)).toBe(false);
    });

    it('should handle different file extensions', () => {
        createTestCampaignDir('del-campaign-3');
        const imagePath = path.join('campaigns', 'del-campaign-3', 'images', 'TestChar.jpg');
        const fullPath = path.join(process.cwd(), 'public', imagePath);
        fs.writeFileSync(fullPath, 'test data', 'base64');

        deleteCharacterImage(imagePath);

        expect(fs.existsSync(fullPath)).toBe(false);
    });

    it('should use process.cwd() for path resolution', () => {
        createTestCampaignDir('del-campaign-1');
        const imagePath = path.join('campaigns', 'del-campaign-1', 'images', 'TestChar.png');
        const fullPath = path.join(process.cwd(), 'public', imagePath);
        fs.writeFileSync(fullPath, 'test data', 'base64');

        const unlinkSyncSpy = vi.spyOn(fs, 'unlinkSync').mockImplementation(() => { /* no-op */ });

        deleteCharacterImage(imagePath);

        expect(unlinkSyncSpy).toHaveBeenCalledWith(
            expect.stringContaining(process.cwd()),
        );
        unlinkSyncSpy.mockRestore();
    });

    it('should handle campaign names with hyphens', () => {
        const campaignName = 'my-test-campaign';
        const imagesDir = path.join(process.cwd(), 'public', 'campaigns', campaignName, 'images');
        fs.mkdirSync(imagesDir, { recursive: true });

        const imagePath = path.join('campaigns', campaignName, 'images', 'TestChar.png');
        const fullPath = path.join(process.cwd(), 'public', imagePath);
        fs.writeFileSync(fullPath, 'test data', 'base64');

        deleteCharacterImage(imagePath);

        expect(fs.existsSync(fullPath)).toBe(false);
    });

    it('should handle campaign names with underscores', () => {
        const campaignName = 'my_test_campaign';
        const imagesDir = path.join(process.cwd(), 'public', 'campaigns', campaignName, 'images');
        fs.mkdirSync(imagesDir, { recursive: true });

        const imagePath = path.join('campaigns', campaignName, 'images', 'TestChar.png');
        const fullPath = path.join(process.cwd(), 'public', imagePath);
        fs.writeFileSync(fullPath, 'test data', 'base64');

        deleteCharacterImage(imagePath);

        expect(fs.existsSync(fullPath)).toBe(false);
    });

    it('should not throw on any error', () => {
        vi.spyOn(fs, 'existsSync').mockImplementation(() => {
            throw new Error('filesystem error');
        });

        expect(() => deleteCharacterImage('campaigns/test/images/test.png')).not.toThrow();
    });
});
