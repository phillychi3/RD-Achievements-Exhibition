import { createClient } from 'npm:@supabase/supabase-js@2'
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function getOrCreateUser(name: string, phone: string) {
  const { data: existingUser, error: searchError } = await supabase
    .from('users')
    .select('*')
    .eq('phone', phone)
    .single()

  if (existingUser) {
    return existingUser
  }

  const { data: newUser, error: insertError } = await supabase
    .from('users')
    .insert([
      {
        name,
        phone,
        answer: []
      }
    ])
    .select()
    .single()

  if (insertError) {
    throw insertError
  }

  return newUser
}

async function updateUserAnswer(
  userId: string,
  questionNumber: number,
  isCorrect: boolean
) {
  const { data: user, error: fetchError } = await supabase
    .from('users')
    .select('answer')
    .eq('id', userId)
    .single()

  if (fetchError) throw fetchError

  let answers = user.answer || []
  while (answers.length <= questionNumber) {
    answers.push(0)
  }
  answers[questionNumber] = isCorrect ? 1 : 0

  const { error: updateError } = await supabase
    .from('users')
    .update({ answer: answers })
    .eq('id', userId)

  if (updateError) throw updateError
}

Deno.serve(async (req) => {
  try {
    if (req.method === 'GET') {
      const url = new URL(req.url)
      const questionId = url.searchParams.get('q')

      let query = supabase.from('questions').select('*')

      if (questionId) {
        query = query.eq('id', questionId)

        const { data: question, error } = await query.single()

        if (error) {
          if (error.code === 'PGRST116') {
            throw new Error('cannot find the question')
          }
          throw error
        }

        const response = {
          ask: question.ask,
          ask2: question.ask2,
          questions1: question.questions1,
          questions2: question.questions2,
          answer1: question.answer1,
          answer2: question.answer2
        }

        return new Response(JSON.stringify(response), {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        })
      } else {
        query = query.order('created_at', { ascending: true })

        const { data: questions, error } = await query

        if (error) throw error

        if (!questions || questions.length === 0) {
          throw new Error('no questions found')
        }

        const response = questions.map((question) => ({
          id: question.id,
          ask: question.ask,
          ask2: question.ask2,
          questions1: question.questions1,
          questions2: question.questions2,
          answer1: question.answer1,
          answer2: question.answer2,
          created_at: question.created_at
        }))

        return new Response(JSON.stringify(response), {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        })
      }
    } else if (req.method === 'POST') {
      const { name, phone, answer1, answer2, questionId } = await req.json()

      if (
        !name ||
        !phone ||
        answer1 === undefined ||
        answer2 === undefined ||
        !questionId
      ) {
        throw new Error('請提供所有必要資訊：姓名、電話、答案和問題ID')
      }

      const user = await getOrCreateUser(name, phone)

      const { data: question, error: questionError } = await supabase
        .from('questions')
        .select('*')
        .eq('id', questionId)
        .single()

      if (questionError) {
        if (questionError.code === 'PGRST116') {
          return new Response(
            JSON.stringify({ error: 'the question does not exist' }),
            {
              status: 404,
              headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
              }
            }
          )
        }
        return new Response(JSON.stringify({ error: questionError.message }), {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        })
      }

      const isCorrect =
        answer1 === question.answer1 && answer2 === question.answer2

      const { data: questionCount } = await supabase
        .from('questions')
        .select('id')
        .lte('created_at', question.created_at)
        .order('created_at', { ascending: true })

      const questionNumber = questionCount ? questionCount.length - 1 : 0

      await updateUserAnswer(user.id, questionNumber, isCorrect)

      return new Response(
        JSON.stringify({
          correct: isCorrect
        }),
        {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
            'set-cookie': `username=${user.name}; userphone=${user.phone}; Path=/; SameSite=Strict`
          }
        }
      )
    } else if (req.method === 'OPTIONS') {
      return new Response("ok", {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers':
            'authorization, x-client-info, apikey, content-type'
        }
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
