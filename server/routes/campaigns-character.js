import express from 'express';
import fs from 'fs';
import path from 'path';
import { processImageUpload, deleteCharacterImage } from '../utils/imageUtils.js';
import { publish, removeChangeDataKey } from '../utils/changeData.js';

const router = express.Router();

// API endpoint to get a specific character file in a campaign
// NOTE: This wildcard route must be mounted AFTER all specific resource routes
// (maps, encounters, notes, npcs, quests, factions) to avoid intercepting them
router.get('/api/campaigns/:campaign/:file', (req, res, next) => {
    const { campaign, file } = req.params;
    if (file === 'log' || !file.endsWith('.json')) return next();
    const campaignDir = path.join(process.cwd(), 'public', 'campaigns', campaign);
    const filePath = path.join(campaignDir, file);
    
    try {
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'Character file not found' });
        }
        
        const characterData = fs.readFileSync(filePath, 'utf-8');
        res.json(JSON.parse(characterData));
    } catch (error) {
        console.error('Error reading character file:', error);
        res.status(500).json({ error: 'Failed to read character file' });
    }
});

// API endpoint to update an existing character in a campaign
router.put('/api/campaigns/:campaign/:file', (req, res, next) => {
    const { campaign, file } = req.params;
    if (file === 'log' || !file.endsWith('.json')) return next();
    const character = req.body;
    
    if (!campaign || !file || !character) {
        return res.status(400).json({ error: 'Campaign, file, and character data are required' });
    }
    
    const campaignDir = path.join(process.cwd(), 'public', 'campaigns', campaign);
    const filePath = path.join(campaignDir, file);
    
    try {
        const isRename = character.originalFileName && character.originalFileName !== file;
        let originalCharacter = null;

        if (isRename) {
             // Renaming: read from the original file path
            const originalFilePath = path.join(campaignDir, character.originalFileName);
            if (!fs.existsSync(originalFilePath)) {
                return res.status(404).json({ error: 'Character file not found' });
              }

             // Read the original character to get the imagePath for image cleanup
            originalCharacter = JSON.parse(fs.readFileSync(originalFilePath, 'utf-8'));
            const originalImagePath = originalCharacter.imagePath;

             // Delete the original character file
            fs.unlinkSync(originalFilePath);

             // Handle image changes
            if ((!character.imagePath || character.imagePath === '') && originalImagePath) {
                 // Image was cleared
                deleteCharacterImage(originalImagePath);
                character.imagePath = '';
              } else if (character.image && character.imageName) {
                 // New image uploaded
                processImageUpload(campaign, character.name, character, originalImagePath);
              } else if (originalImagePath) {
                 // Image unchanged but character renamed — rename the image file
                const oldImageFullPath = path.join(process.cwd(), 'public', originalImagePath);
                if (fs.existsSync(oldImageFullPath)) {
                    const ext = path.extname(oldImageFullPath);
                    const newImageFileName = `${character.name}${ext}`;
                    const newCampaignImagesDir = path.join(process.cwd(), 'public', 'campaigns', campaign, 'images');
                    const newImageFullPath = path.join(newCampaignImagesDir, newImageFileName);

                    if (oldImageFullPath !== newImageFullPath) {
                        fs.renameSync(oldImageFullPath, newImageFullPath);
                        character.imagePath = path.join('campaigns', campaign, 'images', newImageFileName);
                     }
                 }
              }
          } else {
             // Standard update: verify the file exists at the current path
            if (!fs.existsSync(filePath)) {
                return res.status(404).json({ error: 'Character file not found' });
              }

             // Read the original character to get the imagePath for image cleanup
            originalCharacter = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
            const originalImagePath = originalCharacter.imagePath;

             // Handle image changes
            if ((!character.imagePath || character.imagePath === '') && originalImagePath) {
                deleteCharacterImage(originalImagePath);
                character.imagePath = '';
              } else if (character.image && character.imageName) {
                 // New image uploaded
                processImageUpload(campaign, character.name, character, originalImagePath);
              }
          }

            // Write the updated character data
        fs.writeFileSync(filePath, JSON.stringify(character, null, 2));

           // Clean up stale change-data for renamed character (uses old name from file)
        if (isRename && originalCharacter?.name) {
            removeChangeDataKey(campaign, originalCharacter.name);
           }

         // Broadcast character update
        publish(`character-${campaign}-${file}`, character);

        res.json({ message: 'Character updated successfully' });
    } catch (error) {
        console.error('Error updating character:', error);
        res.status(500).json({ error: 'Failed to update character' });
    }
});

// API endpoint to delete a character file and its associated image
router.delete('/api/campaigns/:campaign/:file', (req, res, next) => {
    const { campaign, file } = req.params;
    if (file === 'log' || !file.endsWith('.json')) return next();
    const campaignDir = path.join(process.cwd(), 'public', 'campaigns', campaign);
    const filePath = path.join(campaignDir, file);
    
    try {
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
        publish(`character-delete-${campaign}-${file}`, { file });

        res.json({ message: 'Character deleted successfully' });
    } catch (error) {
        console.error('Error deleting character:', error);
        res.status(500).json({ error: 'Failed to delete character' });
    }
});

// API endpoint to create a new character (generates filename from name)
router.post('/api/campaigns/:campaign', (req, res) => {
    const { campaign } = req.params;
    const { character } = req.body;
    
    if (!campaign || !character) {
        return res.status(400).json({ error: 'Campaign and character data are required' });
     }
     
    const campaignDir = path.join(process.cwd(), 'public', 'campaigns', campaign);
    
    try {
        if (!fs.existsSync(campaignDir)) {
            return res.status(404).json({ error: 'Campaign not found' });
        }
        
        // Generate filename from character name
        const fileName = `${character.name.replace(/[^a-zA-Z0-9]/g, '_')}.json`;
        const filePath = path.join(campaignDir, fileName);
        
        // Handle image upload
        if (character.image && character.imageName) {
            processImageUpload(campaign, character.name, character, null);
        }
        
        // Write the character file
         character._fileName = fileName;
         fs.writeFileSync(filePath, JSON.stringify(character, null, 2));

         // Broadcast character creation
         publish(`character-create-${campaign}-${fileName}`, character);
        
        res.status(201).json({ message: 'Character created successfully', character, fileName });
    } catch (error) {
        console.error('Error creating character:', error);
        res.status(500).json({ error: 'Failed to create character' });
    }
});

export default router;
