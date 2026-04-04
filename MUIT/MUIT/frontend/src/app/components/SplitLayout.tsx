import React from 'react';
import styles from './SplitLayout.module.css';
import ChaosFeed from './ChaosFeed';
import MediScribeFlow from './MediScribeFlow';

export default function SplitLayout() {
    return (
        <div className={styles.container}>
            <div className={styles.leftPanel}>
                <ChaosFeed />
            </div>
            <div className={styles.rightPanel}>
                <MediScribeFlow />
            </div>
        </div>
    );
}
