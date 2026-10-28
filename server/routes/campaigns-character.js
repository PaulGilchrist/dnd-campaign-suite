import express from 'express';
import fs from 'fs';
import path from 'path';
import { processImageUpload, deleteCharacterImage } from '../utils/imageUtils.js';
import { publish, removeChangeDataKey } from '../utils/changeData.js';
import asyncHandler from '../utils/asyncHandler.js';
import { campaignDir, campaignImagesDir } from '../utils/campaignPaths.js';
import { normalizeCharacterName, characterFileName } from '../utils/characterName.js';

const router = express.Router();

// Authority (mirrors maps.js refuseUnlessGm / quests.js / campaigns-admin.js):
// character creation is a GM-only write — network clients get a read-only
// view (AGENTS.md). The client hides the sidebar "Add Character" affordance
// (Sidebar.jsx CharacterList isLocalhost gate); this route guard is the
// server seam that makes it structural (bug-player-view-can-create-characters).
const isLocalhost = (req) => req.hostname === 'localhost' || req.hostname === '127.0.0.1';

function refuseUnlessGm(req, res) {
    if (isLocalhost(req)) return true;
    console.log(`[campaigns-character] BLOCKED non-localhost ${req.method} ${req.originalUrl} — GM-only`);
    res.status(403).json({ error: 'Access denied: GM-only feature' });
    return false;
}

// Sheet-load shape guard (bug-charsheet-stale-body-minimal-payload): the rules
// engine THROWS when these sections are absent, and a character file missing
// them crash-silents CharSheet.fetchData (no .catch), leaving the PREVIOUS
// character's full live body (with its Edit/Delete affordances) on screen
// under the new header — a wrong-entity mutation hazard. Enumerated from the
// engine's unconditional throw sites, nothing more:
//   - class.name   → classRules.js:30 / classRules2024.js:91 (`playerSummary.class.name`)
//   - race.name    → race-rules/5e.js:30 / 2024.js:66 (`playerSummary.race.name`)
//   - inventory.magicItems array → rules.js assigns it and rules-magicItems.js:8-11
//     throws `Missing array: inventory.magicItems`
//   - class.major/class.subclass (named object) → rules-proficiencies.js:121-123
//     (2024 `Missing object: class.major`) / :165-167 (5e `Missing object:
//     class.subclass`); resolveMajor (classRules2024.js:24-29) yields undefined
//     without a name, and the wizard hard-gates subclass selection — every
//     loadable character carries one (run-Q live proof: subclass-less Fighter
//     throws class.major).
//   - abilities non-empty → rules-initiative.js:17-18 dereferences the
//     Dexterity entry unconditionally (`dexAbility.bonus` crash for an empty
//     array — live-proven run R; wizard characters always carry all six).
// Reject such payloads at the write boundary instead of poisoning the sheet.
function missingCharacterSections(character) {
    const namedObject = (v) => v && typeof v === 'object' && !Array.isArray(v) && typeof v.name === 'string' && v.name.trim() !== '';
    const missing = [];
    if (!namedObject(character.race)) missing.push('race (an object with a name)');
    if (!namedObject(character.class)) missing.push('class (an object with a name)');
    else if (!namedObject(character.class.major) && !namedObject(character.class.subclass)) {
        missing.push('class.major or class.subclass (an object with a name)');
    }
    if (!Array.isArray(character.abilities) || character.abilities.length === 0) {
        missing.push('abilities (a non-empty array)');
    }
    if (!character.inventory || typeof character.inventory !== 'object' || Array.isArray(character.inventory) || !Array.isArray(character.inventory.magicItems)) {
        missing.push('inventory.magicItems (an array)');
    }
    return missing;
}

function refuseIncompleteCharacter(res, character) {
    const missing = missingCharacterSections(character);
    if (missing.length === 0) return true;
    res.status(400).json({ error: `Character is missing required data: ${missing.join(', ')}` });
    return false;
}

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

    // Same server-boundary normalization as the create route: the stored
    // display name is normalized and the TARGET filename derives from it, so
    // a rename to " X " lands on X.json exactly like create would (and clean
    // names keep writing to the exact URL-supplied path — byte-identical).
    const name = normalizeCharacterName(character.name);
    if (!name) {
        return res.status(400).json({ error: 'Character name is required' });
    }
    character.name = name;
    const targetFile = characterFileName(name);

    const sourceFile = character.originalFileName || file;
    const isRename = sourceFile !== targetFile;
    const sourcePath = path.join(dir, sourceFile);

    if (!fs.existsSync(sourcePath)) {
        return res.status(404).json({ error: 'Character file not found' });
    }

    // Same section-shape guard as create (the PUT body is the bare FULL
    // character object — wizard save/rename/level all send it): a partial or
    // sections-less body would replace a loadable file with one that breaks
    // the sheet. Validate BEFORE the rename unlink so a rejected PUT is
    // fully disk-inert.
    if (!refuseIncompleteCharacter(res, character)) return;

    // Read the original character to get the imagePath for image cleanup
    const originalCharacter = JSON.parse(fs.readFileSync(sourcePath, 'utf-8'));

    if (isRename) {
        // Delete the original character file
        fs.unlinkSync(sourcePath);

        // Image unchanged but character renamed — rename the image file
        syncCharacterImage(campaign, character, originalCharacter.imagePath, false);
    } else {
        syncCharacterImage(campaign, character, originalCharacter.imagePath, true);
    }

    // Write the updated character data
    const filePath = path.join(dir, targetFile);
    delete character.originalFileName;
    delete character._fileName;
    fs.writeFileSync(filePath, JSON.stringify(character, null, 2));

    // Clean up stale change-data for renamed character (uses old name from file)
    if (isRename && originalCharacter?.name) {
        removeChangeDataKey(campaign, originalCharacter.name);
    }

    // Broadcast character update
    publish(`character-${campaign}-${targetFile}`, character, campaign);

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
    if (!refuseUnlessGm(req, res)) return;

    const { campaign } = req.params;
    const { character } = req.body;

    if (!campaign || !character) {
        return res.status(400).json({ error: 'Campaign and character data are required' });
    }

    const dir = campaignDir(campaign);

    if (!fs.existsSync(dir)) {
        return res.status(404).json({ error: 'Campaign not found' });
    }

    // Server-boundary name normalization (server/utils/characterName.js):
    // trim + collapse whitespace so stray spaces never leak into the stored
    // display name or filename ("X " → "X.json", never "X_.json"), and the
    // duplicate guard below compares normalized spellings ("X " vs "X" → 400).
    const name = normalizeCharacterName(character.name);
    if (!name) {
        return res.status(400).json({ error: 'Character name is required' });
    }
    character.name = name;

    // Generate filename from character name
    const fileName = characterFileName(name);
    const filePath = path.join(dir, fileName);

    // Duplicate-name guard (mirrors the NPCs/Quests/Settlements 400 guards):
    // creation must never silently overwrite an existing character file.
    if (fs.existsSync(filePath)) {
        return res.status(400).json({ error: 'A character with that name already exists' });
    }

    // Section-shape guard (see missingCharacterSections): a stored file the
    // rules engine cannot load crash-silents the sheet into a stale-body
    // impostor — never write one.
    if (!refuseIncompleteCharacter(res, character)) return;

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
