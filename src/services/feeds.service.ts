import { Repository } from 'typeorm';
import { AppDataSource } from '../app';
import { Feed } from '../entities/feed.entity';
import { UserFeed } from '../entities/user-feed.entity';
import { Link } from '../entities/link.entity';

export class FeedsService {
  private feedRepository: Repository<Feed>;
  private userFeedRepository: Repository<UserFeed>;
  private linkRepository: Repository<Link>;

  constructor() {
    this.feedRepository = AppDataSource.getRepository(Feed);
    this.userFeedRepository = AppDataSource.getRepository(UserFeed);
    this.linkRepository = AppDataSource.getRepository(Link);
  }

  // Methods will be implemented soon
  async searchFeeds(query: string, options: { limit?: number; offset?: number }) {
    throw new Error('Not implemented');
  }

  async discoverFeedFromUrl(url: string) {
    throw new Error('Not implemented');
  }

  async subscribeUserToFeed(userId: string, feedId: string, customName?: string) {
    throw new Error('Not implemented');
  }

  async subscribeUserByRssUrl(userId: string, rssUrl: string, customName?: string) {
    throw new Error('Not implemented');
  }

  async getUserSubscriptions(userId: string, options?: { limit?: number; offset?: number }) {
    throw new Error('Not implemented');
  }

  async unsubscribeUser(userId: string, feedId: string) {
    throw new Error('Not implemented');
  }
}
