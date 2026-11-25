'use client';

import { useEffect, useState, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, LogOut } from 'lucide-react';

interface AdminHeaderBarProps {
  leftContent?: ReactNode;
}

export function AdminHeaderBar({ leftContent }: AdminHeaderBarProps) {
  const router = useRouter();
  const [adminEmail, setAdminEmail] = useState<string>('Admin');
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    fetch('/api/admin/auth/me')
      .then((res) => {
        if (res.status === 401) {
          router.replace('/login');
          return null;
        }
        return res.json();
      })
      .then((json) => {
        if (json?.authenticated && json.admin?.email) {
          setAdminEmail(json.admin.email);
        }
      })
      .catch(() => {});
  }, [router]);

  const handleSignOut = async () => {
    if (!confirm('Sign out from AMB Admin Console?')) return;
    setSigningOut(true);
    try {
      await fetch('/api/admin/auth/logout', { method: 'POST' });
    } finally {
      window.location.href = '/login';
    }
  };

  return (
    <header
      className={`h-16 bg-white border-b border-slate-200/80 px-6 sm:px-8 flex items-center ${
        leftContent ? 'justify-between' : 'justify-end'
      } gap-3 sticky top-0 z-30 select-none`}
    >
      {leftContent}

      <div className="flex items-center gap-2.5">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-medium border border-slate-200">
          <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
          <span className="hidden sm:inline">{adminEmail}</span>
        </span>
        <button
          onClick={handleSignOut}
          disabled={signingOut}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 hover:text-rose-600 text-slate-700 text-xs font-semibold transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>{signingOut ? 'Signing out...' : 'Sign out'}</span>
        </button>
      </div>
    </header>
  );
}
