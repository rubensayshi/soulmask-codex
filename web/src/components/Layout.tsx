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
          <div className="px-9 pt-7 pb-12 max-w-[1100px] mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
