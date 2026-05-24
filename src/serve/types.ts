// Shared types for the `htmlbin serve` subsystem.

export type ServeMode = "file" | "dir";

export interface ServeOptions {
  /** Absolute path to the file or directory being served. */
  target: string;
  mode: ServeMode;
  host: string;
  /** 0 means ephemeral. */
  port: number;
  open: boolean;
  reload: boolean;
  overlay: boolean;
  /** Minutes; 0 disables idle shutdown. */
  idleTimeout: number;
  /** When true, emit one JSON object per event on stdout instead of human text. */
  json: boolean;
  /** Populated after the server binds, e.g. "localhost:62821". Used by the
   *  injected chrome to show the local address in the modeline. */
  localAddr?: string;
}

export interface ServeState {
  pid: number;
  url: string;
  port: number;
  /** Absolute path. */
  serving: string;
  mode: ServeMode;
  started_at: string;
}
