import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Sparkles, Send, RefreshCw, CheckCircle2, XCircle, Edit3, Clock,
    AlertTriangle, Filter, BarChart3, MessageSquare, ChevronRight,
    Inbox, Zap, User, ArrowRight, RotateCcw, Mail, Shield,
    BookOpen, Brain, Eye, Search
} from 'lucide-react';
import {
    getPatientQueries, getPatientQuery, generateDraft, getDrafts, reviewDraft,
    sendDraftResponse, getResponseStats
} from '../services/api';
import { sendDraftEmail } from '../utils/emailService';

const CATEGORIES = {
    billing: { label: 'Billing', icon: '💳', color: '#0EA5E9', bg: '#F0F9FF' },
    appointment: { label: 'Appointment', icon: '📅', color: '#8B5CF6', bg: '#F5F3FF' },
    medication: { label: 'Medication', icon: '💊', color: '#EF4444', bg: '#FEF2F2' },
    lab_results: { label: 'Lab Results', icon: '🔬', color: '#F59E0B', bg: '#FFFBEB' },
    general: { label: 'General', icon: '💬', color: '#6B7280', bg: '#F9FAFB' },
};

const PRIORITY_COLORS = {
    urgent: { color: '#DC2626', bg: '#FEE2E2', label: 'Urgent' },
    high: { color: '#EF4444', bg: '#FEF2F2', label: 'High' },
    medium: { color: '#F59E0B', bg: '#FEF3C7', label: 'Medium' },
    low: { color: '#6B7280', bg: '#F3F4F6', label: 'Low' },
};

const STATUS_CONFIG = {
    pending: { label: 'Pending', color: '#F59E0B', bg: '#FEF3C7', border: '#FDE68A' },
    ai_drafted: { label: 'AI Drafted', color: '#8B5CF6', bg: '#EDE9FE', border: '#C4B5FD' },
    staff_reviewing: { label: 'Reviewing', color: '#3B82F6', bg: '#DBEAFE', border: '#93C5FD' },
    responded: { label: 'Responded', color: '#10B981', bg: '#D1FAE5', border: '#6EE7B7' },
    closed: { label: 'Closed', color: '#6B7280', bg: '#F3F4F6', border: '#D1D5DB' },
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
    const [searchQuery, setSearchQuery] = useState('');
    const [sendSuccess, setSendSuccess] = useState('');

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
        setSendSuccess('');

        // Fetch full query details (includes drafts)
        try {
            const fullQuery = await getPatientQuery(q.id);
            if (fullQuery) {
                setSelectedQuery(prev => ({ ...prev, ...fullQuery }));
                if (fullQuery.drafts && fullQuery.drafts.length > 0) {
                    const latest = fullQuery.drafts[0];
                    setSelectedDraft(latest);
                    setEditText(latest.draft_text || '');
                }
            }
        } catch (err) {
            console.error('Failed to fetch query details:', err);
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
            await sendDraftResponse(selectedDraft.id, { staff_email: user.email || 'staff' });
            try {
                await sendDraftEmail({
                    patientName: selectedQuery.patient_name,
                    patientEmail: selectedQuery.patient_email,
                    subject: selectedQuery.subject,
                    category: selectedQuery.category,
                    responseText: editText || selectedDraft.draft_text,
                    staffName: user.name || user.email || 'Hospital Staff',
                    priority: selectedQuery.priority,
                });
            } catch (emailErr) {
                console.warn('Email delivery failed (response still saved):', emailErr);
            }
            setSelectedDraft(d => ({ ...d, status: 'sent' }));
            setSendSuccess('Response sent to patient successfully!');
            setTimeout(() => {
                setSelectedQuery(null);
                setSelectedDraft(null);
                setEditText('');
                setStaffNotes('');
                setSendSuccess('');
            }, 2000);
            fetchData();
        } catch (err) {
            console.error('Send failed:', err);
        }
        setSending(false);
    };

    const filteredQueries = queries.filter(q => {
        if (!searchQuery) return true;
        const s = searchQuery.toLowerCase();
        return q.subject?.toLowerCase().includes(s) || q.patient_name?.toLowerCase().includes(s) || q.message?.toLowerCase().includes(s);
    });

    const canSend = selectedDraft && selectedDraft.status !== 'sent' && (selectedDraft.status === 'approved' || selectedDraft.status === 'generated');

    return (
        <div className="max-w-[1600px] mx-auto space-y-5">

            {/* ═══ HERO BANNER ═══ */}
            <div className="rounded-2xl overflow-hidden" style={{ background: 'linear-gradient(135deg, #042F2E 0%, #0A4A44 40%, #0F766E 100%)' }}>
                <div className="px-10 py-7 flex items-center justify-between">
                    <div className="flex items-center gap-5">
                        <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.07)' }}>
                            <Brain size={28} color="#A78BFA" />
                        </div>
                        <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] mb-1" style={{ color: 'rgba(167,139,250,0.5)' }}>AI-Powered Response Engine</p>
                            <h1 className="text-2xl font-extrabold text-white tracking-tight leading-tight">Response Suggestions</h1>
                            <p className="text-[13px] mt-1" style={{ color: 'rgba(153,246,228,0.38)' }}>Review AI-generated drafts, refine responses, and send to patients</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-6">
                        {stats && [
                            { label: 'Pending', value: stats.pending, icon: Clock, color: '#FCD34D' },
                            { label: 'AI Drafted', value: stats.ai_drafted, icon: Sparkles, color: '#A78BFA' },
                            { label: 'Reviewing', value: stats.staff_reviewing, icon: Eye, color: '#60A5FA' },
                            { label: 'Responded', value: stats.responded, icon: CheckCircle2, color: '#6EE7B7' },
                            { label: 'Total', value: stats.total_queries, icon: BarChart3, color: '#F0FDFA' },
                        ].map(s => (
                            <div key={s.label} className="text-center px-3">
                                <s.icon size={16} className="mx-auto mb-1" style={{ color: s.color }} />
                                <p className="text-xl font-bold text-white">{s.value}</p>
                                <p className="text-[10px] font-medium" style={{ color: 'rgba(153,246,228,0.4)' }}>{s.label}</p>
                            </div>
                        ))}
                        <button onClick={fetchData} className="ml-2 p-2.5 rounded-xl transition-all hover:scale-105" style={{ background: 'rgba(255,255,255,0.07)' }}>
                            <RefreshCw size={16} color="#6EE7B7" />
                        </button>
                    </div>
                </div>
            </div>

            {/* ═══ FILTERS BAR ═══ */}
            <div className="bg-surface-card rounded-2xl border border-border p-4 shadow-sm">
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 mr-2">
                        <Filter size={13} className="text-primary" />
                        <span className="text-[11px] font-bold text-text-secondary uppercase tracking-wider">Status</span>
                    </div>
                    <div className="flex gap-1 bg-surface rounded-xl p-1 border border-border">
                        {['', 'pending', 'ai_drafted', 'staff_reviewing', 'responded'].map(s => (
                            <button key={s} onClick={() => setFilterStatus(s)}
                                className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all cursor-pointer
                                    ${filterStatus === s
                                        ? 'bg-gradient-to-r from-primary to-teal-600 text-white shadow-sm'
                                        : 'text-text-muted hover:text-text-secondary hover:bg-white'}`}>
                                {s === '' ? 'All' : STATUS_CONFIG[s]?.label || s}
                            </button>
                        ))}
                    </div>

                    <div className="w-px h-6 bg-border mx-1" />

                    <div className="flex items-center gap-2 mr-2">
                        <BookOpen size={13} className="text-primary" />
                        <span className="text-[11px] font-bold text-text-secondary uppercase tracking-wider">Category</span>
                    </div>
                    <div className="flex gap-1 bg-surface rounded-xl p-1 border border-border">
                        {['', ...Object.keys(CATEGORIES)].map(c => (
                            <button key={c} onClick={() => setFilterCategory(c)}
                                className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all cursor-pointer
                                    ${filterCategory === c
                                        ? 'bg-gradient-to-r from-primary to-teal-600 text-white shadow-sm'
                                        : 'text-text-muted hover:text-text-secondary hover:bg-white'}`}>
                                {c === '' ? 'All' : CATEGORIES[c]?.label || c}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* ═══ MAIN LAYOUT ═══ */}
            <div className="grid grid-cols-12 gap-5" style={{ minHeight: 'calc(100vh - 340px)' }}>

                {/* ── QUERY LIST (5 cols) ── */}
                <div className="col-span-5 bg-surface-card rounded-2xl border border-border flex flex-col overflow-hidden shadow-sm">
                    {/* Search header */}
                    <div className="px-5 py-4 border-b border-border">
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="text-sm font-bold text-text-primary flex items-center gap-2">
                                <div className="w-1.5 h-5 rounded-full bg-primary" /> Patient Queries
                            </h2>
                            <span className="text-[10px] font-bold text-text-muted bg-surface px-2.5 py-1 rounded-lg border border-border">{filteredQueries.length} queries</span>
                        </div>
                        <div className="relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                                placeholder="Search queries by subject, name..."
                                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-border bg-surface text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all" />
                        </div>
                    </div>

                    {/* Query list */}
                    <div className="flex-1 overflow-y-auto">
                        {loading ? (
                            <div className="flex items-center justify-center py-20">
                                <div className="text-center">
                                    <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                                    <p className="text-[10px] text-text-muted">Loading queries...</p>
                                </div>
                            </div>
                        ) : filteredQueries.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20">
                                <Inbox size={32} className="text-text-muted/15 mb-3" />
                                <p className="text-xs text-text-muted">No queries found</p>
                            </div>
                        ) : filteredQueries.map((q, idx) => {
                            const isSelected = selectedQuery?.id === q.id;
                            const cat = CATEGORIES[q.category] || CATEGORIES.general;
                            const prio = PRIORITY_COLORS[q.priority] || PRIORITY_COLORS.medium;
                            const statusCfg = STATUS_CONFIG[q.status] || STATUS_CONFIG.pending;

                            return (
                                <motion.div key={q.id || idx} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.03 }}>
                                    <button onClick={() => handleSelectQuery(q)}
                                        className={`w-full text-left px-5 py-4 border-b border-border/50 cursor-pointer transition-all group
                                            ${isSelected ? 'bg-primary/[0.04] border-l-[3px] border-l-primary' : 'hover:bg-surface/80'}`}>
                                        <div className="flex items-start gap-3">
                                            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0 mt-0.5"
                                                style={{ background: cat.bg }}>
                                                {cat.icon}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <h4 className="text-[12px] font-bold text-text-primary truncate flex-1">{q.subject}</h4>
                                                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: prio.color }} title={prio.label} />
                                                    <ChevronRight size={13} className={`text-text-muted/40 flex-shrink-0 transition-all ${isSelected ? 'text-primary' : 'group-hover:translate-x-0.5'}`} />
                                                </div>
                                                <p className="text-[10px] text-text-muted mt-0.5 line-clamp-1">{q.message}</p>
                                                <div className="flex items-center gap-2 mt-2 flex-wrap">
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-bold border"
                                                        style={{ backgroundColor: statusCfg.bg, color: statusCfg.color, borderColor: statusCfg.border }}>
                                                        {statusCfg.label}
                                                    </span>
                                                    <span className="text-[9px] text-text-muted flex items-center gap-1">
                                                        <User size={9} /> {q.patient_name}
                                                    </span>
                                                    <span className="text-[9px] text-text-muted">
                                                        {new Date(q.created_at).toLocaleDateString()}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </button>
                                </motion.div>
                            );
                        })}
                    </div>
                </div>

                {/* ── REVIEW PANEL (7 cols) ── */}
                <div className="col-span-7">
                    <AnimatePresence mode="wait">
                        {!selectedQuery ? (
                            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                className="h-full flex items-center justify-center bg-surface-card rounded-2xl border border-border shadow-sm">
                                <div className="text-center max-w-xs">
                                    <div className="w-20 h-20 rounded-3xl bg-primary/5 flex items-center justify-center mx-auto mb-5">
                                        <MessageSquare size={36} className="text-primary/20" />
                                    </div>
                                    <h3 className="text-base font-bold text-text-primary mb-2">Select a Query</h3>
                                    <p className="text-xs text-text-muted leading-relaxed">Choose a patient query from the list to review, generate an AI draft response, and send it to the patient.</p>
                                </div>
                            </motion.div>
                        ) : (
                            <motion.div key={selectedQuery.id}
                                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                                className="space-y-4">

                                {/* ── Query Header Card ── */}
                                <div className="rounded-2xl overflow-hidden border border-border shadow-sm" style={{ background: 'linear-gradient(135deg, #F0FDFA 0%, #F5F3FF 50%, #FFF7ED 100%)' }}>
                                    <div className="px-6 py-5">
                                        <div className="flex items-start justify-between">
                                            <div className="flex items-center gap-4 min-w-0 flex-1">
                                                <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0"
                                                    style={{ background: (CATEGORIES[selectedQuery.category] || CATEGORIES.general).bg }}>
                                                    {(CATEGORIES[selectedQuery.category] || CATEGORIES.general).icon}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <h3 className="text-lg font-extrabold text-text-primary tracking-tight truncate">{selectedQuery.subject}</h3>
                                                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                                                        <span className="text-[11px] text-text-muted flex items-center gap-1"><User size={11} /> {selectedQuery.patient_name}</span>
                                                        <span className="text-[11px] text-text-muted flex items-center gap-1"><Mail size={10} /> {selectedQuery.patient_email}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                                                <span className="px-3 py-1.5 rounded-lg text-[10px] font-bold border"
                                                    style={{
                                                        backgroundColor: (PRIORITY_COLORS[selectedQuery.priority] || PRIORITY_COLORS.medium).bg,
                                                        color: (PRIORITY_COLORS[selectedQuery.priority] || PRIORITY_COLORS.medium).color,
                                                        borderColor: (PRIORITY_COLORS[selectedQuery.priority] || PRIORITY_COLORS.medium).color + '30',
                                                    }}>
                                                    {(PRIORITY_COLORS[selectedQuery.priority] || PRIORITY_COLORS.medium).label} Priority
                                                </span>
                                                <span className="px-3 py-1.5 rounded-lg text-[10px] font-bold border"
                                                    style={{
                                                        backgroundColor: (STATUS_CONFIG[selectedQuery.status] || STATUS_CONFIG.pending).bg,
                                                        color: (STATUS_CONFIG[selectedQuery.status] || STATUS_CONFIG.pending).color,
                                                        borderColor: (STATUS_CONFIG[selectedQuery.status] || STATUS_CONFIG.pending).border,
                                                    }}>
                                                    {(STATUS_CONFIG[selectedQuery.status] || STATUS_CONFIG.pending).label}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Patient Message */}
                                    <div className="px-6 py-4 border-t border-border/30" style={{ background: 'rgba(255,255,255,0.5)' }}>
                                        <p className="text-[9px] font-bold text-text-muted uppercase tracking-wider mb-2 flex items-center gap-1">
                                            <MessageSquare size={10} className="text-primary" /> Patient Message
                                        </p>
                                        <div className="px-4 py-3 bg-white rounded-xl border border-border/50">
                                            <p className="text-sm text-text-primary leading-relaxed whitespace-pre-wrap">{selectedQuery.message}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Success message */}
                                <AnimatePresence>
                                    {sendSuccess && (
                                        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                                            className="flex items-center gap-2 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl shadow-sm">
                                            <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0"><CheckCircle2 size={14} className="text-emerald-600" /></div>
                                            <p className="text-xs font-semibold text-emerald-700">{sendSuccess}</p>
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                {/* ── AI Draft Section ── */}
                                <div className="bg-surface-card rounded-2xl border border-border shadow-sm overflow-hidden">
                                    {!selectedDraft ? (
                                        <div className="text-center py-12 px-6">
                                            <div className="w-16 h-16 rounded-2xl bg-violet-50 flex items-center justify-center mx-auto mb-4">
                                                <Sparkles size={28} className="text-violet-400" />
                                            </div>
                                            <h4 className="text-sm font-bold text-text-primary mb-1">No AI Draft Yet</h4>
                                            <p className="text-xs text-text-muted mb-5">Generate an AI-powered response based on knowledge base & patient context</p>
                                            <motion.button
                                                whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                                                onClick={handleGenerateDraft}
                                                disabled={generating}
                                                className="inline-flex items-center gap-2 px-7 py-3 rounded-xl font-bold text-white text-sm disabled:opacity-50 cursor-pointer shadow-lg shadow-violet-500/20 transition-shadow hover:shadow-xl hover:shadow-violet-500/30"
                                                style={{ background: 'linear-gradient(135deg, #8B5CF6, #6D28D9)' }}>
                                                {generating ? (
                                                    <><div className="w-4 h-4 border-2 border-white/60 border-t-white rounded-full animate-spin" /> Generating Draft...</>
                                                ) : (
                                                    <><Zap size={16} /> Generate AI Draft</>
                                                )}
                                            </motion.button>
                                        </div>
                                    ) : (
                                        <>
                                            {/* Draft header bar */}
                                            <div className="px-6 py-3 border-b border-border flex items-center justify-between" style={{ background: 'linear-gradient(135deg, #F5F3FF, #EDE9FE)' }}>
                                                <div className="flex items-center gap-2">
                                                    <Sparkles size={15} className="text-violet-500" />
                                                    <span className="text-xs font-bold text-violet-700 uppercase tracking-wider">AI-Generated Draft</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {selectedDraft.confidence_score != null && (
                                                        <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold border"
                                                            style={{
                                                                backgroundColor: selectedDraft.confidence_score >= 0.7 ? '#D1FAE5' : '#FEF3C7',
                                                                color: selectedDraft.confidence_score >= 0.7 ? '#059669' : '#D97706',
                                                                borderColor: selectedDraft.confidence_score >= 0.7 ? '#6EE7B7' : '#FDE68A',
                                                            }}>
                                                            {Math.round(selectedDraft.confidence_score * 100)}% confidence
                                                        </span>
                                                    )}
                                                    {selectedDraft.intent && (
                                                        <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-violet-100 text-violet-600 border border-violet-200">
                                                            {selectedDraft.intent}
                                                        </span>
                                                    )}
                                                    <button onClick={handleGenerateDraft} disabled={generating}
                                                        className="p-1.5 hover:bg-violet-100 rounded-lg transition-colors cursor-pointer" title="Regenerate draft">
                                                        <RotateCcw size={13} className="text-violet-500" />
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Knowledge Sources */}
                                            {selectedDraft.knowledge_sources?.length > 0 && (
                                                <div className="px-6 py-3 border-b border-border/50 bg-blue-50/30">
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {selectedDraft.knowledge_sources.map((src, i) => (
                                                            <span key={i} className="text-[10px] px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 font-medium border border-blue-100 flex items-center gap-1">
                                                                <BookOpen size={10} /> {src}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Editable Draft */}
                                            <div className="p-6 space-y-4">
                                                <textarea
                                                    value={editText}
                                                    onChange={e => setEditText(e.target.value)}
                                                    rows={8}
                                                    className="w-full px-4 py-3 rounded-xl border border-border bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-y leading-relaxed transition-all"
                                                />

                                                {/* Staff Notes */}
                                                <div>
                                                    <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1.5">
                                                        Staff Notes (internal only)
                                                    </label>
                                                    <input type="text" value={staffNotes}
                                                        onChange={e => setStaffNotes(e.target.value)}
                                                        className="w-full px-4 py-2.5 rounded-xl border border-border bg-surface text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                                                        placeholder="Add an internal note about this response..." />
                                                </div>

                                                {/* Action Buttons */}
                                                <div className="flex items-center gap-2 pt-2 flex-wrap">
                                                    {selectedDraft.status !== 'sent' ? (
                                                        <>
                                                            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                                                                onClick={() => handleReview('approve')} disabled={reviewing}
                                                                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-bold text-white text-[11px] disabled:opacity-50 cursor-pointer shadow-sm hover:shadow-md transition-all"
                                                                style={{ background: 'linear-gradient(135deg, #10B981, #059669)' }}>
                                                                <CheckCircle2 size={13} /> Approve
                                                            </motion.button>

                                                            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                                                                onClick={() => handleReview('edit_and_approve')} disabled={reviewing}
                                                                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-bold text-white text-[11px] disabled:opacity-50 cursor-pointer shadow-sm hover:shadow-md transition-all"
                                                                style={{ background: 'linear-gradient(135deg, #3B82F6, #2563EB)' }}>
                                                                <Edit3 size={13} /> Edit & Approve
                                                            </motion.button>

                                                            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                                                                onClick={() => handleReview('reject')} disabled={reviewing}
                                                                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-bold text-[11px] text-red-600 bg-red-50 border border-red-200 disabled:opacity-50 cursor-pointer hover:bg-red-100 transition-all">
                                                                <XCircle size={13} /> Reject
                                                            </motion.button>

                                                            <div className="flex-1" />

                                                            <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                                                                onClick={handleSend}
                                                                disabled={sending || !canSend}
                                                                className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-white text-xs disabled:opacity-40 cursor-pointer shadow-lg shadow-primary/20 hover:shadow-xl transition-all"
                                                                style={{ background: 'linear-gradient(135deg, #0F766E, #14B8A6)' }}>
                                                                <Send size={13} />
                                                                {sending ? 'Sending...' : 'Send to Patient'}
                                                                <ArrowRight size={13} />
                                                            </motion.button>
                                                        </>
                                                    ) : (
                                                        <div className="flex items-center gap-2 px-4 py-3 bg-emerald-50 rounded-xl border border-emerald-200 w-full">
                                                            <CheckCircle2 size={18} className="text-emerald-600" />
                                                            <span className="text-sm font-bold text-emerald-700">Response sent to patient</span>
                                                        </div>
                                                    )}
                                                </div>
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
