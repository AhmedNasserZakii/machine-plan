import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/core/theme/styles/app_text_styles.dart';

/// Captures a finger-drawn signature and hands back a PNG.
///
/// Deliberately hand-rolled rather than pulled from a package: the only thing
/// needed is a list of points and a `CustomPainter`, and the whole widget is
/// smaller than the dependency would be.
///
/// The strokes are kept in logical coordinates and rasterised once on demand,
/// which is why rotating the phone mid-signature does not corrupt what has been
/// drawn so far.
class SignaturePad extends StatefulWidget {
  const SignaturePad({required this.controller, this.height = 180, super.key});

  final SignaturePadController controller;
  final double height;

  @override
  State<SignaturePad> createState() => _SignaturePadState();
}

class SignaturePadController extends ChangeNotifier {
  /// Below this, in either dimension, a bounding box reads as an accidental
  /// tap or a stray dot rather than an actual signature — a real signature
  /// swipes across a meaningful fraction of the pad.
  static const double _minSignatureExtent = 24;

  final List<List<Offset>> _strokes = <List<Offset>>[];
  Size _size = Size.zero;

  bool get isEmpty => _strokes.isEmpty;

  /// Whether what is drawn is worth keeping — not just non-empty, but large
  /// enough to be a real signature rather than a dot or a slip of the thumb.
  bool get hasContent {
    final Rect? box = _boundingBox();
    if (box == null) return false;
    return box.width >= _minSignatureExtent ||
        box.height >= _minSignatureExtent;
  }

  void clear() {
    if (_strokes.isEmpty) return;

    _strokes.clear();
    notifyListeners();
  }

  /// Removes only the last stroke, so a slip near the end does not cost the
  /// whole signature.
  void undo() {
    if (_strokes.isEmpty) return;

    _strokes.removeLast();
    notifyListeners();
  }

  /// Rasterises what has been drawn, cropped to the strokes' own bounding box
  /// (plus a small margin) rather than the whole pad, and capped at 600
  /// logical pixels wide — this is a signature, not a poster, and a receiver
  /// on a slow connection still has to download it.
  ///
  /// Returns null for anything that fails [hasContent]: an empty pad, a
  /// single stray dot, or a mark too small to be a real signature.
  Future<Uint8List?> toPngBytes() async {
    if (_size == Size.zero || !hasContent) return null;

    final Rect box = _boundingBox()!;
    const double margin = 16;
    final Rect crop = Rect.fromLTRB(
      (box.left - margin).clamp(0, _size.width),
      (box.top - margin).clamp(0, _size.height),
      (box.right + margin).clamp(0, _size.width),
      (box.bottom + margin).clamp(0, _size.height),
    );

    const double baseScale = 2;
    const double maxWidth = 600;
    final double scale = crop.width * baseScale > maxWidth
        ? maxWidth / crop.width
        : baseScale;

    final ui.PictureRecorder recorder = ui.PictureRecorder();
    final Canvas canvas = Canvas(recorder)
      ..scale(scale)
      ..translate(-crop.left, -crop.top);

    // A white ground, not transparency: this ends up on a document, and a
    // transparent signature disappears against a dark viewer.
    canvas.drawRect(
      Rect.fromLTWH(crop.left, crop.top, crop.width, crop.height),
      Paint()..color = const Color(0xFFFFFFFF),
    );

    _SignaturePainter(_strokes, const Color(0xFF101828)).paint(canvas, _size);

    final ui.Image image = await recorder.endRecording().toImage(
      (crop.width * scale).round(),
      (crop.height * scale).round(),
    );

    final ByteData? data = await image.toByteData(
      format: ui.ImageByteFormat.png,
    );

    return data?.buffer.asUint8List();
  }

  Rect? _boundingBox() {
    double? minX, minY, maxX, maxY;

    for (final List<Offset> stroke in _strokes) {
      for (final Offset point in stroke) {
        minX = minX == null ? point.dx : (point.dx < minX ? point.dx : minX);
        minY = minY == null ? point.dy : (point.dy < minY ? point.dy : minY);
        maxX = maxX == null ? point.dx : (point.dx > maxX ? point.dx : maxX);
        maxY = maxY == null ? point.dy : (point.dy > maxY ? point.dy : maxY);
      }
    }

    if (minX == null) return null;
    return Rect.fromLTRB(minX, minY!, maxX!, maxY!);
  }

  void _begin(Offset point) {
    _strokes.add(<Offset>[point]);
    notifyListeners();
  }

  void _extend(Offset point) {
    if (_strokes.isEmpty) return;

    _strokes.last.add(point);
    notifyListeners();
  }
}

class _SignaturePadState extends State<SignaturePad> {
  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        Row(
          children: <Widget>[
            Expanded(
              child: Text(
                LocaleKeys.transferSignatureHint.tr(),
                style: Styles.s12(
                  context,
                ).copyWith(color: AppColors.textSecondaryColor),
              ),
            ),
            AnimatedBuilder(
              animation: widget.controller,
              builder: (BuildContext context, Widget? _) {
                return TextButton(
                  onPressed: widget.controller.isEmpty
                      ? null
                      : widget.controller.undo,
                  child: Text(LocaleKeys.transferSignatureUndo.tr()),
                );
              },
            ),
            TextButton(
              onPressed: widget.controller.clear,
              child: Text(LocaleKeys.transferSignatureClear.tr()),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.sm),
        Semantics(
          identifier: 'signature_pad',
          child: LayoutBuilder(
            builder: (BuildContext context, BoxConstraints constraints) {
              final Size size = Size(constraints.maxWidth, widget.height);
              widget.controller._size = size;

              return GestureDetector(
                onPanStart: (DragStartDetails details) =>
                    widget.controller._begin(details.localPosition),
                onPanUpdate: (DragUpdateDetails details) =>
                    widget.controller._extend(details.localPosition),
                child: Container(
                  key: const Key('signature_pad_canvas'),
                  height: widget.height,
                  decoration: BoxDecoration(
                    color: AppColors.surfaceColor,
                    borderRadius: BorderRadius.circular(AppRadius.md),
                    border: Border.all(color: AppColors.borderColor),
                  ),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(AppRadius.md),
                    child: AnimatedBuilder(
                      animation: widget.controller,
                      builder: (BuildContext context, Widget? _) {
                        return CustomPaint(
                          size: size,
                          painter: _SignaturePainter(
                            widget.controller._strokes,
                            AppColors.textPrimaryColor,
                          ),
                        );
                      },
                    ),
                  ),
                ),
              );
            },
          ),
        ),
      ],
    );
  }
}

class _SignaturePainter extends CustomPainter {
  const _SignaturePainter(this.strokes, this.color);

  final List<List<Offset>> strokes;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final Paint brush = Paint()
      ..color = color
      ..strokeWidth = 2.5
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round
      ..style = PaintingStyle.stroke;

    for (final List<Offset> stroke in strokes) {
      if (stroke.length == 1) {
        // A single tap is a dot, not nothing — people sign with them.
        canvas.drawPoints(ui.PointMode.points, stroke, brush);
        continue;
      }

      final Path path = Path()..moveTo(stroke.first.dx, stroke.first.dy);
      for (final Offset point in stroke.skip(1)) {
        path.lineTo(point.dx, point.dy);
      }

      canvas.drawPath(path, brush);
    }
  }

  @override
  bool shouldRepaint(_SignaturePainter oldDelegate) => true;
}
