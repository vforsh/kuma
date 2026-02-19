import { SioSocket } from "./socket.ts";
import { CliError } from "../cli/errors.ts";

export type KumaClientOptions = {
  timeoutMs: number;
  log: {
    info: (...args: unknown[]) => void;
    debug: (...args: unknown[]) => void;
  };
};

type CallbackResponse = {
  ok: boolean;
  msg?: string;
  [key: string]: unknown;
};

/** Thin wrapper around SioSocket for Uptime Kuma's Socket.IO API. */
export class KumaClient {
  #socket: SioSocket;
  #timeoutMs: number;
  #log: KumaClientOptions["log"];

  // Pushed data caches (server sends these after login)
  #monitorList: Record<string, unknown> | null = null;
  #notificationList: unknown[] | null = null;
  #statusPageList: Record<string, unknown> | null = null;
  #maintenanceList: Record<string, unknown> | null = null;
  #info: Record<string, unknown> | null = null;

  constructor(opts: KumaClientOptions) {
    this.#timeoutMs = opts.timeoutMs;
    this.#log = opts.log;
    this.#socket = new SioSocket();
  }

  async connect(url: string): Promise<void> {
    // Register event listeners before connecting
    this.#socket.on("monitorList", (data) => {
      this.#monitorList = data as Record<string, unknown>;
    });
    this.#socket.on("notificationList", (data) => {
      this.#notificationList = data as unknown[];
    });
    this.#socket.on("statusPageList", (data) => {
      this.#statusPageList = data as Record<string, unknown>;
    });
    this.#socket.on("maintenanceList", (data) => {
      this.#maintenanceList = data as Record<string, unknown>;
    });
    this.#socket.on("info", (data) => {
      this.#info = data as Record<string, unknown>;
    });

    try {
      await this.#socket.connect(url, this.#timeoutMs);
    } catch (err) {
      throw new CliError(
        err instanceof Error ? `Connection failed: ${err.message}` : "Connection failed",
        { exitCode: 7, cause: err },
      );
    }
    this.#log.debug("connected to", url);
  }

  async login(username: string, password: string): Promise<void> {
    const res = await this.#call<CallbackResponse>("login", { username, password, token: "" });
    if (!res.ok) throw new CliError(`Login failed: ${res.msg ?? "unknown error"}`, { exitCode: 3 });
    this.#log.debug("logged in as", username);

    // Wait briefly for server to push initial data
    await this.#waitForData(() => this.#monitorList !== null, 5000);
  }

  // --- Info ---

  getInfo(): Record<string, unknown> {
    return this.#info ?? {};
  }

  // --- Monitors ---

  getMonitors(): Record<string, unknown>[] {
    if (!this.#monitorList) return [];
    return Object.values(this.#monitorList) as Record<string, unknown>[];
  }

  async getMonitor(id: number): Promise<Record<string, unknown>> {
    const res = await this.#call<CallbackResponse>("getMonitor", id);
    if (!res.ok) throw new CliError(`Failed to get monitor ${id}: ${res.msg}`, { exitCode: 7 });
    return res.monitor as Record<string, unknown>;
  }

  async addMonitor(data: Record<string, unknown>): Promise<{ monitorID: number }> {
    const res = await this.#call<CallbackResponse>("add", data);
    if (!res.ok) throw new CliError(`Failed to add monitor: ${res.msg}`, { exitCode: 7 });
    return { monitorID: res.monitorID as number };
  }

  async editMonitor(data: Record<string, unknown>): Promise<{ monitorID: number }> {
    const res = await this.#call<CallbackResponse>("editMonitor", data);
    if (!res.ok) throw new CliError(`Failed to edit monitor: ${res.msg}`, { exitCode: 7 });
    return { monitorID: res.monitorID as number };
  }

  async deleteMonitor(id: number): Promise<void> {
    const res = await this.#call<CallbackResponse>("deleteMonitor", id);
    if (!res.ok) throw new CliError(`Failed to delete monitor ${id}: ${res.msg}`, { exitCode: 7 });
  }

  async pauseMonitor(id: number): Promise<void> {
    const res = await this.#call<CallbackResponse>("pauseMonitor", id);
    if (!res.ok) throw new CliError(`Failed to pause monitor ${id}: ${res.msg}`, { exitCode: 7 });
  }

  async resumeMonitor(id: number): Promise<void> {
    const res = await this.#call<CallbackResponse>("resumeMonitor", id);
    if (!res.ok) throw new CliError(`Failed to resume monitor ${id}: ${res.msg}`, { exitCode: 7 });
  }

  // --- Notifications ---

  getNotifications(): unknown[] {
    return this.#notificationList ?? [];
  }

  // --- Status Pages ---

  getStatusPages(): Record<string, unknown>[] {
    if (!this.#statusPageList) return [];
    return Object.values(this.#statusPageList) as Record<string, unknown>[];
  }

  // --- Maintenance ---

  getMaintenanceList(): Record<string, unknown>[] {
    if (!this.#maintenanceList) return [];
    return Object.values(this.#maintenanceList) as Record<string, unknown>[];
  }

  // --- Tags ---

  async getTags(): Promise<Record<string, unknown>[]> {
    const res = await this.#call<CallbackResponse>("getTags");
    if (!res.ok) throw new CliError(`Failed to get tags: ${res.msg}`, { exitCode: 7 });
    return (res.tags ?? []) as Record<string, unknown>[];
  }

  // --- Connection ---

  disconnect(): void {
    this.#socket.disconnect();
    this.#log.debug("disconnected");
  }

  // --- Internal ---

  async #call<T>(event: string, ...args: unknown[]): Promise<T> {
    if (!this.#socket.connected) {
      throw new CliError("Not connected to Uptime Kuma", { exitCode: 7 });
    }

    const result = await Promise.race([
      this.#socket.emitWithAck(event, ...args),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new CliError(`Socket call "${event}" timed out after ${this.#timeoutMs}ms`, { exitCode: 7 })), this.#timeoutMs),
      ),
    ]);

    return result as T;
  }

  async #waitForData(check: () => boolean, maxMs: number): Promise<void> {
    const start = Date.now();
    while (!check() && Date.now() - start < maxMs) {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
}
