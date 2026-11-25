import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient, AdminUser } from '@/lib/supabase';
import { requireAdminSession } from '@/lib/admin-auth';

export async function GET(req: NextRequest) {
  const session = await requireAdminSession(req);
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  const client = getAdminClient();
  if (!client) {
    return NextResponse.json({
      success: false,
      error: 'Supabase service role client is not configured.',
    }, { status: 500 });
  }

  try {
    const [tenantsRes, invoicesRes, itemsRes, batchesRes, usersRes] = await Promise.all([
      client.from('tenants').select('*').order('created_at', { ascending: false }),
      client.from('sales_invoices').select('id, tenant_id, total_amount, invoice_number, invoice_date, invoice_time, party_name, payment_status, payment_mode, profit_margin_amount, created_at').order('created_at', { ascending: false }),
      client.from('items').select('id, tenant_id, item_code, name, brand_name, salt_composition, category, manufacturer, hsn_code, unit, tax_rate, created_at').order('created_at', { ascending: false }),
      client.from('item_batches').select('id, tenant_id, item_id, batch_number, expiry_date, quantity_available, mrp, sale_rate, purchase_rate'),
      client.auth.admin.listUsers(),
    ]);

    const tenants = tenantsRes.data || [];
    const invoices = invoicesRes.data || [];
    const items = itemsRes.data || [];
    const batches = batchesRes.data || [];
    const rawUsers = usersRes.data?.users || [];

    // Map live Supabase auth users
    const liveUsers: AdminUser[] = rawUsers.map((u) => {
      const meta = u.user_metadata || {};
      const providers: string[] = [];
      if (meta.google) providers.push('google');
      if (u.email) providers.push('email');
      if (providers.length === 0) providers.push('email');

      return {
        id: u.id,
        email: u.email || '',
        phone: meta.phone || '—',
        name: meta.name || u.email?.split('@')[0] || 'User',
        role: meta.role || 'ADMIN',
        store_name: meta.store_name || meta.company || '—',
        company: meta.company || meta.store_name || '—',
        drug_license_no: meta.drug_license_no || '',
        gstin: meta.gstin || '',
        login_providers: providers,
        status: (meta.status as any) || (meta.plan ? 'Active' : 'No plan'),
        plan: meta.plan || undefined,
        plan_duration: meta.plan_duration || undefined,
        utr_ref: meta.utr_ref || undefined,
        utr_note: meta.utr_note || undefined,
        expires_at: meta.expires_at || undefined,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
      };
    });

    // Sort strictly by registration date (newest first)
    liveUsers.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const totalRevenue = invoices.reduce((sum, inv) => sum + (Number(inv.total_amount) || 0), 0);

    return NextResponse.json({
      success: true,
      stats: {
        totalTenants: tenants.length,
        totalUsers: liveUsers.length,
        totalInvoices: invoices.length,
        totalRevenue,
        totalMedicines: items.length,
        totalBatches: batches.length,
      },
      tenants,
      users: liveUsers,
      invoices,
      recentInvoices: invoices.slice(0, 10),
      items,
      batches,
    }, { status: 200 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
