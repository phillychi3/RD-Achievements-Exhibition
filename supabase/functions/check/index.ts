import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function getUserProgress(phone: string) {
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('phone', phone)
    .single()

  if (userError) {
    if (userError.code === 'PGRST116') {
      throw new Error('can not find user')
    }
    throw userError
  }

  const { data: questions, error: questionsError } = await supabase
    .from('questions')
    .select('*')
    .order('created_at', { ascending: true })

  if (questionsError) throw questionsError

  const answers = user.answer || []
  const questionDetails = questions.map((q, index) => ({
    ask: q.ask,
    correct: answers[index] === 1
  }))

  const allCorrect = questionDetails.every((q) => q.correct)

  return {
    questions: questionDetails,
    allCorrect
  }
}

Deno.serve(async (req) => {
  try {
    if (req.method !== 'GET') {
      throw new Error('only support GET method')
    }

    const url = new URL(req.url)
    const phone = url.searchParams.get('phone')

    if (!phone) {
      throw new Error('請提供電話號碼')
    }

    const progress = await getUserProgress(phone)

    return new Response(JSON.stringify(progress), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    })
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error.message || 'something went wrong'
      }),
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    )
  }
})
