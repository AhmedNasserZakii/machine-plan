# Machinery 3D launcher icon

Created using the built-in image generation tool. The payment terminal represents POS equipment and finance; the gear represents maintenance and equipment lifecycle. Colors follow the app palette.

- `machinery-3d-source.png`: original transparent artwork.
- `machinery-3d.png`: opaque white-background 1024px iOS and Android legacy master. Android adaptive icons also use a white background.
- `machinery-3d-foreground.png`: transparent Android adaptive layer with safe margins.

Regenerate with `dart run scripts/prepare_launcher_icon.dart`, then `dart run flutter_launcher_icons`.

The packaging script also updates `assets/images/app_logo.png`, iOS LaunchImage assets, and Android splash assets for every density, including the Android 12 safe-zone canvas. Flutter login and splash share the `AppLogo` widget. Android and iOS launch screens use a white background with centered transparent artwork.

## Generation prompt

Use case: stylized-concept
Asset type: production mobile app launcher foreground for Machinery, a POS-machine lifecycle, custody transfer, maintenance and finance app.
Primary request: one beautiful polished 3D icon mark: a compact white and icy blue handheld payment terminal, with a dark navy blue screen showing a simple cyan checkmark, three rows of broad minimal keypad buttons, and a short white receipt emerging from its top. Behind it a single thick beveled blue gear halo representing equipment lifecycle and maintenance. Integrated coherent silhouette, not separate scattered objects.
Style: premium sculpted 3D product illustration, softly rounded ceramic and satin metal, subtle realistic ambient occlusion, clean studio lighting from upper left. Near front view with slight three-quarter perspective. Bold readable silhouette, low detail.
Color palette: navy #1B4965, sky blue #5FA8D3, white and ice blue.
Composition: square canvas, centered entire mark including gear occupies about 70 percent width and 72 percent height with generous empty margin, all parts fully visible. Transparent background, no ground plane, no outer app tile, no border.
Constraints: no text, no letters, no numbers, no watermark, no currency symbols, no excavator. Actual isolated transparent foreground suitable to place on a solid navy app background.
