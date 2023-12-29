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

import Point from '../../geometry/Point';
import type CellState from '../../cell/CellState';

export const routePatterns = [
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

export const inlineRoutePatterns = [
  [null, [2114, 2568], null, null],
  [null, [514, 2081, 2114, 2568], null, null],
  [null, [2114, 2561], null, null],
  [[2081, 2562], [1057, 2114, 2568], [2184, 2562], null],
];

/**
 * Scales an array of {@link Point}
 *
 * @param points array of {@link Point} to scale
 * @param scale the scaling to divide by
 */
export function scalePointArray(points: Point[], scale: number): (Point | null)[] | null {
  let result: (Point | null)[] | null = [];

  if (points != null) {
    for (let i = 0; i < points.length; i += 1) {
      if (points[i] != null) {
        result[i] = new Point(
          Math.round((points[i].x / scale) * 10) / 10,
          Math.round((points[i].y / scale) * 10) / 10
        );
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
 * Scales an {@link CellState}.
 *
 * @param state {@link CellState} to scale
 * @param scale the scaling to divide by
 */
export function scaleCellState(state: CellState, scale: number): CellState | null {
  let result = null;

  if (state != null) {
    result = state.clone();
    result.setRect(
      Math.round((state.x / scale) * 10) / 10,
      Math.round((state.y / scale) * 10) / 10,
      Math.round((state.width / scale) * 10) / 10,
      Math.round((state.height / scale) * 10) / 10
    );
  }

  return result;
}
