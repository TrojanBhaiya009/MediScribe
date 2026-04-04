'use client';
import React from 'react';
import { motion } from 'framer-motion';
import styles from './Features.module.css';

const FEATURES = [
    {
        num: '01',
        title: 'Reception & Intake',
        description: 'Patient walks in. Enter mobile, verify OTP, register with ABHA ID. Auto-load history for returning patients. Assign to doctor and add to today\'s queue — the journey starts here.'
    },
    {
        num: '02',
        title: 'Doctor Consultation & 3-Agent Pipeline',
        description: 'Live Hinglish transcription via browser mic. When consultation ends, the pipeline fires — Agent 1 extracts structured EMR with confidence tags, Agent 2 runs drug interaction & allergy safety checks. Doctor reviews, confirms yellow-tagged inferences, clicks Approve.'
    },
    {
        num: '03',
        title: 'Pharmacy Dispatch & Hindi Summary',
        description: 'Approved prescription auto-appears in Pharmacy Queue. Agent 3 generates a patient-facing Hindi summary. Pharmacist dispenses, marks complete. Inventory alerts fire for out-of-stock drugs with auto-suggested substitutes.'
    },
    {
        num: '04',
        title: 'ABHA Sync & Compliance',
        description: 'Once case is closed, the full consultation record syncs to the patient\'s ABHA-linked profile via ABDM. Next visit — anywhere on the platform — their complete history is already there. Commit-on-approval means nothing is persisted until the doctor signs off.'
    }
];

export default function Features() {
    return (
        <section className={styles.featuresSection} id="features">
            <div className={styles.container}>
                <div className={styles.stickyColumn}>
                    <motion.div
                        className={styles.header}
                        initial={{ opacity: 0, x: -30 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true, margin: "-100px" }}
                        transition={{ duration: 0.8 }}
                    >
                        <div className={styles.tag}>End-to-End Clinical CRM</div>
                        <h2 className={styles.title}>Reception → Doctor → Pharmacy → ABHA</h2>
                        <p className={styles.subtitle}>
                            Four portals, one unified workflow. Every step from patient intake to national health record sync — handled by MediScribe.
                        </p>
                    </motion.div>
                </div>

                <div className={styles.scrollColumn}>
                    {FEATURES.map((feature, idx) => (
                        <motion.div
                            key={idx}
                            className={styles.featureCard}
                            initial={{ opacity: 0, y: 50 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: false, margin: "-20%" }}
                            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                        >
                            <span className={styles.stepNum}>{feature.num}</span>
                            <div className={styles.cardContent}>
                                <h3 className={styles.cardTitle}>{feature.title}</h3>
                                <p className={styles.cardDescription}>{feature.description}</p>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}
