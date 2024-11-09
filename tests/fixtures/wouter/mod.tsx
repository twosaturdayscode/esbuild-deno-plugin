import {useRoute} from 'npm:wouter'

function App() {
  const [match] = useRoute('/')

  return match ? "Hello World" : null
}

export default App