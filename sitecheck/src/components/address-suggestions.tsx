"use client";

import type { AddressSuggestion, SuggestBox } from "@/lib/maps-client";

/** The dropdown under an address input. Pair it with useAddressSuggestions. */
export function AddressSuggestions({
  id,
  suggestions,
  active,
  box,
  onChoose,
  onHover,
}: {
  id: string;
  suggestions: AddressSuggestion[];
  active: number;
  box: SuggestBox;
  onChoose: (item: AddressSuggestion) => void;
  onHover: (index: number) => void;
}) {
  return (
    <div className="pl-suggest-pop" style={{ top: box.top, left: box.left, width: box.width }}>
      <ul id={id} className="pl-suggestions" role="listbox" aria-label="Address suggestions" style={{ maxHeight: box.maxHeight }}>
        {suggestions.map((item, index) => (
          <li key={item.placeId} id={`${id}-option-${index}`} role="option" aria-selected={index === active}>
            <button
              type="button"
              tabIndex={-1}
              onMouseDown={(event) => {
                event.preventDefault();
                onChoose(item);
              }}
              onMouseEnter={() => onHover(index)}
            >
              <strong>{item.main}</strong>
              {item.secondary && <span>{item.secondary}</span>}
            </button>
          </li>
        ))}
      </ul>
      <p className="pl-powered">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="https://maps.gstatic.com/mapfiles/api-3/images/powered-by-google-on-white3.png" alt="Powered by Google" />
      </p>
    </div>
  );
}
