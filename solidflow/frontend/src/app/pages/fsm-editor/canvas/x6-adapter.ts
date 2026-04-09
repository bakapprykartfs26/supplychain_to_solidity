import type { Graph, Node, Edge } from '@antv/x6';
import type { FsmDefinition, FsmTransition } from '@solidflow/shared';
import { randomUUID } from './uuid';

type EdgeTerminal = { cell: string; anchor?: string };

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

function getNodeCenter(graph: Graph, nodeId: string): { x: number; y: number } | null {
  const node = graph.getCellById(nodeId) as Node | null;
  if (!node) return null;

  const bbox = node.getBBox();
  return {
    x: bbox.x + bbox.width / 2,
    y: bbox.y + bbox.height / 2,
  };
}

function getPairKey(a: string, b: string): string {
  return [a, b].sort((x, y) => x.localeCompare(y)).join('::');
}

function getTransitionsForPair(
  transition: FsmTransition,
  transitions: FsmTransition[],
): FsmTransition[] {
  if (transition.from === transition.to) return [transition];

  const pairKey = getPairKey(transition.from, transition.to);

  return transitions.filter(
    (t) => t.from !== t.to && getPairKey(t.from, t.to) === pairKey,
  );
}

function getTransitionsForDirection(
  transition: FsmTransition,
  transitions: FsmTransition[],
): FsmTransition[] {
  return getTransitionsForPair(transition, transitions).filter(
    (t) => t.from === transition.from && t.to === transition.to,
  );
}

function sortTransitionsDeterministically(transitions: FsmTransition[]): FsmTransition[] {
  return [...transitions].sort((a, b) => {
    const byName = (a.name ?? '').localeCompare(b.name ?? '');
    if (byName !== 0) return byName;
    return a.id.localeCompare(b.id);
  });
}

function getDirectionalEdgeConfig(
  graph: Graph,
  transition: FsmTransition,
  transitions: FsmTransition[],
): {
  source: EdgeTerminal;
  target: EdgeTerminal;
  vertices: { x: number; y: number }[];
} {
  if (transition.from === transition.to) {
    return {
      source: { cell: transition.from, anchor: 'right' },
      target: { cell: transition.to, anchor: 'left' },
      vertices: [],
    };
  }

  const pairTransitions = getTransitionsForPair(transition, transitions);
  const sameDirectionTransitions = sortTransitionsDeterministically(
    getTransitionsForDirection(transition, transitions),
  );

  const sourceCenter = getNodeCenter(graph, transition.from);
  const targetCenter = getNodeCenter(graph, transition.to);

  if (!sourceCenter || !targetCenter) {
    return {
      source: { cell: transition.from },
      target: { cell: transition.to },
      vertices: [],
    };
  }

  const dx = targetCenter.x - sourceCenter.x;
  const dy = targetCenter.y - sourceCenter.y;
  const isHorizontal = Math.abs(dx) >= Math.abs(dy);

  const reverseExists = pairTransitions.some(
    (t) => t.from === transition.to && t.to === transition.from,
  );

  const laneIndex = Math.max(
    0,
    sameDirectionTransitions.findIndex((t) => t.id === transition.id),
  );

  const baseOffset = reverseExists ? 24 : 0;
  const laneSpacing = 18;
  const offset = baseOffset + laneIndex * laneSpacing;

  const isCanonicalDirection = transition.from.localeCompare(transition.to) < 0;

  if (isHorizontal) {
    const anchor = reverseExists
      ? (isCanonicalDirection ? 'top' : 'bottom')
      : 'top';

    const signedOffset = reverseExists
      ? (isCanonicalDirection ? -offset : offset)
      : -(offset + 12);

    return {
      source: { cell: transition.from, anchor },
      target: { cell: transition.to, anchor },
      vertices: [
        {
          x: (sourceCenter.x + targetCenter.x) / 2,
          y: (sourceCenter.y + targetCenter.y) / 2 + signedOffset,
        },
      ],
    };
  }

  const anchor = reverseExists
    ? (isCanonicalDirection ? 'left' : 'right')
    : 'left';

  const signedOffset = reverseExists
    ? (isCanonicalDirection ? -offset : offset)
    : -(offset + 12);

  return {
    source: { cell: transition.from, anchor },
    target: { cell: transition.to, anchor },
    vertices: [
      {
        x: (sourceCenter.x + targetCenter.x) / 2 + signedOffset,
        y: (sourceCenter.y + targetCenter.y) / 2,
      },
    ],
  };
}

export function definitionToGraph(
  graph: Graph,
  def: FsmDefinition,
): void {
  const existingNodeIds = new Set(graph.getNodes().map((n) => n.id));
  const newStateIds = new Set(def.states);

  existingNodeIds.forEach((id) => {
    if (!newStateIds.has(id)) {
      const node = graph.getCellById(id);
      if (node) graph.removeCell(node);
    }
  });

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

  const existingEdgeIds = new Set(graph.getEdges().map((e) => e.id));
  const newTransitionIds = new Set(def.transitions.map((t) => t.id));

  existingEdgeIds.forEach((id) => {
    if (!newTransitionIds.has(id)) {
      const edge = graph.getCellById(id);
      if (edge) graph.removeCell(edge);
    }
  });

  def.transitions.forEach((t) => {
    const isSelfLoop = t.from === t.to;
    const edgeConfig = getDirectionalEdgeConfig(graph, t, def.transitions);

    if (!existingEdgeIds.has(t.id)) {
      graph.addEdge({
        id: t.id,
        source: edgeConfig.source,
        target: edgeConfig.target,
        vertices: edgeConfig.vertices,
        label: t.name,
        router: isSelfLoop
          ? { name: 'loop', args: getSelfLoopRouterArgs(t, def.transitions) }
          : { name: 'normal' },
        attrs: {
          line: { stroke: '#29b6f6', targetMarker: { name: 'block', size: 8 } },
          label: { fill: '#5a7fa0', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' },
        },
      });
    } else {
      const edge = graph.getCellById(t.id) as Edge;
      if (edge) {
        edge.setSource(edgeConfig.source);
        edge.setTarget(edgeConfig.target);
        edge.setVertices(edgeConfig.vertices);

        if (isSelfLoop) {
          edge.setRouter({ name: 'loop', args: getSelfLoopRouterArgs(t, def.transitions) });
        } else {
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