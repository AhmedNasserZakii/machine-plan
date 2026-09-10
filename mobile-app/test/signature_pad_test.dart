import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:machinery/feature/transfers/presentation/widgets/signature_pad.dart';

/// `toPngBytes` is the boundary every caller trusts to answer "is this a real
/// signature" — a receiver or sender never gets to submit a blank or an
/// accidental tap, and the image it does produce must not blow past what a
/// signature is worth. Exercised through the real widget rather than the
/// controller alone, since the size the crop math needs only exists once the
/// pad has laid out.
///
/// Returns the drawable box itself, not the whole column (which also carries
/// the hint text and the clear/undo buttons above it) — gestures must land
/// inside the actual `CustomPaint` for the controller to see them.
Future<Rect> _pumpPad(
  WidgetTester tester,
  SignaturePadController controller,
) async {
  await tester.pumpWidget(
    MaterialApp(home: Scaffold(body: SignaturePad(controller: controller))),
  );

  return tester.getRect(find.byKey(const Key('signature_pad_canvas')));
}

/// A point inside [pad] at the given fraction of its width/height.
Offset _at(Rect pad, double fx, double fy) =>
    pad.topLeft + Offset(pad.width * fx, pad.height * fy);

Future<void> _drag(WidgetTester tester, Offset from, Offset to) async {
  final TestGesture gesture = await tester.startGesture(from);
  await gesture.moveTo(Offset.lerp(from, to, 0.5)!);
  await gesture.moveTo(to);
  await gesture.up();
  await tester.pump();
}

/// `toImage`/`toByteData` and `instantiateImageCodec` are real, thread-backed
/// async work, not fake-clock futures — `WidgetTester`'s test zone never
/// completes them on its own, hence `runAsync`.
Future<Uint8List?> _png(WidgetTester tester, SignaturePadController controller) {
  return tester.runAsync<Uint8List?>(controller.toPngBytes);
}

Future<ui.Image> _decode(WidgetTester tester, Uint8List bytes) async {
  return (await tester.runAsync<ui.Image>(() async {
    final ui.Codec codec = await ui.instantiateImageCodec(bytes);
    final ui.FrameInfo frame = await codec.getNextFrame();
    return frame.image;
  }))!;
}

void main() {
  testWidgets('an untouched pad produces nothing to submit', (tester) async {
    final SignaturePadController controller = SignaturePadController();
    await _pumpPad(tester, controller);

    expect(controller.hasContent, isFalse);
    expect(await _png(tester, controller), isNull);
  });

  testWidgets('a single tap is too small to count as a signature', (
    tester,
  ) async {
    final SignaturePadController controller = SignaturePadController();
    final Rect pad = await _pumpPad(tester, controller);

    await _drag(
      tester,
      _at(pad, 0.5, 0.5),
      _at(pad, 0.5, 0.5) + const Offset(2, 1),
    );

    expect(controller.hasContent, isFalse);
    expect(await _png(tester, controller), isNull);
  });

  testWidgets('a real stroke is accepted and cropped to its own bounds', (
    tester,
  ) async {
    final SignaturePadController controller = SignaturePadController();
    final Rect pad = await _pumpPad(tester, controller);

    await _drag(tester, _at(pad, 0.2, 0.3), _at(pad, 0.4, 0.7));

    expect(controller.hasContent, isTrue);

    final Uint8List? png = await _png(tester, controller);
    expect(png, isNotNull);

    // Cropped to the stroke plus a small margin, not rasterised at the size
    // of the whole (much wider) pad.
    final ui.Image image = await _decode(tester, png!);
    expect(image.width, lessThan(pad.width.round()));
  });

  testWidgets('the rasterised width never exceeds the 600px cap', (
    tester,
  ) async {
    final SignaturePadController controller = SignaturePadController();
    final Rect pad = await _pumpPad(tester, controller);

    // A stroke spanning almost the entire width of a wide pad — at 2x scale
    // this would exceed 600px without the cap.
    await _drag(tester, _at(pad, 0.02, 0.5), _at(pad, 0.98, 0.5));

    final Uint8List? png = await _png(tester, controller);
    expect(png, isNotNull);

    final ui.Image image = await _decode(tester, png!);
    expect(image.width, lessThanOrEqualTo(600));
  });

  testWidgets('undo drops only the last stroke; clear drops all of them', (
    tester,
  ) async {
    final SignaturePadController controller = SignaturePadController();
    final Rect pad = await _pumpPad(tester, controller);

    await _drag(tester, _at(pad, 0.2, 0.2), _at(pad, 0.3, 0.3));
    await _drag(tester, _at(pad, 0.6, 0.6), _at(pad, 0.8, 0.8));

    expect(controller.isEmpty, isFalse);
    final Uint8List? withBoth = await _png(tester, controller);

    controller.undo();
    expect(controller.isEmpty, isFalse);
    final Uint8List? withOne = await _png(tester, controller);
    expect(withOne, isNotNull);
    // Removing a stroke shrinks (or at least does not grow) what is left to
    // rasterise.
    expect(withOne!.length, lessThanOrEqualTo(withBoth!.length));

    controller.undo();
    expect(controller.isEmpty, isTrue);
    expect(await _png(tester, controller), isNull);

    // undo on an already-empty pad is a no-op, not an error.
    controller.undo();
    expect(controller.isEmpty, isTrue);
  });

  testWidgets('clear removes every stroke at once', (tester) async {
    final SignaturePadController controller = SignaturePadController();
    final Rect pad = await _pumpPad(tester, controller);

    await _drag(tester, _at(pad, 0.2, 0.2), _at(pad, 0.5, 0.5));
    expect(controller.isEmpty, isFalse);

    controller.clear();
    expect(controller.isEmpty, isTrue);
    expect(controller.hasContent, isFalse);
  });
}
