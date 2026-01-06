export interface User {
  id: string
  name: string | null          // ✅ FIX
  email: string
  image: string | null         // ✅ FIX
  role: string
  createdAt: Date
  updatedAt: Date
}

export interface Project {
  id: string
  title: string
  description: string | null   // ✅ already nullable in DB
  template: string
  createdAt: Date
  updatedAt: Date
  userId: string
  user: User
  Starmark: { isMarked: boolean }[]
}
