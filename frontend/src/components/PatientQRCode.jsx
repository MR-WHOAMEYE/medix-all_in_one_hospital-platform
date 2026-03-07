import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { motion, AnimatePresence } from 'framer-motion';
import { QrCode, X, Download, Share2 } from 'lucide-react';

/**
 * PatientQRCode — shows a button that opens a modal with the patient's unique QR.
 * The QR encodes a JSON payload: { type, id, email, name, department }
 */
export default function PatientQRCode({ user }) {
    const [open, setOpen] = useState(false);

    const qrPayload = JSON.stringify({
        type: 'zi_patient',
        id: user.id || user._id || '',
        email: user.email || '',
        name: user.name || '',
        department: user.department || '',
        ts: Date.now(),
    });

    const handleDownload = () => {
        const svg = document.getElementById('patient-qr-svg');
        if (!svg) return;
        const svgData = new XMLSerializer().serializeToString(svg);
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        img.onload = () => {
            canvas.width = 400;
            canvas.height = 400;
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, 400, 400);
            ctx.drawImage(img, 0, 0, 400, 400);
            const link = document.createElement('a');
            link.download = `QR_${user.name || 'patient'}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        };
        img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
    };

    return (
        <>
            <button
                onClick={() => setOpen(true)}
                className="px-4 py-2 text-xs font-semibold bg-violet-500/10 text-violet-700 rounded-xl hover:bg-violet-500/20 transition cursor-pointer flex items-center gap-2"
            >
                <QrCode size={14} /> My QR Code
            </button>

            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm"
                        onClick={() => setOpen(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                            onClick={e => e.stopPropagation()}
                            className="bg-white rounded-2xl shadow-2xl w-[360px] overflow-hidden"
                        >
                            {/* Header */}
                            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100"
                                style={{ background: 'linear-gradient(135deg, #0f766e, #14b8a6)' }}>
                                <div className="flex items-center gap-2">
                                    <QrCode size={18} className="text-white" />
                                    <span className="text-sm font-bold text-white">Patient QR Code</span>
                                </div>
                                <button onClick={() => setOpen(false)} className="text-white/70 hover:text-white cursor-pointer">
                                    <X size={18} />
                                </button>
                            </div>

                            {/* QR Content */}
                            <div className="flex flex-col items-center py-8 px-6">
                                <div className="p-4 bg-white rounded-2xl border-2 border-teal-100 shadow-sm">
                                    <QRCodeSVG
                                        id="patient-qr-svg"
                                        value={qrPayload}
                                        size={200}
                                        level="H"
                                        includeMargin={false}
                                        fgColor="#0f172a"
                                        bgColor="#ffffff"
                                    />
                                </div>

                                <div className="mt-5 text-center">
                                    <p className="text-sm font-bold text-gray-800">{user.name || 'Patient'}</p>
                                    <p className="text-xs text-gray-500 mt-0.5">{user.email}</p>
                                    {user.department && (
                                        <span className="inline-block mt-2 px-3 py-0.5 text-[10px] font-semibold rounded-full bg-teal-50 text-teal-700">
                                            {user.department}
                                        </span>
                                    )}
                                </div>

                                <p className="text-[10px] text-gray-400 mt-4 text-center leading-relaxed">
                                    Show this QR code at the hospital reception,<br />
                                    doctor's office, or nurse station for quick check-in.
                                </p>
                            </div>

                            {/* Actions */}
                            <div className="flex border-t border-gray-100">
                                <button onClick={handleDownload}
                                    className="flex-1 flex items-center justify-center gap-2 py-3.5 text-xs font-semibold text-teal-700 hover:bg-teal-50 transition cursor-pointer">
                                    <Download size={14} /> Save as PNG
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
