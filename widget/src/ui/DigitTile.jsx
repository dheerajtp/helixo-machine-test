export function DigitTile({ value, label }) {
  return (
    <div class="cdt-tile">
      <span class="cdt-number">{value}</span>
      <span class="cdt-unit">{label}</span>
    </div>
  );
}
