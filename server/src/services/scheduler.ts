import cron from 'node-cron';
import { publishAllPlants } from './mqtt';

export function startScheduler() {
  // Re-publish daily so "days until due" / overdue status stays fresh in HA even without edits.
  cron.schedule('5 0 * * *', () => publishAllPlants());
}
