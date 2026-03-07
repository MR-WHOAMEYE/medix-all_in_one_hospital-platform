import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    AlertTriangle, ClipboardList, Users, Clock, Activity,
    Bell, Check, X, Heart, Droplets, Thermometer, FileText, Shield,
    TrendingUp, Zap, Search, Pill, FlaskConical, BedDouble, BarChart3,
    Eye, Edit3, Printer, Lock, Radio, ChevronDown, CheckCircle
} from 'lucide-react';
import axios from 'axios';
import { getNotifications, markNotificationRead } from '../services/api';
import { exportDoctorPDF } from '../utils/pdfExport';
import QRScanner from '../components/QRScanner';

const WARD_TYPES = ['ICU', 'General', 'Private'];

export default function DoctorDashboard() {
    const user = JSON.parse(sessionStorage.getItem('zi_user') || '{}');
    const token = sessionStorage.getItem('zi_token');

    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [myPatients, setMyPatients] = useState([]);
    const [notifications, setNotifications] = useState([]);
    const [showNotifPanel, setShowNotifPanel] = useState(false);
    const [selectedPatient, setSelectedPatient] = useState(null);
    const [sortBy, setSortBy] = useState('severity');
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState('diagnosis');
    const [showReportPanel, setShowReportPanel] = useState(false);
    const [reportType, setReportType] = useState('consultation');
    const [reportDraft, setReportDraft] = useState('');
    const [reportStatus, setReportStatus] = useState('draft');
    const [formSuccess, setFormSuccess] = useState('');

    // Clinical action forms
    const [dxForm, setDxForm] = useState({ condition: '', severity: 'Mild', notes: '' });
    const [rxForm, setRxForm] = useState({ medication: '', dosage: '', frequency: '', duration: '', notes: '' });
    const [wardType, setWardType] = useState('');
    const [wardSuggestion, setWardSuggestion] = useState(null);
    const [wardLoading, setWardLoading] = useState(false);

    // Patient detail data
    const [prescriptions, setPrescriptions] = useState([]);
    const [diagnoses, setDiagnoses] = useState([]);

    const unreadCount = notifications.filter(n => !n.read).length;

    // ── Augment patient with clinical scores ──
    const augment = (p, i) => ({
        ...p,
        _pid: `PID-${String(i + 1001).padStart(5, '0')}`,
        _cid: `CS-${String(2000 + i).padStart(5, '0')}`,
        _age: 22 + ((i * 7 + 3) % 58),
        _sev: Math.min(99, Math.max(10, 30 + (p.name?.charCodeAt(0) || 65) % 70)),
        _det: Math.min(80, Math.max(5, 10 + (p.name?.charCodeAt(1) || 66) % 55)),
        _sla: Math.min(70, Math.max(5, 8 + (p.name?.charCodeAt(2) || 67) % 45)),
        _ward: ['Admitted', 'Observation', 'ICU', 'Step-down'][i % 4],
        _lab: ['Pending', 'Partial', 'Complete', 'Awaiting'][i % 4],
        _blood: ['A+', 'B+', 'O+', 'AB+', 'O-', 'A-'][i % 6],
        _allergies: i % 3 === 0 ? ['Penicillin', 'Sulfa'] : i % 2 === 0 ? ['NSAIDs'] : [],
        _chronic: i % 2 === 0 ? ['Hypertension', 'T2DM'] : i % 3 === 0 ? ['Asthma'] : [],
        _readmit: Math.min(45, 5 + (p.name?.charCodeAt(0) || 65) % 35),
        _bed: `${['A', 'B', 'C', 'D'][i % 4]}-${101 + i}`,
        _complex: Math.min(95, 20 + (p.name?.charCodeAt(0) || 65) % 65),
        _mfreq: ['q15min', 'q30min', 'q1h', 'q2h', 'q4h'][i % 5],
        _gender: i % 3 === 0 ? 'Female' : 'Male',
    });

    // ── Data Fetching ──
    const fetchAll = useCallback(async () => {
        if (!user.email) return;
        try {
            const dept = user.department ? `?department=${encodeURIComponent(user.department)}` : '';
            const [dashRes, patRes] = await Promise.all([
                axios.get(`/api/doctor/dashboard${dept}`),
                axios.get(`/api/doctor/my-patients?doctor_email=${encodeURIComponent(user.email)}`),
            ]);
            setData(dashRes.data);
            setMyPatients((patRes.data.patients || []).map((p, i) => augment(p, i)));
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    }, [user.email, user.department]);

    const fetchNotifs = useCallback(async () => {
        if (!user.email) return;
        try { const r = await getNotifications(user.email); setNotifications(r.notifications || []); } catch { }
    }, [user.email]);

    useEffect(() => {
        fetchAll(); fetchNotifs();
        const iv = setInterval(() => { fetchAll(); fetchNotifs(); }, 30000);
        return () => clearInterval(iv);
    }, [fetchAll, fetchNotifs]);

    // ── Load patient detail data ──
    const loadPatientDetail = async (p) => {
        setSelectedPatient(p);
        setActiveTab('diagnosis');
        setFormSuccess('');
        try {
            const [rx, dx] = await Promise.all([
                axios.get(`/api/doctor/prescriptions?patient_email=${encodeURIComponent(p.email)}`),
                axios.get(`/api/doctor/diagnoses?patient_email=${encodeURIComponent(p.email)}`),
            ]);
            setPrescriptions(rx.data.prescriptions || []);
            setDiagnoses(dx.data.diagnoses || []);
        } catch (e) { console.error(e); }
    };

    // ── Actions ──
    const addDiagnosis = async (e) => {
        e.preventDefault();
        if (!selectedPatient) return;
        try {
            await axios.post('/api/doctor/diagnoses', {
                ...dxForm, patient_email: selectedPatient.email, patient_name: selectedPatient.name,
            });
            setFormSuccess('Diagnosis saved');
            setDxForm({ condition: '', severity: 'Mild', notes: '' });
            loadPatientDetail(selectedPatient);
            setTimeout(() => setFormSuccess(''), 3000);
        } catch (e) { console.error(e); }
    };

    const addPrescription = async (e) => {
        e.preventDefault();
        if (!selectedPatient) return;
        try {
            await axios.post('/api/doctor/prescriptions', {
                ...rxForm, patient_email: selectedPatient.email, patient_name: selectedPatient.name,
            });
            setFormSuccess('Prescription added');
            setRxForm({ medication: '', dosage: '', frequency: '', duration: '', notes: '' });
            loadPatientDetail(selectedPatient);
            setTimeout(() => setFormSuccess(''), 3000);
        } catch (e) { console.error(e); }
    };

    const assignWard = async () => {
        if (!selectedPatient || !wardSuggestion) return;
        try {
            await axios.post('/api/ward/ward-admission', {
                patient_name: selectedPatient.name, patient_email: selectedPatient.email,
                ward_type: wardType, department: selectedPatient.department || user.department || 'Emergency',
                assigned_by_doctor: user.name || user.email, notes: `Assigned by Dr. ${user.name || user.email}`,
            });
            setFormSuccess('Ward assigned — Nurse will confirm');
            setWardType(''); setWardSuggestion(null);
            setTimeout(() => setFormSuccess(''), 4000);
        } catch (e) { console.error(e); }
    };

    const handleMarkRead = async (id) => {
        try { await markNotificationRead(id); setNotifications(p => p.map(n => n.id === id ? { ...n, read: true } : n)); } catch { }
    };

    // ── Derived ──
    const metrics = useMemo(() => {
        const total = myPatients.length + (data?.cases?.length || 0);
        return {
            total, highRisk: myPatients.filter(p => p._sev >= 70).length,
            slaRisk: myPatients.filter(p => p._sla >= 40).length,
            avgTTT: data?.cases?.length ? ((data.cases.length * 18.5 + myPatients.length * 24.2) / Math.max(1, total)).toFixed(1) : '0',
            critical: data?.critical_alerts || 0,
            workload: Math.min(100, Math.max(30, Math.round(total / Math.max(1, total + 5) * 100))),
        };
    }, [myPatients, data]);

    const events = useMemo(() => {
        const types = [
            { icon: Activity, label: 'Vitals recorded', color: '#10B981' },
            { icon: AlertTriangle, label: 'Escalation raised', color: '#EF4444' },
            { icon: FlaskConical, label: 'Lab results ready', color: '#3B82F6' },
            { icon: FileText, label: 'Report finalized', color: '#8B5CF6' },
            { icon: BedDouble, label: 'Ward transfer', color: '#F59E0B' },
        ];
        return myPatients.slice(0, 12).map((p, i) => ({
            id: i, ...types[i % types.length], patient: p.name, time: `${i * 8 + 3}m ago`,
        }));
    }, [myPatients]);

    const perf = useMemo(() => ({
        sla: Math.min(98, 72 + myPatients.length * 2),
        res: (16 + myPatients.length * 1.5).toFixed(1),
        readmit: (3 + (myPatients.length % 6)).toFixed(1),
        esc: Math.max(1, Math.floor(myPatients.length * 0.3)),
        trend: [4, 6, 5, 8, 7, 3, 5],
    }), [myPatients]);

    const filtered = useMemo(() => {
        let l = [...myPatients];
        if (searchTerm) l = l.filter(p => p.name?.toLowerCase().includes(searchTerm.toLowerCase()) || p._pid?.includes(searchTerm));
        if (sortBy === 'severity') l.sort((a, b) => b._sev - a._sev);
        else if (sortBy === 'sla') l.sort((a, b) => b._sla - a._sla);
        return l;
    }, [myPatients, searchTerm, sortBy]);

    const sevColor = (s) => s >= 75 ? { bg: '#FEE2E2', c: '#991B1B' } : s >= 50 ? { bg: '#FEF3C7', c: '#92400E' } : s >= 30 ? { bg: '#FEF9C3', c: '#854D0E' } : { bg: '#DCFCE7', c: '#166534' };
    const riskCls = (v) => v >= 50 ? 'bg-red-100 text-red-700' : v >= 25 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700';
    const timeAgo = (d) => { if (!d) return ''; const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000); return m < 1 ? 'Now' : m < 60 ? `${m}m` : m < 1440 ? `${Math.floor(m / 60)}h` : `${Math.floor(m / 1440)}d`; };

    if (loading) return (
        <div className="flex items-center justify-center h-[60vh]">
            <div className="text-center"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" /><p className="text-xs text-text-muted">Loading Clinical Command Center...</p></div>
        </div>
    );

    const sp = selectedPatient;

    return (
        <div className="max-w-[1600px] mx-auto space-y-4">

            {/* ═══ A) HEADER ═══ */}
            <div className="flex items-center justify-between px-6 py-4 bg-surface-card rounded-2xl border border-border">
                <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Shield size={22} className="text-primary" />
                    </div>
                    <div>
                        <h1 className="text-lg font-bold text-text-primary">Clinical Command Center</h1>
                        <p className="text-[11px] text-text-muted">Dr. {user.name || 'Doctor'} · {user.department || 'General'} · Live Operations</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <QRScanner onScanSuccess={(data) => {
                        const match = myPatients.find(p => p.email === data.email);
                        if (match) loadPatientDetail(match);
                        else alert(`Patient ${data.name} (${data.email}) is not assigned to you.`);
                    }} />
                    <button onClick={() => exportDoctorPDF({ user, metrics, myPatients, perf, selectedPatient: sp, diagnoses, prescriptions })} className="px-4 py-2 text-xs font-semibold bg-critical/10 text-critical rounded-xl hover:bg-critical/20 transition cursor-pointer flex items-center gap-2">
                        <Printer size={14} /> Download PDF
                    </button>
                    <button onClick={() => setShowReportPanel(true)} className="px-4 py-2 text-xs font-semibold bg-primary/10 text-primary rounded-xl hover:bg-primary/20 transition cursor-pointer flex items-center gap-2">
                        <FileText size={14} /> Generate Report
                    </button>
                    <div className="relative">
                        <button onClick={() => setShowNotifPanel(!showNotifPanel)} className="relative w-10 h-10 rounded-xl bg-surface border border-border flex items-center justify-center cursor-pointer hover:shadow-sm transition">
                            <Bell size={17} className="text-text-secondary" />
                            {unreadCount > 0 && <span className="absolute -top-1 -right-1 w-4.5 h-4.5 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center ring-2 ring-white">{unreadCount > 9 ? '9+' : unreadCount}</span>}
                        </button>
                        <AnimatePresence>
                            {showNotifPanel && (
                                <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                                    className="absolute right-0 top-12 w-80 max-h-96 bg-surface-card border border-border rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col">
                                    <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
                                        <span className="text-xs font-bold text-text-primary flex items-center gap-1.5"><Bell size={13} className="text-primary" /> Notifications</span>
                                        <button onClick={() => setShowNotifPanel(false)} className="cursor-pointer"><X size={14} className="text-text-muted" /></button>
                                    </div>
                                    <div className="overflow-y-auto flex-1">{notifications.length === 0 ? <p className="text-xs text-text-muted text-center py-10">No notifications</p> : notifications.slice(0, 12).map(n => (
                                        <div key={n.id} className={`px-4 py-2.5 border-b border-border/50 ${!n.read ? 'bg-primary/[0.03]' : ''}`}>
                                            <div className="flex justify-between items-start"><span className="text-[11px] font-semibold text-text-primary">{n.title}</span><span className="text-[9px] text-text-muted">{timeAgo(n.created_at)}</span></div>
                                            <p className="text-[10px] text-text-secondary mt-0.5">{n.message}</p>
                                            {!n.read && <button onClick={() => handleMarkRead(n.id)} className="text-primary text-[10px] mt-1 cursor-pointer flex items-center gap-0.5"><Check size={10} /> Mark read</button>}
                                        </div>
                                    ))}</div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>

            {/* ═══ METRICS ═══ */}
            <div className="grid grid-cols-6 gap-3">
                {[
                    { label: 'ACTIVE CASES', val: metrics.total, icon: ClipboardList, color: '#0F766E' },
                    { label: 'HIGH-RISK', val: metrics.highRisk, icon: AlertTriangle, color: '#DC2626' },
                    { label: 'SLA AT RISK', val: metrics.slaRisk, icon: Clock, color: '#D97706' },
                    { label: 'AVG TTT (HRS)', val: metrics.avgTTT, icon: TrendingUp, color: '#3B82F6' },
                    { label: 'CRITICAL TODAY', val: metrics.critical, icon: Zap, color: '#EF4444' },
                    { label: 'WORKLOAD %', val: `${metrics.workload}%`, icon: BarChart3, color: '#8B5CF6' },
                ].map((m, i) => (
                    <motion.div key={m.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                        className="px-4 py-3.5 bg-surface-card rounded-xl border border-border">
                        <div className="flex items-center gap-2 mb-1"><div className="w-1 h-4 rounded-full" style={{ background: m.color }} /><m.icon size={14} style={{ color: m.color }} /></div>
                        <p className="text-2xl font-bold text-text-primary leading-none">{m.val}</p>
                        <p className="text-[9px] text-text-muted font-semibold tracking-wider mt-1">{m.label}</p>
                    </motion.div>
                ))}
            </div>

            {/* ═══ SHIFT / SEVERITY BARS ═══ */}
            <div className="grid grid-cols-2 gap-3">
                <div className="bg-surface-card rounded-xl border border-border px-5 py-3 flex items-center gap-4">
                    <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider whitespace-nowrap">Shift Load</span>
                    <div className="flex-1 h-2.5 bg-border rounded-full overflow-hidden"><div className="h-full bg-primary rounded-full transition-all" style={{ width: `${metrics.workload}%` }} /></div>
                    <span className="text-xs font-bold text-text-primary">{metrics.workload}%</span>
                </div>
                <div className="bg-surface-card rounded-xl border border-border px-5 py-3 flex items-center gap-4">
                    <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider whitespace-nowrap">Avg Severity</span>
                    <div className="flex-1 h-2.5 bg-border rounded-full overflow-hidden"><div className="h-full bg-critical rounded-full transition-all" style={{ width: `${myPatients.length ? Math.round(myPatients.reduce((a, p) => a + p._sev, 0) / myPatients.length) : 0}%` }} /></div>
                    <span className="text-xs font-bold text-text-primary">{myPatients.length ? (myPatients.reduce((a, p) => a + p._sev, 0) / myPatients.length).toFixed(1) : 0}%</span>
                </div>
            </div>

            {/* ═══ MAIN 3-PANEL LAYOUT ═══ */}
            <div className="grid grid-cols-12 gap-3" style={{ minHeight: 540 }}>

                {/* ── CASE BOARD (5 cols) ── */}
                <div className="col-span-5 bg-surface-card rounded-xl border border-border flex flex-col overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                        <h2 className="text-xs font-bold text-text-primary uppercase tracking-wider">Intelligent Case Board</h2>
                        <div className="flex items-center gap-2">
                            <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="text-[10px] px-2 py-1 bg-surface border border-border rounded-lg cursor-pointer focus:outline-none">
                                <option value="severity">Sort by Severity</option>
                                <option value="sla">Sort by SLA Risk</option>
                            </select>
                        </div>
                    </div>
                    <div className="px-4 py-2 border-b border-border">
                        <div className="relative">
                            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
                            <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Search patients..." className="w-full pl-8 pr-3 py-1.5 text-[11px] bg-surface border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary/30" />
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                        {filtered.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16"><Users size={28} className="text-text-muted/20 mb-2" /><p className="text-xs text-text-muted">No patients assigned</p></div>
                        ) : filtered.map((p, i) => {
                            const sc = sevColor(p._sev);
                            const sel = sp?.email === p.email;
                            return (
                                <div key={p.id || i} onClick={() => loadPatientDetail(p)}
                                    className={`px-4 py-3 border-b border-border/40 cursor-pointer transition-all ${sel ? 'bg-primary/[0.05] border-l-3 border-l-primary' : 'hover:bg-surface/60'}`}>
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: sc.bg, color: sc.c }}>
                                            {p.name?.charAt(0)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between">
                                                <p className="text-[12px] font-bold text-text-primary truncate">{p.name}</p>
                                                <span className="text-[9px] font-mono text-text-muted">#{p._pid?.slice(-4)}</span>
                                            </div>
                                            <p className="text-[10px] text-text-muted">{p.department} · {p._age}y {p._gender}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 mt-2">
                                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-md" style={{ background: sc.bg, color: sc.c }}>SEV {p._sev}</span>
                                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md ${riskCls(p._det)}`}>DET {p._det}%</span>
                                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md ${riskCls(p._sla)}`}>SLA {p._sla}%</span>
                                        <span className="ml-auto text-[9px] text-text-muted">{p._ward}</span>
                                    </div>
                                    {p.issue && <p className="text-[10px] text-amber-700 bg-amber-50 px-2 py-1 rounded mt-1.5 truncate">{p.issue}</p>}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* ── PATIENT WORKSPACE (5 cols) ── */}
                <div className="col-span-5 bg-surface-card rounded-xl border border-border flex flex-col overflow-hidden">
                    {!sp ? (
                        <div className="flex-1 flex items-center justify-center"><div className="text-center"><Eye size={32} className="text-text-muted/15 mx-auto mb-3" /><p className="text-xs text-text-muted">Select a patient from the case board</p></div></div>
                    ) : (
                        <div className="flex-1 overflow-y-auto">
                            {/* Patient Header */}
                            <div className="px-5 py-4 border-b border-border bg-gradient-to-r from-primary/[0.03] to-transparent">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">{sp.name?.charAt(0)}</div>
                                    <div>
                                        <h3 className="text-base font-bold text-text-primary">{sp.name}</h3>
                                        <p className="text-[10px] text-text-muted">Case {sp._cid} · {sp.department}</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-3 gap-3 text-[11px]">
                                    <div><span className="text-text-muted block text-[9px] uppercase tracking-wider">Age</span><span className="font-bold text-text-primary">{sp._age} yrs</span></div>
                                    <div><span className="text-text-muted block text-[9px] uppercase tracking-wider">Gender</span><span className="font-bold text-text-primary">{sp._gender}</span></div>
                                    <div><span className="text-text-muted block text-[9px] uppercase tracking-wider">Blood Group</span><span className="font-bold text-primary">{sp._blood}</span></div>
                                </div>
                                {sp._allergies?.length > 0 && (
                                    <div className="mt-3 px-3 py-2 bg-red-50 border border-red-200/60 rounded-lg flex items-center gap-2">
                                        <AlertTriangle size={14} className="text-red-500 flex-shrink-0" />
                                        <div><p className="text-[10px] font-bold text-red-700 uppercase tracking-wider">Allergies Alert</p><p className="text-[11px] text-red-600">{sp._allergies.join(', ')}</p></div>
                                    </div>
                                )}
                            </div>

                            {/* Clinical Info Row */}
                            <div className="px-5 py-3 border-b border-border">
                                <p className="text-[9px] font-bold text-text-muted uppercase tracking-wider mb-2">Primary Diagnosis</p>
                                <p className="text-xs text-text-primary">{diagnoses.length > 0 ? diagnoses[0].condition : `Diagnosis for case ${sp._cid}`}</p>
                                {sp._chronic?.length > 0 && (
                                    <div className="mt-2"><p className="text-[9px] font-bold text-text-muted uppercase tracking-wider mb-1">Medical History</p>
                                        <p className="text-xs text-text-primary">{sp._chronic.join(', ')}</p></div>
                                )}
                            </div>

                            {/* Vitals */}
                            {sp.latest_vitals && (
                                <div className="px-5 py-3 border-b border-border">
                                    <p className="text-[9px] font-bold text-text-muted uppercase tracking-wider mb-2">Latest Vitals</p>
                                    <div className="grid grid-cols-4 gap-2">
                                        {sp.latest_vitals.bp_systolic && <div className="px-3 py-2 bg-red-50 rounded-lg text-center"><Heart size={12} className="text-red-500 mx-auto mb-0.5" /><p className="text-xs font-bold text-text-primary">{sp.latest_vitals.bp_systolic}/{sp.latest_vitals.bp_diastolic}</p><p className="text-[8px] text-text-muted">mmHg</p></div>}
                                        {sp.latest_vitals.heart_rate && <div className="px-3 py-2 bg-emerald-50 rounded-lg text-center"><Activity size={12} className="text-emerald-500 mx-auto mb-0.5" /><p className="text-xs font-bold text-text-primary">{sp.latest_vitals.heart_rate}</p><p className="text-[8px] text-text-muted">bpm</p></div>}
                                        {sp.latest_vitals.temperature && <div className="px-3 py-2 bg-orange-50 rounded-lg text-center"><Thermometer size={12} className="text-orange-500 mx-auto mb-0.5" /><p className="text-xs font-bold text-text-primary">{sp.latest_vitals.temperature}°F</p><p className="text-[8px] text-text-muted">Temp</p></div>}
                                        {sp.latest_vitals.sugar_level && <div className="px-3 py-2 bg-blue-50 rounded-lg text-center"><Droplets size={12} className="text-blue-500 mx-auto mb-0.5" /><p className="text-xs font-bold text-text-primary">{sp.latest_vitals.sugar_level}</p><p className="text-[8px] text-text-muted">mg/dL</p></div>}
                                    </div>
                                </div>
                            )}

                            {/* AI Intelligence */}
                            <div className="px-5 py-3 border-b border-border">
                                <p className="text-[9px] font-bold text-text-muted uppercase tracking-wider mb-2">AI Risk Assessment</p>
                                <div className="grid grid-cols-4 gap-2">
                                    <div className="px-2.5 py-2 bg-surface rounded-lg border border-border text-center"><p className="text-[8px] text-text-muted">Deterioration</p><p className={`text-sm font-bold ${sp._det >= 50 ? 'text-red-600' : 'text-text-primary'}`}>{sp._det}%</p></div>
                                    <div className="px-2.5 py-2 bg-surface rounded-lg border border-border text-center"><p className="text-[8px] text-text-muted">SLA Risk</p><p className={`text-sm font-bold ${sp._sla >= 40 ? 'text-amber-600' : 'text-text-primary'}`}>{sp._sla}%</p></div>
                                    <div className="px-2.5 py-2 bg-surface rounded-lg border border-border text-center"><p className="text-[8px] text-text-muted">Complexity</p><p className="text-sm font-bold text-text-primary">{sp._complex}</p></div>
                                    <div className="px-2.5 py-2 bg-surface rounded-lg border border-border text-center"><p className="text-[8px] text-text-muted">Monitor Freq</p><p className="text-sm font-bold text-primary">{sp._mfreq}</p></div>
                                </div>
                            </div>

                            {/* Success message */}
                            {formSuccess && <div className="mx-5 mt-2 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg text-[11px] text-emerald-700 font-medium flex items-center gap-1.5"><CheckCircle size={13} /> {formSuccess}</div>}

                            {/* Action Tabs */}
                            <div className="px-5 py-3">
                                <div className="flex gap-1 bg-surface rounded-xl p-1 mb-3">
                                    {[
                                        { k: 'diagnosis', l: 'Diagnosis', ic: FileText },
                                        { k: 'prescription', l: 'Prescribe Rx', ic: Pill },
                                        { k: 'labs', l: 'Clinical Orders', ic: FlaskConical },
                                        { k: 'ward', l: 'Document Upload', ic: BedDouble },
                                    ].map(t => (
                                        <button key={t.k} onClick={() => setActiveTab(t.k)}
                                            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[10px] font-semibold cursor-pointer transition-all
                        ${activeTab === t.k ? 'bg-surface-card text-primary shadow-sm border border-border' : 'text-text-muted hover:text-text-secondary'}`}>
                                            <t.ic size={12} /> {t.l}
                                            {activeTab === t.k ? <span className="ml-auto"><ChevronDown size={10} className="rotate-180" /></span> : <ChevronDown size={10} className="ml-auto" />}
                                        </button>
                                    ))}
                                </div>

                                {/* DIAGNOSIS TAB */}
                                <AnimatePresence mode="wait">
                                    {activeTab === 'diagnosis' && (
                                        <motion.div key="dx" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                                            <form onSubmit={addDiagnosis} className="space-y-2.5">
                                                <input value={dxForm.condition} onChange={e => setDxForm(f => ({ ...f, condition: e.target.value }))} placeholder="Condition / ICD-10 code" required className="w-full px-3 py-2 text-xs bg-surface border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary/30" />
                                                <select value={dxForm.severity} onChange={e => setDxForm(f => ({ ...f, severity: e.target.value }))} className="w-full px-3 py-2 text-xs bg-surface border border-border rounded-lg cursor-pointer focus:outline-none">
                                                    <option>Mild</option><option>Moderate</option><option>Severe</option>
                                                </select>
                                                <textarea value={dxForm.notes} onChange={e => setDxForm(f => ({ ...f, notes: e.target.value }))} placeholder="Clinical notes..." rows={3} className="w-full px-3 py-2 text-xs bg-surface border border-border rounded-lg focus:outline-none resize-none" />
                                                <button type="submit" className="w-full py-2 text-xs font-semibold bg-primary text-white rounded-lg hover:bg-primary-dark transition cursor-pointer">Save Diagnosis</button>
                                            </form>
                                            {diagnoses.length > 0 && <div className="mt-3 space-y-1.5">{diagnoses.map(d => (
                                                <div key={d.id} className="px-3 py-2 bg-surface rounded-lg border border-border"><p className="text-[11px] font-bold text-text-primary">{d.condition}</p><p className="text-[10px] text-text-muted">Severity: {d.severity}{d.notes ? ` · ${d.notes}` : ''}</p></div>
                                            ))}</div>}
                                        </motion.div>
                                    )}

                                    {/* PRESCRIPTION TAB */}
                                    {activeTab === 'prescription' && (
                                        <motion.div key="rx" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                                            <form onSubmit={addPrescription} className="space-y-2.5">
                                                <input value={rxForm.medication} onChange={e => setRxForm(f => ({ ...f, medication: e.target.value }))} placeholder="Drug name" required className="w-full px-3 py-2 text-xs bg-surface border border-border rounded-lg focus:outline-none" />
                                                {sp._allergies?.length > 0 && <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-[10px] text-red-700 font-medium">⚠ Allergy conflict check: {sp._allergies.join(', ')}</div>}
                                                <div className="grid grid-cols-2 gap-2">
                                                    <input value={rxForm.dosage} onChange={e => setRxForm(f => ({ ...f, dosage: e.target.value }))} placeholder="Dosage (e.g. 500mg)" required className="px-3 py-2 text-xs bg-surface border border-border rounded-lg focus:outline-none" />
                                                    <input value={rxForm.frequency} onChange={e => setRxForm(f => ({ ...f, frequency: e.target.value }))} placeholder="Frequency (e.g. 2x daily)" required className="px-3 py-2 text-xs bg-surface border border-border rounded-lg focus:outline-none" />
                                                </div>
                                                <input value={rxForm.duration} onChange={e => setRxForm(f => ({ ...f, duration: e.target.value }))} placeholder="Duration (e.g. 7 days)" required className="w-full px-3 py-2 text-xs bg-surface border border-border rounded-lg focus:outline-none" />
                                                <input value={rxForm.notes} onChange={e => setRxForm(f => ({ ...f, notes: e.target.value }))} placeholder="Notes (optional)" className="w-full px-3 py-2 text-xs bg-surface border border-border rounded-lg focus:outline-none" />
                                                <button type="submit" className="w-full py-2 text-xs font-semibold bg-primary text-white rounded-lg hover:bg-primary-dark transition cursor-pointer">Prescribe Medication</button>
                                            </form>
                                            {prescriptions.length > 0 && <div className="mt-3 space-y-1.5">{prescriptions.map(r => (
                                                <div key={r.id} className="px-3 py-2 bg-emerald-50 rounded-lg border border-emerald-200/60"><p className="text-[11px] font-bold text-emerald-800">💊 {r.medication} — {r.dosage}</p><p className="text-[10px] text-emerald-600">{r.frequency} · {r.duration}</p></div>
                                            ))}</div>}
                                        </motion.div>
                                    )}

                                    {/* LABS TAB */}
                                    {activeTab === 'labs' && (
                                        <motion.div key="labs" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-2.5">
                                            <div className="flex items-center justify-between px-3 py-2 bg-surface rounded-lg border border-border">
                                                <span className="text-xs text-text-primary font-medium">Lab Status</span>
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${sp._lab === 'Complete' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{sp._lab}</span>
                                            </div>
                                            <select className="w-full px-3 py-2 text-xs bg-surface border border-border rounded-lg cursor-pointer focus:outline-none">
                                                <option>Complete Blood Count</option><option>Metabolic Panel</option><option>Lipid Panel</option><option>Urinalysis</option><option>Chest X-Ray</option><option>CT Scan</option><option>MRI</option>
                                            </select>
                                            <div className="text-[10px] text-text-muted px-1">Est. turnaround: 2-4 hours</div>
                                            <button className="w-full py-2 text-xs font-semibold bg-primary text-white rounded-lg hover:bg-primary-dark transition cursor-pointer">Order Lab / Imaging</button>
                                        </motion.div>
                                    )}

                                    {/* WARD TAB */}
                                    {activeTab === 'ward' && (
                                        <motion.div key="ward" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-2.5">
                                            <div className="flex items-center justify-between px-3 py-2 bg-surface rounded-lg border border-border">
                                                <span className="text-xs text-text-primary">Current: {sp._ward} · Bed {sp._bed}</span>
                                            </div>
                                            <select value={wardType} onChange={async (e) => {
                                                const wt = e.target.value; setWardType(wt);
                                                if (!wt) { setWardSuggestion(null); return; }
                                                setWardLoading(true);
                                                try { const r = await axios.get(`/api/ward/suggest-ward?department=${encodeURIComponent(sp.department || user.department || 'Emergency')}&ward_type=${wt}`); setWardSuggestion(r.data.suggestion); }
                                                catch { setWardSuggestion(null); } finally { setWardLoading(false); }
                                            }} className="w-full px-3 py-2 text-xs bg-surface border border-border rounded-lg cursor-pointer focus:outline-none">
                                                <option value="">Select Ward Type</option>{WARD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                            </select>
                                            {wardLoading && <p className="text-[10px] text-text-muted px-1">Finding best ward...</p>}
                                            {wardSuggestion && (
                                                <div className="p-3 bg-primary/5 border border-primary/10 rounded-lg">
                                                    <p className="text-xs font-bold text-primary">{wardSuggestion.ward_id}</p>
                                                    <p className="text-[10px] text-text-muted">{wardSuggestion.type} · {wardSuggestion.available}/{wardSuggestion.capacity} beds free</p>
                                                    <button onClick={assignWard} className="mt-2 w-full py-2 text-xs font-semibold bg-primary text-white rounded-lg hover:bg-primary-dark transition cursor-pointer">Assign Ward</button>
                                                </div>
                                            )}
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                {/* Case Closure */}
                                <button className="w-full mt-4 py-2.5 text-xs font-semibold bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition cursor-pointer flex items-center justify-center gap-2">
                                    <CheckCircle size={14} /> Initiate Case Closure
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* ── EVENTS (2 cols) ── */}
                <div className="col-span-2 bg-surface-card rounded-xl border border-border flex flex-col overflow-hidden">
                    <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                        <Radio size={12} className="text-emerald-500" />
                        <h2 className="text-[10px] font-bold text-text-primary uppercase tracking-wider">Live Events</h2>
                        <span className="ml-auto w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                    </div>
                    <div className="flex-1 overflow-y-auto">
                        {events.map(ev => (
                            <div key={ev.id} className="px-4 py-2.5 border-b border-border/30 hover:bg-surface/40 transition">
                                <div className="flex items-start gap-2.5">
                                    <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: `${ev.color}15` }}>
                                        <ev.icon size={12} style={{ color: ev.color }} />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-[10px] font-semibold text-text-primary leading-tight">{ev.label}</p>
                                        <p className="text-[9px] text-text-muted truncate">{ev.patient}</p>
                                    </div>
                                    <span className="text-[8px] text-text-muted whitespace-nowrap">{ev.time}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ═══ PERFORMANCE ═══ */}
            <div className="bg-surface-card rounded-xl border border-border p-5">
                <h2 className="text-xs font-bold text-text-primary uppercase tracking-wider mb-4 flex items-center gap-2"><BarChart3 size={14} className="text-primary" /> Performance & Insights</h2>
                <div className="grid grid-cols-5 gap-4">
                    <div className="px-4 py-3 bg-surface rounded-xl border border-border text-center"><p className="text-xl font-bold text-primary">{perf.sla}%</p><p className="text-[9px] text-text-muted font-semibold mt-0.5">SLA Adherence</p></div>
                    <div className="px-4 py-3 bg-surface rounded-xl border border-border text-center"><p className="text-xl font-bold text-text-primary">{perf.res}h</p><p className="text-[9px] text-text-muted font-semibold mt-0.5">Avg Resolution</p></div>
                    <div className="px-4 py-3 bg-surface rounded-xl border border-border text-center"><p className="text-xl font-bold text-amber-600">{perf.readmit}%</p><p className="text-[9px] text-text-muted font-semibold mt-0.5">Readmission Rate</p></div>
                    <div className="px-4 py-3 bg-surface rounded-xl border border-border text-center"><p className="text-xl font-bold text-text-primary">{perf.esc}</p><p className="text-[9px] text-text-muted font-semibold mt-0.5">Escalations/Week</p></div>
                    <div className="px-4 py-3 bg-surface rounded-xl border border-border">
                        <p className="text-[9px] text-text-muted font-semibold mb-2">Weekly Trend</p>
                        <div className="flex items-end gap-1.5 h-10">{perf.trend.map((v, i) => (
                            <div key={i} className="flex-1 flex flex-col items-center gap-1"><div className="w-full bg-primary rounded-sm transition-all" style={{ height: `${(v / 10) * 100}%`, minHeight: 3 }} /><span className="text-[7px] text-text-muted">{'MTWTFSS'[i]}</span></div>
                        ))}</div>
                    </div>
                </div>
            </div>

            {/* ═══ REPORT PANEL ═══ */}
            <AnimatePresence>
                {showReportPanel && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/20 z-50 flex justify-end" onClick={() => setShowReportPanel(false)}>
                        <motion.div initial={{ x: 500 }} animate={{ x: 0 }} exit={{ x: 500 }} transition={{ type: 'spring', damping: 28 }}
                            onClick={e => e.stopPropagation()} className="w-[500px] h-full bg-surface-card border-l border-border shadow-2xl flex flex-col">
                            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                                <h2 className="text-sm font-bold text-text-primary flex items-center gap-2"><FileText size={16} className="text-primary" /> Report Generator</h2>
                                <button onClick={() => setShowReportPanel(false)} className="cursor-pointer w-8 h-8 rounded-lg hover:bg-surface flex items-center justify-center"><X size={16} className="text-text-muted" /></button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-5 space-y-4">
                                <div><label className="text-[10px] font-bold text-text-muted uppercase tracking-wider block mb-1.5">Report Type</label>
                                    <select value={reportType} onChange={e => setReportType(e.target.value)} className="w-full px-3 py-2.5 text-xs bg-surface border border-border rounded-xl cursor-pointer focus:outline-none">
                                        <option value="consultation">Consultation Report</option><option value="lab">Lab Report</option><option value="imaging">Imaging Report</option><option value="prescription">Prescription Sheet</option><option value="discharge">Discharge Summary</option><option value="referral">Referral Letter</option>
                                    </select></div>
                                {sp && <div className="p-4 bg-surface rounded-xl border border-border space-y-1"><p className="text-xs font-bold text-text-primary">{sp.name} · {sp._pid}</p><p className="text-[10px] text-text-muted">{sp.department} · {sp._ward} · Bed {sp._bed}</p><p className="text-[10px] text-text-muted">Severity: {sp._sev} · Risk: {sp._det}%</p></div>}
                                <div><label className="text-[10px] font-bold text-text-muted uppercase tracking-wider block mb-1.5">Clinical Summary</label>
                                    <textarea value={reportDraft} onChange={e => setReportDraft(e.target.value)} rows={8} placeholder="Enter clinical findings, treatment details, follow-up instructions..." className="w-full px-3 py-2.5 text-xs bg-surface border border-border rounded-xl focus:outline-none resize-none" /></div>
                                <div className="grid grid-cols-2 gap-3 text-[10px]">
                                    <div className="px-3 py-2.5 bg-surface rounded-xl border border-border"><span className="text-text-muted block text-[9px]">Doctor</span><span className="font-bold text-text-primary">Dr. {user.name}</span></div>
                                    <div className="px-3 py-2.5 bg-surface rounded-xl border border-border"><span className="text-text-muted block text-[9px]">Timestamp</span><span className="font-bold text-text-primary">{new Date().toLocaleString()}</span></div>
                                    <div className="px-3 py-2.5 bg-surface rounded-xl border border-border"><span className="text-text-muted block text-[9px]">Status</span><span className={`font-bold ${reportStatus === 'finalized' ? 'text-emerald-600' : 'text-amber-600'}`}>{reportStatus === 'finalized' ? 'Finalized & Locked' : 'Draft'}</span></div>
                                    <div className="px-3 py-2.5 bg-surface rounded-xl border border-border"><span className="text-text-muted block text-[9px]">Version</span><span className="font-bold text-text-primary">v1.0</span></div>
                                </div>
                            </div>
                            <div className="px-5 py-4 border-t border-border flex gap-2">
                                <button onClick={() => setReportStatus('draft')} className="flex-1 py-2.5 text-xs font-semibold bg-surface border border-border rounded-xl hover:bg-surface/80 cursor-pointer flex items-center justify-center gap-1.5"><Edit3 size={13} /> Draft</button>
                                <button onClick={() => setReportStatus('finalized')} className="flex-1 py-2.5 text-xs font-semibold bg-primary text-white rounded-xl hover:bg-primary-dark cursor-pointer flex items-center justify-center gap-1.5"><Lock size={13} /> Finalize</button>
                                <button onClick={() => exportDoctorPDF({ user, metrics, myPatients, perf, selectedPatient: sp, diagnoses, prescriptions })} className="px-4 py-2.5 text-xs font-semibold bg-surface border border-border rounded-xl hover:bg-surface/80 cursor-pointer" title="Download PDF"><Printer size={13} /></button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
