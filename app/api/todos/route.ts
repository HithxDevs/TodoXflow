import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/app/lib/authOptions"
import { PrismaClient } from "@/app/generated/prisma"

const prisma = new PrismaClient()

// GET all todos for authenticated user
export async function GET() {
  try {
    const session = await getServerSession(authOptions) as { user?: { email?: string } } | null;
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: {
        todos: {
          orderBy: {
            createdAt: 'desc'
          }
        }
      }
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    return NextResponse.json(user.todos)
  } catch (error) {
    console.error("Error fetching todos:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST - Create new todo
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions) as { user?: { email?: string } } | null;
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    let body;
    try {
      body = await request.json()
    } catch  {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
    }

    const { title, description } = body

    if (!title || title.trim() === '') {
      return NextResponse.json({ error: "Title is required" }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Use correct model name from schema and don't manually set timestamps
    const todo = await prisma.todos.create({
      data: {
        title: title.trim(),
        description: description?.trim() || null,
        userId: user.id
        // createdAt and updatedAt are handled automatically by Prisma
      }
    })

    return NextResponse.json(todo, { status: 201 })
  } catch (error) {
    console.error("Error creating todo:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// PATCH - Update todo status
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions) as { user?: { email?: string } } | null;
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    let body;
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
    }

    const { id, done } = body

    if (!id) {
      return NextResponse.json({ error: "Todo ID is required" }, { status: 400 })
    }

    if (typeof done !== 'boolean') {
      return NextResponse.json({ error: "Done status must be a boolean" }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Check if todo belongs to the user
    const existingTodo = await prisma.todos.findFirst({
      where: {
        id: id,
        userId: user.id
      }
    })

    if (!existingTodo) {
      return NextResponse.json({ error: "Todo not found" }, { status: 404 })
    }

    // Update the todo
    const updatedTodo = await prisma.todos.update({
      where: { id: id },
      data: { done: done }
    })

    return NextResponse.json(updatedTodo)
  } catch (error) {
    console.error("Error updating todo:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}