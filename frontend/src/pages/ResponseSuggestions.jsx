import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Sparkles, Send, RefreshCw, CheckCircle2, XCircle, Edit3, Clock,
    AlertTriangle, Filter, BarChart3, MessageSquare, ChevronRight,
    Inbox, Zap, User, ArrowRight, RotateCcw
} from 'lucide-react';
import {
    getPatientQueries, generateDraft, getDrafts, reviewDraft,
    sendDraftResponse, getResponseStats
} from '../services/api';
import { sendDraftEmail } from '../utils/emailService';

const CATEGORIES = {
    billing: { label: 'Billing', icon: '💳', color: '#0EA5E9' },
    appointment: { label: 'Appointment', icon: '📅', color: '#8B5CF6' },
    medication: { label: 'Medication', icon: '💊', color: '#EF4444' },
    lab_results: { label: 'Lab Results', icon: '🔬', color: '#F59E0B' },
    general: { label: 'General', icon: '💬', color: '#6B7280' },
};

const PRIORITY_COLORS = {
    urgent: '#DC2626', high: '#EF4444', medium: '#F59E0B', low: '#6B7280'
};

const STATUS_CONFIG = {
    pending: { label: 'Pending', color: '#F59E0B', bg: '#FEF3C7' },
    ai_drafted: { label: 'AI Drafted', color: '#8B5CF6', bg: '#EDE9FE' },
    staff_reviewing: { label: 'Reviewing', color: '#3B82F6', bg: '#DBEAFE' },
    responded: { label: 'Responded', color: '#10B981', bg: '#D1FAE5' },
    closed: { label: 'Closed', color: '#6B7280', bg: '#F3F4F6' },
};

export default function ResponseSuggestions() {
    const user = JSON.parse(sessionStorage.getItem('zi_user') || '{}');
    const [queries, setQueries] = useState([]);
    const [stats, setStats] = useState(null);
    const [selectedQuery, setSelectedQuery] = useState(null);
    const [selectedDraft, setSelectedDraft] = useState(null);
    const [editText, setEditText] = useState('');
    const [staffNotes, setStaffNotes] = useState('');
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [reviewing, setReviewing] = useState(false);
    const [sending, setSending] = useState(false);
    const [filterStatus, setFilterStatus] = useState('');
    const [filterCategory, setFilterCategory] = useState('');

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const params = {};
            if (filterStatus) params.status = filterStatus;
            if (filterCategory) params.category = filterCategory;
            const [qData, sData] = await Promise.all([
                getPatientQueries(params),
                getResponseStats(),
            ]);
            setQueries(qData.queries || []);
            setStats(sData);
        } catch (err) {
            console.error('Failed to fetch data:', err);
        }
        setLoading(false);
    }, [filterStatus, filterCategory]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleSelectQuery = async (q) => {
        setSelectedQuery(q);
        setSelectedDraft(null);
        setEditText('');
        setStaffNotes('');

        // If query has drafts, load the latest
        if (q.drafts && q.drafts.length > 0) {
            const latest = q.drafts[0];
            setSelectedDraft(latest);
            setEditText(latest.draft_text || '');
        }
    };

    const handleGenerateDraft = async () => {
        if (!selectedQuery) return;
        setGenerating(true);
        try {
            const result = await generateDraft(selectedQuery.id);
            setSelectedDraft({
                id: result.draft_id,
                draft_text: result.draft_text,
                intent: result.intent,
                confidence_score: result.confidence_score,
                knowledge_sources: result.sources || [],
                status: 'generated',
            });
            setEditText(result.draft_text || '');
            // Refresh the query list
            fetchData();
        } catch (err) {
            console.error('Draft generation failed:', err);
        }
        setGenerating(false);
    };

    const handleReview = async (action) => {
        if (!selectedDraft) return;
        setReviewing(true);
        try {
            await reviewDraft(selectedDraft.id, {
                action,
                edited_text: action === 'edit_and_approve' ? editText : undefined,
                staff_notes: staffNotes || undefined,
                staff_email: user.email || 'staff',
            });
            if (action === 'approve' || action === 'edit_and_approve') {
                setSelectedDraft(d => ({ ...d, status: 'approved' }));
            } else if (action === 'reject') {
                setSelectedDraft(null);
                setEditText('');
            }
            fetchData();
        } catch (err) {
            console.error('Review failed:', err);
        }
        setReviewing(false);
    };

    const handleSend = async () => {
        if (!selectedDraft) return;
        setSending(true);
        try {
            // 1. Update backend status
            await sendDraftResponse(selectedDraft.id, { staff_email: user.email || 'staff' });

            // 2. Send actual email via EmailJS
            await sendDraftEmail({
                patientName: selectedQuery.patient_name,
                patientEmail: selectedQuery.patient_email,
                subject: selectedQuery.subject,
                category: selectedQuery.category,
                responseText: editText || selectedDraft.draft_text,
                staffName: user.name || user.email || 'Hospital Staff',
                priority: selectedQuery.priority,
            });

            setSelectedDraft(d => ({ ...d, status: 'sent' }));
            setSelectedQuery(null);
            setSelectedDraft(null);
            setEditText('');
            setStaffNotes('');
            fetchData();
        } catch (err) {
            console.error('Send failed:', err);
        }
        setSending(false);
    };

    return (
        <div className="max-w-7xl mx-auto space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
                        <Sparkles className="text-primary" size={28} />
                        AI Response Suggestions
                    </h1>
                    <p className="text-sm text-text-secondary mt-1">
                        Review AI-generated drafts and send responses to patients
                    </p>
                </div>
                <button onClick={fetchData}
                    className="p-2.5 rounded-xl bg-white border border-border hover:bg-surface transition-colors">
                    <RefreshCw size={18} className="text-text-secondary" />
                </button>
            </div>

            {/* Stats Bar */}
            {stats && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    {[
                        { label: 'Pending', value: stats.pending, color: '#F59E0B', icon: Clock },
                        { label: 'AI Drafted', value: stats.ai_drafted, color: '#8B5CF6', icon: Sparkles },
                        { label: 'Reviewing', value: stats.staff_reviewing, color: '#3B82F6', icon: Edit3 },
                        { label: 'Responded', value: stats.responded, color: '#10B981', icon: CheckCircle2 },
                        { label: 'Total', value: stats.total_queries, color: '#0F766E', icon: BarChart3 },
                    ].map((s, i) => (
                        <motion.div key={s.label}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.05 }}
                            className="bg-white rounded-xl p-4 border border-border medical-glow"
                        >
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs text-text-muted font-medium">{s.label}</p>
                                    <p className="text-2xl font-bold mt-0.5" style={{ color: s.color }}>{s.value}</p>
                                </div>
                                <div className="p-2 rounded-lg" style={{ backgroundColor: s.color + '15' }}>
                                    <s.icon size={18} style={{ color: s.color }} />
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2">
                <Filter size={14} className="text-text-muted" />
                <span className="text-xs text-text-muted mr-1">Status:</span>
                {['', 'pending', 'ai_drafted', 'staff_reviewing', 'responded'].map(s => (
                    <button key={s} onClick={() => setFilterStatus(s)}
                        className="px-3 py-1 rounded-lg text-xs font-semibold transition-all"
                        style={{
                            backgroundColor: filterStatus === s ? '#0F766E' : '#fff',
                            color: filterStatus === s ? '#fff' : '#5F7A76',
                            border: `1px solid ${filterStatus === s ? '#0F766E' : '#CCFBF1'}`,
                        }}>
                        {s === '' ? 'All' : STATUS_CONFIG[s]?.label || s}
                    </button>
                ))}
                <span className="text-xs text-text-muted ml-3 mr-1">Category:</span>
                {['', ...Object.keys(CATEGORIES)].map(c => (
                    <button key={c} onClick={() => setFilterCategory(c)}
                        className="px-3 py-1 rounded-lg text-xs font-semibold transition-all"
                        style={{
                            backgroundColor: filterCategory === c ? '#0F766E' : '#fff',
                            color: filterCategory === c ? '#fff' : '#5F7A76',
                            border: `1px solid ${filterCategory === c ? '#0F766E' : '#CCFBF1'}`,
                        }}>
                        {c === '' ? 'All' : CATEGORIES[c]?.label || c}
                    </button>
                ))}
            </div>

            {/* Main Layout: Queue + Review Panel */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
                {/* Left: Query Queue */}
                <div className="lg:col-span-2 space-y-2 max-h-[70vh] overflow-y-auto pr-1">
                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>
                                <RefreshCw size={24} className="text-primary" />
                            </motion.div>
                        </div>
                    ) : queries.length === 0 ? (
                        <div className="text-center py-16 bg-white rounded-2xl border border-border">
                            <Inbox size={40} className="mx-auto text-text-muted mb-2" />
                            <p className="text-sm text-text-secondary">No queries found</p>
                        </div>
                    ) : queries.map((q, idx) => {
                        const isSelected = selectedQuery?.id === q.id;
                        const cat = CATEGORIES[q.category] || CATEGORIES.general;
                        const prioColor = PRIORITY_COLORS[q.priority] || PRIORITY_COLORS.medium;

                        return (
                            <motion.div key={q.id || idx}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: idx * 0.03 }}
                                onClick={() => handleSelectQuery(q)}
                                className="bg-white rounded-xl p-4 border cursor-pointer transition-all"
                                style={{
                                    borderColor: isSelected ? '#0F766E' : '#CCFBF1',
                                    boxShadow: isSelected ? '0 0 0 2px rgba(15,118,110,0.15)' : 'none',
                                }}
                            >
                                <div className="flex items-start gap-3">
                                    <div className="text-xl mt-0.5">{cat.icon}</div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-2">
                                            <h4 className="font-bold text-sm text-text-primary truncate">{q.subject}</h4>
                                            <div className="flex-shrink-0 w-2 h-2 rounded-full" style={{ backgroundColor: prioColor }} />
                                        </div>
                                        <p className="text-xs text-text-secondary mt-0.5 line-clamp-1">{q.message}</p>
                                        <div className="flex items-center gap-2 mt-2">
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
                                                style={{
                                                    backgroundColor: STATUS_CONFIG[q.status]?.bg || '#F3F4F6',
                                                    color: STATUS_CONFIG[q.status]?.color || '#6B7280',
                                                }}>
                                                {STATUS_CONFIG[q.status]?.label || q.status}
                                            </span>
                                            <span className="text-[10px] text-text-muted flex items-center gap-1">
                                                <User size={10} /> {q.patient_name}
                                            </span>
                                            <span className="text-[10px] text-text-muted">
                                                {new Date(q.created_at).toLocaleDateString()}
                                            </span>
                                        </div>
                                    </div>
                                    <ChevronRight size={14} className="text-text-muted mt-1 flex-shrink-0" />
                                </div>
                            </motion.div>
                        );
                    })}
                </div>

                {/* Right: Review Panel */}
                <div className="lg:col-span-3">
                    <AnimatePresence mode="wait">
                        {!selectedQuery ? (
                            <motion.div key="empty"
                                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                className="bg-white rounded-2xl border border-border p-12 text-center h-full flex flex-col items-center justify-center"
                            >
                                <MessageSquare size={48} className="text-text-muted mb-3" />
                                <p className="text-text-secondary font-medium">Select a query to review</p>
                                <p className="text-sm text-text-muted mt-1">Click on a patient query from the list</p>
                            </motion.div>
                        ) : (
                            <motion.div key={selectedQuery.id}
                                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                                className="bg-white rounded-2xl border border-border overflow-hidden"
                            >
                                {/* Query Header */}
                                <div className="p-5 border-b border-border"
                                    style={{ background: 'linear-gradient(135deg, #F0FDFA, #ECFDF5)' }}>
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xl">
                                                {CATEGORIES[selectedQuery.category]?.icon || '💬'}
                                            </span>
                                            <h3 className="font-bold text-lg text-text-primary">{selectedQuery.subject}</h3>
                                        </div>
                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold"
                                            style={{
                                                backgroundColor: STATUS_CONFIG[selectedQuery.status]?.bg,
                                                color: STATUS_CONFIG[selectedQuery.status]?.color,
                                            }}>
                                            {STATUS_CONFIG[selectedQuery.status]?.label}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-4 text-xs text-text-muted">
                                        <span className="flex items-center gap-1">
                                            <User size={12} /> {selectedQuery.patient_name}
                                        </span>
                                        <span>{selectedQuery.patient_email}</span>
                                        <span className="px-2 py-0.5 rounded-full font-semibold"
                                            style={{
                                                backgroundColor: PRIORITY_COLORS[selectedQuery.priority] + '15',
                                                color: PRIORITY_COLORS[selectedQuery.priority],
                                            }}>
                                            {selectedQuery.priority} priority
                                        </span>
                                    </div>
                                </div>

                                {/* Patient Message */}
                                <div className="p-5 border-b border-border">
                                    <h4 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-2">
                                        Patient Message
                                    </h4>
                                    <p className="text-sm text-text-primary whitespace-pre-wrap bg-surface p-4 rounded-xl">
                                        {selectedQuery.message}
                                    </p>
                                </div>

                                {/* AI Draft Section */}
                                <div className="p-5 space-y-4">
                                    {!selectedDraft ? (
                                        <div className="text-center py-8">
                                            <Sparkles size={32} className="mx-auto text-primary/40 mb-3" />
                                            <p className="text-sm text-text-secondary mb-4">
                                                No AI draft generated yet
                                            </p>
                                            <motion.button
                                                whileHover={{ scale: 1.03 }}
                                                whileTap={{ scale: 0.97 }}
                                                onClick={handleGenerateDraft}
                                                disabled={generating}
                                                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-white text-sm disabled:opacity-50"
                                                style={{ background: 'linear-gradient(135deg, #8B5CF6, #6D28D9)' }}
                                            >
                                                {generating ? (
                                                    <>
                                                        <motion.div animate={{ rotate: 360 }}
                                                            transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>
                                                            <RefreshCw size={16} />
                                                        </motion.div>
                                                        Generating...
                                                    </>
                                                ) : (
                                                    <>
                                                        <Zap size={16} /> Generate AI Draft
                                                    </>
                                                )}
                                            </motion.button>
                                        </div>
                                    ) : (
                                        <>
                                            {/* Draft Meta */}
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <Sparkles size={16} className="text-purple-500" />
                                                    <span className="text-xs font-bold text-purple-600 uppercase tracking-wider">
                                                        AI-Generated Draft
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-3 text-xs text-text-muted">
                                                    {selectedDraft.confidence_score != null && (
                                                        <span className="px-2 py-0.5 rounded-full font-semibold"
                                                            style={{
                                                                backgroundColor: selectedDraft.confidence_score >= 0.7 ? '#D1FAE5' : '#FEF3C7',
                                                                color: selectedDraft.confidence_score >= 0.7 ? '#059669' : '#D97706',
                                                            }}>
                                                            {Math.round(selectedDraft.confidence_score * 100)}% confidence
                                                        </span>
                                                    )}
                                                    {selectedDraft.intent && (
                                                        <span className="px-2 py-0.5 rounded-full bg-purple-50 text-purple-600 font-semibold">
                                                            {selectedDraft.intent}
                                                        </span>
                                                    )}
                                                    <button onClick={handleGenerateDraft} disabled={generating}
                                                        className="p-1 hover:bg-surface rounded-lg transition-colors"
                                                        title="Regenerate draft">
                                                        <RotateCcw size={14} />
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Knowledge Sources */}
                                            {selectedDraft.knowledge_sources?.length > 0 && (
                                                <div className="flex flex-wrap gap-1.5">
                                                    {selectedDraft.knowledge_sources.map((src, i) => (
                                                        <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-medium">
                                                            📚 {src}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Editable Draft Text */}
                                            <textarea
                                                value={editText}
                                                onChange={e => setEditText(e.target.value)}
                                                rows={8}
                                                className="w-full px-4 py-3 rounded-xl border border-border bg-surface text-sm
                                                    focus:outline-none focus:ring-2 focus:ring-primary/30 resize-y leading-relaxed"
                                            />

                                            {/* Staff Notes */}
                                            <div>
                                                <label className="block text-xs font-semibold text-text-muted mb-1.5">
                                                    Staff Notes (optional, internal only)
                                                </label>
                                                <input type="text" value={staffNotes}
                                                    onChange={e => setStaffNotes(e.target.value)}
                                                    className="w-full px-4 py-2.5 rounded-xl border border-border bg-surface text-sm
                                                        focus:outline-none focus:ring-2 focus:ring-primary/30"
                                                    placeholder="Internal note about this response..." />
                                            </div>

                                            {/* Action Buttons */}
                                            <div className="flex items-center gap-2 pt-2">
                                                {selectedDraft.status !== 'sent' && (
                                                    <>
                                                        <motion.button
                                                            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                                                            onClick={() => handleReview('approve')}
                                                            disabled={reviewing}
                                                            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-semibold text-white text-xs disabled:opacity-50"
                                                            style={{ background: 'linear-gradient(135deg, #10B981, #059669)' }}>
                                                            <CheckCircle2 size={14} /> Approve
                                                        </motion.button>

                                                        <motion.button
                                                            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                                                            onClick={() => handleReview('edit_and_approve')}
                                                            disabled={reviewing}
                                                            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-semibold text-white text-xs disabled:opacity-50"
                                                            style={{ background: 'linear-gradient(135deg, #3B82F6, #2563EB)' }}>
                                                            <Edit3 size={14} /> Edit & Approve
                                                        </motion.button>

                                                        <motion.button
                                                            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                                                            onClick={() => handleReview('reject')}
                                                            disabled={reviewing}
                                                            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-semibold text-xs text-red-600 bg-red-50 border border-red-200 disabled:opacity-50">
                                                            <XCircle size={14} /> Reject
                                                        </motion.button>

                                                        <div className="flex-1" />

                                                        <motion.button
                                                            whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                                                            onClick={handleSend}
                                                            disabled={sending || (selectedDraft.status !== 'approved' && selectedDraft.status !== 'generated')}
                                                            className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-white text-sm disabled:opacity-40"
                                                            style={{ background: 'linear-gradient(135deg, #0F766E, #14B8A6)' }}>
                                                            <Send size={14} />
                                                            {sending ? 'Sending...' : 'Send to Patient'}
                                                            <ArrowRight size={14} />
                                                        </motion.button>
                                                    </>
                                                )}

                                                {selectedDraft.status === 'sent' && (
                                                    <div className="flex items-center gap-2 text-sm text-accent font-semibold">
                                                        <CheckCircle2 size={18} />
                                                        Response sent to patient
                                                    </div>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
}
