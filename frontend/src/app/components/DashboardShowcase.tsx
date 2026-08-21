'use client';

import React from 'react';
import styles from './DashboardShowcase.module.css';

const PANELS = [
  {
    title: 'Live Transcription',
    desc: 'Real-time Hinglish speech-to-text via browser mic. No audio leaves the device until you approve.',
    icon: '🎙️',
  },
  {
    title: '3-Agent Pipeline',
    desc: 'Extractor structures the EMR, Safety Checker flags interactions, Summarizer writes patient-friendly Hindi.',
    icon: '⚙️',
  },
  {
    title: 'Doctor Review UI',
    desc: 'Side-by-side transcript and generated EMR. Yellow tags = needs confirmation. One click approves.',
    icon: '🩺',
  },
  {
    title: 'Pharmacy Queue',
    desc: 'Approved prescriptions appear instantly. Inventory auto-decrements. Out-of-stock triggers substitute suggestions.',
    icon: '💊',
  },
];

export default function DashboardShowcase() {
  return (
    <section className={styles.showcaseSection} id="how-it-works">
      <div className={styles.container}>
        <div className={styles.header}>
          <div className={styles.tag}>Workflow Integration Hook</div>
          <h2 className={styles.title}>Where High-Tech Meets the Hospital Room</h2>
          <p className={styles.subtitle}>
            Explore the intuitive MediScribe workspace. We have eliminated the clutter so you can focus on the patient, while our AI handles the structured documentation in the background.
          </p>
        </div>

        <div className={styles.browserWindow}>
          <div className={styles.browserTopBar}>
            <div className={styles.dots}>
              <span className={styles.dotClose}></span>
              <span className={styles.dotMin}></span>
              <span className={styles.dotMax}></span>
            </div>
            <div className={styles.urlBar}>mediscribe.app/dashboard</div>
          </div>

          <div className={styles.browserContent}>
            <div className={styles.previewGrid}>
              {PANELS.map((panel, idx) => (
                <div key={idx} className={styles.previewCard}>
                  <span className={styles.previewIcon} aria-hidden="true">{panel.icon}</span>
                  <h3 className={styles.previewTitle}>{panel.title}</h3>
                  <p className={styles.previewDesc}>{panel.desc}</p>
                </div>
              ))}
            </div>

            <div className={styles.complianceBar}>
              <span className={styles.complianceItem}>✦ ABDM Compliant</span>
              <span className={styles.complianceItem}>✦ HIPAA Ready</span>
              <span className={styles.complianceItem}>✦ Hinglish AI</span>
              <span className={styles.complianceItem}>✦ ICD-10 Coding</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}