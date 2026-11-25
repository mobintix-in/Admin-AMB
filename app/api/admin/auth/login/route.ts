import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient, getPublicClient } from '@/lib/supabase';
import { ADMIN_SESSION_COOKIE, createAdminSessionToken } from '@/lib/admin-auth';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const cleanPassword = typeof password === 'string' ? password.trim() : '';

    if (!cleanEmail || !cleanPassword) {
      return NextResponse.json(
        { success: false, error: 'Email and password are required.' },
        { status: 400 }
      );
    }

    // Optional env override credentials if explicitly configured
    const envEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
    const envPassword = (process.env.ADMIN_PASSWORD || '').trim();
    if (envEmail && envPassword && cleanEmail === envEmail && cleanPassword === envPassword) {
      const token = await createAdminSessionToken({
        userId: 'env-admin',
        email: cleanEmail,
        name: 'AMB Admin',
        role: 'ADMIN',
      });
      const res = NextResponse.json({
        success: true,
        admin: { email: cleanEmail, name: 'AMB Admin', role: 'ADMIN' },
      });
      res.cookies.set(ADMIN_SESSION_COOKIE, token, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 7 * 24 * 60 * 60,
      });
      return res;
    }

    const publicClient = getPublicClient();
    const adminClient = getAdminClient();
    if (!publicClient || !adminClient) {
      return NextResponse.json(
        { success: false, error: 'Supabase authentication client is not configured.' },
        { status: 500 }
      );
    }

    const candidates = [cleanPassword];
    if (cleanPassword.length < 6) {
      candidates.push(`amb_${cleanPassword}_pin`);
    }

    let signedInUser: any = null;
    for (const pwd of candidates) {
      const { data, error } = await publicClient.auth.signInWithPassword({
        email: cleanEmail,
        password: pwd,
      });
      if (!error && data?.user) {
        signedInUser = data.user;
        break;
      }
    }

    if (!signedInUser) {
      return NextResponse.json(
        { success: false, error: 'Invalid admin email or password.' },
        { status: 401 }
      );
    }

    const meta = signedInUser.user_metadata || {};
    const role = String(meta.role || 'ADMIN').toUpperCase();
    if (role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Access denied: ADMIN role required.' },
        { status: 403 }
      );
    }

    const adminName = String(meta.name || cleanEmail.split('@')[0] || 'Admin');
    const token = await createAdminSessionToken({
      userId: signedInUser.id,
      email: signedInUser.email || cleanEmail,
      name: adminName,
      role,
    });

    const res = NextResponse.json({
      success: true,
      admin: {
        userId: signedInUser.id,
        email: signedInUser.email || cleanEmail,
        name: adminName,
        role,
      },
    });
    res.cookies.set(ADMIN_SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
    });
    return res;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
