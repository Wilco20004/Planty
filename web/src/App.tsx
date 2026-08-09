import { NavLink, Route, Routes } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import PlantForm from './pages/PlantForm';
import PlantDetail from './pages/PlantDetail';
import Settings from './pages/Settings';

export default function App() {
  return (
    <div className="app">
      <header className="topbar">
        <NavLink to="/" className="brand">
          🌿 Planty
        </NavLink>
        <nav>
          <NavLink to="/" end>
            Plants
          </NavLink>
          <NavLink to="/plants/new">Add plant</NavLink>
          <NavLink to="/settings">Settings</NavLink>
        </nav>
      </header>
      <main className="content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/plants/new" element={<PlantForm />} />
          <Route path="/plants/:id" element={<PlantDetail />} />
          <Route path="/plants/:id/edit" element={<PlantForm />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>
    </div>
  );
}
