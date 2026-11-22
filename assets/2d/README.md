# Color Quest 2D Graphics

Custom, lightweight SVG artwork for the Color Quest PWA. Assets are authored as individual files and can be reused in the web app and Android WebView.

## Included

- `colors/`: red, orange, yellow, green, blue and purple glossy orb illustrations
- `icons/`: calendar, trophy, shop, settings, undo, hint, reset, extra bottle and coin
- `mascot/`: friendly chameleon brand mascot

## Integration

The navigation and gameplay action buttons use the custom SVG icons in `index.html`. The chameleon is used in the game header. The service worker precaches these assets so they remain available offline.

The puzzle liquid itself continues to use the game's existing `COLORS` array and rendering logic. This keeps themes, colour-blind symbols, animations and saved progress compatible.
