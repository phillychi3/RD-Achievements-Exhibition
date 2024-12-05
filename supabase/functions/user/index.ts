import { createClient } from 'npm:@supabase/supabase-js@2'
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const supabase = createClient(supabaseUrl, supabaseAnonKey)

Deno.serve(async (req) => {
  const headers = new Headers()
  headers.set('Content-Type', 'application/json')
  headers.set('Access-Control-Allow-Origin', '*')
  headers.set('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
  headers.set('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers })
  }

  if (req.method === 'POST') {
    const { id } = await req.json()
    const { error } = await supabase
      .from('users')
      .update({ Received: true })
      .eq('id', id)

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers
      })
    }

    return new Response(JSON.stringify({ message: `User ${id} updated.` }), {
      headers
    })
  } else {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers
    })
  }
})
