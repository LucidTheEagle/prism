import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'PRISM - Precision Document Intelligence',
  description: 'AI-powered document analysis with forensic citation accuracy. Transform PDFs into queryable knowledge with verified answers.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {/* Header */}
        <header className="h-16 border-b border-slate-200 bg-white sticky top-0 z-50 shadow-sm">
          <div className="container mx-auto h-full flex items-center justify-between px-4">
            <div className="flex items-center gap-3">
              {/* PRISM Logo */}
              <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded flex items-center justify-center shadow-md">
                <span className="text-white font-bold text-lg">P</span>
              </div>
              <div className="flex flex-col">
                <span className="text-xl font-semibold text-slate-900">PRISM</span>
                <span className="text-[10px] text-slate-500 -mt-1 tracking-wide">
                  Precision Document Intelligence
                </span>
              </div>
            </div>
            
            {/* Right side actions */}
            <div className="flex items-center gap-4">
              <button className="text-sm text-slate-600 hover:text-slate-900 transition-colors hidden md:block">
                How it works
              </button>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                <span className="hidden sm:inline">AI Ready</span>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="h-[calc(100vh-4rem)]">
          {children}
        </main>

        {/* Footer with Disclaimer */}
        <footer className="fixed bottom-0 left-0 right-0 bg-slate-50 border-t border-slate-200 py-2 px-4 text-center text-xs text-slate-500 z-40">
          <span className="hidden sm:inline">PRISM is a research tool, not legal advice. </span>
          Always verify critical information.
        </footer>
      </body>
    </html>
  )
}