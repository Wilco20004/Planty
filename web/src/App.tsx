import { NavLink, Route, Routes } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import PlantForm from './pages/PlantForm';
import PlantDetail from './pages/PlantDetail';
import Labels from './pages/Labels';
import Settings from './pages/Settings';
import SpeciesList from './pages/SpeciesList';
import SpeciesForm from './pages/SpeciesForm';

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
          <NavLink to="/species">Species DB</NavLink>
          <NavLink to="/labels">Labels</NavLink>
          <NavLink to="/settings">Settings</NavLink>
        </nav>
      </header>
      <main className="content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/plants/new" element={<PlantForm />} />
          <Route path="/plants/:id" element={<PlantDetail />} />
          <Route path="/plants/:id/edit" element={<PlantForm />} />
          <Route path="/species" element={<SpeciesList />} />
          <Route path="/species/new" element={<SpeciesForm />} />
          <Route path="/species/:id/edit" element={<SpeciesForm />} />
          <Route path="/labels" element={<Labels />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>
    </div>
  );
}
