import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow, differenceInHours } from 'date-fns';
import { Clock, CheckCircle2, XCircle, PhoneForwarded, Inbox } from 'lucide-react';
import { useMemo } from 'react';
import type { Proposal, Organization } from '../types';
import { cn } from '../lib/utils';

export function Proposals() {
  const queryClient = useQueryClient();

  const { data: response, isLoading } = useQuery<{ proposals: Proposal[] }>({
    queryKey: ['proposals'],
    queryFn: async () => {
      const res = await fetch('/api/proposals');
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    }
  });

  const { data: orgsResponse } = useQuery<{ orgs: Organization[] }>({
    queryKey: ['orgs'],
    queryFn: async () => {
      const res = await fetch('/api/orgs');
      if (!res.ok) return { orgs: [] };
      return res.json();
    }
  });

  const orgMap = useMemo(() => {
    const map = new Map<string, string>();
    orgsResponse?.orgs?.forEach(org => {
      if (org.name) map.set(org.org_id, org.name);
    });
    return map;
  }, [orgsResponse]);

  const resolveMutation = useMutation({
    mutationFn: async ({ id, action }: { id: string, action: string }) => {
      const res = await fetch(`/api/proposals/${id}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });
      if (!res.ok) throw new Error('Failed to resolve proposal');
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['proposals'] })
  });

  if (isLoading) return <div className="p-8">Loading proposals...</div>;

  const proposals = response?.proposals || [];
  const pendingProposals = proposals.filter(p => p.status === 'pending') || [];
  
  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-neutral-900">Pending Proposals</h1>
        <div className="text-sm text-neutral-500 font-medium">
          {pendingProposals.length} requests requiring action
        </div>
      </div>

      <div className="grid gap-4">
        {pendingProposals.map(proposal => {
          const isStale = differenceInHours(new Date(), new Date(proposal.createdAt)) > 24;
          const orgDisplayName = proposal.name || proposal.orgName || proposal.org_name || orgMap.get(proposal.orgId) || proposal.orgId;
          const hasSeparateName = orgDisplayName !== proposal.orgId;
          
          return (
            <div 
              key={proposal.id} 
              className={cn(
                "bg-white border rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm transition-colors",
                isStale ? "border-amber-300 bg-amber-50/30" : "border-neutral-200"
              )}
            >
              <div>
                <div className="flex items-center gap-3 mb-1 flex-wrap">
                  <h3 className="font-semibold text-neutral-900">{orgDisplayName}</h3>
                  {hasSeparateName && (
                    <span className="font-mono text-xs text-neutral-400">({proposal.orgId})</span>
                  )}
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-neutral-100 text-neutral-700 capitalize">
                    {proposal.requestedPlan} Plan
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm text-neutral-500">
                  <Clock className={cn("w-4 h-4", isStale && "text-amber-500")} />
                  <span className={cn(isStale && "text-amber-700 font-medium")}>
                    Requested {formatDistanceToNow(new Date(proposal.createdAt))} ago
                  </span>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={() => resolveMutation.mutate({ id: proposal.id, action: 'contacted' })}
                  disabled={resolveMutation.isPending}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors"
                >
                  <PhoneForwarded className="w-4 h-4" /> Mark Contacted
                </button>
                <button
                  onClick={() => resolveMutation.mutate({ id: proposal.id, action: 'rejected' })}
                  disabled={resolveMutation.isPending}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg text-red-700 bg-red-50 hover:bg-red-100 transition-colors"
                >
                  <XCircle className="w-4 h-4" /> Reject
                </button>
                <button
                  onClick={() => resolveMutation.mutate({ id: proposal.id, action: 'approved' })}
                  disabled={resolveMutation.isPending}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg text-green-700 bg-green-50 hover:bg-green-100 transition-colors"
                >
                  <CheckCircle2 className="w-4 h-4" /> Approve & Upgrade
                </button>
              </div>
            </div>
          );
        })}

        {pendingProposals.length === 0 && (
          <div className="text-center py-16 bg-white border border-neutral-200 rounded-xl">
            <Inbox className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
            <p className="text-neutral-500">No pending proposals at this time.</p>
          </div>
        )}
      </div>
    </div>
  );
}
