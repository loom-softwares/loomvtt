import type { Request, Response } from 'express';
import { PackageManager } from '../database/managers/package-manager.js';
import { logger } from '../utils/logger.js';

const packageManager = PackageManager.getInstance();

export class PackageController {
  // Get all packages
  static async getAllPackages(req: Request, res: Response): Promise<void> {
    try {
      const { type, compatible } = req.query;
      
      let packages;
      if (type && typeof type === 'string') {
        packages = await packageManager.getPackagesByType(type as any);
      } else if (compatible === 'true') {
        packages = await packageManager.getCompatiblePackages();
      } else {
        packages = await packageManager.getAllPackages();
      }

      res.json({
        success: true,
        data: packages
      });
    } catch (error) {
      logger.error('Error getting packages', { error: (error as Error).message });
      res.status(500).json({
        success: false,
        error: 'Failed to get packages'
      });
    }
  }

  // Get package by ID
  static async getPackageById(req: Request, res: Response): Promise<void> {
    try {
      const id = req.params.id as string;
      const pkg = await packageManager.getPackageById(id);

      if (!pkg) {
        res.status(404).json({
          success: false,
          error: 'Package not found'
        });
        return;
      }

      res.json({
        success: true,
        data: pkg
      });
    } catch (error) {
      logger.error('Error getting package', { error: (error as Error).message, id: req.params.id });
      res.status(500).json({
        success: false,
        error: 'Failed to get package'
      });
    }
  }

  // Install package
  static async installPackage(req: Request, res: Response): Promise<void> {
    try {
      const packageData = req.body;
      
      // Validate required fields
      if (!packageData.name || !packageData.type || !packageData.version) {
        res.status(400).json({
          success: false,
          error: 'Missing required fields: name, type, version'
        });
        return;
      }

      const packageId = await packageManager.installPackage(packageData);

      res.status(201).json({
        success: true,
        data: { id: packageId, ...packageData }
      });
    } catch (error) {
      logger.error('Error installing package', { error: (error as Error).message });
      res.status(500).json({
        success: false,
        error: 'Failed to install package'
      });
    }
  }

  // Update package
  static async updatePackage(req: Request, res: Response): Promise<void> {
    try {
      const id = req.params.id as string;
      const updates = req.body;

      await packageManager.updatePackage(id, updates);

      res.json({
        success: true,
        message: 'Package updated successfully'
      });
    } catch (error) {
      logger.error('Error updating package', { error: (error as Error).message, id: req.params.id });
      res.status(500).json({
        success: false,
        error: 'Failed to update package'
      });
    }
  }

  // Delete package
  static async deletePackage(req: Request, res: Response): Promise<void> {
    try {
      const id = req.params.id as string;

      await packageManager.deletePackage(id);

      res.json({
        success: true,
        message: 'Package deleted successfully'
      });
    } catch (error) {
      logger.error('Error deleting package', { error: (error as Error).message, id: req.params.id });
      res.status(500).json({
        success: false,
        error: 'Failed to delete package'
      });
    }
  }

  // Toggle package active state
  static async togglePackage(req: Request, res: Response): Promise<void> {
    try {
      const id = req.params.id as string;
      const { enabled } = req.body;

      if (typeof enabled !== 'boolean') {
        res.status(400).json({
          success: false,
          error: 'Enabled field must be a boolean'
        });
        return;
      }

      await packageManager.togglePackage(id, enabled);

      res.json({
        success: true,
        message: `Package ${enabled ? 'activated' : 'deactivated'} successfully`
      });
    } catch (error) {
      logger.error('Error toggling package', { error: (error as Error).message, id: req.params.id });
      res.status(500).json({
        success: false,
        error: 'Failed to toggle package'
      });
    }
  }

  // Get world packages
  static async getWorldPackages(req: Request, res: Response): Promise<void> {
    try {
      const worldId = req.params.worldId as string;
      const packages = await packageManager.getWorldPackages(worldId);

      res.json({
        success: true,
        data: packages
      });
    } catch (error) {
      logger.error('Error getting world packages', { error: (error as Error).message, worldId: req.params.worldId });
      res.status(500).json({
        success: false,
        error: 'Failed to get world packages'
      });
    }
  }

  // Add package to world
  static async addWorldPackage(req: Request, res: Response): Promise<void> {
    try {
      const { worldId, packageId } = req.params as any;
      const { config = {} } = req.body;

      const worldPackageId = await packageManager.addWorldPackage(worldId, packageId, config);

      res.status(201).json({
        success: true,
        data: { id: worldPackageId, worldId, packageId, config }
      });
    } catch (error) {
      logger.error('Error adding world package', { error: (error as Error).message, worldId: req.params.worldId, packageId: req.params.packageId });
      res.status(500).json({
        success: false,
        error: 'Failed to add world package'
      });
    }
  }

  // Update world package
  static async updateWorldPackage(req: Request, res: Response): Promise<void> {
    try {
      const { worldId, packageId } = req.params as any;
      const updates = req.body;

      await packageManager.updateWorldPackage(worldId, packageId, updates);

      res.json({
        success: true,
        message: 'World package updated successfully'
      });
    } catch (error) {
      logger.error('Error updating world package', { error: (error as Error).message, worldId: req.params.worldId, packageId: req.params.packageId });
      res.status(500).json({
        success: false,
        error: 'Failed to update world package'
      });
    }
  }

  // Remove package from world
  static async removeWorldPackage(req: Request, res: Response): Promise<void> {
    try {
      const { worldId, packageId } = req.params as any;

      await packageManager.removeWorldPackage(worldId, packageId);

      res.json({
        success: true,
        message: 'World package removed successfully'
      });
    } catch (error) {
      logger.error('Error removing world package', { error: (error as Error).message, worldId: req.params.worldId, packageId: req.params.packageId });
      res.status(500).json({
        success: false,
        error: 'Failed to remove world package'
      });
    }
  }

  // Set world package order
  static async setWorldPackageOrder(req: Request, res: Response): Promise<void> {
    try {
      const worldId = req.params.worldId as string;
      const { packageOrders } = req.body;

      if (!Array.isArray(packageOrders)) {
        res.status(400).json({
          success: false,
          error: 'packageOrders must be an array'
        });
        return;
      }

      await packageManager.setWorldPackageOrder(worldId, packageOrders);

      res.json({
        success: true,
        message: 'World package order updated successfully'
      });
    } catch (error) {
      logger.error('Error setting world package order', { error: (error as Error).message, worldId: req.params.worldId });
      res.status(500).json({
        success: false,
        error: 'Failed to set world package order'
      });
    }
  }

  // Get package dependencies
  static async getPackageDependencies(req: Request, res: Response): Promise<void> {
    try {
      const id = req.params.id as string;
      const dependencies = await packageManager.getPackageDependencies(id);

      res.json({
        success: true,
        data: dependencies
      });
    } catch (error) {
      logger.error('Error getting package dependencies', { error: (error as Error).message, id: req.params.id });
      res.status(500).json({
        success: false,
        error: 'Failed to get package dependencies'
      });
    }
  }

  // Validate package dependencies
  static async validatePackageDependencies(req: Request, res: Response): Promise<void> {
    try {
      const id = req.params.id as string;
      const validation = await packageManager.validatePackageDependencies(id);

      res.json({
        success: true,
        data: validation
      });
    } catch (error) {
      logger.error('Error validating package dependencies', { error: (error as Error).message, id: req.params.id });
      res.status(500).json({
        success: false,
        error: 'Failed to validate package dependencies'
      });
    }
  }

  // Get world package manifest
  static async getWorldPackageManifest(req: Request, res: Response): Promise<void> {
    try {
      const worldId = req.params.worldId as string;
      const manifest = await packageManager.getWorldPackageManifest(worldId);

      res.json({
        success: true,
        data: manifest
      });
    } catch (error) {
      logger.error('Error getting world package manifest', { error: (error as Error).message, worldId: req.params.worldId });
      res.status(500).json({
        success: false,
        error: 'Failed to get world package manifest'
      });
    }
  }
}