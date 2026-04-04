'use client';
import React from 'react';
import { motion } from 'framer-motion';
import styles from './DashboardShowcase.module.css';
import DashboardLayout from '../dashboard/DashboardLayout';
import ScribePage from '../dashboard/scribe/page';

export default function DashboardShowcase() {
    return (
        <section className={styles.showcaseSection} id="how-it-works">
            <div className={styles.container}>
                <motion.div
                    className={styles.header}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-100px" }}
                    transition={{ duration: 0.6 }}
                >
                    <div className={styles.tag}>Workflow Integration Hook</div>
                    <h2 className={styles.title}>Where High-Tech Meets the Hospital Room</h2>
                    <p className={styles.subtitle}>
                        Explore the intuitive MediScribe workspace. We have eliminated the clutter so you can focus on the patient, while our AI handles the structured documentation in the background.
                    </p>
                </motion.div>

                <motion.div
                    className={styles.browserWindow}
                    initial={{ opacity: 0, y: 40 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-50px" }}
                    transition={{ duration: 0.8, delay: 0.2 }}
                >
                    <div className={styles.browserTopBar}>
                        <div className={styles.dots}>
                            <span className={styles.dotClose}></span>
                            <span className={styles.dotMin}></span>
                            <span className={styles.dotMax}></span>
                        </div>
                        <div className={styles.urlBar}>mediscribe.app/dashboard</div>
                    </div>

                    <div className={styles.browserContent}>
                        {/* Full-screen Doctor Dashboard */}
                        <div className={styles.scaledWrapper} style={{ width: '100%', height: '100%' }}>
                            <DashboardLayout isPreview={true} previewRole="doctor">
                                <ScribePage />
                            </DashboardLayout>
                        </div>

                        {/* Floating Label */}
                        <div className={styles.panelGlassOverlay} style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 50 }}>
                            <div className={styles.panelLabel}>Doctor Live Scribe Demo</div>
                        </div>

                        {/* Small Floating Compliance Badges at corners */}
                        <div className={styles.glowingKeyword} style={{ position: 'absolute', top: '60px', left: '20px', animationDelay: '0s', zIndex: 60 }}>⭐ ABDM Compliant</div>
                        <div className={styles.glowingKeyword} style={{ position: 'absolute', top: '60px', right: '20px', animationDelay: '0.5s', zIndex: 60 }}>🔒 HIPAA Ready</div>
                        <div className={styles.glowingKeyword} style={{ position: 'absolute', bottom: '20px', left: '20px', animationDelay: '1s', zIndex: 60 }}>🗣️ Hinglish AI</div>
                        <div className={styles.glowingKeyword} style={{ position: 'absolute', bottom: '20px', right: '20px', animationDelay: '1.5s', zIndex: 60 }}>📑 ICD-10 Coding</div>
                    </div>
                </motion.div>
            </div>
        </section>
    );
}
