import { DaliORM } from '@woss/dali-orm';
export type DB = Awaited<ReturnType<typeof connect>>;
export declare function connect(): Promise<DaliORM>;
export declare function disconnect(): Promise<void>;
export declare function getDB(): DaliORM;
//# sourceMappingURL=connection.d.ts.map