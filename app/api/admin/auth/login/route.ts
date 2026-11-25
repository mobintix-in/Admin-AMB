import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient, getPublicClient } from '@/lib/supabase';
import {
  ADMIN_SESSION_COOKIE,
  ALLOWED_ADMIN_EMAIL,
  ALLOWED_ADMIN_PHONE,
  createAdminSessionToken,
  isAuthorizedSuperAdmin,
  normalizeIndianPhone,
} from '@/lib/admin-auth';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawIdentifier = String(body.identifier || body.email || '').trim();
    const cleanPassword = typeof body.password === 'string' ? body.password.trim() : '';

    if (!rawIdentifier || !cleanPassword) {
      return NextResponse.json(
        { success: false, error: 'Email or mobile number and password are required.' },
        { status: 400 }
      );
    }

    const isEmailInput = rawIdentifier.includes('@');
    const cleanEmailInput = rawIdentifier.toLowerCase();
    const cleanPhoneInput = normalizeIndianPhone(rawIdentifier);

    const matchesAllowedIdentifier = isEmailInput
      ? cleanEmailInput === ALLOWED_ADMIN_EMAIL
      : cleanPhoneInput.length === 10 && cleanPhoneInput === ALLOWED_ADMIN_PHONE;

    if (!matchesAllowedIdentifier) {
      return NextResponse.json(
        {
          success: false,
          error: 'Access denied. This account is not authorized for the AMB Admin Console.',
        },
        { status: 403 }
      );
    }

    // Optional env override credentials (still restricted to ALLOWED_ADMIN_EMAIL)
    const envEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
    const envPassword = (process.env.ADMIN_PASSWORD || '').trim();
    if (
      envEmail === ALLOWED_ADMIN_EMAIL &&
      envPassword &&
      cleanPassword === envPassword
    ) {
      const token = await createAdminSessionToken({
        userId: 'env-admin',
        email: ALLOWED_ADMIN_EMAIL,
        phone: ALLOWED_ADMIN_PHONE,
        name: 'AMB Admin',
        role: 'SUPER_ADMIN',
      });
      const res = NextResponse.json({
        success: true,
        admin: {
          email: ALLOWED_ADMIN_EMAIL,
          phone: ALLOWED_ADMIN_PHONE,
          name: 'AMB Admin',
          role: 'SUPER_ADMIN',
        },
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

    // Verify exact Supabase Auth account matches BOTH authorized email and mobile number
    const { data: userList, error: listErr } = await adminClient.auth.admin.listUsers();
    if (listErr) {
      return NextResponse.json({ success: false, error: listErr.message }, { status: 500 });
    }

    const authorizedAccount = (userList?.users || []).find((u) =>
      isAuthorizedSuperAdmin(u.email, u.user_metadata?.phone)
    );

    if (!authorizedAccount || !authorizedAccount.email) {
      return NextResponse.json(
        {
          success: false,
          error: 'Authorized admin account was not found in Supabase Auth.',
        },
        { status: 403 }
      );
    }

    const candidates = [cleanPassword];
    if (cleanPassword.length < 6) {
      candidates.push(`amb_${cleanPassword}_pin`);
    }

    let signedInUser: any = null;
    for (const pwd of candidates) {
      const { data, error } = await publicClient.auth.signInWithPassword({
        email: authorizedAccount.email,
        password: pwd,
      });
      if (!error && data?.user) {
        signedInUser = data.user;
        break;
      }
    }

    if (!signedInUser) {
      return NextResponse.json(
        { success: false, error: 'Invalid password for the authorized admin account.' },
        { status: 401 }
      );
    }

    const meta = signedInUser.user_metadata || {};
    if (!isAuthorizedSuperAdmin(signedInUser.email, meta.phone)) {
      return NextResponse.json(
        { success: false, error: 'Access denied: Unauthorized admin account.' },
        { status: 403 }
      );
    }

    const adminName = String(meta.name || 'Super Admin');
    const token = await createAdminSessionToken({
      userId: signedInUser.id,
      email: ALLOWED_ADMIN_EMAIL,
      phone: ALLOWED_ADMIN_PHONE,
      name: adminName,
      role: 'SUPER_ADMIN',
    });

    const res = NextResponse.json({
      success: true,
      admin: {
        userId: signedInUser.id,
        email: ALLOWED_ADMIN_EMAIL,
        phone: ALLOWED_ADMIN_PHONE,
        name: adminName,
        role: 'SUPER_ADMIN',
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
