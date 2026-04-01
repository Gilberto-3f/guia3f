'use client'

/**
 * @param {{ username: string }} props
 */
export default function Username({ username }) {
  return <p className="text-left text-sm text-gray-500">@{username}</p>
}
