# Code Style Guide

Applies to layered ROS + C++ projects. This guide defines the expected structure for folders, naming, module responsibilities, and build files.

## 1. Top-Level Layout

Use separate top-level modules instead of mixing everything under a shared `src/` tree.

Recommended layout:

```text
adapter/
  include/
  src/
  CMakeLists.txt
ros/
  include/
  src/
  launch/
  CMakeLists.txt
  package.xml
msg/
  <message packages>
docs/
```

Rules:

- `adapter` and `ros` are separate folders.
- Each module owns its own `include/` and `src/`.
- Do not use a layout like `src/adapter/...` and `src/ros/...`.
- `msg/` only contains message and service packages.

## 2. Module Responsibilities

### `adapter/`

- Integrates algorithm libraries, SDKs, devices, or external implementations.
- Exposes a unified interface to the ROS layer.
- Owns runtime control, lifecycle coordination, and non-ROS data exchange.
- Must not depend on `ros`.

### `ros/`

- Owns nodes, parameters, topics, services, TF, launch-facing behavior, and ROS message conversion.
- May depend on `adapter` and message packages.
- Should remain a thin boundary layer over the adapter.

### `msg/`

- Contains only `.msg` and `.srv` definitions.
- Does not contain business logic, adapter logic, or node logic.

Dependency direction:

```text
msg -> ros
adapter -> ros
```

## 3. ROS Layer Structure

The ROS layer should be organized around a thin entry point, a wrapper class, and a shared common header.

### `main.cpp`

- Keep `main.cpp` thin.
- It should only do initialization, signal handling if needed, wrapper creation, wrapper startup, and shutdown waiting.
- Do not place business logic, conversion logic, or long control flow in `main.cpp`.

### Wrapper / Node Class

Use a wrapper or node class such as `RosWrapper` or `NodeWrapper` to own ROS runtime behavior.

The wrapper should own:

- parameter loading
- adapter creation
- publisher / subscriber / service registration
- the processing loop
- conversion between ROS types and adapter types

Recommended method groups:

- `init()`
- parameter setup helpers
- subscriber callbacks
- publish methods
- conversion methods
- thread / loop methods

### `ros_common.h`

Use a shared header such as `ros_common.h` for ROS-facing shared definitions.

`ros_common.h` should contain only stable ROS interface definitions, for example:

- topic names
- service names
- frame names
- message type aliases
- service type aliases

`ros_common.h` should not contain:

- runtime logic
- callback implementations
- adapter logic
- business logic

## 4. Adapter Layer Structure

The adapter layer should be organized around interface + factory + concrete implementations.

### `AdapterInterface`

- Defines the stable abstraction used by the ROS layer.
- Contains only the contract needed by the wrapper or node class.
- Should not expose ROS types.

### `AdapterFactory`

- Owns implementation selection.
- Returns the correct adapter implementation based on mode or configuration.
- Does not own processing logic or business logic.

### Real And Mock Modes

Adapter mode must be explicit.

- `RealAdapter`: integrates the real algorithm / SDK / device path.
- `MockAdapter`: provides replaceable behavior for testing, simulation, or development without the real backend.

Rules:

- Both implementations should follow the same public interface.
- Mode selection should happen in the factory, not scattered across the ROS layer.
- Do not duplicate ROS logic in `RealAdapter` or `MockAdapter`.
- Mock mode should be treated as a first-class mode, not as a temporary hack.

## 5. Naming

- Type names: `PascalCase`
- File names: `snake_case`
- Member variables: trailing underscore, for example `adapter_`
- ROS constants: uppercase with underscores, for example `IMU_TOPIC`

Method naming depends on the boundary:

- New ROS-layer methods should use `camelCase`
- Adapter pass-through methods for external interfaces may keep `snake_case`

Prefer role-based names over vague names. Prefer patterns like:

- `XxxWrapper`
- `XxxFactory`
- `convertXxx`
- `xxxCallback`
- `publishXxx`
- `xxxThreadFunc`

Avoid names like:

- `manager`
- `helper`
- `doTask`
- `process_data`

## 6. File And Class Structure

Header order:

1. `#pragma once`
2. standard library headers
3. third-party headers
4. local module headers
5. namespace
6. type definitions

Recommended class order:

1. constructors and destructor
2. public entry points
3. main workflow methods
4. conversion methods
5. callback / publish / thread methods
6. member variables

Keep related methods grouped together. Do not mix conversion, publishing, and callback logic randomly.

## 7. ROS Data Flow

Keep the boundary explicit:

```text
ROS msg -> wrapper callback -> convert -> adapter interface
adapter data -> wrapper convert -> publish / service / tf
```

Rules:

- ROS callbacks validate, convert, and dispatch.
- Conversion logic stays in dedicated conversion methods.
- Publish logic stays in dedicated publish methods.
- Do not scatter field mapping across unrelated methods.

## 8. `CMakeLists.txt` Structure

Each independently buildable module should own its own `CMakeLists.txt`.

Recommended order:

1. `cmake_minimum_required(...)`
2. `project(...)`
3. C++ standard, policy, and compile options
4. `find_package(...)` / `find_library(...)`
5. variable definitions such as source lists, paths, and generated files
6. `include_directories(...)` / `target_include_directories(...)`
7. `add_library(...)` / `add_executable(...)`
8. `target_link_libraries(...)`
9. `set_target_properties(...)`
10. `install(...)`

Additional rules:

- Keep dependency declarations near the top.
- Define source lists in one place, for example `set(MODULE_SRCS ...)`.
- Keep target linking, properties, and install rules close to the target.
- Keep generation logic and install logic separate.
- `adapter` and `ros` should each have their own build file rather than sharing one mixed build entry.

## 9. Comments And Concurrency

- Public interfaces may use Doxygen-style comments.
- `.cpp` comments should explain intent, not obvious code.
- For cross-thread shared data, prefer clear ownership and existing patterns such as `std::atomic`, `std::mutex`, and double buffering.
- Thread start, stop, and `join()` must be managed by the owning class.

## 10. Change Scope

- Unless explicitly requested, only make the changes required for the current task; do not refactor.
- Do not rename public interfaces, files, or constants only for style consistency.
- New code should follow the local module style instead of introducing a new style.

## 11. Summary Rules

- Keep `adapter/` and `ros/` as separate top-level modules.
- Each module owns its own `include/` and `src/`.
- Use `ros_common.h` for topic names, service names, frame names, and ROS type aliases.
- Use `AdapterInterface` + `AdapterFactory` + `RealAdapter` + `MockAdapter`.
- Keep ROS logic in `ros/` and non-ROS integration logic in `adapter/`.
- Keep `main.cpp` thin and move runtime behavior into the wrapper class.
