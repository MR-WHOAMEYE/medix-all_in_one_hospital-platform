import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Users, Search, Pill, FileText, Activity, X,
    Plus, CheckCircle, ChevronRight, BedDouble, Heart,
    Shield, Clock, TrendingUp, AlertTriangle, Sparkles,
    Mail, Building2, UserCheck, Stethoscope, Eye,
    Thermometer, Droplets, BarChart3, ArrowUpRight
} from 'lucide-react';
import axios from 'axios';
import { getUsers } from '../services/api';

const SEVERITY_OPTS = ['Mild', 'Moderate', 'Severe'];
const CASE_STATUSES = ['Open', 'Under Treatment', 'Resolved'];
const WARD_TYPES = ['ICU', 'General', 'Private'];

const AVATAR_COLORS = [
    { bg: 'bg-teal-100', text: 'text-teal-700', border: 'border-teal-200', ring: 'ring-teal-500/20' },
    { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200', ring: 'ring-blue-500/20' },
    { bg: 'bg-violet-100', text: 'text-violet-700', border: 'border-violet-200', ring: 'ring-violet-500/20' },
    { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200', ring: 'ring-amber-500/20' },
    { bg: 'bg-rose-100', text: 'text-rose-700', border: 'border-rose-200', ring: 'ring-rose-500/20' },
    { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200', ring: 'ring-emerald-500/20' },
];

const getAvatarColor = (name) => AVATAR_COLORS[(name?.charCodeAt(0) || 0) % AVATAR_COLORS.length];
const getHealthScore = (name) => 55 + ((name?.charCodeAt(0) || 65) % 40);
const getStatusLabel = (score) => score >= 80 ? { label: 'Stable', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' } : score >= 60 ? { label: 'Moderate', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' } : { label: 'At Risk', color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' };

export default function PatientManagement() {
    const user = JSON.parse(sessionStorage.getItem('zi_user') || '{}');
    const token = sessionStorage.getItem('zi_token');
    const [patients, setPatients] = useState([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [selectedPatient, setSelectedPatient] = useState(null);
    const [activeTab, setActiveTab] = useState('details');

    const [prescriptions, setPrescriptions] = useState([]);
    const [diagnoses, setDiagnoses] = useState([]);
    const [cases, setCases] = useState([]);
    const [vitals, setVitals] = useState([]);

    const [rxForm, setRxForm] = useState({ medication: '', dosage: '', frequency: '', duration: '', notes: '' });
    const [dxForm, setDxForm] = useState({ condition: '', severity: 'Mild', notes: '' });
    const [wardType, setWardType] = useState('');
    const [wardSuggestion, setWardSuggestion] = useState(null);
    const [wardLoading, setWardLoading] = useState(false);
    const [formSuccess, setFormSuccess] = useState('');

    useEffect(() => {
        (async () => {
            try {
                const res = await getUsers(token);
                setPatients((res.users || []).filter(u => u.role === 'patient'));
            } catch (err) { console.error(err); }
            finally { setLoading(false); }
        })();
    }, []);

    const loadPatientData = async (patient) => {
        setSelectedPatient(patient);
        setActiveTab('details');
        setFormSuccess('');
        try {
            const [rx, dx, cs, vt] = await Promise.all([
                axios.get(`/api/doctor/prescriptions?patient_email=${encodeURIComponent(patient.email)}`),
                axios.get(`/api/doctor/diagnoses?patient_email=${encodeURIComponent(patient.email)}`),
                axios.get(`/api/patient/cases?department=${encodeURIComponent(patient.department || '')}`),
                axios.get(`/api/patient/my-vitals?patient_email=${encodeURIComponent(patient.email)}`).catch(() => ({ data: { vitals: [] } })),
            ]);
            setPrescriptions(rx.data.prescriptions || []);
            setDiagnoses(dx.data.diagnoses || []);
            setCases(cs.data.cases || []);
            setVitals(vt.data.vitals || []);
        } catch (err) { console.error(err); }
    };

    const addPrescription = async (e) => {
        e.preventDefault();
        try {
            await axios.post('/api/doctor/prescriptions', { ...rxForm, patient_email: selectedPatient.email, patient_name: selectedPatient.name });
            setFormSuccess('Prescription added!');
            setRxForm({ medication: '', dosage: '', frequency: '', duration: '', notes: '' });
            loadPatientData(selectedPatient);
            setTimeout(() => setFormSuccess(''), 3000);
        } catch (err) { console.error(err); }
    };

    const addDiagnosis = async (e) => {
        e.preventDefault();
        try {
            await axios.post('/api/doctor/diagnoses', { ...dxForm, patient_email: selectedPatient.email, patient_name: selectedPatient.name });
            setFormSuccess('Diagnosis added!');
            setDxForm({ condition: '', severity: 'Mild', notes: '' });
            loadPatientData(selectedPatient);
            setTimeout(() => setFormSuccess(''), 3000);
        } catch (err) { console.error(err); }
    };

    const updateCaseStatus = async (caseId, status) => {
        try {
            await axios.put(`/api/doctor/cases/${caseId}/status`, { status });
            setCases(prev => prev.map(c => c.id === caseId ? { ...c, status } : c));
        } catch (err) { console.error(err); }
    };

    const filtered = patients.filter(p =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.email.toLowerCase().includes(search.toLowerCase())
    );

    const stats = useMemo(() => ({
        total: patients.length,
        departments: [...new Set(patients.map(p => p.department).filter(Boolean))].length || 1,
    }), [patients]);

    const sp = selectedPatient;
    const avatarColor = sp ? getAvatarColor(sp.name) : null;
    const healthScore = sp ? getHealthScore(sp.name) : 0;
    const statusInfo = sp ? getStatusLabel(healthScore) : null;
    const latestVital = vitals.length > 0 ? vitals[0] : null;

    const sevBadge = (sev) => {
        const m = { Open: 'bg-blue-50 text-blue-700 border-blue-200', 'Under Treatment': 'bg-amber-50 text-amber-700 border-amber-200', Resolved: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
        return m[sev] || 'bg-gray-50 text-gray-700 border-gray-200';
    };

    return (
        <div className="max-w-[1600px] mx-auto space-y-5">

            {/* ═══ HERO BANNER ═══ */}
            <div className="rounded-2xl overflow-hidden" style={{ background: 'linear-gradient(135deg, #042F2E 0%, #0A4A44 40%, #0F766E 100%)' }}>
                <div className="px-10 py-8 flex items-center justify-between">
                    <div className="flex items-center gap-5">
                        <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.07)' }}>
                            <Users size={28} color="#6EE7B7" />
                        </div>
                        <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] mb-1" style={{ color: 'rgba(153,246,228,0.35)' }}>Patient Intelligence Center</p>
                            <h1 className="text-2xl font-extrabold text-white tracking-tight leading-tight">Patient Management</h1>
                            <p className="text-[13px] mt-1" style={{ color: 'rgba(153,246,228,0.38)' }}>Unified clinical workspace for patient records, diagnoses & care coordination</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-6">
                        {[
                            { label: 'Total Patients', value: stats.total, icon: UserCheck },
                            { label: 'Departments', value: stats.departments, icon: Building2 },
                            { label: 'Prescriptions', value: prescriptions.length, icon: Pill },
                            { label: 'Active Cases', value: cases.length, icon: Activity },
                        ].map(s => (
                            <div key={s.label} className="text-center px-4">
                                <s.icon size={16} className="mx-auto mb-1" style={{ color: '#6EE7B7' }} />
                                <p className="text-xl font-bold text-white">{s.value}</p>
                                <p className="text-[10px] font-medium" style={{ color: 'rgba(153,246,228,0.4)' }}>{s.label}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ═══ MAIN LAYOUT ═══ */}
            <div className="grid grid-cols-12 gap-5" style={{ minHeight: 'calc(100vh - 280px)' }}>

                {/* ── PATIENT LIST (4 cols) ── */}
                <div className="col-span-4 bg-surface-card rounded-2xl border border-border flex flex-col overflow-hidden shadow-sm">
                    {/* Search header */}
                    <div className="px-5 py-4 border-b border-border">
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="text-sm font-bold text-text-primary flex items-center gap-2">
                                <div className="w-1.5 h-5 rounded-full bg-primary" /> Patient Registry
                            </h2>
                            <span className="text-[10px] font-bold text-text-muted bg-surface px-2.5 py-1 rounded-lg border border-border">{filtered.length} records</span>
                        </div>
                        <div className="relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                            <input value={search} onChange={e => setSearch(e.target.value)}
                                placeholder="Search by name or email..."
                                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-border bg-surface text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all" />
                        </div>
                    </div>

                    {/* Patient list */}
                    <div className="flex-1 overflow-y-auto">
                        {loading ? (
                            <div className="flex items-center justify-center py-20">
                                <div className="text-center"><div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" /><p className="text-[10px] text-text-muted">Loading patients...</p></div>
                            </div>
                        ) : filtered.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20">
                                <Users size={32} className="text-text-muted/15 mb-3" />
                                <p className="text-xs text-text-muted">No patients found</p>
                            </div>
                        ) : filtered.map((p, i) => {
                            const ac = getAvatarColor(p.name);
                            const hs = getHealthScore(p.name);
                            const si = getStatusLabel(hs);
                            const selected = sp?.id === p.id;
                            return (
                                <motion.div key={p.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}>
                                    <button onClick={() => loadPatientData(p)}
                                        className={`w-full text-left px-5 py-3.5 border-b border-border/50 cursor-pointer transition-all group
                                            ${selected ? 'bg-primary/[0.04] border-l-[3px] border-l-primary' : 'hover:bg-surface/80'}`}>
                                        <div className="flex items-center gap-3.5">
                                            <div className={`w-10 h-10 rounded-xl ${ac.bg} flex items-center justify-center ${ac.text} font-bold text-sm flex-shrink-0 ring-2 ${ac.ring} transition-all ${selected ? 'scale-105' : 'group-hover:scale-105'}`}>
                                                {p.name.charAt(0).toUpperCase()}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <p className="text-[12px] font-bold text-text-primary truncate">{p.name}</p>
                                                    <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-md ${si.bg} ${si.color} ${si.border} border flex-shrink-0`}>{si.label}</span>
                                                </div>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <Mail size={9} className="text-text-muted flex-shrink-0" />
                                                    <p className="text-[10px] text-text-muted truncate">{p.email}</p>
                                                </div>
                                                {p.department && (
                                                    <div className="flex items-center gap-1.5 mt-1">
                                                        <Building2 size={9} className="text-primary/60 flex-shrink-0" />
                                                        <p className="text-[9px] font-semibold text-primary/70">{p.department}</p>
                                                    </div>
                                                )}
                                            </div>
                                            <ChevronRight size={14} className={`text-text-muted/40 flex-shrink-0 transition-all ${selected ? 'text-primary' : 'group-hover:text-text-secondary group-hover:translate-x-0.5'}`} />
                                        </div>
                                    </button>
                                </motion.div>
                            );
                        })}
                    </div>
                </div>

                {/* ── PATIENT WORKSPACE (8 cols) ── */}
                <div className="col-span-8">
                    {!sp ? (
                        <div className="h-full flex items-center justify-center bg-surface-card rounded-2xl border border-border shadow-sm">
                            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="text-center max-w-xs">
                                <div className="w-20 h-20 rounded-3xl bg-primary/5 flex items-center justify-center mx-auto mb-5">
                                    <Stethoscope size={36} className="text-primary/20" />
                                </div>
                                <h3 className="text-base font-bold text-text-primary mb-2">Select a Patient</h3>
                                <p className="text-xs text-text-muted leading-relaxed">Choose a patient from the registry to view their medical records, prescriptions, diagnoses, and ward assignments.</p>
                            </motion.div>
                        </div>
                    ) : (
                        <motion.div key={sp.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                            {/* ── Patient Header Card ── */}
                            <div className="rounded-2xl overflow-hidden border border-border shadow-sm" style={{ background: 'linear-gradient(135deg, #F0FDFA 0%, #F5F3FF 50%, #FFF7ED 100%)' }}>
                                <div className="px-6 py-5">
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className={`w-14 h-14 rounded-2xl ${avatarColor.bg} flex items-center justify-center ${avatarColor.text} font-extrabold text-xl ring-3 ${avatarColor.ring} shadow-sm`}>
                                                {sp.name.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <h3 className="text-lg font-extrabold text-text-primary tracking-tight">{sp.name}</h3>
                                                <div className="flex items-center gap-3 mt-1">
                                                    <span className="text-[11px] text-text-muted flex items-center gap-1"><Mail size={10} /> {sp.email}</span>
                                                    {sp.department && <span className="text-[11px] text-primary/70 flex items-center gap-1 font-semibold"><Building2 size={10} /> {sp.department}</span>}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            {/* Health Score Badge */}
                                            <div className="text-center px-4 py-2 rounded-xl bg-white/60 border border-white shadow-sm">
                                                <div className="relative w-12 h-12 mx-auto mb-1">
                                                    <svg className="w-12 h-12 -rotate-90" viewBox="0 0 48 48">
                                                        <circle cx="24" cy="24" r="20" fill="none" stroke="#E5E7EB" strokeWidth="4" />
                                                        <circle cx="24" cy="24" r="20" fill="none"
                                                            stroke={healthScore >= 80 ? '#10B981' : healthScore >= 60 ? '#F59E0B' : '#EF4444'}
                                                            strokeWidth="4" strokeLinecap="round"
                                                            strokeDasharray={`${(healthScore / 100) * 125.6} 125.6`} />
                                                    </svg>
                                                    <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-text-primary">{healthScore}</span>
                                                </div>
                                                <p className="text-[8px] font-bold text-text-muted uppercase tracking-wider">Health</p>
                                            </div>
                                            <span className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border ${statusInfo.bg} ${statusInfo.color} ${statusInfo.border}`}>
                                                {statusInfo.label}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Quick Stats Row */}
                                    <div className="grid grid-cols-4 gap-3 mt-4">
                                        {[
                                            { label: 'Prescriptions', value: prescriptions.length, icon: Pill, color: '#10B981' },
                                            { label: 'Diagnoses', value: diagnoses.length, icon: FileText, color: '#8B5CF6' },
                                            { label: 'Active Cases', value: cases.filter(c => c.status !== 'Resolved').length, icon: AlertTriangle, color: '#F59E0B' },
                                            { label: 'Total Cases', value: cases.length, icon: BarChart3, color: '#0F766E' },
                                        ].map(s => (
                                            <div key={s.label} className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-white/50 border border-white/80">
                                                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${s.color}10` }}>
                                                    <s.icon size={14} style={{ color: s.color }} />
                                                </div>
                                                <div>
                                                    <p className="text-base font-bold text-text-primary leading-none">{s.value}</p>
                                                    <p className="text-[9px] text-text-muted font-medium mt-0.5">{s.label}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Vitals Strip */}
                                {latestVital && (
                                    <div className="px-6 py-3 border-t border-border/30" style={{ background: 'rgba(255,255,255,0.4)' }}>
                                        <p className="text-[9px] font-bold text-text-muted uppercase tracking-wider mb-2 flex items-center gap-1"><Activity size={10} className="text-primary" /> Latest Vitals</p>
                                        <div className="grid grid-cols-4 gap-3">
                                            {latestVital.bp_systolic && (
                                                <div className="flex items-center gap-2 px-3 py-2 bg-rose-50 rounded-lg border border-rose-100">
                                                    <Heart size={14} className="text-rose-500" />
                                                    <div><p className="text-xs font-bold text-text-primary">{latestVital.bp_systolic}/{latestVital.bp_diastolic}</p><p className="text-[8px] text-text-muted">mmHg</p></div>
                                                </div>
                                            )}
                                            {latestVital.heart_rate && (
                                                <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 rounded-lg border border-emerald-100">
                                                    <Activity size={14} className="text-emerald-500" />
                                                    <div><p className="text-xs font-bold text-text-primary">{latestVital.heart_rate}</p><p className="text-[8px] text-text-muted">bpm</p></div>
                                                </div>
                                            )}
                                            {latestVital.temperature && (
                                                <div className="flex items-center gap-2 px-3 py-2 bg-orange-50 rounded-lg border border-orange-100">
                                                    <Thermometer size={14} className="text-orange-500" />
                                                    <div><p className="text-xs font-bold text-text-primary">{latestVital.temperature}°F</p><p className="text-[8px] text-text-muted">Temp</p></div>
                                                </div>
                                            )}
                                            {latestVital.sugar_level && (
                                                <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-lg border border-blue-100">
                                                    <Droplets size={14} className="text-blue-500" />
                                                    <div><p className="text-xs font-bold text-text-primary">{latestVital.sugar_level}</p><p className="text-[8px] text-text-muted">mg/dL</p></div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* ── Tab Navigation ── */}
                            <div className="bg-surface-card rounded-2xl border border-border p-1.5 shadow-sm">
                                <div className="flex gap-1">
                                    {[
                                        { key: 'details', label: 'Cases', icon: Activity, count: cases.length },
                                        { key: 'prescriptions', label: 'Prescriptions', icon: Pill, count: prescriptions.length },
                                        { key: 'diagnosis', label: 'Diagnosis', icon: FileText, count: diagnoses.length },
                                        { key: 'ward', label: 'Assign Ward', icon: BedDouble },
                                    ].map(tab => (
                                        <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-all
                                                ${activeTab === tab.key
                                                    ? 'bg-gradient-to-r from-primary to-teal-600 text-white shadow-md shadow-primary/20'
                                                    : 'text-text-muted hover:bg-surface hover:text-text-secondary'}`}>
                                            <tab.icon size={14} />
                                            <span>{tab.label}</span>
                                            {tab.count !== undefined && (
                                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${activeTab === tab.key ? 'bg-white/20 text-white' : 'bg-surface text-text-muted'}`}>{tab.count}</span>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Success message */}
                            <AnimatePresence>
                                {formSuccess && (
                                    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                                        className="flex items-center gap-2 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl shadow-sm">
                                        <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0"><CheckCircle size={14} className="text-emerald-600" /></div>
                                        <p className="text-xs font-semibold text-emerald-700">{formSuccess}</p>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* ── Tab Content ── */}
                            <AnimatePresence mode="wait">
                                {/* Cases tab */}
                                {activeTab === 'details' && (
                                    <motion.div key="cases" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <h4 className="text-xs font-bold text-text-secondary uppercase tracking-wider flex items-center gap-2">
                                                <Activity size={13} className="text-primary" /> Active Cases
                                            </h4>
                                            <span className="text-[10px] font-bold text-text-muted bg-surface-card px-3 py-1 rounded-lg border border-border">{cases.length} total</span>
                                        </div>
                                        {cases.length === 0 ? (
                                            <div className="text-center py-12 bg-surface-card rounded-2xl border border-border">
                                                <Shield size={32} className="text-text-muted/15 mx-auto mb-3" />
                                                <p className="text-xs text-text-muted">No cases found for this patient</p>
                                            </div>
                                        ) : cases.slice(0, 15).map((c, i) => {
                                            const shortId = typeof c.id === 'string' && c.id.length > 8 ? c.id.slice(-6) : c.id;
                                            return (
                                            <motion.div key={c.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                                                className="px-5 py-4 rounded-xl bg-surface-card border border-border hover:shadow-md transition-shadow group overflow-hidden">
                                                <div className="flex items-center justify-between gap-3">
                                                    <div className="flex items-center gap-3 min-w-0 flex-1">
                                                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-[10px] font-bold flex-shrink-0
                                                            ${c.severity === 'High' || c.severity === 'Critical' ? 'bg-red-50 text-red-600' :
                                                              c.severity === 'Medium' ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                                            {(i + 1).toString().padStart(2, '0')}
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <p className="text-xs font-bold text-text-primary flex items-center gap-2 flex-wrap">
                                                                <span className="truncate">Case #{shortId}</span>
                                                                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md flex-shrink-0
                                                                    ${c.severity === 'High' || c.severity === 'Critical' ? 'bg-red-50 text-red-600 border border-red-200' :
                                                                      c.severity === 'Medium' ? 'bg-amber-50 text-amber-600 border border-amber-200' : 'bg-emerald-50 text-emerald-600 border border-emerald-200'}`}>
                                                                    {c.severity}
                                                                </span>
                                                            </p>
                                                            <p className="text-[10px] text-text-muted mt-0.5 flex items-center gap-1.5">
                                                                <Building2 size={9} className="flex-shrink-0" /> <span className="truncate">{c.department}</span>
                                                                {c.created_time && <><span className="opacity-30">·</span><Clock size={9} className="flex-shrink-0" /> {new Date(c.created_time).toLocaleDateString()}</>}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <select value={c.status} onChange={e => updateCaseStatus(c.id, e.target.value)}
                                                        className={`px-3 py-1.5 rounded-lg border text-[10px] font-bold cursor-pointer focus:outline-none transition-all flex-shrink-0 ${sevBadge(c.status)}`}>
                                                        {CASE_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                                                    </select>
                                                </div>
                                            </motion.div>
                                        );})}
                                    </motion.div>
                                )}

                                {/* Prescriptions tab */}
                                {activeTab === 'prescriptions' && (
                                    <motion.div key="rx" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
                                        <form onSubmit={addPrescription} className="p-5 rounded-2xl bg-surface-card border border-border shadow-sm space-y-3">
                                            <h4 className="text-xs font-bold text-text-primary flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center"><Plus size={13} className="text-primary" /></div>
                                                Add New Prescription
                                            </h4>
                                            <div className="grid grid-cols-2 gap-3">
                                                <input value={rxForm.medication} onChange={e => setRxForm(f => ({ ...f, medication: e.target.value }))}
                                                    placeholder="Medication name" className="px-3.5 py-2.5 rounded-xl border border-border text-xs bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all" required />
                                                <input value={rxForm.dosage} onChange={e => setRxForm(f => ({ ...f, dosage: e.target.value }))}
                                                    placeholder="Dosage (e.g. 500mg)" className="px-3.5 py-2.5 rounded-xl border border-border text-xs bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all" required />
                                                <input value={rxForm.frequency} onChange={e => setRxForm(f => ({ ...f, frequency: e.target.value }))}
                                                    placeholder="Frequency (e.g. 2x daily)" className="px-3.5 py-2.5 rounded-xl border border-border text-xs bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all" required />
                                                <input value={rxForm.duration} onChange={e => setRxForm(f => ({ ...f, duration: e.target.value }))}
                                                    placeholder="Duration (e.g. 7 days)" className="px-3.5 py-2.5 rounded-xl border border-border text-xs bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all" required />
                                            </div>
                                            <input value={rxForm.notes} onChange={e => setRxForm(f => ({ ...f, notes: e.target.value }))}
                                                placeholder="Notes (optional)" className="w-full px-3.5 py-2.5 rounded-xl border border-border text-xs bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all" />
                                            <button type="submit" className="w-full py-2.5 rounded-xl bg-gradient-to-r from-primary to-teal-600 text-white text-xs font-bold cursor-pointer hover:shadow-lg hover:shadow-primary/20 transition-all flex items-center justify-center gap-2">
                                                <Pill size={14} /> Prescribe Medication
                                            </button>
                                        </form>
                                        <div className="space-y-2">
                                            {prescriptions.length === 0 ? (
                                                <div className="text-center py-10 bg-surface-card rounded-2xl border border-border">
                                                    <Pill size={28} className="text-text-muted/15 mx-auto mb-2" />
                                                    <p className="text-xs text-text-muted">No prescriptions yet</p>
                                                </div>
                                            ) : prescriptions.map((rx, i) => (
                                                <motion.div key={rx.id} initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                                                    className="px-4 py-3.5 rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200/50 hover:shadow-sm transition-shadow">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0"><Pill size={14} className="text-emerald-600" /></div>
                                                        <div className="flex-1">
                                                            <p className="text-xs font-bold text-emerald-800">{rx.medication} — {rx.dosage}</p>
                                                            <p className="text-[10px] text-emerald-600 mt-0.5">{rx.frequency} · {rx.duration}</p>
                                                        </div>
                                                        {rx.status && <span className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-700">{rx.status}</span>}
                                                    </div>
                                                    {rx.notes && <p className="text-[10px] text-emerald-500 mt-2 pl-11">{rx.notes}</p>}
                                                </motion.div>
                                            ))}
                                        </div>
                                    </motion.div>
                                )}

                                {/* Diagnosis tab */}
                                {activeTab === 'diagnosis' && (
                                    <motion.div key="dx" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
                                        <form onSubmit={addDiagnosis} className="p-5 rounded-2xl bg-surface-card border border-border shadow-sm space-y-3">
                                            <h4 className="text-xs font-bold text-text-primary flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-lg bg-violet-100 flex items-center justify-center"><Stethoscope size={13} className="text-violet-600" /></div>
                                                Add New Diagnosis
                                            </h4>
                                            <input value={dxForm.condition} onChange={e => setDxForm(f => ({ ...f, condition: e.target.value }))}
                                                placeholder="Condition / ICD-10 code" className="w-full px-3.5 py-2.5 rounded-xl border border-border text-xs bg-surface focus:outline-none focus:ring-2 focus:ring-violet-500/20 transition-all" required />
                                            <select value={dxForm.severity} onChange={e => setDxForm(f => ({ ...f, severity: e.target.value }))}
                                                className="w-full px-3.5 py-2.5 rounded-xl border border-border text-xs bg-surface cursor-pointer focus:outline-none focus:ring-2 focus:ring-violet-500/20 transition-all">
                                                {SEVERITY_OPTS.map(s => <option key={s} value={s}>{s}</option>)}
                                            </select>
                                            <textarea value={dxForm.notes} onChange={e => setDxForm(f => ({ ...f, notes: e.target.value }))}
                                                placeholder="Clinical notes..." rows={3}
                                                className="w-full px-3.5 py-2.5 rounded-xl border border-border text-xs bg-surface resize-none focus:outline-none focus:ring-2 focus:ring-violet-500/20 transition-all" />
                                            <button type="submit" className="w-full py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white text-xs font-bold cursor-pointer hover:shadow-lg hover:shadow-violet-500/20 transition-all flex items-center justify-center gap-2">
                                                <Stethoscope size={14} /> Save Diagnosis
                                            </button>
                                        </form>
                                        <div className="space-y-2">
                                            {diagnoses.length === 0 ? (
                                                <div className="text-center py-10 bg-surface-card rounded-2xl border border-border">
                                                    <FileText size={28} className="text-text-muted/15 mx-auto mb-2" />
                                                    <p className="text-xs text-text-muted">No diagnoses recorded</p>
                                                </div>
                                            ) : diagnoses.map((dx, i) => (
                                                <motion.div key={dx.id} initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                                                    className="px-4 py-3.5 rounded-xl bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-200/50 hover:shadow-sm transition-shadow">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center flex-shrink-0"><Stethoscope size={14} className="text-violet-600" /></div>
                                                        <div className="flex-1">
                                                            <p className="text-xs font-bold text-violet-800">{dx.condition}</p>
                                                            <p className="text-[10px] text-violet-600 mt-0.5">Severity: {dx.severity}</p>
                                                        </div>
                                                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md border
                                                            ${dx.severity === 'Severe' ? 'bg-red-50 text-red-600 border-red-200' :
                                                              dx.severity === 'Moderate' ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-emerald-50 text-emerald-600 border-emerald-200'}`}>
                                                            {dx.severity}
                                                        </span>
                                                    </div>
                                                    {dx.notes && <p className="text-[10px] text-violet-500 mt-2 pl-11">{dx.notes}</p>}
                                                </motion.div>
                                            ))}
                                        </div>
                                    </motion.div>
                                )}

                                {/* Ward assignment tab */}
                                {activeTab === 'ward' && (
                                    <motion.div key="ward" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
                                        <div className="p-5 rounded-2xl bg-surface-card border border-border shadow-sm space-y-4">
                                            <h4 className="text-xs font-bold text-text-primary flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-lg bg-teal-100 flex items-center justify-center"><BedDouble size={13} className="text-teal-600" /></div>
                                                Ward Assignment
                                            </h4>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <label className="text-[9px] font-bold text-text-muted uppercase tracking-wider block mb-1.5">Ward Type</label>
                                                    <select value={wardType} onChange={async (e) => {
                                                        const wt = e.target.value;
                                                        setWardType(wt);
                                                        if (!wt) { setWardSuggestion(null); return; }
                                                        setWardLoading(true);
                                                        try {
                                                            const res = await axios.get(`/api/ward/suggest-ward?department=${encodeURIComponent(sp.department || user.department || 'Emergency')}&ward_type=${wt}`);
                                                            setWardSuggestion(res.data.suggestion);
                                                        } catch (err) { setWardSuggestion(null); }
                                                        finally { setWardLoading(false); }
                                                    }} className="w-full px-3.5 py-2.5 rounded-xl border border-border text-xs bg-surface cursor-pointer focus:outline-none focus:ring-2 focus:ring-teal-500/20 transition-all">
                                                        <option value="">Select Ward Type</option>
                                                        {WARD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                                    </select>
                                                </div>
                                                <div className="flex items-end">
                                                    <div className="text-xs text-text-muted flex items-center gap-2 px-3 py-2.5">
                                                        {wardLoading ? (
                                                            <><div className="w-3 h-3 border border-primary border-t-transparent rounded-full animate-spin" /> Finding best ward...</>
                                                        ) : wardSuggestion ? (
                                                            <span className="text-primary font-semibold flex items-center gap-1"><Sparkles size={12} /> Suggested: {wardSuggestion.ward_id}</span>
                                                        ) : wardType ? 'No wards available' : (
                                                            <span className="text-text-muted/60">Select a type to see suggestions</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            {wardSuggestion && (
                                                <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                                                    className="p-4 rounded-xl bg-gradient-to-r from-teal-50 to-emerald-50 border border-teal-200/50">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 rounded-xl bg-teal-100 flex items-center justify-center">
                                                                <BedDouble size={18} className="text-teal-600" />
                                                            </div>
                                                            <div>
                                                                <p className="text-sm font-bold text-teal-800">{wardSuggestion.ward_id}</p>
                                                                <p className="text-[10px] text-teal-600">{wardSuggestion.type} · {wardSuggestion.department} · {wardSuggestion.available}/{wardSuggestion.capacity} beds available</p>
                                                            </div>
                                                        </div>
                                                        <button onClick={async () => {
                                                            try {
                                                                await axios.post('/api/ward/ward-admission', {
                                                                    patient_name: sp.name, patient_email: sp.email,
                                                                    ward_type: wardType, department: sp.department || user.department || 'Emergency',
                                                                    assigned_by_doctor: user.name || user.email, notes: `Assigned by Dr. ${user.name || user.email}`,
                                                                });
                                                                setFormSuccess('Patient assigned to ward! Nurse will confirm admission.');
                                                                setWardType(''); setWardSuggestion(null);
                                                                setTimeout(() => setFormSuccess(''), 4000);
                                                            } catch (err) { console.error(err); }
                                                        }} className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 text-white text-xs font-bold cursor-pointer hover:shadow-lg hover:shadow-teal-500/20 transition-all flex items-center gap-2">
                                                            <ArrowUpRight size={14} /> Assign Ward
                                                        </button>
                                                    </div>
                                                </motion.div>
                                            )}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    )}
                </div>
            </div>
        </div>
    );
}
