import type { RoughCanvas } from 'roughjs/bin/canvas.js';

import { type IBound, StrokeStyle } from '../../../consts.js';
import { Bound } from '../../../utils/bound.js';
import {
  linePolygonIntersects,
  pointInPolygon,
} from '../../../utils/math-utils.js';
import { type IVec } from '../../../utils/vec.js';
import type { HitTestOptions } from '../../surface-element.js';
import type { ShapeElement } from '../shape-element.js';
import type { ShapeMethods } from '../types.js';

export const TriangleMethods: ShapeMethods = {
  render(
    ctx: CanvasRenderingContext2D,
    matrix: DOMMatrix,
    rc: RoughCanvas,
    element: ShapeElement
  ) {
    const {
      seed,
      strokeWidth,
      filled,
      realFillColor,
      realStrokeColor,
      strokeStyle,
      roughness,
      matrix: localMatrix,
      widthAndHeight: [w, h],
    } = element;

    const renderOffset = Math.max(strokeWidth, 0) / 2;
    const renderWidth = w - renderOffset * 2;
    const renderHeight = h - renderOffset * 2;
    const cx = w / 2;
    const cy = h / 2;

    ctx.setTransform(
      matrix
        .translateSelf(cx, cy)
        .multiplySelf(new DOMMatrix(localMatrix))
        .translateSelf(-cx, -cy)
    );

    rc.polygon(
      [
        [renderWidth / 2, 0],
        [renderWidth, renderHeight],
        [0, renderHeight],
      ],
      {
        seed,
        roughness,
        strokeLineDash:
          strokeStyle === StrokeStyle.Dashed ? [12, 12] : undefined,
        stroke: realStrokeColor,
        strokeWidth,
        fill: filled ? realFillColor : undefined,
      }
    );
  },

  hitTest(x: number, y: number, bound: IBound, options?: HitTestOptions) {
    const points = [
      [bound.x + bound.w / 2, bound.y + 0],
      [bound.x + bound.w, bound.y + bound.h],
      [bound.x + 0, bound.y + bound.h],
    ];
    return pointInPolygon([x, y], points);
  },

  intersectWithLine(start: IVec, end: IVec, element: ShapeElement): boolean {
    const bound = Bound.deserialize(element.xywh);
    const { x, y, w, h } = bound;

    return !!linePolygonIntersects(start, end, [
      [x + w / 2, 0 + y],
      [x + w, h + y],
      [x + 0, h + y],
    ]);
  },
};
