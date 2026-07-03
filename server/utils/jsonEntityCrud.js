import { Router } from 'express';
import fs from 'fs';
import { campaignDataFile, ensureDataDir } from './campaignPaths.js';
import asyncHandler from './asyncHandler.js';

function singularize(name) {
  if (name === 'npcs') return 'npc';
  if (name.endsWith('ies')) return name.slice(0, -3) + 'y';
  if (name.endsWith('s')) return name.slice(0, -1);
  return name;
}

export function createJsonEntityRouter(entityName, options = {}) {
  const {
    idField = 'id',
    responseWrapper = entityName,
    itemWrapper = singularize(entityName),
    pluralDisplayName = entityName,
    singularDisplayName = singularize(entityName),
    transformList = null,
    authorizeRead = null,
    forbiddenMessage = 'Access denied',
    onDelete = null,
    extraRoutes = () => {},
  } = options;

  const router = Router();
  const getFilePath = (campaign) => campaignDataFile(campaign, `${entityName}.json`);

  const loadOrInit = (campaign) => {
    const filePath = getFilePath(campaign);
    if (!fs.existsSync(filePath)) {
      ensureDataDir(campaign);
      fs.writeFileSync(filePath, JSON.stringify([], null, 2));
      return [];
    }
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    return Array.isArray(data) ? data : [];
  };

  // GET /api/campaigns/:campaign/[entityName] — list all
  router.get(`/api/campaigns/:campaign/${entityName}`, asyncHandler((req, res) => {
    try {
      const { campaign } = req.params;
      const entities = loadOrInit(campaign);
      const result = transformList ? transformList(entities, req) : entities;
      res.json({ [responseWrapper]: result });
    } catch (error) {
      console.error(`Error reading ${entityName}:`, error);
      throw new Error(`Failed to read ${pluralDisplayName}`);
    }
  }));

  // POST /api/campaigns/:campaign/[entityName] — overwrite entire array
  router.post(`/api/campaigns/:campaign/${entityName}`, asyncHandler((req, res) => {
    try {
      const { campaign } = req.params;
      const entities = req.body[entityName];
      if (!Array.isArray(entities)) {
        return res.status(400).json({ error: `Expected an array for ${entityName}` });
      }
      const filePath = getFilePath(campaign);
      ensureDataDir(campaign);
      fs.writeFileSync(filePath, JSON.stringify(entities, null, 2));
      res.json({ success: true });
    } catch (error) {
      console.error(`Error saving ${entityName}:`, error);
      throw new Error(`Failed to save ${pluralDisplayName}`);
    }
  }));

  // GET /api/campaigns/:campaign/[entityName]/:id — get one by idField
  router.get(`/api/campaigns/:campaign/${entityName}/:id`, asyncHandler((req, res) => {
    try {
      const { campaign, id } = req.params;
      const decodedId = decodeURIComponent(id);
      const filePath = getFilePath(campaign);

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: `${singularDisplayName} not found` });
      }

      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      const entities = Array.isArray(data) ? data : [];
      const entity = entities.find(e => e[idField] === decodedId);

      if (!entity) {
        return res.status(404).json({ error: `${singularDisplayName} not found` });
      }

      if (authorizeRead && !authorizeRead(entity, req)) {
        return res.status(403).json({ error: forbiddenMessage });
      }

      res.json({ [itemWrapper]: entity });
    } catch (error) {
      console.error(`Error reading ${entityName}:`, error);
      throw new Error(`Failed to read ${singularDisplayName}`);
    }
  }));

  // DELETE /api/campaigns/:campaign/[entityName]/:id — delete one by idField
  router.delete(`/api/campaigns/:campaign/${entityName}/:id`, asyncHandler((req, res) => {
    try {
      const { campaign, id } = req.params;
      const decodedId = decodeURIComponent(id);
      const filePath = getFilePath(campaign);

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: `${singularDisplayName} not found` });
      }

      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      const entities = Array.isArray(data) ? data : [];
      const entity = entities.find(e => e[idField] === decodedId);
      if (onDelete && entity) {
        onDelete(entity, campaign);
      }
      const filtered = entities.filter(e => e[idField] !== decodedId);

      fs.writeFileSync(filePath, JSON.stringify(filtered, null, 2));

      res.json({ success: true });
    } catch (error) {
      console.error(`Error deleting ${entityName}:`, error);
      throw new Error(`Failed to delete ${pluralDisplayName}`);
    }
  }));

  extraRoutes(router, entityName);

  return router;
}
