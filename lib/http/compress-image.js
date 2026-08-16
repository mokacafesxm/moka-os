'use strict';

// Compression côté client (canvas, max 800px, JPEG 0.7, fallback Safari) —
// extrait de FactureScanModal.jsx (2026-08-16) pour être partagé avec
// LivraisonsAujourdhuiCard (flux de scan automatique post-réception).
function compressImage(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        try {
          const MAX = 800;
          let w = img.width, h = img.height;
          if (w > MAX || h > MAX) {
            if (w > h) { h = Math.round((h * MAX) / w); w = MAX; }
            else { w = Math.round((w * MAX) / h); h = MAX; }
          }
          const canvas = document.createElement("canvas");
          canvas.width = w || 800;
          canvas.height = h || 600;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
          if (dataUrl && dataUrl.length > 100) resolve(dataUrl.split(",")[1]);
          else resolve(e.target.result.split(",")[1]);
        } catch {
          resolve(e.target.result.split(",")[1]);
        }
      };
      img.onerror = () => resolve(e.target.result.split(",")[1]);
      img.src = e.target.result;
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

module.exports = { compressImage };
