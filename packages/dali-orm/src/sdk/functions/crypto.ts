/**
 * crypto::* — SurrealDB cryptographic function wrappers.
 *
 * All functions return SqlExpr for composition.
 */

import type { SqlExpr } from './sql.js';

export function cryptoMd5(str: SqlExpr): SqlExpr {
  return `crypto::md5(${str})` as SqlExpr;
}

export function cryptoSha1(str: SqlExpr): SqlExpr {
  return `crypto::sha1(${str})` as SqlExpr;
}

export function cryptoSha256(str: SqlExpr): SqlExpr {
  return `crypto::sha256(${str})` as SqlExpr;
}

export function cryptoSha512(str: SqlExpr): SqlExpr {
  return `crypto::sha512(${str})` as SqlExpr;
}

export function cryptoArgon2Generate(password: SqlExpr): SqlExpr {
  return `crypto::argon2::generate(${password})` as SqlExpr;
}

export function cryptoArgon2Compare(password: SqlExpr, hash: SqlExpr): SqlExpr {
  return `crypto::argon2::compare(${password}, ${hash})` as SqlExpr;
}

export function cryptoBlake3(data: SqlExpr): SqlExpr {
  return `crypto::blake3(${data})` as SqlExpr;
}

export function cryptoBcryptGenerate(password: SqlExpr): SqlExpr {
  return `crypto::bcrypt::generate(${password})` as SqlExpr;
}

export function cryptoBcryptCompare(password: SqlExpr, hash: SqlExpr): SqlExpr {
  return `crypto::bcrypt::compare(${password}, ${hash})` as SqlExpr;
}

export function cryptoScryptGenerate(password: SqlExpr): SqlExpr {
  return `crypto::scrypt::generate(${password})` as SqlExpr;
}

export function cryptoScryptCompare(password: SqlExpr, hash: SqlExpr): SqlExpr {
  return `crypto::scrypt::compare(${password}, ${hash})` as SqlExpr;
}

export function cryptoPbkdf2Generate(password: SqlExpr, key: SqlExpr): SqlExpr {
  return `crypto::pbkdf2::generate(${password}, ${key})` as SqlExpr;
}

export function cryptoPbkdf2Compare(password: SqlExpr, hash: SqlExpr): SqlExpr {
  return `crypto::pbkdf2::compare(${password}, ${hash})` as SqlExpr;
}

export function cryptoUuidV4(): SqlExpr {
  return `crypto::uuid::v4()` as SqlExpr;
}

export function cryptoJoaat(data: SqlExpr): SqlExpr {
  return `crypto::joaat(${data})` as SqlExpr;
}

export function cryptoUuidV7(): SqlExpr {
  return `crypto::uuid::v7()` as SqlExpr;
}
