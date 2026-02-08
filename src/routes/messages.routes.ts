import { Router } from 'express';
import { MessagesController } from '../controllers/messages.controller';
import { commonValidation, validate } from '../middleware/validation.middleware';

export function createMessagesRouter(): Router {
    const router = Router({ mergeParams: true });
    const controller = new MessagesController();

    router.get(
        '/',
        validate([
            ...commonValidation.id('sessionId'),
            ...commonValidation.cursorPagination
        ]),
        controller.index.bind(controller)
    );

    return router;
}
