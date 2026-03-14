import type { Graph, Node, Edge } from '@antv/x6';
import type { FsmDefinition, FsmTransition } from '@solidflow/shared';
import { randomUUID } from './uuid';

export function definitionToGraph(
  graph: Graph,
  def: FsmDefinition,
): void {
  graph.clearCells();

  const stateNodes: Record<string, Node> = {};
  def.states.forEach((state, i) => {
    const col = i % 4;
    const row = Math.floor(i / 4);
    const node = graph.addNode({
      id: state,
      x: 80 + col * 200,
      y: 80 + row * 150,
      width: 120,
      height: 40,
      label: state,
      attrs: {
        body: {
          fill: state === def.initialState ? '#1976d2' : '#f5f5f5',
          stroke: '#333',
          rx: 6,
          ry: 6,
        },
        label: {
          fill: state === def.initialState ? '#fff' : '#333',
          fontSize: 13,
        },
      },
    });
    stateNodes[state] = node;
  });

  def.transitions.forEach((t) => {
    graph.addEdge({
      id: t.id,
      source: t.from,
      target: t.to,
      label: t.name,
      attrs: {
        line: { stroke: '#333', targetMarker: { name: 'block', size: 8 } },
      },
    });
  });
}

export function graphToDefinition(
  graph: Graph,
  existing: FsmDefinition,
): FsmDefinition {
  const nodes = graph.getNodes();
  const edges = graph.getEdges();

  const states = nodes.map((n: Node) => n.id ?? (n.getData() as { label?: string })?.label ?? 'state');
  const initialState = states[0] ?? existing.initialState;

  const transitions: FsmTransition[] = edges.map((e: Edge) => {
    const src = e.getSource() as { cell?: string };
    const tgt = e.getTarget() as { cell?: string };
    const existingT = existing.transitions.find((t) => t.id === e.id);
    return {
      id: e.id ?? randomUUID(),
      name: (e.getLabels?.()[0]?.['attrs']?.['label']?.['text'] as string | undefined) ?? existingT?.name ?? 'transition',
      from: src.cell ?? '',
      to: tgt.cell ?? '',
      guard: existingT?.guard,
      statements: existingT?.statements,
      emitEvent: existingT?.emitEvent,
    };
  });

  return { ...existing, states, initialState, transitions };
}
