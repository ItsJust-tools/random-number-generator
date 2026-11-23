'use client';

import React from 'react';
import {
  decimalsFor,
  formatNumber,
  getStats,
  joinValues,
  resultText,
  validateInputs,
  SEPARATORS,
  type ToolState,
} from '../types';
import { MODES } from '../ui-shared';

interface CanvasProps {
  state: ToolState;
  onChange?: (state: ToolState) => void;
  onGenerate?: () => void;
  onRerun?: (settings: string) => void;
}

const inputClass =
  'mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100';

function CopyButton({ value, testid }: { value: string; testid?: string }) {
  const [copied, setCopied] = React.useState(false);
  const handleCopy = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable; ignore
    }
  }, [value]);
  return (
    <button
      type="button"
      onClick={handleCopy}
      data-testid={testid}
      className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800"
      aria-label="Copy value"
    >
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

function TextField({
  label,
  value,
  onChangeState,
  testid,
}: {
  label: string;
  value: string;
  onChangeState: (next: string) => void;
  testid: string;
}) {
  return (
    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
      {label}
      <input
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChangeState(e.target.value)}
        data-testid={testid}
        className={inputClass}
      />
    </label>
  );
}

export const Canvas: React.FC<CanvasProps> = ({ state, onChange, onGenerate, onRerun }) => {
  const update = (patch: Partial<ToolState>) => onChange?.({ ...state, ...patch });
  const validation = validateInputs(state);
  const decimals = decimalsFor(state);
  const stats = getStats(state.values);
  const preview = resultText(state);

  return (
    <div className="p-4 space-y-6 overflow-y-auto h-full" data-testid="rng-canvas">
      <div
        className="flex flex-wrap gap-2"
        role="tablist"
        aria-label="Number mode"
        data-testid="mode-tabs"
      >
        {MODES.map((mode) => (
          <button
            key={mode.value}
            type="button"
            role="tab"
            aria-selected={state.mode === mode.value}
            data-testid={`mode-tab-${mode.value}`}
            title={mode.hint}
            onClick={() => update({ mode: mode.value })}
            className={`rounded-md border px-3 py-1.5 text-xs font-medium ${
              state.mode === mode.value
                ? 'border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-100'
                : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400'
            }`}
          >
            {mode.label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2" data-testid="range-inputs">
        <TextField
          label="Min"
          value={state.min}
          onChangeState={(v) => update({ min: v })}
          testid="input-min"
        />
        <TextField
          label="Max"
          value={state.max}
          onChangeState={(v) => update({ max: v })}
          testid="input-max"
        />
        <TextField
          label="Count (1-1000)"
          value={state.count}
          onChangeState={(v) => update({ count: v })}
          testid="input-count"
        />
        {state.mode === 'dec' ? (
          <TextField
            label="Decimal places (0-10)"
            value={state.decimals}
            onChangeState={(v) => update({ decimals: v })}
            testid="input-decimals"
          />
        ) : null}
      </div>

      <label className="flex items-center gap-2 text-xs font-medium text-gray-700 dark:text-gray-300">
        <input
          type="checkbox"
          checked={state.unique}
          onChange={(e) => update({ unique: e.target.checked })}
          data-testid="input-unique"
          className="h-4 w-4 rounded border-gray-300"
        />
        Unique only (no duplicates)
      </label>

      {!validation.valid ? (
        <p
          className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-900/40 dark:text-red-200"
          data-testid="validation-error"
        >
          {validation.error}
        </p>
      ) : null}

      <div className="text-center">
        <button
          type="button"
          data-testid="btn-generate"
          disabled={!validation.valid}
          onClick={() => onGenerate?.()}
          className="rounded-md bg-emerald-500 px-6 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Generate
        </button>
      </div>

      <div
        className="rounded-lg border border-gray-200 bg-white p-4 text-center dark:border-gray-800 dark:bg-gray-900"
        data-testid="result-card"
        role="status"
      >
        <span className="mb-1 block text-[10px] uppercase tracking-widest text-gray-500 dark:text-gray-400">
          Result
        </span>
        <span className="block font-mono text-2xl font-bold break-all" data-testid="result-main">
          {preview ?? '—'}
        </span>
        {state.values.length > 0 ? (
          <>
            <span className="mt-2 flex items-center justify-center gap-2">
              <CopyButton
                value={formatNumber(state.values[0] as number, decimals)}
                testid="copy-first"
              />
              <span className="text-xs text-gray-500 dark:text-gray-400">first value</span>
            </span>
            <div
              className="mt-3 flex flex-wrap items-center justify-center gap-2"
              data-testid="copy-all-row"
            >
              {SEPARATORS.map((sep) => (
                <CopyButton
                  key={sep.value}
                  value={joinValues(state.values, decimals, sep.value)}
                  testid={`copy-all-${sep.value}`}
                />
              ))}
            </div>
          </>
        ) : (
          <span
            className="mt-2 block text-xs text-gray-600 dark:text-gray-300"
            data-testid="result-summary"
          >
            Set your range and press Generate.
          </span>
        )}
      </div>

      {stats ? (
        <div
          className="grid grid-cols-2 gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4 sm:grid-cols-4 dark:border-gray-800 dark:bg-gray-900/50"
          data-testid="stats-card"
        >
          <div>
            <span className="block text-[10px] uppercase tracking-widest text-gray-500 dark:text-gray-400">
              Sum
            </span>
            <span className="font-mono text-sm font-semibold" data-testid="stat-sum">
              {formatNumber(stats.sum, decimals)}
            </span>
          </div>
          <div>
            <span className="block text-[10px] uppercase tracking-widest text-gray-500 dark:text-gray-400">
              Average
            </span>
            <span className="font-mono text-sm font-semibold" data-testid="stat-average">
              {formatNumber(stats.average, Math.max(decimals, 2))}
            </span>
          </div>
          <div>
            <span className="block text-[10px] uppercase tracking-widest text-gray-500 dark:text-gray-400">
              Min
            </span>
            <span className="font-mono text-sm font-semibold" data-testid="stat-min">
              {formatNumber(stats.min, decimals)}
            </span>
          </div>
          <div>
            <span className="block text-[10px] uppercase tracking-widest text-gray-500 dark:text-gray-400">
              Max
            </span>
            <span className="font-mono text-sm font-semibold" data-testid="stat-max">
              {formatNumber(stats.max, decimals)}
            </span>
          </div>
        </div>
      ) : null}

      <div>
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
          History
        </h3>
        {state.history.length === 0 ? (
          <p className="text-xs text-gray-500 dark:text-gray-400" data-testid="history-empty">
            No generations yet.
          </p>
        ) : (
          <ul className="space-y-1" data-testid="history-list">
            {state.history.map((entry, i) => (
              <li
                key={`${entry.createdAt}-${i}`}
                className="flex items-center justify-between gap-2 rounded-md border border-gray-200 px-3 py-1.5 text-xs dark:border-gray-800"
              >
                <span className="truncate text-gray-500 dark:text-gray-400">
                  {new Date(entry.createdAt).toLocaleString()}
                </span>
                <span className="truncate text-gray-700 dark:text-gray-300">{entry.text}</span>
                <button
                  type="button"
                  data-testid={`btn-rerun-${i}`}
                  onClick={() => onRerun?.(entry.settings)}
                  className="rounded border border-gray-300 px-2 py-0.5 hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
                >
                  Re-run
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-center text-xs text-gray-500 dark:text-gray-400">
        All numbers are generated locally in your browser; nothing is uploaded.
      </p>
    </div>
  );
};
