import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const queryClient = new QueryClient()

function App(): JSX.Element {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<div className="p-8"><h1 className="text-2xl font-bold">Agon Studio</h1><p className="text-gray-500 mt-2">Loading...</p></div>} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App
