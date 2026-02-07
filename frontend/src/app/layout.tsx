import './globals.css';
import { Toaster } from 'react-hot-toast';
import WalletProvider from '@/components/WalletProvider';
import AuthProvider from '@/components/AuthProvider';
import Navbar from '@/components/Navbar';

export const metadata = {
  title: 'Campus Rumors - Anonymous Verification',
  description: 'Anonymous, verified rumor verification for campus communities',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <AuthProvider>
          <WalletProvider>
            <Navbar />
            <main>{children}</main>
            <Toaster
              position="bottom-right"
              toastOptions={{
                style: {
                  background: 'rgba(30, 41, 59, 0.9)',
                  color: '#fff',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                },
              }}
            />
          </WalletProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
