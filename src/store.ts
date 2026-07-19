import { useCallback, useEffect, useMemo, useState } from 'react';
import { createSeedProject } from './seed';
import type { BudgetData, BudgetProject } from './types';

const STORAGE_KEY = 'sbs-budget-project-v1';

interface HistoryState {
  past: BudgetProject[];
  present: BudgetProject;
  future: BudgetProject[];
}

function loadProject(): BudgetProject {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored) as BudgetProject;
  } catch {
    // A malformed or unavailable local store should never block the application.
  }
  return createSeedProject();
}

export function useBudgetStore() {
  const [history, setHistory] = useState<HistoryState>(() => ({ past: [], present: loadProject(), future: [] }));
  const project = history.present;
  const activeScenario = useMemo(
    () => project.scenarios.find((scenario) => scenario.id === project.activeScenarioId) ?? project.scenarios[0],
    [project],
  );

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
  }, [project]);

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
    const fresh = createSeedProject();
    setHistory((current) => ({ past: [...current.past, current.present], present: fresh, future: [] }));
  }, []);

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
