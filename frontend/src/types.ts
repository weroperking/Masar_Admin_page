export interface AdminUser {
  id: string;
  email: string;
  created_at: string;
}

export interface Organization {
  org_id: string;
  name?: string;
  plan: string;
  status: string;
  trial_ends_at?: string | null;
  current_period_end?: string | null;
  country?: string | null;
  city?: string | null;
  created_at: string;
  updated_at?: string;
  student_count: number;
  branch_count: number;
  latest_proposal?: any | null;
}

export interface Proposal {
  id: string;
  orgId: string;
  name?: string;
  orgName?: string;
  org_name?: string;
  requestedPlan: string;
  currentPlan: string;
  status: string;
  createdAt: string;
  resolvedAt?: string | null;
  resolvedBy?: string | null;
  notes?: string | null;
}
