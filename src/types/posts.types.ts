export interface PostFilters {
    read?: boolean;
    link_id?: string;
    search?: string;
    feed_id?: string;
    limit?: number;
    offset?: number;
    external_links?: string[];
    sortBy?: string;
    sortOrder?: 'ASC' | 'DESC';
}

export interface ProgressEvent {
    state: string;
    step: string;
    progress: number;
    meta?: any;
}

export interface PrepareDiscussionResult {
    chat_session_id: string;
}