---
'@qr-city/core': minor
---

Rendimiento: las piezas repetidas (árboles, farolas, coches, personas, edificios) se dibujan en lotes instanciados, con un 90–95 % menos de llamadas de dibujo, y las copas de los árboles usan un tercio de los triángulos. Con `quality: 'auto'`, si el dispositivo no llega a ~30 fps se baja primero la densidad de píxeles y después el nivel de detalle.
