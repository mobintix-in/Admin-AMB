import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Resilient fetch for Windows/Node undici idle socket drops to Supabase
async function retryingFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(input, init);
      if (res.status >= 502 && res.status <= 504 && attempt < 2) {
        await new Promise((r) => setTimeout(r, 200 * (attempt + 1)));
        continue;
      }
      return res;
    } catch (err) {
      lastError = err;
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 200 * (attempt + 1)));
      }
    }
  }
  throw lastError;
}

// Admin client with service role privileges
export function getAdminClient() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return null;
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      fetch: retryingFetch,
    },
  });
}

// Public client
export function getPublicClient() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return null;
  }
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      fetch: retryingFetch,
    },
  });
}

export interface AdminTenant {
  id: string;
  name: string;
  trade_name?: string;
  branch_name?: string;
  gstin?: string;
  drug_license_no: string;
  phone: string;
  email?: string;
  address: string;
  state: string;
  state_code?: string;
  currency?: string;
  created_at: string;
}

export interface AdminUser {
  id: string;
  email?: string;
  phone: string;
  name: string;
  role: string;
  store_name: string;
  company?: string;
  drug_license_no?: string;
  gstin?: string;
  login_providers?: string[];
  status?: 'Active' | 'No plan' | 'Pending';
  plan?: string;
  plan_duration?: string;
  utr_ref?: string;
  utr_note?: string;
  expires_at?: string;
  created_at: string;
  last_sign_in_at?: string;
}

export interface PlatformStats {
  totalTenants: number;
  totalUsers: number;
  totalInvoices: number;
  totalRevenue: number;
  totalMedicines: number;
  totalBatches: number;
}
