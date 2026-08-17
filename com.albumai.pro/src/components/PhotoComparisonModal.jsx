import React from "react";
import PhotoImage from "./PhotoImage";

function QualityBar({ label, value, color = "#2680eb" }) {
    const num = typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
    const percent = Math.round(num * 100);

    return (
        <div className="comparison-metric-row">
            <span className="comparison-metric-label">{label}</span>
            <div className="comparison-bar-container">
                <div
                    className="comparison-bar-fill"
                    style={{ width: `${percent}%`, backgroundColor: color }}
                />
            </div>
            <span className="comparison-metric-value">{percent}%</span>
        </div>
    );
}

function PhotoCard({ photo, onKeep, label }) {
    if (!photo) return null;

    const rankScore = photo.aiAnalysis?.aggregate?.rankScore ?? photo.qualityScore ?? null;
    const signals = photo.aiAnalysis?.signals || [];
    const sharpness = signals.find(s => s.signalId === "sharpness_v1")?.score ?? null;
    const exposure = signals.find(s => s.signalId === "exposure_v1")?.score ?? null;
    const contrast = signals.find(s => s.signalId === "contrast_v1")?.score ?? null;

    const rankPercent = rankScore !== null ? Math.round(rankScore * 100) : null;

    return (
        <div className="comparison-column">
            <div className="comparison-badge-header">
                <span className="comparison-side-label">{label}</span>
                {rankPercent !== null && (
                    <span className="comparison-rank-badge">
                        Quality: {rankPercent}%
                    </span>
                )}
            </div>

            <div className="comparison-image-box">
                <PhotoImage photo={photo} size={280} />
            </div>

            <div className="comparison-info">
                <div className="comparison-photo-name" title={photo.name}>
                    {photo.name}
                </div>
                <div className="comparison-photo-meta">
                    {photo.width && photo.height ? `${photo.width} × ${photo.height}` : ""}
                </div>

                <div className="comparison-metrics-box">
                    <QualityBar label="Sharpness" value={sharpness} color="#27ae60" />
                    <QualityBar label="Exposure" value={exposure} color="#f39c12" />
                    <QualityBar label="Contrast" value={contrast} color="#8e44ad" />
                </div>

                <button
                    className="comparison-keep-btn"
                    onClick={() => onKeep(photo.id)}
                >
                    ✓ Keep This Photo
                </button>
            </div>
        </div>
    );
}

export default function PhotoComparisonModal({
    photoA,
    photoB,
    onClose,
    onPickKeep
}) {
    if (!photoA || !photoB) return null;

    return (
        <div className="comparison-overlay" onClick={onClose}>
            <div className="comparison-modal" onClick={e => e.stopPropagation()}>
                <div className="comparison-header">
                    <h3>Side-by-Side Comparison</h3>
                    <button className="comparison-close-btn" onClick={onClose}>✕</button>
                </div>

                <div className="comparison-grid">
                    <PhotoCard
                        photo={photoA}
                        label="Photo 1"
                        onKeep={(id) => onPickKeep(id, photoB.id)}
                    />
                    <div className="comparison-divider" />
                    <PhotoCard
                        photo={photoB}
                        label="Photo 2"
                        onKeep={(id) => onPickKeep(id, photoA.id)}
                    />
                </div>

                <div className="comparison-footer">
                    <button className="comparison-secondary-btn" onClick={() => onPickKeep(photoA.id, null)}>
                        Keep Both
                    </button>
                    <button className="comparison-secondary-btn" onClick={onClose}>
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
