import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import './db';
import { UPLOADS_DIR } from './db';
import { plantsRouter } from './routes/plants';
import { plantTasksRouter, tasksRouter } from './routes/tasks';
import { plantSensorsRouter, sensorsRouter } from './routes/sensors';
import { settingsRouter } from './routes/settings';
import { uploadsRouter } from './routes/uploads';
import { initMqtt } from './services/mqtt';
import { startScheduler } from './services/scheduler';

const app = express();
const PORT = Number(process.env.PORT) || 8080;

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(UPLOADS_DIR));

app.use('/api/plants/:plantId/tasks', plantTasksRouter);
app.use('/api/plants/:plantId/sensors', plantSensorsRouter);
app.use('/api/plants', plantsRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/sensors', sensorsRouter);
app.use('/api/settings', settingsRouter);
app.use('/api', uploadsRouter);

app.get('/api/health', (_req, res) => res.json({ ok: true }));

const webDist = path.join(__dirname, '..', '..', 'web', 'dist');
if (fs.existsSync(webDist)) {
  app.use(express.static(webDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next();
    res.sendFile(path.join(webDist, 'index.html'));
  });
}

initMqtt();
startScheduler();

app.listen(PORT, () => {
  console.log(`Planty server listening on port ${PORT}`);
});
