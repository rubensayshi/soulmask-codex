import type { ReactNode } from 'react'
import TopNav from './TopNav'
import Sidebar from './Sidebar'

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <TopNav />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="main-pane flex-1 overflow-y-auto bg-bg">
          <div className="px-4 pt-4 pb-12 md:px-9 md:pt-7 max-w-[1400px] mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
