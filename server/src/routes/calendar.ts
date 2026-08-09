import { Router } from 'express';
import { generateIcs } from '../services/calendar';

export const calendarRouter = Router();

calendarRouter.get('/', (_req, res) => {
  res.set('Content-Type', 'text/calendar; charset=utf-8');
  res.send(generateIcs());
});
