"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { AddressSuggestions } from "@/components/address-suggestions";
import { HelpButton, HelpSheet } from "@/components/help-sheet";
import {
  createPin,
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
type Phase = "search" | "house" | "meter";
type PinPhase = Exclude<Phase, "search">;

const EMPTY: PropertyContext = {
  address: "",
  source: "example",
  meterUncertain: false,
  propertyConfirmed: false,
};

const MAP_TIPS: Record<Phase, string[]> = {
  search: [
    "Type your street, city and ZIP code, then pick your home from the list.",
    "Or share your location if you are at home right now.",
  ],
  house: ["Zoom in or out to check the roof and the street around it.", "The H pin should sit on your house."],
  meter: ["Tap the outside wall where the electric meter hangs.", "Tap again to move the M pin."],
};

const METER_PROMPT = "Tap the wall where your meter is located.";
const METER_MARKED = "Meter marked. Tap again to move it.";

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
 * Map step: confirm the home, then tap the wall where the meter is.
 * A home that already has an address opens straight on the map ("Is this your home?") instead of the search screen.
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
  const knownAddress = initial?.address || startAddress || "";
  const openOnHouse = Boolean(initial?.house && MAPS_API_KEY);
  const lookUp = Boolean(knownAddress && !openOnHouse && MAPS_API_KEY);
  const openOnExample = Boolean(knownAddress && !MAPS_API_KEY);
  const [phase, setPhase] = useState<Phase>(knownAddress ? "house" : "search");
  const [addressKnown, setAddressKnown] = useState(Boolean(knownAddress));
  const [query, setQuery] = useState(knownAddress);
  const [context, setContext] = useState<PropertyContext>(() => ({
    ...EMPTY,
    ...initial,
    address: knownAddress,
    ...(openOnExample ? { source: "example" as const } : {}),
  }));
  const [active, setActive] = useState(openOnHouse || openOnExample);
  const [busy, setBusy] = useState(lookUp);
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
    else if (kind === "meter") {
      const pin = createPin(maps, { label: "M", title: "Meter location", className: "pl-meter" });
      pin.setPosition(point);
      pin.setMap(map.current);
      markers.current[kind] = pin;
    } else
      markers.current[kind] = new maps.Marker({
        map: map.current,
        position: point,
        label: { text: "H", color: "white", fontWeight: "bold" },
        title: "House location",
      });
  };
  const putPoint = (kind: Phase, point: Coordinate, maps: Maps) => {
    if (kind === "search") return;
    mark(kind, point, maps);
    setContext((c) => ({ ...c, [kind]: point, ...(kind === "meter" ? { meterUncertain: false } : {}) }));
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
  const backToSearch = (message: string) => {
    setAddressKnown(false);
    setPhase("search");
    setError(message);
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
    } else if (lookUp) {
      findAddress(knownAddress)
        .then(async (found) => {
          if (cancelled) return;
          if (found) showProperty(await loadMaps(), found.point, found.address, found.placeId);
          else backToSearch("We couldn't find an exact home for that address. Add the house number, city and ZIP code, then try again.");
        })
        .catch((err) => {
          console.error("[map] could not find the home address", err);
          if (!cancelled) backToSearch("We couldn't load your home. Check your address and try again.");
        })
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
    if (phase === "meter") setContext((c) => ({ ...c, exampleMeter: point, meterUncertain: false }));
  };
  const meterMarked = !!(context.meter || context.exampleMeter);
  const advance = () => {
    if (phase === "house") {
      setContext((c) => ({ ...c, propertyConfirmed: true }));
      changePhase("meter");
    } else if (phase === "meter") onDone(context);
  };
  const notQuite = () => {
    setAddressKnown(false);
    changePhase("search");
  };

  const closeHelp = () => setHelpOpen(false);
  const unsure = () => {
    closeHelp();
    onDone({ ...context, propertyConfirmed: false });
  };
  const meterUnknown = () => onDone({ ...context, meter: undefined, exampleMeter: undefined, meterUncertain: true });

  const help = <HelpButton ref={helpButton} onClick={() => setHelpOpen(true)} />;
  let top: ReactNode;
  if (phase === "search") top = <div className="sc-topbar">{help}</div>;
  else if (phase === "house")
    top = (
      <div className="sc-topbar">
        {!addressKnown && <BackButton onClick={() => changePhase("search")} />}
        {help}
      </div>
    );
  else
    top = (
      <div className="pl-tap-bar">
        <BackButton onClick={() => changePhase("house")} />
        <p ref={setHeading} tabIndex={-1} aria-live="polite">
          {meterMarked ? METER_MARKED : METER_PROMPT}
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
              {addressKnown ? "Is this your home?" : "Does this look familiar?"}
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
          {phase === "house" && (active ? context.address : knownAddress) && (
            <div className="pl-address">{active ? context.address : knownAddress}</div>
          )}
          <div className={`pl-map-wrap ${phase === "search" ? "pl-map-hidden" : ""}`} aria-hidden={phase === "search"}>
            <div
              ref={mapNode}
              className="pl-google-map"
              style={{ display: active && context.source === "google" ? "block" : "none" }}
              aria-label="Google property map"
            />
            {phase === "house" && !active && (
              <div className="pl-map-loading" role="status">
                Finding your home...
              </div>
            )}
            {active && context.source === "example" && (
              <div
                className={`pl-reference ${phase === "meter" ? "pl-selectable" : ""}`}
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
                {context.exampleMeter && (
                  <span
                    key={`${context.exampleMeter.x}:${context.exampleMeter.y}`}
                    className="pl-pin pl-meter"
                    style={{ left: `${context.exampleMeter.x * 100}%`, top: `${context.exampleMeter.y * 100}%` }}
                  >
                    M<span>Meter</span>
                  </span>
                )}
              </div>
            )}
          </div>
          {error && (
            <p className="sc-error" role="alert">
              {error}
            </p>
          )}
        </div>
        <footer className="sc-actions">
          {phase === "search" && (
            <button type="button" className="sc-primary" disabled={busy} onClick={() => void search()}>
              {busy ? "Finding your home..." : "Find my home"}
            </button>
          )}
          {phase === "house" && addressKnown && (
            <>
              <button type="button" className="sc-primary" disabled={!active} onClick={advance}>
                Yes, that&apos;s my home
              </button>
              <button type="button" className="sc-option pl-location" disabled={busy} onClick={notQuite}>
                Not quite
              </button>
            </>
          )}
          {phase === "house" && !addressKnown && (
            <button type="button" className="sc-primary" onClick={advance}>
              Confirm
            </button>
          )}
          {phase === "meter" && (
            <>
              <button type="button" className={`sc-primary pl-meter-confirm ${meterMarked ? "pl-meter-ready" : ""}`} disabled={!meterMarked} onClick={advance}>
                Confirm meter location
              </button>
              <button type="button" className="sc-text-button pl-meter-unknown" onClick={meterUnknown}>
                I don&apos;t know where my meter is
              </button>
            </>
          )}
        </footer>
      </section>
      {helpOpen && (
        <HelpSheet tips={MAP_TIPS[phase]} onClose={closeHelp} returnFocus={helpButton}>
          {phase === "search" && (
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
          )}
          {phase === "house" && (
            <button type="button" className="sc-option" onClick={unsure}>
              I&apos;m not sure this is my home
            </button>
          )}
        </HelpSheet>
      )}
    </>
  );
}
