# Netlify Functions — ejemplo AIAM

Funciones serverless para Stripe Checkout. La clave secreta de Stripe solo vive aquí (variables de entorno), nunca en el navegador.

## Archivos

| Función | Ruta | Descripción |
|---------|------|-------------|
| `ping.js` | `GET /.netlify/functions/ping` | Comprueba que las functions responden |
| `create-checkout.js` | `POST /.netlify/functions/create-checkout` | Valida carrito contra Supabase y crea Stripe Checkout |
| `stripe-webhook.js` | `POST /.netlify/functions/stripe-webhook` | Recibe eventos de Stripe y actualiza stock |

## Desarrollo local

```bash
npm install
cp .env.example .env
# Rellena STRIPE_SECRET_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
npx netlify dev
```

- Sitio: http://localhost:8888
- Ping: http://localhost:8888/.netlify/functions/ping

Para probar el webhook en local:

```bash
stripe listen --forward-to localhost:8888/.netlify/functions/stripe-webhook
```

Copia el `whsec_...` que imprime Stripe a `STRIPE_WEBHOOK_SECRET` en `.env`.

## Variables en Netlify

En **Site settings → Environment variables**, configura las mismas variables que en `.env.example`.

## Despliegue

Conecta el repo a Netlify. `netlify.toml` ya define `publish = "."` y `functions = "netlify/functions"`.

Tras el deploy, en Stripe Dashboard → Webhooks, apunta a:

`https://TU-SITIO.netlify.app/.netlify/functions/stripe-webhook`

Evento mínimo: `checkout.session.completed`.

## Columna opcional en Supabase

Si sincronizas productos en Stripe, añade `stripe_price_id` (text) a la tabla `products`. Si está vacía, la función usa `price_data` con el precio de Supabase.
