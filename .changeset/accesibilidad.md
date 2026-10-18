---
'@qr-city/core': minor
---

Accesibilidad: el lienzo queda descrito con el destino del QR para los lectores de pantalla (`destinationLabel`, `'Destination:'` por defecto). Si el contenido es una dirección web, se añade un enlace real tras el lienzo en el orden del tabulador, que se muestra al recibir el foco; cualquier otro texto solo se describe, nunca se enlaza. Disponible en el Web Component (`destination-label`) y en React, Vue y Angular. El zoom, el desplazamiento y el cambio de vista con teclado ya existían y ahora tienen pruebas.
