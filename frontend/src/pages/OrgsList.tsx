import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { Link } from 'react-router-dom';
import { Search, SlidersHorizontal, ChevronDown } from 'lucide-react';
import type { Organization } from '../types';
import { useState } from 'react';
import { cn } from '../lib/utils';

export function OrgsList() {
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState<string>('all');
  const [sortConfig, setSortConfig] = useState<{ key: keyof Organization, direction: 'asc' | 'desc' } | null>(null);
  const queryClient = useQueryClient();

  const { data: response, isLoading } = useQuery<{ orgs: Organization[] }>({
    queryKey: ['orgs'],
    queryFn: async () => {
      const res = await fetch('/api/orgs');
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    }
  });

  const changePlanMutation = useMutation({
    mutationFn: async ({ id, plan }: { id: string, plan: string }) => {
      const res = await fetch(`/api/orgs/${id}/plan-override`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan })
      });
      if (!res.ok) throw new Error('Failed to change plan');
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['orgs'] })
  });

  if (isLoading) return <div className="p-8">Loading organizations...</div>;

  const orgs = response?.orgs || [];

  let filteredOrgs = orgs.filter(org => {
    if (planFilter !== 'all' && org.plan !== planFilter) return false;
    if (search) {
      const query = search.toLowerCase();
      const matchName = org.name?.toLowerCase().includes(query);
      const matchId = org.org_id.toLowerCase().includes(query);
      if (!matchName && !matchId) return false;
    }
    return true;
  });

  if (sortConfig) {
    filteredOrgs.sort((a, b) => {
      const aVal = a[sortConfig.key] ?? '';
      const bVal = b[sortConfig.key] ?? '';
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }

  const handleSort = (key: keyof Organization) => {
    setSortConfig(current => {
      if (current?.key === key) {
        if (current.direction === 'asc') return { key, direction: 'desc' };
        return null; // toggle off
      }
      return { key, direction: 'asc' };
    });
  };

  const SortableHeader = ({ label, sortKey }: { label: string, sortKey: keyof Organization }) => (
    <th 
      className="px-6 py-4 font-medium text-neutral-500 cursor-pointer hover:bg-neutral-100 transition-colors select-none"
      onClick={() => handleSort(sortKey)}
    >
      <div className="flex items-center gap-1.5">
        {label}
        <div className="flex flex-col text-[10px] leading-[0.3]">
          <span className={cn(sortConfig?.key === sortKey && sortConfig.direction === 'asc' ? "text-neutral-900" : "text-neutral-300")}>▲</span>
          <span className={cn(sortConfig?.key === sortKey && sortConfig.direction === 'desc' ? "text-neutral-900" : "text-neutral-300")}>▼</span>
        </div>
      </div>
    </th>
  );

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-neutral-900">Organizations</h1>
        <div className="flex gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input 
              type="text" 
              placeholder="Search orgs..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900"
            />
          </div>
          <select 
            value={planFilter}
            onChange={e => setPlanFilter(e.target.value)}
            className="px-4 py-2 text-sm border border-neutral-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900"
          >
            <option value="all">All Plans</option>
            <option value="free">Free</option>
            <option value="pro">Pro</option>
            <option value="enterprise">Enterprise</option>
          </select>
        </div>
      </div>

      <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-neutral-50 border-b border-neutral-200">
            <tr>
              <SortableHeader label="Name" sortKey="name" />
              <SortableHeader label="Status" sortKey="status" />
              <SortableHeader label="Plan" sortKey="plan" />
              <SortableHeader label="Users" sortKey="student_count" />
              <SortableHeader label="Branches" sortKey="branch_count" />
              <SortableHeader label="Created" sortKey="created_at" />
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {filteredOrgs?.map(org => {
              const location = [org.city, org.country].filter(Boolean).join(', ');
              
              return (
              <tr key={org.org_id} className="hover:bg-neutral-50 transition-colors">
                <td className="px-6 py-4">
                  <Link to={`/orgs/${org.org_id}`} className="font-medium text-neutral-900 hover:underline block">
                    {org.name || org.org_id}
                  </Link>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-neutral-500">
                    {org.name && <span className="font-mono text-[11px] text-neutral-400">{org.org_id}</span>}
                    {org.name && location && <span>•</span>}
                    {location && <span>{location}</span>}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-col gap-1">
                    <span className={cn(
                      "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium w-fit",
                      org.status === 'active' ? "bg-green-100 text-green-700" :
                      org.status === 'trialing' ? "bg-amber-100 text-amber-700" :
                      "bg-neutral-100 text-neutral-700"
                    )}>
                      {org.status}
                    </span>
                    {org.status === 'trialing' && org.trial_ends_at && (
                      <span className="text-xs text-neutral-500">
                        Ends in {formatDistanceToNow(new Date(org.trial_ends_at))}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <select
                    value={org.plan}
                    onChange={(e) => changePlanMutation.mutate({ id: org.org_id, plan: e.target.value })}
                    className="text-sm border-0 bg-transparent text-neutral-900 focus:ring-0 cursor-pointer font-medium p-0"
                    disabled={changePlanMutation.isPending}
                  >
                    <option value="free">Free</option>
                    <option value="trial">Trial</option>
                    <option value="growth">Growth</option>
                    <option value="scale">Scale</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                </td>
                <td className="px-6 py-4 text-neutral-600">{org.student_count} students</td>
                <td className="px-6 py-4 text-neutral-600">{org.branch_count}</td>
                <td className="px-6 py-4 text-neutral-500">{formatDistanceToNow(new Date(org.created_at))} ago</td>
              </tr>
            )})}
            {filteredOrgs?.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-neutral-500">
                  No organizations found matching your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
