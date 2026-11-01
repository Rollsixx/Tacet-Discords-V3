const SLOW_QUERY_MS = 150;
const clients = new WeakMap<object, object>();

function queryMetadata(args: unknown[]) {
  const input = args[0];
  const sql = typeof input === "string"
    ? input
    : input && typeof input === "object" && "sql" in input && typeof input.sql === "string"
      ? input.sql
      : "";
  const statement = sql.match(/^\s*(SELECT|INSERT|UPDATE|DELETE|REPLACE|WITH|CREATE|ALTER|DROP)\b/i)?.[1]?.toUpperCase() ?? "UNKNOWN";
  const table = sql.match(/\b(?:FROM|INTO|UPDATE|TABLE)\s+["'`]?([a-zA-Z0-9_]+)/i)?.[1] ?? null;
  return { statement, table };
}

export function observeDatabaseClient<T extends object>(client: T): T {
  const existing = clients.get(client);
  if (existing) return existing as T;

  const observed = new Proxy(client, {
    get(target, property) {
      const method = Reflect.get(target, property, target);
      if (typeof method !== "function") return method;

      if (property === "execute") {
        return async (...args: unknown[]) => {
          const startedAt = performance.now();
          let failed = false;
          try {
            return await Reflect.apply(method, target, args);
          } catch (error) {
            failed = true;
            throw error;
          } finally {
            const durationMs = Math.round(performance.now() - startedAt);
            if (failed || durationMs >= SLOW_QUERY_MS) {
              const query = queryMetadata(args);
              console.warn(JSON.stringify({
                event: "database.query",
                statement: query.statement,
                table: query.table,
                duration_ms: durationMs,
                outcome: failed ? "error" : "slow",
              }));
            }
          }
        };
      }

      if (property === "transaction") {
        return async (...args: unknown[]) => {
          const transaction = await Reflect.apply(method, target, args) as object;
          return observeDatabaseClient(transaction);
        };
      }

      return method.bind(target);
    },
  });
  clients.set(client, observed);
  return observed;
}
