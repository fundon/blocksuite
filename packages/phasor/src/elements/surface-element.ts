import type { RoughCanvas } from 'roughjs/bin/canvas.js';
import type * as Y from 'yjs';

import type { IVec } from '../index.js';
import type { Renderer } from '../renderer.js';
import type { SurfaceManager } from '../surface.js';
import { decomposeMatrix, isPointIn } from '../utils/math-utils.js';
import {
  deserializeXYWH,
  type SerializedXYWH,
  type XYWH,
} from '../utils/xywh.js';

export interface ISurfaceElement {
  id: string;
  type: string;
  xywh: SerializedXYWH;
  index: string;
  seed: number;

  matrix: number[];
}

export interface HitTestOptions {
  expandStroke: boolean;
  fillHollow: boolean;
}

export type ComputedValue = (value: string) => string;

export abstract class SurfaceElement<
  T extends ISurfaceElement = ISurfaceElement
> {
  abstract intersectWithLine(start: IVec, end: IVec): boolean;

  yMap: Y.Map<unknown>;

  protected renderer: Renderer | null = null;

  computedValue: ComputedValue = v => v;

  constructor(
    yMap: Y.Map<unknown>,
    protected surface: SurfaceManager,
    data: Partial<T> = {}
  ) {
    if (!yMap.doc) {
      throw new Error('yMap must be bound to a Y.Doc');
    }

    this.yMap = yMap;
    for (const key in data) {
      this.yMap.set(key, data[key] as T[keyof T]);
    }

    this.surface = surface;
  }

  get id() {
    const id = this.yMap.get('id') as T['id'];
    return id;
  }

  get index() {
    const index = this.yMap.get('index') as T['index'];
    return index;
  }

  get type() {
    const type = this.yMap.get('type') as T['type'];
    return type;
  }

  get xywh() {
    const xywh = this.yMap.get('xywh') as T['xywh'];
    return xywh;
  }

  get seed() {
    const seed = this.yMap.get('seed') as T['seed'];
    return seed;
  }

  get matrix() {
    const matrix = this.yMap.get('matrix') as T['matrix'];
    return matrix;
  }

  get rotate() {
    const { matrix } = this;
    return matrix ? decomposeMatrix(matrix).rotate : 0;
  }

  get flipX() {
    const { matrix } = this;
    return matrix ? decomposeMatrix(matrix).flipX : 1;
  }

  get flipY() {
    const { matrix } = this;
    return matrix ? decomposeMatrix(matrix).flipY : 1;
  }

  get x() {
    const [x] = this.deserializeXYWH();
    return x;
  }

  get y() {
    const [, y] = this.deserializeXYWH();
    return y;
  }

  get w() {
    const [, , w] = this.deserializeXYWH();
    return w;
  }

  get h() {
    const [, , , h] = this.deserializeXYWH();
    return h;
  }

  get widthAndHeight() {
    const [, , w, h] = this.deserializeXYWH();
    return [w, h];
  }

  get localRecord() {
    return this.surface.getElementLocalRecord(this.id);
  }

  applyUpdate(updates: Partial<T>) {
    for (const key in updates) {
      this.yMap.set(key, updates[key] as T[keyof T]);
    }
  }

  deserializeXYWH(): XYWH {
    return deserializeXYWH(this.xywh);
  }

  serialize(): T {
    return this.yMap.toJSON() as T;
  }

  hitTest(x: number, y: number, options?: HitTestOptions) {
    return isPointIn(this, x, y);
  }

  private _onMap = () => {
    this.renderer?.removeElement(this);
    this.renderer?.addElement(this);
  };

  mount(renderer: Renderer) {
    this.renderer = renderer;
    this.renderer.addElement(this);
    this.yMap.observeDeep(this._onMap);
  }

  unmount() {
    this.yMap.unobserveDeep(this._onMap);
    this.renderer?.removeElement(this);
    this.renderer = null;
  }

  render(ctx: CanvasRenderingContext2D, matrix: DOMMatrix, rc: RoughCanvas) {
    return;
  }
}
