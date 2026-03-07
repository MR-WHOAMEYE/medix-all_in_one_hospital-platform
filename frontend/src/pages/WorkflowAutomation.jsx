import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    GitBranch, Send, Brain, Clock, CheckCircle2, AlertTriangle,
    Filter, BarChart3, User, Building2, FileText, MessageSquare,
    Activity, ChevronDown, ChevronUp, Stethoscope, ArrowRight,
    XCircle, UserCheck, RotateCcw, Loader2, Search, Zap,
    Shield, Eye, TrendingUp, Hash
} from 'lucide-react';
import {
    submitWorkflowQuery, getWorkflowRequests, updateWorkflowStatus,
    assignWorkflowDoctor, getDoctorWorkflowRequests, doctorRespondWorkflow,
    getWorkflowLogs, getWorkflowDepartments, getWorkflowStats
} from '../services/api';

const STATUS_CONFIG = {
    NEW: { bg: '#DBEAFE', text: '#2563EB', label: 'New', icon: Clock, border: '#93C5FD' },
    ASSIGNED: { bg: '#FEF3C7', text: '#D97706', label: 'Assigned', icon: UserCheck, border: '#FDE68A' },
    IN_PROGRESS: { bg: '#E0E7FF', text: '#4F46E5', label: 'In Progress', icon: Activity, border: '#C7D2FE' },
    WAITING_FOR_PATIENT: { bg: '#FDE68A', text: '#92400E', label: 'Waiting', icon: Clock, border: '#FCD34D' },
    RESOLVED: { bg: '#D1FAE5', text: '#059669', label: 'Resolved', icon: CheckCircle2, border: '#6EE7B7' },
    CLOSED: { bg: '#F3F4F6', text: '#6B7280', label: 'Closed', icon: XCircle, border: '#D1D5DB' },
};

const URGENCY_COLORS = {
    urgent: { bg: '#FEE2E2', text: '#DC2626', border: '#FCA5A5' },
    high: { bg: '#FEE2E2', text: '#DC2626', border: '#FCA5A5' },
    medium: { bg: '#FEF3C7', text: '#D97706', border: '#FDE68A' },
    low: { bg: '#D1FAE5', text: '#059669', border: '#6EE7B7' },
};

const DEPT_ICONS = {
    Cardiology: '\u2764\uFE0F',
    Orthopedics: '\uD83E\uDDB4',
    Dermatology: '\uD83E\uDDD1\u200D\u2695\uFE0F',
    Neurology: '\uD83E\uDDE0',
    'General Medicine': '\uD83C\uDFE5',
    Billing: '\uD83D\uDCB3',
};

function StatusBadge({ status }) {
    const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.NEW;
    const Icon = cfg.icon;
    return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold border"
            style={{ backgroundColor: cfg.bg, color: cfg.text, borderColor: cfg.border }}>
            <Icon size={11} /> {cfg.label}
        </span>
    );
}

function UrgencyBadge({ urgency }) {
    const cfg = URGENCY_COLORS[urgency] || URGENCY_COLORS.medium;
    return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9px] font-bold uppercase border"
            style={{ backgroundColor: cfg.bg, color: cfg.text, borderColor: cfg.border }}>
            {(urgency === 'high' || urgency === 'urgent') && <AlertTriangle size={9} />}
            {urgency}
        </span>
    );
}

function ConfidenceBar({ value }) {
    const pct = Math.round((value || 0) * 100);
    const color = pct >= 90 ? '#059669' : pct >= 70 ? '#D97706' : '#DC2626';
    return (
        <div className="flex items-center gap-2">
            <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
            </div>
            <span className="text-[10px] font-bold" style={{ color }}>{pct}%</span>
        </div>
    );
}

export default function WorkflowAutomation() {
    const user = JSON.parse(sessionStorage.getItem('zi_user') || '{}');
    const isDoctor = user.role === 'doctor';

    const [tab, setTab] = useState(isDoctor ? 'my_requests' : 'submit');
    const [loading, setLoading] = useState(true);
    const [requests, setRequests] = useState([]);
    const [stats, setStats] = useState(null);
    const [departments, setDepartments] = useState([]);
    const [filterStatus, setFilterStatus] = useState('');
    const [filterDept, setFilterDept] = useState('');
    const [expandedId, setExpandedId] = useState(null);
    const [logsMap, setLogsMap] = useState({});
    const [searchText, setSearchText] = useState('');

    const [queryForm, setQueryForm] = useState({ patient_id: '', name: '', email: '', phone: '', query: '' });
    const [submitting, setSubmitting] = useState(false);
    const [submitResult, setSubmitResult] = useState(null);

    const [assignModal, setAssignModal] = useState(null);
    const [selectedDoctor, setSelectedDoctor] = useState('');
    const [assigning, setAssigning] = useState(false);

    const [respondModal, setRespondModal] = useState(null);
    const [responseText, setResponseText] = useState('');
    const [responding, setResponding] = useState(false);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const params = {};
            if (filterStatus) params.status = filterStatus;
            if (filterDept) params.department = filterDept;
            const [rData, sData, dData] = await Promise.all([
                isDoctor ? getDoctorWorkflowRequests({ doctor_email: user.email, ...params })
                         : getWorkflowRequests(params),
                getWorkflowStats(),
                getWorkflowDepartments(),
            ]);
            setRequests(rData.requests || []);
            setStats(sData);
            setDepartments(dData.departments || []);
        } catch (err) { console.error('Workflow fetch error:', err); }
        finally { setLoading(false); }
    }, [filterStatus, filterDept, isDoctor, user.email]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleSubmit = async () => {
        if (!queryForm.query.trim() || !queryForm.name.trim()) return;
        setSubmitting(true);
        setSubmitResult(null);
        try {
            const res = await submitWorkflowQuery({
                patient_id: queryForm.patient_id || 'WALK-IN',
                patient_name: queryForm.name,
                patient_email: queryForm.email,
                patient_phone: queryForm.phone,
                query: queryForm.query,
            });
            setSubmitResult(res);
            setQueryForm({ patient_id: '', name: '', email: '', phone: '', query: '' });
            fetchData();
        } catch (err) { console.error(err); }
        finally { setSubmitting(false); }
    };

    const handleAssign = async () => {
        if (!assignModal || !selectedDoctor) return;
        setAssigning(true);
        try {
            const doc = JSON.parse(selectedDoctor);
            await assignWorkflowDoctor({ request_id: assignModal._id || assignModal.id, doctor_name: doc.name, doctor_email: doc.email });
            setAssignModal(null);
            setSelectedDoctor('');
            fetchData();
        } catch (err) { console.error(err); }
        finally { setAssigning(false); }
    };

    const handleRespond = async () => {
        if (!respondModal || !responseText.trim()) return;
        setResponding(true);
        try {
            await doctorRespondWorkflow(respondModal._id || respondModal.id, { response_text: responseText, doctor_email: user.email || user.name });
            setRespondModal(null);
            setResponseText('');
            fetchData();
        } catch (err) { console.error(err); }
        finally { setResponding(false); }
    };

    const handleStatusUpdate = async (id, newStatus) => {
        try {
            await updateWorkflowStatus(id, { status: newStatus, updated_by: user.email || user.name });
            fetchData();
        } catch (err) { console.error(err); }
    };

    const toggleLogs = async (id) => {
        if (expandedId === id) { setExpandedId(null); return; }
        setExpandedId(id);
        if (!logsMap[id]) {
            try {
                const res = await getWorkflowLogs(id);
                setLogsMap(prev => ({ ...prev, [id]: res.logs || [] }));
            } catch { setLogsMap(prev => ({ ...prev, [id]: [] })); }
        }
    };

    const getDoctorsForDept = (deptName) => {
        const dept = departments.find(d => d.name === deptName);
        return dept?.doctors || [];
    };

    const filteredRequests = requests.filter(r => {
        if (!searchText) return true;
        const s = searchText.toLowerCase();
        return r.patient?.name?.toLowerCase().includes(s) || r.query?.toLowerCase().includes(s) || r.department?.toLowerCase().includes(s);
    });

    const TABS = isDoctor
        ? [{ key: 'my_requests', label: 'My Requests', icon: Stethoscope }, { key: 'stats', label: 'Analytics', icon: BarChart3 }]
        : [
            { key: 'submit', label: 'Submit Query', icon: Send },
            { key: 'requests', label: 'All Requests', icon: FileText },
            { key: 'stats', label: 'Analytics', icon: BarChart3 },
        ];

    return (
        <div className="max-w-[1600px] mx-auto space-y-5">

            {/* HERO BANNER */}
            <div className="rounded-2xl overflow-hidden" style={{ background: 'linear-gradient(135deg, #042F2E 0%, #0A4A44 40%, #0F766E 100%)' }}>
                <div className="px-10 py-7 flex items-center justify-between">
                    <div className="flex items-center gap-5">
                        <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.07)' }}>
                            <GitBranch size={28} color="#6EE7B7" />
                        </div>
                        <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] mb-1" style={{ color: 'rgba(153,246,228,0.35)' }}>AI-Powered Department Router</p>
                            <h1 className="text-2xl font-extrabold text-white tracking-tight leading-tight">Workflow Automation</h1>
                            <p className="text-[13px] mt-1" style={{ color: 'rgba(153,246,228,0.38)' }}>Intelligent query classification, department routing & case lifecycle management</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-6">
                        {stats && [
                            { label: 'Total', value: stats.total || 0, icon: FileText, color: '#F0FDFA' },
                            { label: 'Active', value: stats.active || 0, icon: Activity, color: '#FCD34D' },
                            { label: 'Resolved', value: stats.resolved || 0, icon: CheckCircle2, color: '#6EE7B7' },
                            { label: 'AI Conf.', value: `${Math.round((stats.avg_ai_confidence || 0) * 100)}%`, icon: Brain, color: '#A78BFA' },
                        ].map(s => (
                            <div key={s.label} className="text-center px-3">
                                <s.icon size={16} className="mx-auto mb-1" style={{ color: s.color }} />
                                <p className="text-xl font-bold text-white">{s.value}</p>
                                <p className="text-[10px] font-medium" style={{ color: 'rgba(153,246,228,0.4)' }}>{s.label}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* TAB NAVIGATION */}
            <div className="bg-surface-card rounded-2xl border border-border p-1.5 shadow-sm">
                <div className="flex gap-1">
                    {TABS.map(t => (
                        <button key={t.key} onClick={() => setTab(t.key)}
                            className={`flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold cursor-pointer transition-all
                                ${tab === t.key
                                    ? 'bg-gradient-to-r from-primary to-teal-600 text-white shadow-md shadow-primary/20'
                                    : 'text-text-muted hover:bg-surface hover:text-text-secondary'}`}>
                            <t.icon size={15} /> {t.label}
                        </button>
                    ))}
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-24">
                    <div className="text-center">
                        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                        <p className="text-xs text-text-muted">Loading workflow data...</p>
                    </div>
                </div>
            ) : (
                <>
                    {/* SUBMIT QUERY TAB */}
                    {tab === 'submit' && (
                        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="max-w-3xl mx-auto space-y-5">
                            <div className="bg-surface-card rounded-2xl border border-border shadow-sm overflow-hidden">
                                <div className="px-6 py-4 border-b border-border" style={{ background: 'linear-gradient(135deg, #F0FDFA, #F5F3FF)' }}>
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                                            <Brain size={20} className="text-primary" />
                                        </div>
                                        <div>
                                            <h2 className="text-sm font-bold text-text-primary">Submit Patient Query</h2>
                                            <p className="text-[11px] text-text-muted">AI will classify intent and route to the correct department automatically</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="p-6 space-y-4">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1.5">Patient ID</label>
                                            <input placeholder="e.g. PAT-001" value={queryForm.patient_id}
                                                onChange={e => setQueryForm(p => ({ ...p, patient_id: e.target.value }))}
                                                className="w-full px-3.5 py-2.5 rounded-xl border border-border text-xs bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all" />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1.5">Patient Name *</label>
                                            <input placeholder="Full name" value={queryForm.name}
                                                onChange={e => setQueryForm(p => ({ ...p, name: e.target.value }))}
                                                className="w-full px-3.5 py-2.5 rounded-xl border border-border text-xs bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all" required />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1.5">Email</label>
                                            <input placeholder="patient@email.com" type="email" value={queryForm.email}
                                                onChange={e => setQueryForm(p => ({ ...p, email: e.target.value }))}
                                                className="w-full px-3.5 py-2.5 rounded-xl border border-border text-xs bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all" />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1.5">Phone</label>
                                            <input placeholder="Phone number" value={queryForm.phone}
                                                onChange={e => setQueryForm(p => ({ ...p, phone: e.target.value }))}
                                                className="w-full px-3.5 py-2.5 rounded-xl border border-border text-xs bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all" />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1.5">Symptoms / Query *</label>
                                        <textarea rows={4} placeholder="Describe the patient's query, symptoms, or concern in detail..."
                                            value={queryForm.query}
                                            onChange={e => setQueryForm(p => ({ ...p, query: e.target.value }))}
                                            className="w-full px-3.5 py-2.5 rounded-xl border border-border text-xs bg-surface resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all leading-relaxed" />
                                    </div>
                                    <button onClick={handleSubmit} disabled={submitting || !queryForm.query.trim() || !queryForm.name.trim()}
                                        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-xs font-bold text-white cursor-pointer disabled:opacity-50 shadow-lg shadow-primary/20 hover:shadow-xl transition-all"
                                        style={{ background: 'linear-gradient(135deg, #0F766E, #14B8A6)' }}>
                                        {submitting ? <><div className="w-4 h-4 border-2 border-white/60 border-t-white rounded-full animate-spin" /> Classifying with AI...</>
                                            : <><Zap size={15} /> Submit & Auto-Classify</>}
                                    </button>
                                </div>
                            </div>

                            {/* AI Classification Result */}
                            <AnimatePresence>
                                {submitResult && (
                                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                                        className="bg-surface-card rounded-2xl shadow-sm border border-primary/20 overflow-hidden">
                                        <div className="px-6 py-3 border-b border-border flex items-center gap-2" style={{ background: 'linear-gradient(135deg, #F0FDFA, #ECFDF5)' }}>
                                            <Brain size={16} className="text-primary" />
                                            <span className="text-xs font-bold text-primary uppercase tracking-wider">AI Classification Result</span>
                                        </div>
                                        <div className="p-6">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="rounded-xl p-4 border border-teal-100" style={{ background: 'linear-gradient(135deg, #F0FDFA, #CCFBF1)' }}>
                                                    <p className="text-[9px] uppercase text-primary/60 font-bold mb-1.5">Routed Department</p>
                                                    <p className="text-lg font-extrabold text-text-primary flex items-center gap-2">
                                                        <span>{DEPT_ICONS[submitResult.routed_to || submitResult.department] || '\uD83C\uDFE5'}</span>
                                                        {submitResult.routed_to || submitResult.department}
                                                    </p>
                                                </div>
                                                <div className="rounded-xl p-4 border border-blue-100" style={{ background: 'linear-gradient(135deg, #EFF6FF, #DBEAFE)' }}>
                                                    <p className="text-[9px] uppercase text-blue-500 font-bold mb-1.5">AI Confidence</p>
                                                    <ConfidenceBar value={submitResult.classification?.confidence || submitResult.ai_classification?.confidence} />
                                                </div>
                                                <div className="rounded-xl p-4 border border-amber-100" style={{ background: 'linear-gradient(135deg, #FFFBEB, #FEF3C7)' }}>
                                                    <p className="text-[9px] uppercase text-amber-500 font-bold mb-1.5">Urgency Level</p>
                                                    <UrgencyBadge urgency={submitResult.classification?.urgency || submitResult.ai_classification?.urgency || 'medium'} />
                                                </div>
                                                <div className="rounded-xl p-4 border border-violet-100" style={{ background: 'linear-gradient(135deg, #F5F3FF, #EDE9FE)' }}>
                                                    <p className="text-[9px] uppercase text-violet-500 font-bold mb-1.5">Request ID</p>
                                                    <p className="text-xs font-mono font-bold text-violet-800 truncate">{submitResult.request_id}</p>
                                                </div>
                                            </div>
                                            {(submitResult.classification?.reasoning || submitResult.ai_classification?.reasoning) && (
                                                <div className="mt-4 rounded-xl p-3 bg-surface border border-border">
                                                    <p className="text-[9px] uppercase text-text-muted font-bold mb-1 flex items-center gap-1"><Brain size={9} /> AI Reasoning</p>
                                                    <p className="text-xs text-text-secondary leading-relaxed">{submitResult.classification?.reasoning || submitResult.ai_classification?.reasoning}</p>
                                                </div>
                                            )}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    )}

                    {/* REQUESTS TAB */}
                    {(tab === 'requests' || tab === 'my_requests') && (
                        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                            {/* Filters bar */}
                            <div className="bg-surface-card rounded-2xl border border-border p-4 shadow-sm">
                                <div className="flex flex-wrap items-center gap-3">
                                    <div className="flex items-center gap-2 mr-1">
                                        <Filter size={13} className="text-primary" />
                                        <span className="text-[11px] font-bold text-text-secondary uppercase tracking-wider">Filters</span>
                                    </div>
                                    <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                                        className="px-3 py-1.5 rounded-xl border border-border text-[11px] font-bold bg-surface cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all">
                                        <option value="">All Status</option>
                                        {Object.keys(STATUS_CONFIG).map(s => <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>)}
                                    </select>
                                    <select value={filterDept} onChange={e => setFilterDept(e.target.value)}
                                        className="px-3 py-1.5 rounded-xl border border-border text-[11px] font-bold bg-surface cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all">
                                        <option value="">All Departments</option>
                                        {departments.map(d => <option key={d.name} value={d.name}>{d.name}</option>)}
                                    </select>
                                    <div className="flex-1" />
                                    <div className="relative">
                                        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                                        <input value={searchText} onChange={e => setSearchText(e.target.value)}
                                            placeholder="Search queries..."
                                            className="pl-8 pr-3 py-1.5 rounded-xl border border-border text-[11px] bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all w-52" />
                                    </div>
                                    <button onClick={fetchData}
                                        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-[11px] font-bold text-primary bg-primary/5 hover:bg-primary/10 transition-colors cursor-pointer border border-primary/10">
                                        <RotateCcw size={12} /> Refresh
                                    </button>
                                </div>
                            </div>

                            {filteredRequests.length === 0 ? (
                                <div className="bg-surface-card rounded-2xl border border-border shadow-sm">
                                    <div className="flex flex-col items-center justify-center py-20">
                                        <div className="w-16 h-16 rounded-2xl bg-primary/5 flex items-center justify-center mb-4">
                                            <FileText size={28} className="text-primary/20" />
                                        </div>
                                        <p className="text-sm font-bold text-text-primary mb-1">No Requests Found</p>
                                        <p className="text-xs text-text-muted">Submit a query or adjust your filters</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {filteredRequests.map((req, idx) => {
                                        const reqId = req._id || req.id;
                                        const isExpanded = expandedId === reqId;
                                        return (
                                        <motion.div key={reqId} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: idx * 0.03 }}
                                            className="bg-surface-card rounded-2xl border border-border shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                                            {/* Row Header */}
                                            <div className="px-5 py-4 flex items-start gap-4 cursor-pointer" onClick={() => toggleLogs(reqId)}>
                                                <div className="w-11 h-11 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                                                    style={{ background: 'linear-gradient(135deg, #F0FDFA, #CCFBF1)' }}>
                                                    {DEPT_ICONS[req.department] || '\uD83C\uDFE5'}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap mb-1">
                                                        <span className="text-[12px] font-bold text-text-primary">{req.patient?.name || 'Unknown'}</span>
                                                        <StatusBadge status={req.status} />
                                                        <UrgencyBadge urgency={req.urgency || 'medium'} />
                                                    </div>
                                                    <p className="text-[11px] text-text-secondary line-clamp-2 leading-relaxed">{req.query}</p>
                                                    <div className="flex items-center gap-3 mt-2 text-[10px] text-text-muted">
                                                        <span className="flex items-center gap-1"><Building2 size={10} className="text-primary/60" /> {req.department}</span>
                                                        {req.assigned_doctor && <span className="flex items-center gap-1"><UserCheck size={10} className="text-violet-500/60" /> {req.assigned_doctor.name}</span>}
                                                        <span className="flex items-center gap-1"><Clock size={10} /> {new Date(req.created_at).toLocaleDateString()}</span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 flex-shrink-0">
                                                    {req.ai_classification && (
                                                        <div className="w-20"><ConfidenceBar value={req.ai_classification.confidence} /></div>
                                                    )}
                                                    {!isDoctor && req.status === 'NEW' && (
                                                        <button onClick={e => { e.stopPropagation(); setAssignModal(req); }}
                                                            className="px-3 py-1.5 rounded-xl text-[10px] font-bold text-white cursor-pointer shadow-sm hover:shadow-md transition-all flex items-center gap-1"
                                                            style={{ background: 'linear-gradient(135deg, #0F766E, #14B8A6)' }}>
                                                            <UserCheck size={10} /> Assign
                                                        </button>
                                                    )}
                                                    {isDoctor && req.status === 'ASSIGNED' && (
                                                        <button onClick={e => { e.stopPropagation(); handleStatusUpdate(reqId, 'IN_PROGRESS'); }}
                                                            className="px-3 py-1.5 rounded-xl text-[10px] font-bold text-white cursor-pointer shadow-sm transition-all"
                                                            style={{ background: 'linear-gradient(135deg, #4F46E5, #6366F1)' }}>
                                                            Start
                                                        </button>
                                                    )}
                                                    {isDoctor && req.status === 'IN_PROGRESS' && (
                                                        <button onClick={e => { e.stopPropagation(); setRespondModal(req); }}
                                                            className="px-3 py-1.5 rounded-xl text-[10px] font-bold text-white cursor-pointer shadow-sm transition-all flex items-center gap-1"
                                                            style={{ background: 'linear-gradient(135deg, #059669, #10B981)' }}>
                                                            <MessageSquare size={10} /> Respond
                                                        </button>
                                                    )}
                                                    {isExpanded ? <ChevronUp size={15} className="text-text-muted" /> : <ChevronDown size={15} className="text-text-muted" />}
                                                </div>
                                            </div>

                                            {/* Expanded details */}
                                            <AnimatePresence>
                                                {isExpanded && (
                                                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                                                        exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-t border-border">
                                                        <div className="p-5 space-y-4" style={{ background: 'linear-gradient(180deg, #F8FAFC, #FFFFFF)' }}>
                                                            {req.ai_classification && (
                                                                <div className="rounded-xl p-4 border border-border bg-white">
                                                                    <p className="text-[9px] font-bold text-text-muted uppercase tracking-wider mb-3 flex items-center gap-1"><Brain size={10} className="text-violet-500" /> AI Classification</p>
                                                                    <div className="grid grid-cols-3 gap-4 text-xs">
                                                                        <div>
                                                                            <span className="text-text-muted text-[10px]">Department</span>
                                                                            <p className="font-bold text-text-primary flex items-center gap-1 mt-0.5">{DEPT_ICONS[req.ai_classification.department] || '\uD83C\uDFE5'} {req.ai_classification.department}</p>
                                                                        </div>
                                                                        <div>
                                                                            <span className="text-text-muted text-[10px]">Confidence</span>
                                                                            <p className="font-bold mt-0.5">{Math.round(req.ai_classification.confidence * 100)}%</p>
                                                                        </div>
                                                                        <div>
                                                                            <span className="text-text-muted text-[10px]">Urgency</span>
                                                                            <div className="mt-0.5"><UrgencyBadge urgency={req.ai_classification.urgency} /></div>
                                                                        </div>
                                                                    </div>
                                                                    {req.ai_classification.reasoning && (
                                                                        <p className="text-[11px] text-text-muted mt-3 italic bg-surface p-2 rounded-lg">{req.ai_classification.reasoning}</p>
                                                                    )}
                                                                </div>
                                                            )}

                                                            {req.doctor_response && (
                                                                <div className="rounded-xl p-4 bg-emerald-50 border border-emerald-200">
                                                                    <p className="text-[9px] font-bold text-emerald-600 uppercase tracking-wider mb-2 flex items-center gap-1"><Stethoscope size={10} /> Doctor Response</p>
                                                                    <p className="text-sm text-text-primary leading-relaxed">{req.doctor_response.text}</p>
                                                                    <p className="text-[10px] text-emerald-600 mt-2">By {req.doctor_response.responded_by} &middot; {new Date(req.doctor_response.responded_at).toLocaleString()}</p>
                                                                </div>
                                                            )}

                                                            {!isDoctor && req.status !== 'CLOSED' && req.status !== 'RESOLVED' && (
                                                                <div className="flex gap-2 flex-wrap">
                                                                    {req.status === 'NEW' && <button onClick={() => handleStatusUpdate(reqId, 'ASSIGNED')} className="px-3 py-1.5 rounded-xl text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 cursor-pointer transition-all">Mark Assigned</button>}
                                                                    {(req.status === 'ASSIGNED' || req.status === 'IN_PROGRESS') && <button onClick={() => handleStatusUpdate(reqId, 'RESOLVED')} className="px-3 py-1.5 rounded-xl text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 cursor-pointer transition-all">Resolve</button>}
                                                                    <button onClick={() => handleStatusUpdate(reqId, 'WAITING_FOR_PATIENT')} className="px-3 py-1.5 rounded-xl text-[10px] font-bold bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-100 cursor-pointer transition-all">Waiting for Patient</button>
                                                                </div>
                                                            )}
                                                            {!isDoctor && req.status === 'RESOLVED' && (
                                                                <button onClick={() => handleStatusUpdate(reqId, 'CLOSED')} className="px-3 py-1.5 rounded-xl text-[10px] font-bold bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200 cursor-pointer transition-all">Close Request</button>
                                                            )}

                                                            {logsMap[reqId] && logsMap[reqId].length > 0 && (
                                                                <div>
                                                                    <p className="text-[9px] font-bold text-text-muted uppercase tracking-wider mb-2 flex items-center gap-1"><Activity size={10} className="text-primary" /> Audit Trail</p>
                                                                    <div className="space-y-2">
                                                                        {logsMap[reqId].map((log, li) => (
                                                                            <div key={li} className="flex items-start gap-2.5 text-xs">
                                                                                <div className="w-2 h-2 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                                                                                <div>
                                                                                    <span className="font-bold text-text-primary">{log.action}</span>
                                                                                    {log.previous_status && log.new_status && (
                                                                                        <span className="text-text-muted ml-1">{log.previous_status} <ArrowRight size={8} className="inline" /> {log.new_status}</span>
                                                                                    )}
                                                                                    {log.notes && <span className="text-text-muted ml-1">&mdash; {log.notes}</span>}
                                                                                    <p className="text-[9px] text-text-muted mt-0.5">{log.performed_by} &middot; {new Date(log.timestamp).toLocaleString()}</p>
                                                                                </div>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </motion.div>
                                        );
                                    })}
                                </div>
                            )}
                        </motion.div>
                    )}

                    {/* ANALYTICS TAB */}
                    {tab === 'stats' && stats && (
                        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
                            {/* Summary Cards */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {[
                                    { label: 'Total Requests', value: stats.total || 0, color: '#0F766E', icon: FileText },
                                    { label: 'New / Pending', value: stats.by_status?.NEW || 0, color: '#2563EB', icon: Clock },
                                    { label: 'In Progress', value: (stats.by_status?.IN_PROGRESS || 0) + (stats.by_status?.ASSIGNED || 0), color: '#D97706', icon: Activity },
                                    { label: 'Resolved', value: (stats.by_status?.RESOLVED || 0) + (stats.by_status?.CLOSED || 0), color: '#059669', icon: CheckCircle2 },
                                ].map((card, i) => (
                                    <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                                        className="bg-surface-card rounded-2xl border border-border shadow-sm p-5">
                                        <div className="flex items-center gap-3 mb-3">
                                            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${card.color}10` }}>
                                                <card.icon size={18} style={{ color: card.color }} />
                                            </div>
                                            <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider">{card.label}</p>
                                        </div>
                                        <p className="text-3xl font-extrabold" style={{ color: card.color }}>{card.value}</p>
                                    </motion.div>
                                ))}
                            </div>

                            {/* Department Distribution */}
                            <div className="bg-surface-card rounded-2xl border border-border shadow-sm p-6">
                                <h3 className="text-sm font-bold text-text-primary mb-5 flex items-center gap-2">
                                    <Building2 size={15} className="text-primary" /> Department Distribution
                                </h3>
                                <div className="space-y-3">
                                    {stats.by_department && Object.entries(stats.by_department).map(([dept, count]) => {
                                        const total = stats.total || 1;
                                        const pct = Math.round((count / total) * 100);
                                        return (
                                            <div key={dept} className="flex items-center gap-3">
                                                <span className="text-lg w-8 text-center">{DEPT_ICONS[dept] || '\uD83C\uDFE5'}</span>
                                                <span className="text-xs font-bold text-text-primary w-36">{dept}</span>
                                                <div className="flex-1 h-3 rounded-full bg-surface overflow-hidden border border-border">
                                                    <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.6, delay: 0.2 }}
                                                        className="h-full rounded-full" style={{ background: 'linear-gradient(90deg, #0F766E, #14B8A6)' }} />
                                                </div>
                                                <span className="text-xs font-bold text-text-secondary w-16 text-right">{count} ({pct}%)</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                {/* Status Breakdown */}
                                <div className="bg-surface-card rounded-2xl border border-border shadow-sm p-6">
                                    <h3 className="text-sm font-bold text-text-primary mb-4 flex items-center gap-2"><BarChart3 size={15} className="text-primary" /> Status Breakdown</h3>
                                    <div className="grid grid-cols-2 gap-3">
                                        {stats.by_status && Object.entries(stats.by_status).map(([status, count]) => {
                                            const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.NEW;
                                            return (
                                                <div key={status} className="rounded-xl p-3.5 border" style={{ backgroundColor: cfg.bg + '60', borderColor: cfg.border }}>
                                                    <p className="text-2xl font-extrabold" style={{ color: cfg.text }}>{count}</p>
                                                    <p className="text-[10px] font-bold mt-0.5" style={{ color: cfg.text }}>{cfg.label}</p>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Urgency Distribution */}
                                {stats.by_urgency && (
                                    <div className="bg-surface-card rounded-2xl border border-border shadow-sm p-6">
                                        <h3 className="text-sm font-bold text-text-primary mb-4 flex items-center gap-2"><AlertTriangle size={15} className="text-primary" /> Urgency Distribution</h3>
                                        <div className="grid grid-cols-1 gap-3">
                                            {Object.entries(stats.by_urgency).map(([urg, count]) => {
                                                const cfg = URGENCY_COLORS[urg] || URGENCY_COLORS.medium;
                                                const total = stats.total || 1;
                                                const pct = Math.round((count / total) * 100);
                                                return (
                                                    <div key={urg} className="flex items-center gap-3 rounded-xl p-3 border" style={{ backgroundColor: cfg.bg + '60', borderColor: cfg.border }}>
                                                        <span className="text-xl font-extrabold w-10" style={{ color: cfg.text }}>{count}</span>
                                                        <div className="flex-1">
                                                            <p className="text-[10px] font-bold uppercase" style={{ color: cfg.text }}>{urg}</p>
                                                            <div className="h-1.5 rounded-full bg-white mt-1 overflow-hidden">
                                                                <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: cfg.text }} />
                                                            </div>
                                                        </div>
                                                        <span className="text-[10px] font-bold" style={{ color: cfg.text }}>{pct}%</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}
                </>
            )}

            {/* ASSIGN DOCTOR MODAL */}
            <AnimatePresence>
                {assignModal && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4"
                        onClick={() => setAssignModal(null)}>
                        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden"
                            onClick={e => e.stopPropagation()}>
                            <div className="px-6 py-4 border-b border-border" style={{ background: 'linear-gradient(135deg, #F0FDFA, #ECFDF5)' }}>
                                <h3 className="font-bold text-sm flex items-center gap-2"><UserCheck className="text-primary" size={18} /> Assign Doctor</h3>
                                <p className="text-[11px] text-text-muted mt-0.5">Department: <strong className="text-text-primary">{assignModal.department}</strong></p>
                            </div>
                            <div className="p-6 space-y-4">
                                <p className="text-xs text-text-muted line-clamp-2 bg-surface p-3 rounded-xl border border-border">{assignModal.query}</p>
                                <div>
                                    <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1.5">Select Doctor</label>
                                    <select value={selectedDoctor} onChange={e => setSelectedDoctor(e.target.value)}
                                        className="w-full px-3.5 py-2.5 rounded-xl border border-border text-xs bg-surface cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all">
                                        <option value="">Choose a doctor...</option>
                                        {getDoctorsForDept(assignModal.department).map((doc, i) => (
                                            <option key={i} value={JSON.stringify(doc)}>{doc.name} &mdash; {doc.specialization}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => setAssignModal(null)}
                                        className="flex-1 px-4 py-2.5 rounded-xl text-xs font-bold text-text-secondary bg-surface border border-border hover:bg-surface-card cursor-pointer transition-all">
                                        Cancel
                                    </button>
                                    <button onClick={handleAssign} disabled={assigning || !selectedDoctor}
                                        className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-white disabled:opacity-50 cursor-pointer shadow-md transition-all"
                                        style={{ background: 'linear-gradient(135deg, #0F766E, #14B8A6)' }}>
                                        {assigning ? <div className="w-3.5 h-3.5 border-2 border-white/60 border-t-white rounded-full animate-spin" /> : <UserCheck size={13} />} Assign
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* DOCTOR RESPOND MODAL */}
            <AnimatePresence>
                {respondModal && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4"
                        onClick={() => setRespondModal(null)}>
                        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden"
                            onClick={e => e.stopPropagation()}>
                            <div className="px-6 py-4 border-b border-border" style={{ background: 'linear-gradient(135deg, #ECFDF5, #D1FAE5)' }}>
                                <h3 className="font-bold text-sm flex items-center gap-2"><MessageSquare className="text-emerald-600" size={18} /> Respond to Patient</h3>
                                <p className="text-[11px] text-text-muted mt-0.5">Patient: <strong className="text-text-primary">{respondModal.patient?.name}</strong></p>
                            </div>
                            <div className="p-6 space-y-4">
                                <p className="text-xs text-text-muted line-clamp-2 bg-surface p-3 rounded-xl border border-border">{respondModal.query}</p>
                                <div>
                                    <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1.5">Your Response</label>
                                    <textarea rows={4} placeholder="Enter your clinical response..."
                                        value={responseText} onChange={e => setResponseText(e.target.value)}
                                        className="w-full px-3.5 py-2.5 rounded-xl border border-border text-xs bg-surface resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all leading-relaxed" />
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => setRespondModal(null)}
                                        className="flex-1 px-4 py-2.5 rounded-xl text-xs font-bold text-text-secondary bg-surface border border-border hover:bg-surface-card cursor-pointer transition-all">
                                        Cancel
                                    </button>
                                    <button onClick={handleRespond} disabled={responding || !responseText.trim()}
                                        className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-white disabled:opacity-50 cursor-pointer shadow-md transition-all"
                                        style={{ background: 'linear-gradient(135deg, #059669, #10B981)' }}>
                                        {responding ? <div className="w-3.5 h-3.5 border-2 border-white/60 border-t-white rounded-full animate-spin" /> : <Send size={13} />} Send Response
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
