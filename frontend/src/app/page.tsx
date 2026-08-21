import Link from 'next/link';
import styles from './Home.module.css';

const WORKFLOW = [
  {
    number: '01',
    role: 'Reception',
    title: 'A complete intake, before the consultation starts.',
    detail: 'Register the patient, verify their mobile number, link ABHA, and place them in the right clinical queue.',
  },
  {
    number: '02',
    role: 'Doctor',
    title: 'The conversation becomes a record—not a distraction.',
    detail: 'Transcribe Hinglish in real time, structure the encounter, flag uncertainty, and keep approval with the clinician.',
  },
  {
    number: '03',
    role: 'Pharmacy',
    title: 'The prescription arrives ready for a safe handover.',
    detail: 'Review approved medication orders, surface inventory issues, and give the patient a clear Hindi summary.',
  },
  {
    number: '04',
    role: 'ABHA',
    title: 'The final record moves with the patient.',
    detail: 'Commit only after approval, then sync the completed consultation into the national health record workflow.',
  },
] as const;

const PRINCIPLES = [
  ['Clinical control', 'Nothing is committed until a doctor approves the record.'],
  ['Language fluency', 'Built around the way Indian consultations actually sound—including Hinglish.'],
  ['One accountable flow', 'Reception, consultation, dispensing, and records stay connected.'],
] as const;

export default function Home() {
  return (
    <main className={styles.page}>
      <nav className={styles.nav} aria-label="Main navigation">
        <Link href="/" className={styles.brand} aria-label="MediScribe home">
          <span>MediScribe</span><sup>AI</sup>
        </Link>
        <div className={styles.navLinks}>
          <a href="#workflow">Workflow</a>
          <a href="#clinical-record">The record</a>
          <a href="#principles">Principles</a>
        </div>
        <Link href="/login" className={styles.navCta}>Staff access <span aria-hidden="true">→</span></Link>
      </nav>

      <section className={styles.hero}>
        <div className={styles.heroMain}>
          <p className={styles.eyebrow}>Clinical operations for India</p>
          <h1>Care moves.<br />The record <em>keeps up.</em></h1>
        </div>

        <div className={styles.heroAside}>
          <p className={styles.heroLead}>
            One continuous workspace from patient intake to consultation, pharmacy handover, and ABHA sync.
          </p>
          <p className={styles.heroBody}>
            MediScribe turns the clinical conversation into a reviewable record while keeping the people responsible for care in control of every decision.
          </p>
          <div className={styles.heroActions}>
            <Link href="/login" className={styles.primaryAction}>Enter MediScribe <span aria-hidden="true">→</span></Link>
            <a href="#workflow" className={styles.textAction}>Follow the patient journey</a>
          </div>
        </div>

        <div className={styles.heroFoot}>
          <span>Reception</span><i aria-hidden="true" /><span>Consultation</span><i aria-hidden="true" /><span>Pharmacy</span><i aria-hidden="true" /><span>ABHA</span>
        </div>
      </section>

      <section className={styles.workflow} id="workflow">
        <header className={styles.sectionHeader}>
          <p className={styles.eyebrow}>One patient · one connected journey</p>
          <h2>Four desks.<br />No dropped context.</h2>
          <p>Each role sees exactly what it needs, while the clinical record moves forward as one accountable thread.</p>
        </header>

        <div className={styles.workflowList}>
          {WORKFLOW.map((step) => (
            <article className={styles.workflowRow} key={step.number}>
              <span className={styles.stepNumber}>{step.number}</span>
              <p className={styles.stepRole}>{step.role}</p>
              <div>
                <h3>{step.title}</h3>
                <p>{step.detail}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.recordSection} id="clinical-record">
        <div className={styles.recordIntro}>
          <p className={styles.lightEyebrow}>A record worth signing</p>
          <h2>Structured by the system.<br />Owned by the doctor.</h2>
          <p>
            The transcript and the clinical note stay side by side. Extracted facts are readable, uncertainty is visible, and safety checks arrive before approval—not after.
          </p>
        </div>

        <div className={styles.recordSpecimen} aria-label="Example clinical record flow">
          <div className={styles.specimenHeader}>
            <span>Consultation 08 / 21</span>
            <span>Awaiting clinician review</span>
          </div>
          <div className={styles.specimenGrid}>
            <div className={styles.transcriptColumn}>
              <p className={styles.specimenLabel}>Conversation</p>
              <blockquote>“Bukhar teen din se hai, aur body ache kaafi zyada hai.”</blockquote>
              <p className={styles.speaker}>Patient · 09:42:18</p>
              <blockquote>“Any known medicine allergy?”</blockquote>
              <p className={styles.speaker}>Doctor · 09:42:31</p>
            </div>
            <div className={styles.noteColumn}>
              <p className={styles.specimenLabel}>Draft clinical note</p>
              <dl>
                <div><dt>Chief concern</dt><dd>Fever with severe body ache</dd></div>
                <div><dt>Duration</dt><dd>3 days</dd></div>
                <div><dt>Temperature</dt><dd>102°F</dd></div>
                <div><dt>Safety review</dt><dd>Allergy history needs confirmation</dd></div>
              </dl>
              <p className={styles.reviewNote}>One item needs the doctor’s confirmation before this record can be approved.</p>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.principles} id="principles">
        <header className={styles.principlesHeader}>
          <p className={styles.eyebrow}>Designed around responsibility</p>
          <h2>Quiet software for consequential work.</h2>
        </header>
        <div className={styles.principleGrid}>
          {PRINCIPLES.map(([title, detail], index) => (
            <article key={title}>
              <span>0{index + 1}</span>
              <h3>{title}</h3>
              <p>{detail}</p>
            </article>
          ))}
        </div>
      </section>

      <footer className={styles.footer}>
        <div>
          <p className={styles.lightEyebrow}>Ready when the clinic is</p>
          <h2>Put the record<br />back in step with care.</h2>
        </div>
        <div className={styles.footerAction}>
          <p>Choose your staff role and enter the MediScribe workspace.</p>
          <Link href="/login">Open staff access <span aria-hidden="true">→</span></Link>
        </div>
        <div className={styles.footerBottom}>
          <span>MediScribe AI</span>
          <span>ABDM-ready clinical workflows · India</span>
          <span>© {new Date().getFullYear()}</span>
        </div>
      </footer>
    </main>
  );
}
