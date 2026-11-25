'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Layers, 
  Plus, 
  Search, 
  Check, 
  CheckCircle2, 
  Pencil, 
  Trash2, 
  X, 
  Sparkles, 
  ShieldCheck, 
  Boxes, 
  Users, 
  CreditCard,
  Building2,
  Zap,
  ArrowRight,
  Database,
  ExternalLink,
  Copy,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { AdminSidebar } from '@/components/AdminSidebar';
import { AdminHeaderBar } from '@/components/AdminHeaderBar';

interface SubscriptionPackage {
  id: string;
  name: string;
  code: string;
  description: string;
  monthlyPrice: number;
  yearlyPrice: number;
  interval: 'Monthly' | 'Yearly' | 'Custom';
  terminals: string;
  status: 'Active' | 'Draft' | 'Archived';
  subscribersCount: number;
  popular?: boolean;
  features: string[];
}

export default function PackagesPage() {
  const [packages, setPackages] = useState<SubscriptionPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFromSupabase, setIsFromSupabase] = useState(false);
  const [needsSchema, setNeedsSchema] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPackage, setEditingPackage] = useState<SubscriptionPackage | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form state for creating / editing package
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formMonthlyPrice, setFormMonthlyPrice] = useState(999);
  const [formYearlyPrice, setFormYearlyPrice] = useState(3999);
  const [formTerminals, setFormTerminals] = useState('1 Counter Terminal');
  const [formFeatures, setFormFeatures] = useState('POS Billing\nFEFO Expiry\nUPI QR');
  const [formStatus, setFormStatus] = useState<'Active' | 'Draft'>('Active');

  // Merchant Direct UPI Payment Gateway Config
  const [merchantUpiId, setMerchantUpiId] = useState('9409862204@kotakbank');
  const [merchantPayeeName, setMerchantPayeeName] = useState('Mobintix Infotech');
  const [savingUpi, setSavingUpi] = useState(false);
  const [upiSavedMsg, setUpiSavedMsg] = useState<string | null>(null);

  const formatPrice = (val?: number) => {
    const num = Number(val || 0);
    return isNaN(num) ? '0' : num.toLocaleString('en-IN');
  };

  const loadPackages = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/packages');
      if (res.status === 401) {
        window.location.href = '/login';
        return;
      }
      const json = await res.json();
      if (json.success) {
        const normalized: SubscriptionPackage[] = (json.packages || []).map((p: any) => ({
          id: p.id || `pkg-${Date.now()}`,
          name: p.name || 'Custom Package',
          code: p.code || 'CUSTOM',
          description: p.description || '',
          monthlyPrice: Number(p.monthlyPrice ?? p.monthly_price ?? 999),
          yearlyPrice: Number(p.yearlyPrice ?? p.yearly_price ?? 9999),
          interval: p.interval || 'Yearly',
          terminals: p.terminals || '1 Counter Terminal',
          status: p.status || 'Active',
          popular: Boolean(p.popular ?? p.is_popular),
          features: Array.isArray(p.features) ? p.features : [],
          subscribersCount: Number(p.subscribersCount ?? p.subscribers_count ?? 0),
        }));
        setPackages(normalized);
        setIsFromSupabase(Boolean(json.fromSupabase));
        setNeedsSchema(Boolean(json.needsSchema));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPackages();
    fetch('/api/admin/payment-config')
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (json?.success) {
          if (json.upiId) setMerchantUpiId(json.upiId);
          if (json.payeeName) setMerchantPayeeName(json.payeeName);
        }
      })
      .catch(() => {});
  }, []);

  const handleSaveUpiConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingUpi(true);
    setUpiSavedMsg(null);
    try {
      const res = await fetch('/api/admin/payment-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          upiId: merchantUpiId.trim(),
          payeeName: merchantPayeeName.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        alert(json.error || 'Failed to save UPI ID.');
      } else {
        setUpiSavedMsg('Receiving UPI ID updated for AMB QR payments!');
        setTimeout(() => setUpiSavedMsg(null), 3000);
      }
    } catch {
      alert('Network error saving UPI ID.');
    } finally {
      setSavingUpi(false);
    }
  };

  const openCreateModal = () => {
    setEditingPackage(null);
    setFormError(null);
    setFormName('');
    setFormDescription('');
    setFormMonthlyPrice(1499);
    setFormYearlyPrice(14999);
    setFormTerminals('2 Counter Terminals');
    setFormFeatures('High-Speed POS Billing\nFEFO Expiry Radar\nDynamic UPI QR\nAutomated Reports');
    setFormStatus('Active');
    setIsModalOpen(true);
  };

  const openEditModal = (pkg: SubscriptionPackage) => {
    setEditingPackage(pkg);
    setFormError(null);
    setFormName(pkg.name);
    setFormDescription(pkg.description);
    setFormMonthlyPrice(pkg.monthlyPrice);
    setFormYearlyPrice(pkg.yearlyPrice);
    setFormTerminals(pkg.terminals);
    setFormFeatures(pkg.features.join('\n'));
    setFormStatus(pkg.status === 'Archived' ? 'Draft' : pkg.status);
    setIsModalOpen(true);
  };

  const handleSavePackage = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const trimmedName = formName.trim();
    if (!trimmedName) {
      setFormError('Package name is required.');
      return;
    }

    setIsSubmitting(true);

    const featureList = formFeatures
      .split('\n')
      .map((f) => f.trim())
      .filter(Boolean);

    const generatedCode = trimmedName
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_|_$/g, '') || `PKG_${Date.now()}`;

    const payload: SubscriptionPackage = {
      id: editingPackage ? editingPackage.id : `pkg-${Date.now()}`,
      name: trimmedName,
      code: editingPackage ? editingPackage.code : generatedCode,
      description: formDescription.trim(),
      monthlyPrice: Number(formMonthlyPrice),
      yearlyPrice: Number(formYearlyPrice),
      interval: 'Yearly',
      terminals: formTerminals.trim(),
      status: formStatus,
      popular: editingPackage?.popular || false,
      subscribersCount: editingPackage ? editingPackage.subscribersCount : 0,
      features: featureList,
    };

    try {
      const res = await fetch('/api/admin/packages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setFormError(json.error || 'Failed to save package to Supabase.');
        return;
      }

      setIsFromSupabase(true);
      setIsModalOpen(false);
      await loadPackages();
    } catch (err) {
      console.error(err);
      setFormError('Network error while saving package.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePackage = async (id: string) => {
    if (!confirm('Are you sure you want to delete this commercial package from Supabase?')) return;

    const prevPackages = packages;
    setPackages((prev) => prev.filter((p) => p.id !== id));

    try {
      const res = await fetch(`/api/admin/packages?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        alert(json.error || 'Failed to delete package from Supabase.');
        setPackages(prevPackages);
      }
    } catch (e) {
      console.error(e);
      alert('Network error while deleting package.');
      setPackages(prevPackages);
    }
  };

  const handleCopySql = () => {
    const sql = `-- 1. Create Packages Table
CREATE TABLE IF NOT EXISTS public.packages (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    monthly_price NUMERIC(12, 2) NOT NULL DEFAULT 999.00,
    yearly_price NUMERIC(12, 2) NOT NULL DEFAULT 3999.00,
    interval VARCHAR(20) DEFAULT 'Yearly',
    terminals VARCHAR(100) DEFAULT 'Unlimited Terminals',
    status VARCHAR(20) DEFAULT 'Active',
    is_popular BOOLEAN DEFAULT FALSE,
    features TEXT[] DEFAULT '{}',
    subscribers_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access to active packages" ON public.packages;
CREATE POLICY "Allow public read access to active packages"
ON public.packages FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow service role full management" ON public.packages;
CREATE POLICY "Allow service role full management"
ON public.packages FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 2. Seed Single System Plan
INSERT INTO public.packages (id, name, code, description, monthly_price, yearly_price, interval, terminals, status, is_popular, features, subscribers_count)
VALUES 
('pkg-amb-erp', 'AMB MedERP', 'AMB_MEDERP', 'All-in-one pharmacy billing, inventory, FEFO expiry, GST & cloud sync.', 999.00, 3999.00, 'Yearly', 'Unlimited Terminals', 'Active', TRUE, ARRAY['POS Billing', 'FEFO Expiry', 'UPI QR', 'Cloud Sync'], 1)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, monthly_price = EXCLUDED.monthly_price, yearly_price = EXCLUDED.yearly_price;`;
    navigator.clipboard.writeText(sql);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
  };

  const filteredPackages = packages.filter((pkg) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      pkg.name.toLowerCase().includes(q) ||
      pkg.description.toLowerCase().includes(q) ||
      pkg.code.toLowerCase().includes(q)
    );
  });

  const totalSubscribers = packages.reduce((sum, p) => sum + p.subscribersCount, 0);

  return (
    <div className="min-h-screen bg-slate-50/40 text-slate-900 flex flex-col md:flex-row font-sans">
      <AdminSidebar />

      <div className="flex-1 min-w-0 flex flex-col min-h-screen overflow-y-auto">
        <AdminHeaderBar
          leftContent={
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-indigo-600" />
                <span>Supabase Cloud Integration:</span>
              </span>
              {isFromSupabase ? (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  <span>Live PostgreSQL Table</span>
                </span>
              ) : (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  <span>Ready to Sync</span>
                </span>
              )}
            </div>
          }
        />

        {/* Main Content Area */}
        <main className="flex-1 max-w-7xl w-full mx-auto p-6 sm:p-8 lg:p-10 space-y-6">
          {/* Schema Sync Notice if table not yet in Supabase */}
          {needsSchema && (
            <div className="p-4 rounded-2xl bg-indigo-50/80 border border-indigo-200 text-indigo-900 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs animate-in fade-in">
              <div className="flex items-start sm:items-center gap-2.5">
                <Database className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5 sm:mt-0" />
                <div>
                  <span className="font-bold">Supabase PostgreSQL Schema Setup:</span>
                  <span className="text-indigo-700 ml-1">
                    Execute <code className="bg-white px-1.5 py-0.5 rounded font-mono text-[11px] border border-indigo-200">packages.sql</code> in your Supabase SQL Editor to persist packages directly in PostgreSQL.
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={handleCopySql}
                  className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-indigo-200 text-indigo-700 font-bold text-[11px] flex items-center gap-1.5 shadow-2xs transition-all"
                >
                  {copiedSql ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-700">SQL Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Copy Schema SQL</span>
                    </>
                  )}
                </button>
                <a
                  href="https://supabase.com/dashboard/project/oaiujdbjbnfflmnjymug/sql"
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] flex items-center gap-1.5 shadow-xs transition-all"
                >
                  <span>Open Supabase SQL</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          )}

          {/* Page Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                Packages
              </h1>
              <div className="text-xs text-slate-500 mt-1 font-medium">
                {packages.length} active packages • {totalSubscribers} subscribed stores • Supabase Database Powered
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <div className="relative w-64 sm:w-72">
                <input
                  type="text"
                  placeholder="Search packages..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-3.5 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
                />
              </div>

              <button
                onClick={openCreateModal}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-semibold shadow-xs transition-all flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>Create Package</span>
              </button>
            </div>
          </div>

          {/* Direct UPI Receiving Gateway Settings */}
          <form
            onSubmit={handleSaveUpiConfig}
            className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4 text-xs"
          >
            <div className="flex items-start sm:items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0">
                <CreditCard className="w-4 h-4" />
              </div>
              <div>
                <div className="font-bold text-slate-900">Direct UPI Receiving Payment Gateway</div>
                <div className="text-[11px] text-slate-500">
                  Customers scan QR codes paying to this UPI ID and submit UTR for manual verification in Users.
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-shrink-0">
              <input
                type="text"
                value={merchantPayeeName}
                onChange={(e) => setMerchantPayeeName(e.target.value)}
                placeholder="Payee Name"
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 sm:w-44"
                required
              />
              <input
                type="text"
                value={merchantUpiId}
                onChange={(e) => setMerchantUpiId(e.target.value)}
                placeholder="your-upi@bank"
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-mono font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 sm:w-56"
                required
              />
              <button
                type="submit"
                disabled={savingUpi}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white font-semibold shadow-2xs transition-colors"
              >
                {savingUpi ? 'Saving...' : 'Save UPI ID'}
              </button>
            </div>
            {upiSavedMsg && (
              <span className="text-emerald-700 font-semibold text-[11px]">{upiSavedMsg}</span>
            )}
          </form>

          {/* Pricing Package Cards Grid */}
          <div className={`grid grid-cols-1 ${filteredPackages.length === 1 ? 'max-w-lg' : 'md:grid-cols-3'} gap-6`}>
            {filteredPackages.map((pkg) => (
              <div
                key={pkg.id}
                className={`bg-white rounded-2xl p-6 sm:p-7 shadow-xs border transition-all relative flex flex-col justify-between ${
                  pkg.popular
                    ? 'border-indigo-600 shadow-md ring-1 ring-indigo-600/20'
                    : 'border-slate-200/90 hover:border-slate-300'
                }`}
              >
                {pkg.popular && (
                  <span className="absolute -top-3 right-6 px-3 py-0.5 rounded-full bg-indigo-600 text-white text-[10px] font-bold uppercase tracking-widest shadow-2xs">
                    Popular
                  </span>
                )}

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-bold text-slate-900">{pkg.name}</h3>
                      <div className="text-[11px] font-mono font-semibold text-indigo-600 mt-0.5">
                        {pkg.code}
                      </div>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {pkg.status}
                    </span>
                  </div>

                  <p className="text-xs text-slate-500 min-h-[32px] leading-relaxed">
                    {pkg.description}
                  </p>

                  <div className="pt-2 border-t border-slate-100">
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-extrabold text-slate-900 font-sans">
                        ₹{formatPrice(pkg.monthlyPrice)}
                      </span>
                      <span className="text-xs text-slate-500 font-medium">/ month</span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      or ₹{formatPrice(pkg.yearlyPrice)} billed annually
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100">
                    <div className="text-[11px] font-semibold text-slate-700 mb-2.5 flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-indigo-600" />
                      <span>{pkg.terminals}</span>
                    </div>
                    <ul className="space-y-2 text-xs text-slate-600">
                      {pkg.features.map((feat, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <Check className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0 mt-0.5" />
                          <span className="leading-tight">{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="pt-6 mt-6 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs text-slate-500 font-medium">
                    {pkg.subscribersCount} store{pkg.subscribersCount !== 1 ? 's' : ''} on this plan
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openEditModal(pkg)}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors flex items-center gap-1"
                    >
                      <Pencil className="w-3 h-3 text-slate-500" />
                      <span>Edit</span>
                    </button>
                    <button
                      onClick={() => handleDeletePackage(pkg.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      title="Archive Package"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Packages Table View */}
          <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  All Subscription Packages & Tiers
                </h2>
                <p className="text-xs text-slate-500">
                  Configure commercial terms, pricing models, and terminal limits in Supabase.
                </p>
              </div>
              <span className="text-xs text-slate-400 font-medium">
                {packages.length} packages configured
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-4">PACKAGE NAME</th>
                    <th className="px-6 py-4">BILLING INTERVAL</th>
                    <th className="px-6 py-4">MONTHLY</th>
                    <th className="px-6 py-4">ANNUAL</th>
                    <th className="px-6 py-4">TERMINALS</th>
                    <th className="px-6 py-4">SUBSCRIBERS</th>
                    <th className="px-6 py-4 text-right">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredPackages.map((pkg) => (
                    <tr key={pkg.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-6 py-4 font-bold text-slate-900">
                        <div>{pkg.name}</div>
                        <div className="text-[10px] font-mono text-slate-400 font-normal">
                          {pkg.code}
                        </div>
                      </td>

                      <td className="px-6 py-4 text-slate-700">
                        {pkg.interval}
                      </td>

                      <td className="px-6 py-4 font-mono font-bold text-slate-900">
                        ₹{formatPrice(pkg.monthlyPrice)}
                      </td>

                      <td className="px-6 py-4 font-mono font-bold text-slate-900">
                        ₹{formatPrice(pkg.yearlyPrice)}
                      </td>

                      <td className="px-6 py-4 text-slate-700">
                        {pkg.terminals}
                      </td>

                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                          {pkg.subscribersCount} Stores
                        </span>
                      </td>

                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => openEditModal(pkg)}
                          className="px-3 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors"
                        >
                          Configure
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>

      {/* Create / Edit Package Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-5 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {editingPackage ? 'Edit Package' : 'Create New Package'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Configure pricing, terminal limits, and features in Supabase.
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePackage} className="space-y-4 text-xs">
              {formError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{formError}</span>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="font-semibold text-slate-700">Package Name *</label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. AMB MedERP"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-semibold text-slate-700">Status *</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="Active">Active</option>
                    <option value="Draft">Draft</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-slate-700">Description *</label>
                <textarea
                  rows={2}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Short description of who this package is for..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <label className="font-semibold text-slate-700">Monthly Price (₹) *</label>
                  <input
                    type="number"
                    value={formMonthlyPrice}
                    onChange={(e) => setFormMonthlyPrice(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-mono font-bold focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-semibold text-slate-700">Annual Price (₹) *</label>
                  <input
                    type="number"
                    value={formYearlyPrice}
                    onChange={(e) => setFormYearlyPrice(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-mono font-bold focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-semibold text-slate-700">Terminals *</label>
                  <input
                    type="text"
                    value={formTerminals}
                    onChange={(e) => setFormTerminals(e.target.value)}
                    placeholder="e.g. 1 Counter Terminal"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-slate-700">
                  Included Features (One feature per line) *
                </label>
                <textarea
                  rows={4}
                  value={formFeatures}
                  onChange={(e) => setFormFeatures(e.target.value)}
                  placeholder="POS Billing&#10;FEFO Expiry Radar&#10;Dynamic UPI QR"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-mono focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-xs flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{isSubmitting ? 'Saving to Supabase...' : editingPackage ? 'Update Package' : 'Create Package'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
