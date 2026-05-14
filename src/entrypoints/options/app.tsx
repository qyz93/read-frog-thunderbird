import type { ComponentType } from "react"
import { lazy, Suspense } from "react"
import { Route, Routes } from "react-router"
import { ROUTE_DEFS } from "./app-sidebar/nav-items"
import { GeneralPage } from "./pages/general"

type RoutePath = (typeof ROUTE_DEFS)[number]["path"]
const IS_THUNDERBIRD = import.meta.env.BROWSER === "thunderbird"

const ApiProvidersPage = lazy(() => import("./pages/api-providers").then(module => ({ default: module.ApiProvidersPage })))
const CustomActionsPage = lazy(() => import("./pages/custom-actions").then(module => ({ default: module.CustomActionsPage })))
const TranslationPage = lazy(() => import("./pages/translation").then(module => ({ default: module.TranslationPage })))
const ContextMenuPage = lazy(() => import("./pages/context-menu").then(module => ({ default: module.ContextMenuPage })))
const StatisticsPage = lazy(() => import("./pages/statistics").then(module => ({ default: module.StatisticsPage })))

const BROWSER_ROUTE_COMPONENTS = IS_THUNDERBIRD
  ? {}
  : {
    "/video-subtitles": lazy(() => import("./pages/video-subtitles").then(module => ({ default: module.VideoSubtitlesPage }))),
    "/floating-button": lazy(() => import("./pages/floating-button").then(module => ({ default: module.FloatingButtonPage }))),
    "/selection-toolbar": lazy(() => import("./pages/selection-toolbar").then(module => ({ default: module.SelectionToolbarPage }))),
    "/input-translation": lazy(() => import("./pages/input-translation").then(module => ({ default: module.InputTranslationPage }))),
    "/tts": lazy(() => import("./pages/text-to-speech").then(module => ({ default: module.TextToSpeechPage }))),
    "/config": lazy(() => import("./pages/config").then(module => ({ default: module.ConfigPage }))),
  } satisfies Partial<Record<RoutePath, ComponentType>>

const ROUTE_COMPONENTS: Partial<Record<RoutePath, ComponentType>> = {
  "/": GeneralPage,
  "/api-providers": ApiProvidersPage,
  "/custom-actions": CustomActionsPage,
  "/translation": TranslationPage,
  "/context-menu": ContextMenuPage,
  "/statistics": StatisticsPage,
  ...BROWSER_ROUTE_COMPONENTS,
}

function RouteLoadingFallback() {
  return (
    <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
      Loading settings...
    </div>
  )
}

export default function App() {
  return (
    <Suspense fallback={<RouteLoadingFallback />}>
      <Routes>
        {ROUTE_DEFS.map(({ path }) => {
          const Component = ROUTE_COMPONENTS[path]
          if (!Component) {
            return null
          }

          return <Route key={path} path={path} element={<Component />} />
        })}
      </Routes>
    </Suspense>
  )
}
