import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Building2, Inbox, Users, BarChart3, LogOut, ShieldAlert } from 'lucide-react';
import { cn } from '../lib/utils';

const navItems = [
  { to: '/orgs', icon: Building2, label: 'Organizations' },
  { to: '/proposals', icon: Inbox, label: 'Proposals' },
  { to: '/team', icon: Users, label: 'Team' },
  { to: '/analytics', icon: BarChart3, label: 'Analytics' },
];

export function Layout() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-neutral-50 text-neutral-900">
      <aside className="w-64 bg-white border-r border-neutral-200 flex flex-col">
        <div className="h-16 flex items-center px-6 border-b border-neutral-200 gap-3">
          <div className="bg-neutral-900 p-1.5 rounded-lg">
            <ShieldAlert className="w-5 h-5 text-white" />
          </div>
          <span className="font-semibold text-lg">Masar Admin</span>
        </div>
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                isActive 
                  ? "bg-neutral-100 text-neutral-900" 
                  : "text-neutral-500 hover:text-neutral-900 hover:bg-neutral-50"
              )}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-neutral-200">
          <div className="flex items-center justify-between">
            <div className="text-sm truncate">
              <p className="font-medium text-neutral-900 truncate">{user?.email}</p>
              <p className="text-neutral-500 text-xs">Admin</p>
            </div>
            <button 
              onClick={handleLogout}
              className="p-2 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
