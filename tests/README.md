# Pruebas del gimnasio

Con un servidor estático del repositorio en el puerto 4173 y Playwright disponible:

```sh
python3 -m http.server 4173 --bind 127.0.0.1
```

En otra terminal:

```sh
node tests/gym.cjs
```

El test usa Google Chrome instalado y un perfil temporal. No toca el historial personal del navegador. `PLAYWRIGHT_MODULE` permite usar una instalación existente de Playwright y `GYM_URL` permite cambiar la URL local.

Las pruebas verifican cancelación y reinicio de memoria, vencimiento de Stroop, dificultades, las tres etapas de la rutina con reloj virtual, interrupción al ocultar la página, persistencia y filtrado del historial, almacenamiento bloqueado o corrupto y anchos de móvil, tableta y escritorio.
