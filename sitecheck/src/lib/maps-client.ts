"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import type { Coordinate } from "./types";

export type LatLng = { toJSON(): Coordinate };
export type MapObject = {
  setCenter(p: Coordinate): void;
  getCenter(): LatLng | undefined;
  setZoom(n: number): void;
  getZoom(): number | undefined;
  addListener(t: string, cb: (e: { latLng?: LatLng }) => void): { remove(): void };
};
export type Marker = { setMap(m: MapObject | null): void; setPosition(p: Coordinate): void };
type OverlayViewBase = {
  setMap(m: MapObject | null): void;
  getPanes(): { overlayMouseTarget: HTMLElement } | null;
  getProjection(): { fromLatLngToDivPixel(p: unknown): { x: number; y: number } | null } | null;
};
type GeocodeResult = {
  formatted_address: string;
  place_id: string;
  types: string[];
  partial_match?: boolean;
  geometry: { location: LatLng };
};
export type Maps = {
  Map: new (node: HTMLElement, options: Record<string, unknown>) => MapObject;
  Marker: new (options: Record<string, unknown>) => Marker;
  LatLng: new (lat: number, lng: number) => unknown;
  OverlayView: new () => OverlayViewBase;
  Geocoder: new () => { geocode(options: { address: string } | { location: Coordinate }): Promise<{ results: GeocodeResult[] }> };
  importLibrary?(name: string): Promise<PlacesLibrary>;
};
type FormattableText = { text?: string; toString(): string };
type Place = { fetchFields(request: { fields: string[] }): Promise<unknown>; formattedAddress?: string | null; location?: LatLng | null };
type PlacePrediction = {
  text: FormattableText;
  placeId: string;
  mainText?: FormattableText | null;
  secondaryText?: FormattableText | null;
  toPlace(): Place;
};
type PlacesLibrary = {
  AutocompleteSuggestion: {
    fetchAutocompleteSuggestions(request: {
      input: string;
      sessionToken?: object;
      includedRegionCodes?: string[];
      includedPrimaryTypes?: string[];
      language?: string;
      region?: string;
    }): Promise<{ suggestions: Array<{ placePrediction: PlacePrediction | null }> }>;
  };
  AutocompleteSessionToken: new () => object;
};
/**
 * A pin drawn as page HTML on the map, so CSS can animate it (Google's own markers can't be styled).
 * Every placement or move restarts the pin's `pl-drop` animation, which the stylesheet turns off for reduced motion.
 */
export function createPin(maps: Maps, options: { label: string; title: string; className: string }): Marker {
  const holder = document.createElement("div");
  holder.className = "pl-overlay-pin";
  const pin = document.createElement("span");
  pin.className = `pl-pin ${options.className}`;
  pin.title = options.title;
  pin.textContent = options.label;
  holder.appendChild(pin);
  let position: Coordinate | null = null;

  class PinOverlay extends maps.OverlayView {
    onAdd() {
      this.getPanes()?.overlayMouseTarget.appendChild(holder);
    }
    draw() {
      const point = position && this.getProjection()?.fromLatLngToDivPixel(new maps.LatLng(position.lat, position.lng));
      if (!point) return;
      holder.style.left = `${point.x}px`;
      holder.style.top = `${point.y}px`;
    }
    onRemove() {
      holder.remove();
    }
    setPosition(next: Coordinate) {
      position = next;
      this.draw();
      pin.style.animation = "none";
      void pin.offsetWidth;
      pin.style.animation = "";
    }
  }
  return new PinOverlay();
}

export type AddressSuggestion = { placeId: string; label: string; main: string; secondary: string; toPlace: () => Place };
export type FoundAddress = { address: string; point: Coordinate; placeId?: string };

declare global {
  interface Window {
    google?: { maps: Maps };
    __baseMapsReady?: () => void;
    gm_authFailure?: () => void;
  }
}

export const MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

const HOME_TYPES = ["street_address", "premise", "subpremise"];

let mapsLoading: Promise<Maps> | null = null;
let placesLoading: Promise<PlacesLibrary> | null = null;

export function loadMaps(key = MAPS_API_KEY): Promise<Maps> {
  if (window.google?.maps) return Promise.resolve(window.google.maps);
  if (mapsLoading) return mapsLoading;
  mapsLoading = new Promise<Maps>((resolve, reject) => {
    const script = document.createElement("script");
    const fail = () => {
      window.clearTimeout(timer);
      script.remove();
      mapsLoading = null;
      reject(new Error("Maps could not load. Please try again."));
    };
    const timer = window.setTimeout(fail, 15000);
    window.__baseMapsReady = () => {
      window.clearTimeout(timer);
      if (window.google?.maps) resolve(window.google.maps);
      else fail();
    };
    window.gm_authFailure = fail;
    script.async = true;
    script.onerror = fail;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&loading=async&v=quarterly&callback=__baseMapsReady`;
    document.head.appendChild(script);
  });
  return mapsLoading;
}

export async function loadPlaces(maps: Maps): Promise<PlacesLibrary> {
  if (placesLoading) return placesLoading;
  if (!maps.importLibrary) throw new Error("Places library is unavailable.");
  placesLoading = maps.importLibrary("places").catch((error) => {
    placesLoading = null;
    throw error;
  });
  return placesLoading;
}

function textOf(value: FormattableText | null | undefined) {
  const text = value?.text?.trim();
  return text || value?.toString().trim() || "";
}

export async function fetchAddressSuggestions(input: string, sessionToken?: object): Promise<AddressSuggestion[]> {
  const maps = await loadMaps();
  const places = await loadPlaces(maps);
  const { suggestions } = await places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
    input,
    sessionToken,
    includedRegionCodes: ["us"],
    includedPrimaryTypes: HOME_TYPES,
    language: "en",
    region: "us",
  });
  return suggestions.flatMap((item) => {
    const prediction = item.placePrediction;
    if (!prediction) return [];
    const label = textOf(prediction.text);
    if (!label) return [];
    const main = textOf(prediction.mainText) || label;
    return [{ placeId: prediction.placeId, label, main, secondary: textOf(prediction.secondaryText), toPlace: () => prediction.toPlace() }];
  });
}

/** The address and map point of a chosen suggestion. point is missing when Google has no location for it. */
export async function resolveSuggestion(item: AddressSuggestion): Promise<{ address: string; point?: Coordinate; placeId: string }> {
  const place = item.toPlace();
  await place.fetchFields({ fields: ["formattedAddress", "location"] });
  return { address: place.formattedAddress || item.label, point: place.location?.toJSON(), placeId: item.placeId };
}

/** Finds one exact home for a typed address: the Geocoder first, then the top address suggestion. */
export async function findAddress(address: string): Promise<FoundAddress | null> {
  const maps = await loadMaps();
  try {
    const { results } = await new maps.Geocoder().geocode({ address });
    const result = results[0];
    if (result && !result.partial_match && result.types.some((t) => HOME_TYPES.includes(t))) {
      return { address: result.formatted_address, point: result.geometry.location.toJSON(), placeId: result.place_id };
    }
  } catch (err) {
    console.warn("[maps] geocoder failed, trying address suggestions", err);
  }
  const [top] = await fetchAddressSuggestions(address);
  if (!top) return null;
  const found = await resolveSuggestion(top);
  return found.point ? { address: found.address, point: found.point, placeId: found.placeId } : null;
}

export type SuggestBox = { top: number; left: number; width: number; maxHeight: number };

/**
 * Live address suggestions under an input: debounced lookups, a fixed-position dropdown box
 * and arrow key, Enter and Escape handling. Does nothing without a Maps key.
 */
export function useAddressSuggestions(input: RefObject<HTMLInputElement | null>, isActive: () => boolean = () => true) {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [box, setBox] = useState<SuggestBox | null>(null);
  const timer = useRef<number | null>(null);
  const request = useRef(0);
  const session = useRef<object | null>(null);
  const activeRef = useRef(isActive);
  useEffect(() => {
    activeRef.current = isActive;
  });

  const place = useCallback(() => {
    const rect = input.current?.getBoundingClientRect();
    if (!rect) return;
    const space = window.innerHeight - rect.bottom - 16;
    setBox({ top: rect.bottom + 8, left: rect.left, width: rect.width, maxHeight: Math.max(96, Math.min(240, space - 28)) });
  }, [input]);

  const close = useCallback(() => {
    request.current += 1;
    setSuggestions([]);
    setOpen(false);
    setActive(-1);
  }, []);

  useEffect(() => {
    if (!open) return;
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, place]);

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );

  const lookup = useCallback(
    async (text: string) => {
      const id = ++request.current;
      try {
        const maps = await loadMaps();
        const places = await loadPlaces(maps);
        if (!session.current) session.current = new places.AutocompleteSessionToken();
        const next = await fetchAddressSuggestions(text, session.current);
        if (id !== request.current || !activeRef.current()) return;
        setSuggestions(next);
        if (next.length) place();
        setOpen(next.length > 0);
        setActive(next.length ? 0 : -1);
      } catch (err) {
        console.warn("[maps] address suggestions failed", err);
        if (id === request.current) close();
      }
    },
    [close, place],
  );

  const onQueryChange = useCallback(
    (value: string) => {
      setActive(-1);
      if (timer.current) window.clearTimeout(timer.current);
      const trimmed = value.trim();
      if (!MAPS_API_KEY || trimmed.length < 3) {
        close();
        return;
      }
      timer.current = window.setTimeout(() => void lookup(trimmed), 250);
    },
    [close, lookup],
  );

  const choose = useCallback(
    async (item: AddressSuggestion) => {
      if (timer.current) window.clearTimeout(timer.current);
      close();
      try {
        return await resolveSuggestion(item);
      } finally {
        session.current = null;
      }
    },
    [close],
  );

  /** Returns the suggestion to choose when Enter picks one. */
  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>): AddressSuggestion | null => {
      if (event.key === "Escape") {
        setOpen(false);
        return null;
      }
      if (!open || suggestions.length === 0) return null;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActive((index) => (index + 1) % suggestions.length);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setActive((index) => (index <= 0 ? suggestions.length - 1 : index - 1));
      } else if (event.key === "Enter" && active >= 0) {
        event.preventDefault();
        return suggestions[active] ?? null;
      }
      return null;
    },
    [open, suggestions, active],
  );

  return { suggestions, open, active, box, setActive, close, onQueryChange, onKeyDown, choose };
}
