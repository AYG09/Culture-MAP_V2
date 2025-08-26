// src/types/sql.d.ts

declare module 'sql.js' {
  interface SqlJsStatic {
    Database: new (data?: ArrayLike<number> | Buffer | null) => Database;
  }

  interface Database {
    exec(sql: string): QueryExecResult[];
    prepare(sql: string): Statement;
    export(): Uint8Array;
    close(): void;
  }

  interface Statement {
    bind(values?: unknown[]): boolean;
    step(): boolean;
    getAsObject(params?: unknown): unknown;
    free(): boolean;
  }

  interface QueryExecResult {
    columns: string[];
    values: unknown[][];
  }

  interface SqlJsConfig {
    locateFile?: (filename: string) => string;
  }

  function initSqlJs(config?: SqlJsConfig): Promise<SqlJsStatic>;
  export default initSqlJs;
}
