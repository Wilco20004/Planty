import { db } from '../db';
import { CareTask, Plant } from '../types';
import { withStatus, TASK_TYPE_LABELS } from './schedule';

function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

function formatIcsDate(date: Date): string {
  return date.toISOString().slice(0, 10).replace(/-/g, '');
}

function formatIcsTimestamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

export function generateIcs(): string {
  const rows = db
    .prepare(
      `SELECT ct.*, p.name as plant_name FROM care_tasks ct JOIN plants p ON p.id = ct.plant_id ORDER BY ct.created_at ASC`
    )
    .all() as (CareTask & { plant_name: string })[];

  const now = new Date();
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Planty//Plant Care Schedule//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Planty Care Schedule',
  ];

  for (const row of rows) {
    const { plant_name, ...task } = row;
    const withStat = withStatus(task);
    const label = task.label || TASK_TYPE_LABELS[task.task_type] || task.task_type;
    lines.push(
      'BEGIN:VEVENT',
      `UID:${task.id}@planty`,
      `DTSTAMP:${formatIcsTimestamp(now)}`,
      `DTSTART;VALUE=DATE:${formatIcsDate(new Date(withStat.next_due_at))}`,
      `RRULE:FREQ=DAILY;INTERVAL=${task.interval_days}`,
      `SUMMARY:${escapeIcsText(`${plant_name} — ${label}`)}`
    );
    if (task.notes) {
      lines.push(`DESCRIPTION:${escapeIcsText(task.notes)}`);
    }
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}
