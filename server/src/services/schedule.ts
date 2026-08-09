import { CareTask, CareTaskWithStatus, TaskStatus } from '../types';

const DUE_SOON_WINDOW_DAYS = 2;

export function withStatus(task: CareTask): CareTaskWithStatus {
  const anchor = task.last_completed_at ?? task.created_at;
  const anchorDate = new Date(anchor);
  const nextDue = new Date(anchorDate);
  nextDue.setDate(nextDue.getDate() + task.interval_days);

  const now = new Date();
  const msPerDay = 24 * 60 * 60 * 1000;
  const daysUntilDue = Math.ceil((nextDue.getTime() - now.getTime()) / msPerDay);

  let status: TaskStatus = 'ok';
  if (daysUntilDue < 0 || (daysUntilDue === 0 && now > nextDue)) {
    status = 'overdue';
  } else if (daysUntilDue <= DUE_SOON_WINDOW_DAYS) {
    status = 'due_soon';
  }

  return {
    ...task,
    next_due_at: nextDue.toISOString(),
    status,
    days_until_due: daysUntilDue,
  };
}

export function worstStatus(statuses: TaskStatus[]): TaskStatus | null {
  if (statuses.includes('overdue')) return 'overdue';
  if (statuses.includes('due_soon')) return 'due_soon';
  if (statuses.length > 0) return 'ok';
  return null;
}

export const TASK_TYPE_LABELS: Record<string, string> = {
  watering: 'Watering',
  light_move: 'Move to brighter light',
  fertilizing: 'Fertilizing',
  custom: 'Custom',
};
