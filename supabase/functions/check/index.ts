import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function getUserProgress(lastThreeDigits: string) {
  const { data: users, error: userError } = await supabase
    .from('users')
    .select('*')
    .like('phone', `%${lastThreeDigits}`)

  if (userError) {
    throw userError
  }

  if (!users || users.length === 0) {
    throw new Error('無法找到用戶')
  }

  const { data: questions, error: questionsError } = await supabase
    .from('questions')
    .select('*')
    .order('ct', { ascending: true })

  if (questionsError) throw questionsError

  const userProgress = users.map((user) => {
    const answers = user.answer || []
    const questionDetails = questions.map((q, index) => ({
      ask: q.ask,
      ask2: q.ask2,
      correct: answers[index] === 1
    }))

    const correctCount = questionDetails.filter((q) => q.correct).length
    const passed = correctCount >= 5

    return {
      user,
      questions: questionDetails,
      correctCount,
      passed
    }
  })

  return userProgress
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
