export interface UniDBOptions {
  host?: string;
  port?: number;
  connectTimeout?: number;
  queryTimeout?: number;
}

export interface UniDBColumn {
  name: string;
  type: "int" | "text" | string;
}

export interface UniDBCommandResult {
  ok: true;
  kind: "command";
  message: string;
  affected_rows: number;
}

export interface UniDBRowsResult {
  ok: true;
  kind: "rows";
  columns: UniDBColumn[];
  rows: Array<Array<number | string>>;
}

export type UniDBQueryResult = UniDBCommandResult | UniDBRowsResult;

export class UniDBError extends Error {
  code: string;
}

export class UniDBConnectionError extends UniDBError {}
export class UniDBQueryError extends UniDBError {}
export class UniDBProtocolError extends UniDBError {}

export class UniDB {
  constructor(options?: UniDBOptions);
  connect(): Promise<this>;
  query(sql: string): Promise<UniDBQueryResult>;
  close(): Promise<void>;
}
