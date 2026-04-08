import type { Graph, Node, Edge } from '@antv/x6';
import type { FsmDefinition, FsmTransition } from '@solidflow/shared';
import { randomUUID } from './uuid';

function getSelfLoopRouterArgs(
  transition: FsmTransition,
  transitions: FsmTransition[],
) {
  const selfLoops = transitions.filter((t) => t.from === transition.from && t.to === transition.to);
  const loopIndex = selfLoops.findIndex((t) => t.id === transition.id);
  const baseHeight = 50;
  const baseWidth = 1;
  const extraStep = 0;
  return {
    angle: 90,
    width: baseHeight + loopIndex * 25,
    height: baseWidth + loopIndex * extraStep,
  };
}

export function definitionToGraph(
  graph: Graph,
  def: FsmDefinition,
): void {
  const existingNodeIds = new Set(graph.getNodes().map((n) => n.id));
  const newStateIds = new Set(def.states);

  // Remove nodes that no longer exist in definition
  existingNodeIds.forEach((id) => {
    if (!newStateIds.has(id)) {
      const node = graph.getCellById(id);
      if (node) graph.removeCell(node);
    }
  });

  // Add only new nodes that don't exist yet
  def.states.forEach((state, i) => {
    if (!existingNodeIds.has(state)) {
      const col = i % 4;
      const row = Math.floor(i / 4);
      graph.addNode({
        id: state,
        x: 80 + col * 200,
        y: 80 + row * 150,
        width: 120,
        height: 40,
        label: state,
        attrs: {
          body: {
            fill: state === def.initialState ? '#0a3a58' : '#122336',
            stroke: state === def.initialState ? '#29b6f6' : '#1a3350',
            rx: 6,
            ry: 6,
          },
          label: {
            fill: state === def.initialState ? '#29b6f6' : '#d8eaf8',
            fontSize: 13,
            fontFamily: 'JetBrains Mono, monospace',
          },
        },
      });
    }
  });

  // Update existing node styles (e.g. initialState highlight changed)
  def.states.forEach((state) => {
    if (existingNodeIds.has(state)) {
      const node = graph.getCellById(state);
      node?.setAttrs({
        body: {
          fill: state === def.initialState ? '#0a3a58' : '#122336',
          stroke: state === def.initialState ? '#29b6f6' : '#1a3350',
        },
        label: {
          fill: state === def.initialState ? '#29b6f6' : '#d8eaf8',
        },
      });
    }
  });

  // Handle edges — remove old, add new
  const existingEdgeIds = new Set(graph.getEdges().map((e) => e.id));
  const newTransitionIds = new Set(def.transitions.map((t) => t.id));

  existingEdgeIds.forEach((id) => {
    if (!newTransitionIds.has(id)) {
      const edge = graph.getCellById(id);
      if (edge) graph.removeCell(edge);
    }
  });

  def.transitions.forEach((t) => {
    if (!existingEdgeIds.has(t.id)) {
      const isSelfLoop = t.from === t.to;
      graph.addEdge({
        id: t.id,
        source: isSelfLoop ? { cell: t.from, anchor: 'right' } : t.from,
        target: isSelfLoop ? { cell: t.to, anchor: 'left' } : t.to,
        label: t.name,
        router: isSelfLoop
          ? { name: 'loop', args: getSelfLoopRouterArgs(t, def.transitions) }
          : undefined,
        attrs: {
          line: { stroke: '#29b6f6', targetMarker: { name: 'block', size: 8 } },
          label: { fill: '#5a7fa0', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' },
        },
      });
    } else {
      // Edge exists — update source/target/label if changed
      const edge = graph.getCellById(t.id) as Edge;
      if (edge) {
        const src = edge.getSource() as { cell?: string };
        const tgt = edge.getTarget() as { cell?: string };
        const isSelfLoop = t.from === t.to;
        if (isSelfLoop) {
          if (src.cell !== t.from) edge.setSource({ cell: t.from, anchor: 'right' });
          if (tgt.cell !== t.to) edge.setTarget({ cell: t.to, anchor: 'left' });
          edge.setRouter({ name: 'loop', args: getSelfLoopRouterArgs(t, def.transitions) });
        } else {
          if (src.cell !== t.from) edge.setSource({ cell: t.from });
          if (tgt.cell !== t.to) edge.setTarget({ cell: t.to });
          edge.setRouter({ name: 'normal' });
        }
        const currentLabel = edge.getLabels?.()[0]?.['attrs']?.['label']?.['text'];
        if (currentLabel !== t.name) edge.setLabels([t.name]);
      }
    }
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
