import { Router } from 'express';
import { getSpeciesDetail, PlantLookupError, searchSpecies } from '../services/plantLookup';
import { searchCustomSpecies } from '../services/customSpecies';

export const plantLookupRouter = Router();

plantLookupRouter.get('/search', async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (q.length < 2) return res.json([]);

  const localMatches = searchCustomSpecies(q);
  try {
    res.json([...localMatches, ...(await searchSpecies(q))]);
  } catch (e) {
    // Perenual failing (no key configured, rate limited, etc.) shouldn't hide matches
    // from your own local species database — only surface it if there's nothing else to show.
    if (localMatches.length > 0) return res.json(localMatches);
    const err = e as PlantLookupError;
    res.status(err.status || 502).json({ error: err.message });
  }
});

plantLookupRouter.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid species id' });
  try {
    res.json(await getSpeciesDetail(id));
  } catch (e) {
    const err = e as PlantLookupError;
    res.status(err.status || 502).json({ error: err.message });
  }
});
