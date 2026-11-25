import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase';
import { requireAdminSession } from '@/lib/admin-auth';

export async function GET(req: NextRequest) {
  const session = await requireAdminSession(req);
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const fallbackUpi = (process.env.NEXT_PUBLIC_MERCHANT_UPI_ID || '9409862204@kotakbank').trim();
  const fallbackName = (process.env.NEXT_PUBLIC_MERCHANT_NAME || 'Mobintix Infotech').trim();

  const client = getAdminClient();
  if (!client) {
    return NextResponse.json({ success: true, upiId: fallbackUpi, payeeName: fallbackName });
  }

  try {
    const { data } = await client.auth.admin.listUsers();
    const users = data?.users || [];
    const configured = users.find((u) => u.user_metadata?.merchant_upi_id);
    if (configured) {
      return NextResponse.json({
        success: true,
        upiId: String(configured.user_metadata.merchant_upi_id).trim() || fallbackUpi,
        payeeName: String(configured.user_metadata.merchant_payee_name || fallbackName).trim(),
      });
    }
  } catch {
    // fallback cleanly
  }

  return NextResponse.json({ success: true, upiId: fallbackUpi, payeeName: fallbackName });
}

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
    const { upiId, payeeName } = await req.json();
    const cleanUpi = typeof upiId === 'string' ? upiId.trim() : '';
    const cleanPayee = typeof payeeName === 'string' ? payeeName.trim() : 'Mobintix Infotech';

    if (!cleanUpi || !cleanUpi.includes('@')) {
      return NextResponse.json({ success: false, error: 'Valid UPI ID (e.g. 9409862204@kotakbank) is required.' }, { status: 400 });
    }

    const { data: userRes } = await client.auth.admin.listUsers();
    const users = userRes?.users || [];
    const targetAdmin =
      users.find((u) => u.id === session.userId) ||
      users.find((u) => u.email?.toLowerCase() === session.email.toLowerCase()) ||
      users[0];

    if (!targetAdmin) {
      return NextResponse.json({ success: false, error: 'Admin user record not found to store config.' }, { status: 404 });
    }

    const prevMeta = targetAdmin.user_metadata || {};
    const { error } = await client.auth.admin.updateUserById(targetAdmin.id, {
      user_metadata: {
        ...prevMeta,
        merchant_upi_id: cleanUpi,
        merchant_payee_name: cleanPayee || 'Mobintix Infotech',
      },
    });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      upiId: cleanUpi,
      payeeName: cleanPayee || 'Mobintix Infotech',
      message: 'Receiving UPI ID saved to Supabase.',
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
