export interface PostFilters {
    read?: boolean;
    link_id?: string;
    search?: string;
    source?: string;
    limit?: number;
    offset?: number;
    external_links?: string[];
    sortBy?: string;
    sortOrder?: 'ASC' | 'DESC';
}