import './component-toolbar/component-toolbar.js';

import { WithDisposable } from '@blocksuite/lit';
import {
  type Bound,
  type ConnectorElement,
  deserializeXYWH,
  type PhasorElement,
  serializeXYWH,
  type SurfaceManager,
  TextElement,
} from '@blocksuite/phasor';
import { matchFlavours, type Page } from '@blocksuite/store';
import { autoUpdate, computePosition, flip, offset } from '@floating-ui/dom';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, query } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';

import type { IPoint } from '../../../std.js';
import type { EdgelessSelectionSlots } from '../edgeless-page-block.js';
import type {
  EdgelessSelectionState,
  Selectable,
} from '../selection-manager.js';
import {
  handleElementChangedEffectForConnector,
  isTopLevelBlock,
  NOTE_MIN_HEIGHT,
  NOTE_MIN_WIDTH,
  stopPropagation,
} from '../utils.js';
import type { EdgelessComponentToolbar } from './component-toolbar/component-toolbar.js';
import type { HandleDirection } from './resize-handles.js';
import { ResizeHandles, type ResizeMode } from './resize-handles.js';
import { HandleResizeManager } from './resize-manager.js';
import { SingleConnectorHandles } from './single-connector-handles.js';
import {
  // generateCursorUrl,
  // getCommonRectStyle,
  getSelectableBounds,
  getSelectedRect,
} from './utils.js';

@customElement('edgeless-selected-rect')
export class EdgelessSelectedRect extends WithDisposable(LitElement) {
  static override styles = css`
    :host {
      display: block;
      user-select: none;
    }

    .affine-edgeless-selected-rect {
      position: absolute;
      top: 0;
      left: 0;
      transform-origin: center;
      border-radius: 0;
      pointer-events: none;
      box-sizing: border-box;
      z-index: 1;
      border: var(--affine-border-width) solid var(--affine-blue);
      border-radius: 8px;
    }

    .affine-edgeless-selected-rect .handle {
      position: absolute;
      pointer-events: auto;
      user-select: none;
      outline: none;

      /**
       * Fix: pointerEvent stops firing after a short time.
       * When a gesture is started, the browser intersects the touch-action values of the touched element and its ancestors,
       * up to the one that implements the gesture (in other words, the first containing scrolling element)
       * https://developer.mozilla.org/en-US/docs/Web/CSS/touch-action
       */
      touchaction: none;
    }

    .affine-edgeless-selected-rect .handle[aria-label^='top-'],
    .affine-edgeless-selected-rect .handle[aria-label^='bottom-'] {
      width: 18px;
      height: 18px;
      box-sizing: border-box;
      z-index: 10;
      pointer-events: none;
    }

    .affine-edgeless-selected-rect .handle[aria-label^='top-'] .resize,
    .affine-edgeless-selected-rect .handle[aria-label^='bottom-'] .resize {
      position: absolute;
      width: 12px;
      height: 12px;
      box-sizing: border-box;
      border-radius: 50%;
      border: 2px var(--affine-blue) solid;
      background: white;
      pointer-events: auto;
    }
    .affine-edgeless-selected-rect .handle .resize.nwse {
      cursor: nwse-resize;
    }
    .affine-edgeless-selected-rect .handle .resize.nesw {
      cursor: nesw-resize;
    }
    .affine-edgeless-selected-rect .handle .resize.ew {
      cursor: ew-resize;
    }

    .affine-edgeless-selected-rect .handle[aria-label^='top-'] .rotate,
    .affine-edgeless-selected-rect .handle[aria-label^='bottom-'] .rotate {
      position: absolute;
      width: 12px;
      height: 12px;
      box-sizing: border-box;
      background: red;
      pointer-events: auto;
    }

    :host([disabled='true']) .affine-edgeless-selected-rect .handle {
      pointer-events: none;
    }

    /* -18 + 6.5 */
    .affine-edgeless-selected-rect .handle[aria-label='top-left'] {
      left: -12.5px;
      top: -12.5px;
    }
    .affine-edgeless-selected-rect .handle[aria-label='top-left'] .resize {
      right: 0;
      bottom: 0;
    }
    .affine-edgeless-selected-rect .handle[aria-label='top-left'] .rotate {
      right: 6px;
      bottom: 6px;
    }

    .affine-edgeless-selected-rect .handle[aria-label='top-right'] {
      top: -12.5px;
      right: -12.5px;
    }
    .affine-edgeless-selected-rect .handle[aria-label='top-right'] .resize {
      left: 0;
      bottom: 0;
    }
    .affine-edgeless-selected-rect .handle[aria-label='top-right'] .rotate {
      left: 6px;
      bottom: 6px;
    }

    .affine-edgeless-selected-rect .handle[aria-label='bottom-right'] {
      right: -12.5px;
      bottom: -12.5px;
    }
    .affine-edgeless-selected-rect .handle[aria-label='bottom-right'] .resize {
      left: 0;
      top: 0;
    }
    .affine-edgeless-selected-rect .handle[aria-label='bottom-right'] .rotate {
      left: 6px;
      top: 6px;
    }

    .affine-edgeless-selected-rect .handle[aria-label='bottom-left'] {
      bottom: -12.5px;
      left: -12.5px;
    }
    .affine-edgeless-selected-rect .handle[aria-label='bottom-left'] .resize {
      right: 0;
      top: 0;
    }
    .affine-edgeless-selected-rect .handle[aria-label='bottom-left'] .rotate {
      right: 6px;
      top: 6px;
    }

    .affine-edgeless-selected-rect .handle[aria-label='left'],
    .affine-edgeless-selected-rect .handle[aria-label='right'] {
      top: 0;
      bottom: 0;
      height: 100%;
      width: 6px;
      border: 0;
      background: transparent;
    }
    /* calc(-1px - (6px - 1px) / 2) = -3.5px */
    .affine-edgeless-selected-rect .handle[aria-label='left'] {
      left: -3.5px;
    }
    .affine-edgeless-selected-rect .handle[aria-label='right'] {
      right: -3.5px;
    }

    .affine-edgeless-selected-rect .handle[aria-label='left'] .resize,
    .affine-edgeless-selected-rect .handle[aria-label='right'] .resize {
      width: 100%;
      height: 100%;
    }

    .affine-edgeless-selected-rect .handle[aria-label='left'] .resize:after,
    .affine-edgeless-selected-rect .handle[aria-label='right'] .resize:after {
      position: absolute;
      width: 7px;
      height: 7px;
      box-sizing: border-box;
      border-radius: 6px;
      z-index: 10;
      border: 2px var(--affine-blue) solid;
      content: '';
      top: calc(50% - 6px);
      background: white;
    }

    /* calc((6px - 12px) / 2) = -3px */
    .affine-edgeless-selected-rect .handle[aria-label='left'] .resize:after {
      left: -3px;
    }
    .affine-edgeless-selected-rect .handle[aria-label='right'] .resize:after {
      right: -3px;
    }

    edgeless-component-toolbar {
      /* greater than handle */
      z-index: 11;
    }
  `;

  @property({ attribute: false })
  page!: Page;

  @property({ attribute: false })
  surface!: SurfaceManager;

  @property({ type: Object })
  state!: EdgelessSelectionState;

  @property({ attribute: false })
  slots!: EdgelessSelectionSlots;

  @query('.affine-edgeless-selected-rect')
  private _selectedRect!: HTMLDivElement;

  @query('edgeless-component-toolbar')
  private _componentToolbar?: EdgelessComponentToolbar;

  private _lock = false;
  private _resizeManager: HandleResizeManager;

  private _rotate = 0;

  constructor() {
    super();
    this._resizeManager = new HandleResizeManager(
      this._onDragMove,
      this._onDragRotate,
      this._onDragEnd
    );
    this.addEventListener('pointerdown', stopPropagation);
  }

  get zoom() {
    return this.surface.viewport.zoom;
  }

  get resizeMode(): ResizeMode {
    if (
      this.state.selected.length === 1 &&
      this.state.selected[0].type === 'connector'
    ) {
      return 'none';
    }
    const hasBlockElement = this.state.selected.find(isTopLevelBlock);
    return hasBlockElement ? 'edge' : 'corner';
  }

  private _onDragMove = (
    newBounds: Map<
      string,
      {
        bound: Bound;
        flip: IPoint;
      }
    >
  ) => {
    const { page, state, surface } = this;
    const selectedMap = new Map<string, Selectable>(
      state.selected.map(element => [element.id, element])
    );

    newBounds.forEach(({ bound, flip }, id) => {
      const element = selectedMap.get(id);
      if (!element) return;

      if (isTopLevelBlock(element)) {
        let noteX = bound.x;
        let noteY = bound.y;
        let noteW = bound.w;
        let noteH = deserializeXYWH(element.xywh)[3];
        // Limit the width of the selected note
        if (noteW < NOTE_MIN_WIDTH) {
          noteW = NOTE_MIN_WIDTH;
          noteX = bound.x;
        }
        // Limit the height of the selected note
        if (noteH < NOTE_MIN_HEIGHT) {
          noteH = NOTE_MIN_HEIGHT;
          noteY = bound.y;
        }
        page.updateBlock(element, {
          xywh: JSON.stringify([noteX, noteY, noteW, noteH]),
        });
      } else {
        if (element instanceof TextElement) {
          const p = bound.h / element.h;
          bound.w = element.w * p;
          surface.updateElement<'text'>(id, {
            xywh: serializeXYWH(bound.x, bound.y, bound.w, bound.h),
            fontSize: element.fontSize * p,
            flipX: flip.x,
            flipY: flip.y,
          });
        } else {
          surface.updateElement(id, {
            xywh: serializeXYWH(bound.x, bound.y, bound.w, bound.h),
            flipX: flip.x,
            flipY: flip.y,
          });
        }
      }
      handleElementChangedEffectForConnector(element, [element], surface, page);
    });

    this.requestUpdate();
  };

  private _onDragRotate = (center: IPoint, rotate: number) => {
    const {
      page,
      surface,
      state: { selected },
    } = this;
    const { x, y } = center;
    const matrix = new DOMMatrix()
      .translateSelf(x, y)
      .rotateSelf(rotate)
      .translateSelf(-x, -y);

    const elements = selected.filter(
      element => !isTopLevelBlock(element)
    ) as PhasorElement[];

    elements.forEach(element => {
      const { id, rotate: oldRotate = 0 } = element;
      const [x, y, w, h] = element.deserializeXYWH();
      const hw = w / 2;
      const hh = h / 2;
      // new center of element
      // const point = new DOMPoint(x + hw, y + hh).matrixTransform(matrix);
      const point = matrix.transformPoint(new DOMPoint(x + hw, y + hh));

      surface.updateElement(id, {
        xywh: serializeXYWH(point.x - hw, point.y - hh, w, h),
        rotate: oldRotate + rotate,
      });

      handleElementChangedEffectForConnector(element, [element], surface, page);
    });

    this._rotate = (this._rotate + rotate) % 360;
    this.requestUpdate();
  };

  private _onDragEnd = () => {
    if (this._lock) {
      this.page.captureSync();
    }
    this._lock = false;
    this.requestUpdate();
  };

  private _computeComponentToolbarPosition() {
    const componentToolbar = this._componentToolbar;
    if (!componentToolbar) return;

    computePosition(this._selectedRect, componentToolbar, {
      placement: 'top',
      middleware: [
        offset({
          mainAxis: 12,
        }),
        flip({
          fallbackPlacements: ['bottom'],
        }),
      ],
    }).then(({ x, y }) => {
      Object.assign(componentToolbar.style, {
        left: `${x}px`,
        top: `${y}px`,
      });
    });
  }

  override firstUpdated() {
    const { _disposables, slots } = this;
    _disposables.add(slots.viewportUpdated.on(() => this.requestUpdate()));
    _disposables.add(
      slots.pressShiftKeyUpdated.on(pressed =>
        this._resizeManager.onPressShiftKey(pressed)
      )
    );

    const componentToolbar = this._componentToolbar;
    if (!componentToolbar) return;

    autoUpdate(this._selectedRect, componentToolbar, () => {
      this._computeComponentToolbarPosition();
    });
  }

  override willUpdate(changedProperties: Map<string, unknown>) {
    if (changedProperties.has('state')) {
      const {
        state: { selected },
      } = this;
      if (selected.length === 1) {
        const element = selected[0];
        if (!isTopLevelBlock(element)) {
          this._rotate = element.rotate ?? 0;
          return;
        }
      }
      this._rotate = 0;
    }
  }

  override updated(changedProperties: Map<string, unknown>) {
    super.updated(changedProperties);
    // when viewport updates, popper should update too.
    this._computeComponentToolbarPosition();
  }

  override render() {
    const { state } = this;
    const { active, selected } = state;
    if (
      selected.length === 0 ||
      (active && selected[0] instanceof TextElement)
    ) {
      return nothing;
    }

    const isSingleHiddenNote =
      selected.length === 1 &&
      isTopLevelBlock(selected[0]) &&
      matchFlavours(selected[0], ['affine:note']) &&
      selected[0].hidden;

    const { page, surface, resizeMode, _resizeManager, _rotate, zoom } = this;
    const selectedRect = getSelectedRect(selected, surface.viewport);

    const style = {
      '--affine-border-width': `${active ? 2 : 1}px`,
      left: selectedRect.x + 'px',
      top: selectedRect.y + 'px',
      width: selectedRect.width + 'px',
      height: selectedRect.height + 'px',
      borderStyle: isSingleHiddenNote ? 'dashed' : 'solid',
    };

    const hasResizeHandles = !active && !page.readonly;
    const resizeHandles = hasResizeHandles
      ? ResizeHandles(
          resizeMode,
          (e: PointerEvent, direction: HandleDirection) => {
            const bounds = getSelectableBounds(selected);
            _resizeManager.onPointerDown(
              e,
              direction,
              bounds,
              resizeMode,
              zoom,
              _rotate
            );
          }
        )
      : nothing;

    const connectorHandles =
      selected.length === 1 && selected[0].type === 'connector'
        ? SingleConnectorHandles(
            selected[0] as ConnectorElement,
            this.surface,
            this.page,
            () => this.slots.selectionUpdated.emit({ ...state })
          )
        : nothing;

    const componentToolbar = active
      ? nothing
      : html`<edgeless-component-toolbar
          .selected=${selected}
          .page=${this.page}
          .surface=${this.surface}
          .slots=${this.slots}
          .selectionState=${state}
        >
        </edgeless-component-toolbar>`;

    return html`
      <div class="affine-edgeless-selected-rect" style=${styleMap(style)}>
        ${resizeHandles} ${connectorHandles}
      </div>
      ${componentToolbar}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'edgeless-selected-rect': EdgelessSelectedRect;
  }
}
