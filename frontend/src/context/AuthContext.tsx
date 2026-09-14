import React, { createContext, useContext, useEffect, useState } from 'react';
import type { AdminUser } from '../types';

interface AuthContextType {
  user: AdminUser | null;
  isLoading: boolean;
  setUser: (user: AdminUser | null) => void;
}

const AuthContext = createContext<AuthContextType>({ user: null, isLoading: true, setUser: () => {} });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
        if (data.user) setUser(data.user);
      })
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
