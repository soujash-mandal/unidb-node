export class UniDBError extends Error {
  constructor(message, code = "UNIDB_ERROR", options = {}) {
    super(message, options);
    this.name = this.constructor.name;
    this.code = code;
  }
}

export class UniDBConnectionError extends UniDBError {}
export class UniDBQueryError extends UniDBError {}
export class UniDBProtocolError extends UniDBError {}
