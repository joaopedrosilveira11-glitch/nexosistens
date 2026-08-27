declare global {
  namespace Express {
    interface Request {
      user?: {
        sub: string
        email: string
        role: 'owner' | 'admin' | 'manager' | 'employee' | 'customer'
        companyId: string
        sessionId?: string
      }
      sessionId?: string
    }
  }
}

export {}
