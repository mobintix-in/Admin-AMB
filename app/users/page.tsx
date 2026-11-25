'use client';

import { useState, useEffect } from 'react';
import { 
  Users, 
  Search, 
  Mail, 
  RefreshCw, 
  Pencil, 
  Trash2, 
  Plus, 
  X, 
  Sparkles, 
  CheckCircle2, 
  Building2, 
  ShieldCheck, 
  Calendar,
  Lock,
  Phone,
  Layers,
  CreditCard
} from 'lucide-react';
import { AdminSidebar } from '@/components/AdminSidebar';
import { AdminHeaderBar } from '@/components/AdminHeaderBar';
import { AdminUser } from '@/lib/supabase';

interface PackageOption {
  id: string;
  name: string;
  code: string;
  monthlyPrice: number;
  yearlyPrice: number;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function computeExpiryIso(duration: string): string {
  if (duration.toLowerCase() === 'lifetime') return '2099-12-31';
  const d = new Date();
  const lower = duration.toLowerCase();
  if (lower.includes('3 month')) {
    d.setMonth(d.getMonth() + 3);
  } else if (lower.includes('6 month')) {
    d.setMonth(d.getMonth() + 6);
  } else if (lower.includes('1 month') || lower === 'monthly') {
    d.setMonth(d.getMonth() + 1);
  } else {
    d.setFullYear(d.getFullYear() + 1);
  }
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function toIsoDateValue(value?: string): string {
  if (!value) return computeExpiryIso('1 year');
  if (/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) return value.trim();
  const parsed = new Date(value);
  if (!isNaN(parsed.getTime())) {
    const yyyy = parsed.getFullYear();
    const mm = String(parsed.getMonth() + 1).padStart(2, '0');
    const dd = String(parsed.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
  return computeExpiryIso('1 year');
}

function formatDisplayExpiry(isoOrText: string): string {
  if (!isoOrText) return '';
  if (isoOrText === '2099-12-31') return 'Lifetime';
  const match = isoOrText.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    const year = match[1];
    const monthIdx = parseInt(match[2], 10) - 1;
    const day = parseInt(match[3], 10);
    if (monthIdx >= 0 && monthIdx < 12) {
      return `${day} ${MONTHS[monthIdx]} ${year}`;
    }
  }
  return isoOrText;
}

export default function UsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [packages, setPackages] = useState<PackageOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedUserForPlan, setSelectedUserForPlan] = useState<AdminUser | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Create User Form State
  const [newUserName, setNewUserName] = useState('');
  const [newUserCompany, setNewUserCompany] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPhone, setNewUserPhone] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('123456');
  const [newUserPlan, setNewUserPlan] = useState('No plan');
  const [newUserDuration, setNewUserDuration] = useState('1 year');
  const [newUserExpires, setNewUserExpires] = useState('2027-11-25');
  const [newUserUtr, setNewUserUtr] = useState('');
  const [newUserGoogle, setNewUserGoogle] = useState(false);

  // Edit / Change Package Form State
  const [planTier, setPlanTier] = useState<string>('No plan');
  const [planDuration, setPlanDuration] = useState<string>('1 year');
  const [utrRef, setUtrRef] = useState<string>('');
  const [utrNote, setUtrNote] = useState<string>('Previous payment');
  const [expiresAt, setExpiresAt] = useState<string>('2027-11-25');

  // Load both users and packages from Supabase
  const loadData = async () => {
    setLoading(true);
    try {
      const [uRes, pRes] = await Promise.all([
        fetch('/api/admin/users'),
        fetch('/api/admin/packages'),
      ]);
      if (uRes.status === 401 || pRes.status === 401) {
        window.location.href = '/login';
        return;
      }
      const uJson = await uRes.json();
      const pJson = await pRes.json();

      if (uJson.success) {
        setUsers(uJson.users || []);
      }
      if (pJson.success) {
        const loadedPkgs: PackageOption[] = pJson.packages || [];
        setPackages(loadedPkgs);
        setNewUserPlan((prev) => {
          if (prev === 'No plan' || loadedPkgs.some((p) => p.name === prev)) return prev;
          return loadedPkgs[0]?.name || 'No plan';
        });
      }
    } catch (e) {
      console.error('Failed to load data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const activeCount = users.filter((u) => u.status === 'Active').length;
  const pendingCount = users.filter((u) => u.status === 'Pending').length;

  // Activate or Manually Verify Pending user subscription in Supabase
  const handleActivate = async (user: AdminUser) => {
    const fallbackPlan = user.plan || packages[0]?.name || 'AMB MedERP';
    const duration = user.plan_duration || '1 year';
    const nextExpiry =
      user.status === 'Pending' || !user.expires_at
        ? formatDisplayExpiry(computeExpiryIso(duration))
        : user.expires_at;
    const nextUtrNote =
      user.status === 'Pending' ? 'Manually verified by Admin' : user.utr_note;

    const prevUsers = users;
    const updatedUsers = users.map((u) =>
      u.id === user.id
        ? {
            ...u,
            status: 'Active' as const,
            plan: fallbackPlan,
            plan_duration: duration,
            expires_at: nextExpiry,
            utr_note: nextUtrNote,
          }
        : u
    );
    setUsers(updatedUsers);

    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          status: 'Active',
          plan: fallbackPlan,
          plan_duration: duration,
          expires_at: nextExpiry,
          ...(nextUtrNote !== undefined ? { utr_note: nextUtrNote } : {}),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        alert(json.error || 'Failed to activate user subscription.');
        setUsers(prevUsers);
      }
    } catch (err) {
      console.error(err);
      alert('Network error activating user.');
      setUsers(prevUsers);
    }
  };

  // Reject a pending UPI payment request
  const handleRejectPending = async (user: AdminUser) => {
    if (!confirm(`Reject pending UPI payment for ${user.name} (UTR: ${user.utr_ref || 'N/A'})?`)) return;

    const prevUsers = users;
    setUsers(
      users.map((u) =>
        u.id === user.id
          ? {
              ...u,
              status: 'No plan' as const,
              plan: undefined,
              plan_duration: undefined,
              expires_at: undefined,
              utr_note: 'Payment rejected by Admin',
            }
          : u
      )
    );

    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          status: 'No plan',
          plan: null,
          plan_duration: null,
          expires_at: null,
          utr_note: 'Payment rejected by Admin',
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        alert(json.error || 'Failed to reject payment.');
        setUsers(prevUsers);
      }
    } catch (err) {
      console.error(err);
      alert('Network error rejecting payment.');
      setUsers(prevUsers);
    }
  };

  // Revoke user subscription in Supabase
  const handleRevoke = async (user: AdminUser) => {
    if (!confirm(`Revoke commercial subscription for ${user.name}?`)) return;

    const prevUsers = users;
    const updatedUsers = users.map((u) =>
      u.id === user.id
        ? {
            ...u,
            status: 'No plan' as const,
            plan: undefined,
            plan_duration: undefined,
            expires_at: undefined,
          }
        : u
    );
    setUsers(updatedUsers);

    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          status: 'No plan',
          plan: null,
          plan_duration: null,
          expires_at: null,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        alert(json.error || 'Failed to revoke subscription.');
        setUsers(prevUsers);
      }
    } catch (err) {
      console.error(err);
      alert('Network error revoking subscription.');
      setUsers(prevUsers);
    }
  };

  // Open modal to change package for a particular user
  const openChangePackageModal = (user: AdminUser) => {
    const initialDuration = user.plan_duration || '1 year';
    setSelectedUserForPlan(user);
    setPlanTier(user.plan || (packages[0]?.name || 'No plan'));
    setPlanDuration(initialDuration);
    setUtrRef(user.utr_ref || '');
    setUtrNote(user.utr_note || 'Previous payment');
    setExpiresAt(user.expires_at ? toIsoDateValue(user.expires_at) : computeExpiryIso(initialDuration));
  };

  // Save updated package for user in Supabase
  const handleSavePackageChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserForPlan) return;

    setIsSubmitting(true);

    const isNoPlan = planTier === 'No plan';
    const formattedExpiry = formatDisplayExpiry(expiresAt || computeExpiryIso(planDuration));

    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUserForPlan.id,
          status: isNoPlan ? 'No plan' : 'Active',
          plan: isNoPlan ? null : planTier,
          plan_duration: isNoPlan ? null : planDuration,
          utr_ref: utrRef.trim() || null,
          utr_note: utrNote.trim() || null,
          expires_at: isNoPlan ? null : formattedExpiry,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        alert(json.error || 'Failed to update package in Supabase.');
        return;
      }

      setSelectedUserForPlan(null);
      await loadData();
    } catch (err) {
      console.error(err);
      alert('Network error updating package.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Create brand new user directly in Supabase
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newUserName,
          company: newUserCompany,
          email: newUserEmail,
          phone: newUserPhone,
          password: newUserPassword,
          plan: newUserPlan === 'No plan' ? null : newUserPlan,
          plan_duration: newUserPlan === 'No plan' ? null : newUserDuration,
          status: newUserPlan === 'No plan' ? 'No plan' : 'Active',
          expires_at: newUserPlan === 'No plan' ? null : formatDisplayExpiry(newUserExpires),
          utr_ref: newUserUtr.trim() || null,
          google: newUserGoogle,
        }),
      });

      const json = await res.json();
      if (json.success) {
        setIsCreateModalOpen(false);
        // Reset form
        setNewUserName('');
        setNewUserCompany('');
        setNewUserEmail('');
        setNewUserPhone('');
        setNewUserUtr('');
        // Reload user directory from Supabase
        await loadData();
      } else {
        alert(json.error || 'Failed to create user in Supabase');
      }
    } catch (err) {
      console.error(err);
      alert('Error creating user');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete user permanently from Supabase
  const handleDeleteUser = async (user: AdminUser) => {
    if (!confirm(`Are you sure you want to permanently delete user "${user.name}" (${user.email}) from Supabase? This action cannot be undone.`)) {
      return;
    }

    setUsers((prev) => prev.filter((u) => u.id !== user.id));

    try {
      const res = await fetch(`/api/admin/users?userId=${user.id}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (!json.success) {
        alert(json.error || 'Failed to delete user from Supabase');
        await loadData();
      }
    } catch (err) {
      console.error(err);
      alert('Error deleting user');
      await loadData();
    }
  };

  const filteredUsers = users.filter((u) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      u.name.toLowerCase().includes(q) ||
      (u.company && u.company.toLowerCase().includes(q)) ||
      (u.email && u.email.toLowerCase().includes(q)) ||
      (u.phone && u.phone.includes(q)) ||
      (u.utr_ref && u.utr_ref.toLowerCase().includes(q))
    );
  });

  return (
    <div className="min-h-screen bg-slate-50/40 text-slate-900 flex flex-col md:flex-row font-sans">
      <AdminSidebar usersCount={users.length} />

      <div className="flex-1 min-w-0 flex flex-col min-h-screen overflow-y-auto">
        <AdminHeaderBar />

        {/* Main Content Area */}
        <main className="flex-1 max-w-7xl w-full mx-auto p-6 sm:p-8 lg:p-10 space-y-6">
          {/* Page Title & Action Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                Users
              </h1>
              <div className="text-xs text-slate-500 mt-1 font-medium">
                {users.length} total • {activeCount} active • {pendingCount} pending review
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <div className="relative w-64 sm:w-72">
                <input
                  type="text"
                  placeholder="Search name, company, email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-3.5 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
                />
              </div>

              <button
                onClick={loadData}
                disabled={loading}
                className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold shadow-2xs transition-all flex items-center gap-1.5"
                title="Refresh from Supabase"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-slate-600 ${loading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>

              <button
                onClick={() => {
                  if (newUserPlan === 'No plan' && packages.length > 0) {
                    setNewUserPlan(packages[0].name);
                  }
                  setNewUserExpires(computeExpiryIso(newUserDuration));
                  setIsCreateModalOpen(true);
                }}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-semibold shadow-xs transition-all flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>Create User</span>
              </button>
            </div>
          </div>

          {/* Users Table matching InvoicePro Admin */}
          <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600 border-collapse">
                <thead className="bg-white border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-4">CUSTOMER</th>
                    <th className="px-6 py-4">CONTACT</th>
                    <th className="px-6 py-4">LOGIN</th>
                    <th className="px-6 py-4">STATUS</th>
                    <th className="px-6 py-4">PLAN</th>
                    <th className="px-6 py-4">UTR / REF</th>
                    <th className="px-6 py-4">EXPIRES</th>
                    <th className="px-6 py-4 text-right">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-sans">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-16 text-center text-slate-400">
                        <RefreshCw className="w-5 h-5 mx-auto animate-spin text-indigo-600 mb-2" />
                        <span>Connecting to Supabase Auth directory...</span>
                      </td>
                    </tr>
                  ) : filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-16 text-center text-slate-400">
                        No users matching &ldquo;{searchQuery}&rdquo; found.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((user) => (
                      <tr key={user.id} className="hover:bg-slate-50/60 transition-colors">
                        {/* CUSTOMER */}
                        <td className="px-6 py-4.5 align-top">
                          <div className="font-bold text-slate-900 leading-snug">
                            {user.name}
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5 leading-none font-medium">
                            {user.store_name && user.store_name !== '—' ? user.store_name : (user.company || '—')}
                          </div>
                          {user.drug_license_no && (
                            <div className="text-[10px] text-slate-400 mt-1 font-mono leading-none">
                              DL: {user.drug_license_no}
                            </div>
                          )}
                        </td>

                        {/* CONTACT */}
                        <td className="px-6 py-4.5 align-top">
                          <div className="text-xs text-slate-800 leading-snug font-normal">
                            {user.email || '—'}
                          </div>
                          <div className="text-xs text-slate-400 mt-0.5 leading-none font-mono">
                            {user.phone || '—'}
                          </div>
                        </td>

                        {/* LOGIN PROVIDERS */}
                        <td className="px-6 py-4.5 align-top">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {user.login_providers?.includes('google') && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100/90 text-slate-700 text-[11px] font-medium border border-slate-200/80">
                                <span className="font-bold text-amber-500">G</span>
                                <span>Google</span>
                              </span>
                            )}
                            {user.login_providers?.includes('email') && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100/90 text-slate-700 text-[11px] font-medium border border-slate-200/80">
                                <Mail className="w-3 h-3 text-slate-500" />
                                <span>Email</span>
                              </span>
                            )}
                          </div>
                        </td>

                        {/* STATUS */}
                        <td className="px-6 py-4.5 align-top">
                          {user.status === 'Active' ? (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-emerald-100/80 text-emerald-800 text-[11px] font-bold">
                              Active
                            </span>
                          ) : user.status === 'Expired' ? (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-rose-100/80 text-rose-700 text-[11px] font-bold">
                              Expired
                            </span>
                          ) : user.status === 'Pending' ? (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-amber-100/80 text-amber-800 text-[11px] font-bold">
                              Pending
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-[11px] font-medium">
                              No plan
                            </span>
                          )}
                        </td>

                        {/* PLAN (CLICK TO CHANGE PACKAGE FOR THIS USER) */}
                        <td className="px-6 py-4.5 align-top">
                          {(user.status === 'Active' || user.status === 'Expired' || user.status === 'Pending') && user.plan ? (
                            <div className="space-y-0.5">
                              <button
                                onClick={() => openChangePackageModal(user)}
                                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-50 hover:bg-blue-100 text-blue-700 text-[11px] font-bold border border-blue-200 transition-colors"
                                title="Change Package for this user"
                              >
                                <span>{user.plan}</span>
                                <Pencil className="w-2.5 h-2.5 text-blue-600 ml-0.5" />
                              </button>
                              <div className="text-[11px] text-slate-400">
                                {user.plan_duration || '1 year'}
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => openChangePackageModal(user)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-dashed border-slate-300 hover:border-indigo-400 hover:bg-indigo-50/60 text-slate-600 hover:text-indigo-700 text-[11px] font-medium transition-all"
                            >
                              <span>+ Set Plan</span>
                            </button>
                          )}
                        </td>

                        {/* UTR / REF */}
                        <td className="px-6 py-4.5 align-top">
                          {user.utr_ref ? (
                            <div className="space-y-0.5">
                              <div className="text-xs text-slate-800 font-mono">
                                {user.utr_ref}
                              </div>
                              <div className="text-[10px] text-slate-400">
                                {user.utr_note || 'Previous payment'}
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-300 font-mono">—</span>
                          )}
                        </td>

                        {/* EXPIRES */}
                        <td className="px-6 py-4.5 align-top font-sans text-xs text-slate-700">
                          {user.expires_at || '—'}
                        </td>

                        {/* ACTIONS (VERIFY / ACTIVATE / REVOKE + DELETE USER) */}
                        <td className="px-6 py-4.5 align-top text-right">
                          <div className="inline-flex items-center gap-1.5 justify-end">
                            {user.status === 'Active' ? (
                              <button
                                onClick={() => handleRevoke(user)}
                                className="px-3 py-1 rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 font-medium text-xs transition-colors shadow-2xs"
                              >
                                Revoke
                              </button>
                            ) : user.status === 'Pending' ? (
                              <>
                                <button
                                  onClick={() => handleActivate(user)}
                                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-semibold text-xs shadow-xs transition-all"
                                  title="Verify UPI UTR & Activate Subscription"
                                >
                                  Verify &amp; Activate
                                </button>
                                <button
                                  onClick={() => handleRejectPending(user)}
                                  className="px-2.5 py-1.5 rounded-lg border border-rose-200 hover:bg-rose-50 text-rose-600 font-semibold text-xs transition-colors"
                                  title="Reject Payment"
                                >
                                  Reject
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => handleActivate(user)}
                                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-semibold text-xs shadow-xs transition-all"
                              >
                                Activate
                              </button>
                            )}

                            <button
                              onClick={() => handleDeleteUser(user)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                              title="Delete User from Supabase"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>

      {/* Modal 1: Change Package for Particular User */}
      {selectedUserForPlan && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-5 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Change Package
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Update subscription plan for <span className="font-semibold text-slate-800">{selectedUserForPlan.name}</span>
                </p>
              </div>
              <button
                onClick={() => setSelectedUserForPlan(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePackageChange} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-700">Assign Package *</label>
                <select
                  value={planTier}
                  onChange={(e) => setPlanTier(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="No plan">No plan (Inactive)</option>
                  {packages.map((pkg) => (
                    <option key={pkg.id} value={pkg.name}>
                      {pkg.name} (₹{pkg.monthlyPrice ? Number(pkg.monthlyPrice).toLocaleString('en-IN') : '0'}/mo)
                    </option>
                  ))}
                  {planTier !== 'No plan' && !packages.some((p) => p.name === planTier) && (
                    <option value={planTier}>{planTier}</option>
                  )}
                </select>
              </div>

              {planTier !== 'No plan' && (
                <>
                  <div className="space-y-1.5">
                    <label className="font-semibold text-slate-700">Billing Duration *</label>
                    <select
                      value={planDuration}
                      onChange={(e) => {
                        const nextDur = e.target.value;
                        setPlanDuration(nextDur);
                        setExpiresAt(computeExpiryIso(nextDur));
                      }}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="1 month">1 Month</option>
                      <option value="3 months">3 Months</option>
                      <option value="6 months">6 Months</option>
                      <option value="1 year">1 Year (Annual)</option>
                      <option value="Lifetime">Lifetime Unlimited</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="font-semibold text-slate-700">Expiration Date *</label>
                      <span className="text-[11px] font-mono text-indigo-600 font-semibold">
                        {formatDisplayExpiry(expiresAt)}
                      </span>
                    </div>
                    <input
                      type="date"
                      value={toIsoDateValue(expiresAt)}
                      onChange={(e) => setExpiresAt(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-semibold text-slate-700">UTR / Payment Reference</label>
                    <input
                      type="text"
                      value={utrRef}
                      onChange={(e) => setUtrRef(e.target.value)}
                      placeholder="e.g. UTR-982104 or UPI Ref"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-mono focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-semibold text-slate-700">Reference Note</label>
                    <input
                      type="text"
                      value={utrNote}
                      onChange={(e) => setUtrNote(e.target.value)}
                      placeholder="e.g. Previous payment, Bank Transfer"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </>
              )}

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedUserForPlan(null)}
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
                  <span>{isSubmitting ? 'Saving to Supabase...' : 'Save Package'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Create Brand New User */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-5 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Create New User
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Register new account in Supabase with assigned commercial package.
                </p>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="font-semibold text-slate-700">Customer Name *</label>
                  <input
                    type="text"
                    value={newUserName}
                    onChange={(e) => setNewUserName(e.target.value)}
                    placeholder="e.g. Suresh Verma"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-semibold text-slate-700">Company / Store Name</label>
                  <input
                    type="text"
                    value={newUserCompany}
                    onChange={(e) => setNewUserCompany(e.target.value)}
                    placeholder="e.g. Apex Health Pharmacy"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="font-semibold text-slate-700">Email Address *</label>
                  <input
                    type="email"
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                    placeholder="e.g. suresh@pharmacy.in"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-semibold text-slate-700">Mobile Number</label>
                  <input
                    type="text"
                    value={newUserPhone}
                    onChange={(e) => setNewUserPhone(e.target.value)}
                    placeholder="e.g. 9820144552"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-mono focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-slate-700">Terminal Password / PIN *</label>
                <input
                  type="password"
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  placeholder="Password (min 6 chars)"
                  minLength={6}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-mono focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="font-semibold text-slate-700">Initial Package / Plan *</label>
                  <select
                    value={newUserPlan}
                    onChange={(e) => setNewUserPlan(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="No plan">No plan (Inactive)</option>
                    {packages.map((pkg) => (
                      <option key={pkg.id} value={pkg.name}>
                        {pkg.name} (₹{pkg.monthlyPrice ? Number(pkg.monthlyPrice).toLocaleString('en-IN') : '0'}/mo)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="font-semibold text-slate-700">Billing Duration</label>
                  <select
                    value={newUserDuration}
                    onChange={(e) => {
                      const nextDur = e.target.value;
                      setNewUserDuration(nextDur);
                      setNewUserExpires(computeExpiryIso(nextDur));
                    }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="1 month">1 Month</option>
                    <option value="3 months">3 Months</option>
                    <option value="6 months">6 Months</option>
                    <option value="1 year">1 Year (Annual)</option>
                    <option value="Lifetime">Lifetime Unlimited</option>
                  </select>
                </div>
              </div>

              {newUserPlan !== 'No plan' && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="font-semibold text-slate-700">Expiration Date *</label>
                    <span className="text-[11px] font-mono text-indigo-600 font-semibold">
                      {formatDisplayExpiry(newUserExpires)}
                    </span>
                  </div>
                  <input
                    type="date"
                    value={toIsoDateValue(newUserExpires)}
                    onChange={(e) => setNewUserExpires(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <label className="font-semibold text-slate-700">Payment Reference / UTR (Optional)</label>
                <input
                  type="text"
                  value={newUserUtr}
                  onChange={(e) => setNewUserUtr(e.target.value)}
                  placeholder="e.g. UTR-202688"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-mono focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="googleAuth"
                  checked={newUserGoogle}
                  onChange={(e) => setNewUserGoogle(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="googleAuth" className="text-slate-700 font-medium">
                  Add Google Login Provider badge
                </label>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
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
                  <span>{isSubmitting ? 'Creating in Supabase...' : 'Create User'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
