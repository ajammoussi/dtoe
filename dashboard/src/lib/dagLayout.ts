import dagre from 'dagre';
import type { Task } from '../types';

export const NODE_WIDTH = 208;
export const NODE_HEIGHT = 100;

export type DagDirection = 'LR' | 'TB';

export interface NodePosition {
  x: number;
  y: number;
}

export function dependencyIds(task: Task): string[] {
  return task.dependsOn ?? task.dependencies ?? [];
}

export function layoutDag(
  tasks: Task[],
  direction: DagDirection = 'LR'
): Map<string, NodePosition> {
  const positions = new Map<string, NodePosition>();
  if (tasks.length === 0) return positions;

  const graph = new dagre.graphlib.Graph();
  graph.setGraph({
    rankdir: direction,
    nodesep: 32,
    ranksep: direction === 'TB' ? 56 : 84,
    marginx: 8,
    marginy: 8,
  });
  graph.setDefaultEdgeLabel(() => ({}));

  const known = new Set(tasks.map(task => task.id));
  for (const task of tasks) {
    graph.setNode(task.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }
  for (const task of tasks) {
    for (const dependency of dependencyIds(task)) {
      if (known.has(dependency)) {
        graph.setEdge(dependency, task.id);
      }
    }
  }

  dagre.layout(graph);

  for (const task of tasks) {
    const node = graph.node(task.id);
    if (node) {
      positions.set(task.id, { x: node.x - NODE_WIDTH / 2, y: node.y - NODE_HEIGHT / 2 });
    }
  }
  return positions;
}
