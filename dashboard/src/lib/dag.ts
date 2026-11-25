import type { Task } from '../types';

export function orderTasks(tasks: Task[]): Task[] {
  const byId = new Map(tasks.map(task => [task.id, task]));
  const order = new Map(tasks.map((task, index) => [task.id, index]));
  const indegree = new Map<string, number>();
  const dependents = new Map<string, string[]>();

  for (const task of tasks) {
    const deps = (task.dependsOn ?? task.dependencies ?? []).filter(id => byId.has(id));
    indegree.set(task.id, deps.length);
    for (const dep of deps) {
      const list = dependents.get(dep) ?? [];
      list.push(task.id);
      dependents.set(dep, list);
    }
  }

  const ready = tasks.filter(task => indegree.get(task.id) === 0).map(task => task.id);
  const result: Task[] = [];

  while (ready.length > 0) {
    ready.sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0));
    const id = ready.shift() as string;
    const task = byId.get(id);
    if (task) result.push(task);
    for (const dependent of dependents.get(id) ?? []) {
      const remaining = (indegree.get(dependent) ?? 1) - 1;
      indegree.set(dependent, remaining);
      if (remaining === 0) ready.push(dependent);
    }
  }

  return result.length === tasks.length ? result : tasks;
}
