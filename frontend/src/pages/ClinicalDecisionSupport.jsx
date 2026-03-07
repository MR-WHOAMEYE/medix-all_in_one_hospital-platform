import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ShieldCheck, Heart, Activity, Pill, AlertTriangle, Brain,
    Loader2, User, Beaker, Plus, ChevronDown, ChevronUp,
    BarChart3, Clock, Search, RefreshCw, Stethoscope, FileText,
    Thermometer, Droplets, XCircle, CheckCircle2, Info, Sparkles,
    TrendingUp, CircleAlert, ShieldAlert, ListChecks, History
} from 'lucide-react';
import {
    cdssUpsertPatient, cdssSubmitVitals, cdssSubmitLabs,
    cdssSubmitMedication, cdssSubmitAllergy, cdssGetAlerts,
    cdssGetRisk, cdssListPatients, cdssGetPatient,
    cdssGetHistory, cdssGetStats
} from '../services/api';

// ── Severity config ──
const SEV = {
    critical: { bg: '#FEE2E2', text: '#DC2626', border: '#FECACA', icon: XCircle, label: 'Critical' },
    high:     { bg: '#FEF3C7', text: '#D97706', border: '#FDE68A', icon: AlertTriangle, label: 'High' },
    medium:   { bg: '#DBEAFE', text: '#2563EB', border: '#BFDBFE', icon: Info, label: 'Medium' },
    low:      { bg: '#D1FAE5', text: '#059669', border: '#A7F3D0', icon: CheckCircle2, label: 'Low' },
    info:     { bg: '#F3F4F6', text: '#6B7280', border: '#E5E7EB', icon: Info, label: 'Info' },
};

const RISK = {
    HIGH:   { bg: '#DC2626', ring: '#FEE2E2', text: '#DC2626' },
    MEDIUM: { bg: '#D97706', ring: '#FEF3C7', text: '#D97706' },
    LOW:    { bg: '#059669', ring: '#D1FAE5', text: '#059669' },
};

// ── Badge components ──
function SeverityBadge({ severity }) {
    const c = SEV[severity] || SEV.info;
    const Icon = c.icon;
    return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
            style={{ backgroundColor: c.bg, color: c.text, border: `1px solid ${c.border}` }}>
            <Icon size={10} /> {c.label}
        </span>
    );
}

function RiskGauge({ risk }) {
    if (!risk) return null;
    const c = RISK[risk.level] || RISK.LOW;
    return (
        <div className="flex items-center gap-3">
            <div className="relative w-16 h-16">
                <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="#E5E7EB" strokeWidth="3" />
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke={c.bg} strokeWidth="3"
                        strokeDasharray={`${risk.score} ${100 - risk.score}`} strokeLinecap="round"
                        className="transition-all duration-700" />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-sm font-black" style={{ color: c.text }}>{risk.score}</span>
                </div>
            </div>
            <div>
                <div className="text-xs font-bold" style={{ color: c.text }}>{risk.level} RISK</div>
                <div className="text-[10px] text-gray-400">Score {risk.score}/100</div>
            </div>
        </div>
    );
}

export default function ClinicalDecisionSupport() {
    const user = JSON.parse(sessionStorage.getItem('zi_user') || '{}');

    // ── Tabs ──
    const [tab, setTab] = useState('patients');
    const [loading, setLoading] = useState(true);

    // ── Data ──
    const [patients, setPatients] = useState([]);
    const [stats, setStats] = useState(null);
    const [selectedPatient, setSelectedPatient] = useState(null);
    const [patientRecord, setPatientRecord] = useState(null);
    const [alerts, setAlerts] = useState(null);
    const [alertHistory, setAlertHistory] = useState([]);
    const [historyExpanded, setHistoryExpanded] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

    // ── Forms ──
    const [patientForm, setPatientForm] = useState({ patient_id: '', name: '', age: '', gender: 'Male', history: '', assigned_doctor: '', notes: '' });
    const [vitalsForm, setVitalsForm] = useState({ heart_rate: '', systolic_bp: '', diastolic_bp: '', oxygen_level: '', temperature: '' });
    const [labsForm, setLabsForm] = useState({ glucose: '', hemoglobin: '', cholesterol: '', wbc: '', creatinine: '', potassium: '' });
    const [medForm, setMedForm] = useState({ drug_name: '', dosage: '' });
    const [allergyForm, setAllergyForm] = useState({ allergy_type: '', severity: 'moderate' });
    const [submitting, setSubmitting] = useState(false);
    const [feedback, setFeedback] = useState(null);
    const [alertsLoading, setAlertsLoading] = useState(false);

    // ── Data fetching ──
    const fetchPatients = useCallback(async () => {
        setLoading(true);
        try {
            const res = await cdssListPatients(100);
            setPatients(res.data?.patients || res.patients || []);
        } catch (err) { console.error('CDSS fetch error:', err); }
        finally { setLoading(false); }
    }, []);

    const fetchStats = useCallback(async () => {
        try {
            const res = await cdssGetStats();
            setStats(res.data || res);
        } catch (err) { console.error('Stats error:', err); }
    }, []);

    useEffect(() => { fetchPatients(); fetchStats(); }, [fetchPatients, fetchStats]);

    // ── Select patient & load full record ──
    const selectPatient = async (pid) => {
        setSelectedPatient(pid);
        setAlerts(null);
        setPatientRecord(null);
        setAlertHistory([]);
        try {
            const [rec, hist] = await Promise.all([
                cdssGetPatient(pid),
                cdssGetHistory(pid, 10),
            ]);
            setPatientRecord(rec.data || rec);
            setAlertHistory((hist.data || hist).history || []);
        } catch (err) { console.error('Patient record error:', err); }
    };

    // ── Run CDSS evaluation ──
    const runAlerts = async () => {
        if (!selectedPatient) return;
        setAlertsLoading(true);
        try {
            const res = await cdssGetAlerts(selectedPatient, true);
            setAlerts(res.data || res);
        } catch (err) { console.error('Alerts error:', err); }
        finally { setAlertsLoading(false); }
    };

    // ── Form submissions ──
    const showFeedback = (msg, ok = true) => {
        setFeedback({ msg, ok });
        setTimeout(() => setFeedback(null), 3000);
    };

    const handleAddPatient = async () => {
        if (!patientForm.patient_id.trim() || !patientForm.name.trim() || !patientForm.age) return;
        setSubmitting(true);
        try {
            await cdssUpsertPatient({
                ...patientForm,
                age: Number(patientForm.age),
                history: patientForm.history ? patientForm.history.split(',').map(s => s.trim()).filter(Boolean) : [],
            });
            showFeedback('Patient registered');
            setPatientForm({ patient_id: '', name: '', age: '', gender: 'Male', history: '', assigned_doctor: '', notes: '' });
            fetchPatients();
        } catch (err) { showFeedback(err.response?.data?.detail || 'Error', false); }
        finally { setSubmitting(false); }
    };

    const handleVitals = async () => {
        if (!selectedPatient) return;
        setSubmitting(true);
        try {
            const payload = { patient_id: selectedPatient, recorded_by: user.name || user.email };
            Object.entries(vitalsForm).forEach(([k, v]) => { if (v !== '') payload[k] = Number(v); });
            const res = await cdssSubmitVitals(payload);
            const data = res.data || res;
            const n = data.instant_alerts?.length || 0;
            showFeedback(`Vitals saved${n ? ` — ${n} alert(s) detected` : ''}`);
            setVitalsForm({ heart_rate: '', systolic_bp: '', diastolic_bp: '', oxygen_level: '', temperature: '' });
            selectPatient(selectedPatient);
        } catch (err) { showFeedback(err.response?.data?.detail || 'Error', false); }
        finally { setSubmitting(false); }
    };

    const handleLabs = async () => {
        if (!selectedPatient) return;
        setSubmitting(true);
        try {
            const payload = { patient_id: selectedPatient, ordered_by: user.name || user.email };
            Object.entries(labsForm).forEach(([k, v]) => { if (v !== '') payload[k] = Number(v); });
            const res = await cdssSubmitLabs(payload);
            const data = res.data || res;
            const n = data.instant_alerts?.length || 0;
            showFeedback(`Labs saved${n ? ` — ${n} alert(s) detected` : ''}`);
            setLabsForm({ glucose: '', hemoglobin: '', cholesterol: '', wbc: '', creatinine: '', potassium: '' });
            selectPatient(selectedPatient);
        } catch (err) { showFeedback(err.response?.data?.detail || 'Error', false); }
        finally { setSubmitting(false); }
    };

    const handleMed = async () => {
        if (!selectedPatient || !medForm.drug_name.trim()) return;
        setSubmitting(true);
        try {
            await cdssSubmitMedication({ patient_id: selectedPatient, ...medForm, prescribed_by: user.name || user.email });
            showFeedback(`Medication "${medForm.drug_name}" added`);
            setMedForm({ drug_name: '', dosage: '' });
            selectPatient(selectedPatient);
        } catch (err) { showFeedback(err.response?.data?.detail || 'Error', false); }
        finally { setSubmitting(false); }
    };

    const handleAllergy = async () => {
        if (!selectedPatient || !allergyForm.allergy_type.trim()) return;
        setSubmitting(true);
        try {
            await cdssSubmitAllergy({ patient_id: selectedPatient, ...allergyForm });
            showFeedback(`Allergy "${allergyForm.allergy_type}" recorded`);
            setAllergyForm({ allergy_type: '', severity: 'moderate' });
            selectPatient(selectedPatient);
        } catch (err) { showFeedback(err.response?.data?.detail || 'Error', false); }
        finally { setSubmitting(false); }
    };

    // ── Filtered patients ──
    const filtered = patients.filter(p =>
        p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.patient_id?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const TABS = [
        { key: 'patients', label: 'Patients', icon: User },
        { key: 'evaluate', label: 'Evaluate', icon: ShieldCheck },
        { key: 'data_entry', label: 'Data Entry', icon: Plus },
        { key: 'history', label: 'History', icon: History },
        { key: 'stats', label: 'Analytics', icon: BarChart3 },
    ];

    const pr = patientRecord; // shorthand

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-red-50/20 p-4 md:p-6 pb-24">
            {/* Header */}
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
                <div className="flex items-center gap-3 mb-1">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center shadow-lg">
                        <ShieldCheck size={20} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-gray-900">Clinical Decision Support</h1>
                        <p className="text-xs text-gray-500">Rule-based alerts, risk scoring & AI recommendations — advisory only</p>
                    </div>
                </div>
            </motion.div>

            {/* Tabs */}
            <div className="flex gap-1 mb-6 bg-white/80 backdrop-blur rounded-xl p-1 shadow-sm border border-gray-100 w-fit overflow-x-auto">
                {TABS.map(t => (
                    <button key={t.key} onClick={() => setTab(t.key)}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${
                            tab === t.key ? 'bg-red-500 text-white shadow-md' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}>
                        <t.icon size={15} /> {t.label}
                    </button>
                ))}
            </div>

            {/* Feedback toast */}
            <AnimatePresence>
                {feedback && (
                    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                        className={`fixed top-4 right-4 z-50 px-4 py-2.5 rounded-xl text-sm font-bold shadow-lg ${
                            feedback.ok ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
                        {feedback.msg}
                    </motion.div>
                )}
            </AnimatePresence>

            {loading && tab !== 'stats' ? (
                <div className="flex items-center justify-center py-24">
                    <Loader2 className="animate-spin text-red-500" size={32} />
                </div>
            ) : (
                <>
                    {/* ════════════════════════════════════════ */}
                    {/* PATIENTS TAB */}
                    {/* ════════════════════════════════════════ */}
                    {tab === 'patients' && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                            {/* Search + Add */}
                            <div className="flex flex-col md:flex-row gap-3">
                                <div className="flex-1 relative">
                                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                    <input placeholder="Search patients by name or ID..." value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                        className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-200" />
                                </div>
                                <button onClick={fetchPatients}
                                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 transition-colors">
                                    <RefreshCw size={13} /> Refresh
                                </button>
                            </div>

                            {/* Register New Patient */}
                            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                                <div className="flex items-center gap-2 mb-3">
                                    <Plus className="text-red-500" size={18} />
                                    <h3 className="text-sm font-bold text-gray-800">Register New CDSS Patient</h3>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-3">
                                    <input placeholder="Patient ID *" value={patientForm.patient_id}
                                        onChange={e => setPatientForm(p => ({ ...p, patient_id: e.target.value }))}
                                        className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-200" />
                                    <input placeholder="Full Name *" value={patientForm.name}
                                        onChange={e => setPatientForm(p => ({ ...p, name: e.target.value }))}
                                        className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-200" />
                                    <input placeholder="Age *" type="number" value={patientForm.age}
                                        onChange={e => setPatientForm(p => ({ ...p, age: e.target.value }))}
                                        className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-200" />
                                    <select value={patientForm.gender}
                                        onChange={e => setPatientForm(p => ({ ...p, gender: e.target.value }))}
                                        className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-200">
                                        <option>Male</option><option>Female</option><option>Other</option>
                                    </select>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 mb-3">
                                    <input placeholder="Medical History (comma-separated, e.g. diabetes, hypertension)" value={patientForm.history}
                                        onChange={e => setPatientForm(p => ({ ...p, history: e.target.value }))}
                                        className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-200" />
                                    <input placeholder="Notes" value={patientForm.notes}
                                        onChange={e => setPatientForm(p => ({ ...p, notes: e.target.value }))}
                                        className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-200" />
                                </div>
                                <button onClick={handleAddPatient} disabled={submitting || !patientForm.patient_id || !patientForm.name || !patientForm.age}
                                    className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 transition-all shadow disabled:opacity-50">
                                    {submitting ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Register Patient
                                </button>
                            </div>

                            {/* Patient List */}
                            {filtered.length === 0 ? (
                                <div className="text-center py-16 text-gray-400">
                                    <User size={40} className="mx-auto mb-3 opacity-40" />
                                    <p className="font-bold">No patients found</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {filtered.map((p, i) => (
                                        <motion.div key={p.patient_id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: i * 0.03 }}
                                            onClick={() => { selectPatient(p.patient_id); setTab('evaluate'); }}
                                            className={`bg-white rounded-2xl shadow-sm border p-4 cursor-pointer transition-all hover:shadow-md ${
                                                selectedPatient === p.patient_id ? 'border-red-300 ring-2 ring-red-100' : 'border-gray-100'}`}>
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-100 to-rose-100 flex items-center justify-center">
                                                    <User size={18} className="text-red-500" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-bold text-sm text-gray-900 truncate">{p.name}</div>
                                                    <div className="text-[10px] text-gray-400 font-mono">{p.patient_id}</div>
                                                </div>
                                            </div>
                                            <div className="mt-3 flex flex-wrap gap-1.5 text-[10px]">
                                                <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-bold">Age {p.age}</span>
                                                <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-bold">{p.gender}</span>
                                                {p.history?.slice(0, 3).map((h, j) => (
                                                    <span key={j} className="px-2 py-0.5 rounded-full bg-red-50 text-red-600 font-bold">{h}</span>
                                                ))}
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            )}
                        </motion.div>
                    )}

                    {/* ════════════════════════════════════════ */}
                    {/* EVALUATE TAB */}
                    {/* ════════════════════════════════════════ */}
                    {tab === 'evaluate' && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
                            {!selectedPatient ? (
                                <div className="text-center py-16 text-gray-400">
                                    <ShieldCheck size={40} className="mx-auto mb-3 opacity-40" />
                                    <p className="font-bold">Select a patient from the Patients tab first</p>
                                </div>
                            ) : (
                                <>
                                    {/* Patient header card */}
                                    {pr && (
                                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                                            <div className="flex items-start justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center">
                                                        <User size={22} className="text-white" />
                                                    </div>
                                                    <div>
                                                        <h2 className="text-lg font-black text-gray-900">{pr.patient?.name}</h2>
                                                        <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500">
                                                            <span className="font-mono">{pr.patient?.patient_id}</span>
                                                            <span>Age {pr.patient?.age}</span>
                                                            <span>{pr.patient?.gender}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <button onClick={runAlerts} disabled={alertsLoading}
                                                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 transition-all shadow disabled:opacity-50">
                                                    {alertsLoading ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />} Run CDSS Evaluation
                                                </button>
                                            </div>

                                            {/* Quick clinical snapshot */}
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                                                {pr.patient?.history?.length > 0 && (
                                                    <div className="bg-red-50 rounded-xl p-3">
                                                        <div className="text-[10px] uppercase text-red-400 font-bold mb-1">History</div>
                                                        <div className="flex flex-wrap gap-1">
                                                            {pr.patient.history.map((h, i) => (
                                                                <span key={i} className="text-[10px] px-1.5 py-0.5 bg-red-100 text-red-700 rounded-full font-bold">{h}</span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                                <div className="bg-blue-50 rounded-xl p-3">
                                                    <div className="text-[10px] uppercase text-blue-400 font-bold mb-1">Medications</div>
                                                    <div className="text-sm font-black text-blue-700">{pr.medications?.length || 0}</div>
                                                </div>
                                                <div className="bg-amber-50 rounded-xl p-3">
                                                    <div className="text-[10px] uppercase text-amber-400 font-bold mb-1">Allergies</div>
                                                    <div className="text-sm font-black text-amber-700">{pr.allergies?.length || 0}</div>
                                                </div>
                                                {Object.keys(pr.latest_vitals || {}).length > 0 && (
                                                    <div className="bg-green-50 rounded-xl p-3">
                                                        <div className="text-[10px] uppercase text-green-400 font-bold mb-1">Latest Vitals</div>
                                                        <div className="text-[10px] space-y-0.5 text-green-700 font-bold">
                                                            {pr.latest_vitals.systolic_bp && <div>BP: {pr.latest_vitals.systolic_bp}/{pr.latest_vitals.diastolic_bp}</div>}
                                                            {pr.latest_vitals.heart_rate && <div>HR: {pr.latest_vitals.heart_rate} bpm</div>}
                                                            {pr.latest_vitals.oxygen_level && <div>SpO2: {pr.latest_vitals.oxygen_level}%</div>}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Current medications & allergies chips */}
                                            {(pr.medications?.length > 0 || pr.allergies?.length > 0) && (
                                                <div className="mt-3 flex flex-wrap gap-1.5">
                                                    {pr.medications?.map((m, i) => (
                                                        <span key={i} className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-bold border border-blue-100">
                                                            <Pill size={9} /> {m.drug_name}
                                                        </span>
                                                    ))}
                                                    {pr.allergies?.map((a, i) => (
                                                        <span key={i} className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-bold border border-amber-100">
                                                            <ShieldAlert size={9} /> {a.allergy_type}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* ── CDSS Evaluation Results ── */}
                                    <AnimatePresence>
                                        {alerts && (
                                            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                                                {/* Risk Score + Summary */}
                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                                                        <div className="text-[10px] uppercase text-gray-400 font-bold mb-3 flex items-center gap-1"><TrendingUp size={10} /> Risk Score</div>
                                                        <RiskGauge risk={alerts.risk_score} />
                                                        {alerts.risk_score?.factors?.length > 0 && (
                                                            <div className="mt-3 space-y-1">
                                                                {alerts.risk_score.factors.map((f, i) => (
                                                                    <div key={i} className="flex items-center gap-2 text-[10px] text-gray-500">
                                                                        <div className="w-1 h-1 rounded-full bg-gray-300" />
                                                                        {f}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                                                        <div className="text-[10px] uppercase text-gray-400 font-bold mb-3 flex items-center gap-1"><ListChecks size={10} /> Alert Summary</div>
                                                        {alerts.alert_summary && (
                                                            <div className="space-y-2">
                                                                {Object.entries(alerts.alert_summary).map(([sev, count]) => {
                                                                    if (count === 0) return null;
                                                                    const c = SEV[sev] || SEV.info;
                                                                    return (
                                                                        <div key={sev} className="flex items-center gap-2">
                                                                            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: c.bg }}>
                                                                                <c.icon size={14} style={{ color: c.text }} />
                                                                            </div>
                                                                            <div>
                                                                                <div className="text-sm font-black" style={{ color: c.text }}>{count}</div>
                                                                                <div className="text-[10px] text-gray-400 font-bold uppercase">{sev}</div>
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                                                        <div className="text-[10px] uppercase text-gray-400 font-bold mb-3 flex items-center gap-1"><Clock size={10} /> Evaluation Info</div>
                                                        <div className="space-y-2 text-xs text-gray-600">
                                                            <div><span className="text-gray-400">Patient:</span> <strong>{alerts.patient_name}</strong></div>
                                                            <div><span className="text-gray-400">Total Alerts:</span> <strong>{alerts.alerts?.length || 0}</strong></div>
                                                            <div><span className="text-gray-400">Generated:</span> <strong>{new Date(alerts.generated_at).toLocaleString()}</strong></div>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* All Clinical Alerts */}
                                                {alerts.alerts?.length > 0 && (
                                                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                                                        <div className="text-[10px] uppercase text-gray-400 font-bold mb-4 flex items-center gap-1">
                                                            <CircleAlert size={10} /> Clinical Alerts ({alerts.alerts.length})
                                                        </div>
                                                        <div className="space-y-3">
                                                            {alerts.alerts.map((a, i) => {
                                                                const c = SEV[a.severity] || SEV.info;
                                                                return (
                                                                    <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                                                                        transition={{ delay: i * 0.04 }}
                                                                        className="rounded-xl p-3 border"
                                                                        style={{ backgroundColor: c.bg + '40', borderColor: c.border }}>
                                                                        <div className="flex items-start gap-2">
                                                                            <c.icon size={16} style={{ color: c.text }} className="mt-0.5 flex-shrink-0" />
                                                                            <div className="flex-1">
                                                                                <div className="flex items-center gap-2 mb-1">
                                                                                    <SeverityBadge severity={a.severity} />
                                                                                    <span className="text-[10px] text-gray-400 font-bold uppercase">{a.alert_type?.replace(/_/g, ' ')}</span>
                                                                                </div>
                                                                                <p className="text-sm font-bold text-gray-800">{a.message}</p>
                                                                                <p className="text-xs text-gray-500 mt-1">{a.recommendation}</p>
                                                                            </div>
                                                                        </div>
                                                                    </motion.div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* AI Recommendations */}
                                                {alerts.ai_recommendations && !alerts.ai_recommendations.error && (
                                                    <div className="bg-white rounded-2xl shadow-sm border border-purple-100 p-5">
                                                        <div className="text-[10px] uppercase text-purple-400 font-bold mb-4 flex items-center gap-1">
                                                            <Sparkles size={10} /> AI-Powered Recommendations
                                                        </div>
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                            {alerts.ai_recommendations.summary && (
                                                                <div className="md:col-span-2 bg-purple-50 rounded-xl p-4 border border-purple-100">
                                                                    <div className="text-[10px] uppercase text-purple-400 font-bold mb-1">Summary</div>
                                                                    <p className="text-sm text-gray-700">{alerts.ai_recommendations.summary}</p>
                                                                </div>
                                                            )}
                                                            {alerts.ai_recommendations.monitoring_suggestions?.length > 0 && (
                                                                <div className="bg-blue-50 rounded-xl p-3 border border-blue-100">
                                                                    <div className="text-[10px] uppercase text-blue-400 font-bold mb-2 flex items-center gap-1"><Activity size={10} /> Monitoring</div>
                                                                    <ul className="space-y-1">
                                                                        {alerts.ai_recommendations.monitoring_suggestions.map((s, j) => (
                                                                            <li key={j} className="text-xs text-gray-600 flex items-start gap-1.5">
                                                                                <div className="w-1 h-1 rounded-full bg-blue-400 mt-1.5 flex-shrink-0" />{s}
                                                                            </li>
                                                                        ))}
                                                                    </ul>
                                                                </div>
                                                            )}
                                                            {alerts.ai_recommendations.lifestyle_recommendations?.length > 0 && (
                                                                <div className="bg-green-50 rounded-xl p-3 border border-green-100">
                                                                    <div className="text-[10px] uppercase text-green-400 font-bold mb-2 flex items-center gap-1"><Heart size={10} /> Lifestyle</div>
                                                                    <ul className="space-y-1">
                                                                        {alerts.ai_recommendations.lifestyle_recommendations.map((s, j) => (
                                                                            <li key={j} className="text-xs text-gray-600 flex items-start gap-1.5">
                                                                                <div className="w-1 h-1 rounded-full bg-green-400 mt-1.5 flex-shrink-0" />{s}
                                                                            </li>
                                                                        ))}
                                                                    </ul>
                                                                </div>
                                                            )}
                                                            {alerts.ai_recommendations.follow_up_reminders?.length > 0 && (
                                                                <div className="bg-amber-50 rounded-xl p-3 border border-amber-100">
                                                                    <div className="text-[10px] uppercase text-amber-400 font-bold mb-2 flex items-center gap-1"><Clock size={10} /> Follow-up</div>
                                                                    <ul className="space-y-1">
                                                                        {alerts.ai_recommendations.follow_up_reminders.map((s, j) => (
                                                                            <li key={j} className="text-xs text-gray-600 flex items-start gap-1.5">
                                                                                <div className="w-1 h-1 rounded-full bg-amber-400 mt-1.5 flex-shrink-0" />{s}
                                                                            </li>
                                                                        ))}
                                                                    </ul>
                                                                </div>
                                                            )}
                                                            {alerts.ai_recommendations.additional_tests?.length > 0 && (
                                                                <div className="bg-rose-50 rounded-xl p-3 border border-rose-100">
                                                                    <div className="text-[10px] uppercase text-rose-400 font-bold mb-2 flex items-center gap-1"><Beaker size={10} /> Additional Tests</div>
                                                                    <ul className="space-y-1">
                                                                        {alerts.ai_recommendations.additional_tests.map((s, j) => (
                                                                            <li key={j} className="text-xs text-gray-600 flex items-start gap-1.5">
                                                                                <div className="w-1 h-1 rounded-full bg-rose-400 mt-1.5 flex-shrink-0" />{s}
                                                                            </li>
                                                                        ))}
                                                                    </ul>
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="mt-3 text-[10px] text-gray-400 italic">
                                                            Advisory only — AI recommendations support but do not replace clinical judgment.
                                                        </div>
                                                    </div>
                                                )}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>

                                    {/* Prompt if no evaluation run yet */}
                                    {!alerts && !alertsLoading && pr && (
                                        <div className="text-center py-12 text-gray-400">
                                            <ShieldCheck size={40} className="mx-auto mb-3 opacity-30" />
                                            <p className="font-bold text-sm">Click &ldquo;Run CDSS Evaluation&rdquo; to generate alerts</p>
                                            <p className="text-xs mt-1">Rule-based analysis + AI recommendations</p>
                                        </div>
                                    )}
                                </>
                            )}
                        </motion.div>
                    )}

                    {/* ════════════════════════════════════════ */}
                    {/* DATA ENTRY TAB */}
                    {/* ════════════════════════════════════════ */}
                    {tab === 'data_entry' && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                            {!selectedPatient ? (
                                <div className="text-center py-16 text-gray-400">
                                    <Plus size={40} className="mx-auto mb-3 opacity-40" />
                                    <p className="font-bold">Select a patient from the Patients tab first</p>
                                </div>
                            ) : (
                                <div className="max-w-3xl mx-auto space-y-5">
                                    <div className="bg-red-50 rounded-xl p-3 border border-red-100 flex items-center gap-2 text-sm">
                                        <User size={16} className="text-red-500" />
                                        <span className="font-bold text-red-700">{selectedPatient}</span>
                                        <span className="text-red-400">— {pr?.patient?.name || 'Loading...'}</span>
                                    </div>

                                    {/* Vitals Form */}
                                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                                        <div className="flex items-center gap-2 mb-3">
                                            <Heart className="text-rose-500" size={18} />
                                            <h3 className="text-sm font-bold text-gray-800">Submit Vital Signs</h3>
                                        </div>
                                        <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5 mb-3">
                                            <div>
                                                <label className="text-[10px] text-gray-400 font-bold uppercase">Heart Rate (bpm)</label>
                                                <input type="number" placeholder="e.g. 80" value={vitalsForm.heart_rate}
                                                    onChange={e => setVitalsForm(p => ({ ...p, heart_rate: e.target.value }))}
                                                    className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-rose-200" />
                                            </div>
                                            <div>
                                                <label className="text-[10px] text-gray-400 font-bold uppercase">Systolic BP</label>
                                                <input type="number" placeholder="e.g. 120" value={vitalsForm.systolic_bp}
                                                    onChange={e => setVitalsForm(p => ({ ...p, systolic_bp: e.target.value }))}
                                                    className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-rose-200" />
                                            </div>
                                            <div>
                                                <label className="text-[10px] text-gray-400 font-bold uppercase">Diastolic BP</label>
                                                <input type="number" placeholder="e.g. 80" value={vitalsForm.diastolic_bp}
                                                    onChange={e => setVitalsForm(p => ({ ...p, diastolic_bp: e.target.value }))}
                                                    className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-rose-200" />
                                            </div>
                                            <div>
                                                <label className="text-[10px] text-gray-400 font-bold uppercase">SpO2 (%)</label>
                                                <input type="number" placeholder="e.g. 98" value={vitalsForm.oxygen_level}
                                                    onChange={e => setVitalsForm(p => ({ ...p, oxygen_level: e.target.value }))}
                                                    className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-rose-200" />
                                            </div>
                                            <div>
                                                <label className="text-[10px] text-gray-400 font-bold uppercase">Temp (&deg;C)</label>
                                                <input type="number" step="0.1" placeholder="e.g. 37.0" value={vitalsForm.temperature}
                                                    onChange={e => setVitalsForm(p => ({ ...p, temperature: e.target.value }))}
                                                    className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-rose-200" />
                                            </div>
                                        </div>
                                        <button onClick={handleVitals} disabled={submitting}
                                            className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 transition-all shadow disabled:opacity-50">
                                            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Activity size={14} />} Submit Vitals
                                        </button>
                                    </div>

                                    {/* Labs Form */}
                                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                                        <div className="flex items-center gap-2 mb-3">
                                            <Beaker className="text-indigo-500" size={18} />
                                            <h3 className="text-sm font-bold text-gray-800">Submit Lab Results</h3>
                                        </div>
                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5 mb-3">
                                            <div>
                                                <label className="text-[10px] text-gray-400 font-bold uppercase">Glucose (mg/dL)</label>
                                                <input type="number" placeholder="e.g. 100" value={labsForm.glucose}
                                                    onChange={e => setLabsForm(p => ({ ...p, glucose: e.target.value }))}
                                                    className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200" />
                                            </div>
                                            <div>
                                                <label className="text-[10px] text-gray-400 font-bold uppercase">Hemoglobin (g/dL)</label>
                                                <input type="number" step="0.1" placeholder="e.g. 14.0" value={labsForm.hemoglobin}
                                                    onChange={e => setLabsForm(p => ({ ...p, hemoglobin: e.target.value }))}
                                                    className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200" />
                                            </div>
                                            <div>
                                                <label className="text-[10px] text-gray-400 font-bold uppercase">Cholesterol (mg/dL)</label>
                                                <input type="number" placeholder="e.g. 200" value={labsForm.cholesterol}
                                                    onChange={e => setLabsForm(p => ({ ...p, cholesterol: e.target.value }))}
                                                    className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200" />
                                            </div>
                                            <div>
                                                <label className="text-[10px] text-gray-400 font-bold uppercase">WBC (cells/uL)</label>
                                                <input type="number" placeholder="e.g. 7000" value={labsForm.wbc}
                                                    onChange={e => setLabsForm(p => ({ ...p, wbc: e.target.value }))}
                                                    className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200" />
                                            </div>
                                            <div>
                                                <label className="text-[10px] text-gray-400 font-bold uppercase">Creatinine (mg/dL)</label>
                                                <input type="number" step="0.1" placeholder="e.g. 1.0" value={labsForm.creatinine}
                                                    onChange={e => setLabsForm(p => ({ ...p, creatinine: e.target.value }))}
                                                    className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200" />
                                            </div>
                                            <div>
                                                <label className="text-[10px] text-gray-400 font-bold uppercase">Potassium (mEq/L)</label>
                                                <input type="number" step="0.1" placeholder="e.g. 4.0" value={labsForm.potassium}
                                                    onChange={e => setLabsForm(p => ({ ...p, potassium: e.target.value }))}
                                                    className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200" />
                                            </div>
                                        </div>
                                        <button onClick={handleLabs} disabled={submitting}
                                            className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 transition-all shadow disabled:opacity-50">
                                            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Beaker size={14} />} Submit Labs
                                        </button>
                                    </div>

                                    {/* Medication + Allergy row */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                        {/* Medication */}
                                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                                            <div className="flex items-center gap-2 mb-3">
                                                <Pill className="text-blue-500" size={18} />
                                                <h3 className="text-sm font-bold text-gray-800">Add Medication</h3>
                                            </div>
                                            <div className="space-y-2.5 mb-3">
                                                <input placeholder="Drug Name *" value={medForm.drug_name}
                                                    onChange={e => setMedForm(p => ({ ...p, drug_name: e.target.value }))}
                                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
                                                <input placeholder="Dosage (e.g. 500mg twice daily)" value={medForm.dosage}
                                                    onChange={e => setMedForm(p => ({ ...p, dosage: e.target.value }))}
                                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
                                            </div>
                                            <button onClick={handleMed} disabled={submitting || !medForm.drug_name.trim()}
                                                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-white bg-blue-500 hover:bg-blue-600 transition-all shadow disabled:opacity-50">
                                                {submitting ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Add
                                            </button>
                                        </div>

                                        {/* Allergy */}
                                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                                            <div className="flex items-center gap-2 mb-3">
                                                <ShieldAlert className="text-amber-500" size={18} />
                                                <h3 className="text-sm font-bold text-gray-800">Add Allergy</h3>
                                            </div>
                                            <div className="space-y-2.5 mb-3">
                                                <input placeholder="Allergy Type * (e.g. penicillin)" value={allergyForm.allergy_type}
                                                    onChange={e => setAllergyForm(p => ({ ...p, allergy_type: e.target.value }))}
                                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200" />
                                                <select value={allergyForm.severity}
                                                    onChange={e => setAllergyForm(p => ({ ...p, severity: e.target.value }))}
                                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200">
                                                    <option value="mild">Mild</option>
                                                    <option value="moderate">Moderate</option>
                                                    <option value="severe">Severe</option>
                                                </select>
                                            </div>
                                            <button onClick={handleAllergy} disabled={submitting || !allergyForm.allergy_type.trim()}
                                                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-white bg-amber-500 hover:bg-amber-600 transition-all shadow disabled:opacity-50">
                                                {submitting ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Add
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    )}

                    {/* ════════════════════════════════════════ */}
                    {/* HISTORY TAB */}
                    {/* ════════════════════════════════════════ */}
                    {tab === 'history' && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                            {!selectedPatient ? (
                                <div className="text-center py-16 text-gray-400">
                                    <History size={40} className="mx-auto mb-3 opacity-40" />
                                    <p className="font-bold">Select a patient from the Patients tab first</p>
                                </div>
                            ) : (
                                <>
                                    <div className="bg-red-50 rounded-xl p-3 border border-red-100 flex items-center gap-2 text-sm">
                                        <User size={16} className="text-red-500" />
                                        <span className="font-bold text-red-700">{selectedPatient}</span>
                                        <span className="text-red-400">— Alert History</span>
                                    </div>

                                    {alertHistory.length === 0 ? (
                                        <div className="text-center py-16 text-gray-400">
                                            <FileText size={40} className="mx-auto mb-3 opacity-40" />
                                            <p className="font-bold">No alert history yet</p>
                                            <p className="text-xs mt-1">Run a CDSS evaluation first</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {alertHistory.map((snap, idx) => {
                                                const expanded = historyExpanded === idx;
                                                return (
                                                    <motion.div key={snap._id || idx} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                                                        transition={{ delay: idx * 0.04 }}
                                                        className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                                                        <div className="p-4 flex items-center gap-3 cursor-pointer" onClick={() => setHistoryExpanded(expanded ? null : idx)}>
                                                            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                                                                style={{ backgroundColor: (RISK[snap.risk_score?.level] || RISK.LOW).ring }}>
                                                                <ShieldCheck size={18} style={{ color: (RISK[snap.risk_score?.level] || RISK.LOW).text }} />
                                                            </div>
                                                            <div className="flex-1">
                                                                <div className="flex items-center gap-2 text-sm">
                                                                    <span className="font-bold text-gray-900">Risk: {snap.risk_score?.level || 'N/A'}</span>
                                                                    <span className="text-gray-300">|</span>
                                                                    <span className="text-gray-500">{snap.alerts?.length || 0} alerts</span>
                                                                </div>
                                                                <div className="text-[10px] text-gray-400 flex items-center gap-1 mt-0.5">
                                                                    <Clock size={9} /> {new Date(snap.generated_at).toLocaleString()}
                                                                </div>
                                                            </div>
                                                            <div className="flex gap-1">
                                                                {['critical', 'high', 'medium', 'low'].map(sev => {
                                                                    const count = snap.alerts?.filter(a => a.severity === sev).length || 0;
                                                                    if (!count) return null;
                                                                    const c = SEV[sev];
                                                                    return <span key={sev} className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ backgroundColor: c.bg, color: c.text }}>{count}</span>;
                                                                })}
                                                            </div>
                                                            {expanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                                                        </div>

                                                        <AnimatePresence>
                                                            {expanded && (
                                                                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                                                                    exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-t border-gray-100">
                                                                    <div className="p-4 space-y-2 bg-gray-50/50">
                                                                        {snap.alerts?.map((a, ai) => {
                                                                            const c = SEV[a.severity] || SEV.info;
                                                                            return (
                                                                                <div key={ai} className="flex items-start gap-2 text-xs">
                                                                                    <c.icon size={12} style={{ color: c.text }} className="mt-0.5 flex-shrink-0" />
                                                                                    <div>
                                                                                        <span className="font-bold text-gray-700">{a.message}</span>
                                                                                        <p className="text-gray-400 text-[10px]">{a.recommendation}</p>
                                                                                    </div>
                                                                                </div>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                </motion.div>
                                                            )}
                                                        </AnimatePresence>
                                                    </motion.div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </>
                            )}
                        </motion.div>
                    )}

                    {/* ════════════════════════════════════════ */}
                    {/* STATS TAB */}
                    {/* ════════════════════════════════════════ */}
                    {tab === 'stats' && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                            {!stats ? (
                                <div className="flex items-center justify-center py-24">
                                    <Loader2 className="animate-spin text-red-500" size={32} />
                                </div>
                            ) : (
                                <>
                                    {/* Summary cards */}
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                        {[
                                            { label: 'Total Patients', value: stats.total_patients || 0, color: '#DC2626', icon: User },
                                            { label: 'Active Alerts', value: stats.total_active_alerts || 0, color: '#D97706', icon: AlertTriangle },
                                            { label: 'Active Meds', value: stats.active_medications || 0, color: '#2563EB', icon: Pill },
                                            { label: 'Allergies Tracked', value: stats.total_allergies || 0, color: '#059669', icon: ShieldAlert },
                                        ].map((card, i) => (
                                            <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
                                                className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: card.color + '15' }}>
                                                        <card.icon size={16} style={{ color: card.color }} />
                                                    </div>
                                                </div>
                                                <div className="text-2xl font-black" style={{ color: card.color }}>{card.value}</div>
                                                <div className="text-[10px] text-gray-400 font-bold uppercase">{card.label}</div>
                                            </motion.div>
                                        ))}
                                    </div>

                                    {/* Risk Distribution */}
                                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                                        <h3 className="font-bold text-sm text-gray-700 mb-4 flex items-center gap-2"><TrendingUp size={16} /> Risk Distribution</h3>
                                        <div className="grid grid-cols-3 gap-3">
                                            {stats.risk_distribution && Object.entries(stats.risk_distribution).map(([level, count]) => {
                                                const c = RISK[level] || RISK.LOW;
                                                return (
                                                    <div key={level} className="rounded-xl p-4 text-center" style={{ backgroundColor: c.ring }}>
                                                        <div className="text-3xl font-black" style={{ color: c.text }}>{count}</div>
                                                        <div className="text-xs font-bold mt-1" style={{ color: c.text }}>{level}</div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Alert Severity Distribution */}
                                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                                        <h3 className="font-bold text-sm text-gray-700 mb-4 flex items-center gap-2"><CircleAlert size={16} /> Alert Severity Distribution</h3>
                                        <div className="space-y-3">
                                            {stats.alert_severity_distribution && Object.entries(stats.alert_severity_distribution).map(([sev, count]) => {
                                                const c = SEV[sev] || SEV.info;
                                                const total = stats.total_active_alerts || 1;
                                                const pct = Math.round((count / total) * 100);
                                                return (
                                                    <div key={sev} className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: c.bg }}>
                                                            <c.icon size={14} style={{ color: c.text }} />
                                                        </div>
                                                        <span className="text-xs font-bold w-16 capitalize" style={{ color: c.text }}>{sev}</span>
                                                        <div className="flex-1 h-3 rounded-full bg-gray-100 overflow-hidden">
                                                            <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                                                                className="h-full rounded-full" style={{ backgroundColor: c.text }} />
                                                        </div>
                                                        <span className="text-xs font-bold text-gray-500 w-16 text-right">{count} ({pct}%)</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </>
                            )}
                        </motion.div>
                    )}
                </>
            )}
        </div>
    );
}
