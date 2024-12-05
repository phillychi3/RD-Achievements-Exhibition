import { createClient } from 'npm:@supabase/supabase-js@2'
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const supabase = createClient(supabaseUrl, supabaseAnonKey)

console.log('Hello from Functions!')

Deno.serve(async (req) => {
  if (req.method === 'POST') {
    const { id } = await req.json()
    const { error } = await supabase
      .from('users')
      .update({ Received: true })
      .eq('id', id)

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({ message: `User ${id} updated.` }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } else {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    })
  }
})
