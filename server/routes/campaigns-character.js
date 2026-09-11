import express from 'express';
import fs from 'fs';
import path from 'path';
import { processImageUpload, deleteCharacterImage } from '../utils/imageUtils.js';
import { publish, removeChangeDataKey } from '../utils/changeData.js';
import asyncHandler from '../utils/asyncHandler.js';
import { campaignDir, campaignImagesDir } from '../utils/campaignPaths.js';

const router = express.Router();

// API endpoint to get a specific character file in a campaign
// NOTE: This wildcard route must be mounted AFTER all specific resource routes
// (maps, encounters, notes, npcs, quests, factions) to avoid intercepting them
router.get('/api/campaigns/:campaign/:file', asyncHandler((req, res, next) => {
    const { campaign, file } = req.params;
    if (file === 'log' || !file.endsWith('.json')) return next();
    const dir = campaignDir(campaign);
    const filePath = path.join(dir, file);

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Character file not found' });
    }

    const characterData = fs.readFileSync(filePath, 'utf-8');
    res.json(JSON.parse(characterData));
}));

// Renames a character's image file to the target filename, returning the new
// imagePath when a rename actually happened, or null when nothing changed
function renameImageFile(campaign, originalImagePath, newImageFileName) {
    const oldImageFullPath = path.join(process.cwd(), 'public', originalImagePath);
    if (!fs.existsSync(oldImageFullPath)) return null;

    const newImageFullPath = path.join(campaignImagesDir(campaign), newImageFileName);
    if (oldImageFullPath === newImageFullPath) return null;

    fs.renameSync(oldImageFullPath, newImageFullPath);
    return path.join('images', newImageFileName);
}

// Syncs the character image with the submitted character: clears a removed
// image, processes a new upload, or renames the existing image to match the
// character name. requireNameMatch only renames when the current image
// filename doesn't already match the character name.
function syncCharacterImage(campaign, character, originalImagePath, requireNameMatch) {
    if (!character.imagePath && originalImagePath) {
        // Image was cleared
        deleteCharacterImage(originalImagePath);
        character.imagePath = '';
        return;
    }

    if (character.image && character.imageName) {
        // New image uploaded
        processImageUpload(campaign, character.name, character, originalImagePath);
        return;
    }

    if (!originalImagePath || (requireNameMatch && !character.name)) return;

    const expectedImageFileName = `${character.name}${path.extname(originalImagePath)}`;
    if (requireNameMatch && path.basename(originalImagePath) === expectedImageFileName) return;

    const renamedImagePath = renameImageFile(campaign, originalImagePath, expectedImageFileName);
    if (renamedImagePath) character.imagePath = renamedImagePath;
}

// API endpoint to update an existing character in a campaign
router.put('/api/campaigns/:campaign/:file', asyncHandler((req, res, next) => {
    const { campaign, file } = req.params;
    if (file === 'log' || !file.endsWith('.json')) return next();
    const character = req.body;

    if (!campaign || !file || !character) {
        return res.status(400).json({ error: 'Campaign, file, and character data are required' });
    }

    const dir = campaignDir(campaign);
    const filePath = path.join(dir, file);

    const isRename = character.originalFileName && character.originalFileName !== file;
    let originalCharacter = null;

    if (isRename) {
        // Renaming: read from the original file path
        const originalFilePath = path.join(dir, character.originalFileName);
        if (!fs.existsSync(originalFilePath)) {
            return res.status(404).json({ error: 'Character file not found' });
        }

        // Read the original character to get the imagePath for image cleanup
        originalCharacter = JSON.parse(fs.readFileSync(originalFilePath, 'utf-8'));
        const originalImagePath = originalCharacter.imagePath;

        // Delete the original character file
        fs.unlinkSync(originalFilePath);

        // Image unchanged but character renamed — rename the image file
        syncCharacterImage(campaign, character, originalImagePath, false);
    } else {
        // Standard update: verify the file exists at the current path
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'Character file not found' });
        }

        // Read the original character to get the imagePath for image cleanup
        originalCharacter = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        syncCharacterImage(campaign, character, originalCharacter.imagePath, true);
    }

    // Write the updated character data
    delete character.originalFileName;
    delete character._fileName;
    fs.writeFileSync(filePath, JSON.stringify(character, null, 2));

    // Clean up stale change-data for renamed character (uses old name from file)
    if (isRename && originalCharacter?.name) {
        removeChangeDataKey(campaign, originalCharacter.name);
    }

    // Broadcast character update
    publish(`character-${campaign}-${file}`, character, campaign);

    res.json({ message: 'Character updated successfully' });
}));

// API endpoint to merge partial data into an existing character file
router.patch('/api/campaigns/:campaign/:file', asyncHandler((req, res, next) => {
    const { campaign, file } = req.params;
    if (file === 'log' || !file.endsWith('.json')) return next();
    const patch = req.body;

    if (!campaign || !file || !patch || typeof patch !== 'object') {
        return res.status(400).json({ error: 'Campaign, file, and patch data are required' });
    }

    const dir = campaignDir(campaign);
    const filePath = path.join(dir, file);

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Character file not found' });
    }

    const character = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

    // Deep merge: merge patch into character recursively for nested objects
    function deepMerge(target, source) {
        for (const key of Object.keys(source)) {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key]) && target[key] && typeof target[key] === 'object' && !Array.isArray(target[key])) {
                deepMerge(target[key], source[key]);
            } else {
                target[key] = source[key];
            }
        }
    }

    deepMerge(character, patch);

    // Write the updated character data
    fs.writeFileSync(filePath, JSON.stringify(character, null, 2));

    // Broadcast character update
    publish(`character-${campaign}-${file}`, character, campaign);

    res.json({ message: 'Character updated successfully', character });
}));

// API endpoint to delete a character file and its associated image
router.delete('/api/campaigns/:campaign/:file', asyncHandler((req, res, next) => {
    const { campaign, file } = req.params;
    if (file === 'log' || !file.endsWith('.json')) return next();
    const dir = campaignDir(campaign);
    const filePath = path.join(dir, file);

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Character file not found' });
    }

    // Read the character to get the imagePath for image cleanup
    const character = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    const imagePath = character.imagePath;

    // Delete the character file
    fs.unlinkSync(filePath);

    // Delete associated image if it exists
    if (imagePath) {
        deleteCharacterImage(imagePath);
    }

    // Remove stale change-data for deleted character
    removeChangeDataKey(campaign, character.name);

    // Broadcast character deletion
    publish(`character-delete-${campaign}-${file}`, { file }, campaign);

    res.json({ message: 'Character deleted successfully' });
}));

// API endpoint to create a new character (generates filename from name)
router.post('/api/campaigns/:campaign', asyncHandler((req, res) => {
    const { campaign } = req.params;
    const { character } = req.body;

    if (!campaign || !character) {
        return res.status(400).json({ error: 'Campaign and character data are required' });
    }

    const dir = campaignDir(campaign);

    if (!fs.existsSync(dir)) {
        return res.status(404).json({ error: 'Campaign not found' });
    }

    // Generate filename from character name
    const fileName = `${character.name.replace(/[^a-zA-Z0-9]/g, '_')}.json`;
    const filePath = path.join(dir, fileName);

    // Handle image upload
    if (character.image && character.imageName) {
        processImageUpload(campaign, character.name, character, null);
    }

    // Write the character file
    fs.writeFileSync(filePath, JSON.stringify(character, null, 2));

    // Broadcast character creation
    publish(`character-create-${campaign}-${fileName}`, character, campaign);

    res.status(201).json({ message: 'Character created successfully', character, fileName });
}));

export default router;
