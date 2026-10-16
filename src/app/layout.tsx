import type { Metadata } from 'next'
import './globals.css'
import Navbar from '@/components/Navbar'

export const metadata: Metadata = {
  title: 'Daily AI Digest',
  description: 'Napi hírek és nyelvtanulás',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="hu">
            <body>
        <Navbar />
        <main className="pt-6">
          {children}
        </main>
      </body>
    </html>
  )
}