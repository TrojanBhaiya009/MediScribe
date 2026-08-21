import Link from 'next/link';
import type { ReactNode } from 'react';
import styles from './Login.module.css';

type RoleLoginLayoutProps = {
  section: string;
  portalName: string;
  statement: string;
  detail: string;
  children: ReactNode;
  credentials: ReactNode;
};

export default function RoleLoginLayout({
  section,
  portalName,
  statement,
  detail,
  children,
  credentials,
}: RoleLoginLayoutProps) {
  return (
    <main className={styles.rolePage}>
      <aside className={styles.roleAside}>
        <Link href="/" className={styles.roleBrand} aria-label="MediScribe home">
          <span className={styles.roleBrandMain}>MediScribe</span>
          <span className={styles.roleBrandAccent}>AI</span>
        </Link>

        <div className={styles.roleStory}>
          <p className={styles.roleEyebrow}>{section} access</p>
          <h1 className={styles.roleStatement}>{statement}</h1>
          <p className={styles.roleDetail}>{detail}</p>
        </div>

        <div className={styles.roleAsideMeta}>
          <span>ABDM-ready workspace</span>
          <span>India · Secure staff access</span>
        </div>
      </aside>

      <section className={styles.roleMain} aria-labelledby="portal-title">
        <div className={styles.roleMainTop}>
          <span className={styles.secureNote}>Authorized personnel only</span>
        </div>

        <div className={styles.roleFormWrap}>
          <p className={styles.formKicker}>Identity verification</p>
          <h2 id="portal-title" className={styles.roleTitle}>{portalName}</h2>
          <p className={styles.rolePrompt}>Use your assigned staff credentials to continue.</p>

          {children}

          <div className={styles.darkCredentials}>
            <div className={styles.credentialTitle}>Demo access</div>
            {credentials}
          </div>

          <Link href="/login" className={styles.darkBackLink}>
            <span aria-hidden="true">←</span> All staff portals
          </Link>
        </div>

        <footer className={styles.roleFooter}>
          <span>Clinical data stays within your authorized workspace</span>
          <span>MediScribe v2</span>
        </footer>
      </section>
    </main>
  );
}
