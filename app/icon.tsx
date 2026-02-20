import { ImageResponse } from 'next/og'

/**
 * PRISM App Icon
 *
 * Next.js 16 generates all favicon sizes (16x16, 32x32, 180x180 apple-touch)
 * automatically from this single file using ImageResponse.
 *
 * Matches the brand: emerald gradient background + white "P" lettermark,
 * identical to the header logo in ConditionalShell.tsx.
 */
export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 7,
          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span
          style={{
            color: 'white',
            fontSize: 20,
            fontWeight: 700,
            fontFamily: 'system-ui, sans-serif',
            lineHeight: 1,
            marginTop: 2,
          }}
        >
          P
        </span>
      </div>
    ),
    { ...size }
  )
}