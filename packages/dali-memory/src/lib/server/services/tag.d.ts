import type { TagRecord, MemoryRecord } from './types';
export declare class TagService {
    createTag(name: string): Promise<TagRecord>;
    getTag(id: string): Promise<TagRecord | null>;
    findByName(name: string): Promise<TagRecord | null>;
    listTags(): Promise<TagRecord[]>;
    addTagToMemory(memoryId: string, tagId: string): Promise<void>;
    removeTagFromMemory(memoryId: string, tagId: string): Promise<void>;
    getMemoryTags(memoryId: string): Promise<TagRecord[]>;
    unionTags(tagNames: string[]): Promise<MemoryRecord[]>;
    intersectTags(tagNames: string[]): Promise<MemoryRecord[]>;
}
//# sourceMappingURL=tag.d.ts.map