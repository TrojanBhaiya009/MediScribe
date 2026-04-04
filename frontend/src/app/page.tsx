import Navbar from './components/Navbar';
import Hero from './components/Hero';
import DashboardShowcase from './components/DashboardShowcase';
import Features from './components/Features';
import Footer from './components/Footer';

export default function Home() {
  return (
    <main>
      <Navbar />
      <Hero />
      <DashboardShowcase />
      <Features />
      <Footer />
    </main>
  );
}
