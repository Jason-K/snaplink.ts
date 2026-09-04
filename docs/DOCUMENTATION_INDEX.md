# Documentation Index

Index of Karabiner documentation and reference materials.

## References (`docs/karabiner_refs`)

- [karabiner-elements-deep-dive.md](./karabiner_refs/karabiner-elements-deep-dive.md) - blog post summarizing Karabiner
- [karabiner-gotchas.md](./karabiner_refs/karabiner-gotchas.md) - summary of observations from working with Karabiner
- [karabiner-keybinding-lifecycle.md](./karabiner_refs/karabiner-keybinding-lifecycle.md) - pulled directly from [Karabiner-Elements Keybinding Lifecycle](https://raw.githubusercontent.com/pqrs-org/Karabiner-Elements/main/docs/karabiner-keybinding-lifecycle.md)

## Karabiner Upstream Documentation (`docs/karabiner_docs`)

Upstream documentation pulled from [pqrs.org docs/json](https://github.com/pqrs-org/pqrs.org/tree/main/sites/karabiner-elements/content/en/docs/json).

- [complex-modifications-manipulator-definition.md](./karabiner_docs/complex-modifications-manipulator-definition.md)
- [complex-modifications-manipulator-evaluation-priority.md](./karabiner_docs/complex-modifications-manipulator-evaluation-priority.md)
- [external-json-generators.md](./karabiner_docs/external-json-generators.md)
- [location.md](./karabiner_docs/location.md)
- [root-data-structure.md](./karabiner_docs/root-data-structure.md)
- [typical-complex-modifications-examples.md](./karabiner_docs/typical-complex-modifications-examples.md)
- **complex-modifications-manipulator-definition/**
  - [from.md](./karabiner_docs/complex-modifications-manipulator-definition/from.md)
  - [to-after-key-up.md](./karabiner_docs/complex-modifications-manipulator-definition/to-after-key-up.md)
  - [to-delayed-action.md](./karabiner_docs/complex-modifications-manipulator-definition/to-delayed-action.md)
  - [to-if-alone.md](./karabiner_docs/complex-modifications-manipulator-definition/to-if-alone.md)
  - [to-if-held-down.md](./karabiner_docs/complex-modifications-manipulator-definition/to-if-held-down.md)
  - [to-if-other-key-pressed.md](./karabiner_docs/complex-modifications-manipulator-definition/to-if-other-key-pressed.md)
  - [to.md](./karabiner_docs/complex-modifications-manipulator-definition/to.md)
  - **conditions/**
    - [device.md](./karabiner_docs/complex-modifications-manipulator-definition/conditions/device.md)
    - [event-changed.md](./karabiner_docs/complex-modifications-manipulator-definition/conditions/event-changed.md)
    - [expression.md](./karabiner_docs/complex-modifications-manipulator-definition/conditions/expression.md)
    - [frontmost-application.md](./karabiner_docs/complex-modifications-manipulator-definition/conditions/frontmost-application.md)
    - [input-source.md](./karabiner_docs/complex-modifications-manipulator-definition/conditions/input-source.md)
    - [keyboard-type.md](./karabiner_docs/complex-modifications-manipulator-definition/conditions/keyboard-type.md)
    - [variable.md](./karabiner_docs/complex-modifications-manipulator-definition/conditions/variable.md)
  - **from/**
    - [any.md](./karabiner_docs/complex-modifications-manipulator-definition/from/any.md)
    - [integer-value.md](./karabiner_docs/complex-modifications-manipulator-definition/from/integer-value.md)
    - [modifiers.md](./karabiner_docs/complex-modifications-manipulator-definition/from/modifiers.md)
    - [simultaneous-options.md](./karabiner_docs/complex-modifications-manipulator-definition/from/simultaneous-options.md)
    - [simultaneous.md](./karabiner_docs/complex-modifications-manipulator-definition/from/simultaneous.md)
  - **other-types/**
    - [mouse-basic.md](./karabiner_docs/complex-modifications-manipulator-definition/other-types/mouse-basic.md)
    - [mouse-motion-to-scroll.md](./karabiner_docs/complex-modifications-manipulator-definition/other-types/mouse-motion-to-scroll.md)
  - **to/**
    - [from-event.md](./karabiner_docs/complex-modifications-manipulator-definition/to/from-event.md)
    - [halt.md](./karabiner_docs/complex-modifications-manipulator-definition/to/halt.md)
    - [hold-down-milliseconds.md](./karabiner_docs/complex-modifications-manipulator-definition/to/hold-down-milliseconds.md)
    - [lazy.md](./karabiner_docs/complex-modifications-manipulator-definition/to/lazy.md)
    - [modifiers.md](./karabiner_docs/complex-modifications-manipulator-definition/to/modifiers.md)
    - [mouse-key.md](./karabiner_docs/complex-modifications-manipulator-definition/to/mouse-key.md)
    - [repeat.md](./karabiner_docs/complex-modifications-manipulator-definition/to/repeat.md)
    - [select-input-source.md](./karabiner_docs/complex-modifications-manipulator-definition/to/select-input-source.md)
    - [send-user-command.md](./karabiner_docs/complex-modifications-manipulator-definition/to/send-user-command.md)
    - [set-notification-message.md](./karabiner_docs/complex-modifications-manipulator-definition/to/set-notification-message.md)
    - [set-variable.md](./karabiner_docs/complex-modifications-manipulator-definition/to/set-variable.md)
    - [shell-command.md](./karabiner_docs/complex-modifications-manipulator-definition/to/shell-command.md)
    - [software_function.md](./karabiner_docs/complex-modifications-manipulator-definition/to/software_function.md)
    - [sticky-modifier.md](./karabiner_docs/complex-modifications-manipulator-definition/to/sticky-modifier.md)
    - [to-conditions.md](./karabiner_docs/complex-modifications-manipulator-definition/to/to-conditions.md)
    - **software_function/**
      - [cg_event_double_click.md](./karabiner_docs/complex-modifications-manipulator-definition/to/software_function/cg_event_double_click.md)
      - [iokit_power_management_sleep_system.md](./karabiner_docs/complex-modifications-manipulator-definition/to/software_function/iokit_power_management_sleep_system.md)
      - [open_application.md](./karabiner_docs/complex-modifications-manipulator-definition/to/software_function/open_application.md)
      - [set_mouse_cursor_position.md](./karabiner_docs/complex-modifications-manipulator-definition/to/software_function/set_mouse_cursor_position.md)
- **expert-complex-modifications-examples/**
  - [letter-key-holding-modifier.md](./karabiner_docs/expert-complex-modifications-examples/letter-key-holding-modifier.md)
  - [letter-key-release-order-modifier.md](./karabiner_docs/expert-complex-modifications-examples/letter-key-release-order-modifier.md)
  - [swap-function-keys-on-external-keyboards.md](./karabiner_docs/expert-complex-modifications-examples/swap-function-keys-on-external-keyboards.md)
- **exprtk/**
  - [expressions_ref.md](./karabiner_docs/exprtk/expressions_ref.md)
  - [exprtk-readme.md](./karabiner_docs/exprtk/exprtk-readme.md)
- **extra/**
  - [multitouch-extension.md](./karabiner_docs/extra/multitouch-extension.md)
  - [virtual-modifier.md](./karabiner_docs/extra/virtual-modifier.md)

## Recent Changes as of 2026-09-04 19:36:03 UTC

### 🟢 New Documents

_None in the last pull._

### 🟡 Modified Documents

_None in the last pull._
