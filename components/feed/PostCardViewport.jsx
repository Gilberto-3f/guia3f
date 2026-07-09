'use client'

import { useEffect, useRef } from 'react'

/**
 * Dispara `onEntrouViewport` uma vez por montagem quando o post entra na área visível.
 * @param {{ postId: string, onEntrouViewport?: (postId: string) => void, children: import('react').ReactNode }} props
 */
export default function PostCardViewport({ postId, onEntrouViewport, children }) {
  const ref = useRef(/** @type {HTMLDivElement | null} */ (null))
  const reportadoRef = useRef(false)

  useEffect(() => {
    reportadoRef.current = false
  }, [postId])

  useEffect(() => {
    if (!onEntrouViewport || !postId) return
    const el = ref.current
    if (!el) return

    const obs = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting || reportadoRef.current) return
        reportadoRef.current = true
        onEntrouViewport(String(postId))
      },
      { threshold: 0.08, rootMargin: '0px' },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [postId, onEntrouViewport])

  return (
    <div ref={ref} className="min-w-0">
      {children}
    </div>
  )
}
