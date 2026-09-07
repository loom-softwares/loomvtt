import { db } from '../db.js';

export interface Package {
  id: string;
  name: string;
  type: 'module' | 'system' | 'world';
  version: string;
  description: string;
  manifest: string;
  author: string;
  authorUrl: string;
  license: string;
  url: string;
  downloadUrl: string;
  downloadCount: number;
  isCompatible: boolean;
  minVersion: string;
  maxVersion: string;
  compatibility: string;
  isActive: boolean;
  installedAt: string;
  updatedAt: string;
  createdAt: string;
}

export interface WorldPackage {
  id: string;
  worldId: string;
  packageId: string;
  enabled: boolean;
  loadOrder: number;
  config: string;
  installedAt: string;
  updatedAt: string;
  createdAt: string;
}

export interface World {
  id: string;
  name: string;
  system: string;
  description: string;
  coverUrl: string;
  language: string;
  adminPassword: string;
  isActive: boolean;
  packageIds: string;
  packageConfig: string;
  createdAt: string;
  updatedAt: string;
}

export class PackageManager {
  private static instance: PackageManager;
  private db = db;

  static getInstance(): PackageManager {
    if (!PackageManager.instance) {
      PackageManager.instance = new PackageManager();
    }
    return PackageManager.instance;
  }

  // Package management methods
  async getAllPackages(): Promise<Package[]> {
    return this.db<Package>('packages').select('*');
  }

  async getPackageById(id: string): Promise<Package | undefined> {
    return this.db<Package>('packages').where('id', id).first();
  }

  async getPackagesByType(type: 'module' | 'system' | 'world'): Promise<Package[]> {
    return this.db<Package>('packages').where('type', type).select('*');
  }

  async getCompatiblePackages(currentVersion: string = '1.0.0'): Promise<Package[]> {
    return this.db<Package>('packages')
      .where('isCompatible', true)
      .where('minVersion', '<=', currentVersion)
      .where('maxVersion', '>=', currentVersion)
      .select('*');
  }

  async installPackage(packageData: Omit<Package, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const packageId = `pkg-${Date.now()}`;
    const now = new Date().toISOString();
    
    await this.db('packages').insert({
      ...packageData,
      id: packageId,
      installedAt: now,
      updatedAt: now,
      createdAt: now
    });

    return packageId;
  }

  async updatePackage(id: string, updates: Partial<Package>): Promise<void> {
    await this.db('packages')
      .where('id', id)
      .update({
        ...updates,
        updatedAt: new Date().toISOString()
      });
  }

  async deletePackage(id: string): Promise<void> {
    await this.db('packages').where('id', id).del();
  }

  async togglePackage(id: string, enabled: boolean): Promise<void> {
    await this.db('packages')
      .where('id', id)
      .update({ isActive: enabled, updatedAt: new Date().toISOString() });
  }

  // World package management methods
  async getWorldPackages(worldId: string): Promise<WorldPackage[]> {
    return this.db<WorldPackage>('world_packages')
      .where('worldId', worldId)
      .join('packages', 'world_packages.packageId', 'packages.id')
      .select('world_packages.*', 'packages.*');
  }

  async addWorldPackage(worldId: string, packageId: string, config: object = {}): Promise<string> {
    const pkg = await this.getPackageById(packageId);
    // Handoff code provided `const manifest = pkg?.manifest as any;` but `manifest` is a string in SQLite/Knex.
    const manifest = typeof pkg?.manifest === 'string' ? JSON.parse(pkg.manifest) : (pkg?.manifest as any);
    if (manifest?.paid === true) {
      const redeemed = await this.db('activation_codes')
        .where({ packageName: packageId, worldId, used: true })
        .first();
      if (!redeemed) {
        throw new Error(`Pacote "${packageId}" e pago — resgate um codigo de ativacao antes de ativar neste mundo`);
      }
    }

    const worldPackageId = `wp-${worldId}-${packageId}`;
    const now = new Date().toISOString();
    
    await this.db('world_packages').insert({
      id: worldPackageId,
      worldId,
      packageId,
      enabled: true,
      loadOrder: 0,
      config: JSON.stringify(config),
      installedAt: now,
      updatedAt: now
    });

    return worldPackageId;
  }

  async updateWorldPackage(worldId: string, packageId: string, updates: Partial<WorldPackage>): Promise<void> {
    await this.db('world_packages')
      .where('worldId', worldId)
      .where('packageId', packageId)
      .update({
        ...updates,
        updatedAt: new Date().toISOString()
      });
  }

  async removeWorldPackage(worldId: string, packageId: string): Promise<void> {
    await this.db('world_packages')
      .where('worldId', worldId)
      .where('packageId', packageId)
      .del();
  }

  async setWorldPackageOrder(worldId: string, packageOrders: { packageId: string; loadOrder: number }[]): Promise<void> {
    const now = new Date().toISOString();
    
    for (const { packageId, loadOrder } of packageOrders) {
      await this.db('world_packages')
        .where('worldId', worldId)
        .where('packageId', packageId)
        .update({ loadOrder, updatedAt: now });
    }
  }

  async getWorldPackageConfig(worldId: string, packageId: string): Promise<any> {
    const result = await this.db<WorldPackage>('world_packages')
      .where('worldId', worldId)
      .where('packageId', packageId)
      .first('config');
    
    return result ? JSON.parse(result.config) : {};
  }

  async setWorldPackageConfig(worldId: string, packageId: string, config: object): Promise<void> {
    await this.db('world_packages')
      .where('worldId', worldId)
      .where('packageId', packageId)
      .update({
        config: JSON.stringify(config),
        updatedAt: new Date().toISOString()
      });
  }

  // Utility methods
  async getPackageDependencies(packageId: string): Promise<Package[]> {
    const pkg = await this.getPackageById(packageId);
    if (!pkg || !pkg.manifest) return [];

    const manifest = JSON.parse(pkg.manifest);
    const dependencies = manifest.dependencies || {};

    const dependencyPackages: Package[] = [];
    for (const [depName, depVersion] of Object.entries(dependencies)) {
      const depPackage = await this.db<Package>('packages')
        .where('name', depName)
        .where('version', depVersion as string)
        .first();
      
      if (depPackage) {
        dependencyPackages.push(depPackage);
      }
    }

    return dependencyPackages;
  }

  async validatePackageDependencies(packageId: string): Promise<{ valid: boolean; missing: string[] }> {
    const dependencies = await this.getPackageDependencies(packageId);
    const missing: string[] = [];

    for (const dep of dependencies) {
      const installed = await this.db<Package>('packages')
        .where('id', dep.id)
        .where('isActive', true)
        .first();
      
      if (!installed) {
        missing.push(`${dep.name}@${dep.version}`);
      }
    }

    return {
      valid: missing.length === 0,
      missing
    };
  }

  async getWorldPackageManifest(worldId: string): Promise<any> {
    const worldPackages = await this.getWorldPackages(worldId);
    const manifest: any = {
      packages: {},
      config: {}
    };

    for (const wp of worldPackages as any[]) {
      if (wp.enabled) {
        manifest.packages[wp.packageId] = {
          id: wp.packageId,
          name: wp.name,
          version: wp.version,
          type: wp.type,
          config: JSON.parse(wp.config)
        };
        manifest.config[wp.packageId] = JSON.parse(wp.config);
      }
    }

    return manifest;
  }
}