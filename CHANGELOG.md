# Changelog

## [2024.5.0](https://github.com/jonahsnider/doglog/compare/v2024.4.1...v2024.5.0) (2024-05-23)


### Features

* add faults logging ([#18](https://github.com/jonahsnider/doglog/issues/18)) ([36da269](https://github.com/jonahsnider/doglog/commit/36da26928eae647810467617c28ff0026a32840f))

## [2024.4.1](https://github.com/jonahsnider/doglog/compare/v2024.4.0...v2024.4.1) (2024-05-03)


### Bug Fixes

* fix logging `int[]`s ([3f869c9](https://github.com/jonahsnider/doglog/commit/3f869c952cfa3560b193d03fbe8d86a64222f341))

## [2024.4.0](https://github.com/jonahsnider/doglog/compare/v2024.3.0...v2024.4.0) (2024-05-03)


### Features

* use separate thread for DataLog and NT operations ([#14](https://github.com/jonahsnider/doglog/issues/14)) ([edd45db](https://github.com/jonahsnider/doglog/commit/edd45db2605bf09f6f5b30a94e098d3a7fc8f5dc))

## [2024.3.0](https://github.com/jonahsnider/doglog/compare/v2024.2.1...v2024.3.0) (2024-04-27)


### Features

* add support for logging extras ([6180898](https://github.com/jonahsnider/doglog/commit/618089889d5d3f697e07ecdbd818ed546ab8626b)), closes [#12](https://github.com/jonahsnider/doglog/issues/12)


### Bug Fixes

* fix logging numeric values that start off as 0 ([6c17bc5](https://github.com/jonahsnider/doglog/commit/6c17bc5019a6cb5c7941b90dc713587ab4f93b8e))

## [2024.2.1](https://github.com/jonahsnider/doglog/compare/v2024.2.0...v2024.2.1) (2024-04-27)


### Bug Fixes

* fix struct arrays not appearing in log files ([cb4ac04](https://github.com/jonahsnider/doglog/commit/cb4ac045b3a4677473c4dfdc04e5a0bdc84305e7))
* remove unhelpful DogLog.log() overloads for structs ([fe4c14d](https://github.com/jonahsnider/doglog/commit/fe4c14d6e858c97309a454f390b32f764f16bfb5))

## [2024.2.0](https://github.com/jonahsnider/doglog/compare/v2024.1.0...v2024.2.0) (2024-04-27)


### Features

* reduce log file size with change detection ([#8](https://github.com/jonahsnider/doglog/issues/8)) ([e291715](https://github.com/jonahsnider/doglog/commit/e291715cc418571fe4e4975a31c3d5e31a2c0fea))


### Bug Fixes

* instantiate DataLogManager after configuring NetworkTables capture behavior ([0bbaabb](https://github.com/jonahsnider/doglog/commit/0bbaabbb91746c76d4df5c1d2abdba144dc6401e))

## [2024.1.0](https://github.com/jonahsnider/doglog/compare/v2024.0.0...v2024.1.0) (2024-04-27)


### Features

* initial commit ([fac012c](https://github.com/jonahsnider/doglog/commit/fac012cfcf8e1d4afd38437d2292e90c7dc9a675))
