import 'dart:io';
import 'package:image/image.dart' as img;

/// Split the generated atlas and normalize transparent padding for small UI use.
void main() {
  final atlas = img.decodePng(
    File('assets/icons/three_d/source-atlas.png').readAsBytesSync(),
  )!;
  const names = [
    'home',
    'machines',
    'transfers',
    'merchants',
    'finance',
    'more',
    'reports',
    'violations',
    'myViolations',
    'maintenance',
    'checklist',
    'users',
    'branches',
    'models',
    'notifications',
    'sync',
    'language',
    'password',
    'logout',
    'profile',
  ];
  for (var i = 0; i < names.length; i++) {
    final x = (i % 4 * atlas.width / 4).round();
    // Measured gutters in the generated atlas; rows are not exactly uniform.
    const rowEdges = [0, 280, 510, 750, 980, 1254];
    final y = (rowEdges[i ~/ 4] * atlas.height / 1254).round();
    final cell = img.copyCrop(
      atlas,
      x: x,
      y: y,
      width: ((i % 4 + 1) * atlas.width / 4).round() - x,
      height: (rowEdges[i ~/ 4 + 1] * atlas.height / 1254).round() - y,
    );
    var left = cell.width, top = cell.height, right = 0, bottom = 0;
    for (final pixel in cell) {
      if (pixel.a > 16) {
        if (pixel.x < left) left = pixel.x;
        if (pixel.y < top) top = pixel.y;
        if (pixel.x > right) right = pixel.x;
        if (pixel.y > bottom) bottom = pixel.y;
      }
    }
    if (right < left || bottom < top)
      throw StateError('Empty icon: ${names[i]}');
    final mark = img.copyCrop(
      cell,
      x: left,
      y: top,
      width: right - left + 1,
      height: bottom - top + 1,
    );
    final resized = img.copyResize(
      mark,
      width: mark.width >= mark.height
          ? 232
          : (232 * mark.width / mark.height).round(),
      height: mark.height >= mark.width
          ? 232
          : (232 * mark.height / mark.width).round(),
      interpolation: img.Interpolation.cubic,
    );
    final canvas = img.Image(width: 256, height: 256, numChannels: 4);
    img.compositeImage(
      canvas,
      resized,
      dstX: (256 - resized.width) ~/ 2,
      dstY: (256 - resized.height) ~/ 2,
    );
    File(
      'assets/icons/three_d/${names[i]}.png',
    ).writeAsBytesSync(img.encodePng(canvas));
  }
}
