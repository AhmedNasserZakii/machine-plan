# 3D navigation and settings icons

Created with the built-in image generator as one transparent 4 × 5 atlas. Individual 256px PNG assets preserve the original lighting and colors. The app uses `App3dIcon` to render these assets without tinting, with scale and opacity differences for inactive navigation tabs.

Prompt: create a regular 4-column, 5-row transparent atlas of rounded satin-ceramic 3D icons, navy #1B4965, sky blue #5FA8D3 and white, with upper-left studio lighting and bold silhouettes for 36px display. Row-major subjects: house, POS terminal, transfer arrows, storefront; wallet, gear, chart, gavel; ID badge, wrench, checklist, users; branch building, paired POS terminals, bell, sync arrows; globe, padlock, coral-red exit door and arrow, profile avatar. No text, captions, dividers, tiles or watermark.

`source-atlas.png` preserves the original output. Run `dart run scripts/prepare_3d_icons.dart` to reproduce the individual assets using the measured atlas gutters.
