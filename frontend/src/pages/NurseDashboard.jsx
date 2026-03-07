import { useState, useEffect, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    HeartPulse, Users, ClipboardList, AlertTriangle, Thermometer,
    Zap, Syringe, FlaskConical, Bed, Activity, Radio, Clock,
    TrendingUp, Shield, CheckCircle, Bell, ChevronRight, ArrowUp,
    LogOut, UserPlus, Building2, BedDouble, Pill
} from 'lucide-react';
import axios from 'axios';
import { exportNursePDF } from '../utils/pdfExport';

// ─── PROJECT BANNER ────────────────────────────────────────
const NurseBanner = memo(function NurseBanner({ user, data }) {
    const [time, setTime] = useState(new Date());

    useEffect(() => {
        const interval = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(interval);
    }, []);

    const formatDate = (d) =>
        d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    const formatTime = (d) =>
        d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    const shiftEnd = new Date();
    shiftEnd.setHours(19, 0, 0, 0);
    const shiftRemaining = Math.max(0, Math.round((shiftEnd - time) / 60000));
    const shiftHrs = Math.floor(shiftRemaining / 60);
    const shiftMins = shiftRemaining % 60;

    const wardOccupancy = data?.ward_info?.capacity 
        ? Math.round((data.ward_info.current_patients / data.ward_info.capacity) * 100)
        : 0;

    return (
        <div
            className="rounded-2xl overflow-hidden mb-7"
            style={{
                background: 'linear-gradient(145deg, #042F2E 0%, #0A4A44 40%, #0F766E 100%)',
                boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
            }}
        >
            {/* Hero */}
            <div style={{ padding: '48px 48px 40px 48px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    {/* Left */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20 }}>
                        <div
                            style={{
                                width: 66,
                                height: 66,
                                borderRadius: 18,
                                background: 'rgba(255,255,255,0.07)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                                marginTop: 4,
                            }}
                        >
                            <HeartPulse size={32} color="#6EE7B7" />
                        </div>

                        <div>
                            <p style={{
                                fontFamily: "'Outfit', sans-serif",
                                fontSize: 12,
                                fontWeight: 600,
                                letterSpacing: '0.18em',
                                textTransform: 'uppercase',
                                color: 'rgba(153,246,228,0.35)',
                                marginBottom: 12,
                            }}>
                                Clinical Task Execution Engine
                            </p>
                            <h1 style={{
                                fontFamily: "'Outfit', sans-serif",
                                fontSize: 38,
                                fontWeight: 800,
                                color: '#FFFFFF',
                                letterSpacing: '-0.03em',
                                lineHeight: 1.12,
                                margin: 0,
                            }}>
                                Hello, {user?.name || 'Nurse'}
                                <br />
                                <span style={{ fontSize: 28, fontWeight: 600, opacity: 0.85 }}>Command Center</span>
                            </h1>
                            <p style={{
                                fontFamily: "'Inter', sans-serif",
                                fontSize: 14,
                                fontWeight: 400,
                                color: 'rgba(153,246,228,0.38)',
                                marginTop: 14,
                                lineHeight: 1.6,
                                maxWidth: 420,
                            }}>
                                {data?.ward || 'General'} Department • {data?.assigned_ward ? `Ward ${data.assigned_ward}` : 'Unassigned'} • {data?.assigned_shift || 'Day'} Shift
                            </p>
                        </div>
                    </div>

                    {/* Right */}
                    <div style={{ textAlign: 'right', flexShrink: 0, paddingTop: 6 }}>
                        <p style={{
                            fontFamily: "'Outfit', sans-serif",
                            fontSize: 13,
                            fontWeight: 500,
                            color: 'rgba(153,246,228,0.3)',
                            marginBottom: 6,
                        }}>
                            {formatDate(time)}
                        </p>
                        <p style={{
                            fontFamily: "'Outfit', sans-serif",
                            fontSize: 46,
                            fontWeight: 700,
                            color: '#FFFFFF',
                            fontVariantNumeric: 'tabular-nums',
                            letterSpacing: '-0.01em',
                            lineHeight: 1,
                        }}>
                            {formatTime(time)}
                        </p>
                        <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 8,
                            marginTop: 14,
                            padding: '6px 16px',
                            borderRadius: 10,
                            background: 'rgba(16,185,129,0.1)',
                            border: '1px solid rgba(16,185,129,0.12)',
                        }}>
                            <Radio size={13} color="#34D399" />
                            <span style={{
                                fontFamily: "'Outfit', sans-serif",
                                fontSize: 11,
                                fontWeight: 700,
                                color: '#6EE7B7',
                                textTransform: 'uppercase',
                                letterSpacing: '0.12em',
                            }}>
                                Shift Active
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Metrics Bar */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                padding: '16px 48px',
                background: 'rgba(0,0,0,0.18)',
                borderTop: '1px solid rgba(255,255,255,0.04)',
                flexWrap: 'wrap',
                gap: '16px',
            }}>
                {[
                    { label: 'Active Patients', value: data?.total_patients || 0 },
                    { label: 'Pending Admissions', value: data?.pending_admissions?.length || 0, alert: (data?.pending_admissions?.length || 0) > 0 },
                    { label: 'Vitals Recorded', value: data?.vitals_recorded || 0 },
                    { label: 'Ward Occupancy', value: `${wardOccupancy}%` },
                    { label: 'Active Cases', value: data?.active_cases?.length || 0 },
                    { label: 'Shift Remaining', value: `${shiftHrs}h ${shiftMins}m` },
                ].map((m, i, arr) => (
                    <div
                        key={m.label}
                        style={{
                            flex: '1 1 auto',
                            minWidth: '120px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            ...(i < arr.length - 1 ? {
                                borderRight: '1px solid rgba(255,255,255,0.06)',
                                paddingRight: 20,
                            } : {}),
                        }}
                    >
                        <span style={{
                            fontFamily: "'Inter', sans-serif",
                            fontSize: 12,
                            fontWeight: 500,
                            color: 'rgba(153,246,228,0.35)',
                        }}>
                            {m.label}
                        </span>
                        <span style={{
                            fontFamily: "'Outfit', sans-serif",
                            fontSize: 15,
                            fontWeight: 700,
                            color: m.alert ? '#F87171' : '#FFFFFF',
                        }}>
                            {m.value}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
});

// ─── SEVERITY COLORS ────────────────────────────────────────
const SEV_COLOR = { Critical: '#DC2626', High: '#D97706', Medium: '#0284C7', Low: '#10B981' };

// ─── MAIN DASHBOARD ─────────────────────────────────────────
export default function NurseDashboard() {
    const user = JSON.parse(sessionStorage.getItem('zi_user') || '{}');
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    const fetchDashboard = async () => {
        try {
            const params = new URLSearchParams();
            if (user.department) params.set('department', user.department);
            if (user.email) params.set('nurse_email', user.email);
            const res = await axios.get(`/api/nurse/dashboard?${params}`);
            setData(res.data);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    useEffect(() => { 
        fetchDashboard(); 
        const iv = setInterval(fetchDashboard, 30000);
        return () => clearInterval(iv);
    }, []);

    const admitPatient = async (admissionId) => {
        try {
            await axios.put(`/api/ward/admit/${admissionId}?nurse_email=${encodeURIComponent(user.email || '')}`);
            fetchDashboard();
        } catch (err) { console.error(err); }
    };

    const dischargePatient = async (admissionId) => {
        if (!confirm('Discharge this patient?')) return;
        try {
            await axios.put(`/api/ward/discharge/${admissionId}`);
            fetchDashboard();
        } catch (err) { console.error(err); }
    };

    if (loading) return (
        <div className="min-h-screen text-text-primary pb-24">
            {/* Skeleton Banner */}
            <div className="rounded-2xl overflow-hidden mb-7 bg-gradient-to-br from-teal-900 to-teal-700 animate-pulse">
                <div className="p-12">
                    <div className="flex justify-between">
                        <div className="space-y-3">
                            <div className="h-4 w-48 bg-white/10 rounded" />
                            <div className="h-10 w-64 bg-white/20 rounded" />
                            <div className="h-6 w-40 bg-white/10 rounded" />
                        </div>
                        <div className="text-right space-y-2">
                            <div className="h-4 w-32 bg-white/10 rounded ml-auto" />
                            <div className="h-12 w-40 bg-white/20 rounded ml-auto" />
                        </div>
                    </div>
                </div>
                <div className="p-4 bg-black/20 flex gap-8">
                    {[1,2,3,4,5,6].map(i => <div key={i} className="h-5 w-24 bg-white/10 rounded" />)}
                </div>
            </div>
            {/* Skeleton Grid */}
            <div className="grid grid-cols-12 gap-4">
                <div className="col-span-12 xl:col-span-6 space-y-4">
                    {[1,2].map(i => (
                        <div key={i} className="bg-white rounded-2xl border p-4 animate-pulse">
                            <div className="h-4 w-40 bg-gray-200 rounded mb-4" />
                            <div className="space-y-3">
                                {[1,2,3].map(j => <div key={j} className="h-16 bg-gray-100 rounded-xl" />)}
                            </div>
                        </div>
                    ))}
                </div>
                <div className="col-span-12 xl:col-span-4 space-y-4">
                    <div className="bg-white rounded-2xl border p-5 animate-pulse">
                        <div className="h-4 w-32 bg-gray-200 rounded mb-4" />
                        <div className="h-3 bg-gray-100 rounded-full mb-4" />
                        <div className="h-20 bg-gray-50 rounded-xl" />
                    </div>
                    <div className="bg-white rounded-2xl border p-4 animate-pulse">
                        <div className="h-4 w-36 bg-gray-200 rounded mb-3" />
                        {[1,2,3].map(i => <div key={i} className="h-12 bg-gray-100 rounded-lg mb-2" />)}
                    </div>
                </div>
                <div className="col-span-12 xl:col-span-2 space-y-4">
                    <div className="bg-white rounded-2xl border p-4 animate-pulse">
                        <div className="h-4 w-24 bg-gray-200 rounded mb-3" />
                        {[1,2,3].map(i => <div key={i} className="h-10 bg-gray-100 rounded mb-2" />)}
                    </div>
                </div>
            </div>
        </div>
    );

    if (!data) return (
        <div className="flex items-center justify-center h-96 text-text-muted">
            Failed to load dashboard data
        </div>
    );

    return (
        <div className="min-h-screen text-text-primary pb-24">
            {/* 1. PROJECT BANNER */}
            <NurseBanner user={user} data={data} />

            {/* PDF Download */}
            <div className="flex justify-end mb-4">
                <button onClick={() => exportNursePDF({ user, data })}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-700 text-white text-sm font-medium hover:bg-teal-800 transition cursor-pointer shadow-sm">
                    <ClipboardList size={15} /> Download Shift Report PDF
                </button>
            </div>

            {/* 2. MAIN GRID */}
            <div className="grid grid-cols-12 gap-4">
                {/* LEFT: Pending Admissions + Admitted (6 cols) */}
                <div className="col-span-12 xl:col-span-6 space-y-4">
                    <PendingAdmissionsPanel 
                        admissions={data.pending_admissions || []} 
                        onAdmit={admitPatient} 
                    />
                    <AdmittedPatientsPanel 
                        patients={data.admitted_patients || []} 
                        onDischarge={dischargePatient} 
                    />
                </div>

                {/* CENTER: Ward Info + Medications (4 cols) */}
                <div className="col-span-12 xl:col-span-4 space-y-4">
                    <WardCapacityPanel wardInfo={data.ward_info} />
                    <MedicationSchedulePanel medications={data.medication_schedule || []} />
                </div>

                {/* RIGHT: Active Cases + Quick Stats (2 cols) */}
                <div className="col-span-12 xl:col-span-2 space-y-4">
                    <QuickStatsPanel data={data} />
                    <ActiveCasesPanel cases={data.active_cases || []} />
                </div>
            </div>

            {/* 3. BOTTOM: Shift Summary */}
            <ShiftSummary data={data} />
        </div>
    );
}

// ─── PENDING ADMISSIONS PANEL ───────────────────────────────
function PendingAdmissionsPanel({ admissions, onAdmit }) {
    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-amber-50/30">
                <div className="flex items-center gap-2">
                    <UserPlus size={15} className="text-amber-500" />
                    <p className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                        Pending Admissions ({admissions.length})
                    </p>
                </div>
                {admissions.length > 0 && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-600 flex items-center gap-1">
                        <Bell size={9} /> Action Required
                    </span>
                )}
            </div>
            <div className="max-h-[280px] overflow-y-auto p-3 space-y-2">
                {admissions.length === 0 ? (
                    <p className="text-xs text-text-muted text-center py-8">No pending admissions</p>
                ) : (
                    admissions.map((a, i) => (
                        <motion.div 
                            key={a.id} 
                            initial={{ opacity: 0, x: -10 }} 
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.05 }}
                            className="flex items-center justify-between p-3 rounded-xl bg-amber-50 border border-amber-200/50 group hover:shadow-sm transition-all"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 font-bold text-xs">
                                    {a.patient_name?.charAt(0) || '?'}
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-amber-800">{a.patient_name}</p>
                                    <p className="text-[10px] text-amber-600">
                                        {a.ward_id && <span className="font-semibold mr-1">{a.ward_id} •</span>}
                                        Assigned by {a.assigned_by_doctor || 'Doctor'} • {a.ward_type}
                                    </p>
                                </div>
                            </div>
                            <button 
                                onClick={() => onAdmit(a.id)}
                                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 text-white text-[10px] font-bold cursor-pointer hover:bg-emerald-700 transition-colors shadow-sm"
                            >
                                <CheckCircle size={12} /> Admit
                            </button>
                        </motion.div>
                    ))
                )}
            </div>
        </div>
    );
}

// ─── ADMITTED PATIENTS PANEL ────────────────────────────────
function AdmittedPatientsPanel({ patients, onDischarge }) {
    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-emerald-50/30">
                <div className="flex items-center gap-2">
                    <BedDouble size={15} className="text-emerald-500" />
                    <p className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                        Admitted Patients ({patients.length})
                    </p>
                </div>
            </div>
            <div className="max-h-[280px] overflow-y-auto p-3 space-y-2">
                {patients.length === 0 ? (
                    <p className="text-xs text-text-muted text-center py-8">No admitted patients</p>
                ) : (
                    patients.map((a, i) => (
                        <motion.div 
                            key={a.id} 
                            initial={{ opacity: 0, x: -10 }} 
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.05 }}
                            className="flex items-center justify-between p-3 rounded-xl bg-emerald-50 border border-emerald-200/50 group hover:shadow-sm transition-all"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 font-bold text-xs">
                                    {a.patient_name?.charAt(0) || '?'}
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-emerald-800">{a.patient_name}</p>
                                    <p className="text-[10px] text-emerald-600">
                                        {a.ward_id && <span className="mr-2 font-semibold">{a.ward_id}</span>}
                                        Admitted {a.admitted_at ? new Date(a.admitted_at).toLocaleString() : '—'}
                                    </p>
                                </div>
                            </div>
                            <button 
                                onClick={() => onDischarge(a.id)}
                                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-500 text-white text-[10px] font-bold cursor-pointer hover:bg-red-600 transition-colors shadow-sm"
                            >
                                <LogOut size={12} /> Discharge
                            </button>
                        </motion.div>
                    ))
                )}
            </div>
        </div>
    );
}

// ─── WARD CAPACITY PANEL ────────────────────────────────────
function WardCapacityPanel({ wardInfo }) {
    if (!wardInfo) return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-5">
            <div className="flex items-center gap-2 mb-4">
                <Bed size={15} className="text-teal-600" />
                <p className="text-xs font-bold uppercase tracking-wider text-text-secondary">Ward Capacity</p>
            </div>
            <p className="text-xs text-text-muted text-center py-4">No ward assigned</p>
        </div>
    );

    const occupancyPct = wardInfo.capacity ? Math.round((wardInfo.current_patients / wardInfo.capacity) * 100) : 0;
    const occupancyColor = occupancyPct > 85 ? '#DC2626' : occupancyPct > 65 ? '#D97706' : '#10B981';

    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-5">
            <div className="flex items-center gap-2 mb-4">
                <Bed size={15} className="text-teal-600" />
                <p className="text-xs font-bold uppercase tracking-wider text-text-secondary">
                    Ward {wardInfo.ward_id} Capacity
                </p>
                <span className={`ml-auto px-2 py-0.5 rounded-md text-[10px] font-bold
                    ${wardInfo.type === 'ICU' ? 'bg-red-100 text-red-700' :
                        wardInfo.type === 'Private' ? 'bg-purple-100 text-purple-700' :
                            'bg-blue-100 text-blue-700'}`}>
                    {wardInfo.type}
                </span>
            </div>
            
            {/* Occupancy Gauge */}
            <div className="mb-4">
                <div className="flex justify-between items-center mb-2">
                    <span className="text-[10px] uppercase tracking-wider font-semibold text-text-muted">Bed Occupancy</span>
                    <span className="text-lg font-bold" style={{ color: occupancyColor }}>{occupancyPct}%</span>
                </div>
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                    <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${occupancyPct}%` }}
                        transition={{ duration: 1, ease: "easeOut" }}
                        className="h-full rounded-full"
                        style={{ background: occupancyColor }}
                    />
                </div>
                <div className="flex justify-between mt-2">
                    <span className="text-[10px] text-text-muted">{wardInfo.current_patients} occupied</span>
                    <span className="text-[10px] text-text-muted">{wardInfo.capacity - wardInfo.current_patients} available</span>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-[9px] uppercase tracking-wider text-text-muted font-semibold">Total Beds</p>
                    <p className="text-xl font-bold text-text-primary mt-1">{wardInfo.capacity}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-[9px] uppercase tracking-wider text-text-muted font-semibold">Patients</p>
                    <p className="text-xl font-bold text-text-primary mt-1">{wardInfo.current_patients}</p>
                </div>
            </div>
        </div>
    );
}

// ─── MEDICATION SCHEDULE PANEL ──────────────────────────────
function MedicationSchedulePanel({ medications }) {
    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex items-center gap-2 bg-emerald-50/30">
                <Pill size={15} className="text-emerald-500" />
                <p className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                    Medication Schedule ({medications.length})
                </p>
            </div>
            <div className="max-h-[320px] overflow-y-auto p-3 space-y-2">
                {medications.length === 0 ? (
                    <p className="text-xs text-text-muted text-center py-8">No active medications</p>
                ) : (
                    medications.map((m, i) => (
                        <motion.div 
                            key={m.id}
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.03 }}
                            className="p-3 rounded-xl bg-emerald-50/50 border border-emerald-100"
                        >
                            <div className="flex items-start gap-2">
                                <Syringe size={14} className="text-emerald-600 mt-0.5 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-bold text-emerald-800 truncate">
                                        💊 {m.medication} — {m.dosage}
                                    </p>
                                    <p className="text-[10px] text-emerald-600 mt-0.5">
                                        {m.patient_name} • {m.frequency}
                                    </p>
                                </div>
                            </div>
                        </motion.div>
                    ))
                )}
            </div>
        </div>
    );
}

// ─── QUICK STATS PANEL ──────────────────────────────────────
function QuickStatsPanel({ data }) {
    const stats = [
        { icon: Building2, label: 'Department', value: data.ward || '—', color: '#8B5CF6' },
        { icon: Activity, label: 'Vitals Done', value: data.vitals_recorded || 0, color: '#10B981' },
        { icon: Users, label: 'Patients', value: data.total_patients || 0, color: '#3B82F6' },
    ];

    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-4">
            <div className="flex items-center gap-1.5 mb-3">
                <TrendingUp size={13} className="text-primary" />
                <p className="text-[10px] font-bold uppercase tracking-wider text-text-secondary">Quick Stats</p>
            </div>
            <div className="space-y-3">
                {stats.map((s) => (
                    <div key={s.label} className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: s.color + '15' }}>
                            <s.icon size={14} style={{ color: s.color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-[9px] text-text-muted uppercase font-semibold truncate">{s.label}</p>
                            <p className="text-sm font-bold text-text-primary truncate">{s.value}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─── ACTIVE CASES PANEL ─────────────────────────────────────
function ActiveCasesPanel({ cases }) {
    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden flex-1">
            <div className="p-3 border-b border-gray-100 flex items-center gap-1.5">
                <AlertTriangle size={13} className="text-amber-500" />
                <p className="text-[10px] font-bold uppercase tracking-wider text-text-secondary">Active Cases</p>
            </div>
            <div className="max-h-[220px] overflow-y-auto p-2 space-y-1.5">
                {cases.length === 0 ? (
                    <p className="text-[10px] text-text-muted text-center py-4">No active cases</p>
                ) : (
                    cases.slice(0, 8).map((c, i) => (
                        <div 
                            key={c.id}
                            className="p-2 rounded-lg border-l-2 bg-gray-50/50"
                            style={{ borderColor: SEV_COLOR[c.severity] || '#94A3B8' }}
                        >
                            <p className="text-[10px] font-semibold text-text-primary truncate">#{c.id?.slice(-6)}</p>
                            <p className="text-[9px] text-text-muted truncate">{c.department}</p>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

// ─── SHIFT SUMMARY ──────────────────────────────────────────
function ShiftSummary({ data }) {
    return (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] mt-4">
            <div className="flex items-center gap-2 mb-4">
                <Clock size={16} className="text-primary" />
                <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider">Shift Performance Summary</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
                <ShiftMetric label="Active Patients" value={data.total_patients || 0} />
                <ShiftMetric label="Vitals Recorded" value={data.vitals_recorded || 0} />
                <ShiftMetric label="Pending Actions" value={data.pending_admissions?.length || 0} />
                <ShiftMetric label="Medications Due" value={data.medication_schedule?.length || 0} />
                <ShiftMetric label="Department" value={data.ward || 'General'} isText />
            </div>
        </div>
    );
}

function ShiftMetric({ label, value, isText }) {
    return (
        <div>
            <p className="text-[9px] text-text-muted uppercase tracking-wider font-semibold mb-1">{label}</p>
            <p className={`font-bold text-text-primary ${isText ? 'text-sm' : 'text-xl'}`} style={{ fontFamily: "'Outfit', sans-serif" }}>
                {value}
            </p>
        </div>
    );
}
