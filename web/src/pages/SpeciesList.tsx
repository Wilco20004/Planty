import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { CustomSpecies } from '../types';

export default function SpeciesList() {
  const [species, setSpecies] = useState<CustomSpecies[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function reload() {
    api.listCustomSpecies().then(setSpecies).catch((e) => setError(e.message));
  }

  useEffect(reload, []);

  async function handleDelete(item: CustomSpecies) {
    if (!confirm(`Delete "${item.common_name}" from your species database? Plants using it will lose this info.`)) return;
    await api.deleteCustomSpecies(item.id);
    reload();
  }

  return (
    <div>
      <div className="actions" style={{ justifyContent: 'space-between', marginBottom: '1rem' }}>
        <h2 style={{ margin: 0 }}>My species database</h2>
        <Link to="/species/new" className="button">
          Add species
        </Link>
      </div>
      <p className="muted">
        Plant info you've entered or saved yourself. Used alongside (or instead of) Perenual when adding a plant —
        it works even without a Perenual API key.
      </p>
      {error && <p className="error">{error}</p>}
      {species && species.length === 0 && <p className="muted">No species saved yet.</p>}
      {species && species.length > 0 && (
        <ul className="task-list">
          {species.map((item) => (
            <li key={item.id} className="task-row">
              <div>
                <strong>{item.common_name}</strong>
                {item.scientific_name && <span className="muted italic"> — {item.scientific_name}</span>}
              </div>
              <div className="actions">
                <Link to={`/species/${item.id}/edit`} className="button small secondary">
                  Edit
                </Link>
                <button className="button small danger" onClick={() => handleDelete(item)}>
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
