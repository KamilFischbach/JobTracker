import {
  BrowserRouter,
  HashRouter,
  Navigate,
  Route,
  Routes,
} from 'react-router-dom';
import { ApplicationDetailsPage } from './components/ApplicationDetailsPage';
import { ApplicationsPage } from './components/ApplicationsPage';
import { AccountPage } from './components/auth/AccountPage';
import { ConfirmSignupPage } from './components/auth/ConfirmSignupPage';
import { ForgotPasswordPage } from './components/auth/ForgotPasswordPage';
import { LoginPage } from './components/auth/LoginPage';
import { ResetPasswordPage } from './components/auth/ResetPasswordPage';
import { GuestOnly, RequireAuth } from './components/auth/RouteGuards';
import { SignupPage } from './components/auth/SignupPage';
import { Footer } from './components/Footer';
import { isDemoMode } from './services/applications';

const AppRouter = isDemoMode ? HashRouter : BrowserRouter;

/**
 * All pages. The GitHub Pages demo has no accounts, so it only has the board.
 */
export function AppRoutes() {
  return (
    <Routes>
      <Route path='/' element={<Navigate to='/applications' replace />} />
      {!isDemoMode && (
        <>
          <Route element={<GuestOnly />}>
            <Route path='/login' element={<LoginPage />} />
            <Route path='/signup' element={<SignupPage />} />
            <Route path='/forgot-password' element={<ForgotPasswordPage />} />
          </Route>
          <Route path='/confirm-signup' element={<ConfirmSignupPage />} />
          <Route path='/reset-password' element={<ResetPasswordPage />} />
        </>
      )}
      <Route element={<RequireAuth />}>
        <Route path='/applications' element={<ApplicationsPage />} />
        <Route
          path='/applications/:applicationId'
          element={<ApplicationDetailsPage />}
        />
        {!isDemoMode && <Route path='/account' element={<AccountPage />} />}
      </Route>
      <Route path='*' element={<Navigate to='/' replace />} />
    </Routes>
  );
}

function App() {
  return (
    <AppRouter>
      <AppRoutes />
      <Footer />
    </AppRouter>
  );
}

export default App;
