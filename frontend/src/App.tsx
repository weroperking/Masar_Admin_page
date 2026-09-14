import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Login } from './pages/Login';
import { Layout } from './components/Layout';
import { OrgsList } from './pages/OrgsList';
import { OrgDetail } from './pages/OrgDetail';
import { Proposals } from './pages/Proposals';
import { Team } from './pages/Team';
import { Analytics } from './pages/Analytics';

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <div className="h-screen w-full flex items-center justify-center">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route index element={<Navigate to="/orgs" replace />} />
              <Route path="orgs" element={<OrgsList />} />
              <Route path="orgs/:id" element={<OrgDetail />} />
              <Route path="proposals" element={<Proposals />} />
              <Route path="team" element={<Team />} />
              <Route path="analytics" element={<Analytics />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
