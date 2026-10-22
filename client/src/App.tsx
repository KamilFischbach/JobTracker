import {
  BrowserRouter,
  HashRouter,
  Navigate,
  Route,
  Routes,
} from 'react-router-dom';
import { ApplicationDetailsPage } from './components/ApplicationDetailsPage';
import { ApplicationsPage } from './components/ApplicationsPage';
import { Footer } from './components/Footer';
const AppRouter =
  import.meta.env.VITE_DEMO_MODE === 'true' ? HashRouter : BrowserRouter;

function App() {
  return (
    <AppRouter>
      <Routes>
        <Route path='/' element={<Navigate to='/applications' replace />} />
        <Route path='/applications' element={<ApplicationsPage />} />
        <Route
          path='/applications/:applicationId'
          element={<ApplicationDetailsPage />}
        />
        <Route path='*' element={<Navigate to='/' replace />} />
      </Routes>
      <Footer />
    </AppRouter>
  );
}

export default App;
