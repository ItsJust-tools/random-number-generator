'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from 'react';
import { ToolShell, useTool, ImportExport } from '@itsjust/core';
import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';
import { toolConfig, templateBaseVersion, Canvas, Toolbar, Sidebar } from '@/tool';
import { summaryText } from '@/tool';
import {
  generate,
  getStats,
  joinValues,
  decimalsFor,
  validateInputs,
  withHistory,
  randomNumberGeneratorTool,
  serializeState,
  deserializeState,
  formatNumber,
} from '@/tool';
import { type ToolState } from '@/tool/types';

export default function ToolClient() {
  const ToolShellCompat = ToolShell as unknown as ComponentType<Record<string, unknown>> & {
    Toolbar?: ComponentType<{ children?: ReactNode }>;
    Body?: ComponentType<{ children?: ReactNode }>;
    Sidebar?: ComponentType<{ children?: ReactNode }>;
    Canvas?: ComponentType<{ children?: ReactNode }>;
    StatusBar?: ComponentType<{ children?: ReactNode }>;
  };
  const canvasRef = useRef<HTMLDivElement>(null);
  const tool = useTool<ToolState>(randomNumberGeneratorTool, canvasRef);
  const setToolData = tool.state.setData;
  const showToast = tool.toast;
  const [isSharing, setIsSharing] = useState(false);
  const hasLoadedSharedState = useRef(false);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(
    () => typeof window !== 'undefined' && window.innerWidth > 768 && toolConfig.features.sidebar
  );

  const title = toolConfig.name;
  const state = tool.state.data;

  const handleStateChange = useCallback(
    (updater: (prev: ToolState) => ToolState) => {
      setToolData(updater);
    },
    [setToolData]
  );

  useEffect(() => {
    if (hasLoadedSharedState.current) return;
    hasLoadedSharedState.current = true;
    const hash = window.location.hash.replace(/^#/, '');
    if (!hash) return;
    try {
      const encoded = hash.startsWith('state=') ? hash.slice('state='.length) : hash;
      const serialized = decompressFromEncodedURIComponent(encoded);
      if (!serialized) throw new Error('Invalid shared URL');
      const parsed: unknown = JSON.parse(serialized);
      const deserialized = randomNumberGeneratorTool.deserialize(parsed);
      if (!deserialized.success) throw new Error(deserialized.error);
      setToolData(deserialized.data);
      showToast('Loaded state from shared URL', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load shared URL';
      showToast(message, 'error');
    }
  }, [setToolData, showToast]);

  const handleGenerate = useCallback(() => {
    const validation = validateInputs(state);
    if (!validation.valid) {
      showToast(validation.error ?? 'Invalid inputs', 'error');
      return;
    }
    const result = generate(
      validation.min,
      validation.max,
      validation.count,
      state.mode,
      validation.decimals,
      state.unique
    );
    if (result.error || result.values.length === 0) {
      showToast(result.error ?? 'Generation failed', 'error');
      return;
    }
    const decimals = decimalsFor(state);
    const values = result.values;
    const stats = getStats(values);
    handleStateChange((prev) =>
      withHistory(
        { ...prev, values },
        `Generated ${values.length} in [${state.min}, ${state.max}] — sum ${formatNumber(stats?.sum ?? 0, decimals)}`,
        serializeState({ ...state, values }),
        new Date()
      )
    );
    showToast(`Generated ${values.length} value${values.length === 1 ? '' : 's'}`, 'success');
  }, [handleStateChange, showToast, state]);

  const handleRerun = useCallback(
    (settings: string) => {
      try {
        const parsed: unknown = JSON.parse(settings);
        const restored = deserializeState(parsed);
        if (!restored.success) throw new Error(restored.error);
        const restoredState = restored.data;
        const validation = validateInputs(restoredState);
        if (!validation.valid) {
          showToast(validation.error ?? 'Invalid stored settings', 'error');
          return;
        }
        const result = generate(
          validation.min,
          validation.max,
          validation.count,
          restoredState.mode,
          validation.decimals,
          restoredState.unique
        );
        if (result.error || result.values.length === 0) {
          showToast(result.error ?? 'Generation failed', 'error');
          return;
        }
        const values = result.values;
        handleStateChange((prev) =>
          withHistory(
            { ...prev, ...restoredState, values },
            `Re-ran ${values.length} in [${restoredState.min}, ${restoredState.max}]`,
            settings,
            new Date()
          )
        );
        showToast('Re-ran previous settings', 'success');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to re-run settings';
        showToast(message, 'error');
      }
    },
    [handleStateChange, showToast]
  );

  const handleCopyAll = useCallback(async () => {
    try {
      const decimals = decimalsFor(state);
      await navigator.clipboard.writeText(joinValues(state.values, decimals, 'comma'));
      showToast('All values copied to clipboard', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to copy values';
      showToast(message, 'error');
    }
  }, [showToast, state]);

  const handleShare = useCallback(async () => {
    setIsSharing(true);
    try {
      const serialized = randomNumberGeneratorTool.serialize(state);
      const encodedState = compressToEncodedURIComponent(serialized);
      if (!encodedState) throw new Error('Failed to encode state for URL');
      const url = new URL(window.location.href);
      url.searchParams.delete('state');
      url.hash = `state=${encodedState}`;
      window.history.replaceState(null, '', url.toString());

      const shareUrl = url.toString();
      if (navigator.share) {
        try {
          await navigator.share({ title, url: shareUrl });
          showToast('Shared URL ready', 'success');
          return;
        } catch (error) {
          if (error instanceof Error && error.name === 'AbortError') return;
        }
      }
      await navigator.clipboard.writeText(shareUrl);
      showToast('Share URL copied to clipboard', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create share URL';
      showToast(message, 'error');
    } finally {
      setIsSharing(false);
    }
  }, [showToast, state, title]);

  const toolbarContent = (
    <>
      <Toolbar
        state={state}
        onChange={(next) => setToolData(() => next)}
        onClear={() => setToolData((prev) => ({ ...prev, values: [] }))}
        onCopy={() => void handleCopyAll()}
      />
      <ImportExport
        formats={tool.supportedFormats}
        onExport={tool.handleExport}
        onImport={tool.importFromFile}
        isImporting={tool.isImporting}
        onShare={handleShare}
        isSharing={isSharing}
      />
    </>
  );

  const sidebarContent = <Sidebar state={state} onChange={(next) => setToolData(() => next)} />;

  const canvasContent = (
    <div ref={canvasRef}>
      <Canvas
        state={state}
        onChange={(next) =>
          setToolData((prev) => {
            // Changing settings keeps only values generated under them when the
            // settings are unchanged; otherwise reset the values panel.
            const settingsChanged =
              prev.mode !== next.mode ||
              prev.min !== next.min ||
              prev.max !== next.max ||
              prev.count !== next.count ||
              prev.decimals !== next.decimals ||
              prev.unique !== next.unique;
            return settingsChanged ? { ...next, values: [] } : next;
          })
        }
        onGenerate={handleGenerate}
        onRerun={handleRerun}
      />
    </div>
  );

  const statusBarContent = (
    <>
      <span
        className={`status-slot status-slot-state ${tool.state.isDirty ? 'status-unsaved' : 'status-saved'}`}
      >
        {tool.state.isDirty ? (
          <>
            <span className="status-saving-dot" />
            Unsaved
          </>
        ) : tool.state.lastSaved ? (
          <>Saved {tool.state.lastSaved}</>
        ) : (
          'Ready'
        )}
      </span>
      <span className="status-slot status-slot-mode">{state.mode}</span>
      <span className="status-slot status-slot-summary">{summaryText(state)}</span>
      <span className="status-slot status-slot-history">{state.history.length} saved</span>
      <span className="status-slot status-slot-tool-version">Tool v{toolConfig.version}</span>
      <span className="status-slot status-slot-template-version">
        Template v{templateBaseVersion}
      </span>
    </>
  );

  const hasLegacySections = Boolean(
    ToolShellCompat.Toolbar &&
    ToolShellCompat.Body &&
    ToolShellCompat.Sidebar &&
    ToolShellCompat.Canvas &&
    ToolShellCompat.StatusBar
  );

  return (
    <ToolShellCompat
      config={toolConfig}
      sidebarOpen={sidebarOpen}
      onSidebarChange={setSidebarOpen}
      toolbar={toolbarContent}
      sidebar={sidebarContent}
      canvas={canvasContent}
      statusBar={statusBarContent}
    >
      {hasLegacySections
        ? (() => {
            const ToolbarSection = ToolShellCompat.Toolbar as ComponentType<{
              children?: ReactNode;
            }>;
            const BodySection = ToolShellCompat.Body as ComponentType<{ children?: ReactNode }>;
            const SidebarSection = ToolShellCompat.Sidebar as ComponentType<{
              children?: ReactNode;
            }>;
            const CanvasSection = ToolShellCompat.Canvas as ComponentType<{
              children?: ReactNode;
            }>;
            const StatusBarSection = ToolShellCompat.StatusBar as ComponentType<{
              children?: ReactNode;
            }>;
            return (
              <>
                <ToolbarSection>{toolbarContent}</ToolbarSection>
                <BodySection>
                  <SidebarSection>{sidebarContent}</SidebarSection>
                  <CanvasSection>{canvasContent}</CanvasSection>
                </BodySection>
                <StatusBarSection>{statusBarContent}</StatusBarSection>
              </>
            );
          })()
        : null}
    </ToolShellCompat>
  );
}
