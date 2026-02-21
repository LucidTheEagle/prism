'use client'

import { useState, Suspense, useId } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0" aria-hidden="true" focusable="false">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  )
}

/**
 * LoginForm
 *
 * Isolated so useSearchParams() is wrapped in <Suspense> by the parent.
 * Next.js requires this to avoid build-time prerender failures.
 */
function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirectTo') ?? '/'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Stable IDs for ARIA associations
  const errorId = useId()
  const emailId = useId()
  const passwordId = useId()

  const supabase = createClient()
  const isAnyLoading = loading || googleLoading

  async function handleEmailSignIn(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    router.push(redirectTo)
    router.refresh()
  }

  async function handleGoogleSignIn() {
    setError(null)
    setGoogleLoading(true)

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${redirectTo}`,
      },
    })

    if (error) {
      setError(error.message)
      setGoogleLoading(false)
    }
  }

  return (
    <div
      className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl p-5 sm:p-8 w-full"
      role="region"
      aria-label="Sign in to PRISM"
    >
      {/* Heading */}
      <div className="mb-6 sm:mb-8 text-center">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-50 mb-1">
          Welcome back
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Sign in to your PRISM workspace
        </p>
      </div>

      {/*
       * Error banner
       * role="alert" + aria-live="assertive" — announced immediately
       * by screen readers when auth fails, without needing focus.
       */}
      {error && (
        <div
          id={errorId}
          role="alert"
          aria-live="assertive"
          className="mb-5 sm:mb-6 flex items-start gap-3 p-3 sm:p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg"
        >
          <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5 shrink-0" aria-hidden="true" />
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      {/*
       * Google OAuth button
       * aria-busy signals the loading state to screen readers.
       * aria-describedby links to error when present.
       */}
      <button
        onClick={handleGoogleSignIn}
        disabled={isAnyLoading}
        aria-label="Continue with Google"
        aria-busy={googleLoading}
        aria-describedby={error ? errorId : undefined}
        className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 min-h-[44px]"
      >
        {googleLoading
          ? <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
          : <GoogleIcon />
        }
        <span>{googleLoading ? 'Redirecting to Google…' : 'Continue with Google'}</span>
      </button>

      {/* Divider */}
      <div className="relative my-5 sm:my-6" role="separator" aria-label="Or continue with email">
        <div className="absolute inset-0 flex items-center" aria-hidden="true">
          <div className="w-full border-t border-slate-200 dark:border-slate-700" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-white dark:bg-slate-900 px-3 text-slate-500 dark:text-slate-400 tracking-wider">
            or continue with email
          </span>
        </div>
      </div>

      {/*
       * Sign-in form
       * aria-describedby links the form to the error banner so screen
       * readers surface the error context when the form receives focus.
       * noValidate defers to our controlled error state rather than
       * native browser validation bubbles (which can't be styled).
       */}
      <form
        onSubmit={handleEmailSignIn}
        aria-label="Sign in with email and password"
        aria-describedby={error ? errorId : undefined}
        noValidate
        className="space-y-4"
      >
        {/* Email */}
        <div>
          <label
            htmlFor={emailId}
            className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5"
          >
            Email address
          </label>
          <input
            id={emailId}
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            aria-required="true"
            aria-invalid={!!error}
            disabled={isAnyLoading}
            className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-shadow disabled:opacity-60 disabled:cursor-not-allowed min-h-[44px]"
          />
        </div>

        {/* Password */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label
              htmlFor={passwordId}
              className="block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              Password
            </label>
            <Link
              href="/forgot-password"
              className="text-xs text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 rounded"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <input
              id={passwordId}
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              aria-required="true"
              aria-invalid={!!error}
              disabled={isAnyLoading}
              className="w-full px-3.5 py-2.5 pr-11 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-shadow disabled:opacity-60 disabled:cursor-not-allowed min-h-[44px]"
            />
            {/*
             * Show/hide password toggle
             * aria-label updates dynamically with the current state.
             * aria-controls references the password input it controls.
             */}
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              aria-controls={passwordId}
              aria-pressed={showPassword}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 rounded p-0.5 min-w-[24px] min-h-[24px] flex items-center justify-center"
            >
              {showPassword
                ? <EyeOff className="w-4 h-4" aria-hidden="true" />
                : <Eye className="w-4 h-4" aria-hidden="true" />
              }
            </button>
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={isAnyLoading}
          aria-busy={loading}
          aria-label={loading ? 'Signing in, please wait' : 'Sign in to PRISM'}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-br from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white rounded-lg text-sm font-semibold transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed mt-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 min-h-[44px]"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              <span>Signing in…</span>
            </>
          ) : (
            <span>Sign In</span>
          )}
        </button>
      </form>

      {/* Register link */}
      <p className="mt-5 sm:mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
        Don&apos;t have an account?{' '}
        <Link
          href="/register"
          className="text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 rounded"
        >
          Create one free
        </Link>
      </p>
    </div>
  )
}

/**
 * LoginPage
 *
 * Shell page — provides the layout and Suspense boundary.
 * LoginForm is isolated so useSearchParams() doesn't cause
 * a build-time static generation failure.
 */
export default function LoginPage() {
  return (
    <main
      className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 px-4 py-8 sm:py-12"
      aria-label="Sign in page"
    >
      <div className="w-full max-w-md">
        {/* PRISM wordmark above card */}
        <div className="text-center mb-6 sm:mb-8" aria-hidden="true">
          <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 tracking-tight">
            PRISM
          </span>
        </div>

        <Suspense
          fallback={
            <div
              className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl p-5 sm:p-8 flex items-center justify-center"
              style={{ minHeight: '420px' }}
              role="status"
              aria-label="Loading sign in form"
            >
              <Loader2 className="w-8 h-8 animate-spin text-emerald-500" aria-hidden="true" />
            </div>
          }
        >
          <LoginForm />
        </Suspense>
      </div>
    </main>
  )
}