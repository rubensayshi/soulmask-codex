import { useEffect } from 'react'
import { Route, Routes } from 'react-router-dom'
import { useStore } from './store'
import Home from './pages/Home'
import Item from './pages/Item'

export default function App() {
  const loadGraph = useStore(s => s.loadGraph)
  useEffect(() => { loadGraph() }, [loadGraph])
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/item/:id" element={<Item />} />
    </Routes>
  )
}
