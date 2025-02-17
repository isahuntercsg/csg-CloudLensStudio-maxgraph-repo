/*
Copyright 2021-present The maxGraph project Contributors
Copyright (c) 2006-2015, JGraph Ltd
Copyright (c) 2006-2015, Gaudenz Alder

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import { getValue } from '../../util/Utils';
import { getNumber } from '../../util/StringUtils';
import {
  contains,
  getBoundingBox,
  getPortConstraints,
  reversePortConstraints,
} from '../../util/mathUtils';
import Point from '../geometry/Point';
import CellState from '../cell/CellState';
import {
  DEFAULT_MARKERSIZE,
  DIRECTION,
  DIRECTION_MASK,
  ELBOW,
  ENTITY_SEGMENT,
  NONE,
} from '../../util/Constants';
import Rectangle from '../geometry/Rectangle';
import Geometry from '../geometry/Geometry';

/**
 * Provides various edge styles to be used as the values for
 * <'edge'> in a cell style.
 *
 * Example:
 *
 * ```javascript
 * let style = stylesheet.getDefaultEdgeStyle();
 * style.edge = mxEdgeStyle.ElbowConnector;
 * ```
 *
 * Sets the default edge style to <ElbowConnector>.
 *
 * Custom edge style:
 *
 * To write a custom edge style, a function must be added to the mxEdgeStyle
 * object as follows:
 *
 * ```javascript
 * mxEdgeStyle.MyStyle = (state, source, target, points, result)=>
 * {
 *   if (source != null && target != null)
 *   {
 *     let pt = new mxPoint(target.getCenterX(), source.getCenterY());
 *
 *     if (mxUtils.contains(source, pt.x, pt.y))
 *     {
 *       pt.y = source.y + source.height;
 *     }
 *
 *     result.push(pt);
 *   }
 * };
 * ```
 *
 * In the above example, a right angle is created using a point on the
 * horizontal center of the target vertex and the vertical center of the source
 * vertex. The code checks if that point intersects the source vertex and makes
 * the edge straight if it does. The point is then added into the result array,
 * which acts as the return value of the function.
 *
 * The new edge style should then be registered in the {@link StyleRegistry} as follows:
 * ```javascript
 * mxStyleRegistry.putValue('myEdgeStyle', mxEdgeStyle.MyStyle);
 * ```
 *
 * The custom edge style above can now be used in a specific edge as follows:
 *
 * ```javascript
 * model.setStyle(edge, 'edgeStyle=myEdgeStyle');
 * ```
 *
 * Note that the key of the {@link StyleRegistry} entry for the function should
 * be used in string values, unless {@link GraphView#allowEval} is true, in
 * which case you can also use mxEdgeStyle.MyStyle for the value in the
 * cell style above.
 *
 * Or it can be used for all edges in the graph as follows:
 *
 * ```javascript
 * let style = graph.getStylesheet().getDefaultEdgeStyle();
 * style.edge = mxEdgeStyle.MyStyle;
 * ```
 *
 * Note that the object can be used directly when programmatically setting
 * the value, but the key in the {@link StyleRegistry} should be used when
 * setting the value via a key, value pair in a cell style.
 */
class EdgeStyle {
  /**
   * Implements an entity relation style for edges (as used in database
   * schema diagrams). At the time the function is called, the result
   * array contains a placeholder (null) for the first absolute point,
   * that is, the point where the edge and source terminal are connected.
   * The implementation of the style then adds all intermediate waypoints
   * except for the last point, that is, the connection point between the
   * edge and the target terminal. The first ant the last point in the
   * result array are then replaced with Point that take into account
   * the terminal's perimeter and next point on the edge.
   *
   * @param state <CellState> that represents the edge to be updated.
   * @param source <CellState> that represents the source terminal.
   * @param target <CellState> that represents the target terminal.
   * @param points List of relative control points.
   * @param result Array of <Point> that represent the actual points of the
   * edge.
   */
  static EntityRelation(
    state: CellState,
    source: CellState,
    target: CellState,
    points: Point[],
    result: Point[]
  ) {
    const { view } = state;
    const { graph } = view;
    const segment = getValue(state.style, 'segment', ENTITY_SEGMENT) * view.scale;

    const pts = state.absolutePoints;
    const p0 = pts[0];
    const pe = pts[pts.length - 1];

    let isSourceLeft = false;

    if (source != null) {
      const sourceGeometry = <Geometry>source.cell.getGeometry();

      if (sourceGeometry.relative) {
        isSourceLeft = sourceGeometry.x <= 0.5;
      } else if (target != null) {
        isSourceLeft =
          (pe != null ? pe.x : target.x + target.width) < (p0 != null ? p0.x : source.x);
      }
    }

    if (p0 != null) {
      source = new CellState();
      source.x = p0.x;
      source.y = p0.y;
    } else if (source != null) {
      const constraint = getPortConstraints(source, state, true, DIRECTION_MASK.NONE);

      if (
        constraint !== DIRECTION_MASK.NONE &&
        constraint !== DIRECTION_MASK.WEST + DIRECTION_MASK.EAST
      ) {
        isSourceLeft = constraint === DIRECTION_MASK.WEST;
      }
    } else {
      return;
    }

    let isTargetLeft = true;

    if (target != null) {
      const targetGeometry = <Geometry>target.cell.getGeometry();

      if (targetGeometry.relative) {
        isTargetLeft = targetGeometry.x <= 0.5;
      } else if (source != null) {
        isTargetLeft =
          (p0 != null ? p0.x : source.x + source.width) < (pe != null ? pe.x : target.x);
      }
    }

    if (pe != null) {
      target = new CellState();
      target.x = pe.x;
      target.y = pe.y;
    } else if (target != null) {
      const constraint = getPortConstraints(target, state, false, DIRECTION_MASK.NONE);

      if (
        constraint !== DIRECTION_MASK.NONE &&
        constraint != DIRECTION_MASK.WEST + DIRECTION_MASK.EAST
      ) {
        isTargetLeft = constraint === DIRECTION_MASK.WEST;
      }
    }

    if (source != null && target != null) {
      const x0 = isSourceLeft ? source.x : source.x + source.width;
      const y0 = view.getRoutingCenterY(source);

      const xe = isTargetLeft ? target.x : target.x + target.width;
      const ye = view.getRoutingCenterY(target);

      const seg = segment;

      let dx = isSourceLeft ? -seg : seg;
      const dep = new Point(x0 + dx, y0);

      dx = isTargetLeft ? -seg : seg;
      const arr = new Point(xe + dx, ye);

      // Adds intermediate points if both go out on same side
      if (isSourceLeft === isTargetLeft) {
        const x = isSourceLeft ? Math.min(x0, xe) - segment : Math.max(x0, xe) + segment;

        result.push(new Point(x, y0));
        result.push(new Point(x, ye));
      } else if (dep.x < arr.x === isSourceLeft) {
        const midY = y0 + (ye - y0) / 2;

        result.push(dep);
        result.push(new Point(dep.x, midY));
        result.push(new Point(arr.x, midY));
        result.push(arr);
      } else {
        result.push(dep);
        result.push(arr);
      }
    }
  }

  /**
   * Implements a self-reference, aka. loop.
   */
  static Loop(
    state: CellState,
    source: CellState,
    target: CellState,
    points: Point[],
    result: Point[]
  ) {
    const pts = state.absolutePoints;

    const p0 = pts[0];
    const pe = pts[pts.length - 1];

    if (p0 != null && pe != null) {
      if (points != null && points.length > 0) {
        for (let i = 0; i < points.length; i += 1) {
          let pt = points[i];
          pt = <Point>state.view.transformControlPoint(state, pt);
          result.push(new Point(pt.x, pt.y));
        }
      }

      return;
    }

    if (source != null) {
      const { view } = state;
      const { graph } = view;
      let pt = points != null && points.length > 0 ? points[0] : null;

      if (pt != null) {
        pt = <Point>view.transformControlPoint(state, pt);
        if (contains(source, pt.x, pt.y)) {
          pt = null;
        }
      }

      let x = 0;
      let dx = 0;
      let y = 0;
      let dy = 0;

      const seg = getValue(state.style, 'segment', graph.gridSize) * view.scale;
      const dir = getValue(state.style, 'direction', DIRECTION.WEST);

      if (dir === DIRECTION.NORTH || dir === DIRECTION.SOUTH) {
        x = view.getRoutingCenterX(source);
        dx = seg;
      } else {
        y = view.getRoutingCenterY(source);
        dy = seg;
      }

      if (pt == null || pt.x < source.x || pt.x > source.x + source.width) {
        if (pt != null) {
          x = pt.x;
          dy = Math.max(Math.abs(y - pt.y), dy);
        } else if (dir === DIRECTION.NORTH) {
          y = source.y - 2 * dx;
        } else if (dir === DIRECTION.SOUTH) {
          y = source.y + source.height + 2 * dx;
        } else if (dir === DIRECTION.EAST) {
          x = source.x - 2 * dy;
        } else {
          x = source.x + source.width + 2 * dy;
        }
      } else if (pt !== null) {
        x = view.getRoutingCenterX(source);
        dx = Math.max(Math.abs(x - pt.x), dy);
        y = pt.y;
        dy = 0;
      }

      result.push(new Point(x - dx, y - dy));
      result.push(new Point(x + dx, y + dy));
    }
  }

  /**
   * Uses either <SideToSide> or <TopToBottom> depending on the horizontal
   * flag in the cell style. <SideToSide> is used if horizontal is true or
   * unspecified. See <EntityRelation> for a description of the
   * parameters.
   */
  static ElbowConnector(
    state: CellState,
    source: CellState,
    target: CellState,
    points: Point[],
    result: Point[]
  ) {
    let pt = points != null && points.length > 0 ? points[0] : null;

    let vertical = false;
    let horizontal = false;

    if (source != null && target != null) {
      if (pt != null) {
        const left = Math.min(source.x, target.x);
        const right = Math.max(source.x + source.width, target.x + target.width);

        const top = Math.min(source.y, target.y);
        const bottom = Math.max(source.y + source.height, target.y + target.height);

        pt = <Point>state.view.transformControlPoint(state, pt);
        vertical = pt.y < top || pt.y > bottom;
        horizontal = pt.x < left || pt.x > right;
      } else {
        const left = Math.max(source.x, target.x);
        const right = Math.min(source.x + source.width, target.x + target.width);

        vertical = left === right;
        if (!vertical) {
          const top = Math.max(source.y, target.y);
          const bottom = Math.min(source.y + source.height, target.y + target.height);

          horizontal = top === bottom;
        }
      }
    }

    if (!horizontal && (vertical || state.style.elbow === ELBOW.VERTICAL)) {
      EdgeStyle.TopToBottom(state, source, target, points, result);
    } else {
      EdgeStyle.SideToSide(state, source, target, points, result);
    }
  }

  /**
   * Implements a vertical elbow edge. See <EntityRelation> for a description
   * of the parameters.
   */
  static SideToSide(
    state: CellState,
    source: CellState,
    target: CellState,
    points: Point[],
    result: Point[]
  ) {
    const { view } = state;
    let pt = points != null && points.length > 0 ? points[0] : null;
    const pts = state.absolutePoints;
    const p0 = pts[0];
    const pe = pts[pts.length - 1];

    if (pt != null) {
      pt = view.transformControlPoint(state, pt);
    }

    if (p0 != null) {
      source = new CellState();
      source.x = p0.x;
      source.y = p0.y;
    }

    if (pe != null) {
      target = new CellState();
      target.x = pe.x;
      target.y = pe.y;
    }

    if (source != null && target != null) {
      const l = Math.max(source.x, target.x);
      const r = Math.min(source.x + source.width, target.x + target.width);

      const x = pt != null ? pt.x : Math.round(r + (l - r) / 2);

      let y1 = view.getRoutingCenterY(source);
      let y2 = view.getRoutingCenterY(target);

      if (pt != null) {
        if (pt.y >= source.y && pt.y <= source.y + source.height) {
          y1 = pt.y;
        }

        if (pt.y >= target.y && pt.y <= target.y + target.height) {
          y2 = pt.y;
        }
      }

      if (!contains(target, x, y1) && !contains(source, x, y1)) {
        result.push(new Point(x, y1));
      }

      if (!contains(target, x, y2) && !contains(source, x, y2)) {
        result.push(new Point(x, y2));
      }

      if (result.length === 1) {
        if (pt != null) {
          if (!contains(target, x, pt.y) && !contains(source, x, pt.y)) {
            result.push(new Point(x, pt.y));
          }
        } else {
          const t = Math.max(source.y, target.y);
          const b = Math.min(source.y + source.height, target.y + target.height);

          result.push(new Point(x, t + (b - t) / 2));
        }
      }
    }
  }

  /**
   * Implements a horizontal elbow edge. See <EntityRelation> for a
   * description of the parameters.
   */
  static TopToBottom(
    state: CellState,
    source: CellState,
    target: CellState,
    points: Point[],
    result: Point[]
  ) {
    const { view } = state;
    let pt = points != null && points.length > 0 ? points[0] : null;
    const pts = state.absolutePoints;
    const p0 = pts[0];
    const pe = pts[pts.length - 1];

    if (pt != null) {
      pt = view.transformControlPoint(state, pt);
    }

    if (p0 != null) {
      source = new CellState();
      source.x = p0.x;
      source.y = p0.y;
    }

    if (pe != null) {
      target = new CellState();
      target.x = pe.x;
      target.y = pe.y;
    }

    if (source != null && target != null) {
      const t = Math.max(source.y, target.y);
      const b = Math.min(source.y + source.height, target.y + target.height);

      let x = view.getRoutingCenterX(source);

      if (pt != null && pt.x >= source.x && pt.x <= source.x + source.width) {
        x = pt.x;
      }

      const y = pt != null ? pt.y : Math.round(b + (t - b) / 2);

      if (!contains(target, x, y) && !contains(source, x, y)) {
        result.push(new Point(x, y));
      }

      if (pt != null && pt.x >= target.x && pt.x <= target.x + target.width) {
        x = pt.x;
      } else {
        x = view.getRoutingCenterX(target);
      }

      if (!contains(target, x, y) && !contains(source, x, y)) {
        result.push(new Point(x, y));
      }

      if (result.length === 1) {
        if (pt != null && result.length === 1) {
          if (!contains(target, pt.x, y) && !contains(source, pt.x, y)) {
            result.push(new Point(pt.x, y));
          }
        } else {
          const l = Math.max(source.x, target.x);
          const r = Math.min(source.x + source.width, target.x + target.width);

          result.push(new Point(l + (r - l) / 2, y));
        }
      }
    }
  }

  /**
   * Implements an orthogonal edge style. Use {@link EdgeSegmentHandler}
   * as an interactive handler for this style.
   *
   * @param state <CellState> that represents the edge to be updated.
   * @param sourceScaled <CellState> that represents the source terminal.
   * @param targetScaled <CellState> that represents the target terminal.
   * @param controlHints List of relative control points.
   * @param result Array of <Point> that represent the actual points of the
   * edge.
   */
  static SegmentConnector(
    state: CellState,
    sourceScaled: CellState,
    targetScaled: CellState,
    controlHints: Point[],
    result: Point[]
  ) {
    // Creates array of all way- and terminalpoints
    // TODO: Figure out what to do when there are nulls in `pts`!
    const pts = <Point[]>(
      (<unknown>(
        EdgeStyle.scalePointArray(
          <Point[]>(<unknown>state.absolutePoints),
          state.view.scale
        )
      ))
    );
    const source = EdgeStyle.scaleCellState(sourceScaled, state.view.scale);
    const target = EdgeStyle.scaleCellState(targetScaled, state.view.scale);
    const tol = 1;

    // Whether the first segment outgoing from the source end is horizontal
    let lastPushed = result.length > 0 ? result[0] : null;
    let horizontal = true;
    let hint = null;

    // Adds waypoints only if outside of tolerance
    function pushPoint(pt: Point) {
      pt.x = Math.round(pt.x * state.view.scale * 10) / 10;
      pt.y = Math.round(pt.y * state.view.scale * 10) / 10;

      if (
        lastPushed == null ||
        Math.abs(lastPushed.x - pt.x) >= tol ||
        Math.abs(lastPushed.y - pt.y) >= Math.max(1, state.view.scale)
      ) {
        result.push(pt);
        lastPushed = pt;
      }

      return lastPushed;
    }

    // Adds the first point
    let pt = pts[0];

    if (pt == null && source != null) {
      pt = new Point(
        state.view.getRoutingCenterX(source),
        state.view.getRoutingCenterY(source)
      );
    } else if (pt != null) {
      pt = pt.clone();
    }

    const lastInx = pts.length - 1;
    let pe = null;

    // Adds the waypoints
    if (controlHints != null && controlHints.length > 0) {
      // Converts all hints and removes nulls
      let hints = [];

      for (let i = 0; i < controlHints.length; i += 1) {
        const tmp = state.view.transformControlPoint(state, controlHints[i], true);

        if (tmp != null) {
          hints.push(tmp);
        }
      }

      if (hints.length === 0) {
        return;
      }

      // Aligns source and target hint to fixed points
      if (pt != null && hints[0] != null) {
        if (Math.abs(hints[0].x - pt.x) < tol) {
          hints[0].x = pt.x;
        }

        if (Math.abs(hints[0].y - pt.y) < tol) {
          hints[0].y = pt.y;
        }
      }

      pe = pts[lastInx];

      if (pe != null && hints[hints.length - 1] != null) {
        if (Math.abs(hints[hints.length - 1].x - pe.x) < tol) {
          hints[hints.length - 1].x = pe.x;
        }

        if (Math.abs(hints[hints.length - 1].y - pe.y) < tol) {
          hints[hints.length - 1].y = pe.y;
        }
      }

      hint = hints[0];

      let currentTerm = source;
      let currentPt = pts[0];
      let hozChan = false;
      let vertChan = false;
      let currentHint = hint;

      if (currentPt != null) {
        currentTerm = null;
      }

      // Check for alignment with fixed points and with channels
      // at source and target segments only
      for (let i = 0; i < 2; i += 1) {
        const fixedVertAlign = currentPt != null && currentPt.x === currentHint.x;
        const fixedHozAlign = currentPt != null && currentPt.y === currentHint.y;

        const inHozChan =
          currentTerm != null &&
          currentHint.y >= currentTerm.y &&
          currentHint.y <= currentTerm.y + currentTerm.height;
        const inVertChan =
          currentTerm != null &&
          currentHint.x >= currentTerm.x &&
          currentHint.x <= currentTerm.x + currentTerm.width;

        hozChan = fixedHozAlign || (currentPt == null && inHozChan);
        vertChan = fixedVertAlign || (currentPt == null && inVertChan);

        // If the current hint falls in both the hor and vert channels in the case
        // of a floating port, or if the hint is exactly co-incident with a
        // fixed point, ignore the source and try to work out the orientation
        // from the target end
        if (!(i == 0 && ((hozChan && vertChan) || (fixedVertAlign && fixedHozAlign)))) {
          if (
            currentPt != null &&
            !fixedHozAlign &&
            !fixedVertAlign &&
            (inHozChan || inVertChan)
          ) {
            horizontal = !inHozChan;
            break;
          }

          if (vertChan || hozChan) {
            horizontal = hozChan;

            if (i === 1) {
              // Work back from target end
              horizontal = hints.length % 2 === 0 ? hozChan : vertChan;
            }

            break;
          }
        }

        currentTerm = target;
        currentPt = pts[lastInx];

        if (currentPt != null) {
          currentTerm = null;
        }

        currentHint = hints[hints.length - 1];

        if (fixedVertAlign && fixedHozAlign) {
          hints = hints.slice(1);
        }
      }

      if (
        horizontal &&
        ((pts[0] != null && pts[0].y !== hint.y) ||
          (pts[0] == null &&
            source != null &&
            (hint.y < source.y || hint.y > source.y + source.height)))
      ) {
        pushPoint(new Point(pt.x, hint.y));
      } else if (
        !horizontal &&
        ((pts[0] != null && pts[0].x !== hint.x) ||
          (pts[0] == null &&
            source != null &&
            (hint.x < source.x || hint.x > source.x + source.width)))
      ) {
        pushPoint(new Point(hint.x, pt.y));
      }

      if (horizontal) {
        pt.y = hint.y;
      } else {
        pt.x = hint.x;
      }

      for (let i = 0; i < hints.length; i += 1) {
        horizontal = !horizontal;
        hint = hints[i];

        //        MaxLog.show();
        //        MaxLog.debug('hint', i, hint.x, hint.y);

        if (horizontal) {
          pt.y = hint.y;
        } else {
          pt.x = hint.x;
        }

        pushPoint(pt.clone());
      }
    } else {
      hint = pt;
      // FIXME: First click in connect preview toggles orientation
      horizontal = true;
    }

    // Adds the last point
    pt = pts[lastInx];

    if (pt == null && target != null) {
      pt = new Point(
        state.view.getRoutingCenterX(target),
        state.view.getRoutingCenterY(target)
      );
    }

    if (pt != null) {
      if (hint != null) {
        if (
          horizontal &&
          ((pts[lastInx] != null && pts[lastInx].y !== hint.y) ||
            (pts[lastInx] == null &&
              target != null &&
              (hint.y < target.y || hint.y > target.y + target.height)))
        ) {
          pushPoint(new Point(pt.x, hint.y));
        } else if (
          !horizontal &&
          ((pts[lastInx] != null && pts[lastInx].x !== hint.x) ||
            (pts[lastInx] == null &&
              target != null &&
              (hint.x < target.x || hint.x > target.x + target.width)))
        ) {
          pushPoint(new Point(hint.x, pt.y));
        }
      }
    }

    // Removes bends inside the source terminal for floating ports
    if (pts[0] == null && source != null) {
      while (
        result.length > 1 &&
        result[1] != null &&
        contains(source, result[1].x, result[1].y)
      ) {
        result.splice(1, 1);
      }
    }

    // Removes bends inside the target terminal
    if (pts[lastInx] == null && target != null) {
      while (
        result.length > 1 &&
        result[result.length - 1] != null &&
        contains(target, result[result.length - 1].x, result[result.length - 1].y)
      ) {
        result.splice(result.length - 1, 1);
      }
    }

    // Removes last point if inside tolerance with end point
    if (
      pe != null &&
      result[result.length - 1] != null &&
      Math.abs(pe.x - result[result.length - 1].x) <= tol &&
      Math.abs(pe.y - result[result.length - 1].y) <= tol
    ) {
      result.splice(result.length - 1, 1);

      // Lines up second last point in result with end point
      if (result[result.length - 1] != null) {
        if (Math.abs(result[result.length - 1].x - pe.x) < tol) {
          result[result.length - 1].x = pe.x;
        }

        if (Math.abs(result[result.length - 1].y - pe.y) < tol) {
          result[result.length - 1].y = pe.y;
        }
      }
    }
  }

  static orthBuffer = 10;

  static orthPointsFallback = true;

  static dirVectors = [
    [-1, 0],
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
    [0, -1],
    [1, 0],
  ];

  static wayPoints1 = [
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
  ];

  static routePatterns = [
    [
      [513, 2308, 2081, 2562],
      [513, 1090, 514, 2184, 2114, 2561],
      [513, 1090, 514, 2564, 2184, 2562],
      [513, 2308, 2561, 1090, 514, 2568, 2308],
    ],
    [
      [514, 1057, 513, 2308, 2081, 2562],
      [514, 2184, 2114, 2561],
      [514, 2184, 2562, 1057, 513, 2564, 2184],
      [514, 1057, 513, 2568, 2308, 2561],
    ],
    [
      [1090, 514, 1057, 513, 2308, 2081, 2562],
      [2114, 2561],
      [1090, 2562, 1057, 513, 2564, 2184],
      [1090, 514, 1057, 513, 2308, 2561, 2568],
    ],
    [
      [2081, 2562],
      [1057, 513, 1090, 514, 2184, 2114, 2561],
      [1057, 513, 1090, 514, 2184, 2562, 2564],
      [1057, 2561, 1090, 514, 2568, 2308],
    ],
  ];

  static inlineRoutePatterns = [
    [null, [2114, 2568], null, null],
    [null, [514, 2081, 2114, 2568], null, null],
    [null, [2114, 2561], null, null],
    [[2081, 2562], [1057, 2114, 2568], [2184, 2562], null],
  ];

  static vertexSeperations: any = [];

  static limits = [
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
  ];

  static LEFT_MASK = 32;

  static TOP_MASK = 64;

  static RIGHT_MASK = 128;

  static BOTTOM_MASK = 256;

  static LEFT = 1;

  static TOP = 2;

  static RIGHT = 4;

  static BOTTOM = 8;

  // TODO remove magic numbers
  static SIDE_MASK = 480;
  // mxEdgeStyle.LEFT_MASK | mxEdgeStyle.TOP_MASK | mxEdgeStyle.RIGHT_MASK
  // | mxEdgeStyle.BOTTOM_MASK,

  static CENTER_MASK = 512;

  static SOURCE_MASK = 1024;

  static TARGET_MASK = 2048;

  static VERTEX_MASK = 3072;
  // mxEdgeStyle.SOURCE_MASK | mxEdgeStyle.TARGET_MASK,

  static getJettySize(state: CellState, isSource: boolean) {
    let value = getValue(
      state.style,
      isSource ? 'sourceJettySize' : 'targetJettySize',
      getValue(state.style, 'jettySize', EdgeStyle.orthBuffer)
    );

    if (value === 'auto') {
      // Computes the automatic jetty size
      const type = getValue(state.style, isSource ? 'startArrow' : 'endArrow', NONE);

      if (type !== NONE) {
        const size = getNumber(
          state.style,
          isSource ? 'startSize' : 'endSize',
          DEFAULT_MARKERSIZE
        );
        value =
          Math.max(2, Math.ceil((size + EdgeStyle.orthBuffer) / EdgeStyle.orthBuffer)) *
          EdgeStyle.orthBuffer;
      } else {
        value = 2 * EdgeStyle.orthBuffer;
      }
    }

    return value;
  }

  /**
   * Scales an array of {@link Point}
   *
   * @param points array of {@link Point} to scale
   * @param scale the scaling to divide by
   */
  static scalePointArray(points: Point[], scale: number): (Point | null)[] | null {
    let result: (Point | null)[] | null = [];

    if (points != null) {
      for (let i = 0; i < points.length; i += 1) {
        if (points[i] != null) {
          const pt = new Point(
            Math.round((points[i].x / scale) * 10) / 10,
            Math.round((points[i].y / scale) * 10) / 10
          );
          result[i] = pt;
        } else {
          result[i] = null;
        }
      }
    } else {
      result = null;
    }

    return result;
  }

  /**
   * Scales an <CellState>
   *
   * @param state <CellState> to scale
   * @param scale the scaling to divide by
   */
  static scaleCellState(state: CellState, scale: number) {
    let result = null;

    if (state != null) {
      result = state.clone();
      result.setRect(
        Math.round((state.x / scale) * 10) / 10,
        Math.round((state.y / scale) * 10) / 10,
        Math.round((state.width / scale) * 10) / 10,
        Math.round((state.height / scale) * 10) / 10
      );
    } else {
      result = null;
    }

    return result;
  }

  /**
   * Implements a local orthogonal router between the given
   * cells.
   *
   * @param state <CellState> that represents the edge to be updated.
   * @param sourceScaled <CellState> that represents the source terminal.
   * @param targetScaled <CellState> that represents the target terminal.
   * @param controlHints List of relative control points.
   * @param result Array of <Point> that represent the actual points of the
   * edge.
   */
  static OrthConnector(
    state: CellState,
    sourceScaled: CellState,
    targetScaled: CellState,
    controlHints: Point[],
    result: Point[]
  ) {
    // TODO: Figure out what to do when there are nulls in `pts`!
    const pts = <Point[]>(
      (<unknown>(
        EdgeStyle.scalePointArray(<Point[]>state.absolutePoints, state.view.scale)
      ))
    );
    const source = EdgeStyle.scaleCellState(sourceScaled, state.view.scale);
    const target = EdgeStyle.scaleCellState(targetScaled, state.view.scale);

    const sourceEdge = source == null ? false : source.cell.isEdge();
    const targetEdge = target == null ? false : target.cell.isEdge();

    const p0 = pts[0];
    const pe = pts[pts.length - 1];

    let sourceX = source != null ? source.x : p0.x;
    let sourceY = source != null ? source.y : p0.y;
    let sourceWidth = source != null ? source.width : 0;
    let sourceHeight = source != null ? source.height : 0;

    let targetX = target != null ? target.x : pe.x;
    let targetY = target != null ? target.y : pe.y;
    let targetWidth = target != null ? target.width : 0;
    let targetHeight = target != null ? target.height : 0;

    let sourceBuffer = EdgeStyle.getJettySize(state, true);
    let targetBuffer = EdgeStyle.getJettySize(state, false);

    // Workaround for loop routing within buffer zone
    if (source != null && target === source) {
      targetBuffer = Math.max(sourceBuffer, targetBuffer);
      sourceBuffer = targetBuffer;
    }

    const totalBuffer = targetBuffer + sourceBuffer;

    let tooShort = false;

    // Checks minimum distance for fixed points and falls back to segment connector
    if (p0 != null && pe != null) {
      const dx = pe.x - p0.x;
      const dy = pe.y - p0.y;

      tooShort = dx * dx + dy * dy < totalBuffer * totalBuffer;
    }

    if (
      tooShort ||
      (EdgeStyle.orthPointsFallback && controlHints != null && controlHints.length > 0) ||
      sourceEdge ||
      targetEdge
    ) {
      EdgeStyle.SegmentConnector(state, sourceScaled, targetScaled, controlHints, result);

      return;
    }

    // Determine the side(s) of the source and target vertices
    // that the edge may connect to
    // portConstraint [source, target]
    const portConstraint = [DIRECTION_MASK.ALL, DIRECTION_MASK.ALL];
    let rotation = 0;

    if (source != null) {
      portConstraint[0] = getPortConstraints(source, state, true, DIRECTION_MASK.ALL);
      rotation = source.style.rotation ?? 0;

      if (rotation !== 0) {
        const newRect = <Rectangle>(
          getBoundingBox(
            new Rectangle(sourceX, sourceY, sourceWidth, sourceHeight),
            rotation
          )
        );
        sourceX = newRect.x;
        sourceY = newRect.y;
        sourceWidth = newRect.width;
        sourceHeight = newRect.height;
      }
    }

    if (target != null) {
      portConstraint[1] = getPortConstraints(target, state, false, DIRECTION_MASK.ALL);
      rotation = target.style.rotation ?? 0;

      if (rotation !== 0) {
        const newRect = <Rectangle>(
          getBoundingBox(
            new Rectangle(targetX, targetY, targetWidth, targetHeight),
            rotation
          )
        );
        targetX = newRect.x;
        targetY = newRect.y;
        targetWidth = newRect.width;
        targetHeight = newRect.height;
      }
    }

    const dir = [0, 0];

    // Work out which faces of the vertices present against each other
    // in a way that would allow a 3-segment connection if port constraints
    // permitted.
    // geo -> [source, target] [x, y, width, height]
    const geo = [
      [sourceX, sourceY, sourceWidth, sourceHeight],
      [targetX, targetY, targetWidth, targetHeight],
    ];
    const buffer = [sourceBuffer, targetBuffer];

    for (let i = 0; i < 2; i += 1) {
      EdgeStyle.limits[i][1] = geo[i][0] - buffer[i];
      EdgeStyle.limits[i][2] = geo[i][1] - buffer[i];
      EdgeStyle.limits[i][4] = geo[i][0] + geo[i][2] + buffer[i];
      EdgeStyle.limits[i][8] = geo[i][1] + geo[i][3] + buffer[i];
    }

    // Work out which quad the target is in
    const sourceCenX = geo[0][0] + geo[0][2] / 2.0;
    const sourceCenY = geo[0][1] + geo[0][3] / 2.0;
    const targetCenX = geo[1][0] + geo[1][2] / 2.0;
    const targetCenY = geo[1][1] + geo[1][3] / 2.0;

    const dx = sourceCenX - targetCenX;
    const dy = sourceCenY - targetCenY;

    let quad = 0;

    // 0 | 1
    // -----
    // 3 | 2

    if (dx < 0) {
      if (dy < 0) {
        quad = 2;
      } else {
        quad = 1;
      }
    } else if (dy <= 0) {
      quad = 3;

      // Special case on x = 0 and negative y
      if (dx === 0) {
        quad = 2;
      }
    }

    // Check for connection constraints
    let currentTerm = null;

    if (source != null) {
      currentTerm = p0;
    }

    const constraint = [
      [0.5, 0.5],
      [0.5, 0.5],
    ];

    for (let i = 0; i < 2; i += 1) {
      if (currentTerm != null) {
        constraint[i][0] = (currentTerm.x - geo[i][0]) / geo[i][2];

        if (Math.abs(currentTerm.x - geo[i][0]) <= 1) {
          dir[i] = DIRECTION_MASK.WEST;
        } else if (Math.abs(currentTerm.x - geo[i][0] - geo[i][2]) <= 1) {
          dir[i] = DIRECTION_MASK.EAST;
        }

        constraint[i][1] = (currentTerm.y - geo[i][1]) / geo[i][3];

        if (Math.abs(currentTerm.y - geo[i][1]) <= 1) {
          dir[i] = DIRECTION_MASK.NORTH;
        } else if (Math.abs(currentTerm.y - geo[i][1] - geo[i][3]) <= 1) {
          dir[i] = DIRECTION_MASK.SOUTH;
        }
      }

      currentTerm = null;

      if (target != null) {
        currentTerm = pe;
      }
    }

    const sourceTopDist = geo[0][1] - (geo[1][1] + geo[1][3]);
    const sourceLeftDist = geo[0][0] - (geo[1][0] + geo[1][2]);
    const sourceBottomDist = geo[1][1] - (geo[0][1] + geo[0][3]);
    const sourceRightDist = geo[1][0] - (geo[0][0] + geo[0][2]);

    EdgeStyle.vertexSeperations[1] = Math.max(sourceLeftDist - totalBuffer, 0);
    EdgeStyle.vertexSeperations[2] = Math.max(sourceTopDist - totalBuffer, 0);
    EdgeStyle.vertexSeperations[4] = Math.max(sourceBottomDist - totalBuffer, 0);
    EdgeStyle.vertexSeperations[3] = Math.max(sourceRightDist - totalBuffer, 0);

    //= =============================================================
    // Start of source and target direction determination

    // Work through the preferred orientations by relative positioning
    // of the vertices and list them in preferred and available order

    const dirPref = [];
    const horPref = [];
    const vertPref = [];

    horPref[0] =
      sourceLeftDist >= sourceRightDist ? DIRECTION_MASK.WEST : DIRECTION_MASK.EAST;
    vertPref[0] =
      sourceTopDist >= sourceBottomDist ? DIRECTION_MASK.NORTH : DIRECTION_MASK.SOUTH;

    horPref[1] = reversePortConstraints(horPref[0]);
    vertPref[1] = reversePortConstraints(vertPref[0]);

    const preferredHorizDist =
      sourceLeftDist >= sourceRightDist ? sourceLeftDist : sourceRightDist;
    const preferredVertDist =
      sourceTopDist >= sourceBottomDist ? sourceTopDist : sourceBottomDist;

    const prefOrdering = [
      [0, 0],
      [0, 0],
    ];
    let preferredOrderSet = false;

    // If the preferred port isn't available, switch it
    for (let i = 0; i < 2; i += 1) {
      if (dir[i] !== 0x0) {
        continue;
      }

      if ((horPref[i] & portConstraint[i]) === 0) {
        horPref[i] = reversePortConstraints(horPref[i]);
      }

      if ((vertPref[i] & portConstraint[i]) === 0) {
        vertPref[i] = reversePortConstraints(vertPref[i]);
      }

      prefOrdering[i][0] = vertPref[i];
      prefOrdering[i][1] = horPref[i];
    }

    if (preferredVertDist > 0 && preferredHorizDist > 0) {
      // Possibility of two segment edge connection
      if ((horPref[0] & portConstraint[0]) > 0 && (vertPref[1] & portConstraint[1]) > 0) {
        prefOrdering[0][0] = horPref[0];
        prefOrdering[0][1] = vertPref[0];
        prefOrdering[1][0] = vertPref[1];
        prefOrdering[1][1] = horPref[1];
        preferredOrderSet = true;
      } else if (
        (vertPref[0] & portConstraint[0]) > 0 &&
        (horPref[1] & portConstraint[1]) > 0
      ) {
        prefOrdering[0][0] = vertPref[0];
        prefOrdering[0][1] = horPref[0];
        prefOrdering[1][0] = horPref[1];
        prefOrdering[1][1] = vertPref[1];
        preferredOrderSet = true;
      }
    }

    if (preferredVertDist > 0 && !preferredOrderSet) {
      prefOrdering[0][0] = vertPref[0];
      prefOrdering[0][1] = horPref[0];
      prefOrdering[1][0] = vertPref[1];
      prefOrdering[1][1] = horPref[1];
      preferredOrderSet = true;
    }

    if (preferredHorizDist > 0 && !preferredOrderSet) {
      prefOrdering[0][0] = horPref[0];
      prefOrdering[0][1] = vertPref[0];
      prefOrdering[1][0] = horPref[1];
      prefOrdering[1][1] = vertPref[1];
      preferredOrderSet = true;
    }

    // The source and target prefs are now an ordered list of
    // the preferred port selections
    // If the list contains gaps, compact it

    for (let i = 0; i < 2; i += 1) {
      if (dir[i] !== 0x0) {
        continue;
      }

      if ((prefOrdering[i][0] & portConstraint[i]) === 0) {
        prefOrdering[i][0] = prefOrdering[i][1];
      }

      dirPref[i] = prefOrdering[i][0] & portConstraint[i];
      dirPref[i] |= (prefOrdering[i][1] & portConstraint[i]) << 8;
      dirPref[i] |= (prefOrdering[1 - i][i] & portConstraint[i]) << 16;
      dirPref[i] |= (prefOrdering[1 - i][1 - i] & portConstraint[i]) << 24;

      if ((dirPref[i] & 0xf) === 0) {
        dirPref[i] = dirPref[i] << 8;
      }

      if ((dirPref[i] & 0xf00) === 0) {
        dirPref[i] = (dirPref[i] & 0xf) | (dirPref[i] >> 8);
      }

      if ((dirPref[i] & 0xf0000) === 0) {
        dirPref[i] = (dirPref[i] & 0xffff) | ((dirPref[i] & 0xf000000) >> 8);
      }

      dir[i] = dirPref[i] & 0xf;

      if (
        portConstraint[i] === DIRECTION_MASK.WEST ||
        portConstraint[i] === DIRECTION_MASK.NORTH ||
        portConstraint[i] === DIRECTION_MASK.EAST ||
        portConstraint[i] === DIRECTION_MASK.SOUTH
      ) {
        dir[i] = portConstraint[i];
      }
    }

    //= =============================================================
    // End of source and target direction determination

    let sourceIndex = dir[0] === DIRECTION_MASK.EAST ? 3 : dir[0];
    let targetIndex = dir[1] === DIRECTION_MASK.EAST ? 3 : dir[1];

    sourceIndex -= quad;
    targetIndex -= quad;

    if (sourceIndex < 1) {
      sourceIndex += 4;
    }

    if (targetIndex < 1) {
      targetIndex += 4;
    }

    const routePattern = EdgeStyle.routePatterns[sourceIndex - 1][targetIndex - 1];

    EdgeStyle.wayPoints1[0][0] = geo[0][0];
    EdgeStyle.wayPoints1[0][1] = geo[0][1];

    switch (dir[0]) {
      case DIRECTION_MASK.WEST:
        EdgeStyle.wayPoints1[0][0] -= sourceBuffer;
        EdgeStyle.wayPoints1[0][1] += constraint[0][1] * geo[0][3];
        break;
      case DIRECTION_MASK.SOUTH:
        EdgeStyle.wayPoints1[0][0] += constraint[0][0] * geo[0][2];
        EdgeStyle.wayPoints1[0][1] += geo[0][3] + sourceBuffer;
        break;
      case DIRECTION_MASK.EAST:
        EdgeStyle.wayPoints1[0][0] += geo[0][2] + sourceBuffer;
        EdgeStyle.wayPoints1[0][1] += constraint[0][1] * geo[0][3];
        break;
      case DIRECTION_MASK.NORTH:
        EdgeStyle.wayPoints1[0][0] += constraint[0][0] * geo[0][2];
        EdgeStyle.wayPoints1[0][1] -= sourceBuffer;
        break;
    }

    let currentIndex = 0;

    // Orientation, 0 horizontal, 1 vertical
    let lastOrientation =
      (dir[0] & (DIRECTION_MASK.EAST | DIRECTION_MASK.WEST)) > 0 ? 0 : 1;
    const initialOrientation = lastOrientation;
    let currentOrientation = 0;

    for (let i = 0; i < routePattern.length; i += 1) {
      const nextDirection = routePattern[i] & 0xf;

      // Rotate the index of this direction by the quad
      // to get the real direction
      let directionIndex = nextDirection === DIRECTION_MASK.EAST ? 3 : nextDirection;

      directionIndex += quad;

      if (directionIndex > 4) {
        directionIndex -= 4;
      }

      const direction = EdgeStyle.dirVectors[directionIndex - 1];

      currentOrientation = directionIndex % 2 > 0 ? 0 : 1;
      // Only update the current index if the point moved
      // in the direction of the current segment move,
      // otherwise the same point is moved until there is
      // a segment direction change
      if (currentOrientation !== lastOrientation) {
        currentIndex++;
        // Copy the previous way point into the new one
        // We can't base the new position on index - 1
        // because sometime elbows turn out not to exist,
        // then we'd have to rewind.
        EdgeStyle.wayPoints1[currentIndex][0] = EdgeStyle.wayPoints1[currentIndex - 1][0];
        EdgeStyle.wayPoints1[currentIndex][1] = EdgeStyle.wayPoints1[currentIndex - 1][1];
      }

      const tar = (routePattern[i] & EdgeStyle.TARGET_MASK) > 0;
      const sou = (routePattern[i] & EdgeStyle.SOURCE_MASK) > 0;
      let side = (routePattern[i] & EdgeStyle.SIDE_MASK) >> 5;
      side <<= quad;

      if (side > 0xf) {
        side >>= 4;
      }

      const center = (routePattern[i] & EdgeStyle.CENTER_MASK) > 0;

      if ((sou || tar) && side < 9) {
        let limit = 0;
        const souTar = sou ? 0 : 1;

        if (center && currentOrientation === 0) {
          limit = geo[souTar][0] + constraint[souTar][0] * geo[souTar][2];
        } else if (center) {
          limit = geo[souTar][1] + constraint[souTar][1] * geo[souTar][3];
        } else {
          limit = EdgeStyle.limits[souTar][side];
        }

        if (currentOrientation === 0) {
          const lastX = EdgeStyle.wayPoints1[currentIndex][0];
          const deltaX = (limit - lastX) * direction[0];

          if (deltaX > 0) {
            EdgeStyle.wayPoints1[currentIndex][0] += direction[0] * deltaX;
          }
        } else {
          const lastY = EdgeStyle.wayPoints1[currentIndex][1];
          const deltaY = (limit - lastY) * direction[1];

          if (deltaY > 0) {
            EdgeStyle.wayPoints1[currentIndex][1] += direction[1] * deltaY;
          }
        }
      } else if (center) {
        // Which center we're travelling to depend on the current direction
        EdgeStyle.wayPoints1[currentIndex][0] +=
          direction[0] * Math.abs(EdgeStyle.vertexSeperations[directionIndex] / 2);
        EdgeStyle.wayPoints1[currentIndex][1] +=
          direction[1] * Math.abs(EdgeStyle.vertexSeperations[directionIndex] / 2);
      }

      if (
        currentIndex > 0 &&
        EdgeStyle.wayPoints1[currentIndex][currentOrientation] ===
        EdgeStyle.wayPoints1[currentIndex - 1][currentOrientation]
      ) {
        currentIndex--;
      } else {
        lastOrientation = currentOrientation;
      }
    }

    for (let i = 0; i <= currentIndex; i += 1) {
      if (i === currentIndex) {
        // Last point can cause last segment to be in
        // same direction as jetty/approach. If so,
        // check the number of points is consistent
        // with the relative orientation of source and target
        // jx. Same orientation requires an even
        // number of turns (points), different requires
        // odd.
        const targetOrientation =
          (dir[1] & (DIRECTION_MASK.EAST | DIRECTION_MASK.WEST)) > 0 ? 0 : 1;
        const sameOrient = targetOrientation === initialOrientation ? 0 : 1;

        // (currentIndex + 1) % 2 is 0 for even number of points,
        // 1 for odd
        if (sameOrient !== (currentIndex + 1) % 2) {
          // The last point isn't required
          break;
        }
      }

      result.push(
        new Point(
          Math.round(EdgeStyle.wayPoints1[i][0] * state.view.scale * 10) / 10,
          Math.round(EdgeStyle.wayPoints1[i][1] * state.view.scale * 10) / 10
        )
      );
    }

    // Removes duplicates
    let index = 1;

    while (index < result.length) {
      if (
        result[index - 1] == null ||
        result[index] == null ||
        result[index - 1].x !== result[index].x ||
        result[index - 1].y !== result[index].y
      ) {
        index++;
      } else {
        result.splice(index, 1);
      }
    }
  }

  // Size of the step to find a route
  static MANHATTAN_STEP = 12;

  // If number of route finding loops exceed the maximum, stops searching and returns
  // fallback route
  static MANHATTAN_MAXIMUM_LOOPS = 2000;

  // Possible starting directions from an element
  static MANHATTAN_START_DIRECTIONS: DIRECTION[] = [
    DIRECTION.NORTH, DIRECTION.EAST, DIRECTION.SOUTH, DIRECTION.WEST
  ];

  // Possible ending directions to an element
  static MANHATTAN_END_DIRECTIONS: DIRECTION[] = [
    DIRECTION.NORTH, DIRECTION.EAST, DIRECTION.SOUTH, DIRECTION.WEST
  ];

  // Limit for directions change when searching route
  static MANHATTAN_MAX_ALLOWED_DIRECTION_CHANGE = 90;

  static MANHATTAN_PADDING_BOX = new Geometry(
    -this.MANHATTAN_STEP, -this.MANHATTAN_STEP,
    this.MANHATTAN_STEP * 2, this.MANHATTAN_STEP * 2);

  /**
   * ManhattanConnector code is based on code from
   * https://github.com/mwangm/mxgraph-manhattan-connector
   *
   * Implements router to find shortest route that avoids cells using
   * manhattan distance as metric.
   */
  static ManhattanConnector(
    state: CellState,
    source: CellState,
    target: CellState,
    points: Point[],
    result: Point[]
  ) {
    /**
     * Adds all values from source geometry to target.
     * Used to create padding box around cell geometry.
     * @param target
     * @param source
     * @returns
     */
    function moveAndExpand(target: Rectangle, source: Rectangle): Rectangle {
      target.x += source.x || 0;
      target.y += source.y || 0;
      target.width += source.width || 0;
      target.height += source.height || 0;
      return target;
    };

    function snapCoordinateToGrid(value: number, gridSize: number) {
      return gridSize * Math.round(value / gridSize);
    };

    function snapPointToGrid(p: Point, gx: number, gy?: number) {
      p.x = snapCoordinateToGrid(p.x, gx);
      p.y = snapCoordinateToGrid(p.y, gy || gx);
      return p;
    };

    function isPointInRectangle(rect: Rectangle, p: Point) {
      return p.x >= rect.x && p.x <= rect.x + rect.width && p.y >= rect.y && p.y <= rect.y + rect.height;
    }

    function getRectangleCenter(rect: Rectangle): Point {
      return new Point(rect.x + rect.width / 2, rect.y + rect.height / 2);
    }

    function getDifferencePoint(p1: Point, p2: Point): Point {
      return new Point(p1.x - p2.x, p1.y - p2.y);
    };

    function movePoint(p: Point, moveX?: number, moveY?: number): Point {
      p.x += moveX || 0;
      p.y += moveY || 0;
      return p;
    };

    function getPointTheta(p1: Point, p2: Point) {
      const p = p2.clone();
      const y = -(p.y - p1.y);
      const x = p.x - p1.x;
      const PRECISION = 10;
      const rad = (y.toFixed(PRECISION) == "0" && x.toFixed(PRECISION) == "0")
        ? 0
        : Math.atan2(y, x);
      return 180 * rad / Math.PI;
    }

    function normalizePoint(point: Point) {
      return new Point(
        point.x === 0 ? 0 : Math.abs(point.x) / point.x,
        point.y === 0 ? 0 : Math.abs(point.y) / point.y
      );
    }

    function getManhattanDistance(p1: Point, p2: Point) {
      return Math.abs(p2.x - p1.x) + Math.abs(p2.y - p1.y);
    }

    function toPointFromString(pointString: string) {
      const xy = pointString.split(pointString.indexOf('@') === -1 ? ' ' : '@');
      return new Point(parseInt(xy[0], 10), parseInt(xy[1], 10))
    }

    function pointToString(point: Point) {
      return `${point.x}@${point.y}`;
    }

    function getCellAbsoluteBounds(cellState: CellState) {
      const graph = cellState.view.graph;
      const cellBounds = graph.getCellBounds(cellState.cell, false, false)?.clone();
      if (!cellBounds)
        return undefined;
      const view = graph.view;
      const { scale, translate } = view;
      const { x, y } = translate;
      const round = (v: number) => Math.round(v * 10) / 10;
      const res = new Rectangle(
        round((cellBounds.x / scale) - x),
        round((cellBounds.y / scale) - y),
        round(cellBounds.width / scale),
        round(cellBounds.height / scale),
      );

      return res;
    }

    const mStep = EdgeStyle.MANHATTAN_STEP;

    const config = {
      // Padding applied on the element bounding boxes
      paddingBox: EdgeStyle.MANHATTAN_PADDING_BOX,

      // An array of directions to find next points on the route
      directions: [
        { offsetX: mStep, offsetY: 0, cost: mStep, angle: normalizeAngle(getPointTheta(new Point(0, 0), new Point(mStep, 0))) },
        { offsetX: 0, offsetY: mStep, cost: mStep, angle: normalizeAngle(getPointTheta(new Point(0, 0), new Point(0, mStep))) },
        { offsetX: -mStep, offsetY: 0, cost: mStep, angle: normalizeAngle(getPointTheta(new Point(0, 0), new Point(-mStep, 0))) },
        { offsetX: 0, offsetY: -mStep, cost: mStep, angle: normalizeAngle(getPointTheta(new Point(0, 0), new Point(0, -mStep))) }
      ],

      directionMap: {
        "east": { x: 1, y: 0 },
        "south": { x: 0, y: 1 },
        "west": { x: -1, y: 0 },
        "north": { x: 0, y: -1 }
      },

      // A penalty received for direction change
      penaltiesGenerator: (angle: number) => {
        if (angle == 45 || angle == 90 || angle == 180)
          return EdgeStyle.MANHATTAN_STEP / 2;
        return 0;
      },
      // If a function is provided, it's used to route the link while dragging an end
      // i.e. function(from, to, opts) { return []; }
      draggingRoute: null,

      previousDirAngle: 0
    };

    /**
     * Map of obstacles
     * Helper structure to identify whether a point lies in an obstacle.
     */
    class ObstacleMap {
      map: Map<string, Rectangle[]>;
      options: typeof config;
      // tells how to divide the paper when creating the elements map
      mapGridSize: number;
      constructor(opt: any) {
        this.options = opt;
        this.mapGridSize = 100;
        this.map = new Map();
      }

      // Builds a map of all elements for quicker obstacle queries
      // The svg is divided to  cells, where each of them holds an information which
      // elements belong to it. When we query whether a point is in an obstacle we don't need
      // to go through all obstacles, we check only those in a particular cell.
      build(source: CellState | null, target: CellState | null) {
        const graph = source?.view.graph || target?.view.graph;
        if (!graph)
          return;
        return Array.from(graph.getView().getCellStates())
          .filter(s => s.cell && s.cell.isVertex() && !s.cell.isEdge())
          .map(s => getCellAbsoluteBounds(s))
          .map(bbox => bbox ? moveAndExpand(bbox, this.options.paddingBox) : null)
          .forEach(bbox => {
            if (!bbox)
              return;

            const origin = snapPointToGrid(new Point(bbox.x, bbox.y), this.mapGridSize);
            const corner = snapPointToGrid(new Point(bbox.x + bbox.width, bbox.y + bbox.height), this.mapGridSize);

            for (let x = origin.x; x <= corner.x; x += this.mapGridSize) {
              for (let y = origin.y; y <= corner.y; y += this.mapGridSize) {
                const gridKey = x + '@' + y;

                const rectArr = this.map.get(gridKey) || [];
                if (!this.map.has(gridKey))
                  this.map.set(gridKey, rectArr);
                rectArr.push(bbox);
              }
            }
          });
      }

      isPointAccessible(point: Point): boolean {
        const mapKey = pointToString(snapPointToGrid(point.clone(), this.mapGridSize));
        const obstacles = this.map.get(mapKey);
        if (obstacles) {
          return obstacles.every(obstacle => !isPointInRectangle(obstacle, point))
        }
        return true;
      }
    }

    class SortedSet {
      items: string[];

      hash: Map<string, { value: number; open: boolean }>;

      constructor() {
        this.items = [];
        this.hash = new Map();
      }

      add(key: string, value: number) {
        const hashItem = this.hash.get(key);
        if (hashItem) {
          hashItem.value = value;
          this.items.splice(this.items.indexOf(key), 1);
        } else {
          this.hash.set(key, {
            value,
            open: true
          });
        }

        this.items.push(key);
        this.items.sort((i1, i2) => {
          const hashItem1 = this.hash.get(i1);
          const hashItem2 = this.hash.get(i2);
          if (!hashItem1 || !hashItem2)
            return 0;
          return hashItem1.value - hashItem2.value});
      };

      remove(key: string) {
        const hashItem = this.hash.get(key);
        if (hashItem)
          hashItem.open = false;
      }

      isOpen(key: string) {
        const hashItem = this.hash.get(key);
        return hashItem && hashItem.open == true;
      }

      isClose(key: string) {
        const hashItem = this.hash.get(key);
        return hashItem && hashItem.open == false;
      }

      isEmpty() {
        return this.items.length == 0;
      }

      pop(): string | undefined {
        const key = this.items.shift();
        if (key)
          this.remove(key);
        return key;
      }
    }

    function reconstructRoute(parents: { [key: string]: Point }, endPoint: Point, startCenter: Point, endCenter: Point) {
      const route: Point[] = [];
      let previousDirection = normalizePoint(getDifferencePoint(endCenter, endPoint));
      let current = endPoint;
      let parent;

      while (parents[pointToString(current)]) {
        parent = parents[pointToString(current)]
        if (!parent)
          continue;
        const direction = normalizePoint(getDifferencePoint(current, parent));

        // Add point in when direction change
        if (!direction.equals(previousDirection)) {
          route.unshift(current);
          previousDirection = direction;
        }
        current = parent;
      }

      const startDirection = normalizePoint(getDifferencePoint(current, startCenter));
      if (!startDirection.equals(previousDirection)) {
        route.unshift(current);
      }

      return route;
    }

    function getRectPoints(bbox: Rectangle, directionList: DIRECTION[], opt: typeof config): Point[] {
      const step = EdgeStyle.MANHATTAN_STEP;
      const center = getRectangleCenter(bbox);
      const res: Point[] = [];
      for (const direction of directionList) {
        const directionPoint = opt.directionMap[direction];

        const x = directionPoint.x * bbox.width / 2;
        const y = directionPoint.y * bbox.height / 2;

        const point = movePoint(center.clone(), x, y);

        if (isPointInRectangle(bbox, point)) {
          movePoint(point, directionPoint.x * step, directionPoint.y * step);
        }

        res.push(snapPointToGrid(point, step));

      };
      return res;
    }

    function normalizeAngle(angle: number) {
      return (angle % 360) + (angle < 0 ? 360 : 0);
    };

    function getDirectionAngle(start: Point, end: Point, directionLength: number) {
      const q = 360 / directionLength;
      return Math.floor(normalizeAngle(getPointTheta(start, end) + q / 2) / q) * q;
    }

    function getDirectionChange(angle1: number, angle2: number) {
      const dirChange = Math.abs(angle1 - angle2);
      return dirChange > 180 ? 360 - dirChange : dirChange;
    }

    function estimateCost(from: Point, endPoints: Point[]) {
      let min = Infinity;

      for (let i = 0, len = endPoints.length; i < len; i++) {
        const cost = getManhattanDistance(from, endPoints[i]);
        if (cost < min)
          min = cost;
      }

      return min;
    }

    function alignPointToCell(point: Point, edgeState: CellState, cellState: CellState, isSourceCell: boolean) {
      const cellBounds = getCellAbsoluteBounds(cellState);

      const y = isSourceCell
        ? edgeState.style.exitY
        : edgeState.style.entryY;
      const onlyHorizontalDirections = isSourceCell
        ? EdgeStyle.MANHATTAN_START_DIRECTIONS.every(d => d != DIRECTION.NORTH && d != DIRECTION.SOUTH)
        : EdgeStyle.MANHATTAN_END_DIRECTIONS.every(d => d != DIRECTION.NORTH && d != DIRECTION.SOUTH)

      if (y != undefined && onlyHorizontalDirections) {
        const cellHeight = cellBounds?.height || 0;
        point.y = cellBounds?.y != undefined
          ? cellBounds?.y + cellHeight * y
          : point.y - cellHeight / 2 + cellHeight * y;
      }

      const x = isSourceCell
        ? edgeState.style.exitX
        : edgeState.style.entryX;
      const onlyVerticalDirections = isSourceCell
        ? EdgeStyle.MANHATTAN_START_DIRECTIONS.every(d => d != DIRECTION.WEST && d != DIRECTION.EAST)
        : EdgeStyle.MANHATTAN_END_DIRECTIONS.every(d => d != DIRECTION.WEST && d != DIRECTION.EAST)
      if (x != undefined && onlyVerticalDirections) {
        const cellWidth = cellBounds?.width || 0;
        point.x = cellBounds?.x != undefined
          ? cellBounds?.x + cellWidth * x
          : point.x - cellWidth / 2 + cellWidth * (x || 0);
      }
    }

    function findRoute(start: Rectangle, end: Rectangle, obstacleMap: ObstacleMap, opt: typeof config) {
      // Caculate start points and end points
      const step = EdgeStyle.MANHATTAN_STEP;
      const startPoints = getRectPoints(start, EdgeStyle.MANHATTAN_START_DIRECTIONS, opt)
        .filter(p => obstacleMap.isPointAccessible(p));

      const startCenter = snapPointToGrid(getRectangleCenter(start), step);
      const endPoints = getRectPoints(end, EdgeStyle.MANHATTAN_END_DIRECTIONS, opt)
        .filter(p => obstacleMap.isPointAccessible(p));
      const endCenter = snapPointToGrid(getRectangleCenter(end), step);
      if (startPoints.length > 0 && endPoints.length > 0) {

        // The set of possible  points to be evaluated, initially containing the start points.
        const openSet = new SortedSet();
        // Keeps predecessor of given element.
        const parents: { [key: string]: Point } = {};
        // Cost from start to a point along best known path.
        const costs: { [key: string]: number } = {};

        startPoints.forEach(p => {
          const key = pointToString(p);
          openSet.add(key, estimateCost(p, endPoints));
          costs[key] = 0;
        });
        let loopsRemain = EdgeStyle.MANHATTAN_MAXIMUM_LOOPS;
        const endPointsKeys = endPoints.map(p => pointToString(p));
        let currentDirectionAngle: number | undefined;
        let previousDirectionAngle: number | undefined;
        // Main route finding loop
        while (!openSet.isEmpty() && loopsRemain > 0) {
          const currentKey = openSet.pop();
          if (currentKey == undefined) {
            continue;
          }

          const currentPoint = toPointFromString(currentKey);
          const currentCost = costs[currentKey];
          previousDirectionAngle = currentDirectionAngle;
          currentDirectionAngle = parents[currentKey]
            ? getDirectionAngle(parents[currentKey], currentPoint, opt.directions.length)
            : opt.previousDirAngle != 0 ? opt.previousDirAngle : getDirectionAngle(startCenter, currentPoint, opt.directions.length);

          // if get the endpoint
          if (endPointsKeys.indexOf(currentKey) >= 0) {
            // stop route to enter the end point in opposite direction.
            const directionChangedAngle = getDirectionChange(currentDirectionAngle, getDirectionAngle(currentPoint, endCenter, opt.directions.length));
            if (currentPoint.equals(endCenter) || directionChangedAngle < 180) {
              opt.previousDirAngle = currentDirectionAngle;
              return reconstructRoute(parents, currentPoint, startCenter, endCenter);
            }
          }

          // Go over all possible directions and find neighbors.
          for (let i = 0; i < opt.directions.length; i++) {
            const direction = opt.directions[i];
            const directionChangedAngle = getDirectionChange(currentDirectionAngle, direction.angle);
            if (previousDirectionAngle && directionChangedAngle > EdgeStyle.MANHATTAN_MAX_ALLOWED_DIRECTION_CHANGE) {
              continue;
            }

            const neighborPoint = movePoint(currentPoint.clone(), direction.offsetX, direction.offsetY);
            const neighborKey = pointToString(neighborPoint);
            if (openSet.isClose(neighborKey) || !obstacleMap.isPointAccessible(neighborPoint)) {
              continue;
            }

            const costFromStart = currentCost + direction.cost + opt.penaltiesGenerator(directionChangedAngle);

            if (!openSet.isOpen(neighborKey) || costFromStart < costs[neighborKey]) {
              // Neighbor point has not been processed yet or the cost of the path
              // from start is lesser than previously calcluated.
              parents[neighborKey] = currentPoint;
              costs[neighborKey] = costFromStart;
              openSet.add(neighborKey, costFromStart + estimateCost(neighborPoint, endPoints));
            }
          }

          loopsRemain--;
        }
        return null;
      }
      return null;
    }

    function router(
      state: CellState,
      source: CellState,
      target: CellState,
      points: Point[],
      result: Point[],
      opt: typeof config
    ) {
      // If edge is dragged after calculation, points will be filled, so fallback to SegmentConnector
      if ((points != null && points.length > 0) || source == null || target == null) {
        EdgeStyle.SegmentConnector(state, source, target, points, result);
        return;
      }

      let sourceBBox = getCellAbsoluteBounds(source);
      sourceBBox = sourceBBox ? moveAndExpand(sourceBBox, opt.paddingBox) : undefined;
      let targetBBox = getCellAbsoluteBounds(target);
      targetBBox = targetBBox ? moveAndExpand(targetBBox, opt.paddingBox) : undefined;
      const obstacleMap = new ObstacleMap(opt);

      obstacleMap.build(source, target);
      if (!sourceBBox || !targetBBox) {
        // Fallback to OrthConnector
        return EdgeStyle.OrthConnector(state, source, target, points, result);
      }
      const routePoints = findRoute(sourceBBox, targetBBox, obstacleMap, opt);

      if (routePoints == null || routePoints.length == 0) {
        // Fallback to OrthConnector
        return EdgeStyle.OrthConnector(state, source, target, points, result);
      }
      if (state.style) {
        if (state.visibleSourceState && routePoints.length > 0) {
          // If there are at least one point, align it to source cell
          alignPointToCell(routePoints[0], state, state.visibleSourceState, true)
        }

        if (state.visibleTargetState && routePoints.length > 1) {
          // If there are more than one point, align last point to target cell
          alignPointToCell(routePoints[routePoints.length - 1], state, state.visibleTargetState, false)
        }
      }

      // Scaling and translating result points
      const scale = state.view.scale;
      routePoints.forEach(pt => result.push(new Point(
        Math.round((pt.x + state.view.translate.x) * scale * 10) / 10,
        Math.round((pt.y + state.view.translate.y) * scale * 10) / 10
      )));
    }

    router(state, source, target, points, result, config);
  }

  static getRoutePattern(
    dir: number[],
    quad: number,
    dx: number,
    dy: number
  ): number[] | null {
    let sourceIndex = dir[0] === DIRECTION_MASK.EAST ? 3 : dir[0];
    let targetIndex = dir[1] === DIRECTION_MASK.EAST ? 3 : dir[1];

    sourceIndex -= quad;
    targetIndex -= quad;

    if (sourceIndex < 1) {
      sourceIndex += 4;
    }
    if (targetIndex < 1) {
      targetIndex += 4;
    }

    let result: number[] | null =
      EdgeStyle.routePatterns[sourceIndex - 1][targetIndex - 1];

    if (dx === 0 || dy === 0) {
      if (EdgeStyle.inlineRoutePatterns[sourceIndex - 1][targetIndex - 1] != null) {
        result = EdgeStyle.inlineRoutePatterns[sourceIndex - 1][targetIndex - 1];
      }
    }
    return result;
  }
}

export default EdgeStyle;

