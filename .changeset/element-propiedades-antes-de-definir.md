---
"@qr-city/element": patch
---

Properties set on a `<qr-city>` before the element was defined now win over its attributes and the element mounts once with all of them. Before, a missing attribute could overwrite the property and the element could be created with only part of the configuration.
