/**
 * crypto::* — SurrealDB cryptographic function wrappers.
 *
 * All functions return SqlExpr for composition.
 */
import type { SqlExpr } from './sql.js';
export declare function cryptoMd5(str: SqlExpr): SqlExpr;
export declare function cryptoSha1(str: SqlExpr): SqlExpr;
export declare function cryptoSha256(str: SqlExpr): SqlExpr;
export declare function cryptoSha512(str: SqlExpr): SqlExpr;
export declare function cryptoArgon2Generate(password: SqlExpr): SqlExpr;
export declare function cryptoArgon2Compare(password: SqlExpr, hash: SqlExpr): SqlExpr;
export declare function cryptoBlake3(data: SqlExpr): SqlExpr;
export declare function cryptoBcryptGenerate(password: SqlExpr): SqlExpr;
export declare function cryptoBcryptCompare(password: SqlExpr, hash: SqlExpr): SqlExpr;
export declare function cryptoScryptGenerate(password: SqlExpr): SqlExpr;
export declare function cryptoScryptCompare(password: SqlExpr, hash: SqlExpr): SqlExpr;
export declare function cryptoPbkdf2Generate(password: SqlExpr, key: SqlExpr): SqlExpr;
export declare function cryptoPbkdf2Compare(password: SqlExpr, hash: SqlExpr): SqlExpr;
export declare function cryptoUuidV4(): SqlExpr;
export declare function cryptoJoaat(data: SqlExpr): SqlExpr;
export declare function cryptoUuidV7(): SqlExpr;
//# sourceMappingURL=crypto.d.ts.map