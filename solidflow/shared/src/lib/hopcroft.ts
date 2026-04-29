import type { FsmDefinition, FsmTransition } from './fsm.types';

export interface FsmMinimizationStats {
  originalStateCount: number;
  minimizedStateCount: number;
  originalTransitionCount: number;
  minimizedTransitionCount: number;
  removedUnreachableStates: string[];
  removedDeadStates: string[];
  /** Maps each merged-away state name to its representative. */
  mergedStates: Record<string, string>;
  /** Transitions present in the original FSM that are absent after minimization. */
  removedTransitions: FsmTransition[];
  alreadyMinimal: boolean;
}

export interface FsmMinimizationResult {
  minimized: FsmDefinition;
  stats: FsmMinimizationStats;
}

// ---------------------------------------------------------------------------
// Pre-processing helpers
// ---------------------------------------------------------------------------

function computeReachableStates(states: string[], transitions: FsmTransition[], initial: string): Set<string> {
  const reachable = new Set<string>([initial]);
  const queue = [initial];
  while (queue.length > 0) {
    const s = queue.shift()!;
    for (const t of transitions) {
      if (t.from === s && !reachable.has(t.to)) {
        reachable.add(t.to);
        queue.push(t.to);
      }
    }
  }
  // Only return states that are in the declared states array
  return new Set(states.filter((s) => reachable.has(s)));
}

function computeDeadStates(
  states: string[],
  transitions: FsmTransition[],
  initial: string,
): Set<string> {
  // Terminal states = states with no outgoing transitions
  const outgoing = new Set(transitions.map((t) => t.from));
  const terminals = states.filter((s) => !outgoing.has(s));

  // If there are no terminal states, skip dead-state pruning entirely
  if (terminals.length === 0) return new Set();

  // Backward BFS from terminals
  const live = new Set<string>(terminals);
  const queue = [...terminals];
  while (queue.length > 0) {
    const s = queue.shift()!;
    for (const t of transitions) {
      if (t.to === s && !live.has(t.from)) {
        live.add(t.from);
        queue.push(t.from);
      }
    }
  }

  const dead = new Set<string>();
  for (const s of states) {
    if (!live.has(s) && s !== initial) dead.add(s);
  }
  return dead;
}

// ---------------------------------------------------------------------------
// Body-signature helper
// ---------------------------------------------------------------------------

/**
 * JSON.stringify replacer that sorts object keys alphabetically, producing a
 * stable serialisation regardless of the order in which properties were set.
 * This is required for guardConfig, whose nested objects may be constructed
 * in varying property orders across different code paths.
 */
function stableReplacer(_key: string, value: unknown): unknown {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)),
    );
  }
  return value;
}

/**
 * Returns a normalised copy of a guardConfig with `errorMessage` stripped from
 * every guard entry. Error messages are human-facing annotations and do not
 * affect the generated Solidity logic, so two transitions that differ only in
 * their error messages must still be considered equivalent.
 */
function normaliseGuardConfig(
  guardConfig: FsmTransition['guardConfig'],
): FsmTransition['guardConfig'] {
  if (!guardConfig) return undefined;
  return {
    ...guardConfig,
    guards: guardConfig.guards.map(({ errorMessage: _omit, ...rest }) => rest),
  };
}

/**
 * Returns a stable string key representing the "semantic body" of a transition
 * — everything that affects the generated Solidity function except the source
 * state (from), the function name, and internal id.
 *
 * Two transitions with the same signature produce identical Solidity bodies
 * (modulo the from-state require) and are therefore interchangeable.
 * `to` is intentionally excluded: it is the *target* of δ and is handled by
 * the Hopcroft partition refinement, not the alphabet symbol.
 *
 * Both the raw `guard` string and the structured `guardConfig` are included so
 * that transitions with differing guard conditions are never treated as the
 * same alphabet symbol and are therefore never incorrectly merged.
 * `errorMessage` fields inside `guardConfig` are excluded because they are
 * human-facing annotations that do not affect the generated Solidity logic.
 */
function transitionBodySignature(t: FsmTransition): string {
  return JSON.stringify(
    {
      payable: t.payable ?? false,
      guard: t.guard ?? '',
      guardConfig: normaliseGuardConfig(t.guardConfig),
      statementsMode: t.statementsMode ?? 'guided',
      rawStatements: t.rawStatements ?? '',
      statements: t.statements ?? [],
      emitEvent: t.emitEvent ?? '',
      emitEventArgs: t.emitEventArgs ?? [],
    },
    stableReplacer,
  );
}

// ---------------------------------------------------------------------------
// Core Hopcroft algorithm
// ---------------------------------------------------------------------------

/**
 * Runs Hopcroft's O(n log n) DFA minimization.
 *
 * The alphabet symbol for each transition is its *body signature* (see
 * transitionBodySignature) rather than its name. Two transitions are treated
 * as the same "trigger" when they produce identical Solidity function bodies,
 * regardless of what the transitions are named.
 *
 * NOTE: If multiple transitions share the same (from, bodySignature) pair,
 * only the first one encountered is used for δ. Results are undefined for
 * truly nondeterministic input.
 *
 * Returns a map: state → canonical representative of its equivalence class.
 */
function runHopcroft(
  states: string[],
  transitions: FsmTransition[],
  alphabet: string[],
): Map<string, string> {
  if (states.length === 0) return new Map();

  // δ: state → bodySignature → target
  const delta = new Map<string, Map<string, string>>();
  for (const s of states) delta.set(s, new Map());
  for (const t of transitions) {
    const sig = transitionBodySignature(t);
    const row = delta.get(t.from);
    if (row && !row.has(sig)) row.set(sig, t.to);
  }

  // δ_inv: bodySignature → target → Set<sources>  (for efficient splitter application)
  const deltaInv = new Map<string, Map<string, Set<string>>>();
  for (const a of alphabet) deltaInv.set(a, new Map());
  for (const t of transitions) {
    const sig = transitionBodySignature(t);
    const byTarget = deltaInv.get(sig);
    if (!byTarget) continue;
    if (!byTarget.has(t.to)) byTarget.set(t.to, new Set());
    byTarget.get(t.to)!.add(t.from);
  }

  // Initial partition:
  // Each terminal state gets its own singleton block so supply-chain endpoints
  // (e.g. "Rejected" vs "Delivered") are never silently merged — they have
  // different semantic meanings even though both have no outgoing transitions.
  // All non-terminal states start together in one block.
  const outgoing = new Set(transitions.map((t) => t.from));
  const terminals = states.filter((s) => !outgoing.has(s));
  const nonTerminals = states.filter((s) => outgoing.has(s));

  const partition: Set<string>[] = [];
  for (const s of terminals) partition.push(new Set([s]));
  if (nonTerminals.length > 0) partition.push(new Set(nonTerminals));
  if (partition.length === 0) partition.push(new Set(states));

  // Worklist: begin with all initial blocks as potential splitters
  const worklist: Set<string>[] = partition.map((b) => new Set(b));

  // Refinement loop
  while (worklist.length > 0) {
    const splitter = worklist.pop()!;

    for (const a of alphabet) {
      const byTarget = deltaInv.get(a);
      if (!byTarget) continue;

      // X = states that transition into splitter on symbol a
      const X = new Set<string>();
      for (const s of splitter) {
        const predecessors = byTarget.get(s);
        if (predecessors) for (const p of predecessors) X.add(p);
      }
      if (X.size === 0) continue;

      const nextPartition: Set<string>[] = [];
      for (const block of partition) {
        const intersection = new Set<string>();
        const difference = new Set<string>();
        for (const s of block) {
          if (X.has(s)) intersection.add(s);
          else difference.add(s);
        }

        if (intersection.size === 0 || difference.size === 0) {
          nextPartition.push(block);
          continue;
        }

        // Split block
        nextPartition.push(intersection, difference);

        // Update worklist
        const wIdx = worklist.indexOf(block);
        if (wIdx !== -1) {
          worklist.splice(wIdx, 1, intersection, difference);
        } else {
          // Hopcroft's insight: add the smaller piece
          worklist.push(
            intersection.size <= difference.size ? intersection : difference,
          );
        }
      }
      partition.splice(0, partition.length, ...nextPartition);
    }
  }

  // Build representative map: lexicographically smallest state in each block
  const repMap = new Map<string, string>();
  for (const block of partition) {
    const rep = [...block].sort()[0];
    for (const s of block) repMap.set(s, rep);
  }
  return repMap;
}

// ---------------------------------------------------------------------------
// FSM reconstruction
// ---------------------------------------------------------------------------

function rebuildFsm(
  def: FsmDefinition,
  workingStates: string[],
  workingTransitions: FsmTransition[],
  repMap: Map<string, string>,
): FsmDefinition {
  // New state list: unique representatives in original declaration order
  const seen = new Set<string>();
  const newStates: string[] = [];
  for (const s of workingStates) {
    const rep = repMap.get(s) ?? s;
    if (!seen.has(rep)) {
      seen.add(rep);
      newStates.push(rep);
    }
  }

  // Remap transitions, deduplicate by (bodySignature, repFrom, repTo).
  // Sort so that transitions from representative states come first — this
  // ensures the representative's function name and metadata are preserved
  // when a merged-away state's transition would otherwise win the dedup race.
  const sortedTransitions = [...workingTransitions].sort((a, b) => {
    const aIsRep = (repMap.get(a.from) ?? a.from) === a.from ? 0 : 1;
    const bIsRep = (repMap.get(b.from) ?? b.from) === b.from ? 0 : 1;
    return aIsRep - bIsRep;
  });
  const dedupe = new Set<string>();
  const newTransitions: FsmTransition[] = [];
  for (const t of sortedTransitions) {
    const repFrom = repMap.get(t.from) ?? t.from;
    const repTo = repMap.get(t.to) ?? t.to;
    const key = `${transitionBodySignature(t)}::${repFrom}::${repTo}`;
    if (!dedupe.has(key)) {
      dedupe.add(key);
      newTransitions.push({ ...t, from: repFrom, to: repTo });
    }
  }

  return {
    ...def,
    states: newStates,
    initialState: repMap.get(def.initialState) ?? def.initialState,
    transitions: newTransitions,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Minimizes an FSM using Hopcroft's algorithm.
 *
 * Steps:
 *  1. Remove unreachable states (not reachable from initialState).
 *  2. Remove dead states (no path to any terminal state), never the initialState.
 *  3. Run Hopcroft partitioning to find equivalent states.
 *  4. Merge equivalent states, preserving the representative's transition metadata.
 */
export function minimizeFsm(def: FsmDefinition): FsmMinimizationResult {
  const originalStateCount = def.states.length;
  const originalTransitionCount = def.transitions.length;

  // Guard: degenerate input
  if (def.states.length === 0) {
    return identity(def, originalStateCount, originalTransitionCount);
  }

  // Phase 0a: unreachable states
  const reachable = computeReachableStates(def.states, def.transitions, def.initialState);
  const removedUnreachable = def.states.filter((s) => !reachable.has(s));

  const reachableStates = def.states.filter((s) => reachable.has(s));
  const reachableTransitions = def.transitions.filter(
    (t) => reachable.has(t.from) && reachable.has(t.to),
  );

  // Phase 0b: dead states
  const dead = computeDeadStates(reachableStates, reachableTransitions, def.initialState);
  const removedDead = reachableStates.filter((s) => dead.has(s));

  const workingStates = reachableStates.filter((s) => !dead.has(s));
  const workingTransitions = reachableTransitions.filter(
    (t) => !dead.has(t.from) && !dead.has(t.to),
  );

  // Phase 1: Hopcroft
  const alphabet = [...new Set(workingTransitions.map(transitionBodySignature))];
  const repMap = runHopcroft(workingStates, workingTransitions, alphabet);

  // Phase 2: reconstruct
  const minimized = rebuildFsm(def, workingStates, workingTransitions, repMap);

  // Build merged-states report
  const mergedStates: Record<string, string> = {};
  for (const s of workingStates) {
    const rep = repMap.get(s) ?? s;
    if (rep !== s) mergedStates[s] = rep;
  }

  const minimizedTransitionIds = new Set(minimized.transitions.map((t) => t.id));
  const removedTransitions = def.transitions.filter((t) => !minimizedTransitionIds.has(t.id));

  const nothingChanged =
    removedUnreachable.length === 0 &&
    removedDead.length === 0 &&
    Object.keys(mergedStates).length === 0 &&
    minimized.transitions.length === originalTransitionCount;

  return {
    minimized,
    stats: {
      originalStateCount,
      minimizedStateCount: minimized.states.length,
      originalTransitionCount,
      minimizedTransitionCount: minimized.transitions.length,
      removedUnreachableStates: removedUnreachable,
      removedDeadStates: removedDead,
      mergedStates,
      removedTransitions,
      alreadyMinimal: nothingChanged,
    },
  };
}

function identity(
  def: FsmDefinition,
  originalStateCount: number,
  originalTransitionCount: number,
): FsmMinimizationResult {
  return {
    minimized: def,
    stats: {
      originalStateCount,
      minimizedStateCount: originalStateCount,
      originalTransitionCount,
      minimizedTransitionCount: originalTransitionCount,
      removedUnreachableStates: [],
      removedDeadStates: [],
      mergedStates: {},
      removedTransitions: [],
      alreadyMinimal: true,
    },
  };
}