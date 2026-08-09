import { Router } from 'express';
import {
  createCustomSpecies,
  deleteCustomSpecies,
  getCustomSpecies,
  listCustomSpecies,
  updateCustomSpecies,
} from '../services/customSpecies';

export const customSpeciesRouter = Router();

customSpeciesRouter.get('/', (_req, res) => {
  res.json(listCustomSpecies());
});

customSpeciesRouter.get('/:id', (req, res) => {
  const species = getCustomSpecies(req.params.id);
  if (!species) return res.status(404).json({ error: 'Species not found' });
  res.json(species);
});

customSpeciesRouter.post('/', (req, res) => {
  if (!req.body.common_name || typeof req.body.common_name !== 'string') {
    return res.status(400).json({ error: 'common_name is required' });
  }
  res.status(201).json(createCustomSpecies(req.body));
});

customSpeciesRouter.put('/:id', (req, res) => {
  const updated = updateCustomSpecies(req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: 'Species not found' });
  res.json(updated);
});

customSpeciesRouter.delete('/:id', (req, res) => {
  if (!deleteCustomSpecies(req.params.id)) return res.status(404).json({ error: 'Species not found' });
  res.status(204).end();
});
