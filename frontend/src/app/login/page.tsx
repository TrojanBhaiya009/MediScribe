import Link from 'next/link';
import { PORTALS } from './portals.config';
import styles from './Login.module.css';

function PortalCard({ portal }: { portal: typeof PORTALS[number] }) {
  return (
    <article className={styles.card}>
      <Link href={portal.href} className={styles.cardLink} aria-label={`${portal.cta}: ${portal.title}`}>
        <span className={styles.portalNumber} aria-hidden="true">{portal.number}</span>
        <span className={styles.cardHeader}>
          <span className={styles.title}>{portal.title}</span>
          <span className={styles.desc}>{portal.desc}</span>
        </span>
        <span className={styles.arrow} aria-hidden="true">→</span>
      </Link>
    </article>
  );
}

export default function LoginPage() {
  return (
    <main className={styles.page}>
      <header className={styles.topbar}>
        <Link href="/" className={styles.brand} aria-label="MediScribe home">
          <span className={styles.logoText}>
            MediScribe
          </span>
          <span className={styles.logoAccent}>AI</span>
        </Link>
        <p className={styles.topbarNote}>Staff access directory · India</p>
      </header>

      <div className={styles.loginLayout}>
        <section className={styles.intro} aria-labelledby="login-heading">
          <p className={styles.eyebrow}>MediScribe clinical operations</p>
          <h1 id="login-heading" className={styles.headline}>
            The right desk,<br />the right <em>tools.</em>
          </h1>
          <p className={styles.subheadline}>
            Choose your role to enter the workspace assigned to your clinical responsibilities.
          </p>
          <div className={styles.introMeta}>
            <span>Four protected<br />staff environments</span>
            <span>ABDM-ready<br />clinical workflows</span>
          </div>
        </section>

        <section className={styles.portalPanel} aria-labelledby="portal-heading">
          <p className={styles.portalKicker}>Access directory</p>
          <h2 id="portal-heading" className={styles.portalHeading}>Select your workspace</h2>
          <div className={styles.grid} aria-label="Access portals">
            {PORTALS.map((portal) => (
              <PortalCard key={portal.id} portal={portal} />
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
