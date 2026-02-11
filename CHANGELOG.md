# Changelog

## [2026.5.0](https://github.com/jonahsnider/doglog/compare/2026.4.0...2026.5.0) (2026-02-11)


### Features

* gracefully handle WPILib's broken struct generation for enums ([ace84eb](https://github.com/jonahsnider/doglog/commit/ace84eb7ce66210354021ef8a2e8b8283bc05c68))

## [2026.4.0](https://github.com/jonahsnider/doglog/compare/2026.3.1...2026.4.0) (2026-01-25)


### Features

* add tunable double arrays ([0fc4622](https://github.com/jonahsnider/doglog/commit/0fc46229256a0d1c1fa174cb66740c231d2c5da0))

## [2026.3.1](https://github.com/jonahsnider/doglog/compare/2026.3.0...2026.3.1) (2026-01-20)


### Bug Fixes

* register Commands as composed once in DogLog.time() ([#153](https://github.com/jonahsnider/doglog/issues/153)) ([4a20e0c](https://github.com/jonahsnider/doglog/commit/4a20e0c20d69eec0a90afbfbbcf1d28934729507))

## [2026.3.0](https://github.com/jonahsnider/doglog/compare/2026.2.0...2026.3.0) (2026-01-13)


### Features

* support forced NetworkTables publishing for some logs ([#150](https://github.com/jonahsnider/doglog/issues/150)) ([ef44414](https://github.com/jonahsnider/doglog/commit/ef444146d17ec49fb3d7d3d8117d9898b61d3192))

## [2026.2.0](https://github.com/jonahsnider/doglog/compare/2026.1.0...2026.2.0) (2026-01-09)


### Features

* update to stable release of WPILib 2026 ([#147](https://github.com/jonahsnider/doglog/issues/147)) ([9c2bb1e](https://github.com/jonahsnider/doglog/commit/9c2bb1e3fda59cb76a0f58e6e4ff9113e7606705))

## [2026.1.0](https://github.com/jonahsnider/doglog/compare/2026.0.1...2026.1.0) (2025-12-23)


### Features

* add logging of enums and records using StructGenerator ([#146](https://github.com/jonahsnider/doglog/issues/146)) ([98653a5](https://github.com/jonahsnider/doglog/commit/98653a5bb3e6e8a769ef3337856e2014d0b75ae4))


### Bug Fixes

* provide timestamp when updating datalog unit metadata ([de590f4](https://github.com/jonahsnider/doglog/commit/de590f48c4444e41b3e3607f4e37263003dc727b))

## [2026.0.1](https://github.com/jonahsnider/doglog/compare/2026.0.0...2026.0.1) (2025-11-19)


### Bug Fixes

* change frcYear to 2026beta ([a38ff20](https://github.com/jonahsnider/doglog/commit/a38ff20c4909880dab9f2e4c7afc06547684568c))

## [2026.0.0](https://github.com/jonahsnider/doglog/compare/2025.10.1...2026.0.0) (2025-11-19)


### ⚠ BREAKING CHANGES

* update to WPILib 2026 ([#139](https://github.com/jonahsnider/doglog/issues/139))

### Features

* update to WPILib 2026 ([#139](https://github.com/jonahsnider/doglog/issues/139)) ([853b085](https://github.com/jonahsnider/doglog/commit/853b085fb8629742444bcd95fd8f43aab51cf7ca))

## [2025.10.1](https://github.com/jonahsnider/doglog/compare/2025.10.0...2025.10.1) (2025-10-25)


### Bug Fixes

* build with JDK 21 ([c667579](https://github.com/jonahsnider/doglog/commit/c6675790631d1274098f9f9a9978ab3f73acf203))

## [2025.10.0](https://github.com/jonahsnider/doglog/compare/2025.9.2...2025.10.0) (2025-10-25)


### Features

* support including units in logged numbers ([#128](https://github.com/jonahsnider/doglog/issues/128)) ([14b4851](https://github.com/jonahsnider/doglog/commit/14b485134d37a521199f112eac0ad87b3aae4e09))
* support toggling log processing thread on or off ([#125](https://github.com/jonahsnider/doglog/issues/125)) ([9a96247](https://github.com/jonahsnider/doglog/commit/9a962472e3e8c5c5bbd07472c06bdebdad513be5))

## [2025.9.2](https://github.com/jonahsnider/doglog/compare/2025.9.1...2025.9.2) (2025-09-05)

### Bug Fixes

- fix NullPointerException when dispatching tunable onChange events ([d022a75](https://github.com/jonahsnider/doglog/commit/d022a75a4e7f5e04bcdb189f207f33ecef0ebc6b))

## [2025.9.1](https://github.com/jonahsnider/doglog/compare/2025.9.0...2025.9.1) (2025-03-30)

### Bug Fixes

- prevent NT capture from being enabled before DogLog init finishes ([c3cf42e](https://github.com/jonahsnider/doglog/commit/c3cf42e1f620d4f1465ff8dee23f5f7258bdf23b))

## [2025.9.0](https://github.com/jonahsnider/doglog/compare/2025.8.1...2025.9.0) (2025-03-26)

### Features

- improve functionality of DogLog.time() for commands ([ad58793](https://github.com/jonahsnider/doglog/commit/ad587939aee3201020768cfb85eb868a93888252))

## [2025.8.1](https://github.com/jonahsnider/doglog/compare/2025.8.0...2025.8.1) (2025-03-25)

### Bug Fixes

- make DogLog.time() for commands static ([6c5064b](https://github.com/jonahsnider/doglog/commit/6c5064b0378bfcee5d0babbc83b576af83044518))

## [2025.8.0](https://github.com/jonahsnider/doglog/compare/2025.7.1...2025.8.0) (2025-03-25)

### Features

- add DogLog.time() and DogLog.timeEnd() ([dec65f3](https://github.com/jonahsnider/doglog/commit/dec65f313382fcfcd67095bef13d6433b08dcbbf))
- add DogLog.time() overload for timing commands ([10deabc](https://github.com/jonahsnider/doglog/commit/10deabc75ca950994172218ab0e1cfb66327854a))
- mark DogLog as source in DataLog entry metadata ([0dff3d2](https://github.com/jonahsnider/doglog/commit/0dff3d2bf8e60445bc6d087f055fa98dbbe3a9c4))
- mark DogLog as source in NetworkTables topic properties ([224fc37](https://github.com/jonahsnider/doglog/commit/224fc375148563fa9746f45290bf882c46590944))

### Bug Fixes

- fix incorrect implementation of getLastChange() in toggleable subscriber classes ([a2eb98d](https://github.com/jonahsnider/doglog/commit/a2eb98d783335b236a0bb8e8d7380c6cd8f6b6e1))
- fix onChange logic for tunables when repeatedly toggling ntTunables ([714ebbe](https://github.com/jonahsnider/doglog/commit/714ebbec6a58f5ff0228bf327b8d764a0d15d0d4))
- synchronize DataLog entry timestamp with value update timestamp ([a9a82c7](https://github.com/jonahsnider/doglog/commit/a9a82c72dd130f87b8c1e00abf4d35d95f1cebb1))

## [2025.7.1](https://github.com/jonahsnider/doglog/compare/2025.7.0...2025.7.1) (2025-03-24)

### Bug Fixes

- fix options in Tunable being null until setOptions() is called ([bdb570f](https://github.com/jonahsnider/doglog/commit/bdb570f55f184f77a159ba2f7516db93a1f826a5))

## [2025.7.0](https://github.com/jonahsnider/doglog/compare/2025.6.0...2025.7.0) (2025-03-24)

### Features

- expose Subscriber interface in DogLog.tunable() ([2af286e](https://github.com/jonahsnider/doglog/commit/2af286e1b1fadae779ddf15b1f426806676a5b95))

## [2025.6.0](https://github.com/jonahsnider/doglog/compare/2025.5.0...2025.6.0) (2025-03-24)

### Features

- support disabling tunable values over NT ([#80](https://github.com/jonahsnider/doglog/issues/80)) ([4b7ccdd](https://github.com/jonahsnider/doglog/commit/4b7ccdd1a6dddeca9f26ea1dc0d1b498de0b76eb))

## [2025.5.0](https://github.com/jonahsnider/doglog/compare/2025.4.0...2025.5.0) (2025-03-22)

### Features

- add DogLog.tunable() API ([#79](https://github.com/jonahsnider/doglog/issues/79)) ([ab93412](https://github.com/jonahsnider/doglog/commit/ab934121b87c1e9c16fc5631fcfbc599aa64fa07))

### Bug Fixes

- fix bug where extras logging would be disabled after DogLog.setOptions() ([52f7423](https://github.com/jonahsnider/doglog/commit/52f742375983030a87ea8bc1794e05fe015f7598))
- make DogLog Tunable instance protected ([f53a729](https://github.com/jonahsnider/doglog/commit/f53a729d13190639c6bd05c567dce986446f3e8f))

## [2025.4.0](https://github.com/jonahsnider/doglog/compare/2025.3.1...2025.4.0) (2025-03-09)

### Features

- add DogLog.isEnabled() ([417eedb](https://github.com/jonahsnider/doglog/commit/417eedba201effc63df1ff0e660110780b4f945e)), closes [#75](https://github.com/jonahsnider/doglog/issues/75)

## [2025.3.1](https://github.com/jonahsnider/doglog/compare/2025.3.0...2025.3.1) (2025-03-02)

### Bug Fixes

- fix potential NullPointerException in radio logger thread ([195d2f7](https://github.com/jonahsnider/doglog/commit/195d2f7b853e9248b956ecb3d4f65e4f35eb418f))

## [2025.3.0](https://github.com/jonahsnider/doglog/compare/2025.2.1...2025.3.0) (2025-01-12)

### Features

- add method for fully clearing a fault ([25232d7](https://github.com/jonahsnider/doglog/commit/25232d77ccb7e36583999f18596e741e714ff8a3))
- log Alerts from NT to DataLog when extras logging is enabled ([9e5bcbf](https://github.com/jonahsnider/doglog/commit/9e5bcbf91500c2f326f791423350fc1d3fa39ce0))
- report DogLog usage via HAL ([80c7bb3](https://github.com/jonahsnider/doglog/commit/80c7bb3eb736750bc82fc618c0fdac1394525e2a)), closes [#71](https://github.com/jonahsnider/doglog/issues/71)
- support reporting faults as WPILib alerts ([ea15a6f](https://github.com/jonahsnider/doglog/commit/ea15a6f9f49b7c8abba91ec9ef2eab10bee658aa))
- use a supplier for ntPublish option ([#65](https://github.com/jonahsnider/doglog/issues/65)) ([19b0902](https://github.com/jonahsnider/doglog/commit/19b09020362233109019657094cd9597fb8804f7))

## [2025.2.1](https://github.com/jonahsnider/doglog/compare/2025.2.0...2025.2.1) (2024-12-11)

### Bug Fixes

- fix multiple `Notifier`s being created for extras & radio logging ([a5e0496](https://github.com/jonahsnider/doglog/commit/a5e0496bc9aa4ec5289836b314d60741e98f4212))

## [2025.2.0](https://github.com/jonahsnider/doglog/compare/2025.1.1...2025.2.0) (2024-12-06)

### Features

- allow logging strings with custom types ([2171e06](https://github.com/jonahsnider/doglog/commit/2171e061c4508d2145b4ac44d77a122ac123fe30))
- log radio connection status when extras logging is enabled ([5a9497e](https://github.com/jonahsnider/doglog/commit/5a9497e2f1898652bab731e243dc81b7414379c7))

### Bug Fixes

- use consistent timestamps between NT and DataLog ([50fa6d2](https://github.com/jonahsnider/doglog/commit/50fa6d252dac5ddf2893685d96c943212ef8df78))

### Performance Improvements

- improve performance of periodic extras logging ([ba2b235](https://github.com/jonahsnider/doglog/commit/ba2b2354c04866210e52a644bd59ca057215bd3e))

## [2025.1.1](https://github.com/jonahsnider/doglog/compare/2025.1.0...2025.1.1) (2024-11-22)

### Bug Fixes

- fix memory leak from enabling and then disabling ntPublish mode ([2289c01](https://github.com/jonahsnider/doglog/commit/2289c013212c2116dec3878923caa67da3e3f544))
- fix potential stack size exceeded error when first logs overflows ([c82e36b](https://github.com/jonahsnider/doglog/commit/c82e36bd744316ab791852f7d8b43bafd45fab88)), closes [#58](https://github.com/jonahsnider/doglog/issues/58)

## [2025.1.0](https://github.com/jonahsnider/doglog/compare/2025.0.0...2025.1.0) (2024-10-24)

### Features

- add UNSAFE_LOG_DESTINATION warning when no log USB present on roboRIO 1 ([f2dc0ce](https://github.com/jonahsnider/doglog/commit/f2dc0ced739a67564dbb4e006b748ad097b17a3b)), closes [#51](https://github.com/jonahsnider/doglog/issues/51)

### Bug Fixes

- improve names of logger errors and warnings ([de43c6e](https://github.com/jonahsnider/doglog/commit/de43c6e7878a1c05a761bc04d2c167daa78eafd5))
- improve performance of logging faults ([8cd7d07](https://github.com/jonahsnider/doglog/commit/8cd7d074b24c1cbaa82076ef52626296ded71d41))

### Performance Improvements

- reduce GC pressure caused by logging CAN status ([488cf84](https://github.com/jonahsnider/doglog/commit/488cf84f5550929ec4f269743b44bd2d666aa6a8))

## [2025.0.0](https://github.com/jonahsnider/doglog/compare/2024.6.0...2025.0.0) (2024-10-21)

### ⚠ BREAKING CHANGES

- remove AdvantageKitCompatibleLogger
- upgrade WPILib to 2025

### Features

- remove AdvantageKitCompatibleLogger ([023505a](https://github.com/jonahsnider/doglog/commit/023505acac7415195c1e2d94c85146dcc74cd69a))
- support capturing console output to log file ([d0bdcea](https://github.com/jonahsnider/doglog/commit/d0bdcea4a8304435a84466a4a5a7681c95405887))
- upgrade WPILib to 2025 ([f1923ff](https://github.com/jonahsnider/doglog/commit/f1923ff0bc2025e8d7f981a865bad9131c964106))
- use native change detection ([33b0337](https://github.com/jonahsnider/doglog/commit/33b0337bb78ae47916f1059f4a8ced1a897393c7))

### Performance Improvements

- replace many pdh.getCurrent() calls with one pdh.getAllCurrents() call when logging PDH currents ([dc296a9](https://github.com/jonahsnider/doglog/commit/dc296a93fa547e6b700acc121092d6fa134cd5c0))

## [2024.6.0](https://github.com/jonahsnider/doglog/compare/2024.5.8...2024.6.0) (2024-10-07)

### Features

- add DogLog.timestamp() convenience method ([710b091](https://github.com/jonahsnider/doglog/commit/710b0911542d4f7ddf72714786bd25f50ff2fad9))

### Bug Fixes

- update faults logging to ignore faults with null as a name ([0343b89](https://github.com/jonahsnider/doglog/commit/0343b89fe0c1be5a7900e6946a848df6bcf52853))

### Performance Improvements

- improve struct logging performance by removing redundant `DataLog#addSchema()` code ([91d60b0](https://github.com/jonahsnider/doglog/commit/91d60b04c96c56dc17a5ac30e70b5142e774c8ad))

## [2024.5.8](https://github.com/jonahsnider/doglog/compare/2024.5.7...2024.5.8) (2024-08-03)

### Bug Fixes

- fix `ntPublish` option being ignored when changing `logEntryQueueCapacity` option ([b53ae87](https://github.com/jonahsnider/doglog/commit/b53ae87cf33c9e7d6adba469d7e04ba0d06c158b))
- remove unused wpilibNewCommands dependency ([d5c0d2a](https://github.com/jonahsnider/doglog/commit/d5c0d2aa08a6332e3e2da4a4c6f893581216bcdd))

### Performance Improvements

- improve performance and memory overhead of struct logging ([39ed23e](https://github.com/jonahsnider/doglog/commit/39ed23e7b733ee15482b445e6ffcb80f2ef56f75)), closes [#37](https://github.com/jonahsnider/doglog/issues/37)

## [2024.5.7](https://github.com/jonahsnider/doglog/compare/2024.5.6...2024.5.7) (2024-08-02)

### Bug Fixes

- fix applying `captureDs` option with default value ([d3662a5](https://github.com/jonahsnider/doglog/commit/d3662a5badb7ca88db44010d4d155d4a59a92a36)), closes [#33](https://github.com/jonahsnider/doglog/issues/33)

## [2024.5.6](https://github.com/jonahsnider/doglog/compare/2024.5.5...2024.5.6) (2024-07-29)

### Bug Fixes

- fix how PDH currents are extracted ([1c7a002](https://github.com/jonahsnider/doglog/commit/1c7a00294049e2578b9bbb2bd3d79b136c6c0a1c))

### Performance Improvements

- replace many pdh.getCurrent() calls with one pdh.getAllCurrents() call when logging PDH currents ([7262425](https://github.com/jonahsnider/doglog/commit/72624252647af3d4f4a887191bb855d0a1c139e5))

## [2024.5.5](https://github.com/jonahsnider/doglog/compare/2024.5.4...2024.5.5) (2024-07-27)

### Bug Fixes

- stop automatically logging PDH to avoid CAN errors ([22340bf](https://github.com/jonahsnider/doglog/commit/22340bf802db8a4795a99c0f5420292a55151d3e))

## [2024.5.4](https://github.com/jonahsnider/doglog/compare/2024.5.3...2024.5.4) (2024-07-27)

### Performance Improvements

- improve performance when processing queued log entries ([9c95541](https://github.com/jonahsnider/doglog/commit/9c9554180c39b127828e5b449a141bdb7a0ac445))

## [2024.5.3](https://github.com/jonahsnider/doglog/compare/2024.5.2...2024.5.3) (2024-07-22)

### Bug Fixes

- improve error handling when instantiating `PowerDistribution` ([3256e6f](https://github.com/jonahsnider/doglog/commit/3256e6f854cb3ee3eea720faf04e702e7f4372f3))
- increase default log entry queue capacity from 500 to 1000 ([9b1549a](https://github.com/jonahsnider/doglog/commit/9b1549aaf70f7e1d53c886a006193e228445986d))

## [2024.5.2](https://github.com/jonahsnider/doglog/compare/v2024.5.1...2024.5.2) (2024-07-13)

### Bug Fixes

- fix version field in vendordep.json ([8c59d1f](https://github.com/jonahsnider/doglog/commit/8c59d1ff686d31aa4789d6eb444858fb6c6faf53))

## [2024.5.1](https://github.com/jonahsnider/doglog/compare/v2024.5.0...v2024.5.1) (2024-07-11)

### Bug Fixes

- fix a potential crash due to a feedback loop in the `LogQueuer#printQueueFullMessage()` method ([cfef1e9](https://github.com/jonahsnider/doglog/commit/cfef1e93fa547f88baba6115ebb3dba33b7d6dcc))

## [2024.5.0](https://github.com/jonahsnider/doglog/compare/v2024.4.1...v2024.5.0) (2024-05-23)

### Features

- add faults logging ([#18](https://github.com/jonahsnider/doglog/issues/18)) ([36da269](https://github.com/jonahsnider/doglog/commit/36da26928eae647810467617c28ff0026a32840f))

## [2024.4.1](https://github.com/jonahsnider/doglog/compare/v2024.4.0...v2024.4.1) (2024-05-03)

### Bug Fixes

- fix logging `int[]`s ([3f869c9](https://github.com/jonahsnider/doglog/commit/3f869c952cfa3560b193d03fbe8d86a64222f341))

## [2024.4.0](https://github.com/jonahsnider/doglog/compare/v2024.3.0...v2024.4.0) (2024-05-03)

### Features

- use separate thread for DataLog and NT operations ([#14](https://github.com/jonahsnider/doglog/issues/14)) ([edd45db](https://github.com/jonahsnider/doglog/commit/edd45db2605bf09f6f5b30a94e098d3a7fc8f5dc))

## [2024.3.0](https://github.com/jonahsnider/doglog/compare/v2024.2.1...v2024.3.0) (2024-04-27)

### Features

- add support for logging extras ([6180898](https://github.com/jonahsnider/doglog/commit/618089889d5d3f697e07ecdbd818ed546ab8626b)), closes [#12](https://github.com/jonahsnider/doglog/issues/12)

### Bug Fixes

- fix logging numeric values that start off as 0 ([6c17bc5](https://github.com/jonahsnider/doglog/commit/6c17bc5019a6cb5c7941b90dc713587ab4f93b8e))

## [2024.2.1](https://github.com/jonahsnider/doglog/compare/v2024.2.0...v2024.2.1) (2024-04-27)

### Bug Fixes

- fix struct arrays not appearing in log files ([cb4ac04](https://github.com/jonahsnider/doglog/commit/cb4ac045b3a4677473c4dfdc04e5a0bdc84305e7))
- remove unhelpful DogLog.log() overloads for structs ([fe4c14d](https://github.com/jonahsnider/doglog/commit/fe4c14d6e858c97309a454f390b32f764f16bfb5))

## [2024.2.0](https://github.com/jonahsnider/doglog/compare/v2024.1.0...v2024.2.0) (2024-04-27)

### Features

- reduce log file size with change detection ([#8](https://github.com/jonahsnider/doglog/issues/8)) ([e291715](https://github.com/jonahsnider/doglog/commit/e291715cc418571fe4e4975a31c3d5e31a2c0fea))

### Bug Fixes

- instantiate DataLogManager after configuring NetworkTables capture behavior ([0bbaabb](https://github.com/jonahsnider/doglog/commit/0bbaabbb91746c76d4df5c1d2abdba144dc6401e))

## [2024.1.0](https://github.com/jonahsnider/doglog/compare/v2024.0.0...v2024.1.0) (2024-04-27)

### Features

- initial commit ([fac012c](https://github.com/jonahsnider/doglog/commit/fac012cfcf8e1d4afd38437d2292e90c7dc9a675))
