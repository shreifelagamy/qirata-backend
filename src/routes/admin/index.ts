import { Router } from 'express';
import { requireAdmin } from '../../middleware/admin.middleware';
import { createAdminFeedsRouter } from './feeds.routes';

export function createAdminRouter(): Router {
    const router = Router();

    router.use(requireAdmin);
    router.use('/feeds', createAdminFeedsRouter());

    return router;
}
