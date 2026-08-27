import { createClient } from 'npm:@supabase/supabase-js@2'

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

const signatureValue = (signature: string, name: string) =>
  signature.split(',').map((entry) => entry.trim()).find((entry) => entry.startsWith(`${name}=`))?.slice(name.length + 1)

const secureEqual = (left: string, right: string) => {
  if (left.length !== right.length) return false
  let result = 0
  for (let index = 0; index < left.length; index += 1) result |= left.charCodeAt(index) ^ right.charCodeAt(index)
  return result === 0
}

async function validSignature(request: Request, dataId: string, secret: string) {
  const signature = request.headers.get('x-signature')
  const requestId = request.headers.get('x-request-id')
  if (!signature || !requestId) return false

  const timestamp = signatureValue(signature, 'ts')
  const receivedHash = signatureValue(signature, 'v1')
  if (!timestamp || !receivedHash) return false

  const manifest = `id:${dataId};request-id:${requestId};ts:${timestamp};`
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const digest = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(manifest))
  const expectedHash = Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('')
  return secureEqual(expectedHash, receivedHash)
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405)

  const accessToken = Deno.env.get('MERCADO_PAGO_ACCESS_TOKEN')
  const webhookSecret = Deno.env.get('MERCADO_PAGO_WEBHOOK_SECRET')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!accessToken || !webhookSecret || !supabaseUrl || !serviceRoleKey) {
    return json({ error: 'Webhook configuration is incomplete.' }, 500)
  }

  let payload: { type?: string; data?: { id?: string | number } }
  try {
    payload = await request.json()
  } catch {
    return json({ error: 'Invalid JSON payload.' }, 400)
  }

  const paymentId = String(payload.data?.id ?? new URL(request.url).searchParams.get('data.id') ?? '')
  if (payload.type !== 'payment' || !paymentId) return json({ received: true })
  if (!await validSignature(request, paymentId, webhookSecret)) return json({ error: 'Invalid webhook signature.' }, 401)

  const paymentResponse = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!paymentResponse.ok) return json({ error: 'Unable to confirm payment with Mercado Pago.' }, 502)

  const payment = await paymentResponse.json() as { status?: string; external_reference?: string; transaction_amount?: number; currency_id?: string }
  if (payment.status !== 'approved' || !payment.external_reference) return json({ received: true, activated: false })

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
  const { data, error } = await supabase
    .from('subscriptions')
    .update({
      status: 'active',
      mercado_pago_payment_id: paymentId,
      amount: payment.transaction_amount ?? null,
      currency: payment.currency_id ?? 'BRL',
      paid_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', payment.external_reference)
    .in('status', ['pending', 'past_due'])
    .select('id')
    .maybeSingle()

  if (error) return json({ error: 'Unable to activate subscription.' }, 500)
  return json({ received: true, activated: Boolean(data) })
})