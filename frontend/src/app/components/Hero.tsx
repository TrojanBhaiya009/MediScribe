'use client';

import React from 'react';
import styles from './Hero.module.css';

export default function Hero() {
  return (
    <section className={styles.heroSection}>
      <div className={styles.heroBackground}>
        <div className={styles.bgImageContainer}>
          <img src="/images/doctor-hero-bg.png" alt="Doctor using MediScribe" className={styles.bgImage} />
          <div className={styles.bgImageGradient}></div>
        </div>
        <div className={styles.gridOverlay}></div>
      </div>

      <div className={styles.heroContent}>
        <div className={styles.badge}>
          <span className={styles.badgeIcon} aria-hidden="true">✦</span>
          <span className={styles.badgeText}>India's First AI-Powered Clinical CRM</span>
        </div>

        <h1 className={styles.headline}>
          The Full Clinic. <span className={styles.highlight}>One Platform</span>.
        </h1>

        <p className={styles.subheadline}>
          MediScribe isn&apos;t just a scribe — it&apos;s a clinical CRM that manages the entire patient journey. From receptionist intake to doctor consultation to pharmacy dispatch to ABHA sync, all powered by a 3-agent AI pipeline that understands Hinglish.
        </p>

        <ul className={styles.heroFeatureList}>
          <li>
            <strong>3-Agent Pipeline:</strong> Extractor → Safety Checker → Hindi Summarizer. Not a prompt — a pipeline.
          </li>
          <li>
            <strong>Commit-on-Approval:</strong> Nothing is saved until the doctor signs off. Encrypted cache ensures data integrity.
          </li>
          <li>
            <strong>ABDM Native:</strong> Records push directly to ABHA — full national health stack compliance.
          </li>
        </ul>

        <div className={styles.ctaGroup}>
          <a href="/login" className={styles.primaryCta}>
            Onboard Your Clinic
            <span className={styles.ctaArrow} aria-hidden="true">→</span>
          </a>
          <button className={styles.secondaryCta}>
            Explore the EMR UI
            <span className={styles.playIcon} aria-hidden="true">▶</span>
          </button>
        </div>

        <div className={styles.socialProof}>
          <div className={styles.avatars} aria-hidden="true">
            <div className={styles.avatar}>🧑‍⚕️</div>
            <div className={styles.avatar}>👨‍⚕️</div>
            <div className={styles.avatar}>👩‍⚕️</div>
          </div>
          <p className={styles.proofText}>Built for the 1.3M doctors of India.</p>
        </div>
      </div>
    </section>
  );
}