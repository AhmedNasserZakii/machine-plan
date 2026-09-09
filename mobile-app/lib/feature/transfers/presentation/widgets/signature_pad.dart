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
  final List<List<Offset>> _strokes = <List<Offset>>[];
  Size _size = Size.zero;

  bool get isEmpty => _strokes.isEmpty;

  void clear() {
    if (_strokes.isEmpty) return;

    _strokes.clear();
    notifyListeners();
  }

  /// Rasterises what has been drawn, at 2× for a legible signature on a
  /// printed hand-over sheet.
  Future<Uint8List?> toPngBytes() async {
    if (_strokes.isEmpty || _size == Size.zero) return null;

    const double scale = 2;
    final ui.PictureRecorder recorder = ui.PictureRecorder();
    final Canvas canvas = Canvas(recorder)..scale(scale);

    // A white ground, not transparency: this ends up on a document, and a
    // transparent signature disappears against a dark viewer.
    canvas.drawRect(
      Rect.fromLTWH(0, 0, _size.width, _size.height),
      Paint()..color = const Color(0xFFFFFFFF),
    );

    _SignaturePainter(_strokes, const Color(0xFF101828)).paint(canvas, _size);

    final ui.Image image = await recorder.endRecording().toImage(
      (_size.width * scale).round(),
      (_size.height * scale).round(),
    );

    final ByteData? data = await image.toByteData(
      format: ui.ImageByteFormat.png,
    );

    return data?.buffer.asUint8List();
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
