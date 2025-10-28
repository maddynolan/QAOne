import { AppProps } from 'next/app';
import '../styles/globals.css';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <style jsx global>{`
        /* Force override any cached styles */
        * {
          box-sizing: border-box !important;
        }
        
        body {
          margin: 0 !important;
          padding: 0 !important;
          font-family: 'Inter', 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif !important;
          background: linear-gradient(135deg, #f8fafc 0%, #e0e7ff 50%, #e0f2fe 100%) !important;
          min-height: 100vh !important;
        }
        
        html {
          scroll-behavior: smooth !important;
        }
        
        /* Force Tailwind to work */
        .min-h-screen { min-height: 100vh !important; }
        .bg-gradient-to-br { background: linear-gradient(to bottom right, var(--tw-gradient-stops)) !important; }
        .from-slate-50 { --tw-gradient-from: #f8fafc !important; }
        .via-blue-50 { --tw-gradient-via: #eff6ff !important; }
        .to-indigo-100 { --tw-gradient-to: #e0e7ff !important; }
      `}</style>
      <Component {...pageProps} />
    </>
  );
}