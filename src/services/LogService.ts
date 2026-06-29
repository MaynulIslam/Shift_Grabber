/**
 * LogService — persists action logs to MMKV and exposes a tiny pub/sub so the
 * Log screen can re-render when new entries arrive (from JS *or* from native
 * events relayed through BridgeService).
 */
import {LogEntry, LogLevel, DeliveryAppId} from '@/types';
import {storage, StorageKeys} from './storage';

const MAX_ENTRIES = 500;

type Listener = (entries: LogEntry[]) => void;

class LogServiceImpl {
  private listeners = new Set<Listener>();

  /** Read all entries, newest first. */
  getAll(): LogEntry[] {
    const raw = storage.getString(StorageKeys.LOGS);
    if (!raw) {
      return [];
    }
    try {
      return JSON.parse(raw) as LogEntry[];
    } catch {
      return [];
    }
  }

  add(level: LogLevel, message: string, app?: DeliveryAppId): LogEntry {
    const entry: LogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
      level,
      message,
      app,
    };
    const next = [entry, ...this.getAll()].slice(0, MAX_ENTRIES);
    this.persist(next);
    return entry;
  }

  /** Insert a pre-built entry (e.g. one that came from native with its own timestamp). */
  ingest(entry: LogEntry): void {
    const next = [entry, ...this.getAll()].slice(0, MAX_ENTRIES);
    this.persist(next);
  }

  clear(): void {
    this.persist([]);
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private persist(entries: LogEntry[]): void {
    storage.set(StorageKeys.LOGS, JSON.stringify(entries));
    this.listeners.forEach(l => l(entries));
  }
}

export const LogService = new LogServiceImpl();
