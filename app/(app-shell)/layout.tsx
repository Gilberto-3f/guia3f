import BottomBar from '@/components/BottomBar'

export default function AppShellLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {children}
      <BottomBar />
    </div>
  )
}
