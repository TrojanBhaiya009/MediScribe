'use client';
import React, { useEffect, useState, useRef } from 'react';
import styles from './MediScribeFlow.module.css';

const TRANSCRIPTION_MOCK = [
    "Patient says...",
    "Patient ko fever hai, 102 degree...",
    "...with severe body ache for 3 days.",
    "Doctor: Any other symptoms?",
    "Patient: No, just the fever and pain."
];

export default function MediScribeFlow() {
    const [transcriptions, setTranscriptions] = useState<string[]>([]);
    const [emrPopulating, setEmrPopulating] = useState(false);
    const feedRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        let currentIndex = 0;
        const interval = setInterval(() => {
            if (currentIndex < TRANSCRIPTION_MOCK.length) {
                setTranscriptions(prev => [...prev, TRANSCRIPTION_MOCK[currentIndex]]);
                currentIndex++;
            } else {
                clearInterval(interval);
                setTimeout(() => setEmrPopulating(true), 1000);
            }
        }, 2500);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (feedRef.current) {
            feedRef.current.scrollTop = feedRef.current.scrollHeight;
        }
    }, [transcriptions]);

    return (
        <div className={styles.flowContainer}>
            <header className={styles.header}>
                <div className={styles.logo}>
                    <span className={styles.logoIcon}>☤</span>
                    <h1 className={styles.logoText}>MediScribe</h1>
                </div>
                <div className={styles.userProfile}>
                    <div className={styles.avatar}>D</div> Dr. Sharma ▾
                </div>
            </header>

            <div className={styles.mainContent}>

                {/* Top Section: Real-Time Transcribe */}
                <section className={styles.sectionCard}>
                    <div className={styles.sectionHeader}>
                        <div className={styles.sectionTitleGroup}>
                            <span className={styles.iconAudio}>🎤</span>
                            <h2>Real-Time Transcribe</h2>
                        </div>
                        <div className={styles.liveIndicator}>
                            <span className={styles.liveDot}></span> LIVE
                        </div>
                    </div>

                    <div className={styles.waveformContainer}>
                        {/* Generate random height pulsing bars */}
                        {[...Array(50)].map((_, i) => (
                            <div
                                key={i}
                                className={styles.waveformBar}
                                style={{
                                    height: `${Math.random() * 40 + 10}px`,
                                    animationDelay: `${Math.random() * 0.8}s`
                                }}
                            ></div>
                        ))}
                    </div>

                    <div className={styles.transcriptionFeed} ref={feedRef}>
                        {transcriptions.map((text, i) => (
                            <p key={i} className={styles.transcriptionText}>{text}</p>
                        ))}
                        {!emrPopulating && <p className={`${styles.transcriptionText} ${styles.listeningText}`}>Listening...</p>}
                    </div>
                </section>

                {/* Middle Section: Auto-EMR */}
                <section className={styles.sectionCard + ' ' + styles.emrSection}>
                    <h2 className={styles.hiddenTitle}>Auto-EMR</h2>

                    <div className={styles.emrCard3D}>
                        <div className={styles.emrHeader}>
                            <span className={styles.emrTitle}>Clinical EMR Note</span>
                            <span className={styles.emrStatus}>{emrPopulating ? "Updated" : "Drafting..."}</span>
                        </div>

                        <div className={styles.emrBody}>
                            <div className={styles.emrRow}>
                                <span className={styles.emrLabel}>History of Present Illness</span>
                                <div className={styles.emrField}>
                                    <p className={emrPopulating ? styles.glowingText : styles.placeholderText}>
                                        {emrPopulating ? "Fever (102°), Body Ache (3 days)" : "Extracting clinical entities..."}
                                    </p>
                                </div>
                            </div>

                            {/* Allergy Warning */}
                            <div className={styles.allergyWarningCard}>
                                <div className={styles.allergyHeader}>
                                    <span className={styles.warningIcon}>⚠️</span>
                                    <strong>Allergy Flag: Penicillin conflict</strong>
                                </div>
                                <p className={styles.allergyDetails}>Patient history indicates severe rash with Amoxicillin.</p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Bottom Section: Dual Output */}
                <section className={styles.dualOutputSection}>
                    {/* Output 1: Technical EMR */}
                    <div className={styles.outputCard3D}>
                        <div className={styles.outputBadge}>✓ ABDM Compliant</div>
                        <h3 className={styles.outputTitle}>Technical EMR</h3>
                        <div className={styles.documentLines}>
                            <div className={styles.docLine}></div>
                            <div className={styles.docLine}></div>
                            <div className={styles.docLineShort}></div>
                        </div>
                    </div>

                    {/* Output 2: Patient Summary */}
                    <div className={styles.outputCard3D + ' ' + styles.patientSummaryCard}>
                        <h3 className={styles.outputTitle}>Patient Summary</h3>
                        <div className={styles.documentLines}>
                            <div className={styles.docLine}></div>
                            <div className={styles.docLine}></div>
                            <div className={styles.docLineShort}></div>
                        </div>
                        <button className={styles.translateActionBtn}>
                            <span className={styles.translateIcon}>अ</span>
                            Translate to Hindi (हिंदी में अनुवाद करें)
                        </button>
                    </div>
                </section>

            </div>
        </div>
    );
}
