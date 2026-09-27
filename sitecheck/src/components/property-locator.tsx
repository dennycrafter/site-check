"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { AddressSuggestions } from "@/components/address-suggestions";
import { HelpButton, HelpSheet } from "@/components/help-sheet";
import {
  findAddress,
  loadMaps,
  MAPS_API_KEY,
  useAddressSuggestions,
  type AddressSuggestion,
  type MapObject,
  type Maps,
  type Marker,
} from "@/lib/maps-client";
import type { Coordinate, HomeProperty, MapPoint } from "@/lib/types";

export type PropertyContext = Omit<HomeProperty, "mapDone">;
type Phase = "search" | "house" | "front" | "meter";
type PinPhase = Exclude<Phase, "search">;

const EMPTY: PropertyContext = {
  address: "",
  source: "example",
  frontUncertain: false,
  meterUncertain: false,
  propertyConfirmed: false,
};

const MAP_TIPS: Record<Phase, string[]> = {
  search: [
    "Type your street, city and ZIP code, then pick your home from the list.",
    "Or share your location if you are at home right now.",
  ],
  house: ["Zoom in or out to check the roof and the street around it.", "The H pin should sit on your house."],
  front: ["Tap the side of the house with the front door.", "Tap again to move the F pin."],
  meter: ["Tap the outside wall where the electric meter hangs.", "Tap again to move the M pin."],
};

const UNSURE: Record<PinPhase, string> = {
  house: "I'm not sure this is my home",
  front: "I'm not sure where the front is",
  meter: "I'm not sure where my meter is",
};

const EXAMPLE_POSITIONS = [
  { label: "Top", x: 0.55, y: 0.29 },
  { label: "Right", x: 0.76, y: 0.55 },
  { label: "Bottom", x: 0.47, y: 0.74 },
  { label: "Left", x: 0.3, y: 0.5 },
];

function BackIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M19 12H6M11 6.5 5.5 12 11 17.5" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="pl-top-back" aria-label="Back" onClick={onClick}>
      <BackIcon />
    </button>
  );
}

/**
 * Map step: find the home, then tap the front entrance and the meter wall.
 * Without a Maps key it uses the example map image. Never blocks: onFail is called when the map can't load.
 */
export default function PropertyLocator({
  initial,
  startAddress,
  onDone,
  onFail,
}: {
  initial?: PropertyContext | null;
  startAddress?: string | null;
  onDone: (value: PropertyContext) => void;
  onFail?: (error: unknown) => void;
}) {
  const openOnHouse = Boolean(initial?.house && MAPS_API_KEY);
  const [phase, setPhase] = useState<Phase>(openOnHouse ? "house" : "search");
  const [query, setQuery] = useState(initial?.address || startAddress || "");
  const [context, setContext] = useState<PropertyContext>(initial ? { ...EMPTY, ...initial } : { ...EMPTY, address: startAddress || "" });
  const [active, setActive] = useState(openOnHouse);
  const [busy, setBusy] = useState(Boolean(!openOnHouse && MAPS_API_KEY && startAddress));
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState("");
  const [helpOpen, setHelpOpen] = useState(false);
  const mapNode = useRef<HTMLDivElement>(null);
  const map = useRef<MapObject | null>(null);
  const markers = useRef<Record<string, Marker>>({});
  const mapFrame = useRef<number | null>(null);
  const currentPhase = useRef(phase);
  const clickListener = useRef<{ remove(): void } | null>(null);
  const heading = useRef<HTMLElement | null>(null);
  const setHeading = (node: HTMLElement | null) => {
    heading.current = node;
  };
  const helpButton = useRef<HTMLButtonElement>(null);
  const addressInput = useRef<HTMLInputElement>(null);
  const suggest = useAddressSuggestions(addressInput, () => currentPhase.current === "search");
  const onFailRef = useRef(onFail);
  useEffect(() => {
    onFailRef.current = onFail;
  });

  const changePhase = (next: Phase) => {
    setError("");
    setPhase(next);
  };
  useEffect(() => {
    currentPhase.current = phase;
  }, [phase]);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    heading.current?.closest(".sc-content")?.scrollTo(0, 0);
  }, [phase]);
  useEffect(
    () => () => {
      if (mapFrame.current) cancelAnimationFrame(mapFrame.current);
      clickListener.current?.remove();
      Object.values(markers.current).forEach((m) => m.setMap(null));
    },
    [],
  );

  const mark = (kind: PinPhase, point: Coordinate, maps: Maps) => {
    if (markers.current[kind]) markers.current[kind].setPosition(point);
    else
      markers.current[kind] = new maps.Marker({
        map: map.current,
        position: point,
        label: { text: kind === "house" ? "H" : kind === "front" ? "F" : "M", color: "white", fontWeight: "bold" },
        title: kind === "front" ? "Front of house" : kind === "meter" ? "Meter location" : "House location",
      });
  };
  const putPoint = (kind: Phase, point: Coordinate, maps: Maps) => {
    if (kind === "search") return;
    mark(kind, point, maps);
    setContext((c) => ({
      ...c,
      [kind]: point,
      ...(kind === "front" ? { frontUncertain: false } : kind === "meter" ? { meterUncertain: false } : {}),
    }));
  };
  const drawMap = (maps: Maps, point: Coordinate) => {
    mapFrame.current = requestAnimationFrame(() => {
      if (!mapNode.current) return;
      Object.values(markers.current).forEach((m) => m.setMap(null));
      markers.current = {};
      if (!map.current) {
        map.current = new maps.Map(mapNode.current, {
          center: point,
          zoom: 20,
          mapTypeId: "roadmap",
          tilt: 0,
          heading: 0,
          disableDefaultUI: true,
          zoomControl: true,
          gestureHandling: "cooperative",
          clickableIcons: false,
        });
        clickListener.current = map.current.addListener("click", (e) => {
          if (e.latLng) putPoint(currentPhase.current, e.latLng.toJSON(), maps);
        });
      } else {
        map.current.setCenter(point);
        map.current.setZoom(20);
      }
      mark("house", point, maps);
    });
  };
  const showProperty = (maps: Maps, point: Coordinate, address: string, placeId?: string) => {
    setContext({ ...EMPTY, address, placeId, source: "google", house: point });
    setActive(true);
    changePhase("house");
    drawMap(maps, point);
  };
  const showExample = (address: string) => {
    setContext((c) => ({ ...EMPTY, ...c, address, source: "example" }));
    setActive(true);
    changePhase("house");
  };

  useEffect(() => {
    let cancelled = false;
    if (!MAPS_API_KEY) return;
    const house = initial?.house;
    if (house) {
      loadMaps()
        .then((maps) => {
          if (!cancelled) drawMap(maps, house);
        })
        .catch((err) => {
          console.error("[map] could not load", err);
          if (!cancelled) onFailRef.current?.(err);
        });
    } else if (startAddress) {
      findAddress(startAddress)
        .then(async (found) => {
          if (cancelled) return;
          if (found) showProperty(await loadMaps(), found.point, found.address, found.placeId);
        })
        .catch((err) => console.error("[map] could not find the start address", err))
        .finally(() => {
          if (!cancelled) setBusy(false);
        });
    }
    return () => {
      cancelled = true;
    };
    // Runs once when the step opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const chooseSuggestion = async (item: AddressSuggestion) => {
    setQuery(item.label);
    setBusy(true);
    setError("");
    try {
      const maps = await loadMaps();
      const found = await suggest.choose(item);
      setQuery(found.address);
      if (!found.point) {
        setError("We couldn't pinpoint that address. Try it again.");
        return;
      }
      showProperty(maps, found.point, found.address, found.placeId);
    } catch (err) {
      console.error("[map] could not load the address", err);
      setError("We couldn't load that address. Try it again.");
    } finally {
      setBusy(false);
    }
  };

  const search = async () => {
    suggest.close();
    const address = query.trim();
    if (!address) {
      setError("Enter your street address, city and ZIP code.");
      return;
    }
    if (!MAPS_API_KEY) {
      showExample(address);
      return;
    }
    setBusy(true);
    setError("");
    let maps: Maps;
    try {
      maps = await loadMaps();
    } catch (err) {
      console.error("[map] could not load", err);
      setBusy(false);
      onFailRef.current?.(err);
      return;
    }
    try {
      const found = await findAddress(address);
      if (!found) {
        setError("We couldn't find an exact home. Add the house number, city and ZIP code, then try again.");
        return;
      }
      showProperty(maps, found.point, found.address, found.placeId);
    } catch (err) {
      console.error("[map] address lookup failed", err);
      setError("We couldn't load your home. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  const useLocation = () => {
    if (!navigator.geolocation) {
      setError("Location sharing is not available on this device. Enter your address instead.");
      return;
    }
    if (!MAPS_API_KEY) {
      setError("Location sharing needs the live map. Enter your address instead.");
      return;
    }
    setLocating(true);
    setError("");
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const point = { lat: position.coords.latitude, lng: position.coords.longitude };
          const maps = await loadMaps();
          let address = "Your current location";
          let placeId: string | undefined;
          try {
            const { results } = await new maps.Geocoder().geocode({ location: point });
            if (results?.[0]?.formatted_address) address = results[0].formatted_address;
            placeId = results?.[0]?.place_id;
          } catch {
            // Shared coordinates can still center the map.
          }
          showProperty(maps, point, address, placeId);
        } catch (err) {
          console.error("[map] could not open the map", err);
          setError("We couldn't open the map. Enter your address instead.");
        } finally {
          setLocating(false);
        }
      },
      (err) => {
        setLocating(false);
        setError(err.code === 1 ? "Location was not shared. Enter your address instead." : "We couldn't find your location. Enter your address instead.");
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 300000 },
    );
  };

  const selectExample = (point: MapPoint) => {
    if (phase === "front") setContext((c) => ({ ...c, exampleFront: point, frontUncertain: false }));
    if (phase === "meter") setContext((c) => ({ ...c, exampleMeter: point, meterUncertain: false }));
  };
  const ready =
    phase === "house" ||
    (phase === "front" && !!(context.front || context.exampleFront || context.frontUncertain)) ||
    (phase === "meter" && !!(context.meter || context.exampleMeter || context.meterUncertain));
  const advance = () => {
    if (phase === "house") {
      setContext((c) => ({ ...c, propertyConfirmed: true }));
      changePhase("front");
    } else if (phase === "front") changePhase("meter");
    else if (phase === "meter") onDone(context);
  };

  const closeHelp = () => setHelpOpen(false);
  const unsure = () => {
    closeHelp();
    if (phase === "house") onDone({ ...context, propertyConfirmed: false });
    else if (phase === "front") {
      setContext((c) => ({ ...c, frontUncertain: true }));
      changePhase("meter");
    } else if (phase === "meter") onDone({ ...context, meterUncertain: true });
  };

  const help = <HelpButton ref={helpButton} onClick={() => setHelpOpen(true)} />;
  let top: ReactNode;
  if (phase === "search") top = <div className="sc-topbar">{help}</div>;
  else if (phase === "house")
    top = (
      <div className="sc-topbar">
        <BackButton onClick={() => changePhase("search")} />
        {help}
      </div>
    );
  else
    top = (
      <div className="pl-front-bar">
        <BackButton onClick={() => changePhase(phase === "front" ? "house" : "front")} />
        <p ref={setHeading} tabIndex={-1}>
          {phase === "front" ? "Tap the front entrance on your house." : "Tap the wall where your meter is located."}
        </p>
        {help}
      </div>
    );

  return (
    <>
      <section className={`pl-flow pl-phase-${phase}`} inert={helpOpen || undefined}>
        <div className="sc-content">
          {top}
          {phase === "house" && (
            <h1 ref={setHeading} tabIndex={-1}>
              Does this look familiar?
            </h1>
          )}
          {phase === "search" && (
            <form
              className="pl-start"
              onSubmit={(e) => {
                e.preventDefault();
                void search();
              }}
            >
              <h1 ref={setHeading} tabIndex={-1}>
                Where is your home?
              </h1>
              <label htmlFor="map-address">Property address</label>
              <div className="pl-address-field">
                <input
                  ref={addressInput}
                  id="map-address"
                  role="combobox"
                  aria-autocomplete="list"
                  aria-expanded={suggest.open}
                  aria-controls="map-address-list"
                  aria-activedescendant={suggest.open && suggest.active >= 0 ? `map-address-list-option-${suggest.active}` : undefined}
                  autoComplete="off"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    suggest.onQueryChange(e.target.value);
                  }}
                  onKeyDown={(e) => {
                    const pick = suggest.onKeyDown(e);
                    if (pick) void chooseSuggestion(pick);
                  }}
                  onBlur={suggest.close}
                  placeholder="Street, city and ZIP code"
                />
                {suggest.open && suggest.box && (
                  <AddressSuggestions
                    id="map-address-list"
                    suggestions={suggest.suggestions}
                    active={suggest.active}
                    box={suggest.box}
                    onChoose={(item) => void chooseSuggestion(item)}
                    onHover={suggest.setActive}
                  />
                )}
              </div>
              <div className="pl-or" aria-hidden="true">
                <span>or</span>
              </div>
              <button type="button" className="sc-option pl-location" disabled={busy || locating} onClick={useLocation}>
                {locating ? "Finding your location..." : "Use my current location"}
              </button>
            </form>
          )}
          {active && phase === "house" && context.address && <div className="pl-address">{context.address}</div>}
          <div className={`pl-map-wrap ${phase === "search" ? "pl-map-hidden" : ""}`} aria-hidden={phase === "search"}>
            <div
              ref={mapNode}
              className="pl-google-map"
              style={{ display: active && context.source === "google" ? "block" : "none" }}
              aria-label="Google property map"
            />
            {(!active || context.source === "example") && (
              <div
                className={`pl-reference ${phase === "front" || phase === "meter" ? "pl-selectable" : ""}`}
                role="group"
                aria-label="Reference map example, not a searched property"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  selectExample({ x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height });
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/property-map-reference.png" alt="Reference map showing neighboring house footprints" draggable={false} />
                <span className="pl-example-badge">Example map</span>
                {context.exampleFront && (
                  <span className="pl-pin pl-front" style={{ left: `${context.exampleFront.x * 100}%`, top: `${context.exampleFront.y * 100}%` }}>
                    F<span>Front</span>
                  </span>
                )}
                {context.exampleMeter && (
                  <span className="pl-pin pl-meter" style={{ left: `${context.exampleMeter.x * 100}%`, top: `${context.exampleMeter.y * 100}%` }}>
                    M<span>Meter</span>
                  </span>
                )}
              </div>
            )}
          </div>
          {(phase === "front" || phase === "meter") && (
            <>
              {context.source === "example" && (
                <details className="pl-keyboard">
                  <summary>Choose without tapping the map</summary>
                  <div className="pl-position-buttons">
                    {EXAMPLE_POSITIONS.map((p) => (
                      <button key={p.label} type="button" onClick={() => selectExample({ x: p.x, y: p.y })}>
                        {p.label}
                      </button>
                    ))}
                  </div>
                </details>
              )}
              {((phase === "front" && context.frontUncertain) || (phase === "meter" && context.meterUncertain)) && (
                <p className="pl-selection" aria-live="polite">
                  {phase === "front" ? "Front marked as unsure" : "Meter marked as unsure"}
                </p>
              )}
            </>
          )}
          {error && (
            <p className="sc-error" role="alert">
              {error}
            </p>
          )}
        </div>
        <footer className="sc-actions">
          {phase === "search" ? (
            <button type="button" className="sc-primary" disabled={busy} onClick={() => void search()}>
              {busy ? "Finding your home..." : "Find my home"}
            </button>
          ) : (
            <button type="button" className="sc-primary" disabled={!ready} onClick={advance}>
              Confirm
            </button>
          )}
        </footer>
      </section>
      {helpOpen && (
        <HelpSheet tips={MAP_TIPS[phase]} onClose={closeHelp} returnFocus={helpButton}>
          {phase === "search" ? (
            <button
              type="button"
              className="sc-option"
              onClick={() => {
                closeHelp();
                onDone({ ...context, address: query.trim() || context.address, propertyConfirmed: false });
              }}
            >
              I&apos;m not sure of my address
            </button>
          ) : (
            <button type="button" className="sc-option" onClick={unsure}>
              {UNSURE[phase]}
            </button>
          )}
        </HelpSheet>
      )}
    </>
  );
}
