import { Router } from 'express';
import { ModuleSettingsDocument } from '../schemas/module-settings.schema.js';
import { logger } from '../utils/logger.js';
import { requireAuth, requireWorldMatch } from '../middleware/auth.js';

export const moduleSettingsRouter = Router();

// Apply authentication and world matching middleware to all routes
moduleSettingsRouter.use(requireAuth, requireWorldMatch);

/**
 * GET /api/module-settings/:worldId/:moduleId
 * Get all settings for a specific module in a world
 */
moduleSettingsRouter.get('/:worldId/:moduleId', async (req, res) => {
  try {
    const { worldId, moduleId } = req.params;
    
    const settings = await ModuleSettingsDocument.find({
      worldId,
      moduleId,
    });
    
    // Convert to key-value object
    const result: Record<string, any> = {};
    settings.forEach((setting: any) => {
      result[setting.key] = setting.value;
    });
    
    res.json({
      data: result,
      error: null,
    });
  } catch (error: any) {
    logger.error('Failed to get module settings:', error);
    res.status(500).json({
      data: null,
      error: error.message || 'Failed to get module settings',
    });
  }
});

/**
 * PUT /api/module-settings/:worldId/:moduleId/:key
 * Upsert a single setting for a module
 */
moduleSettingsRouter.put('/:worldId/:moduleId/:key', async (req, res) => {
  try {
    const { worldId, moduleId, key } = req.params;
    const { value, scope = 'world' } = req.body;
    
    // Validate request body
    if (value === undefined) {
      return res.status(400).json({
        data: null,
        error: 'Value is required',
      });
    }
    
    if (scope !== 'world' && scope !== 'client') {
      return res.status(400).json({
        data: null,
        error: 'Scope must be either "world" or "client"',
      });
    }
    
    // Check if setting exists
    const existing = await ModuleSettingsDocument.findOne({
      worldId,
      moduleId,
      key,
    });
    
    if (existing) {
      // Update existing setting
      const result = await ModuleSettingsDocument.update(existing.id, {
        value,
        scope,
      });
      
      if (result.error) {
        return res.status(500).json({
          data: null,
          error: result.error,
        });
      }
      
      res.json({
        data: result.data,
        error: null,
      });
    } else {
      // Create new setting
      const result = await ModuleSettingsDocument.create({
        worldId,
        moduleId,
        key,
        value,
        scope,
      });
      
      if (result.error) {
        return res.status(500).json({
          data: null,
          error: result.error,
        });
      }
      
      res.status(201).json({
        data: result.data,
        error: null,
      });
    }
  } catch (error: any) {
    logger.error('Failed to upsert module setting:', error);
    res.status(500).json({
      data: null,
      error: error.message || 'Failed to upsert module setting',
    });
  }
});

/**
 * DELETE /api/module-settings/:worldId/:moduleId/:key
 * Delete a specific setting for a module
 */
moduleSettingsRouter.delete('/:worldId/:moduleId/:key', async (req, res) => {
  try {
    const { worldId, moduleId, key } = req.params;
    
    // Find the setting first
    const setting = await ModuleSettingsDocument.findOne({
      worldId,
      moduleId,
      key,
    });
    
    if (!setting) {
      return res.status(404).json({
        data: null,
        error: 'Setting not found',
      });
    }
    
    // Delete the setting
    const result = await ModuleSettingsDocument.delete(setting.id);
    
    if (!result.success) {
      return res.status(500).json({
        data: null,
        error: result.error || 'Failed to delete setting',
      });
    }
    
    res.json({
      data: { deleted: true },
      error: null,
    });
  } catch (error: any) {
    logger.error('Failed to delete module setting:', error);
    res.status(500).json({
      data: null,
      error: error.message || 'Failed to delete module setting',
    });
  }
});