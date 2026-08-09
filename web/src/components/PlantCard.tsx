import { Link } from 'react-router-dom';
import { PlantWithTasks } from '../types';
import StatusBadge from './StatusBadge';

export default function PlantCard({ plant }: { plant: PlantWithTasks }) {
  return (
    <Link to={`/plants/${plant.id}`} className="plant-card">
      <div className="plant-card-photo">
        {plant.photo_path ? (
          <img src={`uploads/${plant.photo_path}`} alt={plant.name} />
        ) : (
          <div className="plant-card-photo-placeholder">🪴</div>
        )}
      </div>
      <div className="plant-card-body">
        <h3>{plant.name}</h3>
        {plant.species && <p className="muted">{plant.species}</p>}
        {plant.location && <p className="muted">📍 {plant.location}</p>}
        <StatusBadge status={plant.worst_status} />
      </div>
    </Link>
  );
}
