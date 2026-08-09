import { TaskStatus } from '../types';

const LABELS: Record<TaskStatus, string> = {
  overdue: 'Overdue',
  due_soon: 'Due soon',
  ok: 'On track',
};

export default function StatusBadge({ status }: { status: TaskStatus | null }) {
  if (!status) return <span className="badge badge-none">No schedule</span>;
  return <span className={`badge badge-${status}`}>{LABELS[status]}</span>;
}
