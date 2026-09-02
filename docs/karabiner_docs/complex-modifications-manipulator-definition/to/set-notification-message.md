---
title: "to.set_notification_message"
weight: 310
---

`set_notification_message` sets or remove the notification message.

## Examples

Show the notification message while you press right shift key.

```json
{
  "description": "Show a message while right_shift is pressed",
  "manipulators": [
    {
      "type": "basic",
      "from": {
        "key_code": "right_shift",
        "modifiers": {
          "optional": ["any"]
        }
      },
      "to": [
        {
          // Show the notification message
          "set_notification_message": {
            "id": "my_message",
            "text": "Hello World!"
          }
        },
        {
          "key_code": "right_shift"
        }
      ],
      "to_after_key_up": [
        {
          // Hide the notification message
          "set_notification_message": {
            "id": "my_message",
            "text": ""
          }
        }
      ]
    }
  ]
}
```

## Specification

```json
{
  "to": [
    {
      "set_notification_message": {
        "id": "identifier of the message",
        "text": "message text",
        "duration_milliseconds": 3000
      }
    }
  ]
}
```

| Name                    | Required     | Description                                                                                     | Available since            |
| :---------------------- | :----------- | :---------------------------------------------------------------------------------------------- | :------------------------- |
| `id`                    | **Required** | A unique identifier for the notification message.                                               |                            |
| `text`                  | **Required** | The notification message to display.                                                            |                            |
| `duration_milliseconds` | Optional     | If specified, the notification message is dismissed after the specified number of milliseconds. | Karabiner-Elements 16.1.18 |

> [!CAUTION]
> Do not forget to remove the notification message.

> [!NOTE]
> **How to remove the notification message**
>
> Set empty string to `text` to remove the notification message.
