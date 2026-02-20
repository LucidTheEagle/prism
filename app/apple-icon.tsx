import { ImageResponse } from 'next/og'

/**
 * PRISM Apple Touch Icon (180x180)
 * Used when a user adds PRISM to their iOS home screen.
 * Larger canvas with more padding — Apple's guidelines for touch icons.
 */
export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleTouchIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 180,
          height: 180,
          borderRadius: 40,
          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span
          style={{
            color: 'white',
            fontSize: 110,
            fontWeight: 700,
            fontFamily: 'system-ui, sans-serif',
            lineHeight: 1,
            marginTop: 10,
          }}
        >
          P
        </span>
      </div>
    ),
    { ...size }
  )
}