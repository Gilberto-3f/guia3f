'use client'

import PostCard from '@/components/PostCard'

/**
 * Reposts do perfil: mesmo `PostCard` do feed (curtidas, comentários, partilhar, repost, guardar).
 *
 * @param {{
 *   posts: Record<string, unknown>[]
 *   meuUsuarioId: string | null
 *   userEmail?: string | null
 *   onPostLocalPatch?: (postId: string, patch: Partial<{ texto: string | null }>) => void
 *   onEngagementChange?: (postId: string, patch: { total_curtidas?: number; total_comentarios?: number }) => void
 *   onRemovePost?: (postId: string) => void
 *   onRepostRemovido?: (repostPostId: string) => void
 * }} props
 */
export default function AbaRepublicados({
  posts,
  meuUsuarioId,
  userEmail = null,
  onPostLocalPatch,
  onEngagementChange,
  onRemovePost,
  onRepostRemovido,
}) {
  if (posts.length === 0) {
    return <p className="py-12 text-center text-sm text-gray-400">Nenhum repostado</p>
  }

  return (
    <div className="space-y-4 px-2 pb-2">
      {posts.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          meuUsuarioId={meuUsuarioId}
          userEmail={userEmail}
          onRemove={onRemovePost}
          onPostLocalPatch={onPostLocalPatch}
          onEngagementChange={onEngagementChange}
          onRepostRemovido={onRepostRemovido}
        />
      ))}
    </div>
  )
}
