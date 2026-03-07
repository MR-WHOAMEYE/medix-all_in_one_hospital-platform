import { useState, useEffect, useRef, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { motion, AnimatePresence } from 'framer-motion';
import { ScanLine, X, User, Mail, Building2, AlertCircle, CheckCircle, Camera, Upload, ImageIcon } from 'lucide-react';

/**
 * QRScanner — camera scan OR image upload to read patient QR codes.
 * When a valid patient QR is scanned, calls onScanSuccess({ id, email, name, department }).
 */
export default function QRScanner({ onScanSuccess }) {
    const [open, setOpen] = useState(false);
    const [mode, setMode] = useState('camera'); // 'camera' | 'upload'
    const [scannedData, setScannedData] = useState(null);
    const [error, setError] = useState('');
    const scannerRef = useRef(null);
    const fileInputRef = useRef(null);
    const readerIdRef = useRef('qr-reader-' + Math.random().toString(36).slice(2, 9));

    const processQR = useCallback((decodedText) => {
        try {
            const data = JSON.parse(decodedText);
            if (data.type !== 'zi_patient' || !data.email) {
                setError('Invalid QR code — not a patient code');
                return;
            }
            setScannedData(data);
            setError('');
            if (scannerRef.current) scannerRef.current.stop().catch(() => {});
        } catch {
            setError('Invalid QR format');
        }
    }, []);

    // Camera mode
    useEffect(() => {
        if (!open || mode !== 'camera') return;

        let scanner = null;
        const startTimeout = setTimeout(() => {
            const readerId = readerIdRef.current;
            const el = document.getElementById(readerId);
            if (!el) return;

            scanner = new Html5Qrcode(readerId);
            scannerRef.current = scanner;

            scanner.start(
                { facingMode: 'environment' },
                { fps: 10, qrbox: { width: 250, height: 250 } },
                processQR,
                () => {}
            ).catch((err) => {
                setError('Camera access denied or unavailable. Try uploading an image instead.');
                console.error('QR scanner error:', err);
            });
        }, 300);

        return () => {
            clearTimeout(startTimeout);
            if (scannerRef.current) {
                scannerRef.current.stop().catch(() => {});
                scannerRef.current = null;
            }
        };
    }, [open, mode, processQR]);

    const handleFileUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setError('');
        try {
            const readerId = readerIdRef.current;
            let scanner = scannerRef.current;
            if (!scanner) {
                const el = document.getElementById(readerId);
                if (!el) {
                    // Create a temporary hidden div for the scanner
                    const tempDiv = document.createElement('div');
                    tempDiv.id = readerId + '-temp';
                    tempDiv.style.display = 'none';
                    document.body.appendChild(tempDiv);
                    scanner = new Html5Qrcode(readerId + '-temp');
                } else {
                    scanner = new Html5Qrcode(readerId);
                }
            } else {
                // Stop camera if running
                try { await scanner.stop(); } catch {}
            }
            const result = await scanner.scanFile(file, true);
            processQR(result);
        } catch (err) {
            setError('Could not read QR code from image. Please try a clearer image.');
            console.error('File scan error:', err);
        }
        // Reset file input
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const switchMode = (newMode) => {
        if (newMode === mode) return;
        setError('');
        if (scannerRef.current) {
            scannerRef.current.stop().catch(() => {});
            scannerRef.current = null;
        }
        setMode(newMode);
    };

    const handleClose = () => {
        setOpen(false);
        setScannedData(null);
        setError('');
        setMode('camera');
    };

    const handleConfirm = () => {
        if (scannedData && onScanSuccess) {
            onScanSuccess(scannedData);
        }
        handleClose();
    };

    return (
        <>
            <button
                onClick={() => setOpen(true)}
                className="px-4 py-2 text-xs font-semibold bg-violet-500/10 text-violet-700 rounded-xl hover:bg-violet-500/20 transition cursor-pointer flex items-center gap-2"
            >
                <ScanLine size={14} /> Scan Patient QR
            </button>

            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm"
                        onClick={handleClose}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                            onClick={e => e.stopPropagation()}
                            className="bg-white rounded-2xl shadow-2xl w-[420px] overflow-hidden"
                        >
                            {/* Header */}
                            <div className="flex items-center justify-between px-6 py-4"
                                style={{ background: 'linear-gradient(135deg, #7c3aed, #8b5cf6)' }}>
                                <div className="flex items-center gap-2">
                                    <ScanLine size={18} className="text-white" />
                                    <span className="text-sm font-bold text-white">Scan Patient QR Code</span>
                                </div>
                                <button onClick={handleClose} className="text-white/70 hover:text-white cursor-pointer">
                                    <X size={18} />
                                </button>
                            </div>

                            {/* Mode Tabs */}
                            {!scannedData && (
                                <div className="flex border-b border-gray-100">
                                    <button
                                        onClick={() => switchMode('camera')}
                                        className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-semibold transition cursor-pointer ${
                                            mode === 'camera'
                                                ? 'text-violet-700 border-b-2 border-violet-500 bg-violet-50/50'
                                                : 'text-gray-400 hover:text-gray-600'
                                        }`}
                                    >
                                        <Camera size={14} /> Camera Scan
                                    </button>
                                    <button
                                        onClick={() => switchMode('upload')}
                                        className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-semibold transition cursor-pointer ${
                                            mode === 'upload'
                                                ? 'text-violet-700 border-b-2 border-violet-500 bg-violet-50/50'
                                                : 'text-gray-400 hover:text-gray-600'
                                        }`}
                                    >
                                        <Upload size={14} /> Upload Image
                                    </button>
                                </div>
                            )}

                            {/* Scanner / Upload / Result */}
                            <div className="p-6">
                                {!scannedData ? (
                                    <>
                                        {mode === 'camera' ? (
                                            <>
                                                <div
                                                    id={readerIdRef.current}
                                                    className="w-full rounded-xl overflow-hidden border-2 border-violet-100"
                                                    style={{ minHeight: 280 }}
                                                />
                                                <p className="text-[11px] text-gray-400 text-center mt-3">
                                                    Point the camera at the patient's QR code
                                                </p>
                                            </>
                                        ) : (
                                            <div className="flex flex-col items-center">
                                                <input
                                                    ref={fileInputRef}
                                                    type="file"
                                                    accept="image/*"
                                                    onChange={handleFileUpload}
                                                    className="hidden"
                                                    id="qr-file-input"
                                                />
                                                <label
                                                    htmlFor="qr-file-input"
                                                    className="w-full flex flex-col items-center justify-center py-16 border-2 border-dashed border-violet-200 rounded-xl bg-violet-50/30 hover:bg-violet-50 transition cursor-pointer"
                                                >
                                                    <div className="w-14 h-14 rounded-2xl bg-violet-100 flex items-center justify-center mb-4">
                                                        <ImageIcon size={24} className="text-violet-500" />
                                                    </div>
                                                    <p className="text-sm font-semibold text-gray-700">
                                                        Click to upload QR image
                                                    </p>
                                                    <p className="text-[11px] text-gray-400 mt-1">
                                                        PNG, JPG, or screenshot of patient QR code
                                                    </p>
                                                </label>
                                                {/* Hidden div for scanner instance when in upload mode */}
                                                <div id={readerIdRef.current} style={{ display: 'none' }} />
                                            </div>
                                        )}

                                        {error && (
                                            <div className="flex items-center gap-2 mt-3 px-3 py-2 bg-red-50 rounded-lg">
                                                <AlertCircle size={14} className="text-red-500 flex-shrink-0" />
                                                <span className="text-xs text-red-600">{error}</span>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                                        <div className="flex items-center gap-2 mb-4">
                                            <CheckCircle size={20} className="text-emerald-500" />
                                            <span className="text-sm font-bold text-emerald-700">Patient Identified</span>
                                        </div>

                                        <div className="space-y-3 bg-gray-50 rounded-xl p-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center">
                                                    <User size={18} className="text-violet-600" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-gray-800">{scannedData.name}</p>
                                                    <p className="text-xs text-gray-500">{scannedData.id ? `ID: ${scannedData.id}` : 'Patient'}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 text-xs text-gray-600">
                                                <Mail size={12} className="text-gray-400" />
                                                {scannedData.email}
                                            </div>
                                            {scannedData.department && (
                                                <div className="flex items-center gap-2 text-xs text-gray-600">
                                                    <Building2 size={12} className="text-gray-400" />
                                                    {scannedData.department}
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex gap-2 mt-5">
                                            <button onClick={handleClose}
                                                className="flex-1 py-2.5 text-xs font-semibold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition cursor-pointer">
                                                Cancel
                                            </button>
                                            <button onClick={handleConfirm}
                                                className="flex-1 py-2.5 text-xs font-bold text-white rounded-xl transition cursor-pointer"
                                                style={{ background: 'linear-gradient(135deg, #0f766e, #14b8a6)' }}>
                                                View Patient
                                            </button>
                                        </div>
                                    </motion.div>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
