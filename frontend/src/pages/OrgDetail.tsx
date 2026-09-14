import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { format } from 'date-fns';
import { ArrowLeft, Building2, MapPin, Users, GitBranch } from 'lucide-react';
import type { Organization } from '../types';

export function OrgDetail() {
  const { id } = useParams();
  const queryClient = useQueryClient();

  const { data: response, isLoading } = useQuery<{ org: any }>({
    queryKey: ['org', id],
    queryFn: async () => {
      const res = await fetch(`/api/orgs/${id}`);
      if (!res.ok) throw new Error('Failed to fetch org');
      return res.json();
    }
  });

  const changePlanMutation = useMutation({
    mutationFn: async (plan: string) => {
      const res = await fetch(`/api/orgs/${id}/plan-override`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan })
      });
      if (!res.ok) throw new Error('Failed to change plan');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org', id] });
      queryClient.invalidateQueries({ queryKey: ['orgs'] });
    }
  });

  if (isLoading) return <div className="p-8">Loading organization details...</div>;
  if (!response?.org) return <div className="p-8">Organization not found.</div>;
  
  const org = response.org;
  const location = [org.city, org.country].filter(Boolean).join(', ');

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      <div>
        <Link to="/orgs" className="inline-flex items-center text-sm font-medium text-neutral-500 hover:text-neutral-900 mb-4 transition-colors">
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to organizations
        </Link>
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-semibold text-neutral-900">{org.name || org.orgId || org.org_id}</h1>
          {(org.orgId || org.org_id) && org.name && (
            <p className="font-mono text-xs text-neutral-400">{org.orgId || org.org_id}</p>
          )}
        </div>
        <div className="flex items-center gap-4 mt-2 text-sm text-neutral-500">
          <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4" /> {location || 'No location'}</span>
          <span className="flex items-center gap-1.5"><Building2 className="w-4 h-4" /> Created {format(new Date(org.createdAt || org.created_at), 'PPP')}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl border border-neutral-200 shadow-sm">
          <div className="flex items-center gap-3 text-neutral-500 mb-2">
            <Users className="w-5 h-5" />
            <span className="font-medium">Students</span>
          </div>
          <p className="text-3xl font-semibold text-neutral-900">{org.student_count}</p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-neutral-200 shadow-sm">
          <div className="flex items-center gap-3 text-neutral-500 mb-2">
            <GitBranch className="w-5 h-5" />
            <span className="font-medium">Branches</span>
          </div>
          <p className="text-3xl font-semibold text-neutral-900">{org.branch_count}</p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-neutral-200 shadow-sm">
          <div className="flex items-center gap-3 text-neutral-500 mb-2">
            <Building2 className="w-5 h-5" />
            <span className="font-medium">Current Plan</span>
          </div>
          <select
            value={org.plan}
            onChange={(e) => changePlanMutation.mutate(e.target.value)}
            className="text-3xl font-semibold text-neutral-900 capitalize border-0 bg-transparent focus:ring-0 cursor-pointer p-0 w-full"
            disabled={changePlanMutation.isPending}
          >
            <option value="trial">Trial</option>
            <option value="basic">Basic</option>
            <option value="growth">Growth</option>
          </select>
        </div>
      </div>

      <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden shadow-sm">
        <div className="px-6 py-5 border-b border-neutral-200 bg-neutral-50">
          <h2 className="text-lg font-medium text-neutral-900">Organization Users</h2>
        </div>
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-white border-b border-neutral-100">
            <tr>
              <th className="px-6 py-3 font-medium text-neutral-500">Email</th>
              <th className="px-6 py-3 font-medium text-neutral-500">ID</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {org.users?.map(user => (
              <tr key={user.id} className="hover:bg-neutral-50 transition-colors">
                <td className="px-6 py-4 text-neutral-900">{user.email}</td>
                <td className="px-6 py-4 text-neutral-500">{user.id}</td>
              </tr>
            ))}
            {(!org.users || org.users.length === 0) && (
              <tr>
                <td colSpan={2} className="px-6 py-8 text-center text-neutral-500">
                  No users found in this organization.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
