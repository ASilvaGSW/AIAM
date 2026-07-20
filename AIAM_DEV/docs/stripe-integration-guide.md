# Guía: conectar `products.html` con Stripe desde cero

Esta guía explica cómo integrar pagos con Stripe en el proyecto AIAM, partiendo del setup actual:

- Catálogo en **Supabase** (`products`: nombre, precio, imagen, stock)
- Carrito en **localStorage** (`js/products.js`)
- Botón **Request quote** por correo (sin cobro aún)

Para cobrar con Stripe necesitas un **servidor** (o Supabase Edge Function). La clave secreta de Stripe **nunca** va en el navegador.

---

## 1. Arquitectura recomendada

La opción más simple y segura para un sitio estático como este:

```
Usuario → products.html (carrito)
       → Backend / Edge Function (valida precios)
       → Stripe Checkout (pago)
       → Webhook (confirma orden en Supabase)
```

**Flujo paso a paso**

1. El usuario agrega productos al carrito en `products.html`
2. Pulsa **Pay with Stripe**
3. El frontend envía solo `id` y `qty` al backend
4. El backend lee precios reales desde Supabase y crea una **Checkout Session**
5. Stripe redirige al usuario a su página de pago
6. Tras pagar, Stripe envía un **webhook** al backend
7. El backend registra la orden y actualiza stock

**Por qué Stripe Checkout**

- El carrito es dinámico (varios productos, cantidades variables)
- Los precios se validan en el servidor, no en el navegador
- No necesitas construir un formulario de tarjeta desde cero

---

## 2. Crear cuenta y obtener claves

1. Regístrate en [https://dashboard.stripe.com](https://dashboard.stripe.com)
2. Activa **modo Test** (interruptor arriba a la derecha)
3. Ve a **Developers → API keys**
  - `pk_test_...` → clave pública (frontend, si usas Stripe Elements)
  - `sk_test_...` → clave secreta (solo backend)
4. Para producción repites con `pk_live_...` y `sk_live_...`

**Tarjetas de prueba**


| Resultado    | Número                |
| ------------ | --------------------- |
| Pago exitoso | `4242 4242 4242 4242` |
| Rechazado    | `4000 0000 0000 0002` |


Usa cualquier fecha futura y cualquier CVC de 3 dígitos.

---

## 3. Modelo de productos: Supabase + Stripe

### Opción A — Sincronizar productos en Stripe (recomendado)

Cada producto en Supabase tiene su equivalente en Stripe.


| Supabase `products` | Stripe                            |
| ------------------- | --------------------------------- |
| `id`                | metadata `product_id`             |
| `product_name`      | Product `name`                    |
| `price`             | Price `unit_amount` (en centavos) |
| `image`             | Product `images[]`                |


Agrega una columna en Supabase:

```sql
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS stripe_price_id text;
```

**Flujo**

1. Creas el producto en `crud_products.html`
2. Un script o proceso admin crea el Product + Price en Stripe
3. Guardas `stripe_price_id` (ej. `price_1ABC...`) en Supabase

### Opción B — Solo `price` en Supabase (más rápido para empezar)

El backend lee el precio de Supabase al crear el checkout y usa `price_data` dinámico en Stripe (sin `stripe_price_id`). Funciona para pruebas; en producción conviene validar siempre contra la base de datos.

---

## 4. Crear el backend (obligatorio)

El HTML estático no puede llamar a Stripe con la secret key. Opciones:


| Opción                          | Dificultad | Encaja con tu stack         |
| ------------------------------- | ---------- | --------------------------- |
| **Supabase Edge Function**      | Media      | Muy bien (ya usas Supabase) |
| **Vercel / Netlify serverless** | Media      | Bien si despliegas ahí      |
| **Node/Express pequeño**        | Media      | Flexible                    |


### Ejemplo: Edge Function `create-checkout`

Instala Supabase CLI y crea la función:

```bash
supabase functions new create-checkout
```

`supabase/functions/create-checkout/index.ts`:

```typescript
import Stripe from "https://esm.sh/stripe@14?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-06-20",
});

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const { items } = await req.json();
  // items: [{ id, qty }] desde el carrito del navegador

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const lineItems = [];

  for (const item of items) {
    const { data: product } = await supabase
      .from("products")
      .select("id, product_name, price, qty, stripe_price_id")
      .eq("id", item.id)
      .single();

    if (!product || product.qty < item.qty) {
      return new Response(JSON.stringify({ error: "Invalid product or stock" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (product.stripe_price_id) {
      lineItems.push({ price: product.stripe_price_id, quantity: item.qty });
    } else {
      lineItems.push({
        price_data: {
          currency: "usd",
          product_data: { name: product.product_name },
          unit_amount: Math.round(product.price * 100),
        },
        quantity: item.qty,
      });
    }
  }

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: lineItems,
    success_url: "https://tudominio.com/products.html?paid=1",
    cancel_url: "https://tudominio.com/products.html?canceled=1",
    metadata: {
      source: "aiam-cart",
    },
  });

  return new Response(JSON.stringify({ url: session.url }), {
    headers: { "Content-Type": "application/json" },
  });
});
```

**Secretos en Supabase**

```bash
supabase secrets set STRIPE_SECRET_KEY=sk_test_...
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=...
```

**Desplegar**

```bash
supabase functions deploy create-checkout
```

---

## 5. Cambios en `products.html` / `js/products.js`

Reemplaza o complementa **Request quote** con **Checkout**:

```javascript
async function checkoutWithStripe() {
  const items = loadCart();
  if (!items.length) return;

  const response = await fetch(
    "https://TU_PROYECTO.supabase.co/functions/v1/create-checkout",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: items.map((item) => ({ id: item.id, qty: item.qty })),
      }),
    }
  );

  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Checkout failed");

  window.location.href = data.url;
}
```

En `products.html`, junto al botón de cotización:

```html
<button type="button" class="btn-submit" id="cartCheckout">
  Pay with Stripe
</button>
```

**Reglas importantes en el frontend**

- Envía solo `id` y `qty` del carrito
- **No** envíes el precio desde el navegador (el servidor lo lee de Supabase)
- El total mostrado en el carrito es estimado; el definitivo lo define Stripe

---

## 6. Webhooks (confirmar pagos)

Sin webhook, el pago puede completarse y tu base de datos no se entera.

1. Stripe Dashboard → **Developers → Webhooks → Add endpoint**
2. URL: `https://TU_PROYECTO.supabase.co/functions/v1/stripe-webhook`
3. Evento: `checkout.session.completed`

**Función `stripe-webhook` (resumen)**

```typescript
import Stripe from "https://esm.sh/stripe@14?target=deno";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-06-20",
});

Deno.serve(async (req) => {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature")!;

  const event = stripe.webhooks.constructEvent(
    body,
    signature,
    Deno.env.get("STRIPE_WEBHOOK_SECRET")!
  );

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    // Guardar orden en Supabase, descontar stock, enviar email, etc.
    console.log("Payment completed:", session.id);
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
```

**Tablas sugeridas en Supabase**

```sql
CREATE TABLE orders (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  stripe_session_id text UNIQUE NOT NULL,
  total_amount numeric,
  status text DEFAULT 'paid',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE order_items (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id bigint REFERENCES orders(id),
  product_id bigint REFERENCES products(id),
  qty int NOT NULL,
  unit_price numeric NOT NULL
);
```

---

## 7. Pasos en orden (checklist)

### Fase 1 — Cuenta y pruebas

- [ ] Crear cuenta Stripe (modo Test)
- [ ] Guardar `sk_test_` y `pk_test_` en un gestor de secretos
- [ ] Probar un pago manual en Dashboard → Payment Links (opcional)

### Fase 2 — Base de datos

- [ ] Agregar `stripe_price_id` a `products` (opcional pero recomendado)
- [ ] Crear tablas `orders` y `order_items`
- [ ] Mantener RLS: lectura pública de productos, escritura de órdenes solo desde backend

### Fase 3 — Backend

- [ ] Edge Function `create-checkout`
- [ ] Edge Function `stripe-webhook`
- [ ] Configurar secretos (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SERVICE_ROLE_KEY`)
- [ ] Desplegar funciones

### Fase 4 — Frontend

- [ ] Botón **Pay with Stripe** en el carrito
- [ ] Manejar estados `?paid=1` y `?canceled=1` en la URL
- [ ] Vaciar carrito tras pago exitoso

### Fase 5 — Producción

- [ ] Cambiar a claves `live`
- [ ] Webhook en URL de producción
- [ ] Dominio verificado en Stripe
- [ ] Política de reembolsos y datos fiscales completos

---

## 8. Seguridad (crítico)


| Hacer                                 | No hacer                                                    |
| ------------------------------------- | ----------------------------------------------------------- |
| Validar precio y stock en el servidor | Confiar en el precio del carrito del navegador              |
| Usar `sk_` solo en Edge Function      | Poner `sk_` en `products.js` o HTML                         |
| Verificar pagos con webhook           | Marcar pedido como pagado solo al redirigir a `success_url` |
| Usar `service_role` solo en backend   | Exponer `service_role` al frontend                          |


---

## 9. Cómo encaja con el proyecto actual

```
crud_products.html  →  administras productos y precios en Supabase
products.html       →  catálogo público + carrito
create-checkout     →  convierte el carrito en Stripe Checkout
stripe-webhook      →  confirma el pago y actualiza stock/órdenes
```

Puedes mantener **Request quote** para clientes B2B y añadir **Pay with Stripe** para compra directa.

---

## 10. Costos y consideraciones

- Stripe cobra por transacción (aprox. 2.9% + $0.30 USD en EE.UU.; varía por país)
- Modo Test es gratis e ilimitado
- Supabase Edge Functions: plan gratuito con límites; suficiente para empezar

---

## 11. Prueba local del webhook

Stripe necesita una URL pública para webhooks. En desarrollo usa Stripe CLI:

```bash
stripe login
stripe listen --forward-to localhost:54321/functions/v1/stripe-webhook
```

Copia el `whsec_...` que muestra y úsalo como `STRIPE_WEBHOOK_SECRET` en local.

---

## 12. Recursos oficiales

- [Stripe Checkout](https://docs.stripe.com/payments/checkout)
- [Stripe Testing](https://docs.stripe.com/testing)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Stripe Webhooks](https://docs.stripe.com/webhooks)

