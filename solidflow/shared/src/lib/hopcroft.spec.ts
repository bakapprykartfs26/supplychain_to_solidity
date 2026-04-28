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
    expect(stats.removedDeadStates).toHaveLength(0);
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

  it('removes dead states but never the initialState', () => {
    // Trap is reachable from Start but has no path to any terminal state
    const def = fsm(
      ['Start', 'Terminal', 'Trap'],
      'Start',
      [
        tr('finish', 'Start', 'Terminal'),
        tr('trap', 'Start', 'Trap'),
        tr('loop', 'Trap', 'Trap'), // only self-loop, never reaches Terminal
      ],
    );
    const { minimized, stats } = minimizeFsm(def);
    expect(stats.removedDeadStates).toContain('Trap');
    expect(minimized.states).not.toContain('Trap');
    expect(minimized.states).toContain('Start');
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
});
