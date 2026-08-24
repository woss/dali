/**
 * Schema Propagation Tests
 *
 * Tests that the optional schema field flows correctly through:
 * 1. BaseDriver — schema field exists, defaults to undefined, can be set
 * 2. orm-connection connect() — sets driver.schema from config.schema
 * 3. DaliORM.connect() — passes schema via orm-connection to driver
 *
 * Schema is optional everywhere for backward compatibility.
 */
export {};
//# sourceMappingURL=schema-propagation.test.d.ts.map
