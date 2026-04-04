'use client';
import React, { useEffect, useState } from 'react';
import styles from './ChaosFeed.module.css';

const MOCK_NOTES = [
    "pt. c/o severe headche x 3 days, ?migraine. Rx PCM 500mg sos",
    "BP 150/90, HR 88, chest clear. Advised lifestyle modifications.",
    "Follow up after 1 week. Lab tests pending: CBC, LFT, KFT.",
    "Fever 102F, chills, rigors. R/O Malaria/Dengue. Send samples.",
    "Patient extremely uncooperative. Refused IV line.",
    "Discharge summary handed over. Medications explained.",
    "Cough ++, sputum yellowish. Doxycycline 100mg BD x 5 days.",
    "Abd pain, periumbilical. USG whole abdomen advised.",
    "Review reports: Hb 9.2, TLC 12000. Start iron supplements.",
    "Referred to cardiology for further evaluation."
];

export default function ChaosFeed() {
    const [timer, setTimer] = useState("03:59");

    useEffect(() => {
        let timeLeft = 3 * 60 + 59; // 3 mins 59 secs
        const interval = setInterval(() => {
            if (timeLeft > 0) {
                timeLeft--;
                const mins = Math.floor(timeLeft / 60).toString().padStart(2, '0');
                const secs = (timeLeft % 60).toString().padStart(2, '0');
                setTimer(`${mins}:${secs}`);
            }
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className={styles.chaosContainer}>
            {/* Absolute overlays */}
            <div className={styles.timerOverlay}>
                {timer}
            </div>

            <div className={styles.alertsContainer}>
                <div className={styles.alertIndicator}>
                    <span className={styles.alertDot}></span> Documentation Drop
                </div>
                <div className={styles.alertIndicator}>
                    <span className={styles.alertDot}></span> 5.6 Lakh Medication Errors/Year
                </div>
            </div>

            {/* Auto-scrolling feed */}
            <div className={styles.scrollingFeed}>
                {/* Duplicate the list to create a seamless infinite scroll loop */}
                {[...Array(3)].map((_, i) => (
                    <div key={i} className={styles.feedBlock}>
                        {MOCK_NOTES.map((note, index) => (
                            <div key={index} className={styles.messyNote}>
                                {note}
                            </div>
                        ))}
                    </div>
                ))}
            </div>

            {/* Vignette overlay for depth */}
            <div className={styles.vignette}></div>
        </div>
    );
}
