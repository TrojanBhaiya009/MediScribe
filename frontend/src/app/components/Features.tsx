'use client';

import React from 'react';
import styles from './Features.module.css';

const FEATURES = [
  {
    title: 'Reception & Intake',
    description: 'Patient walks in. Enter mobile, verify OTP, register with ABHA ID. Auto-load history for returning patients. Assign to doctor and add to today\'s queue — the journey starts here.',
    icon: '📝',
  },
  {
    title: 'Doctor Consultation & 3-Agent Pipeline',
    description: 'Live Hinglish transcription via browser mic. When consultation ends, the pipeline fires — Agent 1 extracts structured EMR with confidence tags, Agent 2 runs drug interaction & allergy safety checks. Doctor reviews, confirms yellow-tagged inferences, clicks Approve.',
    icon: '🩺',
  },
  {
    title: 'Pharmacy Dispatch & Hindi Summary',
    description: 'Approved prescription auto-appears in Pharmacy Queue. Agent 3 generates a patient-facing Hindi summary. Pharmacist dispenses, marks complete. Inventory alerts fire for out-of-stock drugs with auto-suggested substitutes.',
    icon: '💊',
  },
  {
    title: 'ABHA Sync & Compliance',
    description: 'Once case is closed, the full consultation record syncs to the patient\'s ABHA-linked profile via ABDM. Next visit — anywhere on the platform — their complete history is already there. Commit-on-approval means nothing is persisted until the doctor signs off.',
    icon: '📊',
  },
];

export default function Features() {
  return (
    <section className={styles.featuresSection} id="features">
      <div className={styles.container}>
        <div className={styles.header}>
          <div className={styles.tag}>End-to-End Clinical CRM</div>
          <h2 className={styles.title}>Reception → Doctor → Pharmacy → ABHA</h2>
          <p className={styles.subtitle}>
            Four portals, one unified workflow. Every step from patient intake to national health record sync — handled by MediScribe.
          </p>
        </div>

        <div className={styles.grid}>
          {FEATURES.map((feature, idx) => (
            <article key={idx} className={styles.featureCard}>
              <span className={styles.featureIcon} aria-hidden="true">{feature.icon}</span>
              <div className={styles.cardContent}>
                <h3 className={styles.cardTitle}>{feature.title}</h3>
                <p className={styles.cardDescription}>{feature.description}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}