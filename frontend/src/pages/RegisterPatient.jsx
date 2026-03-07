import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    UserPlus, CheckCircle, Stethoscope, Building2, User, Mail,
    ChevronDown, Sparkles, FileText, Phone, ShieldCheck, Loader2,
    ArrowRight, KeyRound, RotateCcw
} from 'lucide-react';
import emailjs from '@emailjs/browser';
import { registerUser, getDoctors, generateOTP, verifyOTP } from '../services/api';

const DEPARTMENTS = ['Emergency', 'Cardiology', 'Orthopedics', 'Pediatrics', 'Neurology'];

// EmailJS configuration
const EMAILJS_SERVICE_ID = 'service_q8nz87h';
const EMAILJS_TEMPLATE_ID = 'template_q5z6vfz';
const EMAILJS_PUBLIC_KEY = 'I3ljGz81XKibPuUjm';

export default function RegisterPatient() {
    const [form, setForm] = useState({
        name: '', email: '', phone: '', department: '',
        assigned_doctor: '', assigned_doctor_name: '', issue: ''
    });
    const [doctors, setDoctors] = useState([]);
    const [loadingDoctors, setLoadingDoctors] = useState(false);
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState('');
    const [error, setError] = useState('');
    const token = sessionStorage.getItem('zi_token');

    // OTP state
    const [step, setStep] = useState('form'); // 'form' | 'otp_sent' | 'verified'
    const [otpCode, setOtpCode] = useState(['', '', '', '', '', '']);
    const [otpSending, setOtpSending] = useState(false);
    const [otpVerifying, setOtpVerifying] = useState(false);
    const [otpTimer, setOtpTimer] = useState(0);
    const otpRefs = useRef([]);

    // Countdown timer for OTP resend
    useEffect(() => {
        if (otpTimer <= 0) return;
        const id = setInterval(() => setOtpTimer(t => t - 1), 1000);
        return () => clearInterval(id);
    }, [otpTimer]);

    // Fetch doctors when department changes
    useEffect(() => {
        if (!form.department) {
            setDoctors([]);
            setForm(f => ({ ...f, assigned_doctor: '', assigned_doctor_name: '' }));
            return;
        }
        setLoadingDoctors(true);
        getDoctors(form.department)
            .then(res => {
                setDoctors(res.doctors || []);
                setForm(f => ({ ...f, assigned_doctor: '', assigned_doctor_name: '' }));
            })
            .catch(() => setDoctors([]))
            .finally(() => setLoadingDoctors(false));
    }, [form.department]);

    const handleDoctorChange = (e) => {
        const email = e.target.value;
        const doc = doctors.find(d => d.email === email);
        setForm(f => ({
            ...f,
            assigned_doctor: email,
            assigned_doctor_name: doc ? doc.name : ''
        }));
    };

    // ── Step 1: Send OTP ──
    const handleSendOTP = async () => {
        setError('');
        setOtpSending(true);
        try {
            // Generate OTP on backend
            const res = await generateOTP(form.email, form.name, token);
            const otp = res.data?.otp_code || res.otp_code;

            // Send email via EmailJS
            await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
                to_name: form.name,
                to_email: form.email,
                otp_code: otp,
            }, EMAILJS_PUBLIC_KEY);

            setStep('otp_sent');
            setOtpTimer(120); // 2 min cooldown
            setOtpCode(['', '', '', '', '', '']);
            setTimeout(() => otpRefs.current[0]?.focus(), 100);
        } catch (err) {
            setError(err?.response?.data?.detail || 'Failed to send OTP. Check email address.');
        } finally {
            setOtpSending(false);
        }
    };

    // ── Step 2: Verify OTP ──
    const handleVerifyOTP = async () => {
        const code = otpCode.join('');
        if (code.length !== 6) return;
        setError('');
        setOtpVerifying(true);
        try {
            await verifyOTP(form.email, code, token);
            setStep('verified');
        } catch (err) {
            setError(err?.response?.data?.detail || 'Invalid or expired OTP');
        } finally {
            setOtpVerifying(false);
        }
    };

    // ── Step 3: Complete Registration ──
    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(''); setSuccess(''); setLoading(true);
        try {
            await registerUser({
                ...form,
                password: form.phone, // Phone number as password
                role: 'patient',
            }, token);
            setSuccess(`Patient "${form.name}" registered — password is their phone number. Assigned to ${form.assigned_doctor_name || 'department'}.`);
            setForm({ name: '', email: '', phone: '', department: '', assigned_doctor: '', assigned_doctor_name: '', issue: '' });
            setStep('form');
            setOtpCode(['', '', '', '', '', '']);
        } catch (err) {
            setError(err?.response?.data?.detail || 'Failed to create patient');
        } finally { setLoading(false); }
    };

    // ── OTP input handlers ──
    const handleOtpChange = (idx, value) => {
        if (!/^\d*$/.test(value)) return;
        const next = [...otpCode];
        next[idx] = value.slice(-1);
        setOtpCode(next);
        if (value && idx < 5) {
            otpRefs.current[idx + 1]?.focus();
        }
    };

    const handleOtpKeyDown = (idx, e) => {
        if (e.key === 'Backspace' && !otpCode[idx] && idx > 0) {
            otpRefs.current[idx - 1]?.focus();
        }
    };

    const handleOtpPaste = (e) => {
        const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
        if (text.length === 6) {
            e.preventDefault();
            setOtpCode(text.split(''));
            otpRefs.current[5]?.focus();
        }
    };

    /* ---- shared input class ---- */
    const inputCls = `w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-border bg-surface text-sm
        focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all duration-200
        placeholder:text-text-secondary/40`;

    const selectCls = `w-full pl-10 pr-8 py-2.5 rounded-xl border border-border bg-surface text-sm
        focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all duration-200
        cursor-pointer appearance-none`;

    const labelCls = 'block text-xs font-semibold text-text-secondary mb-1.5 tracking-wide uppercase';

    const iconWrap = 'absolute left-3 top-1/2 -translate-y-1/2 text-primary/50 pointer-events-none';

    const formValid = form.name && form.email && form.phone && form.department && form.assigned_doctor && form.issue;

    return (
        <div className="max-w-lg mx-auto space-y-6 mt-8 pb-8">
            {/* ── Header ── */}
            <motion.div
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="text-center"
            >
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5
                    flex items-center justify-center mx-auto mb-3 shadow-lg shadow-primary/10 relative overflow-hidden">
                    <UserPlus size={28} className="text-primary relative z-10" />
                    <div className="absolute inset-0 bg-gradient-to-tr from-transparent to-white/20" />
                </div>
                <h1 className="text-2xl font-bold text-text-primary">Register Patient</h1>
                <p className="text-sm text-text-secondary mt-1">Admit a new patient, verify email & assign a doctor</p>
            </motion.div>

            {/* ── Step Indicator ── */}
            <div className="flex items-center justify-center gap-2">
                {[
                    { key: 'form', label: 'Details', icon: FileText },
                    { key: 'otp_sent', label: 'Verify Email', icon: KeyRound },
                    { key: 'verified', label: 'Complete', icon: CheckCircle },
                ].map((s, i) => {
                    const active = s.key === step;
                    const done = (step === 'otp_sent' && i === 0) || (step === 'verified' && i <= 1);
                    return (
                        <div key={s.key} className="flex items-center gap-2">
                            {i > 0 && <div className={`w-8 h-0.5 rounded-full ${done || active ? 'bg-primary' : 'bg-border'}`} />}
                            <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                active ? 'bg-primary text-white' : done ? 'bg-primary/10 text-primary' : 'bg-surface text-text-secondary/50'}`}>
                                <s.icon size={12} /> {s.label}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* ── STEP 1: FORM ── */}
            <AnimatePresence mode="wait">
                {step === 'form' && (
                    <motion.div
                        key="form"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.3 }}
                        className="p-6 rounded-2xl bg-surface-card border border-border space-y-5
                            shadow-xl shadow-black/[0.03]"
                    >
                        {/* ── Patient Name ── */}
                        <div>
                            <label className={labelCls}>Patient Name</label>
                            <div className="relative">
                                <span className={iconWrap}><User size={16} /></span>
                                <input value={form.name}
                                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                    placeholder="Full name" required className={inputCls} />
                            </div>
                        </div>

                        {/* ── Email ── */}
                        <div>
                            <label className={labelCls}>Email</label>
                            <div className="relative">
                                <span className={iconWrap}><Mail size={16} /></span>
                                <input type="email" value={form.email}
                                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                                    placeholder="patient@email.com" required className={inputCls} />
                            </div>
                        </div>

                        {/* ── Phone Number ── */}
                        <div>
                            <label className={labelCls}>Phone Number <span className="text-[10px] font-normal normal-case text-text-secondary/60">(will be used as login password)</span></label>
                            <div className="relative">
                                <span className={iconWrap}><Phone size={16} /></span>
                                <input type="tel" value={form.phone}
                                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                                    placeholder="e.g. 9876543210" required className={inputCls} />
                            </div>
                        </div>

                        {/* ── Department ── */}
                        <div>
                            <label className={labelCls}>Department</label>
                            <div className="relative">
                                <span className={iconWrap}><Building2 size={16} /></span>
                                <select value={form.department}
                                    onChange={e => setForm(f => ({ ...f, department: e.target.value }))}
                                    className={selectCls} required>
                                    <option value="">Select department...</option>
                                    {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                                </select>
                                <ChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary/50 pointer-events-none" />
                            </div>
                        </div>

                        {/* ── Assign Doctor ── */}
                        <AnimatePresence>
                            {form.department && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    transition={{ duration: 0.3 }}
                                >
                                    <label className={labelCls}>
                                        <span className="flex items-center gap-1.5">
                                            Assign Doctor
                                            {loadingDoctors && (
                                                <span className="inline-block w-3 h-3 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                                            )}
                                        </span>
                                    </label>
                                    <div className="relative">
                                        <span className={iconWrap}><Stethoscope size={16} /></span>
                                        <select value={form.assigned_doctor}
                                            onChange={handleDoctorChange}
                                            className={selectCls} required disabled={loadingDoctors}>
                                            <option value="">
                                                {loadingDoctors ? 'Loading doctors...'
                                                    : doctors.length === 0 ? 'No doctors in this department'
                                                        : 'Choose a doctor...'}
                                            </option>
                                            {doctors.map(d => (
                                                <option key={d.email} value={d.email}>{d.name}</option>
                                            ))}
                                        </select>
                                        <ChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary/50 pointer-events-none" />
                                    </div>
                                    {doctors.length > 0 && (
                                        <p className="text-[11px] text-text-secondary/60 mt-1.5 pl-1 flex items-center gap-1">
                                            <Sparkles size={10} />
                                            {doctors.length} doctor{doctors.length !== 1 ? 's' : ''} available
                                            in {form.department}
                                        </p>
                                    )}
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* ── Issue / Reason ── */}
                        <div>
                            <label className={labelCls}>Issue / Reason for Visit</label>
                            <div className="relative">
                                <span className="absolute left-3 top-3 text-primary/50 pointer-events-none">
                                    <FileText size={16} />
                                </span>
                                <textarea value={form.issue}
                                    onChange={e => setForm(f => ({ ...f, issue: e.target.value }))}
                                    placeholder="Describe the patient's symptoms, complaint, or reason for admission..."
                                    rows={3} required
                                    className={`w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-border bg-surface text-sm
                                        focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all duration-200
                                        placeholder:text-text-secondary/40 resize-none`} />
                            </div>
                        </div>

                        {/* ── Messages ── */}
                        <AnimatePresence>
                            {error && (
                                <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                                    className="text-rose-600 text-xs bg-rose-50 border border-rose-200/50 px-3 py-2.5 rounded-lg">
                                    {error}
                                </motion.p>
                            )}
                        </AnimatePresence>

                        {/* ── Send OTP Button ── */}
                        <button type="button" onClick={handleSendOTP}
                            disabled={otpSending || !formValid}
                            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-primary to-primary-dark text-white font-semibold text-sm
                                shadow-lg shadow-primary/20 cursor-pointer disabled:opacity-50 transition-all
                                hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-0.5 active:translate-y-0
                                flex items-center justify-center gap-2">
                            {otpSending ? (
                                <>
                                    <Loader2 size={16} className="animate-spin" />
                                    Sending Verification Code...
                                </>
                            ) : (
                                <>
                                    Send OTP to Email <ArrowRight size={16} />
                                </>
                            )}
                        </button>
                    </motion.div>
                )}

                {/* ── STEP 2: OTP VERIFICATION ── */}
                {step === 'otp_sent' && (
                    <motion.div
                        key="otp"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        transition={{ duration: 0.3 }}
                        className="p-6 rounded-2xl bg-surface-card border border-border space-y-5
                            shadow-xl shadow-black/[0.03]"
                    >
                        <div className="text-center">
                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500/15 to-emerald-500/5
                                flex items-center justify-center mx-auto mb-3">
                                <ShieldCheck size={28} className="text-emerald-600" />
                            </div>
                            <h2 className="text-lg font-bold text-text-primary">Verify Patient Email</h2>
                            <p className="text-sm text-text-secondary mt-1">
                                OTP sent to <strong className="text-text-primary">{form.email}</strong>
                            </p>
                            <p className="text-xs text-text-secondary/60 mt-1">
                                Ask the patient for the 6-digit code from their email
                            </p>
                        </div>

                        {/* ── OTP Input ── */}
                        <div className="flex justify-center gap-2.5" onPaste={handleOtpPaste}>
                            {otpCode.map((digit, i) => (
                                <input key={i}
                                    ref={el => otpRefs.current[i] = el}
                                    type="text" inputMode="numeric" maxLength={1}
                                    value={digit}
                                    onChange={e => handleOtpChange(i, e.target.value)}
                                    onKeyDown={e => handleOtpKeyDown(i, e)}
                                    className="w-12 h-14 rounded-xl border-2 border-border bg-surface text-center text-xl font-bold text-text-primary
                                        focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all" />
                            ))}
                        </div>

                        {/* ── Timer + Resend ── */}
                        <div className="text-center text-xs text-text-secondary">
                            {otpTimer > 0 ? (
                                <span>Resend in <strong className="text-primary">{Math.floor(otpTimer / 60)}:{(otpTimer % 60).toString().padStart(2, '0')}</strong></span>
                            ) : (
                                <button onClick={handleSendOTP} disabled={otpSending}
                                    className="text-primary font-bold hover:underline flex items-center gap-1 mx-auto">
                                    <RotateCcw size={11} /> Resend OTP
                                </button>
                            )}
                        </div>

                        {/* ── Messages ── */}
                        <AnimatePresence>
                            {error && (
                                <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                                    className="text-rose-600 text-xs bg-rose-50 border border-rose-200/50 px-3 py-2.5 rounded-lg">
                                    {error}
                                </motion.p>
                            )}
                        </AnimatePresence>

                        {/* ── Actions ── */}
                        <div className="flex gap-2">
                            <button type="button" onClick={() => { setStep('form'); setError(''); }}
                                className="flex-1 py-2.5 rounded-xl border border-border text-text-secondary font-semibold text-sm
                                    hover:bg-surface transition-all">
                                Back
                            </button>
                            <button type="button" onClick={handleVerifyOTP}
                                disabled={otpVerifying || otpCode.join('').length !== 6}
                                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-semibold text-sm
                                    shadow-lg shadow-emerald-500/20 cursor-pointer disabled:opacity-50 transition-all
                                    hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0
                                    flex items-center justify-center gap-2">
                                {otpVerifying ? (
                                    <><Loader2 size={14} className="animate-spin" /> Verifying...</>
                                ) : (
                                    <><ShieldCheck size={14} /> Verify Code</>
                                )}
                            </button>
                        </div>
                    </motion.div>
                )}

                {/* ── STEP 3: CONFIRMED — COMPLETE REGISTRATION ── */}
                {step === 'verified' && (
                    <motion.div
                        key="verified"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="p-6 rounded-2xl bg-surface-card border border-border space-y-5
                            shadow-xl shadow-black/[0.03]"
                    >
                        <div className="text-center">
                            <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-3">
                                <CheckCircle size={32} className="text-emerald-500" />
                            </div>
                            <h2 className="text-lg font-bold text-text-primary">Email Verified!</h2>
                            <p className="text-sm text-text-secondary mt-1">
                                <strong>{form.email}</strong> verified successfully
                            </p>
                        </div>

                        {/* Summary */}
                        <div className="bg-surface rounded-xl border border-border p-4 space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-text-secondary">Name</span>
                                <span className="font-bold text-text-primary">{form.name}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-text-secondary">Email</span>
                                <span className="font-bold text-text-primary">{form.email}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-text-secondary">Phone</span>
                                <span className="font-bold text-text-primary">{form.phone}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-text-secondary">Department</span>
                                <span className="font-bold text-text-primary">{form.department}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-text-secondary">Doctor</span>
                                <span className="font-bold text-text-primary">{form.assigned_doctor_name}</span>
                            </div>
                            <hr className="border-border" />
                            <div className="bg-amber-50 border border-amber-200/50 rounded-lg px-3 py-2 text-xs text-amber-700">
                                <strong>Login password</strong> will be set to the patient's phone number: <strong>{form.phone}</strong>
                            </div>
                        </div>

                        {/* ── Messages ── */}
                        <AnimatePresence>
                            {error && (
                                <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                                    className="text-rose-600 text-xs bg-rose-50 border border-rose-200/50 px-3 py-2.5 rounded-lg">
                                    {error}
                                </motion.p>
                            )}
                            {success && (
                                <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                                    className="text-emerald-600 text-xs bg-emerald-50 border border-emerald-200/50
                                        px-3 py-2.5 rounded-lg flex items-center gap-1.5">
                                    <CheckCircle size={14} /> {success}
                                </motion.p>
                            )}
                        </AnimatePresence>

                        {/* ── Complete ── */}
                        <button type="button" onClick={handleSubmit} disabled={loading}
                            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-primary to-primary-dark text-white font-semibold text-sm
                                shadow-lg shadow-primary/20 cursor-pointer disabled:opacity-50 transition-all
                                hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-0.5 active:translate-y-0">
                            {loading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Creating Account...
                                </span>
                            ) : 'Complete Registration'}
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
