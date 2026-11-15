import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import {
  Camera,
  CameraOff,
  X,
  Volume2,
  VolumeX,
  AlertTriangle,
  CheckCircle,
  FlipHorizontal,
  Barcode,
  Search,
  Sparkles
} from 'lucide-react';

export const BarcodeScannerModal = ({
  isOpen,
  onClose,
  onBarcodeDetected,
  lastScanStatus // { type: 'success' | 'error', message: string, code: string }
}) => {
  const [scannerState, setScannerState] = useState('IDLE'); // 'INITIALIZING' | 'STREAMING' | 'PERMISSION_DENIED' | 'NO_CAMERA' | 'ERROR'
  const [errorMessage, setErrorMessage] = useState('');
  const [cameras, setCameras] = useState([]);
  const [selectedCameraId, setSelectedCameraId] = useState(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [manualCode, setManualCode] = useState('');
  const [cooldown, setCooldown] = useState(false);

  const html5QrCodeRef = useRef(null);
  const scannerContainerId = "html5-qr-reader-container";

  // Play synthetic scanner audio beep using Web Audio API
  const playBeep = () => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1760, audioCtx.currentTime); // High pitch supermarket scan beep (A6)
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.12);
    } catch (e) {
      // AudioContext unavailable or blocked by autoplay policy
    }
  };

  // Start Camera
  const startCamera = async (cameraIdToUse = null) => {
    setScannerState('INITIALIZING');
    setErrorMessage('');

    try {
      // First ensure camera permission & list video devices
      const devices = await Html5Qrcode.getCameras();
      if (!devices || devices.length === 0) {
        setScannerState('NO_CAMERA');
        setErrorMessage('No camera device detected on this system. You can use manual entry or laser simulation below.');
        return;
      }

      setCameras(devices);
      // Prefer back/environment facing camera
      const targetCam = cameraIdToUse || devices[devices.length - 1].id;
      setSelectedCameraId(targetCam);

      // Create scanner instance if not created
      if (!html5QrCodeRef.current) {
        html5QrCodeRef.current = new Html5Qrcode(scannerContainerId, {
          formatsToSupport: [
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.QR_CODE
          ],
          verbose: false
        });
      }

      const config = {
        fps: 15,
        qrbox: { width: 280, height: 180 },
        aspectRatio: 1.333333
      };

      await html5QrCodeRef.current.start(
        targetCam,
        config,
        (decodedText, decodedResult) => {
          handleSuccessfulDecode(decodedText);
        },
        (errorMessage) => {
          // Frame-by-frame scanning non-detection (normal, ignore)
        }
      );

      setScannerState('STREAMING');
    } catch (err) {
      console.error("Camera scanner startup failed:", err);
      const str = String(err).toLowerCase();
      if (str.includes("notallowederror") || str.includes("permission")) {
        setScannerState('PERMISSION_DENIED');
        setErrorMessage('Camera access was denied. Please allow camera permissions in your browser address bar.');
      } else if (str.includes("notfounderror") || str.includes("device not found")) {
        setScannerState('NO_CAMERA');
        setErrorMessage('No camera device found on this system.');
      } else {
        setScannerState('ERROR');
        setErrorMessage(err.message || 'Unable to start camera scanner.');
      }
    }
  };

  // Stop Camera cleanly
  const stopCamera = async () => {
    if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
      try {
        await html5QrCodeRef.current.stop();
      } catch (err) {
        console.warn("Camera stop error:", err);
      }
    }
  };

  // Handle successful code decode
  const handleSuccessfulDecode = (code) => {
    if (cooldown) return;
    setCooldown(true);
    playBeep();
    if (onBarcodeDetected) {
      onBarcodeDetected(code);
    }
    // 1.5 second cooldown between scans to prevent rapid duplicate firing
    setTimeout(() => {
      setCooldown(false);
    }, 1500);
  };

  // Switch camera if multiple available
  const handleFlipCamera = async () => {
    if (cameras.length <= 1) return;
    await stopCamera();
    const currentIndex = cameras.findIndex((c) => c.id === selectedCameraId);
    const nextIndex = (currentIndex + 1) % cameras.length;
    const nextCamera = cameras[nextIndex];
    setSelectedCameraId(nextCamera.id);
    await startCamera(nextCamera.id);
  };

  // Lifecycle
  useEffect(() => {
    if (isOpen) {
      // Small timeout to allow DOM container to mount
      const timer = setTimeout(() => {
        startCamera();
      }, 100);
      return () => clearTimeout(timer);
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
              <Camera className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>Real-Time Barcode & QR Camera Scanner</span>
                {scannerState === 'STREAMING' && (
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                )}
              </h3>
              <p className="text-[11px] text-slate-400">Position 1D supermarket barcode or 2D QR in viewfinder</p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {cameras.length > 1 && (
              <button
                onClick={handleFlipCamera}
                className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                title="Switch Camera"
              >
                <FlipHorizontal className="w-4 h-4" />
              </button>
            )}

            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              title={soundEnabled ? "Mute Beep" : "Enable Beep"}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4" />}
            </button>

            <button
              onClick={() => {
                stopCamera();
                onClose();
              }}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Viewfinder Body */}
        <div className="relative bg-black flex flex-col items-center justify-center min-h-[300px]">
          {/* HTML5 QR Code Container */}
          <div
            id={scannerContainerId}
            className={`w-full overflow-hidden ${scannerState !== 'STREAMING' ? 'hidden' : 'block'}`}
          />

          {/* Overlay Targeting Reticle */}
          {scannerState === 'STREAMING' && (
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
              <div className={`w-72 h-44 border-2 rounded-2xl relative transition-all duration-300 ${
                cooldown ? 'border-emerald-400 bg-emerald-500/10 scale-105' : 'border-emerald-400/70 border-dashed'
              }`}>
                {/* Crosshair corners */}
                <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-emerald-400" />
                <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-emerald-400" />
                <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-emerald-400" />
                <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-emerald-400" />
                
                {/* Laser scan animation line */}
                <div className="absolute left-2 right-2 h-0.5 bg-emerald-400/80 shadow-[0_0_8px_#34d399] top-1/2 -translate-y-1/2 animate-pulse" />
              </div>
              <p className="text-[11px] font-semibold text-emerald-300 bg-slate-950/80 px-3 py-1 rounded-full mt-3 shadow">
                {cooldown ? 'Barcode Captured!' : 'Align barcode horizontally'}
              </p>
            </div>
          )}

          {/* State: Initializing */}
          {scannerState === 'INITIALIZING' && (
            <div className="py-16 text-center space-y-3">
              <div className="w-10 h-10 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-slate-300 font-medium">Requesting camera access & initializing optical engine...</p>
            </div>
          )}

          {/* State: Permission Denied or No Camera */}
          {(scannerState === 'PERMISSION_DENIED' || scannerState === 'NO_CAMERA' || scannerState === 'ERROR') && (
            <div className="py-12 px-6 text-center space-y-4 max-w-sm">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center mx-auto text-amber-400">
                <CameraOff className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-white">Camera Unavailable</h4>
                <p className="text-xs text-slate-400 leading-relaxed">{errorMessage}</p>
              </div>

              {scannerState === 'PERMISSION_DENIED' && (
                <button
                  onClick={() => startCamera(selectedCameraId)}
                  className="btn-primary text-xs py-2 px-4 inline-flex items-center gap-1.5"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Retry Camera Permission</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Live Feedback Banner */}
        {lastScanStatus && (
          <div className={`p-3 text-xs flex items-center justify-between border-t ${
            lastScanStatus.type === 'success'
              ? 'bg-emerald-950/70 border-emerald-800/80 text-emerald-200'
              : 'bg-rose-950/70 border-rose-800/80 text-rose-200'
          }`}>
            <div className="flex items-center gap-2">
              {lastScanStatus.type === 'success' ? (
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span className="font-medium">{lastScanStatus.message}</span>
            </div>
            {lastScanStatus.code && (
              <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-black/40 text-slate-300">
                {lastScanStatus.code}
              </span>
            )}
          </div>
        )}

        {/* Manual Barcode Fallback Input & Simulation Section */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 space-y-3">
          <div>
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
              Manual Barcode Fallback / Handheld Scanner Wedge
            </label>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (manualCode.trim()) {
                  handleSuccessfulDecode(manualCode.trim());
                  setManualCode('');
                }
              }}
              className="flex gap-2"
            >
              <div className="relative flex-1">
                <input
                  type="text"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  placeholder="Enter barcode number (e.g. 8901030382718)..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>
              <button
                type="submit"
                disabled={!manualCode.trim()}
                className="btn-primary text-xs px-4 py-2 disabled:opacity-40"
              >
                Scan Code
              </button>
            </form>
          </div>

          {/* Quick-Test Barcode Simulator Chips */}
          <div className="space-y-1.5 pt-1 border-t border-slate-800/70">
            <span className="text-[10px] text-slate-500 uppercase font-semibold">
              Live Test Barcode Chips (Seeded in PostgreSQL):
            </span>
            <div className="flex flex-wrap gap-1.5">
              {[
                { name: "Amul Milk 1L", code: "8901030382718", price: 72 },
                { name: "Sunflower Oil 1L", code: "8901233024823", price: 165 },
                { name: "Good Day 200g", code: "8901063012015", price: 50 },
                { name: "Maggi Noodles", code: "8901491101837", price: 14 },
                { name: "Cadbury Silk", code: "8901725181222", price: 85 },
                { name: "Invalid Barcode", code: "999900001111", price: 0, isInvalid: true }
              ].map((chip) => (
                <button
                  key={chip.code}
                  type="button"
                  onClick={() => handleSuccessfulDecode(chip.code)}
                  className={`text-[11px] px-2.5 py-1 rounded-lg border transition-all flex items-center gap-1.5 ${
                    chip.isInvalid
                      ? 'bg-rose-950/40 text-rose-300 border-rose-800/60 hover:bg-rose-900/40'
                      : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-emerald-950/40 hover:text-emerald-300 hover:border-emerald-700/60'
                  }`}
                >
                  <Barcode className="w-3 h-3 opacity-70" />
                  <span>{chip.name}</span>
                  {!chip.isInvalid && <span className="font-bold text-emerald-400">₹{chip.price}</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
