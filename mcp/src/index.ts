#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { del, get, post, put, PlantyApiError } from './plantyClient.js';

const LIGHT_REQUIREMENTS = ['low', 'medium', 'bright_indirect', 'direct'] as const;

const speciesFields = {
  common_name: z.string().min(1).describe('Common name, e.g. "Golden Pothos".'),
  scientific_name: z.string().describe('Latin binomial, e.g. "Epipremnum aureum".').optional(),
  thumbnail: z.string().describe('URL to a representative photo of the species.').optional(),
  light_requirement: z.enum(LIGHT_REQUIREMENTS).describe('Overall light category.').optional(),
  sunlight_description: z.string().describe('Free-text detail on sunlight needs.').optional(),
  watering_interval_days: z.number().int().positive().describe('Typical days between waterings.').optional(),
  watering_description: z.string().describe('Free-text watering guidance.').optional(),
  family: z.string().describe('Botanical family, e.g. "Araceae".').optional(),
  plant_type: z.string().describe('e.g. "Vine", "Succulent", "Tree".').optional(),
  cycle: z.string().describe('e.g. "Perennial", "Annual".').optional(),
  origin: z.string().describe('Native region/origin.').optional(),
  dimensions: z.string().describe('Typical mature size, e.g. "up to 3m trailing".').optional(),
  description: z.string().describe('General description of the species.').optional(),
  care_level: z.string().describe('e.g. "Easy", "Moderate", "Difficult".').optional(),
  growth_rate: z.string().describe('e.g. "Slow", "Moderate", "Fast".').optional(),
  soil: z.string().describe('Preferred soil/potting mix.').optional(),
  drought_tolerant: z.boolean().optional(),
  indoor: z.boolean().describe('Whether it is typically grown indoors.').optional(),
  poisonous_to_humans: z.boolean().optional(),
  poisonous_to_pets: z.boolean().optional(),
  pruning_months: z.string().describe('e.g. "March, April".').optional(),
};

function textResult(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
}

function errorResult(error: unknown) {
  const message = error instanceof PlantyApiError
    ? `Planty API error (${error.status}): ${error.message}`
    : error instanceof Error
      ? error.message
      : String(error);
  return { content: [{ type: 'text' as const, text: message }], isError: true as const };
}

const server = new McpServer({ name: 'planty-mcp', version: '1.0.0' });

server.registerTool(
  'search_species',
  {
    title: 'Search plant species',
    description:
      'Search Planty\'s local custom species database and (if configured) the Perenual API by name. ' +
      'Use this before add_species to check whether a matching species already exists and avoid duplicates.',
    inputSchema: {
      query: z.string().min(2).describe('Name to search for, e.g. "pothos".'),
    },
  },
  async ({ query }) => {
    try {
      const results = await get(`/plant-lookup/search?q=${encodeURIComponent(query)}`);
      return textResult(results);
    } catch (error) {
      return errorResult(error);
    }
  },
);

server.registerTool(
  'get_perenual_species_detail',
  {
    title: 'Get Perenual species detail',
    description:
      'Fetch full reference detail for a species from the Perenual API by its numeric Perenual id ' +
      '(as returned by search_species). Requires a Perenual API key configured in Planty Settings. ' +
      'Useful for enriching a species record before calling add_species.',
    inputSchema: {
      perenual_id: z.number().int().describe('Numeric Perenual species id.'),
    },
  },
  async ({ perenual_id }) => {
    try {
      const detail = await get(`/plant-lookup/${perenual_id}`);
      return textResult(detail);
    } catch (error) {
      return errorResult(error);
    }
  },
);

server.registerTool(
  'list_species',
  {
    title: 'List custom species',
    description: 'List every species currently stored in Planty\'s local custom species database.',
    inputSchema: {},
  },
  async () => {
    try {
      const species = await get('/custom-species');
      return textResult(species);
    } catch (error) {
      return errorResult(error);
    }
  },
);

server.registerTool(
  'get_species',
  {
    title: 'Get custom species',
    description: 'Get one species from Planty\'s local custom species database by its id.',
    inputSchema: {
      id: z.string().describe('The species id (uuid).'),
    },
  },
  async ({ id }) => {
    try {
      const species = await get(`/custom-species/${encodeURIComponent(id)}`);
      return textResult(species);
    } catch (error) {
      return errorResult(error);
    }
  },
);

server.registerTool(
  'add_species',
  {
    title: 'Add plant species',
    description:
      'Add a new species to Planty\'s local custom species database. Use this after identifying a plant ' +
      '(e.g. from a photo the user shared) to save its care details for future reference. Only common_name ' +
      'is required; fill in as many other fields as you can confidently determine. Consider calling ' +
      'search_species first to avoid creating a duplicate of a species that already exists.',
    inputSchema: speciesFields,
  },
  async (input) => {
    try {
      const created = await post('/custom-species', input);
      return textResult(created);
    } catch (error) {
      return errorResult(error);
    }
  },
);

server.registerTool(
  'update_species',
  {
    title: 'Update plant species',
    description: 'Update fields on an existing species in Planty\'s local custom species database.',
    inputSchema: {
      id: z.string().describe('The species id (uuid) to update.'),
      ...Object.fromEntries(
        Object.entries(speciesFields).map(([key, schema]) => [key, schema.optional()]),
      ),
    },
  },
  async ({ id, ...updates }) => {
    try {
      const updated = await put(`/custom-species/${encodeURIComponent(id)}`, updates);
      return textResult(updated);
    } catch (error) {
      return errorResult(error);
    }
  },
);

server.registerTool(
  'delete_species',
  {
    title: 'Delete plant species',
    description:
      'Delete a species from Planty\'s local custom species database. This does not delete any physical ' +
      'plants linked to it, but they will lose their species reference. Ask for confirmation before using ' +
      'this unless the user has clearly asked to delete the species.',
    inputSchema: {
      id: z.string().describe('The species id (uuid) to delete.'),
    },
  },
  async ({ id }) => {
    try {
      await del(`/custom-species/${encodeURIComponent(id)}`);
      return textResult({ deleted: true, id });
    } catch (error) {
      return errorResult(error);
    }
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
