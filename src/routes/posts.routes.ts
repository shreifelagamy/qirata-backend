import { Router } from 'express';
import { body } from 'express-validator';
import { PostsController } from '../controllers/posts.controller';
import { validate, commonValidation } from '../middleware/validation.middleware';

export function createPostsRouter(): Router {
  const router = Router();
  const postsController = new PostsController();

  // DEPRECATED: Sources endpoint has been deprecated in favor of feed subscriptions
  // Use /api/v1/feeds/subscriptions instead
  // router.get(
  //   '/sources',
  //   postsController.sources.bind(postsController)
  // );

  // REST API: GET /posts - Get all posts (with filters and pagination)
  router.get(
    '/',
    validate([
      ...commonValidation.pagination,
      ...commonValidation.search,
      body('read').optional().isBoolean(),
      body('link_id').optional().isUUID(),
      body('source').optional().isString().trim()
    ]),
    postsController.index.bind(postsController)
  );

  // REST API: PATCH /posts/:id/read - Mark post as read (resource state change)
  router.patch(
    '/:id/read',
    validate(commonValidation.id()),
    postsController.read.bind(postsController)
  );

  // REST API: PATCH /posts/:id/bookmark - Toggle bookmark status
  router.patch(
    '/:id/bookmark',
    validate(commonValidation.id()),
    postsController.bookmark.bind(postsController)
  );

  // REST API: GET /posts/:id/discuss - Start discussion with AI (triggers content prep + chat session)
  router.get(
    '/:id/discuss',
    validate(commonValidation.id()),
    postsController.discuss.bind(postsController)
  );

  return router;
}