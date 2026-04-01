# the idea

we are building an ORM for surrealdb with as little code and abstractions as possible. surrealdb js client is alreadu vergy good and has query builder. we need to add few more features:

1. production grade migrations like drizzle (./DRIZZLE_SQLITE_MIGRATION_REPORT.md).
2. runtime data validation for the queries and the results. we can use valibot for this. surrealdb accepts generics, that's great
3. thin orm layer based on the table schemas
4. through orm we must be able to do all the operations like define access,variables, run queries, transactions, etc. we can use the query builder of surrealdb client for this. we just need to add some sugar on top of it to make it more user friendly and type safe. see (./SDK_ARCHITECTURE_REPORT.md)
5. migrations mimic drizzle with additional features from surrealdb
6. code friendly to coding agents
