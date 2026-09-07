import { Router } from 'express';
import { PackageController } from '../controllers/package-controller.js';
import { requireAuth } from '../middleware/auth.js';
import { requireAdminSession } from '../api/setup.js';

const router = Router();

// Router montado em app.use('/api', ...) — nascia inteiro sem middleware, logo
// POST/PUT/DELETE/PATCH de pacote eram anonimos. Leitura exige sessao (a UI de
// modulos do GM consome), escrita exige sessao de admin de servidor: nenhuma
// escrita deste router tem consumidor no client, entao fechar nao quebra fluxo.
const readAuth = requireAuth;
const writeAuth = requireAdminSession;

// Package routes
router.get('/packages', readAuth, PackageController.getAllPackages);
router.get('/packages/:id', readAuth, PackageController.getPackageById);
router.post('/packages', writeAuth, PackageController.installPackage);
router.put('/packages/:id', writeAuth, PackageController.updatePackage);
router.delete('/packages/:id', writeAuth, PackageController.deletePackage);
router.patch('/packages/:id/toggle', writeAuth, PackageController.togglePackage);

// World package routes
router.get('/worlds/:worldId/packages', readAuth, PackageController.getWorldPackages);
router.post('/worlds/:worldId/packages/:packageId', writeAuth, PackageController.addWorldPackage);
router.put('/worlds/:worldId/packages/:packageId', writeAuth, PackageController.updateWorldPackage);
router.delete('/worlds/:worldId/packages/:packageId', writeAuth, PackageController.removeWorldPackage);
router.put('/worlds/:worldId/packages/order', writeAuth, PackageController.setWorldPackageOrder);

// Package utility routes
router.get('/packages/:id/dependencies', readAuth, PackageController.getPackageDependencies);
router.get('/packages/:id/validate', readAuth, PackageController.validatePackageDependencies);
router.get('/worlds/:worldId/packages/manifest', readAuth, PackageController.getWorldPackageManifest);

export default router;