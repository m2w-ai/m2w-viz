import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import {
  createBrowserRouter,
  Navigate,
  RouterProvider,
  useParams,
} from 'react-router-dom'
import './styles.css'
import { DECKS } from './content/decks'
import { SAMPLE_FUNNEL } from './content/funnel'
import { SAMPLE_GRAPH } from './content/graph'
import { SAMPLE_PIPELINE } from './content/pipeline'
import { FunnelApp } from './funnel/funnel-app'
import { GraphApp } from './graph/graph-app'
import { HomeMenu } from './home'
import { PipelineApp } from './pipeline/pipeline-app'
import { PresentationDeck } from './presentations/deck-shell'
import { PresentationsHub } from './presentations/presentations-hub'
import { findDeck } from './presentations/registry'

// Decks are routed by slug out of the registry, so a new talk needs no route
// of its own. An unknown slug goes back to the hub rather than to a blank deck.
function DeckRoute() {
  const { slug } = useParams()
  const deck = findDeck(DECKS, slug)
  if (!deck) return <Navigate to="/presentations" replace />
  // Keyed so moving between decks remounts Spectacle instead of carrying the
  // previous deck's slide index into the next one.
  return <PresentationDeck key={deck.slug} deck={deck} />
}

const router = createBrowserRouter([
  { path: '/', element: <HomeMenu /> },
  { path: '/presentations', element: <PresentationsHub decks={DECKS} /> },
  { path: '/presentations/:slug', element: <DeckRoute /> },
  { path: '/funnel', element: <FunnelApp dataset={SAMPLE_FUNNEL} /> },
  { path: '/graph', element: <GraphApp dataset={SAMPLE_GRAPH} /> },
  { path: '/pipeline', element: <PipelineApp dataset={SAMPLE_PIPELINE} /> },
  { path: '*', element: <Navigate to="/" replace /> },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
