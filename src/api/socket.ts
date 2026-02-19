/**
 * Minimal Socket.IO v4 client over native WebSocket.
 *
 * Implements just enough of the Engine.IO + Socket.IO wire protocol
 * for emit-with-ack and event listeners. No polling, no reconnection,
 * no namespaces, no binary — we don't need any of that.
 *
 * Wire format reference:
 *   Engine.IO: 0=open, 2=ping, 3=pong, 4=message
 *   Socket.IO: 0=CONNECT, 2=EVENT, 3=ACK (prefixed by "4" from EIO)
 *
 * A typical frame:  "42<ackId>[\"event\",{...}]"
 *                    ^^ EIO message + SIO EVENT
 */

type EventHandler = (...args: unknown[]) => void;
type AckResolver = (args: unknown[]) => void;

export class SioSocket {
  #ws: WebSocket | null = null;
  #listeners = new Map<string, EventHandler[]>();
  #acks = new Map<number, AckResolver>();
  #ackId = 0;
  #pingTimer: ReturnType<typeof setInterval> | null = null;
  #connected = false;

  get connected(): boolean {
    return this.#connected;
  }

  /**
   * Connect to a Socket.IO server.
   * Performs: WS handshake → EIO open → SIO CONNECT → resolved.
   */
  connect(url: string, timeoutMs: number): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.#cleanup();
        reject(new Error(`Connection timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      // Build the Engine.IO WebSocket URL
      const base = new URL(url);
      base.protocol = base.protocol === "https:" ? "wss:" : "ws:";
      base.pathname = (base.pathname.replace(/\/+$/, "") || "") + "/socket.io/";
      base.searchParams.set("EIO", "4");
      base.searchParams.set("transport", "websocket");

      const ws = new WebSocket(base.toString());
      this.#ws = ws;

      ws.addEventListener("message", (ev) => {
        const data = typeof ev.data === "string" ? ev.data : "";
        this.#handleFrame(data);
      });

      ws.addEventListener("error", () => {
        clearTimeout(timeout);
        this.#cleanup();
        reject(new Error(`WebSocket error connecting to ${url}`));
      });

      ws.addEventListener("close", () => {
        this.#connected = false;
        this.#stopPing();
      });

      // Wait for SIO CONNECT (frame "40{...}")
      const onConnect = () => {
        clearTimeout(timeout);
        this.#connected = true;
        this.off("__sio_connect", onConnect);
        resolve();
      };
      this.on("__sio_connect", onConnect);
    });
  }

  /** Register an event listener. */
  on(event: string, handler: EventHandler): void {
    const arr = this.#listeners.get(event);
    if (arr) arr.push(handler);
    else this.#listeners.set(event, [handler]);
  }

  /** Remove an event listener. */
  off(event: string, handler: EventHandler): void {
    const arr = this.#listeners.get(event);
    if (!arr) return;
    const idx = arr.indexOf(handler);
    if (idx >= 0) arr.splice(idx, 1);
  }

  /**
   * Emit an event with arguments. Last arg in the ack callback response.
   * Returns the first element of the ack args array (the callback response).
   */
  emitWithAck(event: string, ...args: unknown[]): Promise<unknown> {
    if (!this.#ws || !this.#connected) return Promise.reject(new Error("Not connected"));

    const id = this.#ackId++;
    const payload = JSON.stringify([event, ...args]);
    // "42<id>" + payload  → EIO message (4) + SIO EVENT (2) + ack id
    this.#ws.send(`42${id}${payload}`);

    return new Promise<unknown>((resolve) => {
      this.#acks.set(id, (ackArgs) => {
        resolve(ackArgs[0]);
      });
    });
  }

  /** Disconnect cleanly. */
  disconnect(): void {
    if (this.#ws) {
      // Send SIO disconnect: "41"
      try {
        this.#ws.send("41");
      } catch { /* already closed */ }
    }
    this.#cleanup();
  }

  // --- Frame parsing ---

  #handleFrame(frame: string): void {
    if (!frame.length) return;

    const eioType = frame[0];

    switch (eioType) {
      case "0": {
        // EIO OPEN — parse pingInterval, start pong loop, send SIO CONNECT
        try {
          const open = JSON.parse(frame.slice(1)) as { pingInterval?: number; pingTimeout?: number };
          this.#startPing(open.pingInterval ?? 25000);
        } catch { /* ignore parse failure */ }
        // Send Socket.IO CONNECT for default namespace
        this.#ws?.send("40");
        break;
      }
      case "2": {
        // EIO PING → reply PONG
        this.#ws?.send("3");
        break;
      }
      case "4": {
        // EIO MESSAGE — contains Socket.IO packet
        this.#handleSioPacket(frame.slice(1));
        break;
      }
    }
  }

  #handleSioPacket(packet: string): void {
    if (!packet.length) return;

    const sioType = packet[0];

    switch (sioType) {
      case "0": {
        // SIO CONNECT — server accepted
        this.#emit("__sio_connect");
        break;
      }
      case "2": {
        // SIO EVENT — "2[\"eventName\", ...args]"
        const json = packet.slice(1);
        try {
          const arr = JSON.parse(json) as unknown[];
          if (Array.isArray(arr) && arr.length >= 1) {
            const [event, ...args] = arr;
            this.#emit(event as string, ...args);
          }
        } catch { /* malformed */ }
        break;
      }
      case "3": {
        // SIO ACK — "3<id>[...args]"
        const rest = packet.slice(1);
        const match = rest.match(/^(\d+)(.*)/s);
        if (!match) break;
        const ackId = parseInt(match[1]!, 10);
        const resolver = this.#acks.get(ackId);
        if (!resolver) break;
        this.#acks.delete(ackId);
        try {
          const args = JSON.parse(match[2]!) as unknown[];
          resolver(Array.isArray(args) ? args : [args]);
        } catch {
          resolver([]);
        }
        break;
      }
    }
  }

  #emit(event: string, ...args: unknown[]): void {
    const handlers = this.#listeners.get(event);
    if (!handlers) return;
    for (const h of handlers) h(...args);
  }

  // --- Ping/pong keep-alive ---

  #startPing(intervalMs: number): void {
    this.#stopPing();
    // Engine.IO 4: server sends ping, client sends pong.
    // But some servers (including Uptime Kuma) also accept client-initiated pings
    // as a keep-alive. We rely on the server's pings handled in #handleFrame.
    // This timer is a safety net if server pings stop.
    this.#pingTimer = setInterval(() => {
      if (this.#ws?.readyState === WebSocket.OPEN) {
        this.#ws.send("2");
      }
    }, intervalMs);
  }

  #stopPing(): void {
    if (this.#pingTimer) {
      clearInterval(this.#pingTimer);
      this.#pingTimer = null;
    }
  }

  #cleanup(): void {
    this.#connected = false;
    this.#stopPing();
    if (this.#ws) {
      try { this.#ws.close(); } catch { /* ignore */ }
      this.#ws = null;
    }
    this.#acks.clear();
  }
}
