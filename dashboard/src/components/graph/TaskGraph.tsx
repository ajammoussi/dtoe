import { useMemo } from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { Task, TaskStatus } from '../../types';
import { NODE_WIDTH, dependencyIds, layoutDag, type DagDirection } from '../../lib/dagLayout';
import { cn } from '../../lib/utils';
import { formatDuration } from '../../lib/format';

type TaskNodeData = {
  task: Task;
  showStatus: boolean;
  current: boolean;
  direction: DagDirection;
};

type TaskFlowNode = Node<TaskNodeData, 'task'>;

const STATUS_DOT: Record<TaskStatus, string> = {
  PENDING: 'bg-amber-500',
  QUEUED: 'bg-violet-500',
  RUNNING: 'bg-blue-500 animate-pulse',
  SUCCESS: 'bg-emerald-500',
  FAILED: 'bg-red-500',
  TIMED_OUT: 'bg-orange-500',
  RETRYING: 'bg-cyan-500',
  CANCELLED: 'bg-slate-500',
};

const STATUS_MINIMAP_COLOR: Record<TaskStatus, string> = {
  PENDING: '#f59e0b',
  QUEUED: '#8b5cf6',
  RUNNING: '#3b82f6',
  SUCCESS: '#10b981',
  FAILED: '#ef4444',
  TIMED_OUT: '#f97316',
  RETRYING: '#06b6d4',
  CANCELLED: '#64748b',
};

const LEGEND: TaskStatus[] = ['SUCCESS', 'RUNNING', 'QUEUED', 'PENDING', 'FAILED', 'TIMED_OUT', 'CANCELLED'];

function payloadCommand(payload?: Record<string, unknown>): string | undefined {
  const command = payload?.command;
  return typeof command === 'string' && command ? command : undefined;
}

function TaskNode({ data, selected }: NodeProps<TaskFlowNode>) {
  const { task, showStatus, current, direction } = data;
  const sourcePosition = direction === 'TB' ? Position.Bottom : Position.Right;
  const targetPosition = direction === 'TB' ? Position.Top : Position.Left;
  const command = payloadCommand(task.payload);
  const isFailure = task.status === 'FAILED' || task.status === 'TIMED_OUT';
  return (
    <div
      className={cn(
        'rounded-lg border bg-card px-3 py-2 text-left shadow-sm transition-colors',
        selected
          ? 'border-primary ring-2 ring-primary/40'
          : current
            ? 'border-primary/70'
            : isFailure
              ? 'border-red-500/60'
              : 'border-border',
        task.status === 'CANCELLED' && 'opacity-70'
      )}
    >
      <Handle type="target" position={targetPosition} className="!h-1.5 !w-1.5 !border-0 !bg-border" />
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'h-2 w-2 shrink-0 rounded-full',
            showStatus ? STATUS_DOT[task.status] : 'bg-muted-foreground/40'
          )}
        />
        <p className="truncate text-sm font-medium">{task.name || task.type}</p>
      </div>
      <p className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">{task.type}</p>
      {command && (
        <p className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground/70" title={command}>
          {command}
        </p>
      )}
      {showStatus && (
        <p className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>{task.status}</span>
          <span>{formatDuration(task.startedAt, task.completedAt)}</span>
        </p>
      )}
      {isFailure && <p className="mt-0.5 text-[10px] text-red-400">error — see details</p>}
      <Handle type="source" position={sourcePosition} className="!h-1.5 !w-1.5 !border-0 !bg-border" />
    </div>
  );
}

const nodeTypes = { task: TaskNode };

interface TaskGraphProps {
  tasks: Task[];
  selectedId?: string | null;
  onSelect?: (taskId: string | null) => void;
  currentId?: string;
  showStatus?: boolean;
  height?: number;
  emptyLabel?: string;
  direction?: DagDirection;
  showMinimap?: boolean;
}

export function TaskGraph({
  tasks,
  selectedId,
  onSelect,
  currentId,
  showStatus = true,
  height = 440,
  emptyLabel = 'No tasks to show',
  direction = 'LR',
  showMinimap = true,
}: TaskGraphProps) {
  const nodes = useMemo<TaskFlowNode[]>(() => {
    const positions = layoutDag(tasks, direction);
    return tasks.map(task => ({
      id: task.id,
      type: 'task',
      position: positions.get(task.id) ?? { x: 0, y: 0 },
      data: { task, showStatus, current: task.id === currentId, direction },
      style: { width: NODE_WIDTH },
      draggable: false,
    }));
  }, [tasks, showStatus, currentId, direction]);

  const edges = useMemo<Edge[]>(() => {
    const known = new Set(tasks.map(task => task.id));
    const result: Edge[] = [];
    for (const task of tasks) {
      for (const dependency of dependencyIds(task)) {
        if (!known.has(dependency)) continue;
        const active = selectedId === task.id || selectedId === dependency;
        result.push({
          id: `${dependency}->${task.id}`,
          source: dependency,
          target: task.id,
          type: 'smoothstep',
          animated: task.status === 'QUEUED' || task.status === 'RUNNING',
          style: {
            stroke: active ? 'hsl(var(--primary))' : 'hsl(var(--border))',
            strokeWidth: active ? 2 : 1.4,
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 16,
            height: 16,
            color: active ? 'hsl(var(--primary))' : 'hsl(var(--border))',
          },
        });
      }
    }
    return result;
  }, [tasks, selectedId]);

  const minimapColor = (node: Node) => {
    const data = node.data as TaskNodeData | undefined;
    return data?.task ? STATUS_MINIMAP_COLOR[data.task.status] : '#64748b';
  };

  if (tasks.length === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground"
        style={{ height }}
      >
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="overflow-hidden rounded-lg border border-border bg-background/40" style={{ height }}>
        <ReactFlow
          key={`graph-${tasks.length}`}
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodeClick={(_, node) => onSelect?.(node.id)}
          onPaneClick={() => onSelect?.(null)}
          fitView
          fitViewOptions={{ padding: 0.18 }}
          minZoom={0.2}
          maxZoom={1.75}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable
          colorMode="dark"
        >
          <Background variant={BackgroundVariant.Dots} gap={18} size={1} color="hsl(var(--border))" />
          <Controls showInteractive={false} />
          {showMinimap && (
            <MiniMap pannable zoomable nodeColor={minimapColor} maskColor="rgba(2, 6, 23, 0.65)" />
          )}
        </ReactFlow>
      </div>
      {showStatus && (
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
          {LEGEND.map(status => (
            <span key={status} className="flex items-center gap-1.5">
              <span className={cn('h-2 w-2 rounded-full', STATUS_DOT[status])} />
              {status}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
