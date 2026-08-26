import Sidebar from './Sidebar'
import Topbar from './Topbar'

const Layout = ({ title, children }) => {
  return (
    <div className="min-h-screen bg-surface-900">
      <Sidebar />
      <div className="ml-60">
        <Topbar title={title} />
        <main className="pt-14 min-h-screen">
          <div className="p-6 animate-fade-in">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}

export default Layout
