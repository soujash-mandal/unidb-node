import net from "node:net";
import { StringDecoder } from "node:string_decoder";
import {
  UniDBConnectionError,
  UniDBError,
  UniDBProtocolError,
  UniDBQueryError,
} from "./errors.js";

const MAX_REQUEST_BYTES = 64 * 1024;

export {
  UniDBConnectionError,
  UniDBError,
  UniDBProtocolError,
  UniDBQueryError,
};

export class UniDB {
  constructor({
    host = "127.0.0.1",
    port = 7432,
    connectTimeout = 5000,
    queryTimeout = 5000,
  } = {}) {
    if (typeof host !== "string" || host.length === 0) {
      throw new TypeError("host must be a non-empty string");
    }
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw new TypeError("port must be an integer between 1 and 65535");
    }
    if (!Number.isFinite(connectTimeout) || connectTimeout <= 0) {
      throw new TypeError("connectTimeout must be a positive number");
    }
    if (!Number.isFinite(queryTimeout) || queryTimeout <= 0) {
      throw new TypeError("queryTimeout must be a positive number");
    }

    this.host = host;
    this.port = port;
    this.connectTimeout = connectTimeout;
    this.queryTimeout = queryTimeout;

    this.socket = null;
    this.connected = false;
    this.connectPromise = null;
    this.connectResolve = null;
    this.connectReject = null;
    this.responseBuffer = "";
    this.decoder = new StringDecoder("utf8");
    this.pendingQueries = [];
  }

  connect() {
    if (this.connected) {
      return Promise.resolve(this);
    }
    if (this.connectPromise) {
      return this.connectPromise;
    }

    const socket = net.createConnection({ host: this.host, port: this.port });
    this.socket = socket;
    this.responseBuffer = "";
    this.decoder = new StringDecoder("utf8");

    this.connectPromise = new Promise((resolve, reject) => {
      this.connectResolve = resolve;
      this.connectReject = reject;

      const timer = setTimeout(() => {
        const error = new UniDBConnectionError(
          `Connection to ${this.host}:${this.port} timed out`,
          "CONNECT_TIMEOUT",
        );
        this.finishConnect(error);
        socket.destroy();
      }, this.connectTimeout);

      socket.once("connect", () => {
        clearTimeout(timer);
        this.connected = true;
        this.finishConnect(null);
      });

      socket.on("data", (chunk) => this.handleData(chunk));
      socket.on("error", (error) => {
        clearTimeout(timer);
        this.connected = false;
        const connectionError = new UniDBConnectionError(
          `Connection to ${this.host}:${this.port} failed: ${error.message}`,
          "CONNECTION_ERROR",
          { cause: error },
        );
        this.finishConnect(connectionError);
        this.rejectPendingQueries(connectionError);
      });
      socket.on("close", () => {
        clearTimeout(timer);
        this.connected = false;
        if (this.socket === socket) {
          this.socket = null;
        }

        const error = new UniDBConnectionError(
          "The UniDB connection was closed",
          "CONNECTION_CLOSED",
        );
        this.finishConnect(error);
        this.rejectPendingQueries(error);
      });
    });

    return this.connectPromise;
  }

  query(sql) {
    if (typeof sql !== "string" || sql.trim().length === 0) {
      return Promise.reject(new TypeError("sql must be a non-empty string"));
    }
    if (sql.includes("\n") || sql.includes("\r")) {
      return Promise.reject(
        new TypeError("UniDB currently accepts one SQL statement per line"),
      );
    }
    if (Buffer.byteLength(sql, "utf8") > MAX_REQUEST_BYTES) {
      return Promise.reject(
        new TypeError("SQL statements must be 64 KiB or smaller"),
      );
    }
    if (!this.connected || !this.socket) {
      return Promise.reject(
        new UniDBConnectionError(
          "Not connected to UniDB. Call connect() first.",
          "NOT_CONNECTED",
        ),
      );
    }

    const socket = this.socket;

    return new Promise((resolve, reject) => {
      const request = { resolve, reject, timer: null };

      request.timer = setTimeout(() => {
        const error = new UniDBError(
          `Query timed out after ${this.queryTimeout} ms; the connection was closed to avoid mismatching later responses`,
          "QUERY_TIMEOUT",
        );
        this.connected = false;
        this.rejectPendingQueries(error);
        socket.destroy();
      }, this.queryTimeout);

      this.pendingQueries.push(request);
      socket.write(`${sql}\n`, (error) => {
        if (error) {
          const connectionError = new UniDBConnectionError(
            `Could not send query: ${error.message}`,
            "WRITE_ERROR",
            { cause: error },
          );
          this.rejectPendingQueries(connectionError);
          socket.destroy();
        }
      });
    });
  }

  close() {
    const socket = this.socket;
    if (!socket) {
      return Promise.resolve();
    }

    this.connected = false;
    if (!socket.connecting && !socket.destroyed) {
      socket.end();
    } else {
      socket.destroy();
    }

    return new Promise((resolve) => {
      if (socket.destroyed) {
        resolve();
        return;
      }
      socket.once("close", resolve);
    });
  }

  finishConnect(error) {
    if (!this.connectResolve || !this.connectReject) {
      return;
    }

    const resolve = this.connectResolve;
    const reject = this.connectReject;
    this.connectResolve = null;
    this.connectReject = null;
    this.connectPromise = null;

    if (error) {
      reject(error);
    } else {
      resolve(this);
    }
  }

  handleData(chunk) {
    this.responseBuffer += this.decoder.write(chunk);

    while (true) {
      const newline = this.responseBuffer.indexOf("\n");
      if (newline === -1) {
        return;
      }

      const line = this.responseBuffer.slice(0, newline);
      this.responseBuffer = this.responseBuffer.slice(newline + 1);

      let response;
      try {
        response = JSON.parse(line);
      } catch (error) {
        this.failProtocol(
          new UniDBProtocolError(
            `UniDB sent invalid JSON: ${error.message}`,
            "INVALID_JSON",
            { cause: error },
          ),
        );
        return;
      }

      if (!response || typeof response.ok !== "boolean") {
        this.failProtocol(
          new UniDBProtocolError(
            "UniDB sent a response without a boolean 'ok' field",
            "INVALID_RESPONSE",
          ),
        );
        return;
      }

      const request = this.pendingQueries.shift();
      if (!request) {
        this.failProtocol(
          new UniDBProtocolError(
            "UniDB sent a response when no query was waiting",
            "UNEXPECTED_RESPONSE",
          ),
        );
        return;
      }

      clearTimeout(request.timer);
      if (response.ok) {
        request.resolve(response);
      } else {
        const serverError = response.error || {};
        request.reject(
          new UniDBQueryError(
            serverError.message || "UniDB could not execute the query",
            serverError.code || "QUERY_ERROR",
          ),
        );
      }
    }
  }

  failProtocol(error) {
    this.connected = false;
    this.rejectPendingQueries(error);
    if (this.socket) {
      this.socket.destroy();
    }
  }

  rejectPendingQueries(error) {
    for (const request of this.pendingQueries) {
      clearTimeout(request.timer);
      request.reject(error);
    }
    this.pendingQueries = [];
  }
}
