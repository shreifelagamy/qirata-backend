import { Router } from 'express';
import { body } from 'express-validator';
import { PostsController } from '../controllers/posts.controller';
import { validate, commonValidation } from '../middleware/validation.middleware';

export function createPostsRouter(): Router {
  const router = Router();
  const postsController = new PostsController();

  // REST API: POST /posts - Create a new post
  router.post(
    '/',
    validate([
      body('title').isString().trim().notEmpty(),
      body('content').isString().trim().notEmpty(),
      body('link_id').isUUID(),
      body('summary').optional().isString().trim()
    ]),
    postsController.store.bind(postsController)
  );

  // REST API: GET /posts/sources - Get unique sources list (must be before /:id route)
  router.get(
    '/sources',
    postsController.sources.bind(postsController)
  );

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

  // REST API: GET /posts/:id - Get a specific post
  router.get(
    '/:id',
    validate(commonValidation.id()),
    postsController.show.bind(postsController)
  );

  // REST API: PATCH /posts/:id - Partially update a post
  router.patch(
    '/:id',
    validate([
      ...commonValidation.id(),
      body('title').optional().isString().trim(),
      body('content').optional().isString().trim(),
      body('link_id').optional().isUUID(),
      body('summary').optional().isString().trim(),
      body('read').optional().isBoolean()
    ]),
    postsController.update.bind(postsController)
  );

  // REST API: DELETE /posts/:id - Delete a post
  router.delete(
    '/:id',
    validate(commonValidation.id()),
    postsController.destroy.bind(postsController)
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

  // REST API: GET /posts/:id/expanded - Get expanded content (sub-resource)
  router.get(
    '/:id/expanded',
    validate(commonValidation.id()),
    postsController.expanded.bind(postsController)
  );

  // REST API: GET /posts/:id/expand - Trigger expansion (action on resource)
  router.get(
    '/:id/expand',
    validate(commonValidation.id()),
    postsController.expand.bind(postsController)
  );

  return router;
}