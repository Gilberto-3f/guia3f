import { appendFile } from 'fs/promises'
import { join } from 'path'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const payload = await request.json()
    const line = `${JSON.stringify(payload)}\n`
    const file = join(process.cwd(), 'debug-c04398.log')
    await appendFile(file, line, 'utf8')
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 })
  }
}
