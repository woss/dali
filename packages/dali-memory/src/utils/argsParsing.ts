import z from 'zod';

// custom tools can load a different zod instance whose per-instance
// .describe()/.meta() registry won't survive z.toJSONSchema(). walk
// schemas once and copy metadata into this runtime's registry.
/**
 *  Recursively walk a value and if it finds any zod schemas, re-register them with this runtime's zod registry using their .meta() or .describe() data.
 * @param value
 * @param seen
 * @returns
 */
export function rehydrateZodMeta(value: unknown, seen = new WeakSet<object>()): void {
  if (!value || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);

  if ('_zod' in value) {
    const schema = value as z.ZodType;
    const metaFn = Reflect.get(schema, 'meta');
    const meta = metaFn instanceof Function ? Reflect.apply(metaFn, schema, []) : undefined;
    const base = {} as Record<string, unknown>;
    if (meta && typeof meta === 'object' && !('_zod' in meta))
      Object.assign(base, meta as Record<string, unknown>);
    const description = Reflect.get(schema, 'description');
    if (typeof description === 'string' && base.description === undefined)
      base.description = description;
    if (Object.keys(base).length > 0) z.globalRegistry.add(schema, base);
    rehydrateZodMeta(Reflect.get(Reflect.get(schema, '_zod') as object, 'def'), seen);
    return;
  }

  const items = Array.isArray(value) ? value : Object.values(value as Record<string, unknown>);
  for (const item of items) rehydrateZodMeta(item, seen);
}

/**
 *  Validate tool arguments against a zod schema, showing a toast on error with details.
 * @param args
 * @param argsData
 * @param client
 */
export function parseTheArgs<Args extends z.ZodRawShape>(
  toolId: string,
  args: Args,
  argsData: z.infer<z.ZodObject<Args>>,
) {
  for (const value of Object.values(args)) {
    rehydrateZodMeta(value);
  }

  const testToolSchema = z.object(args);

  const validated = testToolSchema.safeParse(argsData);
  if (!validated.success) {
    const errorMessage = `The ${toolId} tool was called with invalid arguments: ${validated.error}.\nRewrite the input.`;

    throw new Error(errorMessage);
  }

  return validated.data;
}
