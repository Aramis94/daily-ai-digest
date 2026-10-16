import type { Metadata } from 'next'
import { Suspense } from 'react'
import { Fraunces, Outfit } from 'next/font/google'
import './globals.css'
import Navbar from '@/components/Navbar'

const outfit = Outfit({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-outfit',
})

const fraunces = Fraunces({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-fraunces',
})

export const metadata: Metadata = {
  title: 'Tudás minden napra',
  description: 'Napi hírek és nyelvtanulás',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="hu" className={`${outfit.variable} ${fraunces.variable}`}>
      <body className="min-h-screen antialiased">
        <Suspense fallback={<div className="h-14 border-b border-[#e4d9c8]/80" />}>
          <Navbar />
        </Suspense>
        <main>{children}</main>
      </body>
    </html>
  )
}
