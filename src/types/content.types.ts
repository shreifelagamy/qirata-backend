export interface RSSFeed {
    title: string;
    description?: string;
    link: string;
    language?: string;
    lastBuildDate?: Date;
    entries: FeedEntry[];
}

export interface FeedEntry {
    title: string;
    link: string;
    pubDate?: Date;
    description?: string;
    content?: string;
    author?: string;
    categories?: string[];
    guid?: string;
    image_url?: string;
}

export interface ScrapedContent {
    url: string;
    title: string;
    content: string;
    metadata: {
        description?: string;
        author?: string;
        publishDate?: Date;
        modifiedDate?: Date;
        image?: string;
        keywords?: string[];
        [key: string]: any;
    };
    timestamp: Date;
}

export interface ContentProcessingResult {
    success: boolean;
    error?: string;
    processingTime: number;
    data?: RSSFeed | ScrapedContent;
    warnings?: string[];
}