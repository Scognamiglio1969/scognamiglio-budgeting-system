import { useCallback, useEffect, useMemo, useState } from 'react';
import type { BudgetData, BudgetProject } from './types';

export const LEGACY_STORAGE_KEY = 'sbs-budget-project-v1';

interface HistoryState {
  past: BudgetProject[];
  present: BudgetProject;
  future: BudgetProject[];
}

export function readLegacyProject(): BudgetProject | null {
  try {
    const stored = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (stored) return JSON.parse(stored) as BudgetProject;
  } catch {
    // A malformed legacy cache should never block cloud access.
  }
  return null;
}

interface BudgetStoreOptions {
  onPersist?: (project: BudgetProject) => void | Promise<void>;
  persistDelay?: number;
}

export function useBudgetStore(initialProject: BudgetProject, options: BudgetStoreOptions = {}) {
  const [history, setHistory] = useState<HistoryState>(() => ({ past: [], present: initialProject, future: [] }));
  const project = history.present;
  const activeScenario = useMemo(
    () => project.scenarios.find((scenario) => scenario.id === project.activeScenarioId) ?? project.scenarios[0],
    [project],
  );

  useEffect(() => {
    setHistory({ past: [], present: initialProject, future: [] });
  }, [initialProject.id]);

  useEffect(() => {
    if (!options.onPersist) return;
    const timer = window.setTimeout(() => void options.onPersist?.(project), options.persistDelay ?? 1200);
    return () => window.clearTimeout(timer);
  }, [project, options.onPersist, options.persistDelay]);

  const commit = useCallback((mutator: (draft: BudgetProject) => void, label = 'Budget updated') => {
    setHistory((current) => {
      const draft = structuredClone(current.present);
      mutator(draft);
      draft.updatedAt = new Date().toISOString();
      draft.changeLog = [{
        id: `change-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        timestamp: draft.updatedAt,
        label,
        scenarioId: draft.activeScenarioId,
      }, ...(draft.changeLog ?? [])].slice(0, 200);
      return { past: [...current.past.slice(-49), current.present], present: draft, future: [] };
    });
  }, []);

  const mutateActiveData = useCallback((mutator: (data: BudgetData) => void, label = 'Budget data updated') => {
    commit((draft) => {
      const scenario = draft.scenarios.find((candidate) => candidate.id === draft.activeScenarioId) ?? draft.scenarios[0];
      mutator(scenario.data);
    }, label);
  }, [commit]);

  const undo = useCallback(() => setHistory((current) => {
    const previous = current.past.at(-1);
    if (!previous) return current;
    return { past: current.past.slice(0, -1), present: previous, future: [current.present, ...current.future] };
  }), []);

  const redo = useCallback(() => setHistory((current) => {
    const next = current.future[0];
    if (!next) return current;
    return { past: [...current.past, current.present], present: next, future: current.future.slice(1) };
  }), []);

  const reset = useCallback(() => {
    setHistory((current) => ({ past: [...current.past, current.present], present: initialProject, future: [] }));
  }, [initialProject]);

  return {
    project,
    activeScenario,
    commit,
    mutateActiveData,
    undo,
    redo,
    reset,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
  };
}
