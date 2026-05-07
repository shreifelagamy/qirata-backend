import { Router } from 'express';
import { AdminFeedsController } from '../../controllers/admin/feeds.controller';

export function createAdminFeedsRouter(): Router {
    const router = Router();
    const controller = new AdminFeedsController();

    router.get('/', controller.list);
    router.get('/:id', controller.detail);
    router.get('/:id/logs', controller.logs);
    router.post('/:id/sync', controller.sync);

    return router;
}
