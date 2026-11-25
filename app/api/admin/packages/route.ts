import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase';
import { requireAdminSession } from '@/lib/admin-auth';

interface PackageDto {
  id: string;
  name: string;
  code: string;
  description: string;
  monthlyPrice: number;
  yearlyPrice: number;
  monthly_price?: number;
  yearly_price?: number;
  interval: string;
  terminals: string;
  status: string;
  popular: boolean;
  is_popular?: boolean;
  features: string[];
  subscribersCount: number;
  subscribers_count?: number;
}

const DEFAULT_PACKAGES: PackageDto[] = [
  {
    id: 'pkg-amb-erp',
    name: 'AMB MedERP',
    code: 'AMB_MEDERP',
    description: 'All-in-one pharmacy billing, inventory, FEFO expiry radar, GST filing & cloud sync.',
    monthlyPrice: 999,
    yearlyPrice: 3999,
    monthly_price: 999,
    yearly_price: 3999,
    interval: 'Yearly',
    terminals: 'Unlimited Terminals',
    status: 'Active',
    popular: true,
    is_popular: true,
    features: [
      'High-Speed POS Billing & A4/80mm Print',
      'FEFO Expiry Radar & AI Purchase OCR',
      'Dynamic UPI QR Payment Codes',
      'Automated GSTR-1 & GST Ledgers',
      'Realtime Supabase Cloud Sync',
    ],
    subscribersCount: 1,
    subscribers_count: 1,
  },
];

function normalizePackage(p: any): PackageDto {
  const mPrice = Number(p.monthlyPrice ?? p.monthly_price ?? 999);
  const yPrice = Number(p.yearlyPrice ?? p.yearly_price ?? 3999);
  return {
    id: p.id || `pkg-${Date.now()}`,
    name: p.name || 'AMB MedERP',
    code: p.code || 'AMB_MEDERP',
    description: p.description || '',
    monthlyPrice: isNaN(mPrice) ? 999 : mPrice,
    yearlyPrice: isNaN(yPrice) ? 3999 : yPrice,
    monthly_price: isNaN(mPrice) ? 999 : mPrice,
    yearly_price: isNaN(yPrice) ? 3999 : yPrice,
    interval: p.interval || 'Yearly',
    terminals: p.terminals || '1 Counter Terminal',
    status: p.status || 'Active',
    popular: Boolean(p.popular ?? p.is_popular),
    is_popular: Boolean(p.popular ?? p.is_popular),
    features: Array.isArray(p.features) ? p.features : [],
    subscribersCount: Number(p.subscribersCount ?? p.subscribers_count ?? 0),
    subscribers_count: Number(p.subscribersCount ?? p.subscribers_count ?? 0),
  };
}

export async function GET(req: NextRequest) {
  const session = await requireAdminSession(req);
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  const client = getAdminClient();
  if (!client) {
    return NextResponse.json({
      success: true,
      packages: DEFAULT_PACKAGES,
      fromSupabase: false,
    });
  }

  try {
    const { data, error } = await client
      .from('packages')
      .select('*')
      .order('monthly_price', { ascending: true });

    if (error) {
      return NextResponse.json({
        success: true,
        packages: DEFAULT_PACKAGES,
        fromSupabase: false,
        needsSchema: Boolean(error.message?.includes('not find the table')),
        message: error.message,
      });
    }

    // Count active subscribers per package from Supabase Auth
    const subscriberCounts: Record<string, number> = {};
    try {
      const { data: userRes } = await client.auth.admin.listUsers();
      for (const u of userRes?.users || []) {
        const meta = u.user_metadata || {};
        const isActive = (meta.status || (meta.plan ? 'Active' : 'No plan')) === 'Active';
        if (isActive && meta.plan) {
          const key = String(meta.plan).trim().toLowerCase();
          subscriberCounts[key] = (subscriberCounts[key] || 0) + 1;
        }
      }
    } catch {
      // Non-fatal: keep DB counts if auth listing fails
    }

    const mapped = (data || []).map((p) => {
      const pkg = normalizePackage(p);
      const countByName = subscriberCounts[pkg.name.trim().toLowerCase()] || 0;
      const countByCode = subscriberCounts[pkg.code.trim().toLowerCase()] || 0;
      const liveCount = countByName || countByCode;
      return {
        ...pkg,
        subscribersCount: liveCount,
        subscribers_count: liveCount,
      };
    });

    return NextResponse.json({
      success: true,
      packages: mapped,
      fromSupabase: true,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({
      success: true,
      packages: DEFAULT_PACKAGES,
      fromSupabase: false,
      error: msg,
    });
  }
}

export async function POST(req: NextRequest) {
  const session = await requireAdminSession(req);
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  const client = getAdminClient();
  if (!client) {
    return NextResponse.json({ success: false, error: 'Database service unavailable' }, { status: 500 });
  }

  try {
    const body = await req.json();
    const { id, name, code, description, monthlyPrice, yearlyPrice, interval, terminals, status, popular, features, subscribersCount } = body;

    const cleanName = typeof name === 'string' ? name.trim() : '';
    if (!cleanName) {
      return NextResponse.json({ success: false, error: 'Package name is required.' }, { status: 400 });
    }

    const normalizedCode = (typeof code === 'string' && code.trim()
      ? code.trim()
      : cleanName.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '')
    ) || `PKG_${Date.now()}`;

    const mPrice = Number(monthlyPrice ?? 999);
    const yPrice = Number(yearlyPrice ?? 9999);

    const row = {
      id: id || `pkg-${Date.now()}`,
      name: cleanName,
      code: normalizedCode,
      description: typeof description === 'string' ? description.trim() : '',
      monthly_price: isNaN(mPrice) ? 999 : mPrice,
      yearly_price: isNaN(yPrice) ? 9999 : yPrice,
      interval: interval || 'Yearly',
      terminals: terminals || '1 Counter Terminal',
      status: status || 'Active',
      is_popular: Boolean(popular),
      features: Array.isArray(features) ? features : [],
      subscribers_count: Number(subscribersCount || 0),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await client.from('packages').upsert(row).select().single();

    if (error) {
      const friendlyError = error.message.includes('packages_code_key')
        ? `A package with code "${normalizedCode}" already exists. Choose a different package name.`
        : error.message;
      return NextResponse.json({
        success: false,
        error: friendlyError,
        needsSchema: Boolean(error.message.includes('not find the table')),
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      package: normalizePackage(data),
      message: 'Package saved to Supabase successfully.',
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await requireAdminSession(req);
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  const client = getAdminClient();
  if (!client) {
    return NextResponse.json({ success: false, error: 'Database service unavailable' }, { status: 500 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ success: false, error: 'Package ID required' }, { status: 400 });
    }

    const { error } = await client.from('packages').delete().eq('id', id);
    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: 'Package deleted from Supabase.' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
