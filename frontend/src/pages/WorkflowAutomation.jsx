import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    GitBranch, Send, Brain, Clock, CheckCircle2, AlertTriangle,
    Filter, BarChart3, User, Building2, FileText, MessageSquare,
    Activity, ChevronDown, ChevronUp, Stethoscope, ArrowRight,
    XCircle, UserCheck, RotateCcw, Loader2
} from 'lucide-react';
import {
    submitWorkflowQuery, getWorkflowRequests, updateWorkflowStatus,
    assignWorkflowDoctor, getDoctorWorkflowRequests, doctorRespondWorkflow,
    getWorkflowLogs, getWorkflowDepartments, getWorkflowStats
} from '../services/api';

const STATUS_CONFIG = {
    NEW: { bg: '#DBEAFE', text: '#2563EB', label: 'New', icon: Clock },
    ASSIGNED: { bg: '#FEF3C7', text: '#D97706', label: 'Assigned', icon: UserCheck },
    IN_PROGRESS: { bg: '#E0E7FF', text: '#4F46E5', label: 'In Progress', icon: Activity },
    WAITING_FOR_PATIENT: { bg: '#FDE68A', text: '#92400E', label: 'Waiting', icon: Clock },
    RESOLVED: { bg: '#D1FAE5', text: '#059669', label: 'Resolved', icon: CheckCircle2 },
    CLOSED: { bg: '#F3F4F6', text: '#6B7280', label: 'Closed', icon: XCircle },
};

const URGENCY_COLORS = {
    high: { bg: '#FEE2E2', text: '#DC2626' },
    medium: { bg: '#FEF3C7', text: '#D97706' },
    low: { bg: '#D1FAE5', text: '#059669' },
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
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold"
            style={{ backgroundColor: cfg.bg, color: cfg.text }}>
            <Icon size={12} /> {cfg.label}
        </span>
    );
}

function UrgencyBadge({ urgency }) {
    const cfg = URGENCY_COLORS[urgency] || URGENCY_COLORS.medium;
    return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase"
            style={{ backgroundColor: cfg.bg, color: cfg.text }}>
            {urgency === 'high' && <AlertTriangle size={10} />}
            {urgency}
        </span>
    );
}

function ConfidenceBar({ value }) {
    const pct = Math.round((value || 0) * 100);
    const color = pct >= 90 ? '#059669' : pct >= 70 ? '#D97706' : '#DC2626';
    return (
        <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 rounded-full bg-gray-200 overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
            </div>
            <span className="text-[10px] font-bold" style={{ color }}>{pct}%</span>
        </div>
    );
}

export default function WorkflowAutomation() {
    const user = JSON.parse(sessionStorage.getItem('zi_user') || '{}');
    const isDoctor = user.role === 'doctor';

    // Tab & global state
    const [tab, setTab] = useState(isDoctor ? 'my_requests' : 'submit');
    const [loading, setLoading] = useState(true);
    const [requests, setRequests] = useState([]);
    const [stats, setStats] = useState(null);
    const [departments, setDepartments] = useState([]);
    const [filterStatus, setFilterStatus] = useState('');
    const [filterDept, setFilterDept] = useState('');
    const [expandedId, setExpandedId] = useState(null);
    const [logsMap, setLogsMap] = useState({});

    // Submit form state
    const [queryForm, setQueryForm] = useState({ patient_id: '', name: '', email: '', phone: '', query: '' });
    const [submitting, setSubmitting] = useState(false);
    const [submitResult, setSubmitResult] = useState(null);

    // Assign doctor modal
    const [assignModal, setAssignModal] = useState(null); // request object
    const [selectedDoctor, setSelectedDoctor] = useState('');
    const [assigning, setAssigning] = useState(false);

    // Doctor respond modal
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

    // ── Submit Query ──
    const handleSubmit = async () => {
        if (!queryForm.query.trim() || !queryForm.name.trim()) return;
        setSubmitting(true);
        setSubmitResult(null);
        try {
            const res = await submitWorkflowQuery({
                patient: { patient_id: queryForm.patient_id, name: queryForm.name, email: queryForm.email, phone: queryForm.phone },
                query: queryForm.query,
            });
            setSubmitResult(res);
            setQueryForm({ patient_id: '', name: '', email: '', phone: '', query: '' });
            fetchData();
        } catch (err) { console.error(err); }
        finally { setSubmitting(false); }
    };

    // ── Assign Doctor ──
    const handleAssign = async () => {
        if (!assignModal || !selectedDoctor) return;
        setAssigning(true);
        try {
            const doc = JSON.parse(selectedDoctor);
            await assignWorkflowDoctor({ request_id: assignModal._id, doctor_name: doc.name, doctor_email: doc.email });
            setAssignModal(null);
            setSelectedDoctor('');
            fetchData();
        } catch (err) { console.error(err); }
        finally { setAssigning(false); }
    };

    // ── Doctor Respond ──
    const handleRespond = async () => {
        if (!respondModal || !responseText.trim()) return;
        setResponding(true);
        try {
            await doctorRespondWorkflow(respondModal._id, { text: responseText, responded_by: user.email || user.name });
            setRespondModal(null);
            setResponseText('');
            fetchData();
        } catch (err) { console.error(err); }
        finally { setResponding(false); }
    };

    // ── Status Update ──
    const handleStatusUpdate = async (id, newStatus) => {
        try {
            await updateWorkflowStatus(id, { status: newStatus, updated_by: user.email || user.name });
            fetchData();
        } catch (err) { console.error(err); }
    };

    // ── Fetch Logs ──
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

    // Get doctors for a specific department
    const getDoctorsForDept = (deptName) => {
        const dept = departments.find(d => d.name === deptName);
        return dept?.doctors || [];
    };

    const TABS = isDoctor
        ? [{ key: 'my_requests', label: 'My Requests', icon: Stethoscope }, { key: 'stats', label: 'Analytics', icon: BarChart3 }]
        : [
            { key: 'submit', label: 'Submit Query', icon: Send },
            { key: 'requests', label: 'All Requests', icon: FileText },
            { key: 'stats', label: 'Analytics', icon: BarChart3 },
        ];

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-teal-50/30 p-4 md:p-6 pb-24">
            {/* Header */}
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
                <div className="flex items-center gap-3 mb-1">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center shadow-lg">
                        <GitBranch size={20} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-gray-900">Workflow Automation</h1>
                        <p className="text-xs text-gray-500">AI-powered department routing & patient query management</p>
                    </div>
                </div>
            </motion.div>

            {/* Tabs */}
            <div className="flex gap-1 mb-6 bg-white/80 backdrop-blur rounded-xl p-1 shadow-sm border border-gray-100 w-fit">
                {TABS.map(t => (
                    <button key={t.key} onClick={() => setTab(t.key)}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                            tab === t.key ? 'bg-teal-500 text-white shadow-md' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}>
                        <t.icon size={15} /> {t.label}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-24">
                    <Loader2 className="animate-spin text-teal-500" size={32} />
                </div>
            ) : (
                <>
                    {/* ── SUBMIT QUERY TAB ── */}
                    {tab === 'submit' && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-2xl mx-auto space-y-5">
                            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <Brain className="text-teal-500" size={20} />
                                    <h2 className="text-lg font-bold text-gray-900">Submit Patient Query</h2>
                                </div>
                                <p className="text-sm text-gray-500">AI will automatically classify the query and route it to the correct department.</p>

                                <div className="grid grid-cols-2 gap-3">
                                    <input placeholder="Patient ID" value={queryForm.patient_id}
                                        onChange={e => setQueryForm(p => ({ ...p, patient_id: e.target.value }))}
                                        className="px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-200" />
                                    <input placeholder="Patient Name *" value={queryForm.name}
                                        onChange={e => setQueryForm(p => ({ ...p, name: e.target.value }))}
                                        className="px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-200" />
                                    <input placeholder="Email" type="email" value={queryForm.email}
                                        onChange={e => setQueryForm(p => ({ ...p, email: e.target.value }))}
                                        className="px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-200" />
                                    <input placeholder="Phone" value={queryForm.phone}
                                        onChange={e => setQueryForm(p => ({ ...p, phone: e.target.value }))}
                                        className="px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-200" />
                                </div>
                                <textarea rows={4} placeholder="Describe the patient's query or symptoms... *"
                                    value={queryForm.query}
                                    onChange={e => setQueryForm(p => ({ ...p, query: e.target.value }))}
                                    className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-200 resize-none" />
                                <button onClick={handleSubmit} disabled={submitting || !queryForm.query.trim() || !queryForm.name.trim()}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 transition-all shadow-lg disabled:opacity-50">
                                    {submitting ? <><Loader2 size={16} className="animate-spin" /> Classifying with AI...</>
                                        : <><Send size={16} /> Submit &amp; Classify</>}
                                </button>
                            </div>

                            {/* AI Classification Result */}
                            <AnimatePresence>
                                {submitResult && (
                                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                                        className="bg-white rounded-2xl shadow-sm border border-teal-200 p-6 space-y-4">
                                        <div className="flex items-center gap-2 text-teal-700 font-bold">
                                            <Brain size={18} /> AI Classification Result
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="bg-teal-50 rounded-xl p-4">
                                                <div className="text-[10px] uppercase text-teal-500 font-bold mb-1">Department</div>
                                                <div className="text-lg font-black text-teal-800 flex items-center gap-2">
                                                    <span>{DEPT_ICONS[submitResult.department] || '\uD83C\uDFE5'}</span>
                                                    {submitResult.department}
                                                </div>
                                            </div>
                                            <div className="bg-blue-50 rounded-xl p-4">
                                                <div className="text-[10px] uppercase text-blue-500 font-bold mb-1">Confidence</div>
                                                <ConfidenceBar value={submitResult.ai_classification?.confidence} />
                                            </div>
                                            <div className="bg-orange-50 rounded-xl p-4">
                                                <div className="text-[10px] uppercase text-orange-500 font-bold mb-1">Urgency</div>
                                                <UrgencyBadge urgency={submitResult.ai_classification?.urgency || 'medium'} />
                                            </div>
                                            <div className="bg-purple-50 rounded-xl p-4">
                                                <div className="text-[10px] uppercase text-purple-500 font-bold mb-1">Request ID</div>
                                                <div className="text-xs font-mono text-purple-800 truncate">{submitResult.request_id}</div>
                                            </div>
                                        </div>
                                        {submitResult.ai_classification?.reasoning && (
                                            <div className="bg-gray-50 rounded-xl p-3">
                                                <div className="text-[10px] uppercase text-gray-400 font-bold mb-1">AI Reasoning</div>
                                                <p className="text-sm text-gray-700">{submitResult.ai_classification.reasoning}</p>
                                            </div>
                                        )}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    )}

                    {/* ── REQUESTS TABLE TAB ── */}
                    {(tab === 'requests' || tab === 'my_requests') && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                            {/* Filters */}
                            <div className="flex flex-wrap gap-2 items-center">
                                <Filter size={14} className="text-gray-400" />
                                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                                    className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-bold bg-white">
                                    <option value="">All Status</option>
                                    {Object.keys(STATUS_CONFIG).map(s => <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>)}
                                </select>
                                <select value={filterDept} onChange={e => setFilterDept(e.target.value)}
                                    className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-bold bg-white">
                                    <option value="">All Departments</option>
                                    {departments.map(d => <option key={d.name} value={d.name}>{d.name}</option>)}
                                </select>
                                <button onClick={fetchData}
                                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-teal-600 bg-teal-50 hover:bg-teal-100 transition-colors">
                                    <RotateCcw size={12} /> Refresh
                                </button>
                            </div>

                            {requests.length === 0 ? (
                                <div className="text-center py-16 text-gray-400">
                                    <FileText size={40} className="mx-auto mb-3 opacity-40" />
                                    <p className="font-bold">No requests found</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {requests.map((req, idx) => (
                                        <motion.div key={req._id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: idx * 0.03 }}
                                            className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                                            {/* Row Header */}
                                            <div className="p-4 flex items-start gap-4 cursor-pointer" onClick={() => toggleLogs(req._id)}>
                                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-100 to-emerald-100 flex items-center justify-center text-lg flex-shrink-0">
                                                    {DEPT_ICONS[req.department] || '\uD83C\uDFE5'}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap mb-1">
                                                        <span className="font-bold text-sm text-gray-900">{req.patient?.name}</span>
                                                        <StatusBadge status={req.status} />
                                                        <UrgencyBadge urgency={req.urgency || 'medium'} />
                                                    </div>
                                                    <p className="text-sm text-gray-600 line-clamp-2">{req.query}</p>
                                                    <div className="flex items-center gap-3 mt-2 text-[10px] text-gray-400">
                                                        <span className="flex items-center gap-1"><Building2 size={10} /> {req.department}</span>
                                                        {req.assigned_doctor && <span className="flex items-center gap-1"><UserCheck size={10} /> {req.assigned_doctor.name}</span>}
                                                        <span className="flex items-center gap-1"><Clock size={10} /> {new Date(req.created_at).toLocaleDateString()}</span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 flex-shrink-0">
                                                    {/* Confidence indicator */}
                                                    {req.ai_classification && (
                                                        <div className="w-20">
                                                            <ConfidenceBar value={req.ai_classification.confidence} />
                                                        </div>
                                                    )}
                                                    {/* Actions */}
                                                    {!isDoctor && req.status === 'NEW' && (
                                                        <button onClick={e => { e.stopPropagation(); setAssignModal(req); }}
                                                            className="px-3 py-1.5 rounded-lg text-[10px] font-bold text-white bg-teal-500 hover:bg-teal-600 transition-colors flex items-center gap-1">
                                                            <UserCheck size={10} /> Assign
                                                        </button>
                                                    )}
                                                    {isDoctor && req.status === 'ASSIGNED' && (
                                                        <button onClick={e => { e.stopPropagation(); handleStatusUpdate(req._id, 'IN_PROGRESS'); }}
                                                            className="px-3 py-1.5 rounded-lg text-[10px] font-bold text-white bg-indigo-500 hover:bg-indigo-600 transition-colors">
                                                            Start
                                                        </button>
                                                    )}
                                                    {isDoctor && req.status === 'IN_PROGRESS' && (
                                                        <button onClick={e => { e.stopPropagation(); setRespondModal(req); }}
                                                            className="px-3 py-1.5 rounded-lg text-[10px] font-bold text-white bg-emerald-500 hover:bg-emerald-600 transition-colors flex items-center gap-1">
                                                            <MessageSquare size={10} /> Respond
                                                        </button>
                                                    )}
                                                    {expandedId === req._id ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                                                </div>
                                            </div>

                                            {/* Expanded: AI Info + Logs + Doctor Response */}
                                            <AnimatePresence>
                                                {expandedId === req._id && (
                                                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                                                        exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-t border-gray-100">
                                                        <div className="p-4 space-y-4 bg-gray-50/50">
                                                            {/* AI Classification Details */}
                                                            {req.ai_classification && (
                                                                <div className="bg-white rounded-xl p-3 border border-gray-100">
                                                                    <div className="text-[10px] uppercase text-gray-400 font-bold mb-2 flex items-center gap-1"><Brain size={10} /> AI Classification</div>
                                                                    <div className="grid grid-cols-3 gap-3 text-xs">
                                                                        <div><span className="text-gray-400">Department:</span> <span className="font-bold">{req.ai_classification.department}</span></div>
                                                                        <div><span className="text-gray-400">Confidence:</span> <span className="font-bold">{Math.round(req.ai_classification.confidence * 100)}%</span></div>
                                                                        <div><span className="text-gray-400">Urgency:</span> <UrgencyBadge urgency={req.ai_classification.urgency} /></div>
                                                                    </div>
                                                                    {req.ai_classification.reasoning && (
                                                                        <p className="text-xs text-gray-500 mt-2 italic">{req.ai_classification.reasoning}</p>
                                                                    )}
                                                                </div>
                                                            )}

                                                            {/* Doctor Response */}
                                                            {req.doctor_response && (
                                                                <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-100">
                                                                    <div className="text-[10px] uppercase text-emerald-500 font-bold mb-1 flex items-center gap-1"><Stethoscope size={10} /> Doctor Response</div>
                                                                    <p className="text-sm text-gray-800">{req.doctor_response.text}</p>
                                                                    <p className="text-[10px] text-gray-400 mt-1">By {req.doctor_response.responded_by} at {req.doctor_response.responded_at}</p>
                                                                </div>
                                                            )}

                                                            {/* Status actions for admin */}
                                                            {!isDoctor && req.status !== 'CLOSED' && req.status !== 'RESOLVED' && (
                                                                <div className="flex gap-2 flex-wrap">
                                                                    {req.status === 'NEW' && <button onClick={() => handleStatusUpdate(req._id, 'ASSIGNED')} className="px-3 py-1 rounded-lg text-[10px] font-bold bg-yellow-100 text-yellow-700 hover:bg-yellow-200">Mark Assigned</button>}
                                                                    {(req.status === 'ASSIGNED' || req.status === 'IN_PROGRESS') && <button onClick={() => handleStatusUpdate(req._id, 'RESOLVED')} className="px-3 py-1 rounded-lg text-[10px] font-bold bg-green-100 text-green-700 hover:bg-green-200">Resolve</button>}
                                                                    {req.status === 'RESOLVED' && <button onClick={() => handleStatusUpdate(req._id, 'CLOSED')} className="px-3 py-1 rounded-lg text-[10px] font-bold bg-gray-200 text-gray-700 hover:bg-gray-300">Close</button>}
                                                                    <button onClick={() => handleStatusUpdate(req._id, 'WAITING_FOR_PATIENT')} className="px-3 py-1 rounded-lg text-[10px] font-bold bg-orange-100 text-orange-700 hover:bg-orange-200">Waiting for Patient</button>
                                                                </div>
                                                            )}
                                                            {!isDoctor && req.status === 'RESOLVED' && (
                                                                <button onClick={() => handleStatusUpdate(req._id, 'CLOSED')} className="px-3 py-1 rounded-lg text-[10px] font-bold bg-gray-200 text-gray-700 hover:bg-gray-300">Close</button>
                                                            )}

                                                            {/* Workflow Logs */}
                                                            {logsMap[req._id] && logsMap[req._id].length > 0 && (
                                                                <div>
                                                                    <div className="text-[10px] uppercase text-gray-400 font-bold mb-2 flex items-center gap-1"><Activity size={10} /> Audit Trail</div>
                                                                    <div className="space-y-2">
                                                                        {logsMap[req._id].map((log, li) => (
                                                                            <div key={li} className="flex items-start gap-2 text-xs">
                                                                                <div className="w-1.5 h-1.5 rounded-full bg-teal-400 mt-1.5 flex-shrink-0" />
                                                                                <div>
                                                                                    <span className="font-bold text-gray-700">{log.action}</span>
                                                                                    {log.previous_status && log.new_status && (
                                                                                        <span className="text-gray-400 ml-1">{log.previous_status} <ArrowRight size={8} className="inline" /> {log.new_status}</span>
                                                                                    )}
                                                                                    {log.notes && <span className="text-gray-400 ml-1">— {log.notes}</span>}
                                                                                    <div className="text-[10px] text-gray-300">{log.performed_by} · {new Date(log.timestamp).toLocaleString()}</div>
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
                                    ))}
                                </div>
                            )}
                        </motion.div>
                    )}

                    {/* ── STATS TAB ── */}
                    {tab === 'stats' && stats && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                            {/* Summary Cards */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                {[
                                    { label: 'Total Requests', value: stats.total || 0, color: '#6366F1', icon: FileText },
                                    { label: 'New', value: stats.by_status?.NEW || 0, color: '#2563EB', icon: Clock },
                                    { label: 'In Progress', value: (stats.by_status?.IN_PROGRESS || 0) + (stats.by_status?.ASSIGNED || 0), color: '#D97706', icon: Activity },
                                    { label: 'Resolved', value: (stats.by_status?.RESOLVED || 0) + (stats.by_status?.CLOSED || 0), color: '#059669', icon: CheckCircle2 },
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

                            {/* Department Distribution */}
                            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                                <h3 className="font-bold text-sm text-gray-700 mb-4 flex items-center gap-2"><Building2 size={16} /> Department Distribution</h3>
                                <div className="space-y-3">
                                    {stats.by_department && Object.entries(stats.by_department).map(([dept, count]) => {
                                        const total = stats.total || 1;
                                        const pct = Math.round((count / total) * 100);
                                        return (
                                            <div key={dept} className="flex items-center gap-3">
                                                <span className="text-lg">{DEPT_ICONS[dept] || '\uD83C\uDFE5'}</span>
                                                <span className="text-xs font-bold text-gray-700 w-32">{dept}</span>
                                                <div className="flex-1 h-3 rounded-full bg-gray-100 overflow-hidden">
                                                    <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                                                        className="h-full rounded-full bg-gradient-to-r from-teal-400 to-emerald-500" />
                                                </div>
                                                <span className="text-xs font-bold text-gray-500 w-12 text-right">{count} ({pct}%)</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Status Breakdown */}
                            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                                <h3 className="font-bold text-sm text-gray-700 mb-4 flex items-center gap-2"><BarChart3 size={16} /> Status Breakdown</h3>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                    {stats.by_status && Object.entries(stats.by_status).map(([status, count]) => {
                                        const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.NEW;
                                        return (
                                            <div key={status} className="rounded-xl p-3 border" style={{ backgroundColor: cfg.bg + '40', borderColor: cfg.bg }}>
                                                <div className="text-xl font-black" style={{ color: cfg.text }}>{count}</div>
                                                <div className="text-[10px] font-bold" style={{ color: cfg.text }}>{cfg.label}</div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Urgency Stats */}
                            {stats.by_urgency && (
                                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                                    <h3 className="font-bold text-sm text-gray-700 mb-4 flex items-center gap-2"><AlertTriangle size={16} /> Urgency Distribution</h3>
                                    <div className="grid grid-cols-3 gap-3">
                                        {Object.entries(stats.by_urgency).map(([urg, count]) => {
                                            const cfg = URGENCY_COLORS[urg] || URGENCY_COLORS.medium;
                                            return (
                                                <div key={urg} className="rounded-xl p-3 text-center" style={{ backgroundColor: cfg.bg }}>
                                                    <div className="text-xl font-black" style={{ color: cfg.text }}>{count}</div>
                                                    <div className="text-[10px] font-bold uppercase" style={{ color: cfg.text }}>{urg}</div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    )}
                </>
            )}

            {/* ── ASSIGN DOCTOR MODAL ── */}
            <AnimatePresence>
                {assignModal && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4"
                        onClick={() => setAssignModal(null)}>
                        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4"
                            onClick={e => e.stopPropagation()}>
                            <h3 className="font-bold text-lg flex items-center gap-2"><UserCheck className="text-teal-500" size={20} /> Assign Doctor</h3>
                            <p className="text-sm text-gray-500">Department: <strong>{assignModal.department}</strong></p>
                            <p className="text-xs text-gray-400 line-clamp-2">{assignModal.query}</p>
                            <select value={selectedDoctor} onChange={e => setSelectedDoctor(e.target.value)}
                                className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-200">
                                <option value="">Select a doctor...</option>
                                {getDoctorsForDept(assignModal.department).map((doc, i) => (
                                    <option key={i} value={JSON.stringify(doc)}>{doc.name} — {doc.specialization}</option>
                                ))}
                            </select>
                            <div className="flex gap-2">
                                <button onClick={() => setAssignModal(null)}
                                    className="flex-1 px-4 py-2.5 rounded-lg text-sm font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors">
                                    Cancel
                                </button>
                                <button onClick={handleAssign} disabled={assigning || !selectedDoctor}
                                    className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-bold text-white bg-teal-500 hover:bg-teal-600 transition-colors disabled:opacity-50">
                                    {assigning ? <Loader2 size={14} className="animate-spin" /> : <UserCheck size={14} />} Assign
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── DOCTOR RESPOND MODAL ── */}
            <AnimatePresence>
                {respondModal && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4"
                        onClick={() => setRespondModal(null)}>
                        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4"
                            onClick={e => e.stopPropagation()}>
                            <h3 className="font-bold text-lg flex items-center gap-2"><MessageSquare className="text-emerald-500" size={20} /> Respond to Patient</h3>
                            <p className="text-sm text-gray-500">Patient: <strong>{respondModal.patient?.name}</strong></p>
                            <p className="text-xs text-gray-400 line-clamp-2">{respondModal.query}</p>
                            <textarea rows={4} placeholder="Enter your response to the patient..."
                                value={responseText} onChange={e => setResponseText(e.target.value)}
                                className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200 resize-none" />
                            <div className="flex gap-2">
                                <button onClick={() => setRespondModal(null)}
                                    className="flex-1 px-4 py-2.5 rounded-lg text-sm font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors">
                                    Cancel
                                </button>
                                <button onClick={handleRespond} disabled={responding || !responseText.trim()}
                                    className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-bold text-white bg-emerald-500 hover:bg-emerald-600 transition-colors disabled:opacity-50">
                                    {responding ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Send Response
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
