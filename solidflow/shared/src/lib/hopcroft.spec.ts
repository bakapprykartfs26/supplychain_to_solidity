import { minimizeFsm } from './hopcroft';
import type { FsmDefinition, FsmTransition } from './fsm.types';

function tr(name: string, from: string, to: string): FsmTransition {
  return { id: `${from}-${name}-${to}`, name, from, to };
}

function fsm(
  states: string[],
  initialState: string,
  transitions: FsmTransition[],
): FsmDefinition {
  return { name: 'Test', states, initialState, transitions };
}

describe('minimizeFsm', () => {
  it('already minimal: linear chain A→B→C→D', () => {
    const def = fsm(
      ['A', 'B', 'C', 'D'],
      'A',
      [tr('x', 'A', 'B'), tr('y', 'B', 'C'), tr('z', 'C', 'D')],
    );
    const { stats } = minimizeFsm(def);
    expect(stats.alreadyMinimal).toBe(true);
    expect(stats.minimizedStateCount).toBe(4);
    expect(stats.removedUnreachableStates).toHaveLength(0);
    expect(stats.mergedStates).toEqual({});
  });

  it('merges two equivalent reachable states leading to the same terminal', () => {
    // Start→A and Start→B; both A and B only have "go"→Terminal.
    // A and B are reachable and structurally equivalent → should merge.
    const def = fsm(
      ['Start', 'A', 'B', 'Terminal'],
      'Start',
      [
        tr('toA', 'Start', 'A'),
        tr('toB', 'Start', 'B'),
        tr('go', 'A', 'Terminal'),
        tr('go', 'B', 'Terminal'),
      ],
    );
    const { minimized, stats } = minimizeFsm(def);
    expect(stats.minimizedStateCount).toBe(3); // Start, rep(A|B), Terminal
    expect(Object.keys(stats.mergedStates)).toHaveLength(1);
    const [[merged, rep]] = Object.entries(stats.mergedStates);
    expect(['A', 'B']).toContain(merged);
    expect(['A', 'B']).toContain(rep);
    expect(minimized.states).not.toContain(merged);
    expect(minimized.states).toContain(rep);
  });

  it('removes unreachable states', () => {
    const def = fsm(
      ['Start', 'Middle', 'End', 'Orphan'],
      'Start',
      [
        tr('go', 'Start', 'Middle'),
        tr('done', 'Middle', 'End'),
        tr('loop', 'Orphan', 'Orphan'),
      ],
    );
    const { minimized, stats } = minimizeFsm(def);
    expect(stats.removedUnreachableStates).toContain('Orphan');
    expect(minimized.states).not.toContain('Orphan');
    expect(minimized.states).toHaveLength(3);
  });

  it('preserves reachable dead-end/trap states', () => {
    // Trap is reachable from Start but has no path to any terminal state.
    // In Solidflow this is still a valid user-modeled state and must not be deleted.
    const def = fsm(
      ['Start', 'Terminal', 'Trap'],
      'Start',
      [
        tr('finish', 'Start', 'Terminal'),
        tr('trap', 'Start', 'Trap'),
        tr('loop', 'Trap', 'Trap'),
      ],
    );
  
    const { minimized, stats } = minimizeFsm(def);
  
    expect(minimized.states).toContain('Trap');
    expect(minimized.states).toContain('Start');
    expect(minimized.states).toContain('Terminal');
    expect(stats.removedUnreachableStates).toHaveLength(0);
  });

  it('preserves self-loops', () => {
    const def = fsm(
      ['Active', 'Done'],
      'Active',
      [tr('extend', 'Active', 'Active'), tr('complete', 'Active', 'Done')],
    );
    const { stats } = minimizeFsm(def);
    expect(stats.alreadyMinimal).toBe(true);
    const { minimized } = minimizeFsm(def);
    const selfLoop = minimized.transitions.find(
      (t) => t.name === 'extend' && t.from === 'Active' && t.to === 'Active',
    );
    expect(selfLoop).toBeDefined();
  });

  it('handles 1 state, 0 transitions unchanged', () => {
    const def = fsm(['Alone'], 'Alone', []);
    const { minimized, stats } = minimizeFsm(def);
    expect(stats.alreadyMinimal).toBe(true);
    expect(minimized.states).toEqual(['Alone']);
    expect(minimized.transitions).toHaveLength(0);
  });

  it('keeps reachable terminal states distinct (no cross-merge of endpoints)', () => {
    // A→B and A→C: B and C are both reachable terminals. Each gets its own
    // singleton partition block, so they are never merged with each other.
    const def = fsm(
      ['A', 'B', 'C'],
      'A',
      [tr('left', 'A', 'B'), tr('right', 'A', 'C')],
    );
    const { minimized, stats } = minimizeFsm(def);
    expect(stats.alreadyMinimal).toBe(true);
    expect(minimized.states).toHaveLength(3);
    expect(minimized.states).toContain('B');
    expect(minimized.states).toContain('C');
  });

  it('never merges distinct supply-chain endpoint states', () => {
    // Rejected and Delivered are both terminal but represent different outcomes.
    // Each gets its own singleton block → they remain distinct.
    const def = fsm(
      ['Pending', 'Approved', 'Shipped', 'Delivered', 'Rejected'],
      'Pending',
      [
        tr('approve', 'Pending', 'Approved'),
        tr('reject', 'Pending', 'Rejected'),
        tr('ship', 'Approved', 'Shipped'),
        tr('deliver', 'Shipped', 'Delivered'),
      ],
    );
    const { stats } = minimizeFsm(def);
    expect(stats.alreadyMinimal).toBe(true);
    expect(stats.minimizedStateCount).toBe(5);
  });

  it('preserves transition metadata on representative after merge', () => {
    // Both A and B have identical bodies (same payable + guard) so they merge.
    // The representative's metadata (id, name) must survive on the output transition.
    const richTransition: FsmTransition = {
      id: 'my-id',
      name: 'go',
      from: 'A',
      to: 'Terminal',
      payable: true,
      guard: 'msg.value > 0',
    };
    const def = fsm(
      ['Start', 'A', 'B', 'Terminal'],
      'Start',
      [
        tr('toA', 'Start', 'A'),
        tr('toB', 'Start', 'B'),
        richTransition,
        { id: 'other-id', name: 'go', from: 'B', to: 'Terminal', payable: true, guard: 'msg.value > 0' },
      ],
    );
    const { minimized } = minimizeFsm(def);
    // After merge, exactly one "go" transition should remain
    const goTransitions = minimized.transitions.filter((t) => t.name === 'go');
    expect(goTransitions).toHaveLength(1);
    // The representative state's id is preserved
    expect(goTransitions[0].id).toBe('my-id');
  });

  it('merges states with equivalent bodies but different transition names', () => {
    // RouteA→Done via "finish" and RouteB→Done via "complete" have identical
    // Solidity bodies — only the function name differs. Under body-semantic
    // equivalence, RouteA and RouteB should be merged.
    const def = fsm(
      ['Start', 'RouteA', 'RouteB', 'Done'],
      'Start',
      [
        tr('toA', 'Start', 'RouteA'),
        tr('toB', 'Start', 'RouteB'),
        tr('finish',   'RouteA', 'Done'),
        tr('complete', 'RouteB', 'Done'),
      ],
    );
    const { minimized, stats } = minimizeFsm(def);
    expect(stats.minimizedStateCount).toBe(3); // Start, rep(RouteA|RouteB), Done
    expect(Object.keys(stats.mergedStates)).toHaveLength(1);
    const merged = Object.keys(stats.mergedStates)[0];
    expect(minimized.states).not.toContain(merged);
  });

  it('does not merge states whose transitions differ only in guard', () => {
    const def = fsm(
      ['Start', 'A', 'B', 'Done'],
      'Start',
      [
        tr('toA', 'Start', 'A'),
        tr('toB', 'Start', 'B'),
        { ...tr('go', 'A', 'Done'), guard: 'x > 0' },
        { ...tr('go', 'B', 'Done'), guard: 'x > 1' },
      ],
    );
    const { stats } = minimizeFsm(def);
    expect(stats.mergedStates).toEqual({});
    expect(stats.minimizedStateCount).toBe(4);
  });

  it('does not merge states whose transitions differ only in guardConfig', () => {
    // A has an access-control guard for "admin", B for "owner" — structurally
    // different guardConfigs must prevent merging even if the raw guard string
    // is absent on both.
    const def = fsm(
      ['Start', 'A', 'B', 'Done'],
      'Start',
      [
        tr('toA', 'Start', 'A'),
        tr('toB', 'Start', 'B'),
        {
          ...tr('go', 'A', 'Done'),
          guardConfig: { guards: [{ guard: { type: 'access-control', role: 'admin' }, operator: 'AND' as const }] },
        },
        {
          ...tr('go', 'B', 'Done'),
          guardConfig: { guards: [{ guard: { type: 'access-control', role: 'owner' }, operator: 'AND' as const }] },
        },
      ],
    );
    const { stats } = minimizeFsm(def);
    expect(stats.mergedStates).toEqual({});
    expect(stats.minimizedStateCount).toBe(4);
  });

  it('merges states whose transitions have identical guardConfig', () => {
    // A and B both carry the same access-control guard → they are equivalent
    // and should be merged just like transitions with matching plain guards.
    const sharedGuardConfig = { guards: [{ guard: { type: 'access-control' as const, role: 'admin' }, operator: 'AND' as const }] };
    const def = fsm(
      ['Start', 'A', 'B', 'Done'],
      'Start',
      [
        tr('toA', 'Start', 'A'),
        tr('toB', 'Start', 'B'),
        { ...tr('go', 'A', 'Done'), guardConfig: sharedGuardConfig },
        { ...tr('go', 'B', 'Done'), guardConfig: sharedGuardConfig },
      ],
    );
    const { minimized, stats } = minimizeFsm(def);
    expect(stats.minimizedStateCount).toBe(3); // Start, rep(A|B), Done
    expect(Object.keys(stats.mergedStates)).toHaveLength(1);
    expect(minimized.transitions.filter((t) => t.name === 'go')).toHaveLength(1);
  });

  it('treats guardConfig as identical regardless of object property insertion order', () => {
    // The same logical guardConfig constructed with differing key order must
    // produce the same signature and therefore not prevent merging.
    const guardA = { guards: [{ operator: 'AND' as const, guard: { role: 'admin', type: 'access-control' as const } }] };
    const guardB = { guards: [{ guard: { type: 'access-control' as const, role: 'admin' }, operator: 'AND' as const }] };
    const def = fsm(
      ['Start', 'A', 'B', 'Done'],
      'Start',
      [
        tr('toA', 'Start', 'A'),
        tr('toB', 'Start', 'B'),
        { ...tr('go', 'A', 'Done'), guardConfig: guardA },
        { ...tr('go', 'B', 'Done'), guardConfig: guardB },
      ],
    );
    const { stats } = minimizeFsm(def);
    expect(stats.minimizedStateCount).toBe(3);
    expect(Object.keys(stats.mergedStates)).toHaveLength(1);
  });

  it('merges states whose guardConfigs differ only in errorMessage', () => {
    // errorMessage is a human-facing annotation and must not affect equivalence.
    // A and B carry the same access-control guard but with different error
    // messages — they should still be merged.
    const def = fsm(
      ['Start', 'A', 'B', 'Done'],
      'Start',
      [
        tr('toA', 'Start', 'A'),
        tr('toB', 'Start', 'B'),
        {
          ...tr('go', 'A', 'Done'),
          guardConfig: { guards: [{ guard: { type: 'access-control' as const, role: 'admin' }, operator: 'AND' as const, errorMessage: 'Not admin' }] },
        },
        {
          ...tr('go', 'B', 'Done'),
          guardConfig: { guards: [{ guard: { type: 'access-control' as const, role: 'admin' }, operator: 'AND' as const, errorMessage: 'Access denied' }] },
        },
      ],
    );
    const { minimized, stats } = minimizeFsm(def);
    expect(stats.minimizedStateCount).toBe(3); // Start, rep(A|B), Done
    expect(Object.keys(stats.mergedStates)).toHaveLength(1);
    expect(minimized.transitions.filter((t) => t.name === 'go')).toHaveLength(1);
  });

  it('minimizes duplicate transitions even when no states are merged', () => {
    // A and B are distinct states (different guards prevent merging), but both
    // have an identical duplicate transition to Done. The duplicate should be
    // removed and alreadyMinimal must be false even though no states changed.
    const def = fsm(
      ['Start', 'A', 'Done'],
      'Start',
      [
        tr('toA', 'Start', 'A'),
        // Two identical transitions from A to Done — one is a duplicate
        { ...tr('go', 'A', 'Done'), id: 'go-1' },
        { ...tr('go', 'A', 'Done'), id: 'go-2' },
      ],
    );
    const { minimized, stats } = minimizeFsm(def);
    expect(stats.mergedStates).toEqual({});
    expect(stats.minimizedStateCount).toBe(3); // no states removed
    expect(stats.minimizedTransitionCount).toBe(2); // duplicate dropped
    expect(stats.originalTransitionCount).toBe(3);
    expect(stats.alreadyMinimal).toBe(false);
    const goTransitions = minimized.transitions.filter((t) => t.name === 'go');
    expect(goTransitions).toHaveLength(1);
    expect(stats.removedTransitions).toHaveLength(1);
    expect(stats.removedTransitions[0].id).toBe('go-2');
  });

  it('reports removed transitions for merged states', () => {
    // When A and B merge, the transition from the merged-away state is removed.
    const def = fsm(
      ['Start', 'A', 'B', 'Terminal'],
      'Start',
      [
        tr('toA', 'Start', 'A'),
        tr('toB', 'Start', 'B'),
        tr('go', 'A', 'Terminal'),
        tr('go', 'B', 'Terminal'),
      ],
    );
    const { stats } = minimizeFsm(def);
    expect(stats.removedTransitions).toHaveLength(1);
    const removedNames = stats.removedTransitions.map((t) => t.from);
    // whichever of A or B was merged away, its transition is in removedTransitions
    const mergedAway = Object.keys(stats.mergedStates)[0];
    expect(removedNames).toContain(mergedAway);
  });

  it('reports no removed transitions for an already-minimal FSM', () => {
    const def = fsm(
      ['A', 'B', 'C', 'D'],
      'A',
      [tr('x', 'A', 'B'), tr('y', 'B', 'C'), tr('z', 'C', 'D')],
    );
    const { stats } = minimizeFsm(def);
    expect(stats.removedTransitions).toHaveLength(0);
  });
});