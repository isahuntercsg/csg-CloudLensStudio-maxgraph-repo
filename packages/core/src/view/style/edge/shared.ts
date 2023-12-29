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
