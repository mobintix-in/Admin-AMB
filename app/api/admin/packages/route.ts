import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase';

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
    id: 'pkg-starter',
    name: 'Starter Retail',
    code: 'STARTER',
    description: 'Essential billing and inventory for single-counter retail medical chemists.',
    monthlyPrice: 999,
    yearlyPrice: 9999,
    monthly_price: 999,
    yearly_price: 9999,
    interval: 'Monthly',
    terminals: '1 Counter Terminal',
    status: 'Active',
    popular: false,
    is_popular: false,
    features: [
      'High-Speed POS Billing',
      'FEFO Expiry Radar Engine',
      'Dynamic UPI QR Payment Codes',
      'Standard Email & In-App Support',
    ],
    subscribersCount: 1,
    subscribers_count: 1,
  },
  {
    id: 'pkg-pro',
    name: 'Professional Chemist',
    code: 'PROFESSIONAL',
    description: 'For busy retail chemists with multiple billing counters, AI purchase OCR & GST filing.',
    monthlyPrice: 1999,
    yearlyPrice: 19999,
    monthly_price: 1999,
    yearly_price: 19999,
    interval: 'Yearly',
    terminals: '3 Counter Terminals',
    status: 'Active',
    popular: true,
    is_popular: true,
    features: [
      'Everything in Starter',
      'AI Purchase Bill Ingestion (OCR)',
      'Active Salt Molecule Substitute Finder',
      'Automated GSTR-1 Tax Summaries',
      'Customer Wholesale Ledgers',
    ],
    subscribersCount: 2,
    subscribers_count: 2,
  },
  {
    id: 'pkg-ent',
    name: 'Enterprise Cloud',
    code: 'ENTERPRISE',
    description: 'For chain pharmacies, hospital dispensaries, and wholesale pharmaceutical stockists.',
    monthlyPrice: 3999,
    yearlyPrice: 39999,
    monthly_price: 3999,
    yearly_price: 39999,
    interval: 'Yearly',
    terminals: 'Unlimited Terminals',
    status: 'Active',
    popular: false,
    is_popular: false,
    features: [
      'Everything in Professional',
      'Centralized Multi-Branch Stock',
      'Realtime Supabase PostgreSQL CDC Sync',
      'Dedicated SLA & 24/7 Account Manager',
      'Custom E-Invoicing & E-Way Bills',
    ],
    subscribersCount: 1,
    subscribers_count: 1,
  },
];

function normalizePackage(p: any): PackageDto {
  const mPrice = Number(p.monthlyPrice ?? p.monthly_price ?? 999);
  const yPrice = Number(p.yearlyPrice ?? p.yearly_price ?? 9999);
  return {
    id: p.id || `pkg-${Date.now()}`,
    name: p.name || 'Custom Package',
    code: p.code || 'CUSTOM',
    description: p.description || '',
    monthlyPrice: isNaN(mPrice) ? 999 : mPrice,
    yearlyPrice: isNaN(yPrice) ? 9999 : yPrice,
    monthly_price: isNaN(mPrice) ? 999 : mPrice,
    yearly_price: isNaN(yPrice) ? 9999 : yPrice,
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

export async function GET() {
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

    if (error || !data || data.length === 0) {
      return NextResponse.json({
        success: true,
        packages: DEFAULT_PACKAGES,
        fromSupabase: false,
        needsSchema: Boolean(error?.message?.includes('not find the table')),
        message: error ? error.message : 'No packages found, using defaults',
      });
    }

    const mapped = data.map((p) => normalizePackage(p));

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
  const client = getAdminClient();
  if (!client) {
    return NextResponse.json({ success: false, error: 'Database service unavailable' }, { status: 500 });
  }

  try {
    const body = await req.json();
    const { id, name, code, description, monthlyPrice, yearlyPrice, interval, terminals, status, popular, features, subscribersCount } = body;

    const mPrice = Number(monthlyPrice ?? 999);
    const yPrice = Number(yearlyPrice ?? 9999);

    const row = {
      id: id || `pkg-${Date.now()}`,
      name,
      code: code || name.toUpperCase().replace(/\s+/g, '_'),
      description,
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
      return NextResponse.json({
        success: false,
        error: error.message,
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
