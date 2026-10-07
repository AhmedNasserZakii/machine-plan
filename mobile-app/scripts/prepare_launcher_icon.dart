// Packaging only: preserve generated artwork; resize onto platform canvases.
import 'dart:io';
import 'package:image/image.dart' as img;

void main() {
  final source = img.decodePng(
    File('assets/icons/launcher/machinery-3d-source.png').readAsBytesSync(),
  )!;
  var left = source.width, top = source.height, right = 0, bottom = 0;
  for (final pixel in source) {
    if (pixel.a > 8) {
      if (pixel.x < left) left = pixel.x;
      if (pixel.y < top) top = pixel.y;
      if (pixel.x > right) right = pixel.x;
      if (pixel.y > bottom) bottom = pixel.y;
    }
  }
  final mark = img.copyCrop(
    source,
    x: left,
    y: top,
    width: right - left + 1,
    height: bottom - top + 1,
  );
  img.Image canvas(int extent, bool opaque) {
    final result = img.Image(
      width: 1024,
      height: 1024,
      numChannels: opaque ? 3 : 4,
    );
    img.fill(
      result,
      color: opaque ? img.ColorRgb8(255, 255, 255) : img.ColorRgba8(0, 0, 0, 0),
    );
    final resized = img.copyResize(
      mark,
      width: mark.width >= mark.height
          ? extent
          : (extent * mark.width / mark.height).round(),
      height: mark.height >= mark.width
          ? extent
          : (extent * mark.height / mark.width).round(),
      interpolation: img.Interpolation.cubic,
    );
    img.compositeImage(
      result,
      resized,
      dstX: (1024 - resized.width) ~/ 2,
      dstY: (1024 - resized.height) ~/ 2,
    );
    return result;
  }

  File(
    'assets/icons/launcher/machinery-3d.png',
  ).writeAsBytesSync(img.encodePng(canvas(800, true)));
  // 60% of the full adaptive layer fits inside Android's circular safe zone.
  File(
    'assets/icons/launcher/machinery-3d-foreground.png',
  ).writeAsBytesSync(img.encodePng(canvas(614, false)));
  final logo = canvas(960, false);
  File('assets/images/app_logo.png').writeAsBytesSync(img.encodePng(logo));
  void saveSized(String path, img.Image image, int size) {
    final file = File(path);
    file.parent.createSync(recursive: true);
    file.writeAsBytesSync(
      img.encodePng(
        img.copyResize(
          image,
          width: size,
          height: size,
          interpolation: img.Interpolation.cubic,
        ),
      ),
    );
  }

  for (final scale in [1, 2, 3]) {
    final suffix = scale == 1 ? '' : '@${scale}x';
    saveSized(
      'ios/Runner/Assets.xcassets/MachinerySplash.imageset/LaunchImage$suffix.png',
      logo,
      168 * scale,
    );
  }
  saveSized('android/app/src/main/res/drawable/splash_logo.png', logo, 168);
  for (final entry in {
    'mdpi': 1.0,
    'hdpi': 1.5,
    'xhdpi': 2.0,
    'xxhdpi': 3.0,
    'xxxhdpi': 4.0,
  }.entries) {
    saveSized(
      'android/app/src/main/res/drawable-${entry.key}/splash_logo.png',
      logo,
      (168 * entry.value).round(),
    );
    // Android 12 shows a 288dp icon canvas; keep the mark inside its 192dp safe circle.
    saveSized(
      'android/app/src/main/res/drawable-${entry.key}/splash_logo_android12.png',
      canvas(570, false),
      (288 * entry.value).round(),
    );
  }
}
