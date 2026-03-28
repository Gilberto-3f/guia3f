import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const defaultPassword = process.env.SEED_ADMIN_DEFAULT_PASSWORD

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY antes de rodar o script.')
  process.exit(1)
}

if (!defaultPassword || defaultPassword.length < 8) {
  console.error('Defina SEED_ADMIN_DEFAULT_PASSWORD com no minimo 8 caracteres.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const adminSeeds = [
  { email: 'admin.geral@guia3f.com.br', cargo: 'ADM_GERAL' },
  { email: 'moderador.guias@guia3f.com.br', cargo: 'MODERADOR' },
  { email: 'moderador.taxistas@guia3f.com.br', cargo: 'MODERADOR' },
  { email: 'moderador.apps@guia3f.com.br', cargo: 'MODERADOR' },
  { email: 'moderador.vans@guia3f.com.br', cargo: 'MODERADOR' },
  { email: 'moderador.anfitrioes@guia3f.com.br', cargo: 'MODERADOR' },
  { email: 'financeiro@guia3f.com.br', cargo: 'FINANCEIRO' },
  { email: 'suporte@guia3f.com.br', cargo: 'SUPORTE' },
]

async function listAllUsers() {
  const users = []
  let page = 1
  const perPage = 200

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage })
    if (error) throw error
    const chunk = data?.users ?? []
    users.push(...chunk)
    if (chunk.length < perPage) break
    page += 1
  }
  return users
}

async function main() {
  const existingUsers = await listAllUsers()
  const existingByEmail = new Map(
    existingUsers
      .filter((u) => typeof u.email === 'string' && u.email.length > 0)
      .map((u) => [String(u.email).toLowerCase(), u.id])
  )

  const createdOrExisting = []

  for (const seed of adminSeeds) {
    const email = seed.email.toLowerCase()
    const existingId = existingByEmail.get(email)

    if (existingId) {
      createdOrExisting.push({ email, id: existingId, status: 'existing' })
      continue
    }

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password: defaultPassword,
      email_confirm: true,
      user_metadata: { seed_admin: true, cargo: seed.cargo },
      app_metadata: { role: 'admin' },
    })

    if (error) {
      console.error(`Erro ao criar ${email}: ${error.message}`)
      continue
    }

    const id = data?.user?.id
    if (!id) {
      console.error(`Usuario criado sem id retornado: ${email}`)
      continue
    }

    createdOrExisting.push({ email, id, status: 'created' })
  }

  console.log(JSON.stringify(createdOrExisting, null, 2))
  console.log('Use este mapeamento para conferir upserts em usuarios por email/id.')
}

main().catch((err) => {
  console.error('Falha no seed de auth.users:', err.message)
  process.exit(1)
})

