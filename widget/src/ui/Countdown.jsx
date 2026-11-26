import { DigitTile } from "./DigitTile.jsx";
import { tiles, timeLeftLabel } from "./format.js";

export function Countdown({ parts, description, appearance, textColor, urgencyEffect, urgent }) {
  const { backgroundColor, size, position } = appearance;
  const effect = urgent && urgencyEffect !== "none" ? ` cdt-box--${urgencyEffect}` : "";

  return (
    <div
      class={`cdt-box cdt-box--${size} cdt-box--${position}${effect}`}
      style={{ backgroundColor, color: textColor }}
    >
      {description ? <p class="cdt-description">{description}</p> : null}
      <div class="cdt-tiles" aria-hidden="true">
        {tiles(parts).map((tile) => (
          <DigitTile key={tile.key} value={tile.value} label={tile.label} />
        ))}
      </div>
      <span class="cdt-sr">{timeLeftLabel(parts)}</span>
    </div>
  );
}
