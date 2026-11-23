import type { Tool, DeserializeResult } from '@itsjust/core';
import toolConfig from './tool.config';
import {
  DEFAULT_STATE,
  MAX_HISTORY,
  summaryText,
  type HistoryEntry,
  type Mode,
  type ToolState,
} from './types';

/** The set of modes a serialized payload may carry. */
const VALID_MODES: Mode[] = ['int', 'dec'];

function stringOr(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function validHistory(value: unknown): HistoryEntry[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (entry): entry is HistoryEntry =>
        typeof entry === 'object' &&
        entry !== null &&
        typeof (entry as HistoryEntry).text === 'string' &&
        typeof (entry as HistoryEntry).settings === 'string' &&
        typeof (entry as HistoryEntry).createdAt === 'string'
    )
    .slice(0, MAX_HISTORY);
}

function numberArrayOrEmpty(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
}

/** Serialize tool state into a compact JSON string for share/import. */
export function serializeState(state: ToolState): string {
  return JSON.stringify({
    mode: state.mode,
    min: state.min,
    max: state.max,
    count: state.count,
    decimals: state.decimals,
    unique: state.unique,
    values: state.values,
    history: state.history,
  });
}

/** Validate and recover tool state from an arbitrary payload. */
export function deserializeState(data: unknown): DeserializeResult<ToolState> {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return {
      success: false,
      error: 'Invalid data format: expected random number generator state object',
    };
  }
  const v = data as Record<string, unknown>;
  const mode: Mode = VALID_MODES.includes(v.mode as Mode) ? (v.mode as Mode) : DEFAULT_STATE.mode;
  const state: ToolState = {
    mode,
    min: stringOr(v.min, DEFAULT_STATE.min),
    max: stringOr(v.max, DEFAULT_STATE.max),
    count: stringOr(v.count, DEFAULT_STATE.count),
    decimals: stringOr(v.decimals, DEFAULT_STATE.decimals),
    unique: typeof v.unique === 'boolean' ? v.unique : DEFAULT_STATE.unique,
    values: numberArrayOrEmpty(v.values),
    history: validHistory(v.history),
  };
  return { success: true, data: state };
}

/** Append a history entry to state, capped at MAX_HISTORY, newest first. */
export function withHistory(
  state: ToolState,
  text: string,
  settings: string,
  now = new Date()
): ToolState {
  const entry: HistoryEntry = { text, settings, createdAt: now.toISOString() };
  return { ...state, history: [entry, ...state.history].slice(0, MAX_HISTORY) };
}

/** True when a serialized string round-trips back to the same state. */
export function roundTrips(state: ToolState): boolean {
  try {
    const restored = deserializeState(JSON.parse(serializeState(state)));
    return restored.success && JSON.stringify(restored.data) === JSON.stringify(state);
  } catch {
    return false;
  }
}

export const randomNumberGeneratorTool: Tool<ToolState> = {
  id: toolConfig.id,
  name: toolConfig.name,
  version: toolConfig.version,
  config: toolConfig,
  initialState: { ...DEFAULT_STATE },
  serialize: serializeState,
  deserialize: deserializeState,
  exporters: [
    { format: 'png', loader: () => import('./exporters/png') },
    { format: 'jpeg', loader: () => import('./exporters/jpeg') },
    { format: 'webp', loader: () => import('./exporters/webp') },
    { format: 'pdf', loader: () => import('./exporters/pdf') },
  ],
};

export { summaryText };
