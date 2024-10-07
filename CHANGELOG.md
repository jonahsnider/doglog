# Changelog

## [2024.6.0](https://github.com/jonahsnider/doglog/compare/2024.5.8...2024.6.0) (2024-10-07)


### Features

* add DogLog.timestamp() convenience method ([710b091](https://github.com/jonahsnider/doglog/commit/710b0911542d4f7ddf72714786bd25f50ff2fad9))


### Bug Fixes

* update faults logging to ignore faults with null as a name ([0343b89](https://github.com/jonahsnider/doglog/commit/0343b89fe0c1be5a7900e6946a848df6bcf52853))


### Performance Improvements

* improve struct logging performance by removing redundant `DataLog#addSchema()` code ([91d60b0](https://github.com/jonahsnider/doglog/commit/91d60b04c96c56dc17a5ac30e70b5142e774c8ad))

## [2024.5.8](https://github.com/jonahsnider/doglog/compare/2024.5.7...2024.5.8) (2024-08-03)


### Bug Fixes

* fix `ntPublish` option being ignored when changing `logEntryQueueCapacity` option ([b53ae87](https://github.com/jonahsnider/doglog/commit/b53ae87cf33c9e7d6adba469d7e04ba0d06c158b))
* remove unused wpilibNewCommands dependency ([d5c0d2a](https://github.com/jonahsnider/doglog/commit/d5c0d2aa08a6332e3e2da4a4c6f893581216bcdd))


### Performance Improvements

* improve performance and memory overhead of struct logging ([39ed23e](https://github.com/jonahsnider/doglog/commit/39ed23e7b733ee15482b445e6ffcb80f2ef56f75)), closes [#37](https://github.com/jonahsnider/doglog/issues/37)

## [2024.5.7](https://github.com/jonahsnider/doglog/compare/2024.5.6...2024.5.7) (2024-08-02)


### Bug Fixes

* fix applying `captureDs` option with default value ([d3662a5](https://github.com/jonahsnider/doglog/commit/d3662a5badb7ca88db44010d4d155d4a59a92a36)), closes [#33](https://github.com/jonahsnider/doglog/issues/33)

## [2024.5.6](https://github.com/jonahsnider/doglog/compare/2024.5.5...2024.5.6) (2024-07-29)


### Bug Fixes

* fix how PDH currents are extracted ([1c7a002](https://github.com/jonahsnider/doglog/commit/1c7a00294049e2578b9bbb2bd3d79b136c6c0a1c))


### Performance Improvements

* replace many pdh.getCurrent() calls with one pdh.getAllCurrents() call when logging PDH currents ([7262425](https://github.com/jonahsnider/doglog/commit/72624252647af3d4f4a887191bb855d0a1c139e5))

## [2024.5.5](https://github.com/jonahsnider/doglog/compare/2024.5.4...2024.5.5) (2024-07-27)


### Bug Fixes

* stop automatically logging PDH to avoid CAN errors ([22340bf](https://github.com/jonahsnider/doglog/commit/22340bf802db8a4795a99c0f5420292a55151d3e))

## [2024.5.4](https://github.com/jonahsnider/doglog/compare/2024.5.3...2024.5.4) (2024-07-27)


### Performance Improvements

* improve performance when processing queued log entries ([9c95541](https://github.com/jonahsnider/doglog/commit/9c9554180c39b127828e5b449a141bdb7a0ac445))

## [2024.5.3](https://github.com/jonahsnider/doglog/compare/2024.5.2...2024.5.3) (2024-07-22)


### Bug Fixes

* improve error handling when instantiating `PowerDistribution` ([3256e6f](https://github.com/jonahsnider/doglog/commit/3256e6f854cb3ee3eea720faf04e702e7f4372f3))
* increase default log entry queue capacity from 500 to 1000 ([9b1549a](https://github.com/jonahsnider/doglog/commit/9b1549aaf70f7e1d53c886a006193e228445986d))

## [2024.5.2](https://github.com/jonahsnider/doglog/compare/v2024.5.1...2024.5.2) (2024-07-13)


### Bug Fixes

* fix version field in vendordep.json ([8c59d1f](https://github.com/jonahsnider/doglog/commit/8c59d1ff686d31aa4789d6eb444858fb6c6faf53))

## [2024.5.1](https://github.com/jonahsnider/doglog/compare/v2024.5.0...v2024.5.1) (2024-07-11)


### Bug Fixes

* fix a potential crash due to a feedback loop in the `LogQueuer#printQueueFullMessage()` method ([cfef1e9](https://github.com/jonahsnider/doglog/commit/cfef1e93fa547f88baba6115ebb3dba33b7d6dcc))

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
