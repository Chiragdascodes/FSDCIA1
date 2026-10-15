import { useEffect, useMemo, useRef, useState } from 'react'
import BeaconMap, { type BeaconMapHandle } from './map/BeaconMap'
import MapControls from './components/MapControls'
import LiquidFilter from './ui/LiquidFilter'
import { resolveStyle, type MapStyleSetting } from './map/styles'
import { useReducedMotion, useSystemDark } from './ui/hooks'

export default function App() {
  const mapRef = useRef<BeaconMapHandle>(null)
  const systemDark = useSystemDark()
  const reducedMotion = useReducedMotion()
  const [styleSetting, setStyleSetting] = useState<MapStyleSetting>('auto')
  const [globe, setGlobe] = useState(true)
  const [stylesOpen, setStylesOpen] = useState(false)
  const dark = systemDark
  const styleId = resolveStyle(styleSetting, dark)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
  }, [dark])

  const padding = useMemo(() => ({ top: 0, bottom: 0, left: 0, right: 0 }), [])

  return (
    <div className="relative h-full w-full overflow-hidden">
      <LiquidFilter />
      <BeaconMap
        ref={mapRef}
        styleId={styleId}
        globe={globe}
        places={[]}
        selectedId={null}
        route={null}
        user={null}
        anchor={null}
        radius={null}
        padding={padding}
        reducedMotion={reducedMotion}
        pickLocation={null}
        onSelect={() => {}}
        onPick={() => {}}
        onMoveEnd={() => {}}
        onReady={() => {}}
        onLongPress={() => {}}
      />
      <div className="absolute top-4 right-4">
        <MapControls
          styleSetting={styleSetting}
          activeStyle={styleId}
          globe={globe}
          locating={false}
          onImagery={styleId === 'satellite'}
          onStyle={setStyleSetting}
          onToggleGlobe={() => setGlobe((g) => !g)}
          onLocate={() => mapRef.current?.flyTo(12.9716, 77.5946, 15)}
          onZoom={(d) => mapRef.current?.zoomBy(d)}
          onResetNorth={() => mapRef.current?.resetNorth()}
          stylesOpen={stylesOpen}
          setStylesOpen={setStylesOpen}
        />
      </div>
    </div>
  )
}
