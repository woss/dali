export declare const workspacesTable: import("@woss/dali-orm").TableDefinition & {
    _columns: {
        readonly name: import("@woss/dali-orm/sdk/schema/column/simple-builders").Builder<"string">;
        readonly description: import("@woss/dali-orm/sdk/schema/column/simple-builders").Builder<"string">;
        readonly is_personal: import("@woss/dali-orm/sdk/schema/column/simple-builders").Builder<"bool">;
        readonly created_at: import("@woss/dali-orm/sdk/schema/column/simple-builders").Builder<"datetime">;
    };
    $id(id: string | number): string;
};
export declare const memoriesTable: import("@woss/dali-orm").TableDefinition & {
    _columns: {
        readonly name: import("@woss/dali-orm/sdk/schema/column/simple-builders").Builder<"string">;
        readonly content: import("@woss/dali-orm/sdk/schema/column/simple-builders").Builder<"string">;
        readonly memory_type: import("@woss/dali-orm/sdk/schema/column/simple-builders").Builder<"string">;
        readonly metadata: import("@woss/dali-orm/sdk/schema/column/simple-builders").Builder<"object">;
        readonly workspace_id: {
            build(tableName?: string, columnName?: string): import("@woss/dali-orm").ColumnDefinition;
            reference(opts: {
                onDelete: "CASCADE" | "SET NULL" | "RESTRICT";
            }): {
                build(tableName?: string, columnName?: string): import("@woss/dali-orm").ColumnDefinition;
                reference(opts: {
                    onDelete: "CASCADE" | "SET NULL" | "RESTRICT";
                }): any;
                name: string;
                optional(): import("@woss/dali-orm/sdk/schema/column/simple-builders").Builder<"record">;
                default(value: string | boolean | number): import("@woss/dali-orm/sdk/schema/column/simple-builders").Builder<"record">;
                defaultRaw(expr: string): import("@woss/dali-orm/sdk/schema/column/simple-builders").Builder<"record">;
                defaultNow(): import("@woss/dali-orm/sdk/schema/column/simple-builders").Builder<"record">;
                unique(): import("@woss/dali-orm/sdk/schema/column/simple-builders").Builder<"record">;
                flexible(): import("@woss/dali-orm/sdk/schema/column/simple-builders").Builder<"record">;
                readonly(): import("@woss/dali-orm/sdk/schema/column/simple-builders").Builder<"record">;
                assert(expr: string): import("@woss/dali-orm/sdk/schema/column/simple-builders").Builder<"record">;
                permissions(perms: string): import("@woss/dali-orm/sdk/schema/column/simple-builders").Builder<"record">;
            };
            name: string;
            optional(): import("@woss/dali-orm/sdk/schema/column/simple-builders").Builder<"record">;
            default(value: string | boolean | number): import("@woss/dali-orm/sdk/schema/column/simple-builders").Builder<"record">;
            defaultRaw(expr: string): import("@woss/dali-orm/sdk/schema/column/simple-builders").Builder<"record">;
            defaultNow(): import("@woss/dali-orm/sdk/schema/column/simple-builders").Builder<"record">;
            unique(): import("@woss/dali-orm/sdk/schema/column/simple-builders").Builder<"record">;
            flexible(): import("@woss/dali-orm/sdk/schema/column/simple-builders").Builder<"record">;
            readonly(): import("@woss/dali-orm/sdk/schema/column/simple-builders").Builder<"record">;
            assert(expr: string): import("@woss/dali-orm/sdk/schema/column/simple-builders").Builder<"record">;
            permissions(perms: string): import("@woss/dali-orm/sdk/schema/column/simple-builders").Builder<"record">;
        };
        readonly created_at: import("@woss/dali-orm/sdk/schema/column/simple-builders").Builder<"datetime">;
    };
    $id(id: string | number): string;
};
export declare const embeddingsTable: import("@woss/dali-orm").TableDefinition & {
    _columns: {
        readonly vector: import("@woss/dali-orm/sdk/schema/column/simple-builders").Builder<"array">;
        readonly model: {
            build(tableName?: string, columnName?: string): import("@woss/dali-orm").ColumnDefinition;
            reference(opts: {
                onDelete: "CASCADE" | "SET NULL" | "RESTRICT";
            }): {
                build(tableName?: string, columnName?: string): import("@woss/dali-orm").ColumnDefinition;
                reference(opts: {
                    onDelete: "CASCADE" | "SET NULL" | "RESTRICT";
                }): any;
                name: string;
                optional(): import("@woss/dali-orm/sdk/schema/column/simple-builders").Builder<"record">;
                default(value: string | boolean | number): import("@woss/dali-orm/sdk/schema/column/simple-builders").Builder<"record">;
                defaultRaw(expr: string): import("@woss/dali-orm/sdk/schema/column/simple-builders").Builder<"record">;
                defaultNow(): import("@woss/dali-orm/sdk/schema/column/simple-builders").Builder<"record">;
                unique(): import("@woss/dali-orm/sdk/schema/column/simple-builders").Builder<"record">;
                flexible(): import("@woss/dali-orm/sdk/schema/column/simple-builders").Builder<"record">;
                readonly(): import("@woss/dali-orm/sdk/schema/column/simple-builders").Builder<"record">;
                assert(expr: string): import("@woss/dali-orm/sdk/schema/column/simple-builders").Builder<"record">;
                permissions(perms: string): import("@woss/dali-orm/sdk/schema/column/simple-builders").Builder<"record">;
            };
            name: string;
            optional(): import("@woss/dali-orm/sdk/schema/column/simple-builders").Builder<"record">;
            default(value: string | boolean | number): import("@woss/dali-orm/sdk/schema/column/simple-builders").Builder<"record">;
            defaultRaw(expr: string): import("@woss/dali-orm/sdk/schema/column/simple-builders").Builder<"record">;
            defaultNow(): import("@woss/dali-orm/sdk/schema/column/simple-builders").Builder<"record">;
            unique(): import("@woss/dali-orm/sdk/schema/column/simple-builders").Builder<"record">;
            flexible(): import("@woss/dali-orm/sdk/schema/column/simple-builders").Builder<"record">;
            readonly(): import("@woss/dali-orm/sdk/schema/column/simple-builders").Builder<"record">;
            assert(expr: string): import("@woss/dali-orm/sdk/schema/column/simple-builders").Builder<"record">;
            permissions(perms: string): import("@woss/dali-orm/sdk/schema/column/simple-builders").Builder<"record">;
        };
        readonly dimensions: import("@woss/dali-orm/sdk/schema/column/simple-builders").Builder<"int">;
        readonly created_at: import("@woss/dali-orm/sdk/schema/column/simple-builders").Builder<"datetime">;
    };
    $id(id: string | number): string;
};
export declare const modelsTable: import("@woss/dali-orm").TableDefinition & {
    _columns: {
        readonly provider_id: import("@woss/dali-orm/sdk/schema/column/simple-builders").Builder<"string">;
        readonly model_id: import("@woss/dali-orm/sdk/schema/column/simple-builders").Builder<"string">;
        readonly variant: import("@woss/dali-orm/sdk/schema/column/simple-builders").Builder<"string">;
        readonly dimensions: import("@woss/dali-orm/sdk/schema/column/simple-builders").Builder<"int">;
        readonly created_at: import("@woss/dali-orm/sdk/schema/column/simple-builders").Builder<"datetime">;
    };
    $id(id: string | number): string;
};
export declare const hasEmbeddingTable: import("@woss/dali-orm").TableDefinition & {
    _columns: {};
    $id(id: string | number): string;
};
export declare const tagsTable: import("@woss/dali-orm").TableDefinition & {
    _columns: {
        readonly name: import("@woss/dali-orm/sdk/schema/column/simple-builders").Builder<"string">;
    };
    $id(id: string | number): string;
};
export declare const memoryTagsTable: import("@woss/dali-orm").TableDefinition & {
    _columns: {
        readonly in: {
            build(tableName?: string, columnName?: string): import("@woss/dali-orm").ColumnDefinition;
            reference(opts: {
                onDelete: "CASCADE" | "SET NULL" | "RESTRICT";
            }): {
                build(tableName?: string, columnName?: string): import("@woss/dali-orm").ColumnDefinition;
                reference(opts: {
                    onDelete: "CASCADE" | "SET NULL" | "RESTRICT";
                }): any;
                name: string;
                optional(): import("@woss/dali-orm/sdk/schema/column/simple-builders").Builder<"record">;
                default(value: string | boolean | number): import("@woss/dali-orm/sdk/schema/column/simple-builders").Builder<"record">;
                defaultRaw(expr: string): import("@woss/dali-orm/sdk/schema/column/simple-builders").Builder<"record">;
                defaultNow(): import("@woss/dali-orm/sdk/schema/column/simple-builders").Builder<"record">;
                unique(): import("@woss/dali-orm/sdk/schema/column/simple-builders").Builder<"record">;
                flexible(): import("@woss/dali-orm/sdk/schema/column/simple-builders").Builder<"record">;
                readonly(): import("@woss/dali-orm/sdk/schema/column/simple-builders").Builder<"record">;
                assert(expr: string): import("@woss/dali-orm/sdk/schema/column/simple-builders").Builder<"record">;
                permissions(perms: string): import("@woss/dali-orm/sdk/schema/column/simple-builders").Builder<"record">;
            };
            name: string;
            optional(): import("@woss/dali-orm/sdk/schema/column/simple-builders").Builder<"record">;
            default(value: string | boolean | number): import("@woss/dali-orm/sdk/schema/column/simple-builders").Builder<"record">;
            defaultRaw(expr: string): import("@woss/dali-orm/sdk/schema/column/simple-builders").Builder<"record">;
            defaultNow(): import("@woss/dali-orm/sdk/schema/column/simple-builders").Builder<"record">;
            unique(): import("@woss/dali-orm/sdk/schema/column/simple-builders").Builder<"record">;
            flexible(): import("@woss/dali-orm/sdk/schema/column/simple-builders").Builder<"record">;
            readonly(): import("@woss/dali-orm/sdk/schema/column/simple-builders").Builder<"record">;
            assert(expr: string): import("@woss/dali-orm/sdk/schema/column/simple-builders").Builder<"record">;
            permissions(perms: string): import("@woss/dali-orm/sdk/schema/column/simple-builders").Builder<"record">;
        };
        readonly out: {
            build(tableName?: string, columnName?: string): import("@woss/dali-orm").ColumnDefinition;
            reference(opts: {
                onDelete: "CASCADE" | "SET NULL" | "RESTRICT";
            }): {
                build(tableName?: string, columnName?: string): import("@woss/dali-orm").ColumnDefinition;
                reference(opts: {
                    onDelete: "CASCADE" | "SET NULL" | "RESTRICT";
                }): any;
                name: string;
                optional(): import("@woss/dali-orm/sdk/schema/column/simple-builders").Builder<"record">;
                default(value: string | boolean | number): import("@woss/dali-orm/sdk/schema/column/simple-builders").Builder<"record">;
                defaultRaw(expr: string): import("@woss/dali-orm/sdk/schema/column/simple-builders").Builder<"record">;
                defaultNow(): import("@woss/dali-orm/sdk/schema/column/simple-builders").Builder<"record">;
                unique(): import("@woss/dali-orm/sdk/schema/column/simple-builders").Builder<"record">;
                flexible(): import("@woss/dali-orm/sdk/schema/column/simple-builders").Builder<"record">;
                readonly(): import("@woss/dali-orm/sdk/schema/column/simple-builders").Builder<"record">;
                assert(expr: string): import("@woss/dali-orm/sdk/schema/column/simple-builders").Builder<"record">;
                permissions(perms: string): import("@woss/dali-orm/sdk/schema/column/simple-builders").Builder<"record">;
            };
            name: string;
            optional(): import("@woss/dali-orm/sdk/schema/column/simple-builders").Builder<"record">;
            default(value: string | boolean | number): import("@woss/dali-orm/sdk/schema/column/simple-builders").Builder<"record">;
            defaultRaw(expr: string): import("@woss/dali-orm/sdk/schema/column/simple-builders").Builder<"record">;
            defaultNow(): import("@woss/dali-orm/sdk/schema/column/simple-builders").Builder<"record">;
            unique(): import("@woss/dali-orm/sdk/schema/column/simple-builders").Builder<"record">;
            flexible(): import("@woss/dali-orm/sdk/schema/column/simple-builders").Builder<"record">;
            readonly(): import("@woss/dali-orm/sdk/schema/column/simple-builders").Builder<"record">;
            assert(expr: string): import("@woss/dali-orm/sdk/schema/column/simple-builders").Builder<"record">;
            permissions(perms: string): import("@woss/dali-orm/sdk/schema/column/simple-builders").Builder<"record">;
        };
    };
    $id(id: string | number): string;
};
export declare const apiKeysTable: import("@woss/dali-orm").TableDefinition & {
    _columns: {
        readonly key_hash: import("@woss/dali-orm/sdk/schema/column/simple-builders").Builder<"string">;
        readonly name: import("@woss/dali-orm/sdk/schema/column/simple-builders").Builder<"string">;
        readonly created_at: import("@woss/dali-orm/sdk/schema/column/simple-builders").Builder<"datetime">;
        readonly last_used_at: import("@woss/dali-orm/sdk/schema/column/simple-builders").Builder<"datetime">;
        readonly user_id: import("@woss/dali-orm/sdk/schema/column/simple-builders").Builder<"record">;
    };
    $id(id: string | number): string;
};
export declare const usersTable: import("@woss/dali-orm").TableDefinition & {
    _columns: {
        readonly email: import("@woss/dali-orm/sdk/schema/column/simple-builders").Builder<"string">;
        readonly pass: import("@woss/dali-orm/sdk/schema/column/simple-builders").Builder<"string">;
        readonly created_at: import("@woss/dali-orm/sdk/schema/column/simple-builders").Builder<"datetime">;
    };
    $id(id: string | number): string;
};
export declare const userAccess: any;
export declare const schema: import("@woss/dali-orm").OrmSchema;
//# sourceMappingURL=schema.d.ts.map