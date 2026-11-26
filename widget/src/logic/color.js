// Black or white, whichever has the higher WCAG contrast against a #RRGGBB background.
export function textColor(backgroundColor) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(backgroundColor.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return (luminance + 0.05) / 0.05 >= 1.05 / (luminance + 0.05) ? "#000000" : "#ffffff";
}
