/**
 * DemoMedia — Lightweight autoplay media component for marketing demos.
 *
 * Renders an HTML5 <video> (autoplay, muted, loop) or <img> for GIF.
 * Shows a skeleton placeholder while loading.
 * Fires a GA4 analytics event once on first play.
 *
 * Usage:
 *   <DemoMedia
 *     gifSrc="/demos/recording-flow.gif"
 *     alt="Recording demo"
 *     trackingLabel="hero_recording"
 *     className="rounded-xl shadow-lg"
 *   />
 */

import React, { useState, useRef, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { trackEvent } from '@/lib/web-analytics'

interface DemoMediaProps {
  /** Path to MP4/WebM video, e.g. "/demos/recording-flow.mp4" */
  videoSrc?: string
  /** Path to GIF fallback, e.g. "/demos/recording-flow.gif" */
  gifSrc?: string
  /** Alt text for accessibility */
  alt: string
  /** Optional analytics event name, fires once on first play */
  trackingLabel?: string
  /** Additional Tailwind classes for the wrapper */
  className?: string
  /** Poster image shown before video loads */
  poster?: string
}

export function DemoMedia({
  videoSrc,
  gifSrc,
  alt,
  trackingLabel,
  className,
  poster,
}: DemoMediaProps) {
  const [isLoaded, setIsLoaded] = useState(false)
  const hasTracked = useRef(false)

  const handleLoaded = useCallback(() => {
    setIsLoaded(true)
    if (trackingLabel && !hasTracked.current) {
      hasTracked.current = true
      trackEvent('demo_video_play', { video: trackingLabel })
    }
  }, [trackingLabel])

  const src = videoSrc || gifSrc
  if (!src) return null

  return (
    <div className={cn('relative overflow-hidden', className)}>
      {/* Skeleton while loading */}
      {!isLoaded && (
        <Skeleton className="absolute inset-0 w-full h-full" />
      )}

      {videoSrc ? (
        <video
          autoPlay
          muted
          loop
          playsInline
          poster={poster}
          onLoadedData={handleLoaded}
          className={cn(
            'w-full h-full object-cover transition-opacity duration-300',
            isLoaded ? 'opacity-100' : 'opacity-0'
          )}
        >
          <source src={videoSrc} type="video/mp4" />
          {/* GIF fallback for browsers that can't play video */}
          {gifSrc && (
            <img src={gifSrc} alt={alt} className="w-full h-full object-cover" />
          )}
        </video>
      ) : (
        <img
          src={gifSrc}
          alt={alt}
          onLoad={handleLoaded}
          className={cn(
            'w-full h-full object-cover transition-opacity duration-300',
            isLoaded ? 'opacity-100' : 'opacity-0'
          )}
        />
      )}
    </div>
  )
}

export default DemoMedia
