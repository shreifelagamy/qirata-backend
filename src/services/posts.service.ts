import * as cheerio from 'cheerio';
import TurndownService from 'turndown';
import { EntityManager } from 'typeorm';
import { AppDataSource } from '../app';
import { CreatePostDto, UpdatePostDto } from '../dtos/post.dto';
import { PostExpanded } from '../entities/post-expanded.entity';
import { Post } from '../entities/post.entity';
import { HttpError } from '../middleware/error.middleware';
import { PostModel } from '../models/post.model';
import { logger } from '../utils/logger';
import { ChatSessionService } from './chat-session.service';
import scraper from './content/scraper.service';

interface PostFilters {
    read?: boolean;
    link_id?: string;
    search?: string;
    limit?: number;
    offset?: number;
    external_links?: string[];
}

export class PostsService {
    private postModel: PostModel;
    private chatSessionService: ChatSessionService;
    private turndownService: TurndownService;

    constructor() {
        this.postModel = new PostModel();
        this.chatSessionService = new ChatSessionService();
        this.turndownService = new TurndownService({
            headingStyle: 'atx',
            codeBlockStyle: 'fenced',
        });
    }

    async createPost(data: CreatePostDto, entityManager?: EntityManager): Promise<Post> {
        try {
            return await this.postModel.create(data, entityManager);
        } catch (error) {
            logger.error('Error creating post:', error);
            throw new HttpError(500, 'Failed to create post');
        }
    }

    async createMany(data: CreatePostDto[], entityManager?: EntityManager): Promise<Post[] | undefined> {
        try {
            if (!data.length) return;

            const manager = entityManager || AppDataSource.manager;
            const postEntities = data.map((model: CreatePostDto) => manager.create(Post, model));

            return await manager.save(postEntities);
        } catch (error) {
            logger.error('Error creating multiple posts:', error);
            throw new HttpError(500, 'Failed to create posts');
        }
    }

    async getPosts(filters: PostFilters): Promise<[Post[], number]> {
        try {
            return await this.postModel.findAll(filters);
        } catch (error) {
            logger.error('Error getting posts:', error);
            throw new HttpError(500, 'Failed to get posts');
        }
    }

    async getPost(id: string): Promise<Post> {
        try {
            return await this.postModel.findById(id);
        } catch (error) {
            logger.error(`Error getting post ${id}:`, error);
            throw new HttpError(500, 'Failed to get post');
        }
    }

    async updatePost(id: string, data: UpdatePostDto): Promise<Post> {
        try {
            return await this.postModel.update(id, data);
        } catch (error) {
            logger.error(`Error updating post ${id}:`, error);
            throw new HttpError(500, 'Failed to update post');
        }
    }

    async deletePost(id: string): Promise<void> {
        try {
            await this.postModel.delete(id);
        } catch (error) {
            logger.error(`Error deleting post ${id}:`, error);
            throw new HttpError(500, 'Failed to delete post');
        }
    }

    async markAsRead(id: string): Promise<Post> {
        try {
            return await this.postModel.markAsRead(id);
        } catch (error) {
            logger.error(`Error marking post ${id} as read:`, error);
            throw new HttpError(500, 'Failed to mark post as read');
        }
    }

    async getExpanded(id: string): Promise<PostExpanded> {
        try {
            return await this.postModel.findExpandedById(id);
        } catch (error) {
            logger.error(`Error getting expanded post ${id}:`, error);
            throw new HttpError(500, 'Failed to get expanded post data');
        }
    }

    async expandPost(id: string): Promise<Post & { chat_session_id: string }> {
        try {
            // Get the post
            const post = await this.getPost(id);
            if (!post) {
                throw new HttpError(404, 'Post not found');
            }

            // Check if chat session exists, create one if it doesn't
            let chatSession = await this.chatSessionService.findByPostId(id);
            if (!chatSession) {
                chatSession = await this.chatSessionService.create({
                    title: `Discussing: ${post.title}`,
                    postId: post.id
                });
            }

            // Check if expanded content exists, create it if it doesn't
            const existingExpanded = await this.postModel.findExpandedById(id).catch(() => null);
            if (!existingExpanded) {
                // Create new PostExpanded record
                const expanded = new PostExpanded({ post_id: id });

                // Fetch and parse content
                const scrapedContent = await scraper.scrapeUrl(post.external_link);
                expanded.content = this.turndownService.turndown(scrapedContent.content).replace(/\s+/g, ' ').trim();

                // Look for "read more" links
                const $ = cheerio.load(scrapedContent.content);
                const readMoreLinks = $('a').filter((_, el) => {
                    const text = $(el).text().toLowerCase();
                    return text.includes('read more') ||
                        text.includes('continue reading') ||
                        text.includes('full article');
                });

                // Follow read more links and append content
                if (readMoreLinks.length > 0) {
                    try {
                        const href = readMoreLinks.first().attr('href');
                        if (href) {
                            const moreContent = await scraper.scrapeUrl(href);
                            expanded.content += ' ' + this.turndownService.turndown(moreContent.content).replace(/\s+/g, ' ').trim();
                        }
                    } catch (error) {
                        logger.warn(`Failed to fetch read more content for post ${id}:`, error);
                    }
                }

                // Save expanded content
                await AppDataSource.manager.save(PostExpanded, expanded);
            }

            // Return post with chat session id
            return {
                ...post,
                chat_session_id: chatSession!.id
            } as Post & { chat_session_id: string };
        } catch (error) {
            logger.error(`Error expanding post ${id}:`, error);
            throw error instanceof HttpError ? error : new HttpError(500, 'Failed to expand post');
        }
    }
}