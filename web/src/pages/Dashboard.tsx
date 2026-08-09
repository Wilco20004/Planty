import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { PlantWithTasks } from '../types';
import PlantCard from '../components/PlantCard';

export default function Dashboard() {
  const [plants, setPlants] = useState<PlantWithTasks[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.listPlants().then(setPlants).catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="error">{error}</p>;
  if (!plants) return <p>Loading...</p>;

  if (plants.length === 0) {
    return (
      <div className="empty-state">
        <p>No plants yet.</p>
        <Link to="/plants/new" className="button">
          Add your first plant
        </Link>
      </div>
    );
  }

  const order = { overdue: 0, due_soon: 1, ok: 2 } as const;
  const sorted = [...plants].sort((a, b) => {
    const av = a.worst_status ? order[a.worst_status] : 3;
    const bv = b.worst_status ? order[b.worst_status] : 3;
    return av - bv;
  });

  return (
    <div className="plant-grid">
      {sorted.map((p) => (
        <PlantCard key={p.id} plant={p} />
      ))}
    </div>
  );
}
