import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient, AdminUser } from '@/lib/supabase';
import { requireAdminSession } from '@/lib/admin-auth';

function isExpiryPast(expiresAt?: string | null): boolean {
  const clean = (expiresAt || '').trim();
  if (!clean || clean === '—' || clean.toLowerCase() === 'lifetime') return false;
  const d = new Date(clean);
  if (isNaN(d.getTime())) return false;
  d.setHours(23, 59, 59, 999);
  return d.getTime() < Date.now();
}

// GET: List all users from Supabase Auth
export async function GET(req: NextRequest) {
  const session = await requireAdminSession(req);
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  const client = getAdminClient();
  if (!client) {
    return NextResponse.json({ success: false, error: 'Supabase admin client unavailable' }, { status: 500 });
  }

  try {
    const { data: userRes, error } = await client.auth.admin.listUsers();
    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const rawUsers = userRes?.users || [];
    const users: AdminUser[] = rawUsers.map((u) => {
      const meta = u.user_metadata || {};
      const providers: string[] = [];
      if (meta.google) providers.push('google');
      if (u.email) providers.push('email');
      if (providers.length === 0) providers.push('email');

      const rawStatus = (meta.status as AdminUser['status']) || (meta.plan ? 'Active' : 'No plan');
      const computedStatus: AdminUser['status'] =
        rawStatus === 'Active' && meta.plan && isExpiryPast(meta.expires_at)
          ? 'Expired'
          : rawStatus;

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
        status: computedStatus,
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
    users.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return NextResponse.json({ success: true, users }, { status: 200 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

// POST: Create a brand new user in Supabase Auth
export async function POST(req: NextRequest) {
  const session = await requireAdminSession(req);
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  const client = getAdminClient();
  if (!client) {
    return NextResponse.json({ success: false, error: 'Supabase admin client unavailable' }, { status: 500 });
  }

  try {
    const body = await req.json();
    const { name, email, phone, company, password, plan, plan_duration, status, utr_ref, utr_note, expires_at, role, google } = body;

    if (!email || !name) {
      return NextResponse.json({ success: false, error: 'Name and email are required.' }, { status: 400 });
    }

    // Password validation for Supabase (min 6 chars)
    let rawPassword = (password || '').trim();
    if (rawPassword.length < 6) {
      rawPassword = `amb_${rawPassword || '1234'}_pin`;
    }

    const metadata = {
      name: name.trim(),
      company: (company || '—').trim(),
      store_name: (company || name).trim(),
      phone: (phone || '—').trim(),
      status: status || (plan ? 'Active' : 'No plan'),
      plan: plan || null,
      plan_duration: plan ? (plan_duration || '1 year') : null,
      utr_ref: utr_ref || null,
      utr_note: utr_note || null,
      expires_at: plan ? (expires_at || '29 Oct 2028') : null,
      role: role || 'ADMIN',
      google: Boolean(google),
    };

    const { data: created, error } = await client.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password: rawPassword,
      email_confirm: true,
      user_metadata: metadata,
    });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      user: created.user,
      message: `User ${name} created successfully in Supabase.`,
    }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

// PATCH: Change package, plan, duration, or status for a particular user in Supabase
export async function PATCH(req: NextRequest) {
  const session = await requireAdminSession(req);
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  const client = getAdminClient();
  if (!client) {
    return NextResponse.json({ success: false, error: 'Supabase admin client unavailable' }, { status: 500 });
  }

  try {
    const body = await req.json();
    const { userId, status, plan, plan_duration, utr_ref, utr_note, expires_at } = body;

    if (!userId) {
      return NextResponse.json({ success: false, error: 'User ID is required' }, { status: 400 });
    }

    const { data: userRes, error: fetchErr } = await client.auth.admin.getUserById(userId);
    if (fetchErr || !userRes?.user) {
      return NextResponse.json({ success: false, error: fetchErr?.message || 'User not found' }, { status: 404 });
    }

    const currentMeta = userRes.user.user_metadata || {};
    const updatedMeta = {
      ...currentMeta,
      status: status !== undefined ? status : currentMeta.status || 'Active',
      plan: plan !== undefined ? plan : currentMeta.plan,
      plan_duration: plan_duration !== undefined ? plan_duration : currentMeta.plan_duration,
      utr_ref: utr_ref !== undefined ? utr_ref : currentMeta.utr_ref,
      utr_note: utr_note !== undefined ? utr_note : currentMeta.utr_note,
      expires_at: expires_at !== undefined ? expires_at : currentMeta.expires_at,
    };

    const { data: updated, error: updateErr } = await client.auth.admin.updateUserById(userId, {
      user_metadata: updatedMeta,
    });

    if (updateErr) {
      return NextResponse.json({ success: false, error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      user: updated.user,
      message: 'User package & status updated in Supabase successfully.',
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

// DELETE: Delete a user permanently from Supabase Auth
export async function DELETE(req: NextRequest) {
  const session = await requireAdminSession(req);
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  const client = getAdminClient();
  if (!client) {
    return NextResponse.json({ success: false, error: 'Supabase admin client unavailable' }, { status: 500 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ success: false, error: 'User ID is required.' }, { status: 400 });
    }

    const { error } = await client.auth.admin.deleteUser(userId);
    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: 'User deleted permanently from Supabase.',
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
