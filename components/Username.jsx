'use client'

/**
 * @param {{ username: string }} props
 */
export default function Username({ username }) {
  return <span className="font-medium text-gray-600">@{username}</span>
}
