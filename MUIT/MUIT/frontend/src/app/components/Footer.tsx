import React from 'react';
import styles from './Footer.module.css';

export default function Footer() {
    return (
        <footer className={styles.footer}>
            <div className={styles.container}>
                <div className={styles.topSection}>
                    <div className={styles.brandCol}>
                        <div className={styles.logo}>
                            <span className={styles.logoIcon}>☤</span>
                            <span className={styles.logoText}>MediScribe</span>
                        </div>
                        <p className={styles.brandDesc}>
                            The Gold Standard in AI Clinical Documentation. Built for the speed of Indian OPDs. Engineered for ABDM integration and HIPAA-grade security.
                        </p>
                    </div>

                    <div className={styles.linksCol}>
                        <h4 className={styles.colTitle}>Solutions</h4>
                        <a href="#" className={styles.link}>AI Scribe for Clinics</a>
                        <a href="#" className={styles.link}>Hospital Enterprise EMR</a>
                        <a href="#" className={styles.link}>Hinglish Voice-to-EMR</a>
                        <a href="#" className={styles.link}>Patient Summary Generator</a>
                        <a href="#" className={styles.link}>Clinical Safety Engine</a>
                    </div>

                    <div className={styles.linksCol}>
                        <h4 className={styles.colTitle}>Company</h4>
                        <a href="#" className={styles.link}>Our Mission</a>
                        <a href="#" className={styles.link}>Doctor Ambassador Program</a>
                        <a href="#" className={styles.link}>Medical Blog</a>
                        <a href="#" className={styles.link}>Developer API</a>
                        <a href="#" className={styles.link}>Contact Support</a>
                    </div>

                    <div className={styles.linksCol}>
                        <h4 className={styles.colTitle}>Trust & Compliance</h4>
                        <a href="#" className={styles.link}>ABDM Certified M1, M2, M3</a>
                        <a href="#" className={styles.link}>Data Privacy (DPDP Act 2023)</a>
                        <a href="#" className={styles.link}>HIPAA & SOC2 Compliance</a>
                        <a href="#" className={styles.link}>Terms of Service</a>
                        <a href="#" className={styles.link}>Privacy Policy</a>
                    </div>
                </div>

                <div className={styles.bottomSection}>
                    <div className={styles.locationBlock}>
                        <span className={styles.pinIcon}>📍</span>
                        <p className={styles.locationText}>
                            <strong>Serving the Indian Medical Fraternity</strong><br />
                            Headquartered in Noida, India. Supporting doctors in Mumbai, Delhi, Bangalore, and Tier 2/3 cities.
                        </p>
                    </div>
                    <p className={styles.copyright}>© {new Date().getFullYear()} MediScribe Technologies Pvt. Ltd. All rights reserved.</p>
                </div>
            </div>
        </footer>
    );
}
