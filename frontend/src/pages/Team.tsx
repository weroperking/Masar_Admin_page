import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { useState, type FormEvent } from 'react';
import { UserPlus, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import type { AdminUser } from '../types';

export function Team() {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');

  const { data: team, isLoading } = useQuery<AdminUser[]>({
    queryKey: ['team'],
    queryFn: async () => {
      const res = await fetch('/api/admin-users');
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    }
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/admin-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newEmail, password: newPassword })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add admin');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team'] });
      setNewEmail('');
      setNewPassword('');
      setError('');
    },
    onError: (err: any) => setError(err.message)
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin-users/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to remove admin');
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['team'] }),
    onError: (err: any) => alert(err.message)
  });

  const handleAdd = (e: FormEvent) => {
    e.preventDefault();
    if (!newEmail || !newPassword) return;
    addMutation.mutate();
  };

  if (isLoading) return <div className="p-8">Loading team...</div>;

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-neutral-900">Admin Team</h1>
      </div>

      <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden shadow-sm">
        <div className="px-6 py-5 border-b border-neutral-200 bg-neutral-50 flex items-center justify-between">
          <h2 className="text-lg font-medium text-neutral-900">Current Members</h2>
        </div>
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-white border-b border-neutral-100">
            <tr>
              <th className="px-6 py-3 font-medium text-neutral-500">Email</th>
              <th className="px-6 py-3 font-medium text-neutral-500">Added On</th>
              <th className="px-6 py-3 font-medium text-neutral-500 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {team?.map(member => (
              <tr key={member.id} className="hover:bg-neutral-50 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-neutral-900">{member.email}</span>
                    {member.id === currentUser?.id && (
                      <span className="bg-neutral-900 text-white text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded">You</span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 text-neutral-500">{format(new Date(member.created_at), 'MMM d, yyyy')}</td>
                <td className="px-6 py-4 text-right">
                  <button
                    onClick={() => removeMutation.mutate(member.id)}
                    disabled={member.id === currentUser?.id || removeMutation.isPending}
                    className="p-1.5 text-neutral-400 hover:text-red-600 rounded disabled:opacity-30 transition-colors"
                    title={member.id === currentUser?.id ? "Cannot remove yourself" : "Remove admin"}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-white border border-neutral-200 rounded-xl p-6 shadow-sm">
        <h2 className="text-lg font-medium text-neutral-900 mb-4 flex items-center gap-2">
          <UserPlus className="w-5 h-5 text-neutral-500" />
          Add New Admin
        </h2>
        <form onSubmit={handleAdd} className="max-w-md space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Email Address</label>
            <input
              type="email"
              value={newEmail}
              onChange={e => setNewEmail(e.target.value)}
              className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-neutral-900 outline-none"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Temporary Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-neutral-900 outline-none"
              required
            />
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={addMutation.isPending}
            className="w-full bg-neutral-900 text-white font-medium py-2 rounded-lg hover:bg-neutral-800 transition-colors disabled:opacity-50"
          >
            {addMutation.isPending ? 'Adding...' : 'Add Admin'}
          </button>
        </form>
      </div>
    </div>
  );
}
