---
'@qr-city/core': minor
'@qr-city/react': minor
'@qr-city/vue': minor
'@qr-city/angular': minor
---

Marcador para renderizado en servidor: los componentes de React, Vue y Angular pintan en el servidor un QR plano con los colores del estilo (el mismo código que dibuja la ciudad), oculto a los lectores de pantalla. La página ya funciona, se puede escanear y no pega saltos mientras carga el 3D, que lo sustituye al montarse. El núcleo exporta `qrPlaceholder()` para hacer lo mismo a mano.
