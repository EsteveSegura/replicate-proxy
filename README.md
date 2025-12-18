# Replicate API Proxy

Servidor proxy simple para evitar problemas de CORS al llamar a la API de Replicate desde localhost.

## Instalación

```bash
npm install
```

## Uso

```bash
npm start
```

El servidor se ejecutará en `http://localhost:1111`

## Ejemplo de uso

En lugar de llamar directamente a:
```
https://api.replicate.com/v1/models/google/nano-banana-pro/predictions
```

Llama a:
```
http://localhost:1111/v1/models/google/nano-banana-pro/predictions
```

## Headers

No olvides incluir tu token de autorización en las peticiones:

```javascript
fetch('http://localhost:1111/v1/models', {
  headers: {
    'Authorization': 'Token your_replicate_api_token',
    'Content-Type': 'application/json'
  }
})
```

## Características

- ✅ Bypass de CORS
- ✅ Soporta todos los métodos HTTP (GET, POST, PUT, DELETE, etc.)
- ✅ Forward automático de todos los headers
- ✅ Forward de query params
- ✅ Logging de peticiones
