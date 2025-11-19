// src/BarcodeScannerPage.jsx
import React, { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";

const API_BASE = "https://caloreat.onrender.com";

export default function BarcodeScannerPage({}) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const codeReaderRef = useRef(null);
  const [devices, setDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState(null);
  const [detected, setDetected] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [autoLog, setAutoLog] = useState(false);
  const [uid, setUid] = useState(localStorage.getItem("auth_uid") || "demo-user"); // replace with real auth

  useEffect(() => {
    // create reader
    codeReaderRef.current = new BrowserMultiFormatReader();
    return () => {
      if (codeReaderRef.current) {
        try { codeReaderRef.current.reset(); } catch {}
      }
    };
  }, []);

  useEffect(() => {
    // enumerate camera devices
    (async () => {
      try {
        const list = await BrowserMultiFormatReader.listVideoInputDevices();
        setDevices(list || []);
        if (list && list[0]) setSelectedDeviceId(list[0].deviceId);
      } catch (e) {
        // fallback to mediaDevices enumerate
        try {
          const all = await navigator.mediaDevices.enumerateDevices();
          const cams = all.filter(d => d.kind === "videoinput").map(d => ({ deviceId: d.deviceId, label: d.label || "Camera" }));
          setDevices(cams);
          if (cams[0]) setSelectedDeviceId(cams[0].deviceId);
        } catch (err) {
          console.error("camera enumerate failed", err);
        }
      }
    })();
  }, []);

  useEffect(() => {
    if (!selectedDeviceId) return;
    startScanner();
    return stopScanner;
    // eslint-disable-next-line
  }, [selectedDeviceId]);

  async function startScanner() {
    if (!codeReaderRef.current) return;
    try {
      setScanning(true);
      const constraints = { deviceId: { exact: selectedDeviceId } };
      const previewElem = videoRef.current;
      await codeReaderRef.current.decodeFromVideoDevice(selectedDeviceId, previewElem, (result, err) => {
        if (result) {
          const text = result.getText();
          setDetected(text);
          // Optionally stop after detection
          // stopScanner();
        }
        if (err && !(err.name === "NotFoundException" || err.name === "ChecksumException")) {
          // log unexpected errors
          // console.warn(err);
        }
      });
    } catch (e) {
      console.error("startScanner failed", e);
      setScanning(false);
    }
  }

  function stopScanner() {
    try {
      codeReaderRef.current && codeReaderRef.current.reset();
    } catch (e) {}
    setScanning(false);
  }

  async function onUploadFile(ev) {
    const f = ev.target.files?.[0];
    if (!f) return;
    setUploading(true);
    try {
      // naive client-side attempt to read barcode from file using Canvas + ZXing
      const img = document.createElement("img");
      img.src = URL.createObjectURL(f);
      await new Promise((r) => (img.onload = r));
      const c = canvasRef.current;
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const ctx = c.getContext("2d");
      ctx.drawImage(img, 0, 0);
      try {
        const reader = new BrowserMultiFormatReader();
        const luminance = reader.createLuminanceSourceFromCanvas(c); // some versions expose helpers; if not, skip
      } catch (err) {
        // ignore; we'll upload image to server and let server fallback to OCR/barcode service
      }

      // Upload to backend with a temporary barcode equal to filename (you'll want user to enter actual barcode)
      const fd = new FormData();
      fd.append("image", f);
      // call /api/scan-upload with query params
      const barcode = f.name.split(".")[0] || "upload";
      const resp = await fetch(`${API_BASE}/api/scan-upload?uid=${encodeURIComponent(uid)}&barcode=${encodeURIComponent(barcode)}&auto_log=${autoLog ? "true" : "false"}`, {
        method: "POST",
        body: fd
      });
      const js = await resp.json();
      if (js?.product) {
        setDetected(js.product.code || js.product.name || barcode);
      } else if (js?.scan?.barcode) {
        setDetected(js.scan.barcode);
      }
      console.log("upload result", js);
    } catch (e) {
      console.error("upload failed", e);
      alert("Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function onCopyDetected() {
    try {
      await navigator.clipboard.writeText(detected || "");
      alert("Copied");
    } catch (e) {}
  }

  async function lookupProduct() {
    if (!detected) return;
    // For now call backend /api/scan to retrieve product info (backend will try OpenFoodFacts/local)
    try {
      const resp = await fetch(`${API_BASE}/api/scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid, barcode: detected, auto_log: false })
      });
      const js = await resp.json();
      if (js?.product) {
        alert(`Found: ${js.product.product?.name || JSON.stringify(js.product)}`);
        console.log(js);
      } else {
        alert("No product found");
      }
    } catch (e) {
      console.error(e);
      alert("lookup failed");
    }
  }

  async function saveScan(auto = false) {
    if (!detected) return;
    try {
      const resp = await fetch(`${API_BASE}/api/scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid, barcode: detected, auto_log: auto })
      });
      const js = await resp.json();
      if (js?.ok) {
        alert("Saved scan" + (js.logged ? " and logged meal" : ""));
      } else {
        alert("Save failed");
      }
    } catch (e) {
      console.error(e);
      alert("Save failed");
    }
  }

  return (
    <div style={{ padding: 18, maxWidth: 1000, margin: "0 auto" }}>
      <h2>📸 Scan Food</h2>
      <p style={{ color: "#6b7280" }}>Scan barcode or QR on packaged foods. Upload fallback included.</p>

      <div style={{ borderRadius: 12, background: "#fff", padding: 12, boxShadow: "0 8px 28px rgba(0,0,0,0.06)" }}>
        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ position: "relative", borderRadius: 12, overflow: "hidden", background: "#000", height: 220 }}>
              <video ref={videoRef} style={{ width: "100%", height: "100%", objectFit: "cover" }} muted playsInline />
              {/* animated scanning overlay */}
              <div style={{
                position: "absolute", left: 0, right: 0, top: "40%", height: 2,
                background: "linear-gradient(90deg, rgba(255,255,255,0), rgba(255,0,0,0.7), rgba(255,255,255,0))",
                animation: "scanline 1.6s linear infinite"
              }} />
            </div>

            <div style={{ marginTop: 8 }}>
              <label style={{ fontSize: 13, color: "#444" }}>Camera</label>
              <select value={selectedDeviceId || ""} onChange={(e) => setSelectedDeviceId(e.target.value)} style={{ width: "100%", padding: 10, marginTop: 6, borderRadius: 8 }}>
                {devices.length === 0 && <option>Camera</option>}
                {devices.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || "Camera"}</option>)}
              </select>
            </div>

            <div style={{ marginTop: 12 }}>
              <input type="file" accept="image/*" onChange={onUploadFile} />
              <canvas ref={canvasRef} style={{ display: "none" }} />
            </div>
          </div>

          <div style={{ width: 320 }}>
            <div style={{ marginBottom: 10 }}>
              <strong>Detected:</strong>
              <div style={{ marginTop: 8, background: "#f6f6f6", padding: 12, borderRadius: 8 }}>
                {detected ? <div style={{ fontWeight: 700 }}>{detected}</div> : <div style={{ color: "#777" }}>No barcode yet</div>}
                <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                  <button onClick={onCopyDetected} disabled={!detected} style={{ padding: "8px 12px", borderRadius: 8 }}>Copy barcode</button>
                  <button onClick={lookupProduct} disabled={!detected} style={{ padding: "8px 12px", borderRadius: 8 }}>Lookup product</button>
                </div>
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input type="checkbox" checked={autoLog} onChange={(e) => setAutoLog(e.target.checked)} />
                <span>Auto-log meal when saving</span>
              </label>
            </div>

            <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
              <button onClick={() => saveScan(autoLog)} disabled={!detected} style={{ background: "#111", color: "#fff", borderRadius: 8, padding: "10px 14px" }}>Save scan</button>
              <button onClick={() => saveScan(false)} disabled={!detected} style={{ borderRadius: 8, padding: "10px 14px" }}>Save (no log)</button>
            </div>

            <div style={{ marginTop: 12 }}>
              <small style={{ color: "#777" }}>If camera can't read, use the Upload image fallback. Uploaded images are stored on the server (dev) or use Firebase Storage in production.</small>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes scanline {
          0% { transform: translateX(-100%); opacity: 0; }
          30% { opacity: 1 }
          50% { transform: translateX(0%); opacity: 1; }
          100% { transform: translateX(100%); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
