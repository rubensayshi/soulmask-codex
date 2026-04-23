import { useEffect } from 'react'
import { Route, Routes } from 'react-router-dom'
import { useStore } from './store'
import Layout from './components/Layout'
import Home from './pages/Home'
import Item from './pages/Item'
import AwarenessXp from './pages/AwarenessXp'
import FoodAlmanac from './pages/FoodAlmanac'

export default function App() {
  const loadGraph = useStore(s => s.loadGraph)
  useEffect(() => { loadGraph() }, [loadGraph])
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/item/:id" element={<Item />} />
        <Route path="/awareness-xp" element={<AwarenessXp />} />
        <Route path="/food-almanac" element={<FoodAlmanac />} />
      </Routes>
    </Layout>
  )
}
