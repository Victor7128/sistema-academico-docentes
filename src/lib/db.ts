import postgres from 'postgres';

const DATABASE_URL = import.meta.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error('DATABASE_URL no está definida en .env');
}

export const sql = postgres(DATABASE_URL, {
  ssl: 'require',
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
  transform: {
    column: {
      from: (col: string) =>
        col.replace(/_([a-z])/g, (_, l) => l.toUpperCase()),
    },
  },
});

export async function query<T>(
  strings: TemplateStringsArray,
  ...values: any[]
): Promise<T[]> {
  return sql(strings, ...values) as unknown as Promise<T[]>;
}