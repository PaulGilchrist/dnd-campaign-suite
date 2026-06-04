import fs from 'fs';
import path from 'path';

/**
 * Helper function to process image uploads from character data
 * @param {string} campaignName - Campaign name
 * @param {string} characterName - Character name (used as image filename)
 * @param {object} character - Character data object (mutated to set imagePath and remove image/imageName)
 * @param {string} originalImagePath - The imagePath from the original character file (optional)
 */
export const processImageUpload = (campaignName, characterName, character, originalImagePath) => {
    if (character.image && character.imageName) {
        // Extract the file extension from imageName (e.g., "photo.jpg" -> ".jpg")
        const extMatch = character.imageName.match(/\.[^.]+$/);
        const ext = extMatch ? extMatch[0] : '.png';

        const campaignImagesDir = path.join(process.cwd(), 'public', 'campaigns', campaignName, 'images');
        if (!fs.existsSync(campaignImagesDir)) {
            fs.mkdirSync(campaignImagesDir, { recursive: true });
        }

        // Use character name as filename
        const imageFileName = `${characterName}${ext}`;
        const imageFilePath = path.join(campaignImagesDir, imageFileName);

        // Delete old image if provided
        if (originalImagePath) {
            deleteCharacterImage(originalImagePath);
        }

        // Extract base64 data from data URL (e.g., "data:image/png;base64,iVBORw...")
        const base64Data = character.image.replace(/^data:image\/[a-zA-Z]+;base64,/, '');

        // Save the image file
        fs.writeFileSync(imageFilePath, base64Data, 'base64');
        const fd = fs.openSync(imageFilePath, 'r');
        fs.fsyncSync(fd);
        fs.closeSync(fd);

        // Set the relative path from public/
        character.imagePath = path.join('campaigns', campaignName, 'images', imageFileName);

        // Remove the temporary image and imageName fields from the character object
        delete character.image;
        delete character.imageName;

        console.error(`Image saved: ${imageFilePath}`);
    }
};

/**
 * Helper function to delete associated image file for a character
 * @param {string} imagePath - Relative path from public/ (e.g. "campaigns/<campaign>/images/<name>.<ext>")
 */
export const deleteCharacterImage = (imagePath) => {
    try {
        if (imagePath) {
            // imagePath is relative to public/ e.g. "campaigns/<campaign>/images/<name>.<ext>"
            const fullPath = path.join(process.cwd(), 'public', imagePath);
            if (fs.existsSync(fullPath)) {
                fs.unlinkSync(fullPath);
                console.error(`Deleted image: ${fullPath}`);
            }
        }
    } catch (error) {
        console.error('Error deleting character image:', error);
    }
};
