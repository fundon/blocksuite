import { Bound } from '@blocksuite/phasor';
import { getCommonBound } from '@blocksuite/phasor';
import { assertExists } from '@blocksuite/store';

import type { IPoint } from '../../../std.js';
import { HandleDirection, type ResizeMode } from './resize-handles.js';

type ResizeMoveHandler = (
  bounds: Map<
    string,
    {
      bound: Bound;
      flip: IPoint;
    }
  >
) => void;

type RotateMoveHandler = (point: IPoint, rotate: number) => void;

type ResizeEndHandler = () => void;

export class HandleResizeManager {
  private _onResizeMove: ResizeMoveHandler;
  private _onRotateMove: RotateMoveHandler;
  private _onResizeEnd: ResizeEndHandler;

  private _dragDirection: HandleDirection = HandleDirection.Left;
  private _dragPos: {
    start: { x: number; y: number };
    end: { x: number; y: number };
  } = {
    start: { x: 0, y: 0 },
    end: { x: 0, y: 0 },
  };

  private _bounds = new Map<
    string,
    {
      bound: Bound;
      flip: IPoint;
    }
  >();
  /** Use [minX, minY, maxX, maxY] for convenience */
  private _commonBound = [0, 0, 0, 0];

  private _aspectRatio = 1;
  private _resizeMode = 'none';
  private _zoom = 1;

  private _shiftKey = false;

  private _rotate = 0;
  private _rotated = false;

  private _target: HTMLElement | null = null;

  constructor(
    onResizeMove: ResizeMoveHandler,
    onRotateMove: RotateMoveHandler,
    onResizeEnd: ResizeEndHandler
  ) {
    this._onResizeMove = onResizeMove;
    this._onRotateMove = onRotateMove;
    this._onResizeEnd = onResizeEnd;
  }

  // TODO: move to vec2
  private _onResize(shift = false) {
    const {
      _aspectRatio: aspectRatio,
      _dragDirection: direction,
      _dragPos: dragPos,
      _rotate: rotate,
      _resizeMode,
      _zoom,
      _commonBound,
      _target,
    } = this;

    assertExists(_target);

    const isCorner = _resizeMode === 'corner';
    const {
      start: { x: startX, y: startY },
      end: { x: endX, y: endY },
    } = dragPos;

    const [minX, minY, maxX, maxY] = _commonBound;
    const original = {
      w: maxX - minX,
      h: maxY - minY,
      cx: (minX + maxX) / 2,
      cy: (minY + maxY) / 2,
    };
    const rect = { ...original };
    const arrow = { x: 1, y: 1 };
    const scale = { x: 1, y: 1 };
    const flip = { x: 1, y: 1 };
    const fixedPoint = new DOMPoint(0, 0);
    const draggingPoint = new DOMPoint(0, 0);

    const deltaX = (endX - startX) / _zoom;

    const m0 = new DOMMatrix()
      .translateSelf(original.cx, original.cy)
      .rotateSelf(rotate)
      .translateSelf(-original.cx, -original.cy);

    if (isCorner) {
      switch (direction) {
        case HandleDirection.TopLeft: {
          arrow.x = -1;
          arrow.y = -1;
          fixedPoint.x = maxX;
          fixedPoint.y = maxY;
          draggingPoint.x = minX;
          draggingPoint.y = minY;
          break;
        }
        case HandleDirection.TopRight: {
          arrow.x = 1;
          arrow.y = -1;
          fixedPoint.x = minX;
          fixedPoint.y = maxY;
          draggingPoint.x = maxX;
          draggingPoint.y = minY;
          break;
        }
        case HandleDirection.BottomRight: {
          arrow.x = 1;
          arrow.y = 1;
          fixedPoint.x = minX;
          fixedPoint.y = minY;
          draggingPoint.x = maxX;
          draggingPoint.y = maxY;
          break;
        }
        case HandleDirection.BottomLeft: {
          arrow.x = -1;
          arrow.y = 1;
          fixedPoint.x = maxX;
          fixedPoint.y = minY;
          draggingPoint.x = minX;
          draggingPoint.y = maxY;
          break;
        }
      }

      // forced adjustment by aspect ratio
      // shift ||= this._bounds.size > 1;
      const deltaY = (endY - startY) / _zoom;
      const fp = fixedPoint.matrixTransform(m0);
      let dp = draggingPoint.matrixTransform(m0);

      dp.x += deltaX;
      dp.y += deltaY;

      const cx = (fp.x + dp.x) / 2;
      const cy = (fp.y + dp.y) / 2;

      const m1 = new DOMMatrix()
        .translateSelf(cx, cy)
        .rotateSelf(-rotate)
        .translateSelf(-cx, -cy);

      const f = fp.matrixTransform(m1);
      const d = dp.matrixTransform(m1);

      switch (direction) {
        case HandleDirection.TopLeft: {
          rect.w = f.x - d.x;
          rect.h = f.y - d.y;
          break;
        }
        case HandleDirection.TopRight: {
          rect.w = d.x - f.x;
          rect.h = f.y - d.y;
          break;
        }
        case HandleDirection.BottomRight: {
          rect.w = d.x - f.x;
          rect.h = d.y - f.y;
          break;
        }
        case HandleDirection.BottomLeft: {
          rect.w = f.x - d.x;
          rect.h = d.y - f.y;
          break;
        }
      }

      rect.cx = (d.x + f.x) / 2;
      rect.cy = (d.y + f.y) / 2;
      scale.x = rect.w / original.w;
      scale.y = rect.h / original.h;
      flip.x = scale.x < 0 ? -1 : 1;
      flip.y = scale.y < 0 ? -1 : 1;

      if (shift) {
        const newAspectRatio = Math.abs(rect.w / rect.h);
        if (aspectRatio < newAspectRatio) {
          scale.y = Math.abs(scale.x) * flip.y;
          rect.h = scale.y * original.h;
        } else {
          scale.x = Math.abs(scale.y) * flip.x;
          rect.w = scale.x * original.w;
        }
        draggingPoint.x = fixedPoint.x + rect.w * arrow.x;
        draggingPoint.y = fixedPoint.y + rect.h * arrow.y;

        dp = draggingPoint.matrixTransform(m0);

        rect.cx = (fp.x + dp.x) / 2;
        rect.cy = (fp.y + dp.y) / 2;
      }
    } else {
      switch (direction) {
        case HandleDirection.Left:
          rect.w = maxX - minX - deltaX;
          fixedPoint.x = maxX;
          break;
        case HandleDirection.Right:
          rect.w = maxX - minX + deltaX;
          fixedPoint.x = minX;
          break;
      }

      scale.x = rect.w / original.w;
      flip.x = scale.x < 0 ? -1 : 1;
    }

    const { x: flipX, y: flipY } = flip;

    const newBounds = new Map<
      string,
      {
        bound: Bound;
        flip: IPoint;
      }
    >();

    // TODO: on same rotate
    if (isCorner && this._bounds.size === 1) {
      this._bounds.forEach(({ flip }, id) => {
        const width = Math.abs(rect.w);
        const height = Math.abs(rect.h);

        newBounds.set(id, {
          bound: new Bound(
            rect.cx - width / 2,
            rect.cy - height / 2,
            width,
            height
          ),
          flip: {
            x: flipX * flip.x,
            y: flipY * flip.y,
          },
        });
      });

      this._onResizeMove(newBounds);
      return;
    }

    const m2 = new DOMMatrix().scaleSelf(
      scale.x,
      scale.y,
      1,
      fixedPoint.x,
      fixedPoint.y,
      0
    );

    this._bounds.forEach(({ bound: { x, y, w, h }, flip }, id) => {
      const cx = x + w / 2;
      const cy = y + h / 2;
      const center = new DOMPoint(cx, cy).matrixTransform(m2);
      const newWidth = Math.abs(w * scale.x);
      const newHeight = Math.abs(h * scale.y);

      newBounds.set(id, {
        bound: new Bound(
          center.x - newWidth / 2,
          center.y - newHeight / 2,
          newWidth,
          newHeight
        ),
        flip: {
          x: flipX * flip.x,
          y: flipY * flip.y,
        },
      });
    });

    this._onResizeMove(newBounds);
  }

  private _onRotate(x: number, y: number, shift = false) {
    const {
      _commonBound: [minX, minY, maxX, maxY],
      _dragPos: {
        start: { x: startX, y: startY },
        end: { x: centerX, y: centerY },
      },
    } = this;

    // start radius, end radius, diff radius
    const sr = Math.atan2(startY - centerY, startX - centerX);
    const er = Math.atan2(y - centerY, x - centerX);
    const dr = ((er - sr) * 180) / Math.PI;

    this._onRotateMove(
      // center of element in suface
      { x: (minX + maxX) / 2, y: (minY + maxY) / 2 },
      dr
    );

    this._dragPos.start = { x, y };
  }

  onPointerDown = (
    e: PointerEvent,
    direction: HandleDirection,
    bounds: Map<
      string,
      {
        bound: Bound;
        flip: IPoint;
      }
    >,
    resizeMode: ResizeMode,
    zoom: number,
    rotate: number
  ) => {
    // Prevent selection action from being triggered
    e.stopPropagation();

    this._target = e.target as HTMLElement;

    this._bounds = bounds;

    const { x, y, w, h } = getCommonBound([
      ...Array.from(bounds.values()).map(value => value.bound),
    ]) as Bound;
    this._commonBound = [x, y, x + w, y + h];

    this._dragDirection = direction;
    this._dragPos.start = { x: e.x, y: e.y };
    this._dragPos.end = { x: e.x, y: e.y };
    this._aspectRatio = w / h;
    this._resizeMode = resizeMode;
    this._zoom = zoom;
    this._rotate = rotate;

    this._rotated = this._target.classList.contains('rotate');
    // console.log(this._rotated);

    if (this._rotated) {
      const rect = document
        .querySelector('edgeless-selected-rect')
        ?.shadowRoot?.querySelector('.affine-edgeless-selected-rect')
        ?.getBoundingClientRect();
      assertExists(rect);
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      // center of `selected-rect` in viewport
      this._dragPos.end = { x, y };
    }

    const _onPointerMove = ({ x, y, shiftKey }: PointerEvent) => {
      if (resizeMode === 'none') return;

      this._shiftKey ||= shiftKey;

      if (this._rotated) {
        this._onRotate(x, y, this._shiftKey);
        return;
      }

      this._dragPos.end = { x, y };

      this._onResize(this._shiftKey);
    };

    const _onPointerUp = (_: PointerEvent) => {
      this._onResizeEnd();

      this._bounds.clear();
      this._dragPos = { start: { x: 0, y: 0 }, end: { x: 0, y: 0 } };
      this._commonBound = [0, 0, 0, 0];
      this._rotate = 0;
      this._target = null;

      document.removeEventListener('pointermove', _onPointerMove);
      document.removeEventListener('pointerup', _onPointerUp);
    };
    document.addEventListener('pointermove', _onPointerMove);
    document.addEventListener('pointerup', _onPointerUp);
  };

  onPressShiftKey(pressed: boolean) {
    if (this._shiftKey === pressed) return;
    this._shiftKey = pressed;

    if (this._rotated) {
      const { x, y } = this._dragPos.end;
      this._onRotate(x, y, this._shiftKey);
      return;
    }

    this._onResize(this._shiftKey);
  }
}
