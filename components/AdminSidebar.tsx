'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { 
  Users, 
  Layers, 
  ShieldCheck, 
  Menu, 
  X
} from 'lucide-react';

interface AdminSidebarProps {
  usersCount?: number;
}

export function AdminSidebar({ usersCount }: AdminSidebarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Management section (matching InvoicePro Admin)
  const managementLinks = [
    { href: '/users', altHref: '/', label: 'Users', icon: Users, count: usersCount },
    { href: '/packages', label: 'Packages', icon: Layers },
  ];

  return (
    <>
      {/* Mobile Top Header */}
      <div className="md:hidden flex items-center justify-between px-4 h-14 bg-white border-b border-slate-200 sticky top-0 z-40 select-none">
        <Link href="/users" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center font-bold text-white shadow-sm">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <div className="text-sm font-bold tracking-tight text-slate-900 leading-none">
              AMB <span className="text-indigo-600">Admin</span>
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5 leading-none">Control Panel</div>
          </div>
        </Link>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="p-2 rounded-lg text-slate-700 hover:bg-slate-100 transition-colors"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div 
          className="md:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-xs animate-in fade-in"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Left Vertical Sidebar (InvoicePro Admin Styling) */}
      <aside
        className={`fixed md:sticky top-0 left-0 z-50 h-screen w-64 bg-white border-r border-slate-200/80 flex flex-col justify-between select-none transition-transform duration-200 ease-out md:translate-x-0 ${
          mobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="flex flex-col flex-1 min-h-0 overflow-y-auto">
          {/* Top Logo Header */}
          <div className="p-5 pb-4 flex items-center justify-between">
            <Link 
              href="/users" 
              className="flex items-center gap-3 group"
              onClick={() => setMobileOpen(false)}
            >
              <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center font-bold text-white shadow-sm group-hover:scale-105 transition-transform flex-shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <div className="text-base font-extrabold tracking-tight text-slate-900 flex items-center gap-1 leading-none">
                  <span>AMB</span>
                  <span className="text-[11px] font-bold text-slate-800">MedERP</span>
                </div>
                <div className="text-[10px] text-indigo-600 font-bold tracking-wider uppercase mt-1 leading-none">
                  ADMIN CONSOLE
                </div>
              </div>
            </Link>

            <button
              onClick={() => setMobileOpen(false)}
              className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* MANAGEMENT Section (Prominent Section from Screenshot) */}
          <div className="px-3 pt-3">
            <div className="px-3 pb-2 text-[10px] font-bold tracking-wider uppercase text-slate-400">
              MANAGEMENT
            </div>
            <nav className="space-y-1">
              {managementLinks.map((link) => {
                const isActive = pathname === link.href || (link.altHref && pathname === link.altHref);
                const Icon = link.icon;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs transition-all ${
                      isActive
                        ? 'bg-indigo-50/80 text-indigo-700 font-bold border border-indigo-200/80 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-medium'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
                      <span>{link.label}</span>
                    </div>
                    {link.count !== undefined && link.count > 0 && (
                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-600">
                        {link.count}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Bottom Section: Admin Workspace Card */}
        <div className="p-3 border-t border-slate-100 bg-white">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
            <div className="text-xs font-bold text-slate-900">
              Admin workspace
            </div>
            <div className="text-[11px] text-slate-500 leading-snug">
              Manage your AMB application.
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
export default AdminSidebar;
